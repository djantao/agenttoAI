# AI学习助手

一个基于JavaScript的AI学习助手，可以通过与用户的三轮对话分析学习需求，并生成个性化课程列表，最后同步到Notion数据库。

## 功能特点

1. **三轮对话分析**：通过三个问题了解用户的学习领域、学习目标和可投入时间
2. **个性化课程生成**：根据对话内容生成相关领域的课程列表
3. **Notion同步**：将生成的课程列表自动同步到指定的Notion数据库
4. **简洁美观的界面**：采用现代化的设计风格，提供良好的用户体验

## 技术栈

- **HTML5**：页面结构
- **CSS3**：样式设计
- **JavaScript**：交互逻辑和API调用

## 部署方法

### GitHub Pages部署

1. 登录GitHub，创建一个新的仓库
2. 将本项目的所有文件上传到仓库中
3. 在仓库的`Settings`中找到`Pages`选项
4. 选择`main`分支作为部署源，然后点击`Save`
5. 等待几分钟，GitHub Pages会生成访问链接

### 本地运行

直接在浏览器中打开`index.html`文件即可运行。

## 使用说明

1. 打开应用后，回答AI助手的三个问题：
   - 问题1：您想学习什么领域的知识？
   - 问题2：您的学习目标是什么？
   - 问题3：您每天可以投入多少时间学习？

2. 回答完所有问题后，AI助手会生成一个课程列表

3. 点击"同步到Notion"按钮，将课程列表同步到您的Notion数据库

## Notion配置

### 获取Notion API Token

1. 访问[Notion Developers](https://developers.notion.com/)
2. 点击"My integrations"，创建一个新的集成
3. 复制生成的API Token

### 创建Notion数据库

1. 在Notion中创建一个新的数据库
2. 确保数据库包含以下属性：
   - `Name` (标题类型)
   - `Description` (富文本类型)
   - `Status` (选择类型，包含"待学习"选项)
3. 复制数据库ID（可以从数据库URL中获取）

### 配置API Token和数据库ID

在`script.js`文件中修改以下常量：

```javascript
const NOTION_API_TOKEN = '您的Notion API Token';
const NOTION_DATABASE_ID = '您的数据库ID';
```

## 注意事项

1. 确保您的Notion集成已经被添加到目标数据库中
2. 本项目直接调用Notion API，不需要本地服务器作为代理
3. 在浏览器中运行时，可能会遇到跨域问题，建议部署到GitHub Pages或其他支持HTTPS的服务器上

## 项目结构

```
AI学习助手/
├── index.html          # 主页面
├── styles.css          # 样式文件
├── script.js           # 交互逻辑
└── README.md           # 项目说明
```

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 许可证

MIT License