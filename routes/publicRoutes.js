const express = require('express');
const router = express.Router();
const { answerRuleQuestion } = require('../controllers/chatbotController');
const userController = require('../controllers/userController'); 
const gameController = require('../controllers/gameController'); 

router.get('/games', gameController.getAllPublicGames); 

router.post('/ai/ask', answerRuleQuestion); 

router.put('/user', userController.updateUser); 

module.exports = router;