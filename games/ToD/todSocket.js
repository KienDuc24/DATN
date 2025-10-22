require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

let GoogleSpreadsheet, doc;
try {
  GoogleSpreadsheet = require('google-spreadsheet').GoogleSpreadsheet;
  doc = new GoogleSpreadsheet('1V9DHRD02AZTVp-jzHcJRFsY0-sxsPg_o3IW-uSYCx3o');
  console.log('[ToD] google-spreadsheet module loaded');
} catch (err) {
  console.warn('[ToD] google-spreadsheet not available, falling back to local questions. Error:', err && err.code ? err.code : err.message);
  GoogleSpreadsheet = null;
  doc = null;
}

const Room = require('../../models/Room');

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
      const items = rows.map(r => r._rawData.join(' ').trim()).filter(Boolean);
      if (!items.length) throw new Error('No rows in sheet');
      return items[Math.floor(Math.random() * items.length)];
    } catch (e) {
      console.error('[ToD] Error reading Google sheet, fallback to static questions:', e && e.message ? e.message : e);
      const arr = FALLBACK_QUESTIONS[type] || FALLBACK_QUESTIONS.truth;
      return arr[Math.floor(Math.random() * arr.length)];
    }
  } else {
    const arr = FALLBACK_QUESTIONS[type] || FALLBACK_QUESTIONS.truth;
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

module.exports = (socket, io) => {
  console.log(`[ToD] handler attached for socket ${socket.id}`);

  // trả trạng thái khi client yêu cầu
  socket.on('tod-who', async ({ roomCode }) => {
    try {
      console.log(`[ToD] tod-who from ${socket.id}`, { roomCode });
      const room = await Room.findOne({ code: roomCode });
      const payload = {
        players: (room && room.players) ? room.players : [],
        host: room && room.players && room.players[0] ? room.players[0].name : null,
        lastQuestion: room ? room.lastQuestion : null,
        lastChoice: room ? room.lastChoice : null
      };
      console.log(`[ToD] replying tod-joined -> socket ${socket.id}`, payload);
      socket.emit('tod-joined', payload);
      // nếu có câu hỏi active, gửi luôn
      if (payload.lastQuestion) {
        socket.emit('tod-question', {
          player: payload.host,
          choice: payload.lastChoice || 'truth',
          question: payload.lastQuestion
        });
      }
    } catch (e) {
      console.error('[ToD] tod-who error', e && e.stack ? e.stack : e);
    }
  });

  socket.on("tod-join", async ({ roomCode, player }) => {
    console.log(`[ToD] tod-join from ${socket.id}`, { roomCode, player });
    try {
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

      // join socket vào room
      socket.join(roomCode);

      const payload = {
        host: room.players[0]?.name || null,
        players: room.players
      };

      // emit trực tiếp cho socket (đảm bảo người join nhận được)
      console.log(`[ToD] emit tod-joined -> socket ${socket.id}`, payload);
      socket.emit('tod-joined', payload);

      // emit cho tất cả trong room (cập nhật cho members)
      console.log(`[ToD] broadcast tod-joined -> room ${roomCode}`, payload);
      io.to(roomCode).emit('tod-joined', payload);

      // nếu có câu hỏi active, gửi cho tất cả
      if (room.lastQuestion) {
        console.log(`[ToD] broadcasting existing question to room ${roomCode}`);
        io.to(roomCode).emit('tod-question', {
          player: room.players[room.currentIndex]?.name,
          choice: room.lastChoice || 'truth',
          question: room.lastQuestion
        });
      }
    } catch (e) {
      console.error('tod-join error', e && e.stack ? e.stack : e);
      socket.emit('tod-join-failed', { reason: 'Lỗi server' });
    }
  });

  socket.on("tod-start-round", async ({ roomCode }) => {
    console.log(`[ToD] tod-start-round from ${socket.id}`, { roomCode });
    try {
      const room = await Room.findOne({ code: roomCode });
      if (!room || room.players.length < 2) return;
      room.locked = true;
      if (typeof room.currentIndex !== 'number') room.currentIndex = 0;
      await room.save();
      const currentPlayer = room.players[room.currentIndex % room.players.length].name;
      io.to(roomCode).emit("tod-your-turn", { player: currentPlayer });
    } catch (e) {
      console.error('tod-start-round error', e && e.stack ? e.stack : e);
    }
  });

  socket.on("tod-choice", async ({ roomCode, player, choice }) => {
    console.log(`[ToD] tod-choice from ${socket.id}`, { roomCode, player, choice });
    try {
      const question = await getRandomQuestion(choice);
      const room = await Room.findOneAndUpdate({ code: roomCode }, { lastChoice: choice, lastQuestion: question, votes: [] }, { new: true, upsert: false });
      io.to(roomCode).emit("tod-question", { player, choice, question });
    } catch (e) {
      console.error("Lỗi lấy câu hỏi:", e && e.stack ? e.stack : e);
      io.to(roomCode).emit("tod-question", { player, choice, question: "Không lấy được câu hỏi!" });
    }
  });

  socket.on("tod-vote", async ({ roomCode, player, vote }) => {
    console.log(`[ToD] tod-vote from ${socket.id}`, { roomCode, player, vote });
    try {
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
      console.error('tod-vote error', e && e.stack ? e.stack : e);
    }
  });
};
