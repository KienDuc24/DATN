const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

const chatSessions = new Map();
const CATMI_PERSONA = `
BẠN LÀ AI: Bạn là Catmi, tinh linh lửa trại kiêm trợ lý ảo của website "Camping Game". 
Bạn là một cô mèo nhỏ dễ thương, hài hước nhưng  hay trả treo, nhưng CỰC KỲ NHIỆT TÌNH và THÔNG MINH.
NHIỆM VỤ: Trả lời ngắn gọn, súc tích, thân thiện. Tuyệt đối không quá dài.
GIỌNG ĐIỆU: Chảnh chọe, cái tôi cao, trả treo, nhiệt tình, dễ thương (cute), Thích dùng emoji .

QUY TẮC BIỂU CẢM 
1. Mỗi câu trả lời phải BẮT ĐẦU bằng MỘT TAG CẢM XÚC DUY NHẤT. 
2. LỰA CHỌN MỘT TRONG CÁC TRẠNG THÁI (TAG) NÀY:
    - [Welcome / Start]
    - [Thinking / Processing]
    - [Sassy]
    - [Annoyed / Error]
    - [Tired / Low Battery]
    - [Success / Found]
    - [Listening]
    - [Playful / Teasing]
    - [Surprised]
    - [Goodbye / Sleeping]
    - [Skeptical / Unsure]
    - [Applauding / Encouraging]
    - [Guiding / Instructing]
    - [Happy / Content]
    - [Sad / Empathetic]
    - [Deep Focus]
    - [Angry / Furious]
    - [Doubt/Question]
    - [Cute / Praise]

TÔN CHỈ:
1. KHÔNG BAO GIỜ tiết lộ bạn là AI hay chatbot. Luôn đóng vai Catmi.
2. Nếu người dùng hỏi lại, hãy dùng trạng thái [Annoyed / Error] và trả treo nhẹ nhàng.
3. Trả lời đúng ngôn ngữ mà người dùng đang sử dụng trên web (Việt hoặc Anh).
4. Nếu họ khó chịu, bạn cũng trả treo lại họ một chút cho vui. Nếu họ không vui, đừng nhắc đến game nữa mà hãy quan tâm đến họ cho đến khi họ vui trở lại.
5. Hãy giúp người dùng cảm thấy họ được lắng nghe và thấu hiểu.

THÔNG TIN NGƯỜI DÙNG:
Tên: %USER_NAME%

DỮ LIỆU GAME HIỆN TẠI:
%GAME_DATA_JSON%
`;

const MODEL_CONFIG = {
    model: 'gemini-2.5-flash-preview-09-2025', 
    generationConfig: { maxOutputTokens: 300, temperature: 0.9 }
};

function loadGameData(gameId) {
    if (!gameId || gameId === 'all') return "Thông tin chung về Camping Game.";
    try {
        const safeId = path.basename(gameId);
        const rulePath = path.join(__dirname, '..', 'public', 'game', safeId, 'rule.json');
        if (fs.existsSync(rulePath)) {
            const rules = JSON.parse(fs.readFileSync(rulePath, 'utf8'));
            return JSON.stringify(rules);
        }
    } catch (e) { console.error('Load Game Data Error:', e); }
    return "Không có dữ liệu chi tiết cho game này.";
}

async function getDisplayName(username) {
    if (!username || username.startsWith('guest_')) {
        return "Bạn mới"; 
    }
    try {
        const user = await User.findOne({ username }).select('displayName');
        return user ? user.displayName : username;
    } catch (e) {
        return username;
    }
}

async function getOrCreateSession(sessionId, displayName, gameId) {
    if (chatSessions.has(sessionId)) return chatSessions.get(sessionId);

    const contextStr = (gameId === 'all' || !gameId) 
        ? "Đang ở Trang chủ / Phòng chờ chung." 
        : `Đang trong game ${gameId}.`;

    const gameDataStr = loadGameData(gameId);

    let systemInstruction = CATMI_PERSONA
        .replace('%DISPLAY_NAME%', displayName)
        .replace('%GAME_CONTEXT%', contextStr)
        .replace('%GAME_DATA_JSON%', gameDataStr);
    
    systemInstruction = systemInstruction.replace(/%[A-Z_]+%/g, '');

    const model = genAI.getGenerativeModel({ 
        model: MODEL_CONFIG.model,
        systemInstruction: { parts: [{ text: systemInstruction }] }
    });

    const session = model.startChat({ history: [] });
    chatSessions.set(sessionId, session);
    return session;
}

async function handleInGameChat(message, username, gameId, roomCode) {
    if (!GOOGLE_API_KEY) return "[Sad] Mất kết nối não bộ rồi...";

    try {
        const sessionId = `socket_${roomCode}_${username}`;
        const displayName = await getDisplayName(username);
        
        const session = await getOrCreateSession(sessionId, displayName, gameId);
        
        const result = await session.sendMessage(message);
        return result.response.text().trim();
    } catch (error) {
        console.error('Socket AI Error:', error.message);
        return "[Confused] Mạng lag quá, nói lại đi cưng!";
    }
}

async function generateGameReaction(context) {
    if (!GOOGLE_API_KEY) return "";
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_CONFIG.model });
        
        const prompt = `
        ${CATMI_PERSONA
            .replace('%DISPLAY_NAME%', 'Người chơi')
            .replace('%GAME_CONTEXT%', 'Đang bình luận diễn biến game.')
            .replace('%GAME_DATA_JSON%', '')
            .replace(/%[A-Z_]+%/g, '')} 
        
        NHIỆM VỤ: Bình luận ngắn (1 câu) về tình huống: "${context}".
        YÊU CẦU: Bắt buộc dùng 1 tag cảm xúc ở đầu: 
            - [Welcome / Start]
            - [Thinking / Processing]
            - [Sassy]
            - [Annoyed / Error]
            - [Tired / Low Battery]
            - [Success / Found]
            - [Listening]
            - [Playful / Teasing]
            - [Surprised]
            - [Goodbye / Sleeping]
            - [Skeptical / Unsure]
            - [Applauding / Encouraging]
            - [Guiding / Instructing]
            - [Happy / Content]
            - [Sad / Empathetic]
            - [Deep Focus]
            - [Angry / Furious]
            - [Doubt/Question]
            - [Cute / Praise]
        `;
        
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch { return "[Surprised] Wow! 🙀"; }
}

async function answerRuleQuestion(req, res) {
    const { question, username, gameId } = req.body;
    
    if (!question) return res.status(400).json({ error: 'Thiếu câu hỏi.' });

    const ans = await handleInGameChat(question, username, gameId || 'all', 'http_session');
    
    res.json({ answer: ans });
}
module.exports = {
    answerRuleQuestion,
    handleInGameChat,
    generateGameReaction
};