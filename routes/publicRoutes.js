// routes/publicRoutes.js (ĐÃ SỬA)
const express = require('express');
const router = express.Router();
const { answerRuleQuestion } = require('../controllers/chatbotControler');
const userController = require('../controllers/userController'); 
const gameController = require('../controllers/gameController'); // <-- 1. Import

// API công khai để lấy tất cả game
router.get('/games', gameController.getAllPublicGames); // <-- 2. Gọi controller

// Route cho Chatbot AI
router.post('/ai/ask', answerRuleQuestion); 

// Route để cập nhật hồ sơ
router.put('/user', userController.updateUser);

module.exports = router;