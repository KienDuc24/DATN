const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Endpoint hướng dẫn cách chơi
router.get('/ai/get-instructions', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../public/game/ToD/rule.json');
    const rules = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Kiểm tra nếu `rules.rules_summary` tồn tại
    if (!rules.rules_summary) {
      return res.status(400).json({ error: 'Không tìm thấy hướng dẫn trong rule.json.' });
    }

    res.json({ instructions: rules.rules_summary });
  } catch (error) {
    console.error('Lỗi khi đọc rule.json:', error);
    res.status(500).json({ error: 'Không thể lấy hướng dẫn.' });
  }
});

module.exports = router;