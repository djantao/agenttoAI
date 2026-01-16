// AI学习助手主脚本
// 实现三轮对话分析和课程生成功能

// 配置信息，将从localStorage读取
let config = {
    doubaoApiUrl: '',
    doubaoModel: '',
    doubaoApiKey: '',
    notionApiToken: '',
    notionDatabaseId: '2e43af348d578057bbe7d85ea7ef73fa', // 课程数据库ID（写死）
    notionProxyUrl: 'https://notion-proxy.timbabys80.workers.dev/', // Cloudflare Workers代理URL（默认值）
    githubToken: '' // GitHub API Token（用于保存对话记录）
};

// 对话状态
let conversationState = {
    currentQuestion: 0,
    answers: [],
    courses: [],
    isProcessing: false
};

// 问题列表，将从prompt文件加载
let questions = [];

// DOM元素
const elements = {
    // 配置相关
    configModal: document.getElementById('configModal'),
    configForm: document.getElementById('configForm'),
    configBtn: document.getElementById('configBtn'),
    
    // 页签相关
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    courseGenTab: document.getElementById('courseGenTab'),
    learningTab: document.getElementById('learningTab'),
    
    // 对话界面
    chatHistory: document.getElementById('chatHistory'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    resetBtn: document.getElementById('resetBtn'),
    
    // 课程列表
    courseList: document.getElementById('courseList'),
    courses: document.getElementById('courses'),
    syncToNotion: document.getElementById('syncToNotion'),
    regenerateBtn: document.getElementById('regenerateBtn'),
    
    // 学习界面
    courseSelect: document.getElementById('courseSelect'),
    chapterSelect: document.getElementById('chapterSelect'),
    continueLearningBtn: document.getElementById('continueLearningBtn'),
    stopLearningBtn: document.getElementById('stopLearningBtn'),
    learningChatHistory: document.getElementById('learningChatHistory'),
    learningUserInput: document.getElementById('learningUserInput'),
    learningSendBtn: document.getElementById('learningSendBtn')
};

// 学习状态管理
let learningState = {
    currentCourse: null,
    currentChapter: null,
    isLearning: false,
    startTime: null,
    endTime: null,
    chatHistory: [],
    systemPrompt: '', // 从提示词文件加载的系统提示词
    notionLearningDatabaseId: '2e43af348d5780fd9b8ed286eba4c996' // 学习记录表数据库ID（写死）
};

// 加载所有提示词文件
async function loadAllPrompts() {
    // 加载三轮对话的提示词
    const prompt1 = await loadPromptFile('prompt1');
    const prompt2 = await loadPromptFile('prompt2');
    const prompt3 = await loadPromptFile('prompt3');
    
    // 更新questions数组
    questions = [prompt1, prompt2, prompt3];
    
    console.log('提示词文件加载成功');
    return true;
}

// 初始化应用
async function initApp() {
    // 加载提示词文件
    await loadAllPrompts();
    
    // 检查是否有配置
    const savedConfig = localStorage.getItem('aiLearningAssistantConfig');
    if (savedConfig) {
        const loadedConfig = JSON.parse(savedConfig);
        // 加载配置，但保持写死的数据库ID不变
        config = {
            ...loadedConfig,
            notionDatabaseId: '2e43af348d578057bbe7d85ea7ef73fa' // 课程数据库ID（写死，覆盖localStorage中的值）
        };
        startConversation();
        loadCourses();
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
    elements.configBtn.addEventListener('click', handleConfigBtnClick);
    
    // 页签事件
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', handleTabClick);
    });
    
    // 学习界面事件
    elements.courseSelect.addEventListener('change', handleCourseChange);
    elements.chapterSelect.addEventListener('change', handleChapterChange);
    elements.continueLearningBtn.addEventListener('click', handleContinueLearning);
    elements.stopLearningBtn.addEventListener('click', handleStopLearning);
    elements.learningSendBtn.addEventListener('click', handleLearningSendMessage);
    elements.learningUserInput.addEventListener('keydown', handleLearningKeyDown);
    
    // 初始化表单值
    populateConfigForm();
}

