require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

let GoogleSpreadsheet, doc;
try {
  // require only if installed
  GoogleSpreadsheet = require('google-spreadsheet').GoogleSpreadsheet;
  doc = new GoogleSpreadsheet('1V9DHRD02AZTVp-jzHcJRFsY0-sxsPg_o3IW-uSYCx3o');
  console.log('[ToD] google-spreadsheet module loaded');
} catch (err) {
  console.warn('[ToD] google-spreadsheet not available, falling back to local questions. Error:', err.code || err.message);
  GoogleSpreadsheet = null;
  doc = null;
}

const Room = require('../../models/Room');

// fallback questions if Google sheet not available
const FALLBACK_QUESTIONS = {
  truth: [
    "Bạn đã từng nói dối lớn nhất là gì?",
    "Bạn có bí mật nào chưa kể với mọi người không?"
  ],
  dare: [
    "Hát một đoạn bài hát trước mọi người.",
    "Ăn một thìa ớt (hoặc tương tương ứng)."
  ]
};

async function getRandomQuestion(type = 'truth') {
  if (GoogleSpreadsheet && doc) {
    try {
      await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      });
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0];
      const rows = await sheet.getRows();
      // filter by type if your sheet has a type column, fallback to random row text
      const items = rows.map(r => r._rawData.join(' ').trim()).filter(Boolean);
      if (items.length === 0) throw new Error('No rows in sheet');
      return items[Math.floor(Math.random() * items.length)];
    } catch (e) {
      console.error('[ToD] Error reading Google sheet, fallback to static questions:', e.message);
      const arr = FALLBACK_QUESTIONS[type] || FALLBACK_QUESTIONS.truth;
      return arr[Math.floor(Math.random() * arr.length)];
    }
  } else {
    // fallback
    const arr = FALLBACK_QUESTIONS[type] || FALLBACK_QUESTIONS.truth;
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

module.exports = (socket, io, rooms) => {
  console.log(`[ToD] handler attached for socket ${socket.id}`);

  socket.on("tod-join", async ({ roomCode, player }) => {
    try {
      console.log(`[ToD] tod-join from ${socket.id}`, { roomCode, player });
      let room = await Room.findOne({ code: roomCode });
      if (!room) {
        room = await Room.create({ code: roomCode, players: [{ name: player, order: 1 }] });
      } else {
        if (room.locked) {
          socket.emit("tod-join-failed", { reason: "Phòng đã bắt đầu, không thể vào thêm!" });
          return;
        }
        if (!room.players.some(p => p.name === player)) {
          room.players.push({ name: player, order: room.players.length + 1 });
          await room.save();
        }
      }
      socket.join(roomCode);
      io.to(roomCode).emit("tod-joined", {
        host: room.players[0]?.name || null,
        players: room.players
      });
    } catch (e) {
      console.error('tod-join error', e);
      socket.emit('tod-join-failed', { reason: 'Lỗi server' });
    }
  });

  // Khi chủ phòng bắt đầu, khóa phòng
  socket.on("tod-start-round", async ({ roomCode }) => {
    try {
      console.log(`[ToD] tod-start-round from ${socket.id}`, { roomCode });
      const room = await Room.findOne({ code: roomCode });
      if (!room || room.players.length < 2) return;
      room.locked = true;
      if (room.currentIndex === undefined) room.currentIndex = 0;
      await room.save();
      const currentPlayer = room.players[room.currentIndex % room.players.length].name;
      io.to(roomCode).emit("tod-your-turn", { player: currentPlayer });
    } catch (e) {
      console.error('tod-start-round error', e);
    }
  });

  socket.on("tod-choice", async ({ roomCode, player, choice }) => {
    try {
      console.log(`[ToD] tod-choice from ${socket.id}`, { roomCode, player, choice });
      const question = await getRandomQuestion(choice);
      const room = await Room.findOneAndUpdate(
        { code: roomCode },
        { lastChoice: choice, lastQuestion: question, votes: [] },
        { new: true }
      );
      io.to(roomCode).emit("tod-question", { player, choice, question });
    } catch (e) {
      console.error("Lỗi lấy câu hỏi:", e);
      io.to(roomCode).emit("tod-question", { player, choice, question: "Không lấy được câu hỏi!" });
    }
  });

  socket.on("tod-vote", async ({ roomCode, player, vote }) => {
    try {
      console.log(`[ToD] tod-vote from ${socket.id}`, { roomCode, player, vote });
      const room = await Room.findOne({ code: roomCode });
      if (!room) return;
      const currentAsked = room.players[room.currentIndex]?.name;
      if (player === currentAsked) return;
      if (!room.votes) room.votes = [];
      if (!room.votes.some(v => v.player === player)) {
        room.votes.push({ player, vote });
        await room.save();
      }
      const total = room.players.length - 1;
      const voted = room.votes.length;
      const acceptCount = room.votes.filter(v => v.vote === "accept").length;

      io.to(roomCode).emit("tod-voted", { player, vote, acceptCount, voted, total });

      if (voted === total) {
        if (acceptCount >= Math.ceil(total / 2)) {
          io.to(roomCode).emit("tod-result", { result: "accepted" });
          room.currentIndex = (room.currentIndex + 1) % room.players.length;
          room.votes = [];
          await room.save();
          const nextPlayer = room.players[room.currentIndex].name;
          setTimeout(() => io.to(roomCode).emit("tod-your-turn", { player: nextPlayer }), 2000);
        } else {
          io.to(roomCode).emit("tod-result", { result: "rejected" });
          // retry question
          setTimeout(async () => {
            room.votes = [];
            const lastChoice = room.lastChoice || 'truth';
            const question = await getRandomQuestion(lastChoice);
            room.lastQuestion = question;
            await room.save();
            io.to(roomCode).emit("tod-question", {
              player: room.players[room.currentIndex].name,
              choice: lastChoice,
              question
            });
          }, 2000);
        }
      }
    } catch (e) {
      console.error('tod-vote error', e);
    }
  });
};
