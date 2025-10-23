require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
// require route modules
const adminAuthRouter = require('./routes/adminAuth');    // handles POST /admin/login (router uses /admin/...)
const adminApiRouter = require('./routes/adminRoutes');   // handles /users, /rooms, /games (expect mount at /api/admin)

const app = express();

// body parsers + cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// serve static public
app.use(express.static(path.join(__dirname, 'public')));

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

// mount admin auth under /api so POST goes to /api/admin/login
app.use('/api', adminAuthRouter);

// mount admin API under /api/admin -> endpoints become /api/admin/users, /api/admin/rooms, ...
app.use('/api/admin', adminApiRouter);

// serve admin-login page on GET /admin/login (optional)
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// optionally serve admin dashboard at /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// mount other routes (rooms, admin, games) - keep existing mounting
try {
  const roomRoutes = require('./routes/roomRoutes');
  app.use('/api/room', roomRoutes);
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

// Mongoose connect + start server only after connect (with retries)
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO || process.env.MONGODB;
const PORT = process.env.PORT || 3000;

if (!MONGO_URI) {
  console.error('[server] MONGODB_URI not set. Starting server in read-only mode.');
  app.listen(PORT, () => {
    console.warn('[server] started WITHOUT MongoDB (read-only). PORT=', PORT);
  });
} else {
  const connectOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
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

// admin login route
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// optional: serve admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

module.exports = app;