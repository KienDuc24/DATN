// socket_handlers/drawSocket.js (ĐÃ SỬA)

const fs = require('fs');
const path = require('path');
const Room = require('../models/Room');

const gameStates = new Map();
let allWords = [];

// --- SỬA LỖI ĐƯỜNG DẪN ---
try {
  // Đường dẫn tương đối từ file hiện tại (socket_handlers) đi lên 1 cấp,
  // sau đó vào public/game/Draw/words.json
  const wordsPath = path.join(__dirname, '..', 'public', 'game', 'Draw', 'words.json');
  let data = fs.readFileSync(wordsPath, 'utf8');
  allWords = JSON.parse(data);
  console.log('[DG] Đã tải thành công file words.json');
} catch (err) {
  console.error('[DG] Không thể tải file words.json:', err.message);
  // Khởi tạo mảng rỗng để tránh crash server
  allWords = [{ "id": 0, "word": "Fallback Word", "category": "General" }];
}
// --- KẾT THÚC SỬA ---


// --- Logic game (Giữ nguyên) ---

function getWord() {
  if (!allWords || allWords.length === 0) {
    return { id: -1, word: "Lỗi", category: "Lỗi" };
  }
  return allWords[Math.floor(Math.random() * allWords.length)];
}

function initializeGameState(roomCode, players) {
  gameStates.set(roomCode, {
    players: players.map(p => ({ name: p, score: 0, guessed: false })),
    currentDrawer: null,
    currentWord: null,
    round: 0,
    maxRounds: 3, 
    timer: null,
    time: 90
  });
}

function nextTurn(io, roomCode) {
  const state = gameStates.get(roomCode);
  if (!state) return;

  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  // Cập nhật điểm
  io.to(roomCode).emit('dg-update-scores', state.players);

  // Chọn người vẽ tiếp theo
  let drawerIndex = -1;
  if (state.currentDrawer) {
    drawerIndex = state.players.findIndex(p => p.name === state.currentDrawer);
  }
  
  let nextDrawerIndex = (drawerIndex + 1) % state.players.length;

  // Bắt đầu vòng mới nếu cần
  if (nextDrawerIndex === 0) {
    state.round++;
  }

  // Kết thúc game nếu hết vòng
  if (state.round >= state.maxRounds) {
    const finalScores = state.players.sort((a, b) => b.score - a.score);
    io.to(roomCode).emit('dg-game-over', finalScores);
    gameStates.delete(roomCode);
    return;
  }

  // Reset trạng thái guessed
  state.players.forEach(p => p.guessed = false);

  state.currentDrawer = state.players[nextDrawerIndex].name;
  const wordData = getWord();
  state.currentWord = wordData.word.toLowerCase();

  io.to(roomCode).emit('dg-new-turn', {
    drawer: state.currentDrawer,
    round: state.round + 1,
    maxRounds: state.maxRounds
  });

  // Gửi từ khóa cho người vẽ
  const drawerSocket = getSocketByPlayerName(io, roomCode, state.currentDrawer);
  if (drawerSocket) {
    drawerSocket.emit('dg-your-turn', { word: wordData.word, category: wordData.category });
  }

  // Gửi gợi ý (dấu gạch) cho người đoán
  const hint = state.currentWord.replace(/[a-zA-Z]/g, '_');
  io.to(roomCode).emit('dg-word-hint', hint);

  // Bắt đầu đếm giờ
  state.time = 90;
  io.to(roomCode).emit('dg-timer-update', state.time);

  state.timer = setInterval(() => {
    state.time--;
    io.to(roomCode).emit('dg-timer-update', state.time);
    if (state.time <= 0) {
      clearInterval(state.timer);
      io.to(roomCode).emit('dg-chat-message', {
        sender: 'Hệ thống',
        message: `Hết giờ! Từ khóa là: ${state.currentWord}`,
        isSystem: true
      });
      nextTurn(io, roomCode);
    }
  }, 1000);
}

function getSocketByPlayerName(io, roomCode, playerName) {
  // (Cần tối ưu: Hiện tại O(N) tìm kiếm)
  // Đây là một hạn chế của việc không map socket.id với playerName khi vào game
  const roomSockets = io.sockets.adapter.rooms.get(roomCode);
  if (!roomSockets) return null;

  for (const socketId of roomSockets) {
    const socket = io.sockets.sockets.get(socketId);
    // Giả định rằng socket.data.playerName đã được gán khi 'dg-join-game'
    if (socket && socket.data && socket.data.playerName === playerName) {
      return socket;
    }
  }
  return null;
}

