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

    // allow frontend + vercel previews
    const origins = [];
    if (process.env.FRONTEND_URL) origins.push(process.env.FRONTEND_URL);
    if (process.env.BASE_API_URL) origins.push(process.env.BASE_API_URL);

    io = new Server(server, {
      cors: {
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          if (origins.includes(origin)) return cb(null, true);
          if (origin.includes('.vercel.app')) return cb(null, true);
          return cb(new Error('Not allowed by CORS'));
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // generic connection log
    io.on('connection', (socket) => {
      console.log('[socket] connected', socket.id);
      socket.on('ping', (d) => socket.emit('pong', d));
      socket.on('disconnect', (reason) => console.log('[socket] disconnected', socket.id, reason));
    });

    // load game sockets (pass io)
    try {
      const tod = require('./games/ToD/todSocket');
      if (typeof tod === 'function') tod(io);
      else if (tod && typeof tod.init === 'function') tod.init(io);
      else console.debug('[socketServer] todSocket loaded but no init function');
    } catch (e) {
      console.debug('[socketServer] no ToD socket hook or failed to load:', e.message);
    }

    console.log('[socketServer] io attached');
  }
} catch (err) {
  console.error('[socketServer] failed to attach io:', err && (err.stack || err.message));
}

module.exports = io;

