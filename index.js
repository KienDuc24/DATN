// index.js (Backend)

require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const attachSocket = require('./socketServer');
const cookieParser = require('cookie-parser');
const adminAuth = require('./middleware/adminAuth');

const app = express();
const server = http.createServer(app);

// --- 1. Cấu hình Middleware ---
const frontendURL = process.env.FRONTEND_URL || 'https://datn-smoky.vercel.app';
app.use(cors({
  origin: frontendURL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true 
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. Gắn (Mount) Routes ---
try {
  app.use('/api/room', require('./routes/roomRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/debug', require('./routes/debugRoutes'));
  app.use('/admin', require('./routes/adminAuthRoutes')); 
  app.use('/api/admin', adminAuth, require('./routes/adminRoutes')); 
  console.log('[index] All routes mounted successfully.');
} catch (e) {
  console.error('[index] Error mounting routes:', e.message);
}

// --- 3. Các Route Trang Admin ---
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin-login.html'));
});

// Trang Dashboard (Bảo vệ)
app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});
app.get('/admin.html', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});
app.get('/admin.js', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.js'));
});
app.get('/css/admin.css', (req, res) => { 
  res.sendFile(path.join(__dirname, 'public/css/admin.css'));
});

// --- SỬA LỖI: THÊM DÒNG NÀY ---
app.get('/admin-login.css', (req, res) => { 
  res.sendFile(path.join(__dirname, 'public/admin-login.css'));
});
// -----------------------------

// --- Health Check Route ---
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// --- 4. Khởi động Server ---
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