// 处理配置按钮点击
function handleConfigBtnClick() {
    // 填充表单当前配置值
    populateConfigForm();
    // 显示配置弹窗
    elements.configModal.style.display = 'flex';
}

// 填充配置表单
function populateConfigForm() {
    // 填充当前配置到表单
    document.getElementById('doubaoApiUrl').value = config.doubaoApiUrl || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
    document.getElementById('doubaoModel').value = config.doubaoModel || 'doubao-1-5-pro-32k-250115';
    document.getElementById('doubaoApiKey').value = config.doubaoApiKey || '';
    document.getElementById('notionApiToken').value = config.notionApiToken || '';
    document.getElementById('notionDatabaseId').value = '2e43af348d578057bbe7d85ea7ef73fa'; // 写死值
    document.getElementById('notionProxyUrl').value = config.notionProxyUrl || 'https://notion-proxy.timbabys80.workers.dev/';
    document.getElementById('githubToken').value = config.githubToken || '';
}

// 处理页签点击
function handleTabClick(e) {
    // 获取目标页签
    const targetTab = e.target.dataset.tab;
    
    // 移除所有页签的active类
    elements.tabBtns.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 移除所有页签内容的active类
    elements.tabPanes.forEach(pane => {
        pane.classList.remove('active');
    });
    
    // 为当前页签和内容添加active类
    e.target.classList.add('active');
    document.getElementById(targetTab).classList.add('active');
}

// 加载课程列表
async function loadCourses() {
    try {
        // 从Notion获取课程列表
        const courses = await getCoursesFromNotion();
        
        // 更新课程选择下拉框
        const courseSelect = elements.courseSelect;
        courseSelect.innerHTML = '<option value="">请选择课程</option>';
        
        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = course.name;
            courseSelect.appendChild(option);
        });
    } catch (error) {
        console.error('加载课程列表失败:', error);
    }
}

// 从Notion获取课程列表
async function getCoursesFromNotion() {
    try {
        // 检查是否配置了代理URL
        if (config.notionProxyUrl) {
            // 使用代理URL查询课程列表
            console.log('使用代理URL查询课程列表');
            
            const response = await fetch(config.notionProxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'query', // 新增action字段，标识为查询操作
                    notionApiToken: config.notionApiToken,
                    notionDatabaseId: config.notionDatabaseId,
                    queryParams: {
                        page_size: 100
                    }
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`代理查询失败：${data.error || response.status}`);
            }
            
            // 检查返回数据格式
            if (data.courses && Array.isArray(data.courses)) {
                // 如果代理返回的是直接的课程列表
                console.log('成功从代理获取课程列表，共', data.courses.length, '门课程');
                return data.courses;
            } else if (data.results && Array.isArray(data.results)) {
                // 如果代理返回的是Notion API原始格式
                console.log('解析Notion API原始格式数据结果数量:', data.results.length);
                const courses = data.results.map((page, index) => {
                    console.log(`课程${index + 1}的properties:`, page.properties);
                    console.log(`课程${index + 1}的"课程名称"字段:`, page.properties['课程名称']);
                    const courseName = page.properties['课程名称']?.title[0]?.text?.content;
                    console.log(`课程${index + 1}的名称:`, courseName);
                    return {
                        id: page.id,
                        name: courseName || '未命名课程'
                    };
                });
                console.log('成功从代理获取课程列表，共', courses.length, '门课程', courses);
                return courses;
            } else {
                // 数据格式不符合预期，返回模拟数据
                console.error('代理返回的数据格式不符合预期');
                return [
                    { id: 'course-1', name: '测试课程1' },
                    { id: 'course-2', name: '测试课程2' },
                    { id: 'course-3', name: '测试课程3' }
                ];
            }
        }
        
        // 尝试直接调用Notion API获取课程列表
        console.log('尝试直接调用Notion API获取课程列表');
        
        const response = await fetch('https://api.notion.com/v1/databases/' + config.notionDatabaseId + '/query', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.notionApiToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                page_size: 100
            })
        });
        
        if (!response.ok) {
            // 如果直接调用失败，返回模拟数据
            console.error('直接调用Notion API失败，状态码:', response.status);
            console.log('获取课程列表失败，返回模拟数据');
            return [
                { id: 'course-1', name: '测试课程1' },
                { id: 'course-2', name: '测试课程2' },
                { id: 'course-3', name: '测试课程3' }
            ];
        }
        
        const data = await response.json();
        
        // 解析课程列表
        console.log('直接调用API：解析Notion API原始格式数据，结果数量:', data.results.length);
        const courses = data.results.map((page, index) => {
            console.log(`直接调用API：课程${index + 1}的properties:`, page.properties);
            console.log(`直接调用API：课程${index + 1}的"课程名称"字段:`, page.properties['课程名称']);
            const courseName = page.properties['课程名称']?.title[0]?.text?.content;
            console.log(`直接调用API：课程${index + 1}的名称:`, courseName);
            return {
                id: page.id,
                name: courseName || '未命名课程'
            };
        });
        console.log('直接调用API：成功从Notion获取课程列表，共', courses.length, '门课程', courses);
        return courses;
    } catch (error) {
        console.error('从Notion获取课程列表失败:', error);
        
        // 如果是网络错误、CORS错误或其他任何错误，返回模拟数据
        console.log('获取课程列表失败，返回模拟数据');
        return [
            { id: 'course-1', name: '测试课程1' },
            { id: 'course-2', name: '测试课程2' },
            { id: 'course-3', name: '测试课程3' }
        ];
    }
}

