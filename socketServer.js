const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*', // hoặc domain FE của bạn
  methods: ['GET', 'POST']
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // hoặc domain FE của bạn
    methods: ['GET', 'POST']
  }
});

// Lắng nghe kết nối socket
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Ví dụ: lắng nghe sự kiện join room
  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    socket.to(roomCode).emit('user-joined', socket.id);
  });

  // Ví dụ: gửi message trong room
  socket.on('send-message', ({ roomCode, message }) => {
    socket.to(roomCode).emit('receive-message', { sender: socket.id, message });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Railway sẽ tự lấy PORT từ biến môi trường
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});