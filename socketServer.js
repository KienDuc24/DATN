// Attach Socket.IO to the exported HTTP server from server.js
require('dotenv').config();

let io = null;

try {
  const srvModule = require('./server');
  const server = srvModule && srvModule.server;
  if (!server) {
    console.warn('[socketServer] no server export found in ./server — skipping socket attach');
    module.exports = null;
    return;
  }

  const { Server } = require('socket.io');

  // allowed origins from env (frontend + api)
  const origins = [];
  if (process.env.FRONTEND_URL) origins.push(process.env.FRONTEND_URL);
  if (process.env.BASE_API_URL) origins.push(process.env.BASE_API_URL);

  io = new Server(server, {
    cors: {
      origin: (origin, cb) => {
        // allow non-browser clients (no origin) and vercel previews + configured origins
        if (!origin) return cb(null, true);
        if (origins.includes(origin)) return cb(null, true);
        if (typeof origin === 'string' && origin.includes('.vercel.app')) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  console.log('[socketServer] io created');

  // simple room player tracking
  const rooms = new Map(); // roomCode => { socketId: { name, joinedAt } }

  io.on('connection', (socket) => {
    console.log('[socket] connected', socket.id, 'origin=', socket.handshake.headers.origin || 'n/a');

    // reuseable handlers so we can accept multiple event names (compat)
    function handleJoin({ code, username } = {}) {
      try {
        if (!code) return socket.emit('error', { message: 'missing room code' });
        const roomCode = String(code).toUpperCase();
        socket.join(roomCode);
        const r = rooms.get(roomCode) || {};
        r[socket.id] = { name: username || `guest_${socket.id.slice(0,6)}`, joinedAt: Date.now() };
        rooms.set(roomCode, r);

        const players = Object.values(r).map(p => p.name);
        io.to(roomCode).emit('room:players', { players });
        console.log('[socket] joinRoom', socket.id, roomCode, username, 'players=', players);

        // khi join
        socket.emit('join-room', { code: roomCode, username });
        // also emit camelCase for compatibility
        socket.emit('joinRoom', { code: roomCode, username });
      } catch (e) { console.error('[socket] joinRoom err', e && e.message); }
    }

    function handleLeave({ code } = {}) {
      try {
        const roomCode = code && String(code).toUpperCase();
        if (!roomCode) return;
        socket.leave(roomCode);
        const r = rooms.get(roomCode) || {};
        delete r[socket.id];
        if (Object.keys(r).length === 0) rooms.delete(roomCode); else rooms.set(roomCode, r);
        io.to(roomCode).emit('room:players', { players: Object.values(r).map(p => p.name) });
        console.log('[socket] leaveRoom', socket.id, roomCode);

        // khi leave
        socket.emit('leave-room', { code: roomCode });
        // also
        socket.emit('leaveRoom', { code: roomCode });
      } catch (e) { console.error('[socket] leaveRoom err', e && e.message); }
    }

    // register both styles for compat
    socket.on('joinRoom', handleJoin);
    socket.on('join-room', handleJoin);
    socket.on('leaveRoom', handleLeave);
    socket.on('leave-room', handleLeave);

    socket.on('room:getPlayers', ({ code } = {}) => {
      const roomCode = code && String(code).toUpperCase();
      const r = rooms.get(roomCode) || {};
      socket.emit('room:players', { players: Object.values(r).map(p => p.name) });
    });

    socket.on('disconnect', (reason) => {
      try {
        rooms.forEach((r, code) => {
          if (r[socket.id]) {
            console.log('[socket] disconnect remove', socket.id, 'from', code, 'reason=', reason);
            delete r[socket.id];
            if (Object.keys(r).length === 0) rooms.delete(code); else rooms.set(code, r);
            io.to(code).emit('room:players', { players: Object.values(r).map(p => p.name) });
          }
        });
      } catch (e) { console.error('[socket] disconnect err', e && e.message); }
    });
  });

  // load game-specific socket handlers (if any)
  try {
    const tod = require('./games/ToD/todSocket');
    if (typeof tod === 'function') tod(io);
    else if (tod && typeof tod.init === 'function') tod.init(io);
    else console.debug('[socketServer] todSocket loaded but no init function');
  } catch (e) {
    console.debug('[socketServer] no ToD socket hook or failed to load:', e.message);
  }

  console.log('[socketServer] io attached');
} catch (err) {
  console.error('[socketServer] failed to attach io:', err && (err.stack || err.message));
}

module.exports = io;

