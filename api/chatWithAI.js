// Serverless函数：调用AI接口，增量写入GitHub
// 功能：接收前端传的课程名、章节名、用户输入 → 调用AI接口 → 增量写入GitHub当日JSON文件
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
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 重试函数
async function retryFetch(url, options, retries = MAX_RETRIES) {
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

// 获取GitHub文件SHA
const getGitHubFileSHA = async (owner, repo, filePath, githubToken) => {
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
    
    if (response.status === 404) {
      // 文件不存在
      return null;
    }
    
    const data = await response.json();
    return data.sha;
  } catch (error) {
    console.error('获取GitHub文件SHA失败:', error);
    throw error;
  }
};

// 写入GitHub文件
const writeToGitHub = async (owner, repo, filePath, content, githubToken, sha = null) => {
  try {
    // Base64编码内容
    const encodedContent = Buffer.from(content, 'utf8').toString('base64');
    
    const body = {
      message: `Update daily chat for ${new Date().toISOString().split('T')[0]}`,
      content: encodedContent
    };
    
    if (sha) {
      body.sha = sha;
    }
    
    const response = await retryFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('写入GitHub文件失败:', error);
    throw error;
  }
};

// 调用AI接口
const callAI = async (prompt, aiApiUrl, aiApiKey) => {
  try {
    // 在生产环境中，从环境变量获取系统提示词
    // 在开发环境中，可直接使用默认提示词
    const systemPrompt = process.env.AI_SYSTEM_PROMPT || '你是一个专业的学习助手，帮助用户学习课程内容。';
    
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
          max_tokens: 1000,
          temperature: 0.7
        })
      }
    );
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('调用AI接口失败:', error);
    throw error;
  }
};

// 主函数
exports.handler = async (event, context) => {
  try {
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
    
    const { courseName, chapterName, userInput, lastChatContext = [] } = requestBody;
    
    // 验证必填参数
    if (!courseName || !chapterName || !userInput) {
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
      AI_API_KEY 
    } = process.env;
    
    // 验证环境变量
    if (!GITHUB_TOKEN || !GITHUB_REPO_INFO || !AI_API_URL || !AI_API_KEY) {
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
    // 转换为UTC+8时区
    const utc8Date = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const dateStr = utc8Date.toISOString().split('T')[0];
    const filePath = `daily-chats/${dateStr}.json`;
    
    // 1. 构建提示词，支持断点续学
    let prompt = `课程名称：${courseName}\n章节名称：${chapterName}\n用户输入：${userInput}\n`;
    
    // 如果有历史上下文，添加到提示词中
    if (lastChatContext && lastChatContext.length > 0) {
      prompt += `历史学习内容：${JSON.stringify(lastChatContext)}\n请基于此继续解答用户问题，保持专业和清晰。`;
    } else {
      prompt += `请根据课程内容回答用户的问题，保持专业和清晰。`;
    }
    
    const aiResponse = await callAI(prompt, AI_API_URL, AI_API_KEY);
    
    // 2. 构造对话记录
    const chatRecord = {
      time: new Date().toISOString(),
      role: 'user',
      content: userInput,
      course: courseName,
      chapter: chapterName
    };
    
    const aiChatRecord = {
      time: new Date().toISOString(),
      role: 'ai',
      content: aiResponse,
      course: courseName,
      chapter: chapterName
    };
    
    // 3. 获取GitHub文件SHA
    const sha = await getGitHubFileSHA(owner, repo, filePath, GITHUB_TOKEN);
    
    let existingContent = [];
    if (sha) {
      // 文件存在，获取现有内容
      const response = await retryFetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      const data = await response.json();
      const decodedContent = Buffer.from(data.content, 'base64').toString('utf8');
      
      try {
        existingContent = JSON.parse(decodedContent);
        if (!Array.isArray(existingContent)) {
          existingContent = [];
        }
      } catch (error) {
        existingContent = [];
        console.error('解析GitHub文件失败，重新创建:', error);
      }
    }
    
    // 4. 增量更新内容
    const updatedContent = [...existingContent, chatRecord, aiChatRecord];
    
    // 5. 写入GitHub
    const contentStr = JSON.stringify(updatedContent, null, 2);
    await writeToGitHub(owner, repo, filePath, contentStr, GITHUB_TOKEN, sha);
    
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
        aiResponse,
        message: '对话已成功保存到GitHub'
      })
    };
    
  } catch (error) {
    console.error('处理对话失败:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: false,
        message: `处理对话失败: ${error.message}`
      })
    };
  }
};