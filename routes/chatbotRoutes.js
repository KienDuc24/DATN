const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Import controller chatbot
const { answerRuleQuestion } = require('../controllers/chatbotControler');

// Endpoint hướng dẫn cách chơi
router.get('/ai/get-instructions', async (req, res) => {
  try {
    // SỬA ĐƯỜNG DẪN: Đảm bảo trỏ chính xác đến file rule.json
    // Giả định file rule.json nằm trong public/game/ToD/rule.json
    const filePath = path.join(__dirname, '..', 'public', 'game', 'ToD', 'rule.json'); 
    
    // Kiểm tra xem file có tồn tại không
    if (!fs.existsSync(filePath)) {
        console.error('LỖI: File rule.json không tìm thấy tại:', filePath);
        return res.status(404).json({ error: 'File hướng dẫn không tồn tại trên server.' });
    }

    const rules = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // SỬA LOGIC: Sử dụng trường tóm tắt chính xác (ví dụ: summary.en)
    if (!rules.summary || !rules.summary.en) {
      // Thử dùng trường tóm tắt tiếng Việt nếu tiếng Anh không có
      const fallbackSummary = rules.summary && rules.summary.vi ? rules.summary.vi : 'Không tìm thấy tóm tắt luật chơi.';
      return res.json({ instructions: fallbackSummary });
    }

    // Trả về tóm tắt tiếng Anh (hoặc bạn có thể dùng 'vi' nếu muốn tiếng Việt)
    res.json({ instructions: rules.summary.en });
  } catch (error) {
    console.error('Lỗi khi đọc rule.json hoặc parse JSON:', error);
    // Trả về lỗi server rõ ràng hơn
    res.status(500).json({ error: 'Lỗi server: Không thể đọc hoặc parse file luật chơi.' });
  }
});

// Route để AI trả lời câu hỏi về luật chơi
// Client gửi POST request đến /api/ai/ask với body { question: "..." }
router.post('/ai/ask', answerRuleQuestion);

module.exports = router;