const { Server } = require("socket.io");

// Nếu deploy, nên dùng process.env.PORT hoặc fallback 3000
const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
  cors: {
    origin: "https://https://datn-smoky.vercel.app", // 👈 frontend domain Vercel của bạn
    methods: ["GET", "POST"]
  }
});

let rooms = {}; // { [roomCode]: [ { name, socketId } ] }

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("join-room", ({ roomCode, player }) => {
    socket.join(roomCode);
    console.log(`👤 ${player} joined room ${roomCode}`);

    if (!rooms[roomCode]) rooms[roomCode] = [];
    rooms[roomCode].push({ name: player, socketId: socket.id });

    io.to(roomCode).emit("update-players", rooms[roomCode].map(p => p.name));
  });

  socket.on("leave-room", ({ roomCode, player }) => {
    if (rooms[roomCode]) {
      rooms[roomCode] = rooms[roomCode].filter(p => p.name !== player);
      if (rooms[roomCode].length === 0) {
        delete rooms[roomCode];
        console.log(`🧹 Room ${roomCode} deleted (empty)`);
      } else {
        io.to(roomCode).emit("update-players", rooms[roomCode].map(p => p.name));
      }
    }
    socket.leave(roomCode);
  });

  socket.on("start-game", ({ roomCode }) => {
    console.log(`🚀 Game started in room ${roomCode}`);
    io.to(roomCode).emit("game-started");
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    for (const roomCode in rooms) {
      const index = rooms[roomCode].findIndex(p => p.socketId === socket.id);
      if (index !== -1) {
        const player = rooms[roomCode][index].name;
        rooms[roomCode].splice(index, 1);
        console.log(`👋 ${player} left room ${roomCode} via disconnect`);

        if (rooms[roomCode].length === 0) {
          delete rooms[roomCode];
          console.log(`🧹 Room ${roomCode} deleted (empty)`);
        } else {
          io.to(roomCode).emit("update-players", rooms[roomCode].map(p => p.name));
        }
        break;
      }
    }
  });
});

console.log(`🚀 Socket.io server running on port ${PORT}`);
