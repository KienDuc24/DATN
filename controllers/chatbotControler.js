// Sửa: Quay lại dùng Google Generative AI (Gemini)
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

// 1. Lấy API key của Google từ .env
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.warn('[chatbotController] Thiếu GOOGLE_API_KEY trong file .env');
}

// Khởi tạo client Google AI
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// 2. Tải luật chơi (Giữ nguyên)
const gameRules = require('../public/game/ToD/rule.json');

// 3. Prompt hướng dẫn cho AI (Giữ nguyên)
// (Prompt này hoạt động tốt cho cả OpenAI và Gemini)
const systemPrompt = `
BẠN LÀ AI: Bạn là một trợ lý AI hướng dẫn luật chơi "Truth or Dare" (Thật hay Thách) cho một website game.
NHIỆM VỤ CỦA BẠN: Trả lời câu hỏi của người dùng.
NGUỒN DỮ LIỆU DUY NHẤT: Bạn CHỈ ĐƯỢC PHÉP sử dụng nội dung JSON sau đây để tìm câu trả lời. Không được bịa đặt thông tin không có trong JSON.

NỘI DUNG JSON (LUẬT CHƠI):
---
${JSON.stringify(gameRules)}
---

QUY TẮC TRẢ LỜI:
1. Trả lời câu hỏi của người dùng dựa TRỰC TIẾP vào nội dung JSON ở trên.
2. Nếu câu hỏi không liên quan đến luật chơi trong JSON (ví dụ: "thời tiết hôm nay?"), hãy trả lời: "Tôi chỉ có thể giúp bạn về luật chơi Thật hay Thách thôi."
3. Giữ câu trả lời ngắn gọn, thân thiện và tập trung vào câu hỏi.
4. Luôn trả lời bằng tiếng Việt.
`;

// 4. Hàm xử lý câu hỏi - ĐÃ CẬP NHẬT ĐỂ DÙNG GEMINI
async function answerRuleQuestion(req, res) {
    const { question } = req.body;
    if (!question) {
        return res.status(400).json({ error: 'Thiếu câu hỏi (question).' });
    }
    if (!GOOGLE_API_KEY) {
        return res.status(500).json({ error: 'Chưa cấu hình GOOGLE_API_KEY phía server.' });
    }

    try {
        // Sửa 1: Cập nhật model mới và dùng 'systemInstruction' (theo tài liệu)
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash-preview-09-2025',
            // Gửi prompt hệ thống (luật chơi) riêng biệt
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
        });
        
        // Sửa 2: Chỉ gửi câu hỏi của người dùng làm nội dung chính
        // (Không cần ghép chuỗi `fullPrompt` nữa)
        const result = await model.generateContent(question); 
        
        const response = await result.response;
        const aiAnswer = response.text();

        res.status(200).json({ answer: aiAnswer });

    } catch (error) {
        console.error('Lỗi khi gọi Google AI API:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi hỏi AI (Google Gemini).' });
    }
}

// 5. Export (Giữ nguyên)
module.exports = {
    answerRuleQuestion
};