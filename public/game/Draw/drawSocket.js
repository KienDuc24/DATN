// backend/sockets/drawGuessSocket.js

const fs = require('fs');
const path = require('path');
// (Giả định Room và User model đã được định nghĩa)
const Room = require('../../../models/Room'); 
const User = require('../../../models/User'); 

// --- Cấu hình Game ---
const GAME_ID = 'DG';
const ROUND_TIME = 90; // Giây
const WORDS_PATH = path.resolve(__dirname, '../../../public/game/Draw/words.json');
let WORDS = []; 
try {
  const raw = fs.readFileSync(WORDS_PATH, 'utf8');
  WORDS = JSON.parse(raw || '[]');
  console.log(`[${GAME_ID}] words.json loaded ->`, WORDS_PATH, 'words:', WORDS.length);
} catch (err) {
  console.warn(`[${GAME_ID}] cannot load words.json`, err && err.message);
  WORDS = ["Lửa trại", "Cây nấm", "Thịt nướng", "Lều cắm trại", "Mặt trời", "Con sông"];
}
const ROOM_STATE = {}; 
const gameSocketMap = new Map(); // Theo dõi người chơi đang tham gia

// --- Helper Functions (Tương tự ToD) ---
function getRoomState(code) {
  if (!ROOM_STATE[code]) {
    ROOM_STATE[code] = { 
      currentIndex: 0, 
      currentWord: null, 
      drawer: null, 
      timer: ROUND_TIME, 
      guesses: new Set(), // Lưu trữ những người đã đoán đúng
      drawingData: [], // Lưu trữ các nét vẽ
      interval: null,
      scores: {} 
    };
  }
  return ROOM_STATE[code];
}

function getPlayersFromRoom(room) {
    // Tái sử dụng logic lấy danh sách người chơi từ room model (như ToD)
    if (!room) return [];
    let raw = [];
    if (Array.isArray(room.players) && room.players.length) raw = room.players;
    else if (Array.isArray(room.participants) && room.participants.length) raw = room.participants;
    else if (Array.isArray(room.playersList) && room.playersList.length) raw = room.playersList;
    else if (room.players && typeof room.players === 'object' && !Array.isArray(room.players)) raw = Object.values(room.players).filter(Boolean);
    else return [];
    
    // Tái sử dụng logic normalize (giả định có sẵn normalizePlayerInput)
    // Giả định: raw.map(p => ({ name: p.name, displayName: p.displayName || p.name }))
    return raw.map(p => ({ name: p.name, displayName: p.displayName || p.name }));
}

function getRandomWord() {
    if (!WORDS.length) return "Lửa trại";
    return WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
}

function isCorrectGuess(guess, word) {
    if (!word) return false;
    const normalizedWord = word.toUpperCase().replace(/\s/g, '');
    const normalizedGuess = guess.toUpperCase().replace(/\s/g, '');
    // Logic đơn giản: đoán khớp hoàn toàn (có thể phức tạp hóa sau)
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

async function endRound(io, roomCode, guessed) {
    const state = getRoomState(roomCode);
    if (state.interval) clearInterval(state.interval);

    const timeBonus = state.timer > 0 ? (state.timer * 5) : 0;
    const baseScore = guessed ? 50 : 0;
    
    if (guessed) {
        // Tặng điểm cho Họa sĩ (dựa trên số lượng người đoán đúng)
        const drawerScore = 150 + (state.guesses.size * 25) + timeBonus;
        updateScores(state, state.drawer, drawerScore);
    }
    
    // Bỏ điểm của người chơi nếu không đoán được
    
    io.to(roomCode).emit(`${GAME_ID}-end-round`, { 
        word: state.currentWord, 
        scores: state.scores,
        drawer: state.drawer,
        guessed: guessed
    });

    // Chuyển sang lượt tiếp theo
    setTimeout(() => {
        state.currentIndex = (state.currentIndex + 1); 
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
        // Chỉ gửi độ dài từ khóa (hoặc từ khóa bị ẩn)
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
            // ... (Logic kiểm tra phòng, kiểm tra player tương tự ToD)
            const isPlayerInRoom = room.players.some(p => p.name === player.name);
            if (!isPlayerInRoom) return socket.emit(`${GAME_ID}-join-failed`, { reason: 'Bạn không có trong danh sách phòng này.' });

            socket.join(roomCode);
            gameSocketMap.set(socket.id, { player: player.name, code: roomCode });
            getRoomState(roomCode);
            io.to(roomCode).emit(`${GAME_ID}-room-update`, { state: getRoomState(roomCode), room: room });

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
            state.drawingData.push(data);
            // Phát sóng nét vẽ đến TẤT CẢ người chơi khác trong phòng
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

    // --- 4. XỬ LÝ ĐOÁN ---
    socket.on(`${GAME_ID}-guess`, ({ roomCode, player, guess }) => {
        const state = getRoomState(roomCode);
        const drawer = state.drawer;
        
        if (player === drawer) return; // Họa sĩ không được đoán

        io.to(roomCode).emit(`${GAME_ID}-chat-message`, { 
            player: player, 
            message: guess 
        });

        if (isCorrectGuess(guess, state.currentWord)) {
            if (state.guesses.has(player)) return; // Đã đoán đúng rồi

            updateScores(state, player, 100 + state.timer); // Điểm bonus dựa trên thời gian
            state.guesses.add(player);
            
            io.to(roomCode).emit(`${GAME_ID}-correct-guess`, { 
                player: player, 
                scores: state.scores 
            });

            const roomSockets = io.sockets.adapter.rooms.get(roomCode);
            const totalPlayers = roomSockets ? roomSockets.size : 0;
            const guessersCount = totalPlayers - 1; // Số người chơi trừ Họa sĩ

            // Nếu tất cả người chơi khác đã đoán đúng (hoặc gần hết)
            if (state.guesses.size >= (guessersCount - 1) && guessersCount > 1) { 
                 endRound(io, roomCode, true);
            }
        }
    });

    // --- 5. DISCONNECT ---
    socket.on('disconnecting', async () => {
        try {
          const userInfo = gameSocketMap.get(socket.id);
          if (!userInfo) {
            console.log(`[ToD] Disconnect: socket ${socket.id} not in gameSocketMap.`);
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
            // SỬA: Cập nhật status thành 'closed'
            room.status = 'closed';
            await room.save();
            delete ROOM_STATE[code]; 
            console.log(`[ToD] Room ${code} is empty and set to 'closed'.`);
            io.emit('admin-rooms-changed'); 
            return; 
          }
    
          await room.save();
          
          // SỬA: Xóa logic cập nhật status. socketServer.js sẽ xử lý
          // (Khi socket game disconnect, socket chính (nếu có) sẽ tự động registerSocket)
          // if (!player.startsWith('guest_')) {
          //     await User.findOneAndUpdate({ username: player }, { status: 'online' });
          //     io.emit('admin-user-status-changed');
          // }
          
          const playersWithAvt = await attachAvatarsToPlayers(room.players);
          const payload = {
            roomCode: room.code, host: newHost, status: room.status,
            participantsCount: room.players.length, players: playersWithAvt,
            createdAt: room.createdAt || null, updatedAt: room.updatedAt || null, state: getRoomState(code)
          };
          io.to(code).emit('tod-joined', payload);
          io.emit('admin-rooms-changed'); 
    
        } catch (e) {
          console.error('[ToD] disconnecting handler error', e);
        }
      });
};