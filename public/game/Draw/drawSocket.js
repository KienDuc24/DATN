// backend/sockets/drawSocket.js

const fs = require('fs');
const path = require('path');
const Room = require('../../../models/Room'); 
const User = require('../../../models/User'); // Cần import User

// --- Cấu hình Game ---
const GAME_ID = 'DG';
const ROUND_TIME = 90; // Giây
const MAX_ROUNDS_PER_PLAYER = 1; // Số vòng mỗi người chơi được vẽ
const WORDS_PATH = path.resolve(__dirname, 'words.json');
let WORDS = []; 
try {
  const raw = fs.readFileSync(WORDS_PATH, 'utf8');
  WORDS = JSON.parse(raw || '[]');
} catch (err) {
  console.warn(`[${GAME_ID}] cannot load words.json`, err && err.message);
  WORDS = ["Lửa trại", "Cây nấm", "Thịt nướng", "Lều cắm trại", "Mặt trời", "Con sông"];
}
const ROOM_STATE = {}; 
const gameSocketMap = new Map();

// --- Helper Functions ---
function getRoomState(code) {
  if (!ROOM_STATE[code]) {
    ROOM_STATE[code] = { 
      currentIndex: 0, 
      currentWord: null, 
      drawer: null, 
      timer: ROUND_TIME, 
      guesses: new Set(),
      drawingData: [], 
      interval: null,
      scores: {} 
    };
  }
  return ROOM_STATE[code];
}

function getPlayersFromRoom(room) {
    if (!room) return [];
    let raw = room.players || [];
    return raw.map(p => ({ name: p.name, displayName: p.displayName || p.name, avatar: p.avatar || null }));
}

