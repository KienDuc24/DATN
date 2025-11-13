const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// 1. Lấy API key từ .env
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
    console.warn('[ChatboxController] Thiếu GOOGLE_API_KEY trong file .env');
}
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// 2. Đọc và lưu trữ nội dung rule.json
let gameRules = '';
try {
    // Đường dẫn này dựa trên cấu trúc folder bạn gửi (controllers/ -> ../public/...)
    const filePath = path.join(__dirname, '../public/game/ToD/rule.json'); 
    gameRules = fs.readFileSync(filePath, 'utf-8');
    console.log('[ChatboxController] Đã tải thành công file rule.json.');
} catch (error) {
    console.error('[ChatboxController] LỖI NGHIÊM TRỌNG: Không thể đọc file rule.json:', error.message);
    gameRules = '{"error": "Không thể tải luật chơi."}';
}

// 3. Prompt hướng dẫn cho AI (System Prompt)
// Đây là phần quan trọng nhất để "ép" AI chỉ trả lời dựa trên file JSON
const systemPrompt = `
BẠN LÀ AI: Bạn là một trợ lý AI hướng dẫn luật chơi "Truth or Dare" (Thật hay Thách) cho một website game.
NHIỆM VỤ CỦA BẠN: Trả lời câu hỏi của người dùng.
NGUỒN DỮ LIỆU DUY NHẤT: Bạn CHỈ ĐƯỢC PHÉP sử dụng nội dung JSON sau đây để tìm câu trả lời. Không được bịa đặt thông tin không có trong JSON.

NỘI DUNG JSON (LUẬT CHƠI):
---
${gameRules}
---

QUY TẮC TRẢ LỜI:
1. Trả lời câu hỏi của người dùng dựa TRỰC TIẾP vào nội dung JSON ở trên.
2. Nếu câu hỏi không liên quan đến luật chơi trong JSON (ví dụ: "thời tiết hôm nay?"), hãy trả lời: "Tôi chỉ có thể giúp bạn về luật chơi Thật hay Thách thôi."
3. Giữ câu trả lời ngắn gọn, thân thiện và tập trung vào câu hỏi.
4. Luôn trả lời bằng tiếng Việt.

Câu hỏi của người dùng:
`; // Lưu ý: Câu hỏi sẽ được nối vào sau prompt này

// 4. Hàm xử lý câu hỏi mới (thay thế các hàm OpenAI cũ)
async function answerRuleQuestion(req, res) {
    const { question } = req.body;
    if (!question) {
        return res.status(400).json({ error: 'Thiếu câu hỏi (question).' });
    }
    if (!GOOGLE_API_KEY) {
        return res.status(500).json({ error: 'Chưa cấu hình API Key phía server.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-pro:generateText' }); // Sử dụng model hợp lệ
        
        // Ghép prompt hệ thống và câu hỏi của người dùng
        const fullPrompt = `${systemPrompt} "${question}"`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const aiAnswer = response.text();

        res.status(200).json({ answer: aiAnswer });

    } catch (error) {
        console.error('Lỗi khi gọi Google AI API:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi hỏi AI.' });
    }
}
// 6. Export hàm mới
// (Bạn có thể xóa các hàm generateQuestion, getGameInstructions cũ dùng OpenAI)
module.exports = {
    answerRuleQuestion
    // ... giữ lại các hàm khác của controller nếu có
};