# Notion数据处理与免费后端服务方案

## 一、代理实现Notion数据过滤与处理的可行性

### 1. 现状分析

当前的Notion代理脚本（Cloudflare Workers）主要用于解决CORS问题和同步课程数据。根据您的需求，需要扩展其功能以实现：
- 根据特定条件过滤Notion数据（如模块=spark）
- 处理返回的JSON内容，减少返回给前端的数据量
- 直接返回前端可用的数据格式

### 2. 解决方案：扩展Cloudflare Workers代理

Cloudflare Workers完全支持实现这些功能，因为它允许在边缘节点处理请求和响应。

#### 2.1 实现步骤

**步骤1：修改前端请求格式**
```javascript
// 前端发送带过滤条件的请求
const response = await fetch(config.notionProxyUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        action: 'filtered_query', // 新增action类型
        notionApiToken: config.notionApiToken,
        notionDatabaseId: config.notionDatabaseId,
        filter: {
            property: '所属模块',
            multi_select: {
                contains: 'spark' // 过滤条件：模块包含spark
            }
        },
        fields: ['课程名称', '难度', '章节列表'] // 只返回需要的字段
    })
});
```

**步骤2：在Cloudflare Workers中添加过滤处理逻辑**

```javascript
// 新增处理过滤查询的函数
async function handleFilteredQuery(requestBody, headers) {
    const { notionApiToken, notionDatabaseId, filter, fields } = requestBody;
    
    if (!notionApiToken || !notionDatabaseId) {
        return new Response(JSON.stringify({ error: '缺少必要参数' }), {
            status: 400,
            headers: headers
        });
    }
    
    try {
        // 调用Notion API查询数据，添加过滤条件
        const response = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionApiToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                filter: filter || {},
                page_size: 100
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`Notion API查询失败: ${data.message || response.status}`);
        }
        
        // 处理返回数据，只保留需要的字段
        const processedResults = data.results.map(page => {
            const processedPage = {
                id: page.id
            };
            
            // 只保留指定的字段
            if (fields && Array.isArray(fields)) {
                fields.forEach(field => {
                    if (page.properties[field]) {
                        // 根据字段类型处理数据
                        switch (page.properties[field].type) {
                            case 'title':
                                processedPage[field] = page.properties[field].title[0]?.text?.content || '';
                                break;
                            case 'rich_text':
                                processedPage[field] = page.properties[field].rich_text[0]?.text?.content || '';
                                break;
                            case 'select':
                                processedPage[field] = page.properties[field].select?.name || '';
                                break;
                            case 'multi_select':
                                processedPage[field] = page.properties[field].multi_select.map(item => item.name);
                                break;
                            // 可以根据需要处理更多字段类型
                            default:
                                processedPage[field] = page.properties[field];
                        }
                    }
                });
            } else {
                // 如果没有指定字段，返回所有字段的简化版本
                Object.keys(page.properties).forEach(key => {
                    const property = page.properties[key];
                    switch (property.type) {
                        case 'title':
                            processedPage[key] = property.title[0]?.text?.content || '';
                            break;
                        case 'rich_text':
                            processedPage[key] = property.rich_text[0]?.text?.content || '';
                            break;
                        case 'select':
                            processedPage[key] = property.select?.name || '';
                            break;
                        case 'multi_select':
                            processedPage[key] = property.multi_select.map(item => item.name);
                            break;
                        default:
                            processedPage[key] = property;
                    }
                });
            }
            
            return processedPage;
        });
        
        // 返回处理后的数据
        return new Response(JSON.stringify({
            results: processedResults,
            has_more: data.has_more,
            next_cursor: data.next_cursor
        }), {
            headers: headers
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: headers
        });
    }
}

// 在handlePost函数中添加新的action处理
if (action === 'filtered_query') {
    return handleFilteredQuery(requestBody, headers);
}
```

**步骤3：前端直接使用处理后的数据**
```javascript
// 前端直接使用过滤和处理后的数据
const data = await response.json();
data.results.forEach(course => {
    console.log('课程名称:', course['课程名称']);
    console.log('难度:', course['难度']);
    console.log('章节列表:', course['章节列表']);
});
```

#### 2.2 优势

- **减少前端数据处理负担**：复杂的数据过滤和处理在边缘节点完成
- **减少网络传输**：只返回需要的数据，减少带宽消耗
- **提高前端性能**：前端直接使用处理后的数据，减少解析和处理时间
- **保持数据一致性**：所有前端实例使用相同的过滤和处理逻辑
- **降低API调用次数**：边缘节点可以缓存处理结果，减少对Notion API的调用

## 二、免费后端处理云服务对比

以下是支持实现数据过滤和处理的免费后端服务：

