// Attach Socket.IO to the exported HTTP server from server.js
require('dotenv').config();

let io = null;

try {
  // require http server exported by server.js
  const srvModule = require('./server');
  const server = srvModule && srvModule.server;
  if (!server) {
    console.warn('[socketServer] no server export found in ./server — skipping socket attach');
  } else {
    // import Server class from socket.io
    const { Server } = require('socket.io');

    const origins = [];
    if (process.env.FRONTEND_URL) origins.push(process.env.FRONTEND_URL);
    if (process.env.BASE_API_URL) origins.push(process.env.BASE_API_URL);

    io = new Server(server, {
      cors: {
        origin: origins.length ? origins : '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    io.on('connection', (socket) => {
      console.log('[socket] connected', socket.id);
      // simple ping-pong for smoke test
      socket.on('ping', (d) => socket.emit('pong', d));
      // attach game sockets if exist
      socket.on('disconnect', (reason) => {
        console.log('[socket] disconnected', socket.id, reason);
      });
    });

    // optional: try to load game-specific socket handlers
    try {
      const tod = require('./games/ToD/todSocket');
      if (typeof tod === 'function') tod(io);
      else if (tod && typeof tod.init === 'function') tod.init(io);
    } catch (e) {
      console.debug('[socketServer] no ToD socket hook or failed to load:', e.message);
    }

    console.log('[socketServer] io attached');
  }
} catch (err) {
  console.error('[socketServer] failed to attach io:', err && (err.stack || err.message));
}

module.exports = io;
