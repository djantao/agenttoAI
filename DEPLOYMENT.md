# AI学习助手 - 部署文档

## 部署架构

AI学习助手采用前后端分离架构：
- 前端：静态HTML/CSS/JS文件，部署在GitHub Pages
- 后端：Serverless函数，部署在Vercel/Netlify
- 数据存储：Notion（课程数据、学习记录）和GitHub（每日对话记录）

## 部署步骤

### 1. 前端部署（GitHub Pages）

1. 克隆代码仓库到本地
2. 修改`script.js`中的配置（如果需要）
3. 将代码推送到GitHub仓库
4. 在GitHub仓库设置中启用GitHub Pages
5. 选择部署分支（通常是`main`或`master`）
6. 等待部署完成，获取GitHub Pages URL

### 2. 后端部署（Vercel/Netlify）

#### 2.1 Vercel部署

1. 登录Vercel控制台
2. 点击"Add New Project"
3. 选择"Import Git Repository"
4. 连接GitHub仓库
5. 配置部署设置：
   - 构建命令：`npm run build`（如果有）
   - 输出目录：`dist`（如果有）
   - 环境变量：参考下方环境变量配置
6. 点击"Deploy"
7. 等待部署完成，获取Vercel URL

#### 2.2 Netlify部署

1. 登录Netlify控制台
2. 点击"Add a new site" → "Import an existing project"
3. 连接GitHub仓库
4. 配置部署设置：
   - 构建命令：`npm run build`（如果有）
   - 发布目录：`dist`（如果有）
   - 环境变量：参考下方环境变量配置
5. 点击"Deploy site"
6. 等待部署完成，获取Netlify URL

### 3. 环境变量配置

在Vercel/Netlify控制台中添加以下环境变量：

| 变量名 | 说明 |
|--------|------|
| NOTION_API_KEY | Notion集成密钥（需有目标数据库读写权限） |
| NOTION_DATABASE_ID | 固定值：2e43af348d5780fd9b8ed286eba4c996 |
| GITHUB_TOKEN | GitHub个人访问令牌（需repo写权限） |
| GITHUB_REPO_INFO | 仓库信息，格式：owner/repo（如：xxx/learn-module） |
| AI_API_URL | AI接口请求地址 |
| AI_API_KEY | AI接口调用密钥 |
| AI_SYSTEM_PROMPT | 学习助手系统提示词（可选，默认值："你是一个专业的学习助手，帮助用户学习课程内容。"） |
| AI_SUMMARY_PROMPT | 学习摘要生成提示词（可选，默认值："你是一个专业的学习助手，帮助用户生成学习摘要。请为以下学习对话生成一个简洁、准确的学习摘要，不超过50字。"） |
| AI_CHALLENGE_PROMPT | 学习挑战生成提示词（可选，默认值："你是一个专业的学习助手，帮助用户生成学习挑战。请为以下学习内容生成一个有针对性、可操作的学习挑战，不超过30字。"） |

### 4. Notion配置

1. 创建Notion集成（Integration）
2. 获取Notion API Key
3. 在Notion数据库中邀请集成访问
4. 确保数据库包含以下字段：
   - 课程名称（文本）
   - 章节列表（富文本）
   - 状态（单选）
   - 创建时间（创建时间）

### 5. GitHub配置

1. 创建GitHub个人访问令牌（PAT），权限包括：
   - repo（仓库读写权限）
   - user（用户信息）
2. 在仓库中创建`daily-chats/`目录（如果不存在）

## 功能测试

### 测试流程

1. 访问GitHub Pages URL
2. 输入配置信息（豆包API、Notion API等）
3. 生成课程列表（通过对话方式）
4. 同步课程到Notion
5. 在学习功能模块中选择课程和章节
6. 进行学习对话
7. 停止学习并同步到Notion
8. 验证GitHub每日对话记录和Notion学习记录

### 测试要点

1. 课程生成功能是否正常
2. Notion同步是否成功
3. 学习对话功能是否正常
4. GitHub每日对话记录是否生成
5. 学习记录是否同步到Notion

## 常见问题及解决方案

### 1. 404 Not Found（AI接口）
- 检查AI_API_URL是否正确
- 检查AI_API_KEY是否有效
- 检查模型名称是否正确

### 2. 403 Forbidden（GitHub API）
- 检查GITHUB_TOKEN是否有效
- 检查GITHUB_TOKEN权限是否足够
- 检查GITHUB_REPO_INFO格式是否正确

### 3. 401 Unauthorized（Notion API）
- 检查NOTION_API_KEY是否有效
- 检查Notion集成是否被邀请到数据库
- 检查NOTION_DATABASE_ID是否正确

### 4. 429 Too Many Requests
- 等待一段时间后重试
- 检查API调用频率限制
- 考虑添加更复杂的重试机制

## 技术支持

如果遇到部署问题，请检查：
1. 环境变量配置是否正确
2. API密钥是否有效
3. 网络连接是否正常
4. 浏览器控制台是否有错误信息

## 更新日志

### v1.0.0
- 初始版本发布
- 支持课程生成和Notion同步
- 支持学习功能模块
- 支持GitHub每日对话记录

## 贡献指南

欢迎提交Issue和Pull Request来改进AI学习助手！

## 许可证

MIT License