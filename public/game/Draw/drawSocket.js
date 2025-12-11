const fs = require('fs');
const path = require('path');
const Room = require('../../../models/Room'); 
const User = require('../../../models/User');  

const GAME_ID = 'DG';
const ROUND_TIME = 90; 
const MAX_ROUNDS_PER_PLAYER = 1; 
const WORDS_PATH = path.resolve(__dirname, 'words.json');
let WORDS = []; 

try {
  const raw = fs.readFileSync(WORDS_PATH, 'utf8');
  WORDS = JSON.parse(raw || '[]');
} catch (err) {
  console.warn(`[${GAME_ID}] cannot load words.json`, err && err.message);
}

const ROOM_STATE = {}; 
const gameSocketMap = new Map();

function getRoomState(code) {
  if (!ROOM_STATE[code]) {
    ROOM_STATE[code] = { 
        currentIndex: 0, 
        currentWord: null, 
        drawer: null, 
        timer: null, 
        guesses: new Set(), 
        drawingData: [], 
        interval: null, 
        scores: {} 
    };
  }
  return ROOM_STATE[code];
}

function getSafeState(code) {
    const state = getRoomState(code);
    const safeState = { ...state };
    
    delete safeState.interval; 
    delete safeState.timer;     
    
    if (safeState.guesses instanceof Set) {
        safeState.guesses = Array.from(safeState.guesses);
    }
    
    return safeState;
}

function getPlayersFromRoom(room) {
    if (!room) return [];
    let raw = room.players || [];
    return raw.map(p => ({ name: p.name, displayName: p.displayName || p.name, avatar: null }));
}

async function attachAvatarsToPlayers(players) {
  const names = (players || []).map(p => p.name).filter(Boolean);
  if (!names.length) return players;
  let users = [];
  try {
    users = await User.find({ username: { $in: names } }).lean().select('username displayName name');
  } catch (e) { users = []; }
  const map = {};
  users.forEach(u => { map[u.username] = u; });
  return (players || []).map(p => {
    const user = map[p.name];
    const outDisplayName = p.displayName || (user ? (user.displayName || user.name) : p.name);
    return { name: p.name, displayName: outDisplayName || null, avatar: null };
  });
}

function getRandomWord() {
    if (!WORDS.length) return "Lửa trại";
    return WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
}

function isCorrectGuess(guess, word) {
    if (!word) return false;
    const normalizedWord = word.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const normalizedGuess = guess.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return normalizedGuess === normalizedWord;
}

function startTimer(io, roomCode) {
    const state = getRoomState(roomCode);
    if (state.interval) clearInterval(state.interval);
    state.interval = setInterval(() => {
        state.timer--;
        io.to(roomCode).emit(`${GAME_ID}-timer`, { time: state.timer });
        if (state.timer <= 0) {
            clearInterval(state.interval);
            endRound(io, roomCode, false); 
        }
    }, 1000);
}

function updateScores(state, player, score) {
    if (!state.scores[player]) state.scores[player] = 0;
    state.scores[player] += score;
}

async function getMaxRounds(roomCode) {
    const room = await Room.findOne({ code: roomCode }).lean();
    if (!room) return 0;
    const players = getPlayersFromRoom(room);
    return players.length * MAX_ROUNDS_PER_PLAYER;
}

async function endRound(io, roomCode, guessed) {
    const state = getRoomState(roomCode);
    if (state.interval) clearInterval(state.interval);
    const room = await Room.findOne({ code: roomCode }).lean();
    if (!room) return; 
    
    const totalGuessers = state.guesses.size;
    if (totalGuessers > 0) {
        const drawerScore = 100 + (totalGuessers * 5);
        updateScores(state, state.drawer, drawerScore);
    }
    
    io.to(roomCode).emit(`${GAME_ID}-end-round`, { 
        word: state.currentWord, scores: state.scores, drawer: state.drawer, guessed: guessed
    });
    
    const drawerSocketId = Array.from(gameSocketMap.entries()).find(([, info]) => info.player === state.drawer && info.code === roomCode);
    if (drawerSocketId) {
        io.to(drawerSocketId[0]).emit(`${GAME_ID}-secret-word`, { word: state.currentWord });
    }
    
    const maxTotalRounds = await getMaxRounds(roomCode);
    state.currentIndex++;
    
    if (state.currentIndex >= maxTotalRounds) { 
        io.to(roomCode).emit(`${GAME_ID}-game-over`, { finalScores: state.scores });
        state.drawer = null; 
        return; 
    }
    
    setTimeout(() => { startRound(io, roomCode); }, 5000); 
}

