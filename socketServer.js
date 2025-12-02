const { Server } = require('socket.io');
const Room = require('./models/Room');
const User = require('./models/User'); 

const todHandler = require('./public/game/ToD/todSocket.js'); 
const drawGuessHandler = require('./public/game/Draw/drawSocket.js'); 
const ticTacToeHandler = require('./public/game/TicTacToe/tictactoeSocket.js');
const triviaHandler = require('./public/game/Trivia/triviaSocket.js');

const socketUserMap = new Map();

async function handlePlayerLeave(socketId, io) {
  const userInfo = socketUserMap.get(socketId);
  if (!userInfo) return; 

  const { player, code } = userInfo;
  socketUserMap.delete(socketId);

  try {
    const room = await Room.findOne({ code });
    if (!room) return;

    if (room.status === 'playing') {
      console.log(`[SocketServer] Player ${player} left session, status is 'playing'.`);
      return; 
    }

    let newHost = room.host;
    const wasHost = (room.host === player);

    room.players = room.players.filter(p => p.name !== player);

    if (room.players.length === 0 && room.status === 'open') {
      room.status = 'closed';
      console.log(`[SocketServer] Room ${code} is now empty and set to 'closed'.`);
    }

    if (wasHost && room.players.length > 0) {
      newHost = room.players[0].name;
      room.host = newHost;
      console.log(`[SocketServer] Host ${player} left. New host is ${newHost}.`);
    }

    await room.save();

    if (!player.startsWith('guest_')) {
        await User.findOneAndUpdate({ username: player }, { status: 'offline', socketId: null });
        io.emit('admin-user-status-changed');
    }

    io.emit('admin-rooms-changed'); 
    
    io.to(code).emit('update-players', { 
      list: room.players, 
      host: newHost
    });
    
    console.log(`[SocketServer] ❌ ${player} left room ${code}. Remaining: ${room.players.length}`);

  } catch (err) {
    console.error('[SocketServer] handlePlayerLeave error:', err.message);
  }
}

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
        
        let displayName = name;
        if (!name.startsWith('guest_')) {
             const dbUser = await User.findOne({ username: name });
             if (dbUser) {
                 displayName = dbUser.displayName;
             }
        }

        const exists = room.players.some(p => p.name === name);
        if (!exists) {
          room.players.push({ name, displayName }); 
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
        
        console.log(`[SocketServer] ✅ ${name} (${displayName}) joined room ${code}.`);

        io.to(code).emit('update-players', { list: room.players, host: room.host });

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
          io.to(kickedSocketId).emit('kicked', { message: 'Bạn đã bị chủ phòng kick.' });
          const kickedSocket = io.sockets.sockets.get(kickedSocketId);
          if (kickedSocket) kickedSocket.leave(code);
          socketUserMap.delete(kickedSocketId);

          if (!playerToKick.startsWith('guest_')) {
              await User.findOneAndUpdate({ username: playerToKick }, { status: 'online' });
              io.emit('admin-user-status-changed');
          }
          console.log(`[SocketServer] 🦶 ${playerToKick} was kicked from room ${code} by ${kickerName}`);
        }

        io.emit('admin-rooms-changed'); 
        io.to(code).emit('update-players', {
          list: room.players,
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

        const allPlayerNames = room.players.map(p => p.name);

        const registeredUsers = allPlayerNames.filter(name => !name.startsWith('guest_'));
        if (registeredUsers.length > 0) {
          await User.updateMany(
            { username: { $in: registeredUsers } },
            { $push: { playHistory: { gameId: room.game.gameId, gameName: room.game.type, playedAt: new Date() } } }
          );
          io.emit('admin-users-changed'); 
        }

        const gameId = room.game.gameId;
        console.log(`>>> 🚀 [GAME START] Room: ${code} | Game: ${gameId}`);
        io.to(code).emit('game-started', { gameId: gameId });
      } catch (err) {
        console.error('[SocketServer] startGame error:', err.message);
      }
    });
    
    socket.on('requestGameState', async ({ code, user }) => {
        const room = await Room.findOne({ code }).exec();
        if (!room && user) {
             socket.emit('game-error', { message: 'Phòng không tồn tại khi vào game.' });
             return;
        }
        
        socket.emit('gameDataInitial', {
            players: room.players,
            host: room.host,
            gameStatus: room.status,
            currentGameData: room.currentGameData || {} 
        });
        
        console.log(`[SocketServer] 🔄 State requested by ${user} in ${code}. Sending data.`);
    });
    
    todHandler(socket, io); 
    drawGuessHandler(socket, io); 
    ticTacToeHandler(socket, io);
    triviaHandler(socket, io);

    socket.on('disconnect', async () => {
      await handlePlayerLeave(socket.id, io);
    });
  });

  return io;
};