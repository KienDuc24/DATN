require('dotenv').config();
const { server } = require('./server'); // reuse same server
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// rooms management, handlers (reuse existing logic)
let rooms = {};

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

// export io if needed
module.exports = io; // allow graceful close from index.js
