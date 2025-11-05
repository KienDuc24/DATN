require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors'); // Thêm để hỗ trợ CORS cho socket
const socketServer = require('./socketServer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Cho phép cross-origin cho socket
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// serve static public
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB với pool tối ưu (thay đổi: thêm options để tránh lỗi kết nối)
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // Giới hạn pool để tránh quá tải
}).then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Thoát nếu kết nối thất bại
  });

// mount auth routes (both API and oauth paths)
try {
  const authRoutes = require('./routes/authRoutes');
  // API endpoints used by frontend (fetch /api/auth/login, /api/auth/register ...)
  app.use('/api/auth', authRoutes);
  // OAuth browser redirects (/auth/google, /auth/google/callback)
  app.use('/auth', authRoutes);
  console.log('[server] authRoutes mounted at /api/auth and /auth');
} catch (e) {
  console.warn('[server] authRoutes not mounted', e && e.message);
}

// mount other routes (rooms, admin, games) - keep existing mounting
try {
  const adminRoutes = require('./routes/adminRoutes');
  app.use('/api/admin', adminRoutes);
} catch (e) { console.warn('[server] adminRoutes not mounted', e && e.message); }

try {
  const roomRoutes = require('./routes/roomRoutes');
  app.use('/api/room', roomRoutes);
} catch (e) { /* ignore */ }

try {
  const gameRoutes = require('./routes/gameRoutes');
  app.use('/api/games', gameRoutes);
} catch (e) { /* ignore */ }

// mount debug routes
try {
  const debugRoutes = require('./routes/debugRoutes');
  app.use('/api/debug', debugRoutes);
  console.log('[server] debugRoutes mounted at /api/debug');
} catch(e){ console.warn('debugRoutes not mounted', e && e.message); }

// health endpoints
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/_status', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'dev' }));

// error handler
app.use((err, req, res, next) => {
  console.error('[server] unhandled error', err && err.stack);
  if (!res.headersSent) res.status(500).json({ ok: false, message: 'Internal server error' });
});

// Khởi tạo socket server (thay đổi: truyền app để tích hợp)
const server = require('http').createServer(app);
socketServer(server); // Gọi socketServer với server HTTP

// handle uncaught errors
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException', err && err.stack);
  process.exit(1);
});

// after all app.use(...) calls add:
setTimeout(()=> {
  try {
    const routes = [];
    app._router.stack.forEach(m => {
      if (m.route && m.route.path) {
        const methods = Object.keys(m.route.methods).join(',').toUpperCase();
        routes.push(`${methods} ${m.route.path}`);
      } else if (m.name === 'router' && m.handle && m.handle.stack) {
        m.handle.stack.forEach(r => {
          if (r.route && r.route.path) {
            const methods = Object.keys(r.route.methods).join(',').toUpperCase();
            routes.push(`${methods} ${r.route.path}  (parent mount: ${m.regexp})`);
          }
        });
      }
    });
    console.log('[server] registered routes:\n' + routes.join('\n'));
  } catch(e){ console.warn('list routes failed', e); }
}, 500);

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;