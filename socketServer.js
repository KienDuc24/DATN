require('dotenv').config();
const path = require('path');
const { Server } = require('socket.io');

let todSocket = null;
try {
  todSocket = require(path.join(__dirname, 'games', 'ToD', 'todSocket'));
} catch (e) {
  console.warn('[socketServer] optional todSocket not loaded:', e && e.message || e);
}

/**
 * Attach a Socket.IO server to an existing HTTP server.
 * Do NOT create a new HTTP server or call listen() here.
 */
function socketServer(httpServer) {
  if (!httpServer) {
    console.error('[socketServer] No HTTP server provided to attach Socket.IO');
    return;
  }

  if (socketServer._attached) {
    console.log('[socketServer] already attached to an HTTP server');
    return;
  }

  // lấy origin frontend từ env (đã set trên Railway)
  const FRONTEND = process.env.FRONTEND_URL || process.env.BASE_API_URL || '*';

  const io = new Server(httpServer, {
    // path must match client (default '/socket.io')
    path: '/socket.io',
    // allow polling fallback and websocket
    transports: ['websocket', 'polling'],
    cors: {
      origin: Array.isArray(FRONTEND) ? FRONTEND : FRONTEND,
      methods: ['GET', 'POST'],
      credentials: true
    },
    // optional: increase pingTimeout on platforms that may be slow
    pingTimeout: 30000,
    pingInterval: 25000
  });

  socketServer.io = io;
  socketServer._attached = true;

  io.on('connection', (socket) => {
    console.log('[socketServer] client connected', socket.id, 'origin=', socket.handshake.headers.origin);

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
    socket.on('connect_error', (err) => {
      console.warn('[socketServer] client connect_error', err && err.message);
    });
  });

  io.of('/').adapter.on && io.of('/').adapter.on('error', (e)=> console.error('[socketServer] adapter error', e));

  console.log('[socketServer] Socket.IO attached to provided HTTP server');
}

module.exports = { socketServer };