| 服务名称 | 免费计划 | 关键功能 | 优势 | 劣势 |
|---------|---------|---------|------|------|
| **Cloudflare Workers** | 每天10万次请求，10ms CPU时间/请求 | 边缘计算，JavaScript/TypeScript，支持WebSocket | 全球边缘部署，低延迟，与Notion代理无缝集成，免费额度高 | 内存限制（128MB），执行时间限制（50ms） |
| **Vercel Edge Functions** | 每天10万次请求，1GB-hours/月 | 边缘计算，JavaScript/TypeScript | 与Vercel部署无缝集成，支持React/Next.js，开发体验好 | 执行时间限制（100ms），冷启动时间较长 |
| **Netlify Functions** | 每天125,000次请求，100小时计算时间/月 | Node.js/Go/Rust，支持定时函数 | 与Netlify部署无缝集成，支持多种语言，开发简单 | 冷启动时间较长，执行时间限制（10秒） |
| **AWS Lambda + API Gateway** | 每月100万次请求，400,000 GB-seconds/月 | 支持多种语言，可与AWS服务集成 | 生态丰富，支持多种语言，可扩展性强 | 配置复杂，冷启动时间较长 |
| **Google Cloud Functions** | 每月200万次请求，400,000 GB-seconds/月 | 支持多种语言，可与GCP服务集成 | 生态丰富，支持多种语言，性能稳定 | 冷启动时间较长，配置相对复杂 |
| **Azure Functions** | 每月100万次请求，400,000 GB-seconds/月 | 支持多种语言，可与Azure服务集成 | 生态丰富，企业级支持，支持多种语言 | 冷启动时间较长，配置复杂 |
| **Supabase Edge Functions** | 每月10万次请求，100小时计算时间/月 | Deno运行时，支持TypeScript | 与Supabase数据库无缝集成，支持实时数据 | 支持的语言有限（主要是TypeScript） |
| **Render Functions** | 每月750小时计算时间，100GB出站流量 | Node.js/Python/Go/Rust | 部署简单，支持多种语言，性能稳定 | 冷启动时间较长，免费计划有限制 |

## 三、实施建议

### 1. 短期方案（1-2周）

**推荐：扩展现有Cloudflare Workers代理**

- **原因**：
  - 已有的代理基础，无需重新配置
  - 与现有代码无缝集成
  - 边缘计算，低延迟
  - 免费额度足够个人和小型团队使用
  - 开发和部署简单

- **实施步骤**：
  1. 扩展现有代理脚本，添加`filtered_query` action
  2. 实现数据过滤和处理逻辑
  3. 修改前端请求，添加过滤条件
  4. 部署更新后的代理脚本
  5. 测试并优化

### 2. 长期方案（1-3个月）

**推荐：考虑使用Vercel Edge Functions或Netlify Functions**

- **原因**：
  - 更好的开发体验和调试工具
  - 支持更复杂的业务逻辑
  - 与前端框架（如React/Next.js）无缝集成
  - 更灵活的部署选项

- **实施步骤**：
  1. 设计API接口和数据格式
  2. 开发Edge Functions实现数据过滤和处理
  3. 部署到Vercel/Netlify
  4. 修改前端代码，调用新的API
  5. 测试并优化

## 四、技术实现细节

### 1. 数据过滤策略

- **基于属性过滤**：根据Notion数据库的属性进行过滤（如模块、难度、状态等）
- **基于关键词过滤**：在标题或描述中搜索关键词
- **基于日期过滤**：根据创建时间或更新时间过滤
- **组合过滤**：支持多个过滤条件的组合

### 2. 数据处理策略

- **字段精简**：只返回前端需要的字段
- **数据格式化**：将Notion API返回的复杂格式转换为前端可用的简单格式
- **数据转换**：将JSON字符串转换为JavaScript对象，解析日期格式等
- **数据聚合**：将相关数据聚合为前端可用的结构

### 3. 缓存策略

- **边缘缓存**：在Cloudflare Workers或Edge Functions中缓存处理结果
- **缓存失效机制**：基于时间或事件触发缓存更新
- **条件缓存**：根据请求参数和数据更新频率调整缓存策略

## 五、安全性考虑

- **API密钥保护**：不要在前端暴露Notion API密钥，所有请求通过代理发送
- **请求验证**：验证前端请求的合法性，防止恶意请求
- **数据加密**：使用HTTPS保护所有请求和响应
- **权限控制**：限制只有授权用户可以访问敏感数据
- **速率限制**：防止API滥用，设置请求频率限制

## 六、总结

1. **代理实现过滤和处理**：完全可行，推荐使用Cloudflare Workers扩展现有代理
2. **免费后端服务**：有多种选择，各有优势，根据需求选择
3. **实施优先级**：先扩展现有代理，解决当前问题；长期考虑更强大的Edge Functions
4. **性能优化**：结合缓存策略，减少API调用次数，提高响应速度
5. **安全性**：始终保护API密钥，验证请求合法性，使用HTTPS

通过实施上述方案，可以有效解决Notion数据过滤和处理的问题，同时控制成本，提高系统性能和安全性。