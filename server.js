require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// route modules
const adminAuthRouter = require('./routes/adminAuth');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const gameRoutes = require('./routes/gameRoutes');
const debugRoutes = require('./routes/debugRoutes');

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

// --- middleware: body parsers and cookie parser (before CORS and routes) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS - allow frontend origin(s) and credentials
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || process.env.FRONTEND || 'http://localhost:3000';
const BASE_API_URL = process.env.BASE_API_URL || process.env.BASE_URL || '';
const EXTRA = process.env.ADDITIONAL_ALLOWED_ORIGINS ? process.env.ADDITIONAL_ALLOWED_ORIGINS.split(',') : [];
const allowedOrigins = [FRONTEND_ORIGIN, BASE_API_URL, ...EXTRA].filter(Boolean);

// debug log để kiểm tra env/runtime
console.log('[server] FRONTEND_ORIGIN=', FRONTEND_ORIGIN);
console.log('[server] BASE_API_URL=', BASE_API_URL);
console.log('[server] allowedOrigins=', allowedOrigins);

// log origin của từng request (giúp debug)
app.use((req, res, next) => {
  if (req.headers && req.headers.origin) {
    console.log('[CORS] incoming origin:', req.headers.origin, req.method, req.path);
  }
  next();
});

// cors options: nếu allowedOrigins rỗng -> echo origin (cho phép dynamic origins)
// note: echoing origin is acceptable if you want to accept cross-site cookies and you trust callers
const corsOptions = {
  origin: function (origin, callback) {
    // allow non-browser requests (no origin)
    if (!origin) return callback(null, true);
    // if allowedOrigins defined and not empty, check membership
    if (allowedOrigins.length > 0) {
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
      console.warn('[CORS] blocked origin:', origin);
      return callback(new Error('CORS not allowed by server'), false);
    }
    // fallback: allow and echo origin (makes Access-Control-Allow-Origin explicit)
    return callback(null, origin);
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// enable CORS and preflight handling
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight for all routes

// serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// mount API routes under /api
app.use('/api', adminAuthRouter);
app.use('/api', adminRoutes);
app.use('/api', gameRoutes);
app.use('/api', roomRoutes);

// other routes
app.use('/auth', authRoutes);
app.use('/debug', debugRoutes);

// serve admin pages
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// basic 404 for unknown API/admin paths
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
    return res.status(404).send(`Cannot ${req.method} ${req.path}`);
  }
  next();
});

// global error handler (CORS friendly)
app.use((err, req, res, next) => {
  if (err && err.message && err.message.indexOf('CORS') !== -1) {
    console.warn('[server] CORS error:', err.message);
    return res.status(403).json({ ok: false, message: 'CORS blocked: origin not allowed' });
  }
  console.error('[server] unhandled error', err && err.stack || err);
  next(err);
});

// start server
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});

// Note: removed axios import and example client calls to avoid running HTTP requests from server process.