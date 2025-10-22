const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// models
const Room = require('../../models/Room');
const User = require('../../models/User');

// load questions.json (sync to ensure availability on startup)
const QUESTIONS_PATH = path.resolve(__dirname, '../../public/game/ToD/questions.json');
let QUESTIONS = { truth: [], dare: [] };
try {
  const raw = fs.readFileSync(QUESTIONS_PATH, 'utf8');
  QUESTIONS = JSON.parse(raw || '{}');
  console.log('[ToD] questions.json loaded ->', QUESTIONS_PATH, 'truth:', (QUESTIONS.truth||[]).length, 'dare:', (QUESTIONS.dare||[]).length);
} catch (err) {
  console.warn('[ToD] cannot load questions.json at', QUESTIONS_PATH, err && err.message);
  QUESTIONS = { truth: ["Bạn có bí mật nào chưa kể với mọi người không?"], dare: ["Hát một đoạn bài hát trước mọi người."] };
}

// in-memory state per room
const ROOM_STATE = {}; // { [roomCode]: { currentIndex, lastQuestion, lastChoice, votes } }
function getRoomState(code) {
  if (!ROOM_STATE[code]) ROOM_STATE[code] = { currentIndex: 0, lastQuestion: null, lastChoice: null, votes: [] };
  return ROOM_STATE[code];
}

function getRandomQuestion(type = 'truth') {
  const arr = Array.isArray(QUESTIONS[type]) && QUESTIONS[type].length ? QUESTIONS[type] : (QUESTIONS.truth || []);
  if (!arr.length) return 'Không có câu hỏi';
  return arr[Math.floor(Math.random() * arr.length)];
}

async function attachAvatarsToPlayers(players) {
  const names = (players || []).map(p => p.name).filter(Boolean);
  if (!names.length) return players || [];
  const users = await User.find({ $or: [{ username: { $in: names } }, { displayName: { $in: names } }] }).lean();
  const map = {};
  users.forEach(u => {
    if (u.username) map[u.username] = u;
    if (u.displayName) map[u.displayName] = u;
  });
  return (players || []).map(p => {
    const user = map[p.name];
    return { name: p.name, avatar: p.avatar || (user ? (user.avatarUrl || null) : null) };
  });
}

