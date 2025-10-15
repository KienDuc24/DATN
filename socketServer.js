const { Server } = require("socket.io");
const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
  cors: {
    origin: ['https://datn-smoky.vercel.app'],
    methods: ['GET', 'POST']
  }
});

// Tách phòng theo game
let rooms = {}; // { [gameName]: { [roomCode]: [ { name, socketId } ] } }

io.on("connection", (socket) => {
  socket.on("join-room", ({ gameName, roomCode, player }) => {
    if (!rooms[gameName]) rooms[gameName] = {};
    if (!rooms[gameName][roomCode]) rooms[gameName][roomCode] = [];
    socket.join(`${gameName}:${roomCode}`);
    if (!rooms[gameName][roomCode].some(p => p.socketId === socket.id)) {
      rooms[gameName][roomCode].push({ name: player, socketId: socket.id });
    }
    console.log(`[${new Date().toISOString()}] [${gameName}] Room ${roomCode} now has:`, rooms[gameName][roomCode].map(p => p.name));
    io.to(`${gameName}:${roomCode}`).emit("update-players", {
      list: rooms[gameName][roomCode].map(p => p.name),
      host: rooms[gameName][roomCode][0]?.name
    });
  });

  socket.on("leave-room", ({ gameName, roomCode, player }) => {
    if (rooms[gameName] && rooms[gameName][roomCode]) {
      rooms[gameName][roomCode] = rooms[gameName][roomCode].filter(p => p.name !== player);
      if (rooms[gameName][roomCode].length === 0) {
        delete rooms[gameName][roomCode];
        if (Object.keys(rooms[gameName]).length === 0) delete rooms[gameName];
      } else {
        io.to(`${gameName}:${roomCode}`).emit("update-players", {
          list: rooms[gameName][roomCode].map(p => p.name),
          host: rooms[gameName][roomCode][0]?.name
        });
      }
    }
    socket.leave(`${gameName}:${roomCode}`);
  });

  socket.on("disconnect", () => {
    for (const gameName in rooms) {
      for (const roomCode in rooms[gameName]) {
        const idx = rooms[gameName][roomCode].findIndex(p => p.socketId === socket.id);
        if (idx !== -1) {
          rooms[gameName][roomCode].splice(idx, 1);
          if (rooms[gameName][roomCode].length === 0) {
            delete rooms[gameName][roomCode];
            if (Object.keys(rooms[gameName]).length === 0) delete rooms[gameName];
          } else {
            io.to(`${gameName}:${roomCode}`).emit("update-players", {
              list: rooms[gameName][roomCode].map(p => p.name),
              host: rooms[gameName][roomCode][0]?.name
            });
          }
          return;
        }
      }
    }
  });
});

console.log(`🚀 Socket.io server running on port ${PORT}`);
