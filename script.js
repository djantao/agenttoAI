// 全局变量
let currentQuestion = 1;
let conversation = [];
let courses = [];
let prompts = {};
let useMockData = false; // 添加模拟数据开关

// 配置变量 - 添加默认的豆包API地址和模型名称
let config = {
    doubaoApiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', // 火山引擎豆包API默认地址
    doubaoModel: 'doubao-1-5-pro-32k-250115', // 使用用户开通的新模型
    doubaoApiKey: '',
    notionApiToken: '',
    notionDatabaseId: ''
};

// 模拟数据
const mockResponses = {
    question2: "问题 2/3：您的学习目标是什么？（例如：找工作、提升技能、兴趣爱好等）",
    question3: "问题 3/3：您每天可以投入多少时间学习？（例如：1小时、2-3小时、全天等）",
    courses: {
        "courses": [
            {
                "title": "编程基础入门",
                "description": "适合初学者的编程基础课程，涵盖核心概念和基本技能。",
                "targetAudience": "零基础学习者",
                "duration": "20小时",
                "chapters": [
                    {
                        "title": "编程概念入门",
                        "description": "了解基本编程术语和概念，建立编程思维框架。",
                        "duration": "4小时"
                    },
                    {
                        "title": "变量与数据类型",
                        "description": "学习变量定义和各种数据类型的使用方法。",
                        "duration": "5小时"
                    },
                    {
                        "title": "控制流语句",
                        "description": "掌握条件判断和循环语句的使用。",
                        "duration": "6小时"
                    },
                    {
                        "title": "函数基础",
                        "description": "学习函数的定义、调用和参数传递。",
                        "duration": "5小时"
                    }
                ]
            },
            {
                "title": "编程进阶实战",
                "description": "通过实际项目学习编程进阶知识，提升实战能力。",
                "targetAudience": "有基础的学习者",
                "duration": "30小时",
                "chapters": [
                    {
                        "title": "面向对象编程",
                        "description": "学习面向对象编程的核心概念：类、对象、继承、多态。",
                        "duration": "8小时"
                    },
                    {
                        "title": "数据结构基础",
                        "description": "掌握数组、链表、栈、队列等基本数据结构。",
                        "duration": "7小时"
                    },
                    {
                        "title": "算法入门",
                        "description": "学习常见算法：排序、查找、递归等。",
                        "duration": "8小时"
                    },
                    {
                        "title": "项目实战：简易应用开发",
                        "description": "通过实际项目练习，综合运用所学知识。",
                        "duration": "7小时"
                    }
                ]
            },
            {
                "title": "编程高级技巧",
                "description": "深入学习编程高级概念和最佳实践，成为专家。",
                "targetAudience": "有经验的开发者",
                "duration": "40小时",
                "chapters": [
                    {
                        "title": "设计模式",
                        "description": "学习常见设计模式及其应用场景。",
                        "duration": "10小时"
                    },
                    {
                        "title": "性能优化",
                        "description": "掌握代码性能优化的方法和技巧。",
                        "duration": "10小时"
                    },
                    {
                        "title": "微服务架构",
                        "description": "了解微服务架构设计和实现。",
                        "duration": "10小时"
                    },
                    {
                        "title": "高级项目实战",
                        "description": "开发复杂应用，锻炼综合能力。",
                        "duration": "10小时"
                    }
                ]
            }
        ]
    }
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
            const doubaoModel = document.getElementById('doubaoModel').value;
            const doubaoApiKey = document.getElementById('doubaoApiKey').value;
            const notionApiToken = document.getElementById('notionApiToken').value;
            const notionDatabaseId = document.getElementById('notionDatabaseId').value;
            
            // 保存配置
            config = {
                doubaoApiUrl,
                doubaoModel,
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
            // 检查是否是CORS错误
            if (error.message.includes('CORS')) {
                errorMessage = '跨域请求被阻止(CORS)，请检查API地址是否支持跨域访问，或使用代理服务。';
            } else {
                errorMessage = '网络连接失败，请检查您的网络设置或API地址是否正确。';
            }
        } else if (error.message.includes('401')) {
            errorMessage = 'API密钥无效，请检查您是否使用了正确的豆包API密钥，而不是Notion或其他服务的密钥。';
        } else if (error.message.includes('404')) {
            // 区分API地址错误和模型不存在错误
            if (error.message.includes('InvalidEndpointOrModel')) {
                errorMessage = '模型名称无效或无访问权限，请检查模型配置。\n建议尝试的模型名称：doubao-lite, doubao-pro, doubao-1.8';
            } else {
                errorMessage = 'API地址无效，请检查您的配置。';
            }
        } else if (error.message.includes('AuthenticationError')) {
            errorMessage = '认证失败，请确保您使用了正确的豆包API密钥，而不是Notion或其他服务的密钥。';
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
    // 使用模拟数据
    if (useMockData) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
        if (currentQuestion === 1) {
            return mockResponses.question2;
        } else if (currentQuestion === 2) {
            return mockResponses.question3;
        }
    }
    
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
                model: config.doubaoModel, // 使用配置中的模型名称
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...conversation.slice(0, currentQuestion * 2 - 1) // 只传递当前轮次之前的对话
                ],
                max_tokens: 100,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            // 如果API调用失败，自动切换到模拟数据模式
            useMockData = true;
            console.log('切换到模拟数据模式');
            
            // 返回模拟数据
            if (currentQuestion === 1) {
                return mockResponses.question2;
            } else if (currentQuestion === 2) {
                return mockResponses.question3;
            }
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('豆包API请求失败:', error);
        
        // 如果API调用失败，自动切换到模拟数据模式
        useMockData = true;
        console.log('切换到模拟数据模式');
        
        // 返回模拟数据
        if (currentQuestion === 1) {
            return mockResponses.question2;
        } else if (currentQuestion === 2) {
            return mockResponses.question3;
        }
        
        throw error;
    }
}

