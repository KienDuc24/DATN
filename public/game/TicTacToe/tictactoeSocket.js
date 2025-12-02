const Room = require('../../../models/Room');

const GAME_ID = 'TicTacToe';
const ROOM_STATE = {};

const WIN_CONDITIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function getRoomState(code) {
    if (!ROOM_STATE[code]) {
        ROOM_STATE[code] = {
            board: Array(9).fill(null),
            turn: 'X',
            players: { X: null, O: null },
            status: 'waiting',
            winner: null,
            winningLine: []
        };
    }
    return ROOM_STATE[code];
}

async function sendRoomUpdate(io, roomCode) {
    try {
        const room = await Room.findOne({ code: roomCode }).lean();
        const state = getRoomState(roomCode);
        
        if (room) {
            io.to(roomCode).emit('ttt-update', {
                state: state,
                roomInfo: {
                    code: room.code,
                    host: room.host,
                    players: room.players || []
                }
            });
        }
    } catch (e) {
        console.error('TTT Update Error:', e);
    }
}

module.exports = (socket, io) => {
    socket.on('ttt-join', async ({ roomCode, player }) => {
        socket.join(roomCode);
        await sendRoomUpdate(io, roomCode);
    });

    socket.on('ttt-choose-role', async ({ roomCode, player, role }) => {
        const state = getRoomState(roomCode);
        
        if (state.status === 'playing') return;
        if (state.players[role] && state.players[role] !== player) return;

        if (state.players.X === player) state.players.X = null;
        if (state.players.O === player) state.players.O = null;

        state.players[role] = player;

        if (state.players.X && state.players.O) {
            state.status = 'ready';
        } else {
            state.status = 'waiting';
        }

        await sendRoomUpdate(io, roomCode);
    });

    socket.on('ttt-start', async ({ roomCode }) => {
        const state = getRoomState(roomCode);
        if (state.status === 'ready' || state.status === 'finished') {
            state.status = 'playing';
            state.board = Array(9).fill(null);
            state.turn = 'X';
            state.winner = null;
            state.winningLine = [];
            await sendRoomUpdate(io, roomCode);
        }
    });

    socket.on('ttt-move', async ({ roomCode, index, player }) => {
        const state = getRoomState(roomCode);
        
        if (state.status !== 'playing') return;
        if (state.board[index] !== null) return;
        
        const role = state.players.X === player ? 'X' : (state.players.O === player ? 'O' : null);
        if (!role || role !== state.turn) return;

        state.board[index] = role;

        let won = false;
        for (const condition of WIN_CONDITIONS) {
            const [a, b, c] = condition;
            if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
                state.winner = role;
                state.winningLine = condition;
                state.status = 'finished';
                won = true;
                break;
            }
        }

        if (!won && !state.board.includes(null)) {
            state.status = 'finished';
            state.winner = 'draw';
        }

        if (!won && state.winner !== 'draw') {
            state.turn = state.turn === 'X' ? 'O' : 'X';
        }

        await sendRoomUpdate(io, roomCode);
        
        if (state.status === 'finished') {
            io.to(roomCode).emit('ttt-game-over', { 
                winner: state.winner, 
                winningLine: state.winningLine 
            });
        }
    });

    socket.on('ttt-restart', async ({ roomCode }) => {
        const state = getRoomState(roomCode);
        state.board = Array(9).fill(null);
        state.turn = 'X';
        state.winner = null;
        state.winningLine = [];
        state.status = 'playing';
        
        await sendRoomUpdate(io, roomCode);
        io.to(roomCode).emit('ttt-restarted');
    });

    socket.on('disconnect', () => {});
};