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
    model: 'gemini-1.5-flash', 
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

async function getOrCreateSession(sessionId, displayName, gameId, lang = 'vi') {
    if (chatSessions.has(sessionId)) {
        return chatSessions.get(sessionId);
    }

    const gameInfo = loadGameData(gameId);
    const languageInstruction = lang === 'en' ? 'ENGLISH' : 'VIETNAMESE';
    
    const systemInstruction = CATMI_PERSONA
        .replace('%TARGET_LANG%', languageInstruction)
        + `\n\nTHÔNG TIN NGƯỜI DÙNG: Tên là "${displayName}"`
        + `\nNGỮ CẢNH HIỆN TẠI: Đang ở ${gameId === 'all' ? 'Sảnh chính' : 'Phòng game ' + gameId}`
        + `\nDỮ LIỆU GAME: ${gameInfo}`;

    const model = genAI.getGenerativeModel({ 
        model: MODEL_CONFIG.model,
        systemInstruction: { parts: [{ text: systemInstruction }] }
    });

    const session = model.startChat({
        history: [],
        generationConfig: MODEL_CONFIG.generationConfig
    });

    chatSessions.set(sessionId, session);

    return session;
}

async function answerRuleQuestion(req, res) {
    const { question, gameId, username, language } = req.body;
    
    if (!question) return res.status(400).json({ error: 'Thiếu câu hỏi.' });
    if (!GOOGLE_API_KEY) return res.status(500).json({ answer: "Catmi đang ngủ đông (Lỗi Server API). Vui lòng thử lại sau." });

    try {
        const sessionId = `http_${username || 'guest'}_${gameId}`;
        const displayName = await getDisplayName(username);
        const session = await getOrCreateSession(sessionId, displayName, gameId, language);
        const result = await session.sendMessage(question);
        
        res.json({ answer: result.response.text() });
    } catch (error) {
        console.error('HTTP Chat Error:', error);
        res.status(500).json({ answer: "Catmi đang ngủ đông (Lỗi Server API). Vui lòng thử lại sau." });
    }
}

async function handleInGameChat(message, username, gameId, roomCode) {
    if (!GOOGLE_API_KEY) return "Catmi đang ngủ đông (Lỗi Server API). Vui lòng thử lại sau.";

    try {
        const sessionId = `socket_${roomCode}_${username}`;
        const displayName = await getDisplayName(username);
        const session = await getOrCreateSession(sessionId, displayName, gameId, 'vi');
        const prompt = message; 
        const result = await session.sendMessage(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Socket Chat Error:', error);
        return "Catmi không hiểu bạn nói gì.";
    }
}
async function generateGameReaction(context) {
    if (!GOOGLE_API_KEY) return "";

    try {
        const model = genAI.getGenerativeModel({ model: MODEL_CONFIG.model });
        const prompt = `
        ${CATMI_PERSONA.replace('%TARGET_LANG%', 'VIETNAMESE')}
        
        NHIỆM VỤ: Bình luận ngắn (tối đa 1 câu) về tình huống sau trong game:
        "${context}"
        Yêu cầu: Hài hước, trêu chọc hoặc khen ngợi tùy tình huống.
        `;
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        return "Wow! 🙀"; 
    }
}

module.exports = {
    answerRuleQuestion,
    handleInGameChat,
    generateGameReaction
};