const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const { answerRuleQuestion } = require('../controllers/chatbotController');

router.get('/ai/get-instructions', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', 'public', 'game', 'ToD', 'rule.json'); 
    
    if (!fs.existsSync(filePath)) {
        console.error('LỖI: File rule.json không tìm thấy tại:', filePath);
        return res.status(404).json({ error: 'File hướng dẫn không tồn tại trên server.' });
    }

    const rules = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!rules.summary || !rules.summary.en) {
      const fallbackSummary = rules.summary && rules.summary.vi ? rules.summary.vi : 'Không tìm thấy tóm tắt luật chơi.';
      return res.json({ instructions: fallbackSummary });
    }

    res.json({ instructions: rules.summary.en });
  } catch (error) {
    console.error('Lỗi khi đọc rule.json hoặc parse JSON:', error);
    res.status(500).json({ error: 'Lỗi server: Không thể đọc hoặc parse file luật chơi.' });
  }
});

router.post('/ai/ask', answerRuleQuestion);

module.exports = router;