async function startRound(io, roomCode) {
    const room = await Room.findOne({ code: roomCode }).lean();
    if (!room) return;
    const players = getPlayersFromRoom(room);
    
    const state = getRoomState(roomCode);
    state.currentWord = getRandomWord();
    state.drawer = players[state.currentIndex % players.length].name;
    state.timer = ROUND_TIME;
    state.guesses = new Set();
    state.drawingData = [];
    
    io.to(roomCode).emit(`${GAME_ID}-start-round`, { 
        drawer: state.drawer, scores: state.scores, round: state.currentIndex + 1,
        playersCount: players.length, wordHint: state.currentWord.length 
    });

    const drawerSocketId = Array.from(gameSocketMap.entries()).find(([, info]) => info.player === state.drawer && info.code === roomCode);
    if (drawerSocketId) {
        io.to(drawerSocketId[0]).emit(`${GAME_ID}-secret-word`, { word: state.currentWord });
    }
    startTimer(io, roomCode);
}

module.exports = (socket, io) => {
    console.log(`[${GAME_ID}] handler attached for socket ${socket.id}`);
    
    socket.on(`${GAME_ID}-join`, async ({ roomCode, player }) => {
        try {
            const room = await Room.findOne({ code: roomCode }).lean();
            const isPlayerInRoom = room.players.some(p => p.name === player.name);
            if (!isPlayerInRoom) return socket.emit(`${GAME_ID}-join-failed`, { reason: 'Bạn không có trong danh sách.' });

            socket.join(roomCode);
            
            const playerInRoom = room.players.find(p => p.name === player.name);
            const dName = playerInRoom ? (playerInRoom.displayName || playerInRoom.name) : player.name;
            
            gameSocketMap.set(socket.id, { player: player.name, displayName: dName, code: roomCode });

            getRoomState(roomCode); 
            
            const playersWithAvt = await attachAvatarsToPlayers(room.players);
            
            io.to(roomCode).emit(`${GAME_ID}-room-update`, { 
                state: getSafeState(roomCode), 
                room: { ...room, players: playersWithAvt }
            });
        } catch (e) { console.error(`[${GAME_ID}] join error`, e); }
    });

    socket.on(`${GAME_ID}-start-game`, async ({ roomCode }) => {
        const room = await Room.findOne({ code: roomCode });
        if (room && room.host === gameSocketMap.get(socket.id).player) {
            const state = getRoomState(roomCode);
            if (state.drawer) return; 
            state.currentIndex = 0;
            startRound(io, roomCode);
        }
    });

    socket.on(`${GAME_ID}-restart-game`, async ({ roomCode }) => {
        const state = getRoomState(roomCode);
        const room = await Room.findOne({ code: roomCode });
        const playerInfo = gameSocketMap.get(socket.id);
        
        if (room && playerInfo && room.host === playerInfo.player) {
            if (state.interval) clearInterval(state.interval);
            
            state.scores = {};
            state.currentIndex = 0;
            state.drawer = null;
            state.guesses = new Set();
            state.currentWord = null;
            state.drawingData = [];
            
            const playersWithAvt = await attachAvatarsToPlayers(room.players);
            
            io.to(roomCode).emit(`${GAME_ID}-room-update`, { 
                state: getSafeState(roomCode), 
                room: { ...room.toObject(), players: playersWithAvt } 
            });
            
            io.to(roomCode).emit(`${GAME_ID}-game-restarted`);
            
            setTimeout(() => {
                startRound(io, roomCode);
            }, 3000);
        }
    });

    socket.on(`${GAME_ID}-draw`, ({ roomCode, data }) => {
        const state = getRoomState(roomCode);
        const playerInfo = gameSocketMap.get(socket.id);
        if (playerInfo && playerInfo.player === state.drawer) {
            socket.to(roomCode).emit(`${GAME_ID}-drawing`, data);
        }
    });
    
    socket.on(`${GAME_ID}-clear`, ({ roomCode }) => {
        const state = getRoomState(roomCode);
        const playerInfo = gameSocketMap.get(socket.id);
        if (playerInfo && playerInfo.player === state.drawer) {
            state.drawingData = [];
            socket.to(roomCode).emit(`${GAME_ID}-clear-canvas`);
        }
    });

    socket.on(`${GAME_ID}-fill`, ({ roomCode, color }) => {
        const state = getRoomState(roomCode);
        const playerInfo = gameSocketMap.get(socket.id);
        if (playerInfo && playerInfo.player === state.drawer) {
            io.to(roomCode).emit(`${GAME_ID}-fill-canvas`, { color });
        }
    });

    socket.on(`${GAME_ID}-guess`, async ({ roomCode, player, guess }) => {
        const state = getRoomState(roomCode);
        const drawer = state.drawer;
        
        if (player === drawer) { 
             return io.to(roomCode).emit(`${GAME_ID}-chat-message`, { player: player, message: guess });
        }

        io.to(roomCode).emit(`${GAME_ID}-chat-message`, { player: player, message: guess });

        if (isCorrectGuess(guess, state.currentWord)) {
            if (state.guesses.has(player)) return; 
            
            const remainingTime = state.timer > 0 ? state.timer : 0;
            const guesserScore = 50 + remainingTime; 
            updateScores(state, player, guesserScore);
            state.guesses.add(player);
            
            io.to(roomCode).emit(`${GAME_ID}-correct-guess`, { 
                player: player, scores: state.scores, time: remainingTime 
            });

            const room = await Room.findOne({ code: roomCode }).lean();
            const totalGuessers = Math.max(0, getPlayersFromRoom(room).length - 1);
            
            if (state.guesses.size >= totalGuessers) {
                endRound(io, roomCode, true);
            }
        }
    });

    socket.on('disconnect', async () => {
        const userInfo = gameSocketMap.get(socket.id);
        if (!userInfo) return; 
        const { player, code, displayName } = userInfo; 
        gameSocketMap.delete(socket.id); 

        try {
            const room = await Room.findOne({ code });
            if (!room) return;
            
            let newHost = room.host;
            const wasHost = (room.host === player);
            
            room.players = room.players.filter(p => p.name !== player);
            
            if (wasHost && room.players.length > 0) {
                newHost = room.players[0].name;
                room.host = newHost;
            } else if (room.players.length === 0) {
                room.status = 'closed';
                delete ROOM_STATE[code]; 
                await room.save();
                io.emit('admin-rooms-changed'); 
                return; 
            }
            await room.save();
            
            if (!player.startsWith('guest_')) {
                await User.findOneAndUpdate({ username: player }, { status: 'offline', socketId: null });
                io.emit('admin-user-status-changed');
            }
            
            const playersWithAvt = await attachAvatarsToPlayers(room.players);
            
            io.to(code).emit(`${GAME_ID}-room-update`, { 
                state: getSafeState(code), 
                room: { code: room.code, host: newHost, players: playersWithAvt } 
            });
            
            io.emit('admin-rooms-changed'); 
            
            const nameToShow = displayName || player;
            io.to(code).emit(`${GAME_ID}-chat-message`, { 
                player: 'Hệ thống', message: `${nameToShow} đã rời phòng.`, type: 'msg-system' 
            });
        } catch (e) { console.error(`[${GAME_ID}] disconnect error`, e); }
    });

    socket.on(`${GAME_ID}-assign-host`, async ({ roomCode, newHostName }) => {
        try {
            const room = await Room.findOne({ code: roomCode });
            const playerInfo = gameSocketMap.get(socket.id);
            if (room && playerInfo && room.host === playerInfo.player) {
                const exists = room.players.some(p => p.name === newHostName);
                if (exists) {
                    room.host = newHostName;
                    await room.save();
                    const playersWithAvt = await attachAvatarsToPlayers(room.players);
                    
                    io.to(roomCode).emit(`${GAME_ID}-room-update`, { 
                        state: getSafeState(roomCode),
                        room: { ...room.toObject(), players: playersWithAvt }
                    });
                    
                    io.to(roomCode).emit('update-players', { list: room.players, host: newHostName });
                    io.emit('admin-rooms-changed');
                    
                    const newHostObj = room.players.find(p => p.name === newHostName);
                    const newHostDisplay = newHostObj ? (newHostObj.displayName || newHostName) : newHostName;
                    
                    io.to(roomCode).emit(`${GAME_ID}-chat-message`, {
                        player: 'Hệ thống', message: `👑 Chủ phòng đã được chuyển cho ${newHostDisplay}`, type: 'msg-system'
                    });
                }
            }
        } catch (e) {}
    });
};