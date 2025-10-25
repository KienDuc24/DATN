require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// route modules
const adminAuthRouter = require('./routes/adminAuth');    // defines POST /admin/login, /admin/logout
const adminApiRouter = require('./routes/adminRoutes');   // defines /users, /rooms, /games ...
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const gameRoutes = require('./routes/gameRoutes');
const debugRoutes = require('./routes/debugRoutes');

// connect to MongoDB
(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/datn';
  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('[server] MongoDB connected');
  } catch (err) {
    console.error('[server] MongoDB connection error', err && err.message);
  }
})();

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use((req,res,next)=>{
  console.log('REQ', req.method, req.originalUrl);
  next();
});

// serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// mount API routes
// adminAuthRouter uses paths like /admin/login so mounting under /api makes endpoint /api/admin/login
app.use('/api', adminAuthRouter);

// adminApiRouter defines routes like router.get('/users') etc. Mount under /api so endpoints become /api/users, /api/rooms, /api/games
app.use('/api', adminApiRouter);

// nếu routes/adminRoutes.js export router với các đường dẫn như '/users', '/game'...
const adminRoutes = require('./routes/adminRoutes');
// mount nó dưới /api để frontend admin (admin.js) gọi /api/...
app.use('/api', adminRoutes);

// other app routes
app.use('/api', gameRoutes);
app.use('/api', roomRoutes);
app.use('/auth', authRoutes);
app.use('/debug', debugRoutes);

// serve admin pages
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// basic 404 for unknown API paths
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
    return res.status(404).send(`Cannot ${req.method} ${req.path}`);
  }
  next();
});

// start server
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});