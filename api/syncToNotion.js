// Serverless函数：同步学习记录到Notion
// 功能：拉取GitHub当日JSON → 计算学习时长 → 生成学习摘要/挑战 → 写入Notion学习记录表
// 注意：该文件需部署在Vercel/Netlify的api目录下

const fetch = require('node-fetch');

// 重试机制配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

// 等待函数
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 重试函数
const retryFetch = async (url, options, retries = MAX_RETRIES) => {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      // 限流，重试
      if (retries > 0) {
        await wait(RETRY_DELAY);
        return retryFetch(url, options, retries - 1);
      } else {
        throw new Error('API限流，已达到最大重试次数');
      }
    }
    
    if (!response.ok) {
      throw new Error(`API请求失败：${response.status} ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      await wait(RETRY_DELAY);
      return retryFetch(url, options, retries - 1);
    } else {
      throw error;
    }
  }
};

// 从GitHub获取文件内容
const getGitHubFile = async (owner, repo, filePath, githubToken) => {
  try {
    const response = await retryFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    const data = await response.json();
    const decodedContent = Buffer.from(data.content, 'base64').toString('utf8');
    return decodedContent;
  } catch (error) {
    console.error('获取GitHub文件失败:', error);
    throw error;
  }
};

// 调用AI生成摘要或挑战
const generateAIContent = async (prompt, aiApiUrl, aiApiKey) => {
  try {
    // 在生产环境中，从环境变量获取系统提示词
    // 在开发环境中，可直接使用默认提示词
    const systemPrompt = process.env.AI_SYSTEM_PROMPT || '你是一个专业的学习助手，帮助用户生成学习摘要和挑战。';
    
    const response = await retryFetch(
      aiApiUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'doubao-1-5-pro-32k-250115', // 默认模型，可根据需要调整
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.7
        })
      }
    );
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('调用AI生成内容失败:', error);
    throw error;
  }
};

// 写入Notion学习记录表
const writeToNotion = async (record, notionApiKey) => {
  try {
    // Notion学习记录表数据库ID（固定值）
    const DATABASE_ID = '2e43af348d5780fd9b8ed286eba4c996';
    
    const response = await retryFetch(
      'https://api.notion.com/v1/pages',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parent: {
            database_id: DATABASE_ID
          },
          properties: {
            // 课程名称：文本
            '课程名称': {
              title: [
                {
                  text: {
                    content: record.courseName
                  }
                }
              ]
            },
            // 章节名称：文本
            '章节名称': {
              rich_text: [
                {
                  text: {
                    content: record.chapterName
                  }
                }
              ]
            },
            // 学习开始时间：日期时间
            '学习开始时间': {
              date: {
                start: record.startTime
              }
            },
            // 学习结束时间：日期时间
            '学习结束时间': {
              date: {
                start: record.endTime
              }
            },
            // 学习时长：数字
            '学习时长': {
              number: record.duration
            },
            // 掌握程度：单选
            '掌握程度': {
              select: {
                name: '待评估'
              }
            },
            // 状态：单选
            '状态': {
              select: {
                name: '已完成'
              }
            },
            // 学习摘要：文本
            '学习摘要': {
              rich_text: [
                {
                  text: {
                    content: record.summary
                  }
                }
              ]
            },
            // 学习挑战：文本
            '学习挑战': {
              rich_text: [
                {
                  text: {
                    content: record.challenge
                  }
                }
              ]
            }
          }
        })
      }
    );
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('写入Notion学习记录表失败:', error);
    throw error;
  }
};

// 主函数
exports.handler = async (event, context) => {
  try {
    // 获取请求体
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ success: false, message: '请求体格式错误' })
      };
    }
    
    const { courseName, chapterName } = requestBody;
    
    // 验证必填参数
    if (!courseName || !chapterName) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ success: false, message: '缺少必填参数' })
      };
    }
    
    // 从环境变量获取配置
    const { 
      GITHUB_TOKEN, 
      GITHUB_REPO_INFO, 
      AI_API_URL, 
      AI_API_KEY,
      NOTION_API_KEY
    } = process.env;
    
    // 验证环境变量
    if (!GITHUB_TOKEN || !GITHUB_REPO_INFO || !AI_API_URL || !AI_API_KEY || !NOTION_API_KEY) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ success: false, message: '环境变量配置不完整' })
      };
    }
    
    // 解析GitHub仓库信息
    const [owner, repo] = GITHUB_REPO_INFO.split('/');
    if (!owner || !repo) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ success: false, message: 'GITHUB_REPO_INFO格式错误，应为owner/repo' })
      };
    }
    
    // 获取当前日期（UTC+8时区）
    const now = new Date();
    const utc8Date = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const dateStr = utc8Date.toISOString().split('T')[0];
    const filePath = `daily-chats/${dateStr}.json`;
    
    // 1. 从GitHub获取当日对话记录
    let chatContent;
    try {
      chatContent = await getGitHubFile(owner, repo, filePath, GITHUB_TOKEN);
    } catch (error) {
      // 文件不存在或获取失败，返回错误
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ success: false, message: '获取当日对话记录失败，请先进行学习对话' })
      };
    }
    
    // 解析对话记录
    let chats;
    try {
      chats = JSON.parse(chatContent);
      if (!Array.isArray(chats)) {
        chats = [];
      }
    } catch (error) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ success: false, message: '解析对话记录失败' })
      };
    }
    
    // 2. 过滤当前课程和章节的对话
    const courseChapterChats = chats.filter(chat => 
      chat.course === courseName && chat.chapter === chapterName
    );
    
    if (courseChapterChats.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ success: false, message: '未找到当前课程和章节的对话记录' })
      };
    }
    
    // 3. 计算学习时长
    const startTime = new Date(courseChapterChats[0].time);
    const endTime = new Date();
    const durationMinutes = Math.ceil((endTime - startTime) / (1000 * 60));
    
    // 4. 生成学习摘要（≤50字）
    const summaryBasePrompt = process.env.AI_SUMMARY_PROMPT || '请为以下学习对话生成一个不超过50字的学习摘要：';
    const summaryPrompt = `${summaryBasePrompt}\n${JSON.stringify(courseChapterChats)}`;
    let summary;
    try {
      summary = await generateAIContent(summaryPrompt, AI_API_URL, AI_API_KEY);
      // 确保摘要不超过50字
      if (summary.length > 50) {
        summary = summary.substring(0, 50) + '...';
      }
    } catch (error) {
      summary = '自动生成摘要失败';
    }
    
    // 5. 生成学习挑战（≤30字）
    const challengeBasePrompt = process.env.AI_CHALLENGE_PROMPT || '请为以下学习内容生成一个不超过30字的学习挑战：';
    const challengePrompt = `${challengeBasePrompt}\n课程：${courseName}\n章节：${chapterName}\n对话：${JSON.stringify(courseChapterChats.slice(-2))}`;
    let challenge;
    try {
      challenge = await generateAIContent(challengePrompt, AI_API_URL, AI_API_KEY);
      // 确保挑战不超过30字
      if (challenge.length > 30) {
        challenge = challenge.substring(0, 30) + '...';
      }
    } catch (error) {
      challenge = '自动生成挑战失败';
    }
    
    // 6. 构造Notion记录
    const notionRecord = {
      courseName,
      chapterName,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: durationMinutes,
      summary,
      challenge
    };
    
    // 7. 写入Notion学习记录表
    await writeToNotion(notionRecord, NOTION_API_KEY);
    
    // 返回结果
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        message: '学习记录已成功同步到Notion',
        record: notionRecord
      })
    };
    
  } catch (error) {
    console.error('同步学习记录失败:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: false,
        message: `同步学习记录失败: ${error.message}`
      })
    };
  }
};

// 处理CORS预检请求
if (event.httpMethod === 'OPTIONS') {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({ success: true })
  };
}