// 处理课程选择变化
async function handleCourseChange() {
    const courseId = elements.courseSelect.value;
    elements.chapterSelect.innerHTML = '<option value="">请选择章节</option>';
    elements.chapterSelect.disabled = !courseId;
    
    if (courseId) {
        // 根据课程获取章节
        const chapters = await getChaptersFromNotion(courseId);
        
        // 更新章节选择下拉框
        chapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter.id;
            option.textContent = chapter.name;
            elements.chapterSelect.appendChild(option);
        });
    }
}

// 从Notion获取章节列表
async function getChaptersFromNotion(courseId) {
    try {
        let coursePage;
        
        // 检查是否配置了代理URL
        if (config.notionProxyUrl && config.notionApiToken) {
            // 使用代理URL获取课程页面详情
            console.log('使用代理URL获取课程页面详情');
            
            const response = await fetch(config.notionProxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_page',
                    notionApiToken: config.notionApiToken,
                    pageId: courseId
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`代理获取页面详情失败：${data.error || response.status}`);
            }
            
            coursePage = data;
        } else if (config.notionApiToken) {
            // 直接调用Notion API获取课程页面详情
            console.log('直接调用Notion API获取课程页面详情');
            const coursePageResponse = await fetch(`https://api.notion.com/v1/pages/${courseId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.notionApiToken}`,
                    'Notion-Version': '2022-06-28'
                }
            });
            
            if (!coursePageResponse.ok) {
                throw new Error(`获取课程详情失败：${coursePageResponse.status}`);
            }
            
            coursePage = await coursePageResponse.json();
        } else {
            console.warn('未配置Notion API Token，无法获取真实章节信息');
            return [
                { id: 'chapter-1', name: '第1章：入门介绍' },
                { id: 'chapter-2', name: '第2章：核心概念' },
                { id: 'chapter-3', name: '第3章：实战应用' }
            ];
        }
        
        // 从课程页面中提取章节信息
        // 这里需要根据实际的Notion数据库结构调整
        // 假设章节信息存储在名为"章节列表"的rich_text属性中，格式为换行分隔的章节名称
        let chapters = [];
        
        // 尝试从rich_text属性中提取章节
        const chaptersProperty = coursePage.properties['章节列表'];
        if (chaptersProperty && chaptersProperty.rich_text && chaptersProperty.rich_text.length > 0) {
            const chaptersText = chaptersProperty.rich_text[0].text.content;
            if (chaptersText && chaptersText.trim() !== '') {
                try {
                    // 尝试解析JSON格式的章节列表
                    const chaptersJson = JSON.parse(chaptersText);
                    if (Array.isArray(chaptersJson)) {
                        chapters = chaptersJson.map((chapter, index) => {
                            // 提取章节名称
                            const chapterName = chapter.title || chapter.name || `章节 ${chapter.chapter || index + 1}`;
                            return {
                                id: `chapter-${courseId}-${index + 1}`,
                                name: chapterName
                            };
                        });
                    }
                } catch (jsonError) {
                    // JSON解析失败，尝试按换行分割章节
                    console.error('解析章节JSON失败，尝试按换行分割:', jsonError);
                    const chapterLines = chaptersText.split('\n').filter(line => line.trim() !== '');
                    chapters = chapterLines.map((line, index) => {
                        // 提取章节名称（假设格式为 "1. 章节名称" 或直接 "章节名称"）
                        const chapterName = line.replace(/^\d+\.\s*/, '').trim();
                        return {
                            id: `chapter-${courseId}-${index + 1}`,
                            name: chapterName
                        };
                    });
                }
            }
        }
        
        // 如果从rich_text中没有提取到章节，尝试从relation属性中获取
        if (chapters.length === 0) {
            const relationProperty = coursePage.properties['章节'];
            if (relationProperty && relationProperty.relation && relationProperty.relation.length > 0) {
                // 如果是relation属性，需要获取每个章节页面的详细信息
                const chapterIds = relationProperty.relation.map(rel => rel.id);
                
                // 批量获取章节页面信息
                // 注意：Notion API不支持批量获取页面，这里返回带ID的章节
                chapters = chapterIds.map((chapterId, index) => {
                    return {
                        id: chapterId,
                        name: `章节 ${index + 1}`
                    };
                });
            }
        }
        
        // 如果还是没有获取到章节，返回默认的模拟数据
        if (chapters.length === 0) {
            chapters = [
                { id: 'chapter-1', name: '第1章：入门介绍' },
                { id: 'chapter-2', name: '第2章：核心概念' },
                { id: 'chapter-3', name: '第3章：实战应用' }
            ];
        }
        
        console.log('成功获取章节列表:', chapters);
        return chapters;
    } catch (error) {
        console.error('从Notion获取章节列表失败:', error);
        // 失败时返回模拟数据
        return [
            { id: 'chapter-1', name: '第1章：入门介绍' },
            { id: 'chapter-2', name: '第2章：核心概念' },
            { id: 'chapter-3', name: '第3章：实战应用' }
        ];
    }
}

