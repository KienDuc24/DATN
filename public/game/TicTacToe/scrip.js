(() => {
    const API_BASE_URL = window.API_BASE_URL || 'https://datn-socket.up.railway.app';
    const socket = io(API_BASE_URL, { transports: ['websocket'], secure: true });

    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('code');
    const playerName = urlParams.get('user');

    if (!roomCode || !playerName) {
        alert('Lỗi thông tin!');
        window.location.href = '/';
    }
    document.getElementById('roomCode').innerText = roomCode;

    const screens = {
        lobby: document.getElementById('lobbyScreen'),
        game: document.getElementById('gameScreen')
    };
    const btnJoinX = document.getElementById('btnJoinX');
    const btnJoinO = document.getElementById('btnJoinO');
    const statusX = document.getElementById('statusX');
    const statusO = document.getElementById('statusO');
    const startBtn = document.getElementById('startBtn');
    const lobbyMsg = document.getElementById('lobbyMessage');
    const boardEl = document.getElementById('board');
    const cells = document.querySelectorAll('.cell');
    const turnIcon = document.getElementById('turnIcon');
    const turnText = document.getElementById('turnText');
    
    let isHost = false;
    let myRole = null;

    socket.on('connect', () => {
        socket.emit('ttt-join', { roomCode, player: { name: playerName } });
        checkHost();
    });

    socket.on('ttt-update', (state) => {
        updateLobbyUI(state);
        updateGameUI(state);
        
        if (state.status === 'playing' || state.status === 'finished') {
            screens.lobby.classList.add('hidden');
            screens.game.classList.remove('hidden');
            screens.game.classList.add('active');
        } else {
            screens.lobby.classList.remove('hidden');
            screens.game.classList.add('hidden');
        }
    });

    socket.on('ttt-game-over', ({ winner, winningLine }) => {
        if (winningLine && winningLine.length > 0) {
            winningLine.forEach(idx => {
                cells[idx].classList.add('win-cell');
            });
        }
        showResultPopup(winner);
    });

    socket.on('ttt-restarted', () => {
        const modal = document.getElementById('resultModal');
        if (modal) modal.remove();
        cells.forEach(c => {
            c.className = 'cell'; 
            c.innerHTML = '';
        });
    });

    btnJoinX.onclick = () => socket.emit('ttt-choose-role', { roomCode, player: playerName, role: 'X' });
    btnJoinO.onclick = () => socket.emit('ttt-choose-role', { roomCode, player: playerName, role: 'O' });
    startBtn.onclick = () => socket.emit('ttt-start', { roomCode });

    cells.forEach(cell => {
        cell.onclick = () => {
            const index = cell.dataset.index;
            socket.emit('ttt-move', { roomCode, index: parseInt(index), player: playerName });
        };
    });

    function updateLobbyUI(state) {
        if (state.players.X) {
            statusX.innerText = state.players.X;
            statusX.classList.add('taken');
            btnJoinX.disabled = true;
            if (state.players.X === playerName) myRole = 'X';
        } else {
            statusX.innerText = 'Trống';
            statusX.classList.remove('taken');
            btnJoinX.disabled = false;
        }

        if (state.players.O) {
            statusO.innerText = state.players.O;
            statusO.classList.add('taken');
            btnJoinO.disabled = true;
            if (state.players.O === playerName) myRole = 'O';
        } else {
            statusO.innerText = 'Trống';
            statusO.classList.remove('taken');
            btnJoinO.disabled = false;
        }

        if (state.status === 'ready') {
            lobbyMsg.innerText = "Đã sẵn sàng! Chủ phòng hãy bấm Bắt đầu.";
            lobbyMsg.style.color = "#2ecc71";
            if (isHost) startBtn.classList.remove('hidden');
        } else {
            lobbyMsg.innerText = "Đang chờ người chơi chọn phe...";
            lobbyMsg.style.color = "#ccc";
            startBtn.classList.add('hidden');
        }
    }

    function updateGameUI(state) {
        turnIcon.src = state.turn === 'X' ? 'Img/x_sign.png' : 'Img/o_sign.png';
        turnText.innerText = state.turn;
        
        state.board.forEach((val, idx) => {
            const cell = cells[idx];
            if (val && cell.innerHTML === '') {
                const img = document.createElement('img');
                img.src = val === 'X' ? 'Img/x_sign.png' : 'Img/o_sign.png';
                cell.appendChild(img);
                cell.classList.add('filled');
            } else if (!val) {
                cell.innerHTML = '';
                cell.classList.remove('filled', 'win-cell');
            }
        });
    }

    function showResultPopup(winner) {
        const modal = document.createElement('div');
        modal.id = 'resultModal';
        modal.className = 'modal-overlay';
        
        let title = '';
        let content = '';
        
        if (winner === 'draw') {
            title = 'Hòa Cờ!';
            content = 'Hai bên ngang tài ngang sức!';
        } else {
            title = `Người thắng: ${winner}`;
            content = winner === myRole ? 'Chúc mừng bạn đã chiến thắng!' : 'Tiếc quá, chúc bạn may mắn lần sau!';
        }

        let actions = '';
        if (isHost) {
            actions = `<button id="btnRestart" class="btn-start">Chơi Lại</button>`;
        } else {
            actions = `<p class="waiting-text">Đang chờ chủ phòng chơi lại...</p>`;
        }
        actions += `<button onclick="location.href='/'" class="btn-danger" style="margin-left:10px;">Thoát</button>`;

        modal.innerHTML = `
            <div class="modal-box">
                <h2 class="modal-title">${title}</h2>
                <p class="modal-msg">${content}</p>
                <div class="modal-actions">${actions}</div>
            </div>
        `;
        document.body.appendChild(modal);

        const btnRestart = document.getElementById('btnRestart');
        if (btnRestart) {
            btnRestart.onclick = () => socket.emit('ttt-restart', { roomCode });
        }
    }

    async function checkHost() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/room?code=${roomCode}&gameId=TicTacToe`);
            const data = await res.json();
            if(data.room && data.room.host === playerName) {
                isHost = true;
            }
        } catch(e) {}
    }
})();