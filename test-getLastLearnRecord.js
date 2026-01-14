// 测试脚本：单独测试getLastLearnRecord.js Serverless函数
// 功能：模拟Serverless环境，使用mock数据测试handler函数

// 模拟全局fetch和Buffer，避免实际API调用
const mockFetch = (url, options) => {
  console.log('Mock fetch called:', {
    url,
    method: options.method,
    headers: options.headers,
    body: options.body ? JSON.parse(options.body) : undefined
  });
  
  // 根据URL返回不同的mock数据
  if (url.includes('notion.com')) {
    // 模拟Notion API响应
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        results: [
          {
            properties: {
              '课程名称': {
                title: [{
                  text: { content: '测试课程' }
                }]
              },
              '章节名称': {
                rich_text: [{
                  text: { content: '测试章节' }
                }]
              },
              '学习结束时间': {
                date: { start: '2026-01-14T10:00:00Z' }
              },
              '状态': {
                select: { name: '已完成' }
              }
            }
          }
        ]
      })
    });
  } else if (url.includes('api.github.com') && url.endsWith('contents/daily-chats/')) {
    // 模拟GitHub获取文件列表响应（只匹配目录）
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        {
          name: '2026-01-14.json',
          download_url: 'https://raw.githubusercontent.com/owner/repo/main/daily-chats/2026-01-14.json',
          updated_at: '2026-01-14T10:00:00Z'
        }
      ])
    });
  } else if (url.includes('api.github.com') && url.includes('contents/daily-chats/2026-01-14.json')) {
    // 模拟GitHub获取单个文件响应（返回404，表示今日文件不存在）
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Not Found' })
    });
  } else if (url.includes('raw.githubusercontent.com')) {
    // 模拟GitHub获取文件内容响应
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([
        {
          course: '测试课程',
          chapter: '测试章节',
          role: 'user',
          content: '测试用户输入',
          time: '2026-01-14T10:00:00Z'
        },
        {
          course: '测试课程',
          chapter: '测试章节',
          role: 'assistant',
          content: '测试AI回复',
          time: '2026-01-14T10:01:00Z'
        }
      ])),
      json: () => Promise.resolve([
        {
          course: '测试课程',
          chapter: '测试章节',
          role: 'user',
          content: '测试用户输入',
          time: '2026-01-14T10:00:00Z'
        },
        {
          course: '测试课程',
          chapter: '测试章节',
          role: 'assistant',
          content: '测试AI回复',
          time: '2026-01-14T10:01:00Z'
        }
      ])
    });
  }
  
  // 默认返回404
  return Promise.resolve({
    ok: false,
    status: 404,
    statusText: 'Not Found'
  });
};

// 将mockFetch和Buffer添加到全局对象
global.fetch = mockFetch;
global.Buffer = {
  from: (str, encoding) => {
    return {
      toString: () => str
    };
  }
};

// 加载要测试的模块
const { handler } = require('./api/getLastLearnRecord');

// 模拟环境变量
process.env.NOTION_API_KEY = 'test-notion-api-key';
process.env.GITHUB_TOKEN = 'test-github-token';
process.env.GITHUB_REPO_INFO = 'owner/repo';
process.env.NOTION_DATABASE_ID = '2e43af348d5780fd9b8ed286eba4c996';

// 模拟event对象（GET请求）
const event = {
  httpMethod: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

// 模拟context对象
const context = {
  awsRequestId: 'test-request-id',
  functionName: 'test-function'
};

// 调用handler函数进行测试
async function testHandler() {
  console.log('开始测试getLastLearnRecord.js...\n');
  
  try {
    const result = await handler(event, context);
    console.log('\n测试结果:');
    console.log('状态码:', result.statusCode);
    console.log('响应头:', result.headers);
    console.log('响应体:', JSON.parse(result.body));
    console.log('\n✅ 测试成功！');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
testHandler();
