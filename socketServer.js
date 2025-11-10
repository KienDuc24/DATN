const { Server } = require('socket.io');
const Room = require('./models/Room');

module.exports = function attachSocket(server) {
  const io = new Server(server, {
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('[socketServer] client connected', socket.id);

    socket.on('joinRoom', async ({ code, gameId, user }) => {
      try {
        const room = await Room.findOne({ code, 'game.gameId': gameId }).exec();
        if (!room) {
          socket.emit('room-error', { message: 'Room not found or game mismatch' });
          return;
        }

        const name = user || `guest_${Math.random().toString(36).slice(2, 8)}`;
        const exists = room.players.some(p => p.name === name);
        if (!exists) {
          room.players.push({ name });
          await room.save();
        }

        socket.join(code);
        io.to(code).emit('update-players', { list: room.players.map(p => p.name), host: room.host?.username || room.host });
      } catch (err) {
        console.error('[socketServer] joinRoom error:', err.message);
        socket.emit('room-error', { message: 'Internal server error' });
      }
    });

    socket.on('leaveRoom', async ({ code, player }) => {
      try {
        const room = await Room.findOne({ code }).exec();
        if (!room) return;

        room.players = room.players.filter(p => p.name !== player);
        await room.save();

        socket.leave(code);
        io.to(code).emit('update-players', { list: room.players.map(p => p.name), host: room.host?.username || room.host });
      } catch (err) {
        console.error('[socketServer] leaveRoom error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log('[socketServer] client disconnected', socket.id);
    });
  });

  return io;

  socket.on('joinRoom', async ({ code, gameId, user }) => {
  try {
    const room = await Room.findOne({ code, 'game.gameId': gameId }).exec();
    if (!room) {
      socket.emit('room-error', { message: 'Room not found or game mismatch' });
      return;
    }

    const name = user || `guest_${Math.random().toString(36).slice(2, 8)}`;
    const exists = room.players.some(p => p.name === name);
    if (!exists) {
      room.players.push({ name });
      await room.save();
    }

    socket.join(code);
    io.to(code).emit('update-players', { list: room.players.map(p => p.name), host: room.host?.username || room.host });
  } catch (err) {
    console.error('[socketServer] joinRoom error:', err.message);
    socket.emit('room-error', { message: 'Internal server error' });
  }
});
};