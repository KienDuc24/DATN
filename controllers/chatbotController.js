// controllers/chatbotController.js (FINAL: Enforce Language)

const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs'); 
const User = require('../models/User'); 

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const userChatSessions = new Map();

const BASE_SYSTEM_PROMPT = `
BẠN LÀ AI: Trợ lý AI thông minh của website "Camping Game".
NHIỆM VỤ: Trả lời ngắn gọn, thân thiện, hữu ích.

THÔNG TIN NGƯỜI DÙNG:
Tên: %USER_NAME%

DỮ LIỆU GAME HIỆN TẠI:
%GAME_DATA_JSON%

QUY TẮC CHUNG:
1. Không yêu cầu mật khẩu/thông tin nhạy cảm.
2. Dùng dữ liệu game được cung cấp để trả lời chính xác.
`;

// ... (Hàm loadGameData, loadAllGamesData giữ nguyên) ...
function loadGameData(gameId) {
    let gameData = {};
    if (gameId.includes('.') || gameId.includes('/') || gameId.includes('\\')) throw new Error('gameId không hợp lệ.');
    const ruleFilePath = path.join(__dirname, '..', 'public', 'game', gameId, 'rule.json');
    const inforFilePath = path.join(__dirname, '..', 'public', 'game', gameId, 'infor.json');
    if (fs.existsSync(inforFilePath)) gameData.infor = JSON.parse(fs.readFileSync(inforFilePath, 'utf8'));
    if (fs.existsSync(ruleFilePath)) gameData.rules = JSON.parse(fs.readFileSync(ruleFilePath, 'utf8'));
    return gameData;
}

function loadAllGamesData() {
    const gamesJsonPath = path.join(__dirname, '..', 'public', 'games.json');
    if (fs.existsSync(gamesJsonPath)) {
        return { allGames: JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8')) };
    } else {
        throw new Error('Không tìm thấy file games.json');
    }
}

async function answerRuleQuestion(req, res) {
    const { question, gameId, username, language } = req.body; // Nhận thêm language
    
    if (!question || !gameId) return res.status(400).json({ error: 'Thiếu thông tin.' });
    if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'Lỗi Server AI.' });

    try {
        let displayName = "Khách";
        if (username && !username.startsWith('guest')) {
            const user = await User.findOne({ username: username });
            if (user && user.displayName) displayName = user.displayName;
        }

        const sessionKey = `${username || 'guest'}_${gameId}`;
        let chatSession = userChatSessions.get(sessionKey);

        // --- TẠO CHỈ THỊ NGÔN NGỮ ---
        const targetLang = language === 'en' ? 'ENGLISH' : 'VIETNAMESE';
        const langInstruction = `
        IMPORTANT: You MUST answer the user strictly in ${targetLang}.
        Even if the user asks in a different language, reply in ${targetLang}.
        `;
        // -----------------------------

        if (!chatSession) {
            let gameDataJsonString = "Không có dữ liệu game.";
            try {
                if (gameId === 'all') {
                    const data = loadAllGamesData();
                    gameDataJsonString = JSON.stringify(data.allGames, null, 2);
                } else {
                    const data = loadGameData(gameId);
                    gameDataJsonString = JSON.stringify(data, null, 2);
                }
            } catch (err) {}

            const systemInstruction = BASE_SYSTEM_PROMPT
                .replace('%USER_NAME%', displayName)
                .replace('%GAME_DATA_JSON%', gameDataJsonString)
                + langInstruction; // Thêm chỉ thị vào prompt gốc

            const model = genAI.getGenerativeModel({ 
                model: 'gemini-2.5-flash-preview-09-2025',
                systemInstruction: { parts: [{ text: systemInstruction }] },
            });

            chatSession = model.startChat({
                history: [],
                generationConfig: { maxOutputTokens: 500 },
            });

            userChatSessions.set(sessionKey, chatSession);
            if (userChatSessions.size > 1000) userChatSessions.delete(userChatSessions.keys().next().value);
        }

        // Gửi tin nhắn kèm chỉ thị nhắc lại (để bot không quên)
        const prompt = `${question} (Reply in ${targetLang})`;
        const result = await chatSession.sendMessage(prompt);
        const response = await result.response;
        
        res.status(200).json({ answer: response.text() });

    } catch (error) {
        console.error('Chat Error:', error);
        if (username) userChatSessions.delete(`${username}_${gameId}`);
        res.status(500).json({ error: 'AI busy.' });
    }
}

module.exports = { answerRuleQuestion };