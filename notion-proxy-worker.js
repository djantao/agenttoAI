// Cloudflare Workers脚本 - Notion API代理

// 允许的来源域名
const ALLOWED_ORIGINS = [
  'https://djantao.github.io', // 您的GitHub Pages域名
  'http://localhost:3000' // 本地开发环境
];

// 处理CORS预检请求
function handleOptions(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400' // 24小时
  };
  
  return new Response(null, {
    headers: headers
  });
}

// 格式化章节列表为适合Notion显示的字符串
function formatChapters(chapters) {
    if (!chapters || !Array.isArray(chapters)) {
        return '';
    }
    
    let chaptersText = '';
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        if (chapter.title) {
            chaptersText += `${i + 1}. ${chapter.title}`;
            if (chapter.description) {
                chaptersText += `：${chapter.description}`;
            }
            if (i < chapters.length - 1) {
                chaptersText += '\n';
            }
        }
    }
    
    return chaptersText;
}

// 根据课程内容自动生成所属模块标签
function generateModule(course) {
    console.log('generateModule函数被调用，课程对象:', course);
    if (!course) {
        console.log('课程对象为空，返回空数组');
        return [];
    }
    
    // 优先使用AI返回的module字段
    if (course.module) {
        console.log('使用AI返回的module字段:', course.module);
        // 处理不同格式的module字段
        if (Array.isArray(course.module)) {
            // 如果是数组，直接返回
            return course.module;
        } else if (typeof course.module === 'string') {
            // 如果是字符串，转换为数组
            return [course.module];
        }
    }
    
    // 如果没有AI返回的module字段，根据课程内容自动生成
    const courseContent = (course.title || '') + ' ' + (course.description || '');
    console.log('课程内容:', courseContent);
    const lowerContent = courseContent.toLowerCase();
    console.log('小写课程内容:', lowerContent);
    
    // 定义常见领域关键词
    const domainKeywords = [
        { name: 'Fluss', keywords: ['fluss', 'flow', '数据集成'] },
        { name: '财务', keywords: ['财务', '会计', '报表', '记账', '金融'] },
        { name: 'Spark', keywords: ['spark', '大数据', '分布式'] },
        { name: 'Python', keywords: ['python', '编程', '代码'] },
        { name: '设计', keywords: ['设计', 'ui', 'ux', '平面', '视觉'] },
        { name: '数据分析', keywords: ['数据分析', '数据', '统计', '分析'] },
        { name: '英语', keywords: ['英语', '语言', '词汇', '语法'] }
    ];
    
    // 匹配领域关键词
    for (const domain of domainKeywords) {
        for (const keyword of domain.keywords) {
            if (lowerContent.includes(keyword)) {
                console.log('匹配到关键词:', keyword, '，返回领域:', domain.name);
                return [domain.name];
            }
        }
    }
    
    // 如果没有匹配到，默认返回"通用"标签
    console.log('没有匹配到关键词，返回通用标签');
    return ['通用'];
}

