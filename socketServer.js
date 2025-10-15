const { Server } = require("socket.io");
// const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
  cors: {
    origin: ['https://datn-smoky.vercel.app'],
    methods: ['GET', 'POST']
  }
});

let rooms = {}; // { [roomCode]: [ { name, socketId } ] }

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomCode, player }) => {
    socket.join(roomCode);
    if (!rooms[roomCode]) rooms[roomCode] = [];
    if (!rooms[roomCode].some(p => p.socketId === socket.id)) {
      rooms[roomCode].push({ name: player, socketId: socket.id });
    }
    console.log(`[${new Date().toISOString()}] Room ${roomCode} now has:`, rooms[roomCode].map(p => p.name));
    io.to(roomCode).emit("update-players", {
      list: rooms[roomCode].map(p => p.name),
      host: rooms[roomCode][0]?.name
    });
  });

  socket.on("leave-room", ({ roomCode, player }) => {
    if (rooms[roomCode]) {
      rooms[roomCode] = rooms[roomCode].filter(p => p.name !== player);
      if (rooms[roomCode].length === 0) {
        delete rooms[roomCode];
      } else {
        io.to(roomCode).emit("update-players", {
          list: rooms[roomCode].map(p => p.name),
          host: rooms[roomCode][0]?.name
        });
      }
    }
    socket.leave(roomCode);
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const idx = rooms[roomCode].findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        rooms[roomCode].splice(idx, 1);
        if (rooms[roomCode].length === 0) {
          delete rooms[roomCode];
        } else {
          io.to(roomCode).emit("update-players", {
            list: rooms[roomCode].map(p => p.name),
            host: rooms[roomCode][0]?.name
          });
        }
        break;
      }
    }
  });
});

console.log(`🚀 Socket.io server running on port ${PORT}`);
