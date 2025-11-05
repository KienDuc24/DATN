require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
let ioInstance = null;

let jwt;
try {
  jwt = require('jsonwebtoken');
} catch (e) {
  console.warn('[socketServer] jsonwebtoken not installed - socket auth disabled');
  jwt = null;
}

const Room = require('./models/Room');
const User = require('./models/User');

function socketServer(server) {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: process.env.FRONTEND_URL || '*' },
    transports: ['websocket', 'polling']
  });

  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('[socket] connected', socket.id);

    socket.on('authenticate', (token) => {
      if (!jwt) {
        socket.emit('auth_error', 'Auth module missing');
        return;
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.emit('authenticated');
      } catch (err) {
        socket.emit('auth_error', 'Invalid token');
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
        io.to(roomId).emit('player_joined', { userId: socket.userId, players: room.players });
        socket.emit('joined_room', room);
      } catch (err) {
        console.error('[socket] join_room error', err);
        socket.emit('error', 'Failed to join room');
      }
    });

    socket.on('leave_room', async (roomId) => {
      try {
        socket.leave(roomId);
        const room = await Room.findById(roomId);
        if (!room) return;
        room.players = room.players.filter(id => id.toString() !== socket.userId);
        if (room.host && room.host.toString() === socket.userId) {
          room.host = room.players[0] || null;
        }
        await room.save();
        io.to(roomId).emit('player_left', { userId: socket.userId, players: room.players, newHost: room.host });
      } catch (err) {
        console.error('[socket] leave_room error', err);
      }
    });

    socket.on('send_game_data', async (data) => {
      try {
        await Room.findByIdAndUpdate(data.roomId, { gameData: data.gameData });
        socket.to(data.roomId).emit('game_data_updated', data);
      } catch (err) {
        socket.emit('error', 'Failed to save game data');
      }
    });

    socket.on('disconnect', () => {
      console.log('[socket] disconnected', socket.id);
    });
  });

  return io;
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
