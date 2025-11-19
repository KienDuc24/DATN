// controllers/chatbotController.js (CÁ NHÂN HÓA + LỊCH SỬ CHAT)

const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs'); 
const User = require('../models/User'); // Import User model

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.warn('[chatbotController] Thiếu GOOGLE_API_KEY trong file .env');
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// Lưu trữ phiên chat trong bộ nhớ (RAM)
// Key: "username_gameId" -> Value: ChatSession Object
const userChatSessions = new Map();

const BASE_SYSTEM_PROMPT = `
BẠN LÀ AI: Bạn là trợ lý AI thông minh của website "Camping Game".
NHIỆM VỤ: Trả lời ngắn gọn, súc tích, đúng trọng tâm.

THÔNG TIN NGƯỜI DÙNG:
Tên: %USER_NAME%

QUY TẮC QUAN TRỌNG:
1. Luôn xưng hô thân thiện (nếu biết tên thì gọi tên, không thì gọi là 'bạn').
2. Không yêu cầu mật khẩu hay thông tin nhạy cảm.
3. Nếu người dùng hỏi về game, hãy dùng dữ liệu được cung cấp dưới đây.
4. Nếu người dùng chào, hãy chào lại kèm tên họ.

DỮ LIỆU GAME HIỆN TẠI:
%GAME_DATA_JSON%
`;

// Hàm tải dữ liệu game (như cũ)
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
    const { question, gameId, username } = req.body; // Nhận thêm username
    
    if (!question || !gameId) {
        return res.status(400).json({ error: 'Thiếu thông tin câu hỏi hoặc gameId.' });
    }
    if (!GOOGLE_API_KEY) {
        return res.status(500).json({ error: 'Chưa cấu hình Server AI.' });
    }

    try {
        // 1. Lấy thông tin User từ DB (để bot biết tên)
        let displayName = "Khách";
        if (username && !username.startsWith('guest')) {
            const user = await User.findOne({ username: username });
            if (user && user.displayName) displayName = user.displayName;
        } else if (username && username.startsWith('guest')) {
            displayName = "Khách";
        }

        // 2. Tạo Key cho Session (Mỗi user + mỗi gameId là 1 phiên chat riêng)
        // Nếu user đổi game, bot sẽ reset ngữ cảnh game nhưng vẫn nhớ tên (do logic tạo mới bên dưới)
        const sessionKey = `${username || 'guest'}_${gameId}`;
        
        let chatSession = userChatSessions.get(sessionKey);

        // 3. Nếu chưa có session, tạo mới
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
            } catch (err) {
                console.warn(`[Chatbot] Không tải được data game ${gameId}:`, err.message);
            }

            // Inject tên và dữ liệu game vào prompt
            const systemInstruction = BASE_SYSTEM_PROMPT
                .replace('%USER_NAME%', displayName)
                .replace('%GAME_DATA_JSON%', gameDataJsonString);

            const model = genAI.getGenerativeModel({ 
                model: 'gemini-2.5-flash-preview-09-2025',
                systemInstruction: { parts: [{ text: systemInstruction }] },
            });

            // Khởi tạo chat session
            chatSession = model.startChat({
                history: [], // Bắt đầu lịch sử trống
                generationConfig: {
                    maxOutputTokens: 500,
                },
            });

            // Lưu vào bộ nhớ server
            userChatSessions.set(sessionKey, chatSession);
            
            // Giới hạn bộ nhớ: Xóa session cũ nếu quá nhiều (tránh tràn RAM)
            if (userChatSessions.size > 1000) {
                const firstKey = userChatSessions.keys().next().value;
                userChatSessions.delete(firstKey);
            }
        }

        // 4. Gửi tin nhắn
        const result = await chatSession.sendMessage(question);
        const response = await result.response;
        const aiAnswer = response.text();

        res.status(200).json({ answer: aiAnswer });

    } catch (error) {
        console.error('Lỗi Chatbot Controller:', error);
        // Nếu lỗi session, thử xóa session để lần sau tạo lại
        if (username) {
             const sessionKey = `${username}_${gameId}`;
             userChatSessions.delete(sessionKey);
        }
        res.status(500).json({ error: 'AI đang bận, vui lòng thử lại.' });
    }
}

module.exports = {
    answerRuleQuestion
};