// 处理章节选择变化
function handleChapterChange() {
    const chapterId = elements.chapterSelect.value;
    const chapterName = elements.chapterSelect.options[elements.chapterSelect.selectedIndex].text;
    
    if (chapterId && chapterName) {
        // 将选中的章节存储在learningState中，确保与课程强关联
        learningState.currentChapter = {
            id: chapterId,
            name: chapterName
        };
        
        console.log('选择了章节:', chapterName, '，ID:', chapterId);
        console.log('当前学习状态:', learningState);
        
        // 可以在这里加载章节相关的学习资料或初始化学习状态
    }
}

// 加载提示词文件
async function loadPromptFile(promptName) {
    const response = await fetch(`prompts/${promptName}.txt`);
    if (!response.ok) {
        throw new Error(`无法加载提示词文件 ${promptName}.txt：${response.status}`);
    }
    return await response.text();
}

// 处理继续学习按钮点击
async function handleContinueLearning() {
    const courseId = elements.courseSelect.value;
    const chapterId = elements.chapterSelect.value;
    
    if (!courseId || !chapterId) {
        alert('请先选择课程和章节');
        return;
    }
    
    // 获取课程和章节名称
    const courseName = elements.courseSelect.options[elements.courseSelect.selectedIndex].text;
    const chapterName = elements.chapterSelect.options[elements.chapterSelect.selectedIndex].text;
    
    // 更新学习状态
    learningState.currentCourse = {
        id: courseId,
        name: courseName
    };
    learningState.currentChapter = {
        id: chapterId,
        name: chapterName
    };
    learningState.isLearning = true;
    learningState.startTime = new Date();
    learningState.chatHistory = [];
    
    // 加载提示词文件
    const promptText = await loadPromptFile('socratic_learning');
    // 替换提示词中的变量
    learningState.systemPrompt = promptText
        .replace('{course_name}', courseName)
        .replace('{chapter_name}', chapterName)
        .replace('{learned_knowledge}', '暂无'); // 目前暂未实现已学知识点跟踪，先设为默认值
    
    // 加载最新的学习记录
    await loadLatestLearningRecord();
    
    // 启用学习控件
    elements.stopLearningBtn.disabled = false;
    elements.learningUserInput.disabled = false;
    elements.learningSendBtn.disabled = false;
    
    // 显示欢迎消息
    addLearningMessage('ai', `欢迎学习 ${courseName} - ${chapterName}！我将使用苏格拉底学习法帮助您深入理解课程内容。`);
}

