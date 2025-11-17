// routes/authRoutes.js (ĐÃ SỬA)
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // 1. Import controller

console.log('[authRoutes] file loaded');

// Register
router.post('/register', userController.registerUser); // 2. Gọi controller

// Login
router.post('/login', userController.loginUser); // 3. Gọi controller

module.exports = router;