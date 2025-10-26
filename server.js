require('dotenv').config();

const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();

// connect to MongoDB
(async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/datn';
  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('[server] MongoDB connected');
  } catch (err) {
    console.error('[server] MongoDB connection error', err && err.message);
  }
})();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// JSON parse error handler (immediately after body parsers)
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.warn('[server] body parse failed:', err.message);
    return res.status(400).json({ ok: false, message: 'Invalid JSON payload' });
  }
  // handle generic SyntaxError from bodyParser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.warn('[server] JSON SyntaxError:', err.message);
    return res.status(400).json({ ok: false, message: 'Invalid JSON syntax' });
  }
  next(err);
});

// CORS config
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || process.env.FRONTEND || 'http://localhost:3000';
const BASE_API_URL = process.env.BASE_API_URL || process.env.BASE_URL || '';
const EXTRA = process.env.ADDITIONAL_ALLOWED_ORIGINS ? process.env.ADDITIONAL_ALLOWED_ORIGINS.split(',') : [];
const allowedOrigins = [FRONTEND_ORIGIN, BASE_API_URL, ...EXTRA].filter(Boolean);

console.log('[server] FRONTEND_URL=', FRONTEND_ORIGIN);
console.log('[server] BASE_API_URL=', BASE_API_URL);
console.log('[server] allowedOrigins=', allowedOrigins);

app.use((req, res, next) => {
  if (req.headers && req.headers.origin) {
    console.log('[CORS] incoming origin:', req.headers.origin, req.method, req.path);
  }
  next();
});

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser tools
    if (allowedOrigins.length > 0) {
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
      console.warn('[CORS] blocked origin:', origin);
      return callback(new Error('CORS not allowed by server'), false);
    }
    // fallback: echo origin (allow all) — use only if you trust callers
    return callback(null, origin);
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight

// static + routes
app.use(express.static(path.join(__dirname, 'public')));

const adminAuthRouter = require('./routes/adminAuth');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const gameRoutes = require('./routes/gameRoutes');
const debugRoutes = require('./routes/debugRoutes');

app.use('/api', adminAuthRouter); // /api/admin/login, logout, create-first-admin
app.use('/api', adminRoutes);
app.use('/api', gameRoutes);
app.use('/api', roomRoutes);
app.use('/auth', authRoutes);
app.use('/debug', debugRoutes);

// admin pages
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// basic 404 for api/admin paths
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
    return res.status(404).send(`Cannot ${req.method} ${req.path}`);
  }
  next();
});

app.use((err, req, res, next) => {
  if (err && err.message && err.message.indexOf('CORS') !== -1) {
    console.warn('[server] CORS error:', err.message);
    return res.status(403).json({ ok: false, message: 'CORS blocked: origin not allowed' });
  }
  console.error('[server] unhandled error', err && (err.stack || err));
  next(err);
});

// create HTTP server and listen
const PORT = process.env.PORT || 8080;
const server = http.createServer(app);
server.listen(PORT, () => console.log(`[server] listening on port ${PORT}`));

module.exports = { app, server };