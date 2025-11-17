const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs'); 

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.warn('[chatbotController] Thiếu GOOGLE_API_KEY trong file .env');
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// SỬA: Prompt Mẫu Chung
const SYSTEM_PROMPT_TEMPLATE = `
BẠN LÀ AI: Bạn là một trợ lý AI thân thiện, thông minh cho website "Camping Game".
NHIỆM VỤ CỦA BẠN: Trả lời câu hỏi của người dùng một cách ngắn gọn, súc tích.
NGÔN NGỮ: Mặc định trả lời bằng tiếng Việt. Nếu người dùng hỏi bằng ngôn ngữ khác, hãy trả lời bằng ngôn ngữ đó.

QUY TẮC BẢO MẬT (RẤT QUAN TRỌNG):
Bạn *không* thể quản lý tài khoản (đăng nhập, đăng ký, đổi mật khẩu).
Nếu người dùng yêu cầu "đăng nhập", "đăng ký" hoặc "quản lý tài khoản", HÃY HƯỚNG DẪN họ sử dụng các nút chức năng trên trang web.
Tuyệt đối không yêu cầu người dùng cung cấp mật khẩu.

NGUỒN DỮ LIỆU GAME (NẾU CÓ):
%GAME_DATA_JSON%
            
QUY TẮC TRẢ LỜI:
1.  **Ngắn gọn:** Giữ tất cả các câu trả lời ngắn gọn và đi thẳng vào vấn đề.
2.  **Về Game (Nếu có dữ liệu):** Dựa vào dữ liệu game được cung cấp để trả lời các câu hỏi về mô tả game, luật chơi, v.v.
3.  **Câu hỏi khác (Cho phép):** Nếu câu hỏi không liên quan đến game (ví dụ: "chào bạn", "bạn là ai?"), hãy trả lời một cách thân thiện, ngắn gọn.
`;

// HÀM MỚI: Tải dữ liệu cho 'gameId' cụ thể
function loadGameData(gameId) {
    let gameData = {};
    let dataLoaded = false;
    
    // Bảo mật: Chặn Path Traversal
    if (gameId.includes('.') || gameId.includes('/') || gameId.includes('\\')) {
        throw new Error('gameId không hợp lệ.');
    }

    const ruleFilePath = path.join(__dirname, '..', 'public', 'game', gameId, 'rule.json');
    const inforFilePath = path.join(__dirname, '..', 'public', 'game', gameId, 'infor.json');
    
    if (fs.existsSync(inforFilePath)) {
        gameData.infor = JSON.parse(fs.readFileSync(inforFilePath, 'utf8'));
        dataLoaded = true;
    } else {
        console.warn(`[Chatbot] Không tìm thấy file infor.json cho game ${gameId}`);
    }
    
    if (fs.existsSync(ruleFilePath)) {
        gameData.rules = JSON.parse(fs.readFileSync(ruleFilePath, 'utf8'));
        dataLoaded = true;
    } else {
        console.warn(`[Chatbot] Không tìm thấy file rule.json cho game ${gameId}`);
    }

    if (!dataLoaded) {
         throw new Error(`Không tìm thấy file (infor.json hoặc rule.json) cho game '${gameId}'.`);
    }
    
    return gameData;
}

// HÀM MỚI: Tải dữ liệu cho 'all' (trang chủ)
function loadAllGamesData() {
    const gamesJsonPath = path.join(__dirname, '..', 'public', 'games.json');
    if (fs.existsSync(gamesJsonPath)) {
        return { allGames: JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8')) };
    } else {
        console.warn(`[Chatbot] Không tìm thấy file public/games.json`);
        throw new Error('Không tìm thấy file games.json');
    }
}

// Hàm xử lý câu hỏi - ĐÃ NÂNG CẤP
async function answerRuleQuestion(req, res) {
    const { question, gameId } = req.body; 
    
    if (!question) {
        return res.status(400).json({ error: 'Thiếu câu hỏi (question).' });
    }
    if (!gameId) {
        return res.status(400).json({ error: 'Thiếu ID của game (gameId).' });
    }
    if (!GOOGLE_API_KEY) {
        return res.status(500).json({ error: 'Chưa cấu hình GOOGLE_API_KEY phía server.' });
    }

    let gameDataJsonString = "Không có dữ liệu game.";
    
    try {
        let gameData;
        if (gameId === 'all') {
            // Xử lý cho trang chủ
            gameData = loadAllGamesData();
            gameDataJsonString = `Đây là danh sách tất cả các game có sẵn: \n${JSON.stringify(gameData.allGames, null, 2)}`;
        } else {
            // Xử lý cho phòng chờ game cụ thể
            gameData = loadGameData(gameId);
            gameDataJsonString = `Đây là thông tin và luật chơi của game ${gameId}: \n${JSON.stringify(gameData, null, 2)}`;
        }
    } catch (fsError) {
        console.error(`[Chatbot] Lỗi khi đọc file .json cho gameId ${gameId}:`, fsError.message);
        return res.status(500).json({ error: `Lỗi máy chủ khi đọc file: ${fsError.message}` });
    }

    try {
        // Tạo system prompt động
        const dynamicSystemPrompt = SYSTEM_PROMPT_TEMPLATE
            .replace('%GAME_DATA_JSON%', gameDataJsonString);

        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash-preview-09-2025',
            systemInstruction: {
              parts: [{ text: dynamicSystemPrompt }],
            },
        });
        
        const result = await model.generateContent(question); 
        
        const response = await result.response;
        const aiAnswer = response.text();

        res.status(200).json({ answer: aiAnswer });

    } catch (error) {
        console.error('Lỗi khi gọi Google AI API:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi hỏi AI (Google Gemini).' });
    }
}

// Export (Giữ nguyên)
module.exports = {
    answerRuleQuestion
};