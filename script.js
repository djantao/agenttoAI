// AI学习助手主脚本
// 实现三轮对话分析和课程生成功能

// 配置信息，将从localStorage读取
let config = {
    doubaoApiUrl: '',
    doubaoModel: '',
    doubaoApiKey: '',
    notionApiToken: '',
    notionDatabaseId: ''
};

// 对话状态
let conversationState = {
    currentQuestion: 0,
    answers: [],
    courses: [],
    isProcessing: false
};

// 问题列表
const questions = [
    "您想学习什么领域的知识？",
    "您的学习目标是什么？",
    "您每天可以投入多少时间学习？"
];

// DOM元素
const elements = {
    configModal: document.getElementById('configModal'),
    configForm: document.getElementById('configForm'),
    chatHistory: document.getElementById('chatHistory'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    resetBtn: document.getElementById('resetBtn'),
    courseList: document.getElementById('courseList'),
    courses: document.getElementById('courses'),
    syncToNotion: document.getElementById('syncToNotion'),
    regenerateBtn: document.getElementById('regenerateBtn')
};

// 初始化应用
function initApp() {
    // 检查是否有配置
    const savedConfig = localStorage.getItem('aiLearningAssistantConfig');
    if (savedConfig) {
        config = JSON.parse(savedConfig);
        startConversation();
    } else {
        // 显示配置弹窗
        elements.configModal.style.display = 'flex';
    }
    
    // 绑定事件
    elements.configForm.addEventListener('submit', handleConfigSubmit);
    elements.sendBtn.addEventListener('click', handleSendMessage);
    elements.userInput.addEventListener('keydown', handleKeyDown);
    elements.resetBtn.addEventListener('click', resetConversation);
    elements.syncToNotion.addEventListener('click', syncCoursesToNotion);
    elements.regenerateBtn.addEventListener('click', regenerateCourses);
}

// 处理配置提交
async function handleConfigSubmit(e) {
    e.preventDefault();
    
    // 获取表单数据
    config = {
        doubaoApiUrl: document.getElementById('doubaoApiUrl').value,
        doubaoModel: document.getElementById('doubaoModel').value,
        doubaoApiKey: document.getElementById('doubaoApiKey').value,
        notionApiToken: document.getElementById('notionApiToken').value,
        notionDatabaseId: document.getElementById('notionDatabaseId').value
    };
    
    // 保存到localStorage
    localStorage.setItem('aiLearningAssistantConfig', JSON.stringify(config));
    
    // 隐藏配置弹窗
    elements.configModal.style.display = 'none';
    
    // 开始对话
    startConversation();
}

// 开始对话
function startConversation() {
    conversationState.currentQuestion = 0;
    conversationState.answers = [];
    conversationState.courses = [];
    
    // 清空聊天历史
    elements.chatHistory.innerHTML = '';
    elements.courseList.classList.add('hidden');
    
    // 显示第一个问题
    addMessage('ai', questions[0]);
    enableInput();
}

// 添加消息到聊天历史
function addMessage(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = text;
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    timestampDiv.textContent = new Date().toLocaleTimeString();
    
    bubbleDiv.appendChild(textDiv);
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(timestampDiv);
    
    elements.chatHistory.appendChild(messageDiv);
    elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
}

// 启用输入
function enableInput() {
    elements.userInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.userInput.focus();
}

// 禁用输入
function disableInput() {
    elements.userInput.disabled = true;
    elements.sendBtn.disabled = true;
}

// 处理发送消息
async function handleSendMessage() {
    const userInput = elements.userInput.value.trim();
    if (!userInput || conversationState.isProcessing) return;
    
    // 禁用输入
    disableInput();
    conversationState.isProcessing = true;
    
    // 添加用户消息
    addMessage('user', userInput);
    elements.userInput.value = '';
    
    // 保存答案
    conversationState.answers.push(userInput);
    
    // 检查是否完成所有问题
    if (conversationState.currentQuestion < questions.length - 1) {
        // 显示下一个问题
        conversationState.currentQuestion++;
        setTimeout(() => {
            addMessage('ai', questions[conversationState.currentQuestion]);
            enableInput();
            conversationState.isProcessing = false;
        }, 500);
    } else {
        // 所有问题已回答，生成课程列表
        await generateCourseList();
    }
}

// 处理键盘事件
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
}

