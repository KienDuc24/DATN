require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const attachSocket = require('./socketServer');
const app = express();
const server = http.createServer(app);

// Cấu hình CORS (Đã đúng)
app.use(cors({
  origin: 'https://datn-smoky.vercel.app', // Cho phép nguồn gốc từ Vercel
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.options('*', cors()); // Xử lý preflight

// Thêm middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

console.log('[server] NODE_ENV=', process.env.NODE_ENV);
console.log('[server] FRONTEND_URL=', process.env.FRONTEND_URL);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('[server][FATAL] MONGODB_URI not set. Set env var before starting.');
} else {
  console.log('[server] connecting to MongoDB...');
}

// mount routes
try { app.use('/api/auth', require('./routes/authRoutes')); console.log('[server] authRoutes mounted at /api/auth'); } catch (e) { console.error('[server] authRoutes not mounted', e && e.message || e); }

try { app.use('/api/debug', require('./routes/debugRoutes')); console.log('[server] debugRoutes mounted at /api/debug'); } catch (e) { console.error('[server] debugRoutes not mounted', e && e.message || e); }

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket
attachSocket(server);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// global error handler
app.use((err, req, res, next) => {
  console.error('[server][ERROR]', err && (err.stack || err.message));
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
  });
});

app.post('/api/room', (req, res) => {
  console.log('>>> Đã nhận được yêu cầu POST /api/room (test route)');
  const { player, game } = req.body;
  if (!player || !game) {
    console.log('>>> Yêu cầu bị từ chối: Thiếu player hoặc game');
    return res.status(400).json({ error: 'Missing player or game' });
  }

  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  console.log(`>>> Tạo phòng thành công: ${roomCode}`);
  res.json({ roomCode });
});

// Định nghĩa route GET /api/room (nếu cần)
app.get('/api/room', (req, res) => {
  console.log('>>> Đã nhận được yêu cầu GET /api/room (test route)');
  res.status(200).json({ message: 'GET /api/room is working!' });
});

module.exports = app;