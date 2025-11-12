// socketServer.js
const { Server } = require('socket.io');
const Room = require('./models/Room');
const todHandler = require('../public/game/ToD/ToDSocket.js');

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

        if (gameId === 'ToD' || gameId === 'ToD1' || gameId === 'ToD2') {
          console.log(`[SocketServer] Attaching ToD handler for socket ${socket.id}`);
          todHandler(socket, io);
        }
      } catch (err) {
        console.error('[socketServer] joinRoom error:', err.message);
        socket.emit('room-error', { message: 'Internal server error' });
      }
    });

    socket.on('leaveRoom', async ({ code, player }) => {
      // (Giữ nguyên logic leaveRoom của bạn)
      try {
        const room = await Room.findOne({ code });
        if (!room) return;
        let newHost = room.host;
        const wasHost = (room.host === player);
        room.players = room.players.filter(p => p.name !== player);
        if (wasHost && room.players.length > 0) {
          newHost = room.players[0].name;
          room.host = newHost;
          console.log(`[SocketServer] Host ${player} left. New host is ${newHost}.`);
        } else if (room.players.length === 0) {
          await Room.deleteOne({ code: code });
          console.log(`[SocketServer] Room ${code} is empty and deleted.`);
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
    
    // --- THÊM MỚI: XỬ LÝ SỰ KIỆN KICK ---
    socket.on('kickPlayer', async ({ code, playerToKick }) => {
      const kickerInfo = socketUserMap.get(socket.id);
      // Kiểm tra xem người gửi request có ở trong phòng không
      if (!kickerInfo || kickerInfo.code !== code) return;

      const kickerName = kickerInfo.player;

      try {
        const room = await Room.findOne({ code });
        if (!room) return;

        // 1. Kiểm tra quyền: Người kick có phải là host không?
        if (room.host !== kickerName) {
          socket.emit('room-error', { message: 'Chỉ chủ phòng mới có quyền kick!' });
          return;
        }

        // 2. Không cho host tự kick mình
        if (kickerName === playerToKick) return;

        // 3. Xóa người chơi bị kick
        room.players = room.players.filter(p => p.name !== playerToKick);
        await room.save();

        // 4. Tìm socket của người chơi bị kick
        let kickedSocketId = null;
        for (const [id, info] of socketUserMap.entries()) {
          if (info.player === playerToKick && info.code === code) {
            kickedSocketId = id;
            break;
          }
        }

        if (kickedSocketId) {
          // 5. Gửi sự kiện 'kicked' CHỈ cho người chơi bị kick
          io.to(kickedSocketId).emit('kicked');
          
          // 6. Buộc họ rời khỏi room socket và xóa khỏi map
          const kickedSocket = io.sockets.sockets.get(kickedSocketId);
          if (kickedSocket) {
            kickedSocket.leave(code);
          }
          socketUserMap.delete(kickedSocketId);
          console.log(`[SocketServer] Host ${kickerName} kicked ${playerToKick} from room ${code}.`);
        }

        // 7. Cập nhật danh sách mới cho những người còn lại
        io.to(code).emit('update-players', {
          list: room.players.map(p => p.name),
          host: room.host
        });

      } catch (err) {
        console.error('[SocketServer] kickPlayer error:', err.message);
      }
    });
    // -------------------------------------

    socket.on('startGame', async ({ code }) => {
      try {
        const room = await Room.findOne({ code }).exec();
        if (!room) return; 
        const gameId = room.game.gameId;
        console.log(`[SocketServer] Bắt đầu game ${gameId} cho phòng ${code}`);
        io.to(code).emit('game-started', { gameId: gameId });
      } catch (err) {
        console.error('[SocketServer] startGame error:', err.message);
      }
    });

    socket.on('disconnect', async () => {
      // (Giữ nguyên logic disconnect của bạn)
      console.log('[socketServer] client disconnected', socket.id);
      const userInfo = socketUserMap.get(socket.id);
      if (!userInfo) {
        return;
      }
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
          console.log(`[SocketServer] Host ${player} disconnected. New host is ${newHost}.`);
        } else if (room.players.length === 0) {
          await Room.deleteOne({ code: code });
          console.log(`[SocketServer] Room ${code} is empty and deleted.`);
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
    });
  });

  return io;
};