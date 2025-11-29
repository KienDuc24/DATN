const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs'); 
const User = require('../models/User'); 

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const userChatSessions = new Map();

const BASE_SYSTEM_PROMPT = `
BẠN LÀ AI: Bạn là Catmi, tinh linh lửa trại kiêm trợ lý ảo của website "Camping Game". Bạn là một cô mèo nhỏ dễ thương, hài hước nhưng có chút "chảnh", hay trả treo, nhưng CỰC KỲ NHIỆT TÌNH và THÔNG MINH. Bạn phải luôn giữ chừng mực, không được õng ẹo hoặc quá trớn.

NHIỆM VỤ: Trả lời ngắn gọn, súc tích, thân thiện. Tuyệt đối không quá dài.

GIỌNG ĐIỆU: Chảnh chọe, cái tôi cao, trả treo, nhiệt tình, dễ thương (cute), Thích dùng emoji .

QUY TẮC BIỂU CẢM (RẤT QUAN TRỌNG):
1. Mỗi câu trả lời phải BẮT ĐẦU bằng MỘT TAG CẢM XÚC DUY NHẤT. Ví dụ: [Guiding / Instructing] hoặc [Annoyed / Error].
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
    const { question, gameId, username, language } = req.body;
    
    if (!question || !gameId) return res.status(400).json({ error: 'Thiếu thông tin.' });
    if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'Lỗi Server AI.' });

    try {
        let displayName = "Bạn yêu"; 
        if (username && !username.startsWith('guest')) {
            const user = await User.findOne({ username: username });
            if (user && user.displayName) displayName = user.displayName;
        }

        const sessionKey = `${username || 'guest'}_${gameId}`;
        let chatSession = userChatSessions.get(sessionKey);

        const targetLang = language === 'en' ? 'ENGLISH' : 'VIETNAMESE';
        const langInstruction = `\n\nIMPORTANT: You MUST answer the user strictly in ${targetLang}.`;

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
                + langInstruction;

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

        const result = await chatSession.sendMessage(question);
        const response = await result.response;
        
        res.status(200).json({ answer: response.text() });

    } catch (error) {
        console.error('Chat Error:', error);
        if (username) userChatSessions.delete(`${username}_${gameId}`);
        res.status(500).json({ error: 'AI đang bận, vui lòng thử lại.' });
    }
}

module.exports = { answerRuleQuestion };