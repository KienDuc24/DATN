// public/game/ToD/ToDSocket.js

const fs = require('fs');
const path = require('path');
// Sửa đường dẫn: Lùi 3 cấp (public/game/ToD -> gốc)
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// models
// Sửa đường dẫn: Lùi 3 cấp
const Room = require('../../../models/Room');
const User = require('../../../models/User');

// load questions.json
// Sửa đường dẫn: Lùi 3 cấp, rồi vào public...
const QUESTIONS_PATH = path.resolve(__dirname, '../../../public/game/ToD/questions.json');
let QUESTIONS = { truth: [], dare: [] };
try {
  const raw = fs.readFileSync(QUESTIONS_PATH, 'utf8');
  QUESTIONS = JSON.parse(raw || '{}');
  console.log('[ToD] questions.json loaded ->', QUESTIONS_PATH, 'truth:', (QUESTIONS.truth || []).length, 'dare:', (QUESTIONS.dare || []).length);
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

function normalizePlayerInput(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    return { name: s, displayName: null, avatar: null, email: null };
  }
  if (typeof input === 'object') {
    const nameRaw = input.name || input.username || input.displayName || input.displayname || input.email || '';
    const name = (typeof nameRaw === 'string' ? nameRaw : String(nameRaw || '')).trim();
    const displayName = input.displayName || input.displayname || null;
    const avatar = input.avatar || input.avatarUrl || input.photo || null;
    const email = input.email || null;
    if (!name && !displayName && !email) return null;
    return { name: name || displayName || email, displayName: displayName || null, avatar: avatar || null, email };
  }
  return null;
}

async function attachAvatarsToPlayers(players) {
  const normalized = (players || []).map(p => normalizePlayerInput(p)).filter(Boolean);
  const names = normalized.map(p => p.name).filter(Boolean);
  const displayNames = normalized.map(p => p.displayName).filter(Boolean);
  const emails = normalized.map(p => p.email).filter(Boolean);

  if (!names.length && !displayNames.length && !emails.length) {
    return normalized.map(p => ({ name: p.name, displayName: p.displayName || null, avatar: p.avatar || null }));
  }

  const ors = [];
  if (names.length) ors.push({ username: { $in: names } });
  if (displayNames.length) ors.push({ displayName: { $in: displayNames } });
  if (emails.length) ors.push({ email: { $in: emails } });

  let users = [];
  try {
    users = await User.find({ $or: ors }).lean();
  } catch (e) {
    console.warn('[ToD] attachAvatarsToPlayers user lookup failed', e && e.message);
    users = [];
  }

  const map = {};
  users.forEach(u => {
    if (u.username) map[u.username] = u;
    if (u.displayName) map[u.displayName] = u;
    if (u.email) map[u.email] = u;
    if (u.name) map[u.name] = u;
  });

  return normalized.map(p => {
    const user = map[p.name] || map[p.displayName] || (p.email ? map[p.email] : null);
    const avatar = p.avatar || (user ? (user.avatarUrl || user.avatar || null) : null);
    const outDisplayName = p.displayName || (user ? (user.displayName || user.name || null) : null);
    return { name: p.name, displayName: outDisplayName || null, avatar: avatar || null };
  });
}

function getPlayersFromRoom(room) {
  if (!room) return [];
  let raw = [];
  if (Array.isArray(room.players) && room.players.length) raw = room.players;
  else if (Array.isArray(room.participants) && room.participants.length) raw = room.participants;
  else if (Array.isArray(room.playersList) && room.playersList.length) raw = room.playersList;
  else if (room.players && typeof room.players === 'object' && !Array.isArray(room.players)) raw = Object.values(room.players).filter(Boolean);
  else return [];

  return raw.map(p => {
    const np = normalizePlayerInput(p);
    if (!np) return null;
    return { name: np.name, displayName: np.displayName || null, avatar: np.avatar || null };
  }).filter(Boolean);
}

