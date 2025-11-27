const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

console.log('[authRoutes] file loaded');

router.post('/register', userController.registerUser); 
router.post('/login', userController.loginUser);
router.post('/forgot-password', userController.forgotPassword);
router.put('/reset-password/:token', userController.resetPassword);
router.get('/reset-info/:token', userController.getResetInfo);

module.exports = router;