// js/socket.js

// Lấy URL từ biến global (nếu có) hoặc dùng origin hiện tại
const SOCKET_URL = window.SOCKET_URL || window.__BASE_API__ || window.location.origin;

// Khởi tạo socket
const socket = (typeof io === 'function') ? io(SOCKET_URL, {
  path: '/socket.io',
  transports: ['polling', 'websocket'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000
}) : null;

if (socket) {
  socket.on('connect', () => {
    console.log('Socket.IO connected:', socket.id);
  });
  socket.on('disconnect', () => {
    console.log('Socket.IO disconnected');
  });
} else {
  console.warn('Socket.IO (io) not found. Socket features will be disabled.');
}

// Export instance
export { socket };