// routes/roomRoutes.js (ĐÃ SỬA)
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const roomController = require('../controllers/roomController'); // <-- 1. Import controller

// Middleware kiểm tra trạng thái MongoDB (Giữ nguyên)
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('[roomRoutes] Database not ready');
    return res.status(503).json({ error: 'Database not ready' });
  }
  next();
});

// API tạo phòng
router.post('/', roomController.createRoom); // <-- 2. Gọi controller

// Endpoint kiểm tra phòng (Dùng khi "Tham gia phòng" từ index.html)
router.get('/', roomController.checkRoom); // <-- 3. Gọi controller

// API tham gia phòng (dùng cho 'tod-join' - logic này có vẻ không được dùng)
router.post('/join', roomController.joinRoom); // <-- 4. Gọi controller

// Middleware xử lý lỗi chung (Giữ nguyên)
router.use((err, req, res, next) => {
  console.error('[roomRoutes] Unexpected error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = router;