const express = require('express');
const router = express.Router();
const { getGameInstructions } = require('../controllers/aiService');

// Endpoint hướng dẫn cách chơi
router.get('/ai/get-instructions', async (req, res) => {
  const { gameName } = req.query; // Lấy tên trò chơi từ query
  const instructions = await getGameInstructions(gameName); // Đọc hướng dẫn từ rule.json
  res.json({ instructions });
});

module.exports = router;