// 加载最新学习记录
async function loadLatestLearningRecord() {
    try {
        // 从GitHub获取最新的学习记录
        // 这里需要根据实际的GitHub API来实现
        console.log('加载最新学习记录');
        // 暂时不实现，后续添加
    } catch (error) {
        console.error('加载最新学习记录失败:', error);
    }
}

// 处理停止学习按钮点击
async function handleStopLearning() {
    if (!learningState.isLearning) return;
    
    // 更新学习状态
    learningState.isLearning = false;
    learningState.endTime = new Date();
    
    // 计算学习时长
    const durationMs = learningState.endTime - learningState.startTime;
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    
    // 生成学习摘要和挑战
    const summary = generateLearningSummary(learningState.chatHistory);
    const challenges = generateLearningChallenges(learningState.chatHistory);
    
    // 发送到Notion学习记录表
    await saveLearningRecordToNotion({
        courseName: learningState.currentCourse.name,
        chapterName: learningState.currentChapter.name,
        startTime: learningState.startTime.toISOString(),
        endTime: learningState.endTime.toISOString(),
        duration: `${durationMinutes}分钟`,
        mastery: '中等', // 可以根据对话内容自动评估
        status: '已完成',
        summary: summary,
        challenges: challenges
    });
    
    // 保存对话记录到GitHub
    await saveChatHistoryToGitHub();
    
    // 禁用学习控件
    elements.stopLearningBtn.disabled = true;
    elements.learningUserInput.disabled = true;
    elements.learningSendBtn.disabled = true;
    
    // 显示学习完成消息
    addLearningMessage('ai', `学习已完成！学习时长：${durationMinutes}分钟`);
}

// 生成学习摘要
function generateLearningSummary(chatHistory) {
    // 简单实现：提取对话中的关键信息
    // 后续可以通过AI生成更智能的摘要
    return '本次学习涵盖了章节的主要内容，进行了相关问题的讨论和解答。';
}

// 生成学习挑战
function generateLearningChallenges(chatHistory) {
    // 简单实现：提取对话中的疑问和挑战
    // 后续可以通过AI生成更智能的挑战
    return '需要进一步巩固的知识点包括：核心概念理解、实际应用技巧等。';
}

