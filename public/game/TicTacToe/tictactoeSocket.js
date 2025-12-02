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

module.exports = (socket, io) => {
    socket.on('ttt-join', ({ roomCode, player }) => {
        socket.join(roomCode);
        const state = getRoomState(roomCode);
        io.to(roomCode).emit('ttt-update', state);
    });

    socket.on('ttt-choose-role', ({ roomCode, player, role }) => {
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

        io.to(roomCode).emit('ttt-update', state);
    });

    socket.on('ttt-start', ({ roomCode }) => {
        const state = getRoomState(roomCode);
        if (state.status === 'ready' || state.status === 'finished') {
            state.status = 'playing';
            state.board = Array(9).fill(null);
            state.turn = 'X';
            state.winner = null;
            state.winningLine = [];
            io.to(roomCode).emit('ttt-update', state);
        }
    });

    socket.on('ttt-move', ({ roomCode, index, player }) => {
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

        io.to(roomCode).emit('ttt-update', state);
        
        if (state.status === 'finished') {
            io.to(roomCode).emit('ttt-game-over', { 
                winner: state.winner, 
                winningLine: state.winningLine 
            });
        }
    });

    socket.on('ttt-restart', ({ roomCode }) => {
        const state = getRoomState(roomCode);
        state.board = Array(9).fill(null);
        state.turn = 'X';
        state.winner = null;
        state.winningLine = [];
        state.status = 'playing';
        
        io.to(roomCode).emit('ttt-update', state);
        io.to(roomCode).emit('ttt-restarted');
    });

    socket.on('disconnect', () => {
        
    });
};