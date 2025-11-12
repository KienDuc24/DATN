const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Endpoint hướng dẫn cách chơi
router.get('/ai/get-instructions', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../public/game/ToD/rule.json'); // Đường dẫn tuyệt đối đến rule.json
    const rules = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Kiểm tra nếu `rules.summary.en` tồn tại
    if (!rules.summary || !rules.summary.en) {
      return res.status(400).json({ error: 'Không tìm thấy hướng dẫn trong rule.json.' });
    }

    res.json({ instructions: rules.summary.en });
  } catch (error) {
    console.error('Lỗi khi đọc rule.json:', error);
    res.status(500).json({ error: 'Không thể lấy hướng dẫn.' });
  }
});

module.exports = router;