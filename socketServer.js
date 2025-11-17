// socketServer.js (ĐÃ SỬA ĐƯỜNG DẪN)

const { Server } = require('socket.io');
const Room = require('./models/Room');
const User = require('./models/User'); 

// --- SỬA ĐƯỜNG DẪN Ở ĐÂY ---
const todHandler = require('./socket_handlers/todSocket.js'); 
const drawGuessHandler = require('./socket_handlers/drawSocket.js'); 
// ----------------------------

const socketUserMap = new Map();

// --- HÀM HELPER XỬ LÝ RỜI PHÒNG (Giữ nguyên) ---
async function handlePlayerLeave(socketId, io) {
  const userInfo = socketUserMap.get(socketId);
  if (!userInfo) return; 

  const { player, code } = userInfo;
  socketUserMap.delete(socketId);

  try {
    const room = await Room.findOne({ code });
    if (!room) return;

    if (room.status === 'playing') {
      console.log(`[SocketServer] Player ${player} left lobby to join game. No changes made.`);
      return; 
    }

    let newHost = room.host;
    const wasHost = (room.host === player);

    room.players = room.players.filter(p => p.name !== player);

    if (room.players.length === 0 && room.status === 'open') {
      room.status = 'closed';
      console.log(`[SocketServer] Empty lobby room ${code} set to 'closed'.`);
    }

    if (wasHost && room.players.length > 0) {
      newHost = room.players[0].name;
      room.host = newHost;
      console.log(`[SocketServer] Host ${player} left lobby. New host is ${newHost}.`);
    }

    await room.save();

    if (!player.startsWith('guest_')) {
        await User.findOneAndUpdate({ username: player }, { status: 'online' });
        io.emit('admin-user-status-changed');
    }

    io.emit('admin-rooms-changed'); // Cập nhật admin
    io.to(code).emit('update-players', { 
      list: room.players.map(p => p.name), 
      host: newHost
    });
  } catch (err) {
    console.error('[SocketServer] handlePlayerLeave error:', err.message);
  }
}
// ------------------------------------


module.exports = function attachSocket(server) {
  const io = new Server(server, {
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    cors: {
      origin: process.env.FRONTEND_URL || 'https://datn-smoky.vercel.app',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {

    // --- LOGIC PHÒNG CHỜ (LOBBY) ---
    socket.on('joinRoom', async ({ code, gameId, user }) => {
      try {
        const room = await Room.findOne({ code, 'game.gameId': gameId }).exec();
        if (!room) {
          socket.emit('room-error', { message: 'Room not found or game mismatch' });
          return;
        }

        if (room.status === 'playing' || room.status === 'closed') {
          socket.emit('room-error', { message: 'Phòng này đã bắt đầu hoặc đã đóng.' });
          return;
        }

        const name = user || `guest_${Math.random().toString(36).slice(2, 8)}`;
        const exists = room.players.some(p => p.name === name);
        if (!exists) {
          room.players.push({ name });
          room.status = 'open'; 
          await room.save();
          io.emit('admin-rooms-changed'); 
        }

        socket.join(code);
        socketUserMap.set(socket.id, { player: name, code: code });

        if (!name.startsWith('guest_')) {
            await User.findOneAndUpdate({ username: name }, { status: 'playing' });
            io.emit('admin-user-status-changed');
        }

        io.to(code).emit('update-players', { list: room.players.map(p => p.name), host: room.host?.username || room.host });

      } catch (err) {
        console.error('[socketServer] joinRoom error:', err.message);
        socket.emit('room-error', { message: 'Internal server error' });
      }
    });

    socket.on('leaveRoom', async ({ code, player }) => {
      socket.leave(code);
      await handlePlayerLeave(socket.id, io);
    });

    socket.on('kickPlayer', async ({ code, playerToKick }) => {
      const kickerInfo = socketUserMap.get(socket.id);
      if (!kickerInfo || kickerInfo.code !== code) return;
      const kickerName = kickerInfo.player;
      try {
        const room = await Room.findOne({ code });
        if (!room || room.host !== kickerName) return;
        if (kickerName === playerToKick) return;
        room.players = room.players.filter(p => p.name !== playerToKick);
        await room.save();

        let kickedSocketId = null;
        for (const [id, info] of socketUserMap.entries()) {
          if (info.player === playerToKick && info.code === code) {
            kickedSocketId = id;
            break;
          }
        }
        if (kickedSocketId) {
          io.to(kickedSocketId).emit('kicked');
          const kickedSocket = io.sockets.sockets.get(kickedSocketId);
          if (kickedSocket) kickedSocket.leave(code);
          socketUserMap.delete(kickedSocketId);

          if (!playerToKick.startsWith('guest_')) {
              await User.findOneAndUpdate({ username: playerToKick }, { status: 'online' });
              io.emit('admin-user-status-changed');
          }
        }

        io.emit('admin-rooms-changed'); 
        io.to(code).emit('update-players', {
          list: room.players.map(p => p.name),
          host: room.host
        });
      } catch (err) {
        console.error('[SocketServer] kickPlayer error:', err.message);
      }
    });

    socket.on('startGame', async ({ code }) => {
      try {
        const room = await Room.findOne({ code }).exec();
        if (!room) return; 

        room.status = 'playing';
        await room.save();
        io.emit('admin-rooms-changed'); 

        const playerNames = room.players.map(p => p.name).filter(name => !name.startsWith('guest_'));
        if (playerNames.length > 0) {
          await User.updateMany(
            { username: { $in: playerNames } },
            { $push: { playHistory: { gameId: room.game.gameId, gameName: room.game.type, playedAt: new Date() } } }
          );
          io.emit('admin-users-changed'); 
          console.log(`[History] Updated history for users: ${playerNames.join(', ')}`);
        }

        const gameId = room.game.gameId;
        console.log(`[SocketServer] Redirecting room ${code} to game ${gameId}`);
        io.to(code).emit('game-started', { gameId: gameId });
      } catch (err) {
        console.error('[SocketServer] startGame error:', err.message);
      }
    });

    // --- LOGIC TRONG GAME (Gắn handler của game) ---
    todHandler(socket, io); 
    drawGuessHandler(socket, io); 

    // --- LOGIC DISCONNECT (Chung) ---
    socket.on('disconnect', async () => {
      console.log(`[socketServer] client ${socket.id} disconnected`);
      await handlePlayerLeave(socket.id, io);
    });
  });

  return io;
};