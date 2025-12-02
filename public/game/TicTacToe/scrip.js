(() => {
    const API_BASE_URL = window.API_BASE_URL || 'https://datn-socket.up.railway.app';
    const socket = io(API_BASE_URL, { transports: ['websocket'], secure: true });

    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('code');
    const playerName = urlParams.get('user');

    if (!roomCode || !playerName) {
        alert('Lỗi: Thiếu thông tin!');
        window.location.href = '/';
    }

    const roomCodeEl = document.getElementById('roomCode');
    if (roomCodeEl) roomCodeEl.innerText = roomCode;

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
    const cells = document.querySelectorAll('.cell');
    const turnIcon = document.getElementById('turnIcon');
    const turnText = document.getElementById('turnText');
    
    let isHost = false;
    let myRole = null;

    socket.on('connect', () => {
        socket.emit('ttt-join', { roomCode, player: playerName }); 
        checkHost();
    });

    socket.on('ttt-update', (state) => {
        updateLobbyUI(state);
        updateGameUI(state);
        
        if (state.status === 'playing' || state.status === 'finished') {
            screens.lobby.classList.add('hidden');
            screens.game.classList.remove('hidden');
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
        setTimeout(() => showResultPopup(winner), 300);
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
    
    startBtn.onclick = () => {
        socket.emit('ttt-start', { roomCode });
    };

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
            btnJoinX.innerText = state.players.X === playerName ? "Đã chọn" : "Đã có người";
            if (state.players.X === playerName) myRole = 'X';
        } else {
            statusX.innerText = 'Trống';
            statusX.classList.remove('taken');
            btnJoinX.disabled = false;
            btnJoinX.innerText = "Chọn X";
            if (myRole === 'X') myRole = null;
        }

        if (state.players.O) {
            statusO.innerText = state.players.O;
            statusO.classList.add('taken');
            btnJoinO.disabled = true;
            btnJoinO.innerText = state.players.O === playerName ? "Đã chọn" : "Đã có người";
            if (state.players.O === playerName) myRole = 'O';
        } else {
            statusO.innerText = 'Trống';
            statusO.classList.remove('taken');
            btnJoinO.disabled = false;
            btnJoinO.innerText = "Chọn O";
            if (myRole === 'O') myRole = null;
        }

        if (state.status === 'ready') {
            lobbyMsg.innerText = "Đã đủ người! Chủ phòng hãy bắt đầu.";
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
            if (val && cell.children.length === 0) {
                const img = document.createElement('img');
                img.src = val === 'X' ? 'Img/x_sign.png' : 'Img/o_sign.png';
                cell.appendChild(img);
                cell.classList.add('filled');
            } else if (!val) {
                cell.innerHTML = '';
                cell.className = 'cell';
            }
        });
    }

    function showResultPopup(winner) {
        const modal = document.createElement('div');
        modal.id = 'resultModal';
        modal.className = 'modal-overlay';
        
        let title = '', content = '';
        
        if (winner === 'draw') {
            title = 'Hòa Cờ!';
            content = 'Hai bên ngang tài ngang sức!';
        } else {
            title = `${winner} Thắng!`;
            content = winner === myRole ? 'Chúc mừng bạn đã chiến thắng! 🎉' : 'Đừng buồn, thử lại nhé!';
        }

        let btns = '';
        if (isHost) {
            btns += `<button id="btnRestart" class="btn-start">Chơi Lại</button>`;
        } else {
            btns += `<p class="waiting-text">Chờ chủ phòng chơi lại...</p>`;
        }
        btns += `<button onclick="location.href='/'" class="btn-danger" style="margin-left:10px">Thoát</button>`;

        modal.innerHTML = `
            <div class="modal-box">
                <h2 class="modal-title">${title}</h2>
                <p class="modal-msg">${content}</p>
                <div class="modal-actions">${btns}</div>
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
            if (data.room && data.room.host === playerName) {
                isHost = true;
            }
        } catch(e) {}
    }
})();