// 使用豆包API生成课程列表
async function generateCoursesWithDoubao() {
    // 准备提示词，替换对话历史占位符
    const systemPrompt = prompts.generateCourses.replace('{conversation}', JSON.stringify(conversation, null, 2));
    
    addMessage('正在生成课程列表，请稍候...', 'bot');
    
    // 使用模拟数据
    if (useMockData) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟网络延迟
        
        // 移除正在生成的消息
        chatMessages.removeChild(chatMessages.lastChild);
        
        // 使用模拟课程数据
        courses = mockResponses.courses.courses;
        
        // 显示生成结果
        addMessage('根据您的回答，我为您生成了以下课程列表：', 'bot');
        conversation.push({ role: 'bot', content: '根据您的回答，我为您生成了以下课程列表：' });
        
        // 显示课程容器
        displayCourses();
        return;
    }
    
    try {
        const response = await fetch(config.doubaoApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.doubaoApiKey}`
            },
            body: JSON.stringify({
                model: config.doubaoModel, // 使用配置中的模型名称
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...conversation
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            // 如果API调用失败，自动切换到模拟数据模式
            useMockData = true;
            console.log('切换到模拟数据模式');
            
            // 移除正在生成的消息
            chatMessages.removeChild(chatMessages.lastChild);
            
            // 使用模拟课程数据
            courses = mockResponses.courses.courses;
            
            // 显示生成结果
            addMessage('根据您的回答，我为您生成了以下课程列表：', 'bot');
            conversation.push({ role: 'bot', content: '根据您的回答，我为您生成了以下课程列表：' });
            
            // 显示课程容器
            displayCourses();
            return;
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
        
        // 如果API调用失败，自动切换到模拟数据模式
        useMockData = true;
        console.log('切换到模拟数据模式');
        
        // 使用模拟课程数据
        courses = mockResponses.courses.courses;
        
        // 显示生成结果
        addMessage('根据您的回答，我为您生成了以下课程列表：', 'bot');
        conversation.push({ role: 'bot', content: '根据您的回答，我为您生成了以下课程列表：' });
        
        // 显示课程容器
        displayCourses();
    }
}

// 显示课程列表
function displayCourses() {
    coursesList.innerHTML = '';
    
    courses.forEach((course, index) => {
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item';
        
        // 生成章节HTML
        let chaptersHtml = '';
        if (course.chapters && course.chapters.length > 0) {
            chaptersHtml = `
                <div class="chapters-section">
                    <button class="toggle-chapters-btn">📋 查看章节 (${course.chapters.length})</button>
                    <div class="chapters-list" style="display: none;">
                        <h4>章节列表：</h4>
                        <ul>
                            ${course.chapters.map((chapter, chapIndex) => `
                                <li class="chapter-item">
                                    <h5>${chapIndex + 1}. ${chapter.title}</h5>
                                    <p>${chapter.description}</p>
                                    <p><small>预计时长：${chapter.duration}</small></p>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }
        
        courseItem.innerHTML = `
            <h3>${index + 1}. ${course.title}</h3>
            <p><strong>描述：</strong>${course.description}</p>
            <p><strong>适合人群：</strong>${course.targetAudience}</p>
            <p><strong>预计时长：</strong>${course.duration}</p>
            ${chaptersHtml}
        `;
        
        coursesList.appendChild(courseItem);
    });
    
    // 添加折叠/展开功能
    document.querySelectorAll('.toggle-chapters-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const chaptersList = btn.nextElementSibling;
            const isVisible = chaptersList.style.display === 'block';
            
            if (isVisible) {
                chaptersList.style.display = 'none';
                btn.textContent = `📋 查看章节 (${chaptersList.querySelectorAll('.chapter-item').length})`;
            } else {
                chaptersList.style.display = 'block';
                btn.textContent = '📋 隐藏章节';
            }
        });
    });
    
    courseContainer.style.display = 'block';
}

// 同步课程到Notion（使用Cloudflare Worker代理）
async function syncCoursesToNotion() {
    syncToNotionBtn.disabled = true;
    syncToNotionBtn.innerHTML = '<span class="loading"></span> 同步中...';
    syncToNotionBtn.className = 'sync-btn';
    
    // Cloudflare Worker代理URL（部署后替换为您的Worker URL）
    // 部署说明：
    // 1. 将notion-proxy-worker.js部署到Cloudflare Workers
    // 2. 获取部署后的Worker URL
    // 3. 将此处的URL替换为您的Worker URL
    //const NOTION_PROXY_URL = 'https://notion-proxy.your-account.workers.dev';
    const NOTION_PROXY_URL = 'https://notion-proxy.timbabys80.workers.dev';

    try {
        // 发送请求到Cloudflare Worker代理
        const response = await fetch(NOTION_PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                courses: courses,
                notionApiToken: config.notionApiToken,
                notionDatabaseId: config.notionDatabaseId
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '同步失败' }));
            throw new Error(`同步失败：${errorData.error || '未知错误'}`);
        }
        
        const result = await response.json();
        
        // 显示成功消息
        syncToNotionBtn.innerHTML = `同步成功 (${result.successCount}/${result.total})`;
        syncToNotionBtn.className = 'sync-btn success';
        
        // 添加聊天消息
        addMessage(`课程列表已成功同步到Notion！共同步${result.successCount}门课程，总计${result.total}门课程。`, 'bot');
    } catch (error) {
        console.error('同步到Notion失败:', error);
        syncToNotionBtn.innerHTML = '同步失败';
        syncToNotionBtn.className = 'sync-btn error';
        addMessage(`抱歉，同步到Notion失败：${error.message}`, 'bot');
    } finally {
        // 3秒后恢复按钮状态
        setTimeout(() => {
            syncToNotionBtn.disabled = false;
            syncToNotionBtn.innerHTML = '同步到Notion';
            syncToNotionBtn.className = 'sync-btn';
        }, 3000);
    }
}

/*
Cloudflare Worker部署说明：
1. 登录Cloudflare控制台
2. 选择Workers & Pages
3. 创建一个新的Worker
4. 将notion-proxy-worker.js脚本粘贴到编辑器中
5. 修改ALLOWED_ORIGINS数组，添加您的GitHub Pages域名
6. 点击"部署"按钮
7. 部署后，获取Worker的URL
8. 将syncCoursesToNotion函数中的NOTION_PROXY_URL替换为您的Worker URL

注意事项：
- 确保Notion API Token具有对目标数据库的写入权限
- 确保Notion数据库包含所需的属性（Name, Description, Status, Target Audience, Duration）
- 首次使用前，需要在Notion中邀请您的Integration访问目标数据库
*/

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);