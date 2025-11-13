// routes/publicRoutes.js
const express = require('express');
const router = express.Router();
const Game = require('../models/Game'); // Đảm bảo đúng đường dẫn
const { answerRuleQuestion } = require('../controllers/chatboxControler'); // Đường dẫn tới controller

// API công khai để lấy tất cả game
router.get('/games', async (req, res) => {
  try {
    const games = await Game.find({}); // Lấy tất cả game từ DB
    res.json(games); // Trả về dưới dạng JSON
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Ví dụ: POST /api/chatbox/ask
router.post('/api/chatbox/ask', answerRuleQuestion);

module.exports = router;