// 调用豆包API生成课程列表
async function generateCourseList() {
    // 显示正在生成提示
    addMessage('ai', '正在根据您的需求生成课程列表，请稍候...');
    
    try {
        // 构建提示词
        const prompt = `基于以下用户需求，生成一个个性化的课程列表：\n\n1. 学习领域：${conversationState.answers[0]}\n2. 学习目标：${conversationState.answers[1]}\n3. 可用时间：${conversationState.answers[2]}\n\n请生成包含5-8个课程的列表，每个课程应包含：\n- 课程名称\n- 课程描述\n- 预计学习时长\n- 学习难度\n\n请使用JSON格式输出，例如：\n{"courses": [{"name": "课程1", "description": "描述1", "duration": "2小时", "difficulty": "入门"}, ...]}`;
        
        // 调用豆包API
        const response = await fetch(config.doubaoApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.doubaoApiKey}`
            },
            body: JSON.stringify({
                model: config.doubaoModel,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 1500,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败：${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // 解析生成的课程列表
        const courses = parseCourseList(aiResponse);
        conversationState.courses = courses;
        
        // 显示课程列表
        displayCourses(courses);
        
        // 更新聊天记录
        addMessage('ai', '已为您生成个性化课程列表！您可以查看下方的课程，或选择同步到Notion。');
    } catch (error) {
        console.error('生成课程列表失败:', error);
        addMessage('ai', `生成课程列表失败：${error.message}`);
    } finally {
        conversationState.isProcessing = false;
    }
}

// 解析课程列表
function parseCourseList(responseText) {
    try {
        // 提取JSON部分
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const coursesData = JSON.parse(jsonMatch[0]);
            return coursesData.courses || [];
        }
        return [];
    } catch (error) {
        console.error('解析课程列表失败:', error);
        return [];
    }
}

// 显示课程列表
function displayCourses(courses) {
    elements.courses.innerHTML = '';
    
    courses.forEach((course, index) => {
        const courseDiv = document.createElement('div');
        courseDiv.className = 'course';
        
        courseDiv.innerHTML = `
            <h3>${course.name || `课程${index + 1}`}</h3>
            <p><strong>描述：</strong>${course.description || '无描述'}</p>
            <p><strong>预计时长：</strong>${course.duration || '未指定'}</p>
            <p><strong>难度：</strong>${course.difficulty || '未指定'}</p>
        `;
        
        elements.courses.appendChild(courseDiv);
    });
    
    elements.courseList.classList.remove('hidden');
}

// 同步课程到Notion
async function syncCoursesToNotion() {
    if (conversationState.courses.length === 0) return;
    
    elements.syncToNotion.disabled = true;
    elements.syncToNotion.textContent = '同步中...';
    
    try {
        // 构建Notion页面数据
        for (const course of conversationState.courses) {
            await createNotionPage(course);
        }
        
        addMessage('ai', '课程列表已成功同步到Notion！');
    } catch (error) {
        console.error('同步到Notion失败:', error);
        addMessage('ai', `同步到Notion失败：${error.message}`);
    } finally {
        elements.syncToNotion.disabled = false;
        elements.syncToNotion.textContent = '同步到Notion';
    }
}

// 创建Notion页面
async function createNotionPage(course) {
    const response = await fetch('https://api.notion.com/v1/pages', {
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
                    title: [{
                        text: {
                            content: course.name
                        }
                    }]
                },
                'Description': {
                    rich_text: [{
                        text: {
                            content: course.description
                        }
                    }]
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
        throw new Error(`Notion API错误：${errorData.message || response.statusText}`);
    }
}

// 重新生成课程
async function regenerateCourses() {
    conversationState.courses = [];
    elements.courseList.classList.add('hidden');
    await generateCourseList();
}

// 重置对话
function resetConversation() {
    if (conversationState.isProcessing) return;
    
    elements.courseList.classList.add('hidden');
    startConversation();
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initApp);