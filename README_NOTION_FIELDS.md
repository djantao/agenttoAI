# 如何查看Notion数据库字段名称

## 一、当前代码中使用的字段

根据当前代码，我们的课程表使用以下字段映射到Notion数据库：

| 代码中的字段名 | Notion数据库属性名 | 属性类型 |
|---------------|-------------------|---------|
| course.title | Name | 标题 (Title) |
| course.description | Description | 富文本 (Rich text) |
| course.targetAudience | Target Audience | 富文本 (Rich text) |
| course.duration | Duration | 富文本 (Rich text) |
| - (固定值) | Status | 选择 (Select) - 值为"待学习" |

## 二、查看Notion数据库字段的方法

### 方法1：直接在Notion中查看

1. 打开你的Notion数据库
2. 点击右上角的「⋮」菜单
3. 选择「数据库属性」
4. 在弹出的面板中，你可以看到所有字段（属性）的名称和类型
5. 点击每个属性可以查看详细设置

### 方法2：使用Notion API获取数据库结构

可以通过发送API请求来获取数据库的完整结构，包含所有属性的详细信息：

```bash
# 使用curl命令获取数据库结构
curl -X GET "https://api.notion.com/v1/databases/YOUR_DATABASE_ID" \
  -H "Authorization: Bearer YOUR_NOTION_API_TOKEN" \
  -H "Notion-Version: 2022-06-28"
```

### 方法3：通过Cloudflare Worker调试

当前的Cloudflare Worker已经配置了详细的错误返回，当同步失败时，会返回Notion API的具体错误信息，包括：
- 哪个课程同步失败
- 具体的错误原因（通常包含字段名称不匹配的信息）

## 三、确保字段匹配的建议

1. **创建新的Notion数据库**：建议创建一个全新的数据库，使用默认的"Name"字段，然后添加以下字段：
   - Description (富文本)
   - Status (选择类型，添加"待学习"选项)
   - Target Audience (富文本)
   - Duration (富文本)

2. **检查属性类型**：确保每个字段的类型与代码中期望的类型匹配

3. **使用英文名称**：建议使用英文字段名称，避免中文名称在API调用中可能出现的问题

4. **查看同步日志**：当同步失败时，打开浏览器的开发者工具（F12），查看控制台中的错误信息，Worker会返回详细的Notion API错误

## 四、修改字段映射

如果你的Notion数据库使用了不同的字段名称，你可以修改`notion-proxy-worker.js`文件中的映射关系：

```javascript
// 在 notion-proxy-worker.js 第65-107行
properties: {
  'Your_Notion_Field_Name': {
    title: [
      {
        text: {
          content: course.title
        }
      }
    ]
  },
  // 其他字段映射...
}
```

## 五、调试技巧

1. **查看浏览器控制台**：同步时打开控制台，查看完整的请求和响应
2. **使用Notion API Explorer**：在Notion开发者工具中测试API请求
3. **检查Worker日志**：在Cloudflare Workers控制台查看请求日志

## 六、常见问题

1. **同步失败，提示"invalid property name"**：
   - 原因：Notion数据库中不存在代码中指定的字段名称
   - 解决：修改Worker中的字段名称，或在Notion数据库中添加对应的字段

2. **同步失败，提示"property_type_mismatch"**：
   - 原因：字段类型不匹配（例如：代码期望标题类型，但数据库中是富文本类型）
   - 解决：修改Notion数据库中的字段类型，或调整Worker中的属性结构

3. **同步成功但字段值为空**：
   - 原因：课程数据中缺少对应的字段值
   - 解决：检查AI生成的课程数据结构，确保包含所有必要字段

通过以上方法，你可以清楚地了解课程表中的字段名称，并确保它们与Notion数据库正确匹配。