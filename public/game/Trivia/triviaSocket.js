const fs = require('fs');
const path = require('path');
const { generateGameReaction, handleInGameChat } = require('../../../controllers/chatbotController');

const GAME_ID = 'Trivia';
const QUESTIONS_PATH = path.resolve(__dirname, 'questions.json');
let QUESTIONS = [];

try {
    const raw = fs.readFileSync(QUESTIONS_PATH, 'utf8');
    QUESTIONS = JSON.parse(raw || '[]');
} catch (err) {
    console.warn(`[${GAME_ID}] cannot load questions.json`, err.message);
}

const ROOM_STATE = {};
const gameSocketMap = new Map();

function getRoomState(code) {
    if (!ROOM_STATE[code]) {
        ROOM_STATE[code] = {
            currentQuestionIndex: -1,
            scores: {},
            answers: {},
            timer: 0,
            interval: null,
            questionList: [],
            phase: 'lobby'
        };
    }
    return ROOM_STATE[code];
}

function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

async function sendCatmiMessage(io, roomCode, textOrContext, isAI = false) {
    let message = textOrContext;
    if (isAI) {
        message = await generateGameReaction(textOrContext);
    }
    io.to(roomCode).emit('catmi-says', { message });
}

async function endQuestion(io, roomCode) {
    const state = getRoomState(roomCode);
    if (state.interval) clearInterval(state.interval);
    state.phase = 'result';

    const currentQ = state.questionList[state.currentQuestionIndex];
    const correctAns = currentQ.correctAnswer;
    
    let correctPlayers = [];
    
    for (const [player, ansData] of Object.entries(state.answers)) {
        if (ansData.answer === correctAns) {
            const score = 100 + Math.ceil(ansData.time * 2);
            state.scores[player] = (state.scores[player] || 0) + score;
            correctPlayers.push(player);
        }
    }

    io.to(roomCode).emit('trivia-update-players', { scores: state.scores });

    io.to(roomCode).emit('trivia-result', {
        correctAnswer: correctAns,
        explanation: currentQ.explanation,
        scores: state.scores,
        correctPlayers: correctPlayers
    });

    let context = "";
    if (correctPlayers.length === 0) {
        context = `Tất cả mọi người đều trả lời sai câu hỏi: "${currentQ.question}". Đáp án đúng là ${correctAns}. Hãy chê họ gà mờ.`;
    } else if (correctPlayers.length === Object.keys(state.answers).length && correctPlayers.length > 0) {
        context = `Tất cả mọi người đều trả lời đúng! Hãy khen họ xuất sắc.`;
    } else {
        const randomCorrect = correctPlayers[Math.floor(Math.random() * correctPlayers.length)];
        context = `Người chơi tên ${randomCorrect} đã trả lời đúng và nhanh. Hãy khen người đó và khịa những người sai.`;
    }
    
    sendCatmiMessage(io, roomCode, context, true);

    setTimeout(() => {
        nextQuestion(io, roomCode);
    }, 8000);
}

function nextQuestion(io, roomCode) {
    const state = getRoomState(roomCode);
    state.currentQuestionIndex++;

    if (state.currentQuestionIndex >= state.questionList.length) {
        endGame(io, roomCode);
        return;
    }

    state.phase = 'question';
    state.answers = {};
    state.timer = 15;

    const qData = state.questionList[state.currentQuestionIndex];
    
    io.to(roomCode).emit('trivia-question', {
        id: qData.id,
        question: qData.question,
        options: qData.options,
        time: state.timer,
        index: state.currentQuestionIndex + 1,
        total: state.questionList.length
    });

    io.to(roomCode).emit('catmi-says', { message: `[Guiding] Câu số ${state.currentQuestionIndex + 1}: Tập trung nghe nè! 😼` });

    if (state.interval) clearInterval(state.interval);
    state.interval = setInterval(() => {
        state.timer--;
        io.to(roomCode).emit('trivia-timer', { time: state.timer });

        if (state.timer === 5) {
             io.to(roomCode).emit('catmi-says', { message: "[Surprised] 5 giây cuối! Nhanh tay nào! ⏳" });
        }

        if (state.timer <= 0) {
            endQuestion(io, roomCode);
        }
    }, 1000);
}

function endGame(io, roomCode) {
    const state = getRoomState(roomCode);
    state.phase = 'end';
    if (state.interval) clearInterval(state.interval);

    let winner = null;
    let maxScore = -1;
    for (const [p, s] of Object.entries(state.scores)) {
        if (s > maxScore) {
            maxScore = s;
            winner = p;
        }
    }

    io.to(roomCode).emit('trivia-game-over', { scores: state.scores, winner });
    
    const context = `Trò chơi kết thúc. Người thắng cuộc là ${winner || 'Không có ai'}. Hãy chúc mừng họ.`;
    sendCatmiMessage(io, roomCode, context, true);
}

module.exports = (socket, io) => {
    socket.on('trivia-join', ({ roomCode, player }) => {
        socket.join(roomCode);
        const name = player.name || player;
        gameSocketMap.set(socket.id, { player: name, roomCode });
        
        const state = getRoomState(roomCode);
        if(state.scores[name] === undefined) state.scores[name] = 0;
        
        io.to(roomCode).emit('trivia-update-players', { scores: state.scores });
    });

    socket.on('trivia-start', ({ roomCode }) => {
        const state = getRoomState(roomCode);
        
        const room = io.sockets.adapter.rooms.get(roomCode);
        state.scores = {};
        if (room) {
            for (const id of room) {
               const p = gameSocketMap.get(id);
               if(p) state.scores[p.player] = 0;
            }
        }

        state.questionList = shuffleArray([...QUESTIONS]).slice(0, 5); 
        state.currentQuestionIndex = -1;
        
        io.to(roomCode).emit('trivia-update-players', { scores: state.scores });

        io.to(roomCode).emit('catmi-says', { message: "[Welcome] Vòng mới bắt đầu! Điểm số đã được reset! Cố lên nha! 🌲🔥" });
        
        setTimeout(() => nextQuestion(io, roomCode), 2000);
    });

    socket.on('trivia-answer', ({ roomCode, answer }) => {
        const info = gameSocketMap.get(socket.id);
        if (!info) return;
        const state = getRoomState(roomCode);
        if (state.phase !== 'question') return;
        if (state.answers[info.player]) return;

        state.answers[info.player] = { answer: answer, time: state.timer };
        socket.emit('trivia-answer-confirmed', { answer });
        
        const room = io.sockets.adapter.rooms.get(roomCode);
        const playerCount = room ? room.size : 0;
        if (Object.keys(state.answers).length >= playerCount) {
            endQuestion(io, roomCode);
        }
    });

    socket.on('trivia-chat-send', async ({ roomCode, message }) => {
        const info = gameSocketMap.get(socket.id);
        if (!info) return;

        io.to(roomCode).emit('trivia-chat-receive', { 
            sender: info.player, 
            message: message,
            isCatmi: false 
        });

        if (message.toLowerCase().includes('@catmi')) {
            const aiReply = await handleInGameChat(message, info.player, GAME_ID, roomCode);
            io.to(roomCode).emit('trivia-chat-receive', {
                sender: 'Catmi',
                message: aiReply,
                isCatmi: true
            });
        }
    });
    
    socket.on('disconnect', () => {
        gameSocketMap.delete(socket.id);
    });
};