function drawGuessHandler(socket, io) {
  
  // Khi user vào trang game
  socket.on('dg-join-game', async ({ roomCode, player }) => {
    socket.join(roomCode);
    socket.data.playerName = player; // Gán tên vào socket
    socket.data.roomCode = roomCode;

    const state = gameStates.get(roomCode);
    
    // Nếu là người đầu tiên, khởi tạo game
    if (!state) {
      try {
        const room = await Room.findOne({ code: roomCode });
        if (!room) {
            socket.emit('dg-error', 'Không tìm thấy phòng.');
            return;
        }
        const players = room.players.map(p => p.name);
        initializeGameState(roomCode, players);
        
        io.to(roomCode).emit('dg-chat-message', {
          sender: 'Hệ thống',
          message: `Chào mừng ${player}! Bạn là chủ phòng. Bấm "Bắt đầu" để chơi.`,
          isSystem: true
        });
        
        // Cập nhật danh sách người chơi
        io.to(roomCode).emit('dg-update-scores', gameStates.get(roomCode).players);
        
      } catch (err) {
         socket.emit('dg-error', 'Lỗi khi lấy thông tin phòng.');
      }
    } else {
      // Nếu game đã bắt đầu, gửi trạng thái hiện tại
      socket.emit('dg-chat-message', {
        sender: 'Hệ thống',
        message: `Chào mừng ${player} đã tham gia!`,
        isSystem: true
      });
      socket.emit('dg-update-scores', state.players);
      socket.emit('dg-new-turn', {
        drawer: state.currentDrawer,
        round: state.round + 1,
        maxRounds: state.maxRounds
      });
      if (player !== state.currentDrawer) {
          const hint = state.currentWord.replace(/[a-zA-Z]/g, '_');
          socket.emit('dg-word-hint', hint);
      } else {
          // Gửi lại từ cho người vẽ (nếu họ bị F5)
          socket.emit('dg-your-turn', { word: state.currentWord, category: '...' });
      }
    }
  });

  socket.on('dg-start-game', ({ roomCode, player }) => {
    const state = gameStates.get(roomCode);
    if (!state) return;
    if (state.players[0].name === player) { // Chỉ người đầu tiên (chủ phòng game)
      io.to(roomCode).emit('dg-chat-message', {
        sender: 'Hệ thống',
        message: 'Trò chơi bắt đầu!',
        isSystem: true
      });
      nextTurn(io, roomCode);
    }
  });

  socket.on('dg-chat-message', ({ message }) => {
    const player = socket.data.playerName;
    const roomCode = socket.data.roomCode;
    const state = gameStates.get(roomCode);

    if (!state || !player || !roomCode) return;

    // Kiểm tra câu trả lời
    if (player !== state.currentDrawer && !state.players.find(p=>p.name === player).guessed) {
      if (message.trim().toLowerCase() === state.currentWord) {
        // Trả lời đúng
        const playerState = state.players.find(p => p.name === player);
        playerState.guessed = true;
        
        // Tính điểm
        const score = Math.max(10, state.time); // Điểm = thời gian còn lại
        playerState.score += score;
        
        // Người vẽ cũng được điểm
        const drawerState = state.players.find(p => p.name === state.currentDrawer);
        if (drawerState) drawerState.score += Math.round(score / 3);

        io.to(roomCode).emit('dg-chat-message', {
          sender: 'Hệ thống',
          message: `${player} đã đoán đúng! +${score} điểm.`,
          isSystem: true,
          isCorrect: true
        });
        
        io.to(roomCode).emit('dg-update-scores', state.players);

        // Kiểm tra nếu mọi người đã đoán xong
        const allGuessed = state.players.every(p => p.name === state.currentDrawer || p.guessed);
        if (allGuessed) {
          io.to(roomCode).emit('dg-chat-message', {
            sender: 'Hệ thống',
            message: `Mọi người đã đoán xong! Từ khóa là: ${state.currentWord}`,
            isSystem: true
          });
          nextTurn(io, roomCode);
        }
        
      } else {
        // Trả lời sai
        io.to(roomCode).emit('dg-chat-message', { sender: player, message: message });
      }
    } else {
      // Người vẽ chat
      io.to(roomCode).emit('dg-chat-message', { sender: player, message: message });
    }
  });

  socket.on('dg-drawing', (data) => {
    if (socket.data.roomCode) {
      socket.to(socket.data.roomCode).emit('dg-drawing', data);
    }
  });

  socket.on('dg-clear-canvas', () => {
     if (socket.data.roomCode) {
        io.to(socket.data.roomCode).emit('dg-clear-canvas');
     }
  });
  
  socket.on('dg-choose-word', (wordData) => {
      // (Bỏ qua nếu logic chọn 3 từ không được implement)
  });

  socket.on('disconnect', () => {
    const player = socket.data.playerName;
    const roomCode = socket.data.roomCode;
    if (!player || !roomCode) return;

    const state = gameStates.get(roomCode);
    if (!state) return;

    // Xóa người chơi khỏi state
    state.players = state.players.filter(p => p.name !== player);
    io.to(roomCode).emit('dg-update-scores', state.players);
    io.to(roomCode).emit('dg-chat-message', {
      sender: 'Hệ thống',
      message: `${player} đã rời khỏi game.`,
      isSystem: true
    });

    if (state.players.length < 2) {
      if (state.timer) clearInterval(state.timer);
      io.to(roomCode).emit('dg-game-over', state.players);
      gameStates.delete(roomCode);
    } else if (player === state.currentDrawer) {
      // Nếu người vẽ rời đi, chuyển lượt
      io.to(roomCode).emit('dg-chat-message', {
        sender: 'Hệ thống',
        message: 'Người vẽ đã rời đi. Chuyển lượt mới...',
        isSystem: true
      });
      nextTurn(io, roomCode);
    }
  });
}

module.exports = drawGuessHandler;