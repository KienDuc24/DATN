const http = require('http');
const app = require('./server'); // hoặc express app nếu có
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: ['https://datn-smoky.vercel.app'],
    methods: ['GET', 'POST']
  }
});

const todSocket = require('./games/ToD/todSocket');

// Quản lý phòng theo roomCode duy nhất, lưu cả gameId
let rooms = {}; // { [roomCode]: { gameId, players: [ { name, socketId } ] } }

io.on("connection", (socket) => {
  console.log('socket connected', socket.id);
  // attach ToD handlers
  try { todSocket(socket, io); } catch (e) { console.error('todSocket attach err', e); }

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

  // Ví dụ trong socketServer.js
  socket.on("start-room", ({ gameId, roomCode, player }) => {
    io.to(roomCode).emit("room-start", { gameId, roomCode, player });
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Socket.io server running on port ${PORT}`));
