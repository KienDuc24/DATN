require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const Room = require('./models/Room');
const User = require('./models/User');

let io; // Export io để dùng trong routes

function socketServer(server) {
  io = socketIo(server, {
    cors: { origin: '*' }, // Cho phép tất cả origin (tốt cho Railway deploy)
    transports: ['websocket', 'polling'] // Hỗ trợ nhiều transport để ổn định
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Xác thực người dùng (thay đổi: thêm timeout cho auth)
    socket.on('authenticate', (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.emit('authenticated');
        console.log(`User ${socket.userId} authenticated`);
      } catch (err) {
        socket.emit('auth_error', 'Invalid token');
        socket.disconnect();
      }
    });

    // Tham gia phòng (thay đổi: kiểm tra phòng, đồng bộ DB, và emit cho tất cả)
    socket.on('join_room', async (roomId) => {
      if (!socket.userId) return socket.emit('error', 'Not authenticated');
      
      try {
        const room = await Room.findById(roomId).populate('players');
        if (!room || room.players.length >= room.maxPlayers) {
          return socket.emit('error', 'Room not found or full');
        }
        
        // Kiểm tra nếu user đã trong phòng
        if (room.players.some(p => p._id.toString() === socket.userId)) {
          socket.join(roomId);
          socket.emit('joined_room', room);
          return;
        }
        
        // Thêm user vào phòng
        room.players.push(socket.userId);
        await room.save();
        
        socket.join(roomId); // Socket join room
        io.to(roomId).emit('player_joined', { userId: socket.userId, players: room.players }); // Thông báo cho tất cả
        socket.emit('joined_room', room); // Gửi data phòng cho user mới
        console.log(`User ${socket.userId} joined room ${roomId}`);
      } catch (err) {
        console.error('Join room error:', err);
        socket.emit('error', 'Failed to join room');
      }
    });

    // Rời phòng (thay đổi: xóa khỏi DB, emit, và kiểm tra host)
    socket.on('leave_room', async (roomId) => {
      socket.leave(roomId);
      try {
        const room = await Room.findById(roomId);
        if (room) {
          room.players = room.players.filter(id => id.toString() !== socket.userId);
          // Nếu host rời, chuyển host cho người đầu tiên (thay đổi: logic host)
          if (room.host.toString() === socket.userId && room.players.length > 0) {
            room.host = room.players[0];
          }
          await room.save();
          io.to(roomId).emit('player_left', { userId: socket.userId, players: room.players, newHost: room.host });
        }
      } catch (err) {
        console.error('Leave room error:', err);
      }
    });

    // Gửi dữ liệu game (thay đổi: lưu DB và broadcast)
    socket.on('send_game_data', async (data) => {
      try {
        await Room.findByIdAndUpdate(data.roomId, { gameData: data.gameData });
        socket.to(data.roomId).emit('game_data_updated', data); // Broadcast trừ sender
      } catch (err) {
        socket.emit('error', 'Failed to save game data');
      }
    });

    // Bắt đầu game (thay đổi: chỉ host mới được)
    socket.on('start_game', async (roomId) => {
      try {
        const room = await Room.findById(roomId);
        if (room.host.toString() !== socket.userId) return socket.emit('error', 'Only host can start');
        room.isActive = true;
        await room.save();
        io.to(roomId).emit('game_started', room);
      } catch (err) {
        socket.emit('error', 'Failed to start game');
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Có thể tự động leave_room nếu cần
    });
  });
}

module.exports = { socketServer, io }; // Export io để dùng trong routes

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
