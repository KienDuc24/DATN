// public/game/ToD/todSocket.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') }); 
const Room = require('../../../models/Room');
const User = require('../../../models/User');

const gameSocketMap = new Map();

const QUESTIONS_PATH = path.resolve(__dirname, 'questions.json');
let QUESTIONS = { truth: [], dare: [] };
try {
  const raw = fs.readFileSync(QUESTIONS_PATH, 'utf8');
  QUESTIONS = JSON.parse(raw || '{}');
  console.log('[ToD] questions loaded.');
} catch (err) {
  console.warn('[ToD] cannot load questions.json', err.message);
  QUESTIONS = { truth: ["Bạn có bí mật nào không?"], dare: ["Hát một bài."] };
}

// --- Helper Functions ---
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
    const nameRaw = input.name || input.username || input.displayName || '';
    const name = (typeof nameRaw === 'string' ? nameRaw : String(nameRaw || '')).trim();
    const displayName = input.displayName || null;
    const email = input.email || null;
    if (!name && !displayName && !email) return null;
    return { name: name || displayName || email, displayName: displayName || null, avatar: null, email };
  }
  return null;
}

async function attachAvatarsToPlayers(players) {
  const normalized = (players || []).map(p => normalizePlayerInput(p)).filter(Boolean);
  const names = normalized.map(p => p.name).filter(Boolean);
  
  if (!names.length) {
    return normalized.map(p => ({ name: p.name, displayName: p.displayName || null, avatar: null }));
  }
  
  let users = [];
  try {
    users = await User.find({ username: { $in: names } }).lean().select('username displayName name');
  } catch (e) {
    console.warn('[ToD] attachAvatarsToPlayers lookup failed', e.message);
    users = [];
  }
  
  const map = {};
  users.forEach(u => { if (u.username) map[u.username] = u; });
  
  return normalized.map(p => {
    const user = map[p.name];
    const avatar = null;
    const outDisplayName = p.displayName || (user ? (user.displayName || user.name) : p.name);
    return { name: p.name, displayName: outDisplayName || null, avatar: avatar };
  });
}

function getPlayersFromRoom(room) {
  if (!room) return [];
  let raw = [];
  if (Array.isArray(room.players)) raw = room.players;
  
  return raw.map(p => {
    const np = normalizePlayerInput(p);
    if (!np) return null;
    return { name: np.name, displayName: np.displayName || null, avatar: null };
  }).filter(Boolean);
}

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
        roomCode: room.code,
        host: room.host,
        status: roomStatus,
        participantsCount: playersArr.length,
        players: playersWithAvt,
        createdAt: room.createdAt || null,
        updatedAt: room.updatedAt || null,
        state
      };

      socket.emit('tod-joined', payload);
      io.to(roomCode).emit('tod-joined', payload);
    } catch (e) { console.error('[ToD] tod-who error', e); }
  });

  socket.on('tod-join', async ({ roomCode, player }) => {
    try {
      const room = await Room.findOne({ code: roomCode }).lean(); 
      if (!room) return socket.emit('tod-join-failed', { reason: 'Phòng không tồn tại.' });

      const normalizedInput = normalizePlayerInput(player);
      if (!normalizedInput) return socket.emit('tod-join-failed', { reason: 'Invalid player' });
      const playerName = normalizedInput.name;

      const isPlayerInRoom = room.players.some(p => p.name === playerName);
      if (!isPlayerInRoom) return socket.emit('tod-join-failed', { reason: 'Bạn không có trong danh sách phòng này.' });

      socket.join(roomCode);
      gameSocketMap.set(socket.id, { player: playerName, code: roomCode });
      getRoomState(roomCode);
      
      const playersWithAvt = await attachAvatarsToPlayers(room.players);
      const state = getRoomState(roomCode);

      const payload = {
        roomCode: room.code,
        host: room.host,
        status: room.status,
        participantsCount: room.players.length,
        players: playersWithAvt,
        createdAt: room.createdAt || null,
        updatedAt: room.updatedAt || null,
        state
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
      const state = getRoomState(roomCode);
      if (typeof state.currentIndex !== 'number') state.currentIndex = 0;

      const playersNorm = getPlayersFromRoom(room);
      if (!playersNorm.length) return;
      const currentPlayer = playersNorm[state.currentIndex % playersNorm.length].name;
      io.to(roomCode).emit('tod-your-turn', { player: currentPlayer });
    } catch (e) { console.error('[ToD] tod-start-round error', e); }
  });

  socket.on('tod-choice', async ({ roomCode, player, choice }) => {
     try {
      const room = await Room.findOne({ code: roomCode });
      if (!room) return;
      const state = getRoomState(roomCode);
      const playersNorm = getPlayersFromRoom(room);
      const totalVoters = Math.max(0, (playersNorm.length - 1));
      const question = getRandomQuestion(choice || 'truth');
      state.lastChoice = choice;
      state.lastQuestion = question;
      state.votes = [];
      io.to(roomCode).emit('tod-question', { player, choice, question, totalVoters });
    } catch (e) { console.error('[ToD] tod-choice error', e); }
  });

  socket.on('tod-vote', async ({ roomCode, player, vote }) => {
     try {
      const room = await Room.findOne({ code: roomCode });
      if (!room) return;
      const state = getRoomState(roomCode);

      const playersNorm = getPlayersFromRoom(room);
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
    } catch (e) { console.error('[ToD] tod-vote error', e); }
  });

  socket.on('disconnecting', async () => {
    const userInfo = gameSocketMap.get(socket.id);
    if (!userInfo) return;
    const { player, code } = userInfo;
    gameSocketMap.delete(socket.id);
    try {
        const room = await Room.findOne({ code });
        if(!room) return;
        let newHost = room.host;
        const wasHost = (room.host === player);
        room.players = room.players.filter(p => p.name !== player);
        
        if (wasHost && room.players.length > 0) {
            newHost = room.players[0].name;
            room.host = newHost;
        } else if (room.players.length === 0) {
            room.status = 'closed';
            await room.save();
            delete ROOM_STATE[code];
            io.emit('admin-rooms-changed');
            return;
        }
        await room.save();
        if (!player.startsWith('guest_')) {
            await User.findOneAndUpdate({ username: player }, { status: 'online' });
            io.emit('admin-user-status-changed');
        }
        const playersWithAvt = await attachAvatarsToPlayers(room.players);
        const payload = {
            roomCode: room.code, host: newHost, status: room.status,
            participantsCount: room.players.length, players: playersWithAvt,
            state: getRoomState(code)
        };
        io.to(code).emit('tod-joined', payload);
        io.emit('admin-rooms-changed');
    } catch(e) { console.error(e); }
  });
};