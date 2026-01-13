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
        // 构建Notion API请求
        const notionResponse = await fetch('https://api.notion.com/v1/pages', {
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
              'Name': {
                title: [
                  {
                    text: {
                      content: course.title
                    }
                  }
                ]
              },
              'Description': {
                rich_text: [
                  {
                    text: {
                      content: course.description
                    }
                  }
                ]
              },
              'Status': {
                select: {
                  name: '待学习'
                }
              },
              'Target Audience': {
                rich_text: [
                  {
                    text: {
                      content: course.targetAudience || ''
                    }
                  }
                ]
              },
              'Duration': {
                rich_text: [
                  {
                    text: {
                      content: course.duration || ''
                    }
                  }
                ]
              }
            }
          })
        });
        
        const notionResult = await notionResponse.json();
        
        if (notionResponse.ok) {
          successCount++;
          results.push({ success: true, course: course.title, notionId: notionResult.id });
        } else {
          results.push({ success: false, course: course.title, error: notionResult.error });
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
