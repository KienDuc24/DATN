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

  // identify this process/instance for debugging
  const SERVER_INSTANCE = process.env.INSTANCE_ID || `pid:${process.pid}`;

  // allowed origins from env (frontend + api)
  const origins = [];
  if (process.env.FRONTEND_URL) origins.push(process.env.FRONTEND_URL);
  if (process.env.BASE_API_URL) origins.push(process.env.BASE_API_URL);

  io = new Server(server, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (origins.includes(origin)) return cb(null, true);
        if (typeof origin === 'string' && origin.includes('.vercel.app')) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  console.log(`[socketServer:${SERVER_INSTANCE}] io created`);

  // optionally attach Redis adapter if REDIS_URL present (for multi-instance)
  if (process.env.REDIS_URL) {
    (async () => {
      try {
        const { createAdapter } = require('@socket.io/redis-adapter');
        const { createClient } = require('redis');
        const pubClient = createClient({ url: process.env.REDIS_URL });
        const subClient = pubClient.duplicate();
        await pubClient.connect();
        await subClient.connect();
        io.adapter(createAdapter(pubClient, subClient));
        console.log(`[socketServer:${SERVER_INSTANCE}] redis adapter attached`);
      } catch (e) {
        console.warn(`[socketServer:${SERVER_INSTANCE}] failed to attach redis adapter:`, e && e.message);
      }
    })();
  } else {
    console.log(`[socketServer:${SERVER_INSTANCE}] REDIS_URL not set — using in-memory rooms (not suitable for multi-instance)`);
  }

  // simple room player tracking
  const rooms = new Map(); // roomCode => { socketId: { name, joinedAt } }

  io.on('connection', (socket) => {
    console.log(`[socket:${SERVER_INSTANCE}] connected`, socket.id, 'origin=', socket.handshake.headers.origin || 'n/a');

    // reuseable handlers so we can accept multiple event names (compat)
    function handleJoin({ code, username } = {}) {
      try {
        console.log(`[socket:${SERVER_INSTANCE}] handleJoin recv from ${socket.id}`, { code, username });
        if (!code) return socket.emit('error', { message: 'missing room code' });
        const roomCode = String(code).toUpperCase();
        socket.join(roomCode);
        const r = rooms.get(roomCode) || {};
        r[socket.id] = { name: username || `guest_${socket.id.slice(0,6)}`, joinedAt: Date.now() };
        rooms.set(roomCode, r);

        const players = Object.values(r).map(p => p.name);
        io.to(roomCode).emit('room:players', { players });

        console.log(`[socket:${SERVER_INSTANCE}] joinRoom`, socket.id, roomCode, username, 'players=', players);
        console.log(`[socket:${SERVER_INSTANCE}] rooms[${roomCode}] =`, Object.keys(r).length, Object.values(r).map(x=>x.name));

        // NOTE: keep server-side responsibility to broadcast 'room:players' only.
      } catch (e) { console.error('[socket] joinRoom err', e && e.message); }
    }

    function handleLeave({ code } = {}) {
      try {
        console.log(`[socket:${SERVER_INSTANCE}] handleLeave recv from ${socket.id}`, { code });
        const roomCode = code && String(code).toUpperCase();
        if (!roomCode) return;
        socket.leave(roomCode);
        const r = rooms.get(roomCode) || {};
        delete r[socket.id];
        if (Object.keys(r).length === 0) rooms.delete(roomCode); else rooms.set(roomCode, r);
        io.to(roomCode).emit('room:players', { players: Object.values(r).map(p => p.name) });

        console.log(`[socket:${SERVER_INSTANCE}] leaveRoom`, socket.id, roomCode, 'remaining=', Object.keys(r).length);
        // no additional compatibility emits
      } catch (e) { console.error('[socket] leaveRoom err', e && e.message); }
    }

    // register single canonical event names
    socket.on('joinRoom', handleJoin);
    socket.on('leaveRoom', handleLeave);

    socket.on('room:getPlayers', ({ code } = {}) => {
      const roomCode = code && String(code).toUpperCase();
      const r = rooms.get(roomCode) || {};
      socket.emit('room:players', { players: Object.values(r).map(p => p.name) });
      console.log(`[socket:${SERVER_INSTANCE}] room:getPlayers ${socket.id} -> ${roomCode}`, Object.values(r).map(p=>p.name));
    });

    socket.on('disconnect', (reason) => {
      try {
        rooms.forEach((r, code) => {
          if (r[socket.id]) {
            console.log(`[socket:${SERVER_INSTANCE}] disconnect remove`, socket.id, 'from', code, 'reason=', reason);
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

