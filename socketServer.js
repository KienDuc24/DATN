require('dotenv').config();
const path = require('path');
const { Server } = require('socket.io');

module.exports = function attachSocket(server) {
  const FRONTEND = process.env.FRONTEND_URL || '*'; // set FRONTEND_URL on Railway to your frontend origin

  const io = new Server(server, {
    path: '/socket.io',
    transports: ['polling', 'websocket'], // allow polling fallback
    cors: {
      origin: FRONTEND,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 30000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log('[socketServer] client connected', socket.id, 'origin=', socket.handshake.headers.origin);
    socket.on('disconnect', (reason) => console.log('[socketServer] client disconnected', socket.id, reason));
    socket.on('connect_error', (err) => console.warn('[socketServer] connect_error', err && err.message));
  });

  return io;
};