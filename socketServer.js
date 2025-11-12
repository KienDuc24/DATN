// socketServer.js (File chính)

const { Server } = require('socket.io');
const Room = require('./models/Room');

// --- SỬA LỖI (1/3): Import handler của game "ToD" ---
// Đảm bảo đường dẫn này đúng với cấu trúc của bạn
// (Giả sử 'game_handlers' nằm ở gốc, ngang hàng với 'socketServer.js')
const todHandler = require('./game_handlers/ToDSocket.js'); 

// (Biến này giúp xử lý 'disconnect' và 'kick')
const socketUserMap = new Map();

module.exports = function attachSocket(server) {
  const io = new Server(server, {
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    cors: {
      origin: process.env.FRONTEND_URL || 'https://datn-smoky.vercel.app',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('[socketServer] client connected', socket.id);

    // --- LOGIC PHÒNG CHỜ (LOBBY) ---
    // (Dành cho file room.js)
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
        socketUserMap.set(socket.id, { player: name, code: code });
        io.to(code).emit('update-players', { list: room.players.map(p => p.name), host: room.host?.username || room.host });
        
      } catch (err) {
        console.error('[socketServer] joinRoom error:', err.message);
        socket.emit('room-error', { message: 'Internal server error' });
      }
    });

    socket.on('leaveRoom', async ({ code, player }) => {
      try {
        const room = await Room.findOne({ code });
        if (!room) return;
        let newHost = room.host;
        const wasHost = (room.host === player);
        room.players = room.players.filter(p => p.name !== player);
        if (wasHost && room.players.length > 0) {
          newHost = room.players[0].name;
          room.host = newHost;
        } else if (room.players.length === 0) {
          await Room.deleteOne({ code: code });
          socketUserMap.delete(socket.id);
          return; 
        }
        await room.save();
        socket.leave(code);
        socketUserMap.delete(socket.id);
        io.to(code).emit('update-players', { 
          list: room.players.map(p => p.name), 
          host: newHost
        });
      } catch (err) {
        console.error('[socketServer] leaveRoom error:', err.message);
      }
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
        }
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
        const gameId = room.game.gameId;
        console.log(`[SocketServer] Redirecting room ${code} to game ${gameId}`);
        io.to(code).emit('game-started', { gameId: gameId });
      } catch (err) {
        console.error('[SocketServer] startGame error:', err.message);
      }
    });

    // --- SỬA LỖI (2/3): Gắn logic game ToD vào MỌI socket ---
    // File todSocket.js sẽ xử lý các sự kiện 'tod-join', 'tod-who', v.v.
    todHandler(socket, io);
    // (Nếu có game "Draw", bạn cũng sẽ gọi drawHandler(socket, io) ở đây)
    // ----------------------------------------------------

    // --- LOGIC DISCONNECT (Chung) ---
    socket.on('disconnect', async () => {
      console.log('[socketServer] client disconnected', socket.id);
      const userInfo = socketUserMap.get(socket.id);
      if (!userInfo) return; // Socket này không ở trong phòng (có thể là game socket)
      
      // --- SỬA LỖI (3/3): Chuyển logic disconnect vào đây ---
      // (Xử lý khi người chơi ở phòng chờ (lobby) bị disconnect)
      const { player, code } = userInfo;
      socketUserMap.delete(socket.id);
      try {
        const room = await Room.findOne({ code });
        if (!room) return;
        let newHost = room.host;
        const wasHost = (room.host === player);
        room.players = room.players.filter(p => p.name !== player);
        if (wasHost && room.players.length > 0) {
          newHost = room.players[0].name;
          room.host = newHost;
        } else if (room.players.length === 0) {
          await Room.deleteOne({ code: code });
          return;
        }
        await room.save();
        io.to(code).emit('update-players', { 
          list: room.players.map(p => p.name), 
          host: newHost 
        });
      } catch (err) {
        console.error('[socketServer] disconnect error:', err.message);
      }
      // ------------------------------------------------
    });
  });

  return io;
};