// 处理POST请求
async function handlePost(request) {
    const origin = request.headers.get('Origin');
    
    // 设置CORS响应头
    const headers = {
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        'Content-Type': 'application/json'
    };
  
  try {
    // 解析请求体
    const requestBody = await request.json();
    const { courses, notionApiToken, notionDatabaseId } = requestBody;
    
    if (!courses || !notionApiToken || !notionDatabaseId) {
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: headers
      });
    }
    
    // 存储成功同步的课程数量
    let successCount = 0;
    const results = [];
    
    // 遍历课程，逐个同步到Notion
    for (const course of courses) {
      try {
        // 1. 先检查Notion数据库中是否已存在相同名称的课程
        const searchResponse = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${notionApiToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            filter: {
              property: '课程名称',
              title: {
                equals: course.title
              }
            }
          })
        });
        
        const searchResult = await searchResponse.json();
        
        if (!searchResponse.ok) {
          throw new Error(`搜索课程失败: ${searchResult.error.message}`);
        }
        
        let notionResponse, notionResult;
        
        if (searchResult.results.length > 0) {
          // 课程已存在，更新现有页面
          const existingPageId = searchResult.results[0].id;
          
          notionResponse = await fetch(`https://api.notion.com/v1/pages/${existingPageId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${notionApiToken}`,
              'Content-Type': 'application/json',
              'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
              properties: {
                '简介': {
                  rich_text: [
                    {
                      text: {
                        content: course.description || ''
                      }
                    }
                  ]
                },
                '难度': {
                  select: {
                    name: '初级'
                  }
                },
                '所属模块': {
                  multi_select: (course.module ? [course.module] : generateModule(course)).map(module => ({ name: module }))
                },
                '章节列表': {
                  rich_text: [
                    {
                      text: {
                        content: formatChapters(course.chapters)
                      }
                    }
                  ]
                },
                '更新时间': {
                  date: {
                    start: new Date().toISOString()
                  }
                }
              }
            })
          });
          
          notionResult = await notionResponse.json();
          
          if (notionResponse.ok) {
            successCount++;
            results.push({ success: true, course: course.title, notionId: existingPageId, action: 'updated' });
          } else {
            results.push({ 
              success: false, 
              course: course.title, 
              error: notionResult, 
              status: notionResponse.status,
              statusText: notionResponse.statusText,
              action: 'update_failed'
            });
          }
        } else {
          // 课程不存在，创建新页面
          notionResponse = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${notionApiToken}`,
              'Content-Type': 'application/json',
              'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
              parent: {
                database_id: notionDatabaseId
              },
              properties: {
                '课程名称': {
                  title: [
                    {
                      text: {
                        content: course.title
                      }
                    }
                  ]
                },
                '简介': {
                  rich_text: [
                    {
                      text: {
                        content: course.description || ''
                      }
                    }
                  ]
                },
                '状态': {
                  select: {
                    name: '待学习'
                  }
                },
                '所属模块': {
                  multi_select: generateModule(course).map(module => ({ name: module }))
                },
                '难度': {
                  select: {
                    name: '初级'
                  }
                },
                '章节列表': {
                  rich_text: [
                    {
                      text: {
                        content: formatChapters(course.chapters)
                      }
                    }
                  ]
                },
                '创建时间': {
                  date: {
                    start: new Date().toISOString()
                  }
                }
              }
            })
          });
          
          notionResult = await notionResponse.json();
          
          if (notionResponse.ok) {
            successCount++;
            results.push({ success: true, course: course.title, notionId: notionResult.id, action: 'created' });
          } else {
            results.push({ 
              success: false, 
              course: course.title, 
              error: notionResult, 
              status: notionResponse.status,
              statusText: notionResponse.statusText,
              action: 'create_failed'
            });
          }
        }
      } catch (error) {
        results.push({ success: false, course: course.title, error: error.message });
      }
    }
    
    // 返回同步结果
    return new Response(JSON.stringify({
      success: true,
      total: courses.length,
      successCount: successCount,
      results: results
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

// 处理所有请求
async function handleRequest(request) {
  const method = request.method;
  
  if (method === 'OPTIONS') {
    return handleOptions(request);
  } else if (method === 'POST') {
    return handlePost(request);
  } else {
    return new Response('Method not allowed', {
      status: 405,
      headers: {
        'Allow': 'POST, OPTIONS'
      }
    });
  }
}

// 监听fetch事件
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

/*
部署说明：
1. 登录Cloudflare控制台
2. 选择Workers & Pages
3. 创建一个新的Worker
4. 将此脚本粘贴到编辑器中
5. 点击"部署"按钮
6. 部署后，获取Worker的URL（如：https://notion-proxy.your-account.workers.dev）
7. 在您的前端代码中，将Notion同步请求指向此Worker URL

使用说明：
- 前端需要发送POST请求到Worker URL
- 请求体格式：
  {
    "courses": [
      {
        "title": "课程名称",
        "description": "课程描述",
        "targetAudience": "适合人群",
        "duration": "预计时长"
      }
    ],
    "notionApiToken": "您的Notion API密钥",
    "notionDatabaseId": "您的Notion数据库ID"
  }
*/
