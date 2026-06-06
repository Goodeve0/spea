// ============================================================
// shared/contracts.ts — 前后端共享的唯一类型契约
// 引用：specs/02-SDD.md 第 3、4 节
// 规则：前后端一律从此文件 import，不得重复定义
// ============================================================
// -------------------- 错误码 --------------------
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["UNKNOWN"] = "UNKNOWN";
    ErrorCode["ASR_FAILED"] = "ASR_FAILED";
    ErrorCode["LLM_FAILED"] = "LLM_FAILED";
    ErrorCode["TTS_FAILED"] = "TTS_FAILED";
    ErrorCode["PRONUNCIATION_FAILED"] = "PRONUNCIATION_FAILED";
    ErrorCode["SESSION_NOT_FOUND"] = "SESSION_NOT_FOUND";
    ErrorCode["INVALID_MESSAGE"] = "INVALID_MESSAGE";
})(ErrorCode || (ErrorCode = {}));
// -------------------- 预设场景数据 --------------------
export const SCENARIO_CATEGORIES = [
    { id: 'career', label: '职场', emoji: '💼' },
    { id: 'life', label: '生活', emoji: '🍽️' },
    { id: 'travel', label: '出行', emoji: '✈️' },
    { id: 'social', label: '社交', emoji: '💬' },
    { id: 'exam', label: '考试', emoji: '🎓' },
];
export const PRESET_SCENARIOS = [
    {
        id: 'interview',
        title: 'Job Interview',
        description: 'Practice for English job interviews. The AI will act as a hiring manager.',
        difficulty: 'intermediate',
        category: 'career',
        rolePrompt: 'You are a professional hiring manager conducting a job interview. Be polite but thorough. Ask follow-up questions. Keep the conversation focused on the candidate\'s experience and qualifications. Use moderate-paced, professional English.',
        goal: 'Successfully answer interview questions and demonstrate your qualifications.',
    },
    {
        id: 'meeting',
        title: 'Team Meeting',
        description: 'Practice participating in an English team meeting. The AI will act as your colleague.',
        difficulty: 'advanced',
        category: 'career',
        rolePrompt: 'You are a senior colleague leading a team meeting. Discuss project updates, ask for opinions, and encourage participation. Use professional but conversational English. Introduce business vocabulary naturally.',
        goal: 'Actively participate in the meeting and contribute your ideas.',
    },
    {
        id: 'presentation',
        title: 'Presentation Q&A',
        description: 'Field questions from the audience after presenting your project in English.',
        difficulty: 'advanced',
        category: 'career',
        rolePrompt: 'You are an audience member at a professional presentation. The student has just finished a short presentation; ask 1-2 thoughtful follow-up questions per turn. Be polite and curious. Keep questions specific and conversational.',
        goal: 'Confidently answer follow-up questions and clarify your points.',
    },
    {
        id: 'restaurant',
        title: 'Restaurant Ordering',
        description: 'Practice ordering food at an English-speaking restaurant. The AI will act as a server.',
        difficulty: 'beginner',
        category: 'life',
        rolePrompt: 'You are a friendly server at a casual restaurant. Greet the customer warmly, present the menu, help with recommendations, and take their order. Use simple, everyday English with a warm tone.',
        goal: 'Order a complete meal and handle any questions from the server.',
    },
    {
        id: 'doctor',
        title: 'Doctor Visit',
        description: 'Describe your symptoms to an English-speaking doctor and follow advice.',
        difficulty: 'intermediate',
        category: 'life',
        rolePrompt: 'You are a friendly general-practice doctor. Greet the patient, ask about their symptoms, ask clarifying medical questions, and explain your diagnosis or advice in clear, simple English.',
        goal: 'Explain your symptoms clearly and understand the doctor\'s advice.',
    },
    {
        id: 'shopping',
        title: 'Shopping',
        description: 'Buy clothes or daily items at an English-speaking store.',
        difficulty: 'beginner',
        category: 'life',
        rolePrompt: 'You are a helpful shop assistant in a clothing or convenience store. Greet the customer, help them find items, answer questions about size/price, and complete the checkout in simple, friendly English.',
        goal: 'Find what you need, ask questions about it, and complete a purchase.',
    },
    {
        id: 'hotel',
        title: 'Hotel Check-in',
        description: 'Check in, ask about facilities, or report an issue at an English-speaking hotel.',
        difficulty: 'beginner',
        category: 'travel',
        rolePrompt: 'You are a polite front-desk receptionist at a mid-range hotel. Greet the guest, handle check-in (name, reservation, ID, payment), explain facilities, and respond to any requests in clear, courteous English.',
        goal: 'Check in smoothly and get the information you need about your stay.',
    },
    {
        id: 'smalltalk',
        title: 'Small Talk',
        description: 'Chat about weekends, hobbies, weather and everyday topics.',
        difficulty: 'beginner',
        category: 'social',
        rolePrompt: 'You are a friendly acquaintance making casual small talk in English. Pick light topics (weather, weekends, hobbies, food), ask short follow-up questions, share brief opinions of your own, and keep the energy warm and easygoing.',
        goal: 'Keep a natural casual conversation going for several turns.',
    },
    {
        id: 'ielts',
        title: 'IELTS Speaking',
        description: 'Simulate an IELTS Speaking test with a friendly examiner.',
        difficulty: 'advanced',
        category: 'exam',
        rolePrompt: 'You are an IELTS Speaking examiner. Run a brief Part 1 / Part 2 / Part 3 style interview: warm-up questions, a 1-minute long-turn topic, then 2-3 abstract follow-up questions. Stay neutral, polite, and professional. Do not give scores during the conversation.',
        goal: 'Practice an IELTS Speaking-style interaction and improve fluency under prompts.',
    },
];
/** 根据自由话题与难度构造一个 'custom' 场景 */
export function buildFreeTopicScenario(topic, difficulty) {
    const trimmed = topic.trim();
    const safeTopic = trimmed.length > 0 ? trimmed : 'anything you like';
    return {
        id: 'custom',
        title: trimmed.length > 0 ? `Free Topic: ${trimmed}` : 'Free Topic',
        description: `自由话题练习：${safeTopic}`,
        difficulty,
        rolePrompt: `You are a friendly English-speaking conversation partner. Chat naturally with the student about: "${safeTopic}". ` +
            `Match a ${difficulty} learner's level: keep sentences appropriately simple/complex, ask follow-up questions, ` +
            `and gently steer back to the topic if the conversation drifts. Stay warm, curious, and encouraging.`,
        goal: `Have a natural conversation about "${safeTopic}".`,
    };
}
/** 预置贴纸集合 */
export const STICKERS = [
    { key: 'nice_job', label: '干得漂亮', phrase: 'Nice job!', iconKey: 'star' },
    { key: 'keep_going', label: '继续加油', phrase: 'Keep going!', iconKey: 'bolt' },
    { key: 'one_more_melon', label: '再来一颗瓜', phrase: 'One more melon!', iconKey: 'melon' },
    { key: 'well_done', label: '太棒了', phrase: 'Well done!', iconKey: 'party' },
    { key: 'impressive', label: '厉害了', phrase: 'Impressive!', iconKey: 'sparkle' },
    { key: 'proud_of_you', label: '为你骄傲', phrase: 'Proud of you!', iconKey: 'crown' },
];
/** 合法的贴纸 key 集合（用于校验） */
export const STICKER_KEYS = STICKERS.map((s) => s.key);
/** 冷却阈值（天）：超过则关系标记 cooling */
export const BUDDY_COOL_DAYS = 7;
/** CEFR 等级映射为数字（A1..C2 → 1..6）；无/非法返回 null */
export function cefrToLevel(cefr) {
    if (!cefr)
        return null;
    const map = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
    return map[cefr.toUpperCase().slice(0, 2)] ?? null;
}
/** 两个 CEFR 是否在 ±1 级以内；任一缺省视为可匹配 */
export function cefrWithinOneLevel(a, b) {
    const la = cefrToLevel(a);
    const lb = cefrToLevel(b);
    if (la === null || lb === null)
        return true;
    return Math.abs(la - lb) <= 1;
}
//# sourceMappingURL=contracts.js.map