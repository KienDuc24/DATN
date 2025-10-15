const { Server } = require("socket.io");
const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
  cors: {
    origin: ['https://datn-smoky.vercel.app'],
    methods: ['GET', 'POST']
  }
});

// Quản lý phòng theo roomCode duy nhất
let rooms = {}; // { [roomCode]: { gameName, players: [ { name, socketId } ] } }

io.on("connection", (socket) => {
  socket.on("join-room", ({ gameName, roomCode, player }) => {
    // Nếu phòng chưa tồn tại, tạo mới với gameName
    if (!rooms[roomCode]) {
      rooms[roomCode] = { gameName, players: [] };
    }
    // Nếu phòng đã tồn tại nhưng khác game, không cho join
    if (rooms[roomCode].gameName !== gameName) {
      socket.emit("room-error", { message: "Mã phòng này đã được sử dụng cho game khác!" });
      return;
    }
    socket.join(roomCode);
    if (!rooms[roomCode].players.some(p => p.socketId === socket.id)) {
      rooms[roomCode].players.push({ name: player, socketId: socket.id });
    }
    console.log(`[${new Date().toISOString()}] [${gameName}] Room ${roomCode} now has:`, rooms[roomCode].players.map(p => p.name));
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
});

console.log(`🚀 Socket.io server running on port ${PORT}`);
