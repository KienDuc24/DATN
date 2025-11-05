require('dotenv').config();
const path = require('path');
const { Server } = require('socket.io');
const Room = require('./models/Room');
const User = require('./models/User');

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

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
  });

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

  console.log('[socketServer] Socket.IO attached to provided HTTP server');
}

module.exports = { socketServer };