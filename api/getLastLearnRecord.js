// Serverless函数：获取最近学习记录
// 功能：获取用户最近一次的学习记录，用于断点续学
// 注意：该文件需部署在Vercel/Netlify的api目录下

// 使用平台提供的全局fetch和Buffer
// Serverless环境中通常已全局可用，无需额外导入
const fetch = global.fetch;
const Buffer = global.Buffer;

// 重试机制配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

// 等待函数
function wait(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

// 重试函数
async function retryFetch(url, options, retries = MAX_RETRIES) {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      // API限流，重试
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
}

// 从Notion获取最近学习记录
async function getLastRecordFromNotion(notionApiKey) {
  try {
    // Notion学习记录表数据库ID（固定值）
    const DATABASE_ID = process.env.NOTION_DATABASE_ID || '2e43af348d5780fd9b8ed286eba4c996';
    
    const response = await retryFetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            property: '状态',
            select: {
              equals: '已完成'
            }
          },
          sorts: [
            {
              property: '学习结束时间',
              direction: 'descending'
            }
          ],
          page_size: 1
        })
      }
    );
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const lastRecord = data.results[0];
      const courseName = lastRecord.properties['课程名称']?.title[0]?.text?.content || '';
      const chapterName = lastRecord.properties['章节名称']?.rich_text[0]?.text?.content || '';
      const lastChatTime = lastRecord.properties['学习结束时间']?.date?.start || '';
      
      return {
        hasLastRecord: true,
        courseName,
        chapterName,
        lastChatTime,
        lastChatContext: [] // Notion记录中没有历史对话，后续从GitHub获取
      };
    }
    
    return null;
  } catch (error) {
    console.error('从Notion获取最近学习记录失败:', error);
    return null;
  }
}

// 从GitHub获取最近对话记录
async function getLastChatFromGitHub(githubToken, githubRepoInfo) {
  try {
    const [owner, repo] = githubRepoInfo.split('/');
    if (!owner || !repo) {
      throw new Error('GITHUB_REPO_INFO格式错误，应为owner/repo');
    }
    
    // 获取当前日期（UTC+8时区）
    const now = new Date();
    const utc8Date = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const dateStr = utc8Date.toISOString().split('T')[0];
    const filePath = `daily-chats/${dateStr}.json`;
    
    // 尝试获取今日文件
    let response = await retryFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    let chats = null;
    
    // 如果今日文件不存在，获取最近的文件
    if (response.status === 404) {
      // 获取daily-chats目录下的所有文件
      response = await retryFetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/daily-chats/`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`获取GitHub文件列表失败：${response.status} ${response.statusText}`);
      }
      
      const files = await response.json();
      if (!files || files.length === 0) {
        return null;
      }
      
      // 按文件名排序，获取最新的文件
      files.sort(function(a, b) {
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
      const latestFile = files[0];
      
      // 获取最新文件内容
      response = await retryFetch(
        latestFile.download_url,
        {
          headers: {
            'Authorization': `token ${githubToken}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`获取GitHub文件内容失败：${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      chats = JSON.parse(content);
    } else if (response.ok) {
      // 今日文件存在，获取内容
      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      chats = JSON.parse(content);
    } else {
      // 其他错误情况
      throw new Error(`获取GitHub文件失败：${response.status} ${response.statusText}`);
    }
    
    if (Array.isArray(chats) && chats.length > 0) {
      // 获取最后一条对话
      const lastChat = chats[chats.length - 1];
      
      // 获取该课程该章节的所有对话，只保留最近5轮
      const courseChats = chats.filter(function(chat) {
        return chat.course === lastChat.course && chat.chapter === lastChat.chapter;
      });
      
      // 只保留最近5轮对话（10条消息，每轮包含用户和AI回复）
      const recentChats = courseChats.slice(-10).map(function(chat) {
        return {
          role: chat.role === 'user' ? 'user' : 'ai',
          content: chat.content
        };
      });
      
      return {
        hasLastRecord: true,
        courseName: lastChat.course,
        chapterName: lastChat.chapter,
        lastChatTime: lastChat.time,
        lastChatContext: recentChats
      };
    }
    
    return null;
  } catch (error) {
    console.error('从GitHub获取最近对话记录失败:', error);
    return null;
  }
}

// 主函数
exports.handler = async (event, context) => {
  try {
    // 处理CORS预检请求
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ success: true })
      };
    }
    
    // 从环境变量获取配置
    const {
      NOTION_API_KEY,
      GITHUB_TOKEN,
      GITHUB_REPO_INFO
    } = process.env;
    
    if (!NOTION_API_KEY || !GITHUB_TOKEN || !GITHUB_REPO_INFO) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ error: '环境变量配置不完整' })
      };
    }
    
    // 1. 首先从Notion获取最近学习记录
    let lastRecord = await getLastRecordFromNotion(NOTION_API_KEY);
    
    // 2. 如果Notion没有记录，从GitHub获取
    if (!lastRecord) {
      lastRecord = await getLastChatFromGitHub(GITHUB_TOKEN, GITHUB_REPO_INFO);
    }
    
    // 3. 如果仍然没有记录，返回无记录状态
    if (!lastRecord) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          hasLastRecord: false,
          courseName: '',
          chapterName: '',
          lastChatTime: '',
          lastChatContext: []
        })
      };
    }
    
    // 4. 如果Notion记录没有历史上下文，从GitHub获取
    if (lastRecord.lastChatContext.length === 0) {
      const githubRecord = await getLastChatFromGitHub(GITHUB_TOKEN, GITHUB_REPO_INFO);
      if (githubRecord && githubRecord.courseName === lastRecord.courseName && githubRecord.chapterName === lastRecord.chapterName) {
        lastRecord.lastChatContext = githubRecord.lastChatContext;
      }
    }
    
    // 5. 返回最近学习记录
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(lastRecord)
    };
  } catch (error) {
    console.error('获取最近学习记录失败:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        hasLastRecord: false,
        courseName: '',
        chapterName: '',
        lastChatTime: '',
        lastChatContext: []
      })
    };
  }
};