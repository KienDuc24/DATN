// socketServer.js (FINAL FIX: Chuyển thẳng về offline khi rời phòng)

const { Server } = require('socket.io');
const Room = require('./models/Room');
const User = require('./models/User'); 

// 1. IMPORT CÁC HANDLER CŨ CỦA BẠN (Cần đảm bảo đường dẫn đúng)
const todHandler = require('./public/game/ToD/todSocket.js'); 
const drawGuessHandler = require('./public/game/Draw/drawSocket.js'); 

const socketUserMap = new Map();

// --- HÀM HELPER XỬ LÝ RỜI PHÒNG ---
async function handlePlayerLeave(socketId, io) {
  const userInfo = socketUserMap.get(socketId);
  if (!userInfo) return; 

  const { player, code } = userInfo;
  socketUserMap.delete(socketId);

  try {
    const room = await Room.findOne({ code });
    if (!room) return;

    // Nếu game đang chơi, ta không xóa player khỏi list ngay
    if (room.status === 'playing') {
      console.log(`[SocketServer] Player ${player} left session, status is 'playing'.`);
      return; 
    }

    let newHost = room.host;
    const wasHost = (room.host === player);

    // Xóa người chơi khỏi danh sách
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

    // Cập nhật status người chơi về 'offline'
    if (!player.startsWith('guest_')) {
        // FIX: Chuyển status từ 'online' hoặc 'playing' (nếu thoát qua leaveRoom) về 'offline'
        await User.findOneAndUpdate({ username: player }, { status: 'offline', socketId: null });
        io.emit('admin-user-status-changed');
    }

    io.emit('admin-rooms-changed'); 
    
    // Gửi danh sách người chơi MỚI (object đầy đủ)
    io.to(code).emit('update-players', { 
      list: room.players, // Gửi cả mảng object {name, displayName}
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
        
        // Lấy displayName để lưu vào Room
        let displayName = name;
        if (!name.startsWith('guest_')) {
             const dbUser = await User.findOne({ username: name });
             if (dbUser) {
                 displayName = dbUser.displayName;
             }
        }

        const exists = room.players.some(p => p.name === name);
        if (!exists) {
          room.players.push({ name, displayName }); // LƯU CẢ DISPLAY NAME
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

        // Gửi danh sách người chơi (object đầy đủ)
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
    
    // ... (logic kickPlayer giữ nguyên) ...

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

    // --- LOGIC TRONG GAME (GẮN HANDLER CỦA BẠN VÀ KHÔI PHỤC BỐI CẢNH) ---
    
    // BỘ ĐỊNH TUYẾN CHUNG: Bắt sự kiện 'playerEnteredGame' từ client
    socket.on('requestGameState', async ({ code, user }) => {
        const room = await Room.findOne({ code }).exec();
        if (!room && user) {
             socket.emit('game-error', { message: 'Phòng không tồn tại khi vào game.' });
             return;
        }
        
        // Gửi lại trạng thái game cho socket vừa tham gia
        socket.emit('gameDataInitial', {
            players: room.players, // Danh sách người chơi đầy đủ
            host: room.host,
            gameStatus: room.status,
            currentGameData: room.currentGameData || {} // Trạng thái game (nếu có)
        });
        
        console.log(`[SocketServer] 🔄 State requested by ${user} in ${code}. Sending data.`);
    });
    
    // GẮN CÁC LOGIC GAME CỤ THỂ CỦA BẠN VÀO ĐÂY
    // Giả sử bạn khôi phục và đặt lại tên cho 2 file này
    todHandler(socket, io); 
    drawGuessHandler(socket, io); 

    // --- DISCONNECT ---
    socket.on('disconnect', async () => {
      await handlePlayerLeave(socket.id, io);
    });
  });

  return io;
};