// 保存学习记录到Notion
async function saveLearningRecordToNotion(record) {
    try {
        // 构建Notion页面数据
        const notionPageData = {
            parent: {
                database_id: learningState.notionLearningDatabaseId
            },
            properties: {
                '课程名称': {
                    title: [{
                        text: {
                            content: record.courseName
                        }
                    }]
                },
                '章节名称': {
                    rich_text: [{
                        text: {
                            content: record.chapterName
                        }
                    }]
                },
                '学习开始时间': {
                    date: {
                        start: record.startTime
                    }
                },
                '学习结束时间': {
                    date: {
                        start: record.endTime
                    }
                },
                '学习时长': {
                    rich_text: [{
                        text: {
                            content: record.duration
                        }
                    }]
                },
                '掌握程度': {
                    select: {
                        name: record.mastery
                    }
                },
                '状态': {
                    select: {
                        name: record.status
                    }
                },
                '学习摘要': {
                    rich_text: [{
                        text: {
                            content: record.summary
                        }
                    }]
                },
                '学习挑战': {
                    rich_text: [{
                        text: {
                            content: record.challenges
                        }
                    }]
                }
            }
        };
        
        // 检查是否配置了代理URL
        if (config.notionProxyUrl) {
            // 使用代理URL保存学习记录
            console.log('使用代理URL保存学习记录');
            
            const response = await fetch(config.notionProxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'save_learning_record', // 新增action字段，标识为保存学习记录操作
                    notionApiToken: config.notionApiToken,
                    notionDatabaseId: learningState.notionLearningDatabaseId,
                    record: notionPageData
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                console.error('代理请求失败，但不中断流程:', data.error || response.status);
                // 不抛出错误，避免打断用户体验
                return;
            }
            
            console.log('学习记录已通过代理保存到Notion');
        } else {
            // 直接调用Notion API
            console.log('直接调用Notion API保存学习记录');
            try {
                const response = await fetch('https://api.notion.com/v1/pages', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.notionApiToken}`,
                        'Content-Type': 'application/json',
                        'Notion-Version': '2022-06-28'
                    },
                    body: JSON.stringify(notionPageData)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Notion API错误，但不中断流程:', errorData.message || response.statusText);
                    // 不抛出错误，避免打断用户体验
                    return;
                }
                
                console.log('学习记录已直接保存到Notion');
            } catch (apiError) {
                console.error('直接调用Notion API失败，可能是CORS问题:', apiError);
                // 不抛出错误，避免打断用户体验
            }
        }
        
        console.log('学习记录已保存到Notion');
    } catch (error) {
        console.error('保存学习记录到Notion失败:', error);
        // 不显示alert，避免打断用户体验
        console.log('保存学习记录到Notion失败:', error.message);
    }
}

// 保存对话记录到GitHub
async function saveChatHistoryToGitHub() {
    try {
        // 获取当前日期
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        
        // 构建对话记录数据（JSON格式）
        const chatData = {
            metadata: {
                course: learningState.currentCourse,
                chapter: learningState.currentChapter,
                date: dateStr,
                timestamp: date.toISOString(),
                totalMessages: learningState.chatHistory.length
            },
            messages: learningState.chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp || date.toISOString()
            }))
        };
        
        // 将对话记录转换为格式化的JSON字符串
        const chatJson = JSON.stringify(chatData, null, 2);
        
        console.log(`准备保存${dateStr}的对话记录，共${chatData.messages.length}条消息`);
        console.log('对话记录JSON:', chatJson);
        
        // GitHub API配置 - 这些应该从配置中获取
        // 注意：在实际应用中，这些配置应该从安全的地方获取，而不是硬编码
        const githubToken = localStorage.getItem('githubToken') || config.githubToken || '';
        const repoOwner = 'djantao'; // 替换为你的GitHub用户名
        const repoName = 'agentAI'; // 替换为你的GitHub仓库名
        const filePath = `daily/${dateStr}.json`; // 保存到daily目录下
        const branch = 'main'; // 保存到main分支
        
        console.log(`准备将对话记录保存到GitHub: ${repoOwner}/${repoName}/${filePath}`);
        
        // 检查GitHub Token是否存在
        if (!githubToken) {
            console.warn('GitHub Token不存在，无法保存对话记录到GitHub');
            // 保存到本地存储作为备选方案
            localStorage.setItem(`chatHistory_${dateStr}`, chatJson);
            console.log('对话记录已保存到本地存储');
            return;
        }
        
        // 检查GitHub Token权限范围
        console.log('GitHub Token已配置，将尝试保存对话记录');
        console.log('注意：GitHub API会自动创建不存在的目录，无需手动创建daily目录');
        
        try {
            // 1. 首先检查文件是否存在，获取sha值（用于更新）
            const checkResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`, {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            let sha = '';
            if (checkResponse.ok) {
                const existingFile = await checkResponse.json();
                sha = existingFile.sha;
                console.log(`文件已存在，将更新现有文件，SHA: ${sha}`);
            } else if (checkResponse.status === 404) {
                console.log('文件不存在，将创建新文件');
            } else {
                throw new Error(`检查文件存在性失败：${checkResponse.status}`);
            }
            
            // 2. 保存/更新文件
            const saveResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    message: `Add/Update chat history for ${dateStr}`,
                    content: btoa(unescape(encodeURIComponent(chatJson))), // 正确的Base64编码处理
                    branch: branch,
                    sha: sha // 如果是更新，需要提供现有文件的sha值
                })
            });
            
            if (!saveResponse.ok) {
                const errorData = await saveResponse.json();
                throw new Error(`GitHub API错误：${errorData.message || saveResponse.statusText}`);
            }
            
            const saveResult = await saveResponse.json();
            console.log('对话记录已成功保存到GitHub', saveResult.content.html_url);
            
        } catch (githubError) {
            console.error('GitHub API调用失败:', githubError);
            // 保存到本地存储作为备选方案
            localStorage.setItem(`chatHistory_${dateStr}`, chatJson);
            console.log('对话记录已保存到本地存储作为备选方案');
        }
        
    } catch (error) {
        console.error('保存对话记录到GitHub失败:', error);
        // 保存到本地存储作为备选方案
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        localStorage.setItem(`chatHistory_${dateStr}`, JSON.stringify(learningState.chatHistory));
        console.log('对话记录已保存到本地存储作为备选方案');
    }
}