async function attachAvatarsToPlayers(players) {
  const names = (players || []).map(p => p.name).filter(Boolean);
  if (!names.length) {
    return players;
  }
  let users = [];
  try {
    users = await User.find({ username: { $in: names } }).lean();
  } catch (e) {
    console.warn('[Draw] attachAvatarsToPlayers user lookup failed', e && e.message);
    users = [];
  }
  
  const map = {};
  users.forEach(u => { map[u.username] = u; });

  return (players || []).map(p => {
    const user = map[p.name];
    const avatar = p.avatar || (user ? (user.avatarUrl || user.avatar || null) : null);
    const outDisplayName = p.displayName || (user ? (user.displayName || user.name || null) : null);
    
    return { name: p.name, displayName: outDisplayName || null, avatar: avatar || null };
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


// --- SỬA LOGIC TÍNH ĐIỂM TRONG endRound ---
async function endRound(io, roomCode, guessed) {
    const state = getRoomState(roomCode);
    if (state.interval) clearInterval(state.interval);

    const room = await Room.findOne({ code: roomCode }).lean();
    if (!room) return; 
    const players = getPlayersFromRoom(room);
    const totalGuessers = state.guesses.size;
    
    if (totalGuessers > 0) {
        const drawerScore = 100 + (totalGuessers * 5);
        updateScores(state, state.drawer, drawerScore);
    }
    
    io.to(roomCode).emit(`${GAME_ID}-end-round`, { 
        word: state.currentWord, 
        scores: state.scores,
        drawer: state.drawer,
        guessed: guessed
    });

    const maxTotalRounds = await getMaxRounds(roomCode);
    state.currentIndex++;
    
    if (state.currentIndex >= maxTotalRounds) { 
        // KẾT THÚC GAME
        io.to(roomCode).emit(`${GAME_ID}-game-over`, { finalScores: state.scores });
        
        // KHÔNG RESET ĐIỂM Ở ĐÂY. Chờ Host bấm "Chơi Lại".
        state.drawer = null; // Đánh dấu game đã kết thúc
        return; 
    }
    
    setTimeout(() => {
        startRound(io, roomCode);
    }, 5000); 
}

async function startRound(io, roomCode) {
    const room = await Room.findOne({ code: roomCode }).lean();
    if (!room) return;
    const players = getPlayersFromRoom(room);
    if (players.length < 2) {
        io.to(roomCode).emit(`${GAME_ID}-message`, { message: 'Cần tối thiểu 2 người để chơi.' });
        return;
    }
    
    const state = getRoomState(roomCode);
    
    // Reset trạng thái vòng
    state.currentWord = getRandomWord();
    state.drawer = players[state.currentIndex % players.length].name;
    state.timer = ROUND_TIME;
    state.guesses = new Set();
    state.drawingData = [];

    // Gửi tín hiệu bắt đầu vòng cho tất cả
    io.to(roomCode).emit(`${GAME_ID}-start-round`, { 
        drawer: state.drawer, 
        scores: state.scores,
        round: state.currentIndex + 1,
        playersCount: players.length,
        wordHint: state.currentWord.length 
    });

    // Chỉ gửi từ khóa bí mật cho Họa sĩ
    const drawerSocketId = Array.from(gameSocketMap.entries())
                               .find(([, info]) => info.player === state.drawer && info.code === roomCode);
                               
    if (drawerSocketId) {
        io.to(drawerSocketId[0]).emit(`${GAME_ID}-secret-word`, { word: state.currentWord });
    }
    
    // Bắt đầu đếm ngược
    startTimer(io, roomCode);
}

// --- MODULE EXPORT ---
module.exports = (socket, io) => {
    console.log(`[${GAME_ID}] handler attached for socket ${socket.id}`);
    
    // --- 1. QUẢN LÝ PHÒNG VÀ THAM GIA ---
    socket.on(`${GAME_ID}-join`, async ({ roomCode, player }) => {
        try {
            const room = await Room.findOne({ code: roomCode }).lean();
            const isPlayerInRoom = room.players.some(p => p.name === player.name);
            if (!isPlayerInRoom) return socket.emit(`${GAME_ID}-join-failed`, { reason: 'Bạn không có trong danh sách phòng này.' });

            socket.join(roomCode);
            gameSocketMap.set(socket.id, { player: player.name, code: roomCode });
            getRoomState(roomCode);
            
            const playersWithAvt = await attachAvatarsToPlayers(room.players);

            io.to(roomCode).emit(`${GAME_ID}-room-update`, { 
                state: getRoomState(roomCode), 
                room: { ...room, players: playersWithAvt }
            });

        } catch (e) { console.error(`[${GAME_ID}] join error`, e); }
    });

    // --- 2. BẮT ĐẦU VÒNG ---
    socket.on(`${GAME_ID}-start-game`, async ({ roomCode }) => {
        const room = await Room.findOne({ code: roomCode });
        if (room && room.host === gameSocketMap.get(socket.id).player) {
            const state = getRoomState(roomCode);
            if (state.drawer) return; // Đã có vòng đang chạy
            state.currentIndex = 0;
            startRound(io, roomCode);
        }
    });

    // --- 3. ĐỒNG BỘ NÉT VẼ ---
    socket.on(`${GAME_ID}-draw`, ({ roomCode, data }) => {
        const state = getRoomState(roomCode);
        const playerInfo = gameSocketMap.get(socket.id);

        if (playerInfo && playerInfo.player === state.drawer) {
            // (Không cần lưu data vẽ, chỉ phát sóng)
            socket.to(roomCode).emit(`${GAME_ID}-drawing`, data);
        }
    });
    
    // Xóa/Làm mới canvas
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
            // Thay socket.to bằng io.to để gửi cho TẤT CẢ (bao gồm người gửi, đảm bảo đồng bộ)
            io.to(roomCode).emit(`${GAME_ID}-fill-canvas`, { color });
            console.log(`[Socket] Fill broadcasted to room ${roomCode} with color: ${color}`);
        }
    });

    // --- 4. XỬ LÝ ĐOÁN ---
    socket.on(`${GAME_ID}-guess`, async ({ roomCode, player, guess }) => {
        const state = getRoomState(roomCode);
        const drawer = state.drawer;
        
        // Họa sĩ chỉ được chat thông thường
        if (player === drawer) { 
             return io.to(roomCode).emit(`${GAME_ID}-chat-message`, { player: player, message: guess });
        }

        io.to(roomCode).emit(`${GAME_ID}-chat-message`, { 
            player: player, 
            message: guess 
        });

        if (isCorrectGuess(guess, state.currentWord)) {
            if (state.guesses.has(player)) return; // Đã đoán đúng rồi

            // TÍNH ĐIỂM NGƯỜI ĐOÁN
            const remainingTime = state.timer > 0 ? state.timer : 0;
            const guesserScore = 50 + remainingTime; // 50 điểm cơ bản + 1 điểm/giây còn lại
            updateScores(state, player, guesserScore);
            
            state.guesses.add(player);
            
            io.to(roomCode).emit(`${GAME_ID}-correct-guess`, { 
                player: player, 
                scores: state.scores,
                time: remainingTime 
            });

            // LOGIC CHUYỂN LƯỢT NẾU ĐOÁN HẾT
            const room = await Room.findOne({ code: roomCode }).lean();
            const totalGuessers = Math.max(0, getPlayersFromRoom(room).length - 1);
            
            if (state.guesses.size >= totalGuessers) { 
                 // Nếu tất cả đã đoán đúng, kết thúc vòng ngay lập tức
                 endRound(io, roomCode, true);
            }
        }
    });

    // --- 5. DISCONNECT ---
    socket.on('disconnect', async () => {
        const userInfo = gameSocketMap.get(socket.id);
        if (!userInfo) return; 

        const { player, code } = userInfo;
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
                await User.findOneAndUpdate({ username: player }, { status: 'online' });
                io.emit('admin-user-status-changed');
                console.log(`[Draw] User ${player} disconnected, status set to 'online'.`);
            }

            const playersWithAvt = await attachAvatarsToPlayers(room.players);
            const state = getRoomState(code);

            io.to(code).emit(`${GAME_ID}-room-update`, { 
                state, 
                room: { code: room.code, host: newHost, players: playersWithAvt }
            });
            io.emit('admin-rooms-changed'); 
            
            io.to(code).emit(`${GAME_ID}-chat-message`, { 
                player: 'Hệ thống', 
                message: `${player} đã rời phòng.`, 
                type: 'msg-system' 
            });

        } catch (e) {
            console.error(`[${GAME_ID}] Lỗi xử lý disconnect của ${player} trong phòng ${code}:`, e);
        }
    });
    // --- 6. BỔ SUNG: LOGIC CHƠI LẠI (RESET ĐIỂM) ---
    socket.on(`${GAME_ID}-restart-game`, async ({ roomCode }) => {
        const state = getRoomState(roomCode);
        const room = await Room.findOne({ code: roomCode });
        const playerInfo = gameSocketMap.get(socket.id);

        // Chỉ Host mới được quyền reset game
        if (room && playerInfo && room.host === playerInfo.player) {
            
            // RESET ĐIỂM VÀ TRẠNG THÁI
            state.scores = {};
            state.currentIndex = 0;
            state.drawer = null;
            state.guesses = new Set();
            state.currentWord = null;
            if (state.interval) clearInterval(state.interval);
            
            console.log(`[${GAME_ID}] Game ${roomCode} được Host reset.`);

            // Gửi trạng thái đã reset về cho mọi người
            // Client (script.js) sẽ nhận 'room-update' và hiển thị lại nút "Bắt đầu Game" cho Host
            const playersWithAvt = await attachAvatarsToPlayers(room.players);
            io.to(roomCode).emit(`${GAME_ID}-room-update`, { 
                state: getRoomState(roomCode), 
                room: { ...room.toObject(), players: playersWithAvt } // Gửi lại full room info
            });
        }
    });
};