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
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// static public
app.use(express.static(path.join(__dirname, 'public')));

// ensure uploads dir (best-effort)
let UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
try {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('[server] ensured uploads dir at', UPLOADS_DIR);
} catch (err) {
  console.warn('[server] could not create uploads dir at public/uploads, fallback to tmp', err && err.message);
  UPLOADS_DIR = os.tmpdir();
}

// serve uploads if possible
try {
  app.use('/uploads', express.static(UPLOADS_DIR));
} catch (e) {
  console.warn('[server] cannot serve uploads dir:', e && e.message);
}

// mount routers (require but will work only after file exists)
try {
  const authRouter = require('./routes/authRoutes');
  app.use('/api', authRouter);
} catch (err) {
  console.warn('[server] authRoutes require failed (will log on route load):', err && err.message);
}
try {
  const gameRoutes = require('./routes/gameRoutes');
  app.use('/api/games', gameRoutes);
} catch (err) {
  console.warn('[server] gameRoutes require failed:', err && err.message);
}
try {
  const roomRoutes = require('./routes/roomRoutes');
  app.use('/api/room', roomRoutes);
} catch (err) {
  console.warn('[server] roomRoutes require failed:', err && err.message);
}

// health
app.get('/health', (req, res) => res.json({ ok: true }));

// global error handler
app.use((err, req, res, next) => {
  console.error('[server] unhandled error', err && err.stack);
  if (!res.headersSent) res.status(500).json({ ok: false, message: 'Internal server error' });
});

// Mongoose connect + start server only after connect (with retries)
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO || process.env.MONGODB;
const PORT = process.env.PORT || 3000;

if (!MONGO_URI) {
  console.error('[server] MONGODB_URI not set. Set it in environment variables and redeploy.');
  // Still start server in read-only mode if you want, or exit:
  // process.exit(1);
  app.listen(PORT, () => {
    console.warn('[server] started WITHOUT MongoDB (read-only). PORT=', PORT);
  });
} else {
  const connectOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // fail fast
    socketTimeoutMS: 45000
  };

  let attempts = 0;
  const maxAttempts = 6;

  (async function connectWithRetry() {
    attempts++;
    console.log(`[server] connecting to MongoDB (attempt ${attempts}/${maxAttempts})...`);
    try {
      await mongoose.connect(MONGO_URI, connectOptions);
      console.log('✅ MongoDB connected');
      app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
    } catch (err) {
      console.error('[server] MongoDB connection error', err && err.message);
      if (attempts < maxAttempts) {
        const delay = Math.min(2000 * attempts, 20000);
        console.log(`[server] retrying connection in ${delay}ms...`);
        setTimeout(connectWithRetry, delay);
      } else {
        console.error('[server] failed to connect to MongoDB after multiple attempts. Exiting.');
        // Option: exit to force redeploy / alert
        process.exit(1);
      }
    }
  })();
}

// handle uncaught errors
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException', err && err.stack);
  process.exit(1);
});

module.exports = app;