module.exports = (socket, io) => {
  console.log(`[ToD] handler attached for socket ${socket.id}`);

  socket.on('tod-who', async ({ roomCode }) => {
    try {
      if (!roomCode) return socket.emit('tod-joined', { players: [], host: null });
      const room = await Room.findOne({ code: roomCode }).lean();
      if (!room) return socket.emit('tod-joined', { players: [], host: null });
      const state = getRoomState(roomCode);
      const playersWithAvt = await attachAvatarsToPlayers(Array.isArray(room.players) ? room.players : []);
      socket.emit('tod-joined', {
        players: playersWithAvt,
        host: room.host || (Array.isArray(room.players) && room.players[0] && room.players[0].name) || null,
        lastQuestion: state.lastQuestion,
        lastChoice: state.lastChoice
      });
    } catch (e) {
      console.error('[ToD] tod-who error', e);
    }
  });

  socket.on('tod-join', async ({ roomCode, player }) => {
    try {
      player = (player && String(player).trim()) ? String(player).trim() : `guest_${socket.id.slice(0,6)}`;
      const user = await User.findOne({ $or: [{ username: player }, { displayName: player }] }).lean();
      let room = await Room.findOne({ code: roomCode });
      if (!room) {
        room = await Room.create({ code: roomCode, host: player, players: [{ name: player, avatar: user?.avatarUrl || null }] });
      } else {
        if (!Array.isArray(room.players)) room.players = [];
        if (room.locked) { socket.emit('tod-join-failed', { reason: 'Phòng đã bắt đầu, không thể vào thêm!' }); return; }
        if (!room.players.some(p => p.name === player)) {
          room.players.push({ name: player, avatar: user?.avatarUrl || null });
          if (!room.host) room.host = room.players[0]?.name || player;
          await room.save();
        }
      }

      socket.join(roomCode);
      getRoomState(roomCode);

      const fresh = await Room.findOne({ code: roomCode }).lean();
      const playersWithAvt = await attachAvatarsToPlayers(Array.isArray(fresh.players) ? fresh.players : []);
      const payload = { host: fresh && (fresh.host || (fresh.players && fresh.players[0] && fresh.players[0].name) ) || null, players: playersWithAvt };

      socket.emit('tod-joined', payload);
      io.to(roomCode).emit('tod-joined', payload);
    } catch (e) {
      console.error('[ToD] tod-join error', e);
      socket.emit('tod-join-failed', { reason: 'Lỗi server' });
    }
  });

  socket.on('tod-start-round', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ code: roomCode });
      if (!room || !Array.isArray(room.players) || room.players.length < 1) return;
      room.locked = true;
      await room.save();

      const state = getRoomState(roomCode);
      if (typeof state.currentIndex !== 'number') state.currentIndex = 0;

      const currentPlayer = room.players[state.currentIndex % room.players.length].name;
      io.to(roomCode).emit('tod-your-turn', { player: currentPlayer });
    } catch (e) {
      console.error('[ToD] tod-start-round error', e);
    }
  });

  socket.on('tod-choice', async ({ roomCode, player, choice }) => {
    try {
      const room = await Room.findOne({ code: roomCode });
      if (!room || !Array.isArray(room.players) || room.players.length < 1) return;
      const state = getRoomState(roomCode);
      const question = getRandomQuestion(choice || 'truth');
      state.lastChoice = choice;
      state.lastQuestion = question;
      state.votes = [];
      io.to(roomCode).emit('tod-question', { player, choice, question });
    } catch (e) {
      console.error('[ToD] tod-choice error', e);
      io.to(roomCode).emit('tod-question', { player, choice, question: 'Không lấy được câu hỏi!' });
    }
  });

  socket.on('tod-vote', async ({ roomCode, player, vote }) => {
    try {
      const room = await Room.findOne({ code: roomCode });
      if (!room || !Array.isArray(room.players) || room.players.length < 1) return;
      const state = getRoomState(roomCode);
      const currentAsked = room.players[state.currentIndex]?.name;
      if (player === currentAsked) return;
      if (!state.votes) state.votes = [];
      if (!state.votes.some(v => v.player === player)) state.votes.push({ player, vote });

      const total = Math.max(0, (room.players.length - 1));
      const voted = state.votes.length;
      const acceptCount = state.votes.filter(v => v.vote === 'accept').length;

      io.to(roomCode).emit('tod-voted', { player, vote, acceptCount, voted, total });

      if (voted === total) {
        if (acceptCount >= Math.ceil(total / 2)) {
          io.to(roomCode).emit('tod-result', { result: 'accepted' });
          state.votes = [];
          state.currentIndex = (state.currentIndex + 1) % room.players.length;
          setTimeout(() => {
            const nextPlayer = room.players[state.currentIndex].name;
            io.to(roomCode).emit('tod-your-turn', { player: nextPlayer });
          }, 800);
        } else {
          io.to(roomCode).emit('tod-result', { result: 'rejected' });
          const lastChoice = state.lastChoice || 'truth';
          const newQ = getRandomQuestion(lastChoice);
          state.lastQuestion = newQ;
          state.votes = [];
          setTimeout(() => {
            io.to(roomCode).emit('tod-question', {
              player: room.players[state.currentIndex].name,
              choice: lastChoice,
              question: newQ
            });
          }, 700);
        }
      }
    } catch (e) {
      console.error('[ToD] tod-vote error', e);
    }
  });

  socket.on('profile-updated', async ({ roomCode, oldName, newName, avatar }) => {
    try {
      if (!roomCode || !oldName) return;
      const room = await Room.findOne({ code: roomCode });
      if (!room) return;
      let changed = false;
      room.players = (room.players || []).map(p => {
        if (p.name === oldName) { changed = true; return { name: newName || oldName, avatar: avatar || p.avatar || null }; }
        return p;
      });
      if (room.host === oldName) room.host = newName || room.host;
      if (changed) {
        await room.save();
        const playersWithAvt = await attachAvatarsToPlayers(room.players || []);
        io.to(roomCode).emit('tod-joined', { host: room.host, players: playersWithAvt });
      }
    } catch (e) {
      console.error('[ToD] profile-updated handler error', e);
    }
  });

  socket.on('disconnecting', async () => {
    try {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      for (const rc of rooms) {
        // optional cleanup logic; don't assume Room is undefined
        try {
          const room = await Room.findOne({ code: rc });
          if (!room) continue;
          // no destructive default behavior here
        } catch (err) {
          console.error('[ToD] disconnect cleanup error for', rc, err);
        }
      }
    } catch (e) {
      console.error('[ToD] disconnecting handler error', e);
    }
  });
};
