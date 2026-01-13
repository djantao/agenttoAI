// 全局变量
let currentQuestion = 1;
let conversation = [];
let courses = [];
let prompts = {};

// 配置变量 - 添加默认的豆包API地址
let config = {
    doubaoApiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', // 火山引擎豆包API默认地址
    doubaoApiKey: '',
    notionApiToken: '',
    notionDatabaseId: ''
};

// API基础URL
const NOTION_API_URL = 'https://api.notion.com/v1/pages';

// DOM元素
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const courseContainer = document.getElementById('courseContainer');
const coursesList = document.getElementById('coursesList');
const syncToNotionBtn = document.getElementById('syncToNotion');

// 初始化事件监听器
async function init() {
    // 配置弹窗元素
    const configModal = document.getElementById('configModal');
    const configForm = document.getElementById('configForm');
    
    // 检查localStorage中是否有配置
    const savedConfig = localStorage.getItem('aiLearningAssistantConfig');
    
    if (savedConfig) {
        // 加载保存的配置
        config = JSON.parse(savedConfig);
        // 初始化应用
        await initializeApp();
    } else {
        // 显示配置弹窗
        configModal.style.display = 'flex';
    }
    
    // 配置表单提交事件
        configForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 获取表单数据
            const doubaoApiUrl = document.getElementById('doubaoApiUrl').value;
            const doubaoApiKey = document.getElementById('doubaoApiKey').value;
            const notionApiToken = document.getElementById('notionApiToken').value;
            const notionDatabaseId = document.getElementById('notionDatabaseId').value;
            
            // 保存配置
            config = {
                doubaoApiUrl,
                doubaoApiKey,
                notionApiToken,
                notionDatabaseId
            };
            
            // 保存到localStorage
            localStorage.setItem('aiLearningAssistantConfig', JSON.stringify(config));
            
            // 隐藏配置弹窗
            configModal.style.display = 'none';
            
            // 初始化应用
            await initializeApp();
        });
}

// 初始化应用
async function initializeApp() {
    // 添加事件监听器
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    syncToNotionBtn.addEventListener('click', syncCoursesToNotion);
    
    // 加载所有提示词
    await loadPrompts();
    
    // 显示初始问题
    displayInitialQuestion();
}

// 加载提示词
async function loadPrompts() {
    const promptFiles = [
        { name: 'prompt1', path: 'prompts/prompt1.txt' },
        { name: 'prompt2', path: 'prompts/prompt2.txt' },
        { name: 'prompt3', path: 'prompts/prompt3.txt' },
        { name: 'generateCourses', path: 'prompts/generate_courses.txt' }
    ];
    
    for (const file of promptFiles) {
        try {
            const response = await fetch(file.path);
            const content = await response.text();
            prompts[file.name] = content;
        } catch (error) {
            console.error(`加载提示词${file.name}失败:`, error);
        }
    }
}

// 显示初始问题
function displayInitialQuestion() {
    // 从prompt1.txt中提取示例问题
    const initialQuestion = prompts.prompt1.split('提问示例：')[1] || '您好！我是您的AI学习助手。为了给您推荐合适的课程，请回答我几个问题。\n问题 1/3：您想学习什么领域的知识？（例如：编程、设计、数据分析等）';
    addMessage(initialQuestion, 'bot');
    conversation.push({ role: 'bot', content: initialQuestion });
}

// 发送消息
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // 添加用户消息
    addMessage(message, 'user');
    conversation.push({ role: 'user', content: message });
    userInput.value = '';
    
    // 禁用输入和发送按钮
    sendBtn.disabled = true;
    userInput.disabled = true;
    
    try {
        if (currentQuestion < 3) {
            // 调用豆包API获取下一个问题
            const nextQuestion = await getNextQuestion();
            addMessage(nextQuestion, 'bot');
            conversation.push({ role: 'bot', content: nextQuestion });
            currentQuestion++;
        } else {
            // 调用豆包API生成课程列表
            await generateCoursesWithDoubao();
        }
    } catch (error) {
        console.error('API调用失败:', error);
        let errorMessage = '抱歉，处理失败，请稍后重试。';
        
        // 根据错误类型提供更具体的提示
        if (error.message.includes('Failed to fetch')) {
            errorMessage = '网络连接失败，请检查您的网络设置或API地址是否正确。';
        } else if (error.message.includes('401')) {
            errorMessage = 'API密钥无效，请检查您的配置。';
        } else if (error.message.includes('404')) {
            // 区分API地址错误和模型不存在错误
            if (error.message.includes('InvalidEndpointOrModel')) {
                errorMessage = '模型名称无效或无访问权限，请检查模型配置。\n建议尝试的模型名称：doubao-12b, doubao-72b, doubao-lite';
            } else {
                errorMessage = 'API地址无效，请检查您的配置。';
            }
        }
        
        addMessage(errorMessage, 'bot');
    } finally {
        // 启用输入和发送按钮
        sendBtn.disabled = false;
        userInput.disabled = false;
    }
}

