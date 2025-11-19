// routes/publicRoutes.js

const express = require('express');
const router = express.Router();
const { answerRuleQuestion } = require('../controllers/chatbotController');
const userController = require('../controllers/userController'); 
const gameController = require('../controllers/gameController'); 

// API công khai để lấy tất cả game
router.get('/games', gameController.getAllPublicGames); 

// Route cho Chatbot AI
router.post('/ai/ask', answerRuleQuestion); 

// Route để cập nhật hồ sơ (PHẢI LÀ PUT)
router.put('/user', userController.updateUser); // <-- PHƯƠNG THỨC PUT

module.exports = router;