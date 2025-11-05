require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const FRONTEND = process.env.FRONTEND_URL || '*';

// allow CORS for express routes and socket.io polling XHR
app.use(cors({ origin: FRONTEND, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static and routes (keep your existing mounts)
app.use(express.static(path.join(__dirname, 'public')));

console.log('[server] NODE_ENV=', process.env.NODE_ENV);
console.log('[server] FRONTEND_URL=', process.env.FRONTEND_URL);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('[server][FATAL] MONGODB_URI not set. Set env var before starting.');
} else {
  console.log('[server] connecting to MongoDB...');
}

// mount routes with try/catch and logs
try { app.use('/api/auth', require('./routes/authRoutes')); console.log('[server] authRoutes mounted at /api/auth'); } catch (e) { console.error('[server] authRoutes not mounted', e && e.message || e); }
try { app.use('/api/room', require('./routes/roomRoutes')); console.log('[server] roomRoutes mounted at /api/room'); } catch (e) { console.error('[server] roomRoutes not mounted', e && e.message || e); }
try { app.use('/api/debug', require('./routes/debugRoutes')); console.log('[server] debugRoutes mounted at /api/debug'); } catch (e) { console.error('[server] debugRoutes not mounted', e && e.message || e); }

// global error handler - đặt sau routes
app.use((err, req, res, next) => {
  console.error('[server][ERROR]', err && (err.stack || err.message));
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
  });
});

module.exports = app;