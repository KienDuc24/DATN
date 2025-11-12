const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Room = require('../models/Room');
const { generateQuestion, getGameInstructions } = require('../controllers/aiService');

// optional simple protection: require ?secret=DEBUG_SECRET
router.get('/rooms', async (req, res) => {
  const secret = process.env.DEBUG_SECRET || 'debug';
  if (req.query.secret !== secret) return res.status(403).json({ ok:false, message:'forbidden' });
  try {
    const rooms = await Room.find({}).lean().limit(200);
    return res.json({ ok:true, count: rooms.length, rooms });
  } catch (e) {
    console.error('[debugRoutes] /rooms error', e);
    return res.status(500).json({ ok:false, message:'server error' });
  }
});

// Kiểm tra DB (thay đổi: trả trạng thái)
router.get('/db', (req, res) => {
  res.json({ connected: mongoose.connection.readyState === 1 });
});

// Kiểm tra socket (thay đổi: giả định export từ socketServer)
router.get('/socket', (req, res) => {
  const io = require('../socketServer').io;
  res.json({ clients: io.sockets.sockets.size });
});

// Endpoint tạo câu hỏi
router.post('/ai/generate-question', async (req, res) => {
  const { prompt } = req.body;
  const question = await generateQuestion(prompt);
  res.json({ question });
});

// Endpoint hướng dẫn cách chơi
router.get('/ai/get-instructions', async (req, res) => {
  const { gameName } = req.query;
  const instructions = await getGameInstructions(gameName);
  res.json({ instructions });
});

module.exports = router;