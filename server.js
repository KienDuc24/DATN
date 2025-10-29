require('dotenv').config();

const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();

/* ----------------- MongoDB ----------------- */
(async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/datn';
  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('[server] MongoDB connected');
  } catch (err) {
    console.error('[server] MongoDB connection error:', err && err.message);
    // don't throw so server can still run (adjust if you prefer fail-fast)
  }
})();

/* ----------------- Middleware ----------------- */
// body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // enable cookie parsing

// JSON parse error handler — must be after body parsers
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && 'body' in err)) {
    console.warn('[server] body parse failed:', err.message, 'from', req.ip, req.headers.origin);
    return res.status(400).json({ ok: false, message: 'Invalid JSON payload' });
  }
  next(err);
});

// CORS config
// replace CORS origin check with allow for vercel previews
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || '';
const BASE_API_URL = process.env.BASE_API_URL || '';
const extra = process.env.ADDITIONAL_ALLOWED_ORIGINS ? process.env.ADDITIONAL_ALLOWED_ORIGINS.split(',') : [];
const allowedOrigins = [FRONTEND_ORIGIN, BASE_API_URL, ...extra].filter(Boolean);

app.use((req, res, next) => {
  if (req.headers && req.headers.origin) console.log('[CORS] incoming origin:', req.headers.origin, req.method, req.path);
  next();
});

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser tools
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (origin.includes('.vercel.app')) return cb(null, true); // allow vercel preview domains
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
}));
app.options('*', cors());

/* ----------------- Static + Routes ----------------- */
app.use(express.static(path.join(__dirname, 'public')));

// --- MOUNT API ROUTES HERE (ensure mounted BEFORE API 404) ---
try { app.use('/api', require('./routes/authRoutes')); } catch (e) { console.warn('[server] authRoutes load failed:', e.message); }
try { app.use('/api', require('./routes/adminAuth')); } catch (e) { console.warn('[server] adminAuth load failed:', e.message); }
try { app.use('/api', require('./routes/gameRoutes')); } catch (e) { console.warn('[server] gameRoutes load failed:', e.message); }
try { app.use('/api', require('./routes/roomRoutes')); } catch (e) { console.warn('[server] roomRoutes load failed:', e.message); }

// keep other mounts that are not under /api
try { app.use('/auth', require('./routes/authRoutes')); } catch (e) { console.warn('[server] authRoutes load failed:', e.message); }
try { app.use('/debug', require('./routes/debugRoutes')); } catch (e) { console.warn('[server] debugRoutes load failed:', e.message); }
try { app.use('/admin', require('./routes/adminRoutes')); } catch (e) { console.warn('[server] adminRoutes load failed:', e.message); }

// admin pages (static)
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

/* ----------------- 404 + Error handler ----------------- */
// API 404 — stays after routes are mounted
app.use('/api/*', (req, res) => res.status(404).json({ ok: false, message: 'Not Found' }));

// global error handler
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    console.warn('[server] CORS error:', err.message);
    return res.status(403).json({ ok: false, message: 'CORS blocked: origin not allowed' });
  }
  console.error('[server] unhandled error', err && (err.stack || err));
  res.status(500).json({ ok: false, message: 'Internal Server Error' });
});

app.use('/api/room', roomRoutes);

/* ----------------- SPA fallback + start ----------------- */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log('[server] FRONTEND_URL=', FRONTEND_ORIGIN);
  console.log('[server] BASE_API_URL=', BASE_API_URL);
  console.log('[server] allowedOrigins=', allowedOrigins);
  console.log(`[server] listening on port ${PORT}`);
});

module.exports = { app, server };

