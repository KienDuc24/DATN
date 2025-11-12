// index.js

require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const attachSocket = require('./socketServer');
const cookieParser = require('cookie-parser'); // <-- THÊM DÒNG NÀY
const adminAuth = require('./middleware/adminAuth'); // <-- THÊM DÒNG NÀY

const app = express();
const server = http.createServer(app);

// --- 1. Cấu hình Middleware ---
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://datn-smoky.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(cookieParser()); // <-- THÊM DÒNG NÀY

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. Gắn (Mount) Routes ---
try {
  app.use('/api/room', require('./routes/roomRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/debug', require('./routes/debugRoutes'));

  // --- THÊM CÁC ROUTE ADMIN ---
  // API Đăng nhập (không cần bảo vệ)
  app.use('/admin', require('./routes/adminAuthRoutes')); 
  // API Dữ liệu (phải được bảo vệ)
  app.use('/api/admin', adminAuth, require('./routes/adminRoutes')); 
  // -------------------------

  console.log('[index] All routes mounted successfully.');
} catch (e) {
  console.error('[index] Error mounting routes:', e.message);
}

// --- THÊM MỚI: CÁC ROUTE TRANG ADMIN ---
// Trang Login (Không bảo vệ)
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin-login.html'));
});

// Trang Dashboard (BẮT BUỘC phải đăng nhập)
// 'adminAuth' sẽ chạy trước, nếu OK mới phục vụ file
app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});
app.get('/admin.html', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});
app.get('/admin.js', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.js'));
});
app.get('/admin.css', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.css'));
});
// ---------------------------------

// --- SỬA LỖI: Health Check Route ---
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});
// ------------------------------------------

// --- 3. Khởi động Server ---
// (Giữ nguyên code start() của bạn)
const PORT = process.env.PORT || 3000;
async function start() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('[index] Connected to MongoDB.');

    if (typeof attachSocket === 'function') {
      attachSocket(server);
      console.log('[index] Socket.IO attached.');
    }

    server.listen(PORT, () => {
      console.log(`[index] Server + Socket running on port ${PORT}`);
    });
    
  } catch (err) {
    console.error('[index] FATAL STARTUP ERROR:', err.message);
    process.exit(1);
  }
}
start();

app.use((err, req, res, next) => {
  console.error('[server][ERROR]', err && (err.stack || err.message));
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});