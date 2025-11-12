// index.js

require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const cors = require('cors'); // Thêm cors ở đây
const path = require('path');
const attachSocket = require('./socketServer'); // File socket của bạn

const app = express();
const server = http.createServer(app);

// --- 1. Cấu hình Middleware ---

// Cấu hình CORS
// Phải đặt TRƯỚC các app.use('/api/...')
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://datn-smoky.vercel.app', // Cho phép Vercel
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.options('*', cors()); // Xử lý preflight (quan trọng cho một số request)

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Phục vụ file tĩnh (nếu có)

// --- 2. Gắn (Mount) Routes ---
// Tất cả logic nghiệp vụ sẽ nằm trong các file này
try {
  app.use('/api/room', require('./routes/roomRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/debug', require('./routes/debugRoutes'));
  console.log('[index] All routes mounted successfully.');
} catch (e) {
  console.error('[index] Error mounting routes:', e.message);
}

// --- 3. Khởi động Server ---
const PORT = process.env.PORT || 3000; // Sử dụng PORT từ môi trường

async function start() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    
    // Kết nối MongoDB (Chỉ 1 lần)
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000 // Tốt cho Railway/Vercel
    });
    console.log('[index] Connected to MongoDB.');

    // Gắn Socket.IO vào server
    if (typeof attachSocket === 'function') {
      attachSocket(server);
      console.log('[index] Socket.IO attached.');
    }

    // Khởi động server
    server.listen(PORT, () => {
      // Đây là dòng log bạn sẽ thấy trên Railway khi thành công
      console.log(`[index] Server + Socket running on port ${PORT}`);
    });
    
  } catch (err) {
    console.error('[index] FATAL STARTUP ERROR:', err.message);
    process.exit(1);
  }
}

// Chạy hàm khởi động
start();

// Xử lý lỗi toàn cục (đặt ở cuối)
app.use((err, req, res, next) => {
  console.error('[server][ERROR]', err && (err.stack || err.message));
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});