async function ensureRoomPlayersField(roomDoc) {
  let changed = false;
  if (!Array.isArray(roomDoc.players) && Array.isArray(roomDoc.participants)) {
    roomDoc.players = roomDoc.participants;
    changed = true;
  } else if (!Array.isArray(roomDoc.participants) && Array.isArray(roomDoc.players)) {
    roomDoc.participants = roomDoc.players;
    changed = true;
  } else if (!Array.isArray(roomDoc.players) && !Array.isArray(roomDoc.participants)) {
    roomDoc.players = roomDoc.participants = [];
    changed = true;
  }
  if (changed) {
    try { await roomDoc.save(); } catch (e) { /* ignore save failure for compatibility */ }
  }
  return roomDoc;
}

module.exports = (socket, io) => {
  console.log(`[ToD] handler attached for socket ${socket.id}`);

  socket.on('tod-who', async ({ roomCode }) => {
    try {
      const state = getRoomState(roomCode || '');
      if (!roomCode) {
        const normalizedEmpty = {
          roomCode: '',
          host: null,
          status: 'open',
          participantsCount: 0,
          players: [],
          createdAt: null,
          updatedAt: null,
          state
        };
        return socket.emit('tod-joined', normalizedEmpty);
      }

      const room = await Room.findOne({ code: roomCode }).lean();
      console.log('[ToD][debug] tod-who room lookup:', { roomCode, found: !!room, roomSnapshot: room && { players: room.players, participants: room.participants, host: room.host, code: room.code } });
      if (!room) {
        const normalizedEmpty = {
          roomCode: String(roomCode),
          host: null,
          status: 'open',
          participantsCount: 0,
          players: [],
          createdAt: null,
          updatedAt: null,
          state
        };
        return socket.emit('tod-joined', normalizedEmpty);
      }

      const playersArr = getPlayersFromRoom(room);
      const playersWithAvt = await attachAvatarsToPlayers(playersArr);

      const roomStatus = room && (room.status || (room.isPlaying ? 'playing' : (room.isOpen ? 'open' : 'closed'))) || 'open';

      const payload = {
        roomCode: String(roomCode || (room && room.code || '')),
        host: room && (room.host || (playersArr[0] && playersArr[0].name)) || null,
        status: roomStatus,
        participantsCount: Array.isArray(playersArr) ? playersArr.length : 0,
        players: playersWithAvt,
        createdAt: room && (room.createdAt || null),
        updatedAt: room && (room.updatedAt || null),
        state
      };

      socket.emit('tod-joined', payload);
      io.to(roomCode).emit('tod-joined', payload);
    } catch (e) { console.error('[ToD] tod-who error', e); }
  });

  socket.on('tod-join', async ({ roomCode, player }) => {
    try {
      console.log('[ToD] tod-join received', { socketId: socket.id, roomCode, player });
      const normalizedInput = normalizePlayerInput(player) || normalizePlayerInput(`guest_${socket.id.slice(0, 6)}`);
      if (!normalizedInput) return socket.emit('tod-join-failed', { reason: 'Invalid player' });

      const playerName = normalizedInput.name;
      const playerDisplay = normalizedInput.displayName;
      const playerAvatarCandidate = normalizedInput.avatar;

      let user = null;
      try {
        user = await User.findOne({ $or: [{ username: playerName }, { displayName: playerName }, { email: normalizedInput.email }] }).lean();
      } catch (e) {
        console.warn('[ToD] user lookup failed', e && e.message);
      }

      const playerObj = {
        name: playerName,
        displayName: playerDisplay || (user ? (user.displayName || null) : null),
        avatar: (user && (user.avatarUrl || user.avatar)) || playerAvatarCandidate || null
      };

      const room = await Room.findOneAndUpdate(
        { code: roomCode },
        {
          $setOnInsert: { code: roomCode, host: playerName, status: 'open' },
          $addToSet: { players: playerObj }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      try {
        await Room.updateOne({ _id: room._id }, { $set: { participants: room.players, host: room.host || playerName } });
      } catch (e) {
        console.warn('[ToD] sync participants save failed', e && e.message);
      }

      socket.join(roomCode);
      getRoomState(roomCode);

      const fresh = await Room.findOne({ code: roomCode }).lean();
      const playersWithAvt = await attachAvatarsToPlayers(Array.isArray(fresh && fresh.players) ? fresh.players : []);
      const state = getRoomState(roomCode);

      const roomStatus = fresh && (fresh.status || (fresh.isPlaying ? 'playing' : (fresh.isOpen ? 'open' : 'closed'))) || 'open';

      const payload = {
        roomCode: String(roomCode || (fresh && fresh.code || '')),
        host: fresh && (fresh.host || (fresh.players && fresh.players[0] && (fresh.players[0].name || fresh.players[0].displayName))) || null,
        status: roomStatus,
        participantsCount: Array.isArray(fresh.players) ? fresh.players.length : 0,
        players: playersWithAvt,
        createdAt: fresh && (fresh.createdAt || null),
        updatedAt: fresh && (fresh.updatedAt || null),
        state
      };

      socket.emit('tod-joined', payload);
      io.to(roomCode).emit('tod-joined', payload);
    } catch (e) {
      console.error('[ToD] tod-join error', e);
      socket.emit('tod-join-failed', { reason: 'Lỗi server' });
    }
  });

  socket.on('tod-start-round', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ code: roomCode }).lean();
      if (!room || !Array.isArray(room.players) || room.players.length < 1) return;
      await Room.updateOne({ _id: room._id }, { $set: { locked: true } }).catch(err => console.warn('[ToD] set locked failed', err && err.message));

      const state = getRoomState(roomCode);
      if (typeof state.currentIndex !== 'number') state.currentIndex = 0;

      const playersNorm = getPlayersFromRoom(room);
      if (!playersNorm.length) return;
      const currentPlayer = playersNorm[state.currentIndex % playersNorm.length].name;
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

      const playersNorm = getPlayersFromRoom(room);
      const currentAsked = playersNorm[state.currentIndex] && playersNorm[state.currentIndex].name;
      if (player === currentAsked) return;
      if (!state.votes) state.votes = [];
      if (!state.votes.some(v => v.player === player)) state.votes.push({ player, vote });

      const total = Math.max(0, (playersNorm.length - 1));
      const voted = state.votes.length;
      const acceptCount = state.votes.filter(v => v.vote === 'accept').length;

      io.to(roomCode).emit('tod-voted', { player, vote, acceptCount, voted, total });

      if (voted === total) {
        if (acceptCount >= Math.ceil(total / 2)) {
          io.to(roomCode).emit('tod-result', { result: 'accepted' });
          state.votes = [];
          state.currentIndex = (state.currentIndex + 1) % playersNorm.length;
          setTimeout(() => {
            const nextPlayer = playersNorm[state.currentIndex].name;
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
              player: playersNorm[state.currentIndex].name,
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
      const updates = {};
      if (newName) {
        updates['players.$.name'] = newName;
        updates['players.$.displayName'] = newName;
      }
      if (typeof avatar !== 'undefined') updates['players.$.avatar'] = avatar;

      await Room.updateOne({ code: roomCode, 'players.name': oldName }, { $set: updates }).catch(err => { console.warn('[ToD] profile update failed', err && err.message); return null; });
      await Room.updateOne({ code: roomCode, host: oldName }, { $set: { host: newName || oldName } }).catch(() => {});

      const fresh = await Room.findOne({ code: roomCode }).lean();
      if (!fresh) return;
      const playersWithAvt = await attachAvatarsToPlayers(fresh.players || []);
      const state = getRoomState(roomCode);

      const payload = {
        roomCode: fresh.code,
        host: fresh.host,
        status: fresh.status,
        participantsCount: Array.isArray(fresh.players) ? fresh.players.length : 0,
        players: playersWithAvt,
        createdAt: fresh.createdAt || null,
        updatedAt: fresh.updatedAt || null,
        state
      };

      io.to(roomCode).emit('tod-joined', payload);
    } catch (e) {
      console.error('[ToD] profile-updated handler error', e);
    }
  });

  socket.on('disconnecting', async () => {
    try {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      for (const rc of rooms) {
        try {
          const room = await Room.findOne({ code: rc });
          if (!room) continue;
        } catch (err) {
          console.error('[ToD] disconnect cleanup error for', rc, err);
        }
      }
    } catch (e) {
      console.error('[ToD] disconnecting handler error', e);
    }
  });
};