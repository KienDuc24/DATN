// public/game/ToD/todSocket.js

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') }); 
const Room = require('../../../models/Room');
const User = require('../../../models/User');

const gameSocketMap = new Map();

// (Giữ nguyên các hàm helper: QUESTIONS, getRoomState, getRandomQuestion, normalizePlayerInput, attachAvatarsToPlayers, getPlayersFromRoom)
const QUESTIONS_PATH = path.resolve(__dirname, '../../../public/game/ToD/questions.json');
let QUESTIONS = { truth: [], dare: [] };
try {
  const raw = fs.readFileSync(QUESTIONS_PATH, 'utf8');
  QUESTIONS = JSON.parse(raw || '{}');
} catch (err) {
  QUESTIONS = { truth: ["Bạn có bí mật nào chưa kể với mọi người không?"], dare: ["Hát một đoạn bài hát trước mọi người."] };
}
const ROOM_STATE = {}; 
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

// --- MODULE EXPORT ---
module.exports = (socket, io) => {
  console.log(`[ToD] handler attached for socket ${socket.id}`);

  socket.on('tod-who', async ({ roomCode }) => {
    try {
      const state = getRoomState(roomCode || '');
      if (!roomCode) {
        return socket.emit('tod-joined', { roomCode: '', host: null, status: 'open', participantsCount: 0, players: [], createdAt: null, updatedAt: null, state });
      }
      const room = await Room.findOne({ code: roomCode }).lean(); 
      if (!room) {
        return socket.emit('tod-joined', { roomCode: String(roomCode), host: null, status: 'open', participantsCount: 0, players: [], createdAt: null, updatedAt: null, state });
      }
      const playersArr = getPlayersFromRoom(room);
      const playersWithAvt = await attachAvatarsToPlayers(playersArr);
      const roomStatus = room.status || 'open';
      const payload = {
        roomCode: room.code, host: room.host, status: roomStatus,
        participantsCount: playersArr.length, players: playersWithAvt,
        createdAt: room.createdAt || null, updatedAt: room.updatedAt || null, state
      };
      socket.emit('tod-joined', payload);
      io.to(roomCode).emit('tod-joined', payload);
    } catch (e) { console.error('[ToD] tod-who error', e); }
  });

  socket.on('tod-join', async ({ roomCode, player }) => {
    try {
      console.log('[ToD] tod-join received', { socketId: socket.id, roomCode, player });
      const room = await Room.findOne({ code: roomCode }).lean(); 
      if (!room) {
        return socket.emit('tod-join-failed', { reason: 'Phòng không tồn tại, đã kết thúc, hoặc chưa bắt đầu.' });
      }
      const normalizedInput = normalizePlayerInput(player);
      if (!normalizedInput) return socket.emit('tod-join-failed', { reason: 'Invalid player' });
      const playerName = normalizedInput.name;
      const isPlayerInRoom = room.players.some(p => p.name === playerName);
      if (!isPlayerInRoom) {
        return socket.emit('tod-join-failed', { reason: 'Bạn không có trong danh sách phòng này.' });
      }

      socket.join(roomCode);
      gameSocketMap.set(socket.id, { player: playerName, code: roomCode });
      getRoomState(roomCode);
      
      // THÊM: Cập nhật status người chơi
      if (!playerName.startsWith('guest_')) {
          await User.findOneAndUpdate({ username: playerName }, { status: 'playing' });
          io.emit('admin-user-status-changed');
      }

      const playersWithAvt = await attachAvatarsToPlayers(room.players);
      const state = getRoomState(roomCode);
      const payload = {
        roomCode: room.code, host: room.host, status: room.status,
        participantsCount: room.players.length, players: playersWithAvt,
        createdAt: room.createdAt || null, updatedAt: room.updatedAt || null, state
      };
      io.to(roomCode).emit('tod-joined', payload);
    } catch (e) {
      console.error('[ToD] tod-join error', e);
      socket.emit('tod-join-failed', { reason: 'Lỗi server khi vào phòng game.' });
    }
  });

  socket.on('tod-start-round', async ({ roomCode }) => {
     try {
      const room = await Room.findOne({ code: roomCode });
      if (!room || !Array.isArray(room.players) || room.players.length < 1) return;
      if (room.status !== 'playing') {
          room.status = 'playing';
          await room.save();
          io.emit('admin-rooms-changed'); // Cập nhật admin
      }
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
      const playersNorm = getPlayersFromRoom(room);
      const totalVoters = Math.max(0, (playersNorm.length - 1));
      const question = getRandomQuestion(choice || 'truth');
      state.lastChoice = choice;
      state.lastQuestion = question;
      state.votes = [];
      io.to(roomCode).emit('tod-question', { player, choice, question, totalVoters });
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
      if (playersNorm.length <= 1) return; 
      const currentAsked = playersNorm[state.currentIndex % playersNorm.length].name;
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
            const nextPlayer = playersNorm[state.currentIndex % playersNorm.length].name;
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
              player: playersNorm[state.currentIndex % playersNorm.length].name,
              choice: lastChoice,
              question: newQ,
              totalVoters: total
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
        roomCode: fresh.code, host: fresh.host, status: fresh.status,
        participantsCount: Array.isArray(fresh.players) ? fresh.players.length : 0,
        players: playersWithAvt, createdAt: fresh.createdAt || null,
        updatedAt: fresh.updatedAt || null, state
      };
      io.to(roomCode).emit('tod-joined', payload);
      io.emit('admin-rooms-changed'); // Cập nhật admin
    } catch (e) {
      console.error('[ToD] profile-updated handler error', e);
    }
  });

  socket.on('disconnecting', async () => {
    try {
      const userInfo = gameSocketMap.get(socket.id);
      if (!userInfo) {
        return; 
      }
      const { player, code } = userInfo;
      gameSocketMap.delete(socket.id); 

      const room = await Room.findOne({ code: code });
      if (!room) return;
      let newHost = room.host;
      const wasHost = (room.host === player);
      
      room.players = room.players.filter(p => p.name !== player);
      
      if (wasHost && room.players.length > 0) {
        newHost = room.players[0].name;
        room.host = newHost;
        console.log(`[ToD] Host ${player} disconnected. New host is ${newHost}.`);
      } else if (room.players.length === 0) {
        // SỬA: Cập nhật status thay vì xóa
        room.status = 'closed';
        await room.save();
        delete ROOM_STATE[code]; 
        console.log(`[ToD] Room ${code} is empty and set to 'closed'.`);
        io.emit('admin-rooms-changed'); // Cập nhật admin
        return; 
      }

      await room.save();
      
      // THÊM: Cập nhật status người chơi
      if (!player.startsWith('guest_')) {
          await User.findOneAndUpdate({ username: player }, { status: 'online' });
          io.emit('admin-user-status-changed');
      }
      
      const playersWithAvt = await attachAvatarsToPlayers(room.players);
      const payload = {
        roomCode: room.code, host: newHost, status: room.status,
        participantsCount: room.players.length, players: playersWithAvt,
        createdAt: room.createdAt || null, updatedAt: room.updatedAt || null, state: getRoomState(code)
      };
      io.to(code).emit('tod-joined', payload);
      io.emit('admin-rooms-changed'); // Cập nhật admin

    } catch (e) {
      console.error('[ToD] disconnecting handler error', e);
    }
  });
};