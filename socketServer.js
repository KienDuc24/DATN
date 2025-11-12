// socketServer.js
const { Server } = require('socket.io');
const Room = require('./models/Room');
const todHandler = require('./public/game/ToD/todSocket.js');

const socketUserMap = new Map();

// --- HÀM HELPER MỚI: Xử lý rời phòng (Dùng cho cả 'leaveRoom' và 'disconnect') ---
async function handlePlayerLeave(socketId, io) {
  const userInfo = socketUserMap.get(socketId);
  if (!userInfo) return; // Người chơi này không ở trong phòng chờ

  const { player, code } = userInfo;
  socketUserMap.delete(socketId);

  try {
    const room = await Room.findOne({ code });
    if (!room) return;

    let newHost = room.host;
    const wasHost = (room.host === player);
    
    // Xóa người chơi khỏi danh sách
    room.players = room.players.filter(p => p.name !== player);

    // --- LOGIC MỚI: XÓA PHÒNG CHỜ (LOBBY) ---
    if (room.players.length === 0 && room.status === 'open') {
      // Nếu phòng trống VÀ game chưa bao giờ bắt đầu -> Xóa
      await Room.deleteOne({ code: code });
      console.log(`[SocketServer] Empty lobby room ${code} deleted.`);
      return; 
    }
    // (Nếu phòng trống nhưng status là 'playing', chúng ta để game handler (todSocket) tự xóa)

    // Logic chuyển host (nếu host rời đi và còn người chơi)
    if (wasHost && room.players.length > 0) {
      newHost = room.players[0].name;
      room.host = newHost;
      console.log(`[SocketServer] Host ${player} left lobby. New host is ${newHost}.`);
    }

    await room.save();
    
    // Cập nhật những người còn lại trong phòng chờ
    io.to(code).emit('update-players', { 
      list: room.players.map(p => p.name), 
      host: newHost
    });
  } catch (err) {
    console.error('[SocketServer] handlePlayerLeave error:', err.message);
  }
}
// -----------------------------------------------------------------------


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
    socket.on('joinRoom', async ({ code, gameId, user }) => {
      try {
        const room = await Room.findOne({ code, 'game.gameId': gameId }).exec();
        if (!room) {
          socket.emit('room-error', { message: 'Room not found or game mismatch' });
          return;
        }

        // --- LOGIC MỚI: CHẶN THAM GIA PHÒNG ĐANG CHƠI ---
        if (room.status === 'playing') {
          socket.emit('room-error', { message: 'Phòng này đã bắt đầu. Không thể tham gia!' });
          return;
        }
        // ---------------------------------------------

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
      socket.leave(code);
      await handlePlayerLeave(socket.id, io); // Gọi hàm helper
    });
    
    socket.on('kickPlayer', async ({ code, playerToKick }) => {
      // (Giữ nguyên logic kick của bạn...)
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

    // --- CẬP NHẬT LOGIC 'startGame' ---
    socket.on('startGame', async ({ code }) => {
      try {
        const room = await Room.findOne({ code }).exec();
        if (!room) return; 

        // 1. Khóa phòng
        room.status = 'playing';
        await room.save();
        console.log(`[SocketServer] Room ${code} locked and set to 'playing'.`);

        // 2. Bắt đầu game
        const gameId = room.game.gameId;
        console.log(`[SocketServer] Redirecting room ${code} to game ${gameId}`);
        io.to(code).emit('game-started', { gameId: gameId });
      } catch (err) {
        console.error('[SocketServer] startGame error:', err.message);
      }
    });
    // ---------------------------------

    // --- LOGIC TRONG GAME (Gắn handler của game) ---
    todHandler(socket, io);
    // (Nếu có game "Draw", bạn cũng sẽ gọi drawHandler(socket, io) ở đây)

    // --- LOGIC DISCONNECT (Chung) ---
    socket.on('disconnect', async () => {
      console.log(`[socketServer] client ${socket.id} disconnected`);
      // Tự động xử lý rời phòng/chuyển host/xóa phòng chờ
      await handlePlayerLeave(socket.id, io);
      // (Logic disconnect của game sẽ nằm trong todHandler)
    });
  });

  return io;
};