// 处理学习聊天消息发送
async function handleLearningSendMessage() {
    const userInput = elements.learningUserInput.value.trim();
    if (!userInput || !learningState.isLearning) return;
    
    // 禁用发送按钮，防止重复发送
    elements.learningSendBtn.disabled = true;
    
    // 添加用户消息
    addLearningMessage('user', userInput);
    elements.learningUserInput.value = '';
    
    // 保存到聊天历史
    learningState.chatHistory.push({
        role: 'user',
        content: userInput,
        timestamp: new Date().toISOString()
    });
    
    try {
        // 调用豆包API获取回复
        const response = await fetch(config.doubaoApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.doubaoApiKey}`
            },
            body: JSON.stringify({
                model: config.doubaoModel,
                messages: [
                    {
                        role: 'system',
                        content: learningState.systemPrompt
                    },
                    ...learningState.chatHistory
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败：${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // 添加AI回复
        addLearningMessage('ai', aiResponse);
        
        // 保存到聊天历史
        learningState.chatHistory.push({
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取AI回复失败:', error);
        addLearningMessage('ai', `抱歉，获取回复失败：${error.message}`);
    } finally {
        // 重新启用发送按钮
        elements.learningSendBtn.disabled = false;
    }
}

// 处理学习聊天键盘事件
function handleLearningKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleLearningSendMessage();
    }
}

// 添加学习消息到聊天历史
function addLearningMessage(sender, text) {
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
    
    elements.learningChatHistory.appendChild(messageDiv);
    elements.learningChatHistory.scrollTop = elements.learningChatHistory.scrollHeight;
}

// 处理配置提交
async function handleConfigSubmit(e) {
    e.preventDefault();
    
    // 获取表单数据，保持写死的数据库ID不变
    config = {
        doubaoApiUrl: document.getElementById('doubaoApiUrl').value,
        doubaoModel: document.getElementById('doubaoModel').value,
        doubaoApiKey: document.getElementById('doubaoApiKey').value,
        notionApiToken: document.getElementById('notionApiToken').value,
        notionDatabaseId: '2e43af348d578057bbe7d85ea7ef73fa', // 课程数据库ID（写死，不允许修改）
        notionProxyUrl: document.getElementById('notionProxyUrl').value,
        githubToken: document.getElementById('githubToken').value // 保存GitHub Token
    };
    
    // 保存到localStorage
    localStorage.setItem('aiLearningAssistantConfig', JSON.stringify(config));
    
    // 隐藏配置弹窗
    elements.configModal.style.display = 'none';
    
    // 确保提示词已经加载，如果没有加载则重新加载
    if (questions.length === 0) {
        await loadAllPrompts();
    }
    
    // 开始对话
    startConversation();
    loadCourses();
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
        const prompt = `基于以下用户需求，生成一个个性化的课程列表：\n\n1. 学习领域：${conversationState.answers[0]}\n2. 学习目标：${conversationState.answers[1]}\n3. 可用时间：${conversationState.answers[2]}\n\n请生成包含5-8个课程的列表，每个课程应包含：\n- 课程名称\n- 课程描述\n- 预计学习时长\n- 学习难度\n- 章节列表：每个课程应包含3-5个章节，每个章节包含章节名称和章节描述\n\n请使用JSON格式输出，例如：\n{"courses": [{"name": "课程1", "description": "描述1", "duration": "2小时", "difficulty": "入门", "chapters": [{"name": "章节1", "description": "章节描述1"}, ...]}, ...]}`;
        
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
        
        // 生成章节列表HTML
        let chaptersHtml = '';
        if (course.chapters && course.chapters.length > 0) {
            chaptersHtml = '<div class="chapters"><h4>章节列表：</h4><ul>';
            course.chapters.forEach((chapter, chapIndex) => {
                chaptersHtml += `<li><strong>${chapter.name || `章节${chapIndex + 1}`}</strong>：${chapter.description || '无描述'}</li>`;
            });
            chaptersHtml += '</ul></div>';
        }
        
        courseDiv.innerHTML = `
            <h3>${course.name || `课程${index + 1}`}</h3>
            <p><strong>描述：</strong>${course.description || '无描述'}</p>
            <p><strong>预计时长：</strong>${course.duration || '未指定'}</p>
            <p><strong>难度：</strong>${course.difficulty || '未指定'}</p>
            ${chaptersHtml}
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
        // 检查是否配置了代理URL
        if (config.notionProxyUrl) {
            // 使用代理URL同步课程
            console.log('同步到Notion的课程数据:', conversationState.courses);
            const response = await fetch(config.notionProxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    courses: conversationState.courses.map(course => ({
                        title: course.name,
                        description: course.description || '',
                        targetAudience: course.targetAudience || '',
                        duration: course.duration || '',
                        difficulty: course.difficulty || '',
                        chapters: course.chapters ? course.chapters.map(chapter => ({
                            title: chapter.name, // 将name字段转换为代理期望的title字段
                            description: chapter.description || ''
                        })) : []
                    })),
                    notionApiToken: config.notionApiToken,
                    notionDatabaseId: config.notionDatabaseId
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`代理请求失败：${data.error || response.status}`);
            }
            
            addMessage('ai', `课程列表已成功同步到Notion！共同步了 ${data.successCount} 门课程。`);
        } else {
            // 直接调用Notion API
            // 构建Notion页面数据
            for (const course of conversationState.courses) {
                await createNotionPage(course);
            }
            
            addMessage('ai', '课程列表已成功同步到Notion！');
        }
    } catch (error) {
        console.error('同步到Notion失败:', error);
        addMessage('ai', `同步到Notion失败：${error.message}`);
    } finally {
        elements.syncToNotion.disabled = false;
        elements.syncToNotion.textContent = '同步到Notion';
    }
}

// 创建Notion页面（直接调用API，非代理方式）
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
                '课程名称': {
                    title: [{
                        text: {
                            content: course.name
                        }
                    }]
                },
                '简介': {
                    rich_text: [{
                        text: {
                            content: course.description || ''
                        }
                    }]
                },
                '状态': {
                    select: {
                        name: '待学习'
                    }
                },
                '难度': {
                    select: {
                        name: course.difficulty || '入门'
                    }
                },
                '章节列表': {
                    rich_text: [{
                        text: {
                            content: course.chapters ? course.chapters.map(chap => `${chap.name}: ${chap.description}`).join('\n') : ''
                        }
                    }]
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