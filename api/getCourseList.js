// Serverless函数：从Notion拉取课程列表
// 功能：调用Notion API拉取课程数据库的「课程名称」「章节列表」
// 注意：该文件需部署在Vercel/Netlify的api目录下

// 使用平台提供的全局fetch
// Serverless环境中通常已全局可用，无需额外导入
const fetch = global.fetch;

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
      // Notion API限流，重试
      if (retries > 0) {
        await wait(RETRY_DELAY);
        return retryFetch(url, options, retries - 1);
      } else {
        throw new Error('Notion API限流，已达到最大重试次数');
      }
    }
    
    if (!response.ok) {
      throw new Error(`Notion API请求失败：${response.status} ${response.statusText}`);
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
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || '2e43af348d5780fd9b8ed286eba4c996';
    
    if (!NOTION_API_KEY) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ error: 'NOTION_API_KEY 环境变量未配置' })
      };
    }
    
    // 调用Notion API获取课程列表
    const response = await retryFetch(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            property: '状态',
            select: {
              equals: '待学习'
            }
          },
          sorts: [
            {
              property: '创建时间',
              direction: 'ascending'
            }
          ]
        })
      }
    );
    
    const data = await response.json();
    
    // 处理返回数据
    const courses = data.results.map(page => {
      // 获取课程名称
      const courseName = page.properties['课程名称']?.title[0]?.text?.content || '未知课程';
      
      // 解析章节列表
      const chaptersText = page.properties['章节列表']?.rich_text[0]?.text?.content || '';
      const chapters = [];
      
      if (chaptersText) {
        // 按换行符分割章节
        const chapterLines = chaptersText.split(/[\n\r]+/).filter(line => line.trim());
        
        chapterLines.forEach((line, index) => {
          // 解析章节格式：1. 章节名称：核心目标
          const match = line.match(/^(\d+)\.\s*(.+?)\s*：\s*(.+)$/);
          if (match) {
            chapters.push({
              chapterName: match[2],
              coreGoal: match[3]
            });
          } else {
            // 处理其他格式
            chapters.push({
              chapterName: line.trim(),
              coreGoal: '无核心目标'
            });
          }
        });
      }
      
      return {
        courseName,
        chapters
      };
    });
    
    // 返回结果
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        courses,
        message: courses.length === 0 ? '暂无课程数据' : '课程列表获取成功'
      })
    };
    
  } catch (error) {
    console.error('获取课程列表失败:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: false,
        courses: [],
        message: `获取课程列表失败: ${error.message}`
      })
    };
  }
};