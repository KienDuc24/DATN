require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();

// body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true
}));

// MongoDB connection
(async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO || process.env.MONGODB;
    if (!uri) {
      console.warn('MONGODB_URI not set in env');
    } else {
      await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log('✅ MongoDB connected');
    }
  } catch (err) {
    console.error('❌ MongoDB connection error', err);
  }
})();

// Session/passport (kept minimal)
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// serve public
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory or fallback to tmp
let UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
try {
  // try create public/uploads (may fail on serverless)
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('[server] ensured uploads dir at', UPLOADS_DIR);
} catch (err) {
  console.warn('[server] could not create public/uploads, fallback to tmp', err && err.message);
  UPLOADS_DIR = os.tmpdir();
  console.log('[server] using tmp uploads dir:', UPLOADS_DIR);
}

// Serve uploads if it's inside public or if platform allows
try {
  // if UPLOADS_DIR is inside public, it will already be served by express.static above
  if (!UPLOADS_DIR.includes(path.join(__dirname, 'public'))) {
    // attempt to serve tmp dir at /uploads (may not be persistent on serverless platforms)
    app.use('/uploads', express.static(UPLOADS_DIR));
    console.log('[server] serving uploads from', UPLOADS_DIR);
  } else {
    console.log('[server] uploads available under /uploads');
  }
} catch (err) {
  console.warn('[server] unable to serve uploads dir:', err && err.message);
}

// Mount routers (ensure routes files export routers)
try {
  const authRouter = require('./routes/authRoutes');
  app.use('/api', authRouter);
} catch (err) {
  console.error('[server] failed to mount authRoutes', err && err.message);
}

try {
  const gameRoutes = require('./routes/gameRoutes');
  app.use('/api/games', gameRoutes);
} catch (err) {
  console.warn('[server] gameRoutes not mounted:', err && err.message);
}

try {
  const roomRoutes = require('./routes/roomRoutes');
  app.use('/api/room', roomRoutes);
} catch (err) {
  console.warn('[server] roomRoutes not mounted:', err && err.message);
}

// basic health check
app.get('/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'dev' }));

// fallback to index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// error handler (log)
app.use((err, req, res, next) => {
  console.error('[server] unhandled error', err && err.stack);
  if (!res.headersSent) res.status(500).json({ ok: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server listening on', PORT);
});

module.exports = app;