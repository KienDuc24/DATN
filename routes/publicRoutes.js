// routes/publicRoutes.js
const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const { answerRuleQuestion } = require('../controllers/chatbotControler');

// API công khai để lấy tất cả game
router.get('/games', async (req, res) => {
  try {
    const games = await Game.find({});
    res.json(games);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// SỬA LẠI DÒNG NÀY:
router.post('/ai/ask', answerRuleQuestion); // Bỏ '/api' và dùng '/ai/ask'

module.exports = router;