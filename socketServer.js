require('dotenv').config();
const path = require('path');
const { Server } = require('socket.io');
const Room = require('./models/Room');
const User = require('./models/User');

let todSocket = null;
try {
  todSocket = require(path.join(__dirname, 'games', 'ToD', 'todSocket'));
} catch (e) {
  // optional handler may not exist — that's fine
  console.warn('[socketServer] optional todSocket not loaded:', e && e.message || e);
}

/**
 * Attach a Socket.IO server to an existing HTTP server.
 * Do NOT create a new http server or call listen() here.
 *
 * Usage in index.js:
 * const { socketServer } = require('./socketServer');
 * socketServer(server);
 */
function socketServer(httpServer) {
  if (!httpServer) {
    console.error('[socketServer] No http server provided to attach socket.io');
    return;
  }

  if (socketServer._attached) {
    console.log('[socketServer] already attached to an http server');
    return;
  }

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true
    }
  });

  // expose for debugging/tests if needed
  socketServer.io = io;
  socketServer._attached = true;

  io.on('connection', (socket) => {
    console.log('[socketServer] client connected', socket.id);

    try {
      if (todSocket && typeof todSocket.init === 'function') {
        todSocket.init(io, socket);
      }
    } catch (err) {
      console.error('[socketServer] error in todSocket.init:', err && err.stack || err);
    }

    socket.on('disconnect', (reason) => {
      console.log('[socketServer] client disconnected', socket.id, reason);
    });
  });

  console.log('[socketServer] Socket.io attached to provided HTTP server');
}

module.exports = { socketServer };

// start express app
const app = express();
// serve public if needed
app.use(express.static(path.join(__dirname, 'public')));

// connect mongodb (try both names)
(async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn('MONGODB_URI not set in .env');
    } else {
      await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log('✅ MongoDB connected');
    }
  } catch (err) {
    console.error('❌ MongoDB connection error', err && err.stack ? err.stack : err);
  }
})();

// Robust startup helpers (insert at very top)
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err && (err.stack || err.message || err));
  // keep logs flush then exit
  setTimeout(()=> process.exit(1), 200);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('[FATAL] unhandledRejection at:', p, 'reason:', reason);
  // optional: don't exit immediately to allow graceful logging
});
process.on('SIGTERM', () => {
  console.warn('[SIGTERM] received, shutting down gracefully');
  try { if (global.__server && typeof global.__server.close === 'function') global.__server.close(); } catch(e){ console.error('shutdown error', e); }
  setTimeout(()=> process.exit(0), 200);
});
process.on('SIGINT', () => {
  console.warn('[SIGINT] received, exiting');
  process.exit(0);
});

const server = http.createServer(app);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});

// no filepath - client socket
const socket = io('https://datn-socket.up.railway.app', { path: '/socket.io', transports: ['websocket'] });
socket.emit('authenticate', token);
