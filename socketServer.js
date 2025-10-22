require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
// serve public if needed
app.use(express.static(path.join(__dirname, 'public')));

// connect mongodb (try both names)
(async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      console.warn('MONGODB_URI / MONGO_URI not set in .env');
    } else {
      await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log('✅ MongoDB connected');
    }
  } catch (err) {
    console.error('❌ MongoDB connection error', err && err.stack ? err.stack : err);
  }
})();

// safe globals
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('SIGTERM', () => {
  console.log('SIGTERM received - shutting down gracefully');
  process.exit(0);
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Quản lý phòng theo roomCode duy nhất, lưu cả gameId
let rooms = {}; // { [roomCode]: { gameId, players: [ { name, socketId } ] } }

io.on("connection", (socket) => {
  console.log('socket connected', socket.id);
  // attach ToD handlers
  try {
    const todHandler = require('./games/ToD/todSocket');
    if (typeof todHandler === 'function') todHandler(socket, io);
    else console.warn('todSocket did not export a function');
  } catch (e) {
    console.error('Error attaching todSocket handler:', e && e.stack ? e.stack : e);
  }

  socket.on("join-room", ({ gameId, roomCode, player }) => {
    // Nếu phòng chưa tồn tại, tạo mới với gameId
    if (!rooms[roomCode]) {
      rooms[roomCode] = { gameId, players: [] };
    }
    // Nếu phòng đã tồn tại nhưng khác gameId, báo lỗi
    if (rooms[roomCode].gameId !== gameId) {
      socket.emit("room-error", { message: "Mã phòng không tồn tại hoặc không phải của game này!" });
      return;
    }
    socket.join(roomCode);
    if (!rooms[roomCode].players.some(p => p.socketId === socket.id)) {
      rooms[roomCode].players.push({ name: player, socketId: socket.id });
    }
    io.to(roomCode).emit("update-players", {
      list: rooms[roomCode].players.map(p => p.name),
      host: rooms[roomCode].players[0]?.name
    });
  });

  socket.on("leave-room", ({ roomCode, player }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].players = rooms[roomCode].players.filter(p => p.name !== player);
      if (rooms[roomCode].players.length === 0) {
        delete rooms[roomCode];
      } else {
        io.to(roomCode).emit("update-players", {
          list: rooms[roomCode].players.map(p => p.name),
          host: rooms[roomCode].players[0]?.name
        });
      }
    }
    socket.leave(roomCode);
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const idx = rooms[roomCode].players.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        rooms[roomCode].players.splice(idx, 1);
        if (rooms[roomCode].players.length === 0) {
          delete rooms[roomCode];
        } else {
          io.to(roomCode).emit("update-players", {
            list: rooms[roomCode].players.map(p => p.name),
            host: rooms[roomCode].players[0]?.name
          });
        }
        break;
      }
    }
  });

  // Host requests start: broadcast to room (NO player name)
  socket.on('start-room', ({ gameFolder, roomCode }) => {
    console.log('[socketServer] start-room from', socket.id, { gameFolder, roomCode });
    io.to(roomCode).emit('room-start', { gameFolder, roomCode }); // NO player name
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