// 添加消息到聊天界面
function addMessage(content, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.innerHTML = `<p>${content}</p>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 调用豆包API获取下一个问题
async function getNextQuestion() {
    const promptKey = `prompt${currentQuestion + 1}`;
    const systemPrompt = prompts[promptKey] || '';
    
    try {
        const response = await fetch(config.doubaoApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.doubaoApiKey}`
            },
            body: JSON.stringify({
                model: 'doubao-12b', // 更换为常见的豆包模型名称
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...conversation.slice(0, currentQuestion * 2 - 1) // 只传递当前轮次之前的对话
                ],
                max_tokens: 100,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('豆包API请求失败:', error);
        throw error;
    }
}

// 使用豆包API生成课程列表
async function generateCoursesWithDoubao() {
    // 准备提示词，替换对话历史占位符
    const systemPrompt = prompts.generateCourses.replace('{conversation}', JSON.stringify(conversation, null, 2));
    
    addMessage('正在生成课程列表，请稍候...', 'bot');
    
    try {
        const response = await fetch(config.doubaoApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.doubaoApiKey}`
            },
            body: JSON.stringify({
                model: 'doubao-12b', // 更换为常见的豆包模型名称
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...conversation
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const botResponse = data.choices[0].message.content;
        
        // 移除正在生成的消息
        chatMessages.removeChild(chatMessages.lastChild);
        
        // 解析生成的课程列表
        try {
            // 提取JSON部分
            const jsonMatch = botResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const coursesData = JSON.parse(jsonMatch[0]);
                courses = coursesData.courses;
                
                // 显示生成结果
                addMessage('根据您的回答，我为您生成了以下课程列表：', 'bot');
                conversation.push({ role: 'bot', content: '根据您的回答，我为您生成了以下课程列表：' });
                
                // 显示课程容器
                displayCourses();
            } else {
                throw new Error('无法提取JSON数据');
            }
        } catch (parseError) {
            console.error('解析课程数据失败:', parseError);
            addMessage('抱歉，生成课程列表失败，请稍后重试。', 'bot');
        }
    } catch (error) {
        // 移除正在生成的消息
        chatMessages.removeChild(chatMessages.lastChild);
        console.error('豆包API请求失败:', error);
        addMessage(`抱歉，调用AI服务失败：${error.message}`, 'bot');
    }
}

// 显示课程列表
function displayCourses() {
    coursesList.innerHTML = '';
    
    courses.forEach((course, index) => {
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item';
        courseItem.innerHTML = `
            <h3>${index + 1}. ${course.title}</h3>
            <p><strong>描述：</strong>${course.description}</p>
            <p><strong>适合人群：</strong>${course.targetAudience}</p>
            <p><strong>预计时长：</strong>${course.duration}</p>
        `;
        coursesList.appendChild(courseItem);
    });
    
    courseContainer.style.display = 'block';
}

// 同步课程到Notion
async function syncCoursesToNotion() {
    syncToNotionBtn.disabled = true;
    syncToNotionBtn.innerHTML = '<span class="loading"></span> 同步中...';
    syncToNotionBtn.className = 'sync-btn';
    
    try {
        // 遍历课程列表，逐个同步到Notion
        for (const course of courses) {
            await createNotionPage(course);
        }
        
        // 显示成功消息
        syncToNotionBtn.innerHTML = '同步成功';
        syncToNotionBtn.className = 'sync-btn success';
        
        // 添加聊天消息
        addMessage('课程列表已成功同步到Notion！', 'bot');
    } catch (error) {
        console.error('同步到Notion失败:', error);
        syncToNotionBtn.innerHTML = '同步失败';
        syncToNotionBtn.className = 'sync-btn error';
        addMessage('抱歉，同步到Notion失败，请稍后重试。', 'bot');
    } finally {
        // 3秒后恢复按钮状态
        setTimeout(() => {
            syncToNotionBtn.disabled = false;
            syncToNotionBtn.innerHTML = '同步到Notion';
            syncToNotionBtn.className = 'sync-btn';
        }, 3000);
    }
}

// 创建Notion页面
async function createNotionPage(course) {
    const response = await fetch(NOTION_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.notionApiToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
            parent: {
                database_id: config.notionDatabaseId
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
                }
            }
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Notion API错误: ${JSON.stringify(errorData)}`);
    }
    
    return await response.json();
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);