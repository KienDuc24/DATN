// socket_handlers/todSocket.js (ĐÃ SỬA)

const fs = require('fs');
const path = require('path');
const Room = require('../models/Room');

let allQuestions = [];

// --- SỬA LỖI ĐƯỜNG DẪN ---
try {
  // Đường dẫn tương đối từ file hiện tại (socket_handlers) đi lên 1 cấp,
  // sau đó vào public/game/ToD/questions.json
  const questionsPath = path.join(__dirname, '..', 'public', 'game', 'ToD', 'questions.json');
  let data = fs.readFileSync(questionsPath, 'utf8');
  allQuestions = JSON.parse(data);
  console.log('[ToD] Đã tải thành công file questions.json');
} catch (err) {
  console.error('[ToD] Không thể tải file questions.json:', err.message);
  // Khởi tạo mảng rỗng để tránh crash server
  allQuestions = {
    truth: [{ id: 0, text: "Truth fallback question?" }],
    dare: [{ id: 0, text: "Dare fallback question." }]
  };
}
// --- KẾT THÚC SỬA ---


function getRandomQuestion(type) {
  const list = (type === 'truth') ? allQuestions.truth : allQuestions.dare;
  if (!list || list.length === 0) {
    return { id: -1, text: `Không có câu hỏi ${type} nào.` };
  }
  return list[Math.floor(Math.random() * list.length)];
}

function todHandler(socket, io) {
  socket.on('tod-spinWheel', async ({ roomCode, player }) => {
    try {
      const room = await Room.findOne({ code: roomCode });
      if (!room || room.host !== player) {
        return socket.emit('tod-error', 'Chỉ chủ phòng mới có thể quay.');
      }

      const players = room.players.map(p => p.name);
      if (players.length === 0) {
        return socket.emit('tod-error', 'Không có người chơi trong phòng.');
      }
      
      const selectedPlayer = players[Math.floor(Math.random() * players.length)];
      
      // Gửi sự kiện quay
      io.to(roomCode).emit('tod-wheel-spinning');

      // Gửi kết quả sau 1s
      setTimeout(() => {
        io.to(roomCode).emit('tod-wheel-result', { player: selectedPlayer });
      }, 1000); 

    } catch (err) {
      console.error('[ToD] Lỗi khi quay:', err.message);
      socket.emit('tod-error', 'Lỗi server khi quay.');
    }
  });

  socket.on('tod-getQuestion', ({ roomCode, type }) => {
    const question = getRandomQuestion(type);
    io.to(roomCode).emit('tod-question-result', { type, question });
  });

  socket.on('tod-gameEnd', ({ roomCode, player }) => {
    // (Có thể thêm logic kiểm tra chủ phòng)
    io.to(roomCode).emit('tod-game-ended');
  });
}

module.exports = todHandler;