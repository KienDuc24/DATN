require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Room = require('./models/Room');

let ioInstance = null;

function socketServer(httpServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: '*' }, // production: set to your domain
    transports: ['websocket', 'polling']
  });
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on('authenticate', (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.emit('authenticated');
      } catch (e) {
        socket.emit('auth_error');
        socket.disconnect();
      }
    });

    socket.on('join_room', async (roomId) => {
      if (!socket.userId) return socket.emit('error', 'Not authenticated');
      try {
        const room = await Room.findById(roomId);
        if (!room) return socket.emit('error', 'Room not found');
        if (room.players.length >= room.maxPlayers) return socket.emit('error', 'Room full');

        if (!room.players.some(p => p.toString() === socket.userId)) {
          room.players.push(socket.userId);
          await room.save();
        }
        socket.join(roomId);
        io.to(roomId).emit('player_joined', { userId: socket.userId });
      } catch (err) {
        console.error(err);
        socket.emit('error', 'Join failed');
      }
    });

    socket.on('disconnect', () => {
      console.log('socket disconnect', socket.id);
    });
  });
}

function getIO() { return ioInstance; }

module.exports = { socketServer, getIO };

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
