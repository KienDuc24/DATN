require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors'); // Thêm để hỗ trợ CORS cho socket
// const socketServer = require('./socketServer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*', // production: set FRONTEND_URL = https://datn-smoky.vercel.app
    credentials: true,
    methods: ['GET','POST','PUT','DELETE','OPTIONS']
};
app.use(cors(corsOptions)); // Cho phép cross-origin cho socket
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// serve static public
app.use(express.static(path.join(__dirname, 'public')));

console.log('[server] NODE_ENV=', process.env.NODE_ENV);
console.log('[server] FRONTEND_URL=', process.env.FRONTEND_URL);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('[server][FATAL] MONGODB_URI not set. Set env var before starting.');
} else {
  console.log('[server] connecting to MongoDB...');
  mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, maxPoolSize: 10 })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('[server] MongoDB connection error:', err && err.stack || err));
}

// mount routes with try/catch and logs
try { app.use('/api/auth', require('./routes/authRoutes')); console.log('[server] authRoutes mounted at /api/auth'); } catch (e) { console.error('[server] authRoutes not mounted', e && e.message || e); }
try { app.use('/api/room', require('./routes/roomRoutes')); console.log('[server] roomRoutes mounted at /api/room'); } catch (e) { console.error('[server] roomRoutes not mounted', e && e.message || e); }
try { app.use('/api/debug', require('./routes/debugRoutes')); console.log('[server] debugRoutes mounted at /api/debug'); } catch (e) { console.error('[server] debugRoutes not mounted', e && e.message || e); }

// error handler
app.use((err, req, res, next) => { console.error('[server][ERR-MW]', err && err.stack || err); res.status(500).json({ error: 'Internal Server Error' }); });

module.exports = app;