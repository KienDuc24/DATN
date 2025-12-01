(() => {
    const GAME_ID = 'DG';
    const API_BASE_URL = window.API_BASE_URL || 'https://datn-socket.up.railway.app'; 
    window.socket = window.socket || (window.io && io(API_BASE_URL, { transports: ['websocket'], secure: true }));

    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const roomCode = params.get('code') || '';
    let playerName = params.get('user');

    if (!playerName || !roomCode) {
        alert('Lỗi: Thiếu thông tin phòng hoặc người dùng.');
        window.location.href = '/';
        return;
    }
    window.playerName = playerName;
    
    const $room = document.getElementById('roomCode');
    const $playersCount = document.getElementById('playersCount');
    const $gameStatus = document.getElementById('game-status');
    const $wordHint = document.getElementById('word-hint');
    const $timer = document.getElementById('timer');
    const $scoreGrid = document.getElementById('scoreGrid');
    const $chatMessages = document.getElementById('chatMessages');
    const $guessInput = document.getElementById('guessInput');
    const $sendGuess = document.getElementById('sendGuess');
    const $drawingTools = document.getElementById('drawingTools');
    const $canvas = document.getElementById('drawingCanvas');
    const $clearBtn = document.getElementById('clearBtn');
    const $sizeSlider = document.getElementById('sizeSlider');
    const $actionArea = document.getElementById('actionArea');
    const $eraseBtn = document.querySelector('.tool-btn[data-tool="eraser"]');
    const $penTool = document.querySelector('.tool-btn[data-tool="pen"]');
    const $fillTool = document.querySelector('.tool-btn[data-tool="fill"]');
    const $colorPalette = document.getElementById('colorPalette'); 

    let currentHost = null;
    let currentDrawer = null;
    let roomPlayers = []; 
    let isDrawing = false;
    let currentTool = 'pen';
    let currentColor = '#000000'; 
    let currentSize = 5;
    
    const ctx = $canvas ? $canvas.getContext('2d') : null;
    
    function resizeCanvas() {
        if ($canvas) {
            const parent = $canvas.parentElement;
            $canvas.width = parent.clientWidth;
            $canvas.height = parent.clientHeight;
            clearCanvas();
        }
    }
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 100);

    function clearCanvas() {
        if (ctx) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, $canvas.width, $canvas.height); }
    }

    function getDisplayName(username) {
        if (username === 'Hệ thống') return 'Hệ thống'; 
        const p = roomPlayers.find(p => p.name === username);
        return p ? (p.displayName || p.name) : username;
    }

    function getMousePos(e) {
        if (!$canvas) return { x: 0, y: 0 };
        const rect = $canvas.getBoundingClientRect();
        let clientX = e.touches?.[0]?.clientX || e.clientX;
        let clientY = e.touches?.[0]?.clientY || e.clientY;
        const scaleX = $canvas.width / rect.width;
        const scaleY = $canvas.height / rect.height;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    function draw({ type, x, y, color, size }) {
        if (!ctx) return; 
        if (type === 'start') {
            ctx.beginPath(); ctx.moveTo(x, y);
            ctx.strokeStyle = color; ctx.lineWidth = size;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        } else if (type === 'move') {
            ctx.lineTo(x, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y);
        }
    }

    function emitDraw(type, x, y) {
        if (currentDrawer !== playerName || !ctx) return; 
        const color = currentTool === 'eraser' ? 'white' : currentColor;
        const size = currentSize;
        const data = { type, x, y, color, size };
        socket.emit(`${GAME_ID}-draw`, { roomCode, data });
        draw(data);
    }

    function setActiveTool(tool) {
        currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        if ($canvas) $canvas.style.cursor = (tool === 'fill') ? 'pointer' : 'crosshair';
    }

    function handleFillCanvas() {
        if (currentDrawer !== playerName || currentTool !== 'fill' || !ctx) return;
        ctx.fillStyle = currentColor; ctx.fillRect(0, 0, $canvas.width, $canvas.height);
        socket.emit(`${GAME_ID}-fill`, { roomCode, color: currentColor }); 
        setActiveTool('pen'); 
    }

    function handleDrawStart(e) {
        if (currentDrawer !== playerName || !$canvas) return;
        if (currentTool === 'fill') { handleFillCanvas(); return; }
        isDrawing = true;
        const pos = getMousePos(e);
        emitDraw('start', pos.x, pos.y);
        e.preventDefault();
    }

    function handleDrawMove(e) { 
        if (!isDrawing || currentDrawer !== playerName || !$canvas) return;
        const pos = getMousePos(e);
        emitDraw('move', pos.x, pos.y);
        e.preventDefault();
    }

    function handleDrawEnd() { if (currentDrawer === playerName) isDrawing = false; }
    
    if ($canvas) {
        $canvas.addEventListener('click', (e) => { if(currentTool === 'fill') handleFillCanvas(); }); 
        $canvas.addEventListener('mousedown', handleDrawStart);
        $canvas.addEventListener('mousemove', handleDrawMove);
        $canvas.addEventListener('mouseup', handleDrawEnd);
        $canvas.addEventListener('mouseout', handleDrawEnd);
        $canvas.addEventListener('touchstart', handleDrawStart);
        $canvas.addEventListener('touchmove', handleDrawMove);
        $canvas.addEventListener('touchend', handleDrawEnd);
    }
    if ($penTool) $penTool.addEventListener('click', () => setActiveTool('pen'));
    if ($eraseBtn) $eraseBtn.addEventListener('click', () => setActiveTool('eraser'));
    if ($fillTool) $fillTool.addEventListener('click', () => setActiveTool('fill'));
    if ($sizeSlider) $sizeSlider.addEventListener('input', (e) => currentSize = parseInt(e.target.value));
    if ($clearBtn) $clearBtn.addEventListener('click', () => {
        if (currentDrawer === playerName && confirm('Xóa toàn bộ bảng vẽ?')) {
            socket.emit(`${GAME_ID}-clear`, { roomCode });
            clearCanvas();
        }
    });
    
    const colors = ['#000000', '#FFFFFF', '#C1C1C1', '#4D4D4D', '#EF130B', '#740B07', '#FF7100', '#C23800', '#FFE400', '#E8A200', '#00CC00', '#005510', '#00B2FF', '#00569E', '#231FD3', '#0E0865', '#A300BA', '#550069', '#D37CAA', '#A75574', '#A0522D', '#63300D'];
    if ($colorPalette) {
        $colorPalette.innerHTML = '';
        colors.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            if (index === 0) { swatch.classList.add('active'); currentColor = color; }
            swatch.addEventListener('click', () => {
                currentColor = color;
                currentTool = 'pen';
                $colorPalette.querySelector('.active')?.classList.remove('active');
                swatch.classList.add('active');
                document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
                if($penTool) $penTool.classList.add('active');
            });
            $colorPalette.appendChild(swatch);
        });
    }

    function appendChat(name, msg, type) {
        const div = document.createElement('div');
        const isSystem = name === 'Hệ thống';
        const isMe = name === playerName;
        let cssClass = 'other';
        if (isSystem) cssClass = 'system';
        else if (isMe) cssClass = 'user';
        let bubbleClass = 'chat-bubble';
        if (type === 'correct') bubbleClass += ' correct';
        if (isSystem) bubbleClass += ' system-msg';
        const avatarUrl = isSystem ? '/img/fav.png' : `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(name)}`;
        let html = '';
        if (isSystem) {
            html = `<div class="${bubbleClass}">${msg}</div>`;
        } else {
             html = `
                <img class="chat-avatar" src="${avatarUrl}">
                <div class="${bubbleClass}">
                    <div class="chat-name">${name}</div>
                    <div class="chat-text">${msg}</div>
                </div>`;
        }
        div.className = `chat-row ${cssClass}`;
        div.innerHTML = html;
        $chatMessages.appendChild(div);
        $chatMessages.scrollTop = $chatMessages.scrollHeight;
    }

    function disableGuessInput(disabled = true) { 
        if (!$guessInput || !$sendGuess) return;
        $guessInput.disabled = disabled;
        $sendGuess.disabled = disabled;
        if (currentDrawer === playerName) {
             $guessInput.placeholder = 'Bạn là Họa sĩ. Chỉ có thể chat.';
             $guessInput.disabled = false; 
             $sendGuess.disabled = false;
        } else {
             $guessInput.placeholder = disabled ? 'Chờ vòng mới...' : 'Nhập đáp án hoặc chat...';
        }
    }

    function handleSendGuess() {
        if (!$guessInput) return;
        const guess = $guessInput.value.trim();
        if (!guess) return;
        $guessInput.value = '';
        if (currentDrawer === playerName) {
            socket.emit(`${GAME_ID}-guess`, { roomCode, player: playerName, guess: `(Chat): ${guess}` });
        } else {
            socket.emit(`${GAME_ID}-guess`, { roomCode, player: playerName, guess });
        }
    }

    if ($sendGuess) $sendGuess.addEventListener('click', handleSendGuess);
    if ($guessInput) $guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendGuess();
    });

    socket.on('connect', () => {
        const playerObj = { name: playerName };
        socket.emit(`${GAME_ID}-join`, { roomCode, player: playerObj });
    });

    function updateActionArea(drawer) {
        $actionArea.innerHTML = '';
        if (currentHost === playerName && !drawer) {
            const btn = document.createElement('button');
            btn.className = 'btn-start';
            btn.innerHTML = 'BẮT ĐẦU GAME';
            btn.onclick = () => {
                socket.emit(`${GAME_ID}-start-game`, { roomCode });
                btn.style.display = 'none';
            };
            $actionArea.appendChild(btn);
        } else if (!drawer) {
            $actionArea.innerHTML = `<p class="status-text" style="font-size:1rem; opacity:0.8">Đang chờ chủ phòng bắt đầu...</p>`;
        }
    }

    socket.on(`${GAME_ID}-room-update`, ({ state, room }) => {
        currentHost = room.host;
        roomPlayers = room.players;
        if ($room) $room.textContent = room.code;
        if ($playersCount) $playersCount.textContent = roomPlayers.length;
        renderScores(state.scores, state.drawer);
        updateActionArea(state.drawer);
        if(state.drawer) {
            const drawerName = getDisplayName(state.drawer);
            $gameStatus.textContent = `Họa sĩ: ${drawerName}`;
        } else {
            $gameStatus.textContent = 'Sảnh Chờ';
            $drawingTools.classList.add('hidden');
            $wordHint.classList.add('hidden');
        }
    });

    socket.on(`${GAME_ID}-start-round`, ({ drawer, scores, round, wordHint }) => {
        currentDrawer = drawer;
        clearCanvas();
        const isMe = drawer === playerName;
        $drawingTools.classList.toggle('hidden', !isMe);
        $wordHint.classList.remove('hidden');
        $wordHint.innerText = isMe ? "VẼ TỪ NÀY" : `_ `.repeat(wordHint);
        const drawerDisplay = getDisplayName(drawer);
        $gameStatus.textContent = `Vòng ${round}: ${isMe ? 'Bạn' : drawerDisplay} đang vẽ`;
        renderScores(scores, drawer);
        appendChat('Hệ thống', `Vòng ${round} bắt đầu! ${drawerDisplay} đang vẽ.`, 'system');
        disableGuessInput(isMe);
        
        const startBtn = document.querySelector('.btn-start');
        if(startBtn) startBtn.style.display = 'none';
    });
    
    socket.on(`${GAME_ID}-secret-word`, ({ word }) => {
        if ($wordHint) $wordHint.innerText = `TỪ KHÓA: ${word}`;
    });

    socket.on(`${GAME_ID}-drawing`, (data) => draw(data));
    socket.on(`${GAME_ID}-fill-canvas`, ({ color }) => {
        if (ctx) { ctx.fillStyle = color; ctx.fillRect(0, 0, $canvas.width, $canvas.height); }
    });
    socket.on(`${GAME_ID}-clear-canvas`, () => clearCanvas());
    socket.on(`${GAME_ID}-timer`, ({ time }) => { if ($timer) $timer.textContent = time; });

    socket.on(`${GAME_ID}-chat-message`, ({ player, message }) => {
        appendChat(getDisplayName(player), message, 'other');
    });

    socket.on(`${GAME_ID}-correct-guess`, ({ player, scores }) => {
        const playerDisplay = getDisplayName(player);
        appendChat('Hệ thống', `${playerDisplay} đã đoán đúng! 🎉`, 'correct');
        const row = document.getElementById(`row-${player}`);
        if(row) {
            row.classList.add('correct');
            setTimeout(() => row.classList.remove('correct'), 1000);
        }
        renderScores(scores, currentDrawer);
        if (player === playerName) {
            disableGuessInput(true);
            if ($guessInput) $guessInput.placeholder = 'Bạn đã đoán đúng!';
        }
    });

    socket.on(`${GAME_ID}-end-round`, ({ word, scores, guessed }) => {
        currentDrawer = null;
        $drawingTools.classList.add('hidden'); 
        $gameStatus.textContent = `Vòng kết thúc! Từ khóa: ${word}`;
        $wordHint.innerText = word;
        if (guessed) appendChat('Hệ thống', `Từ khóa đã được đoán.`, 'system');
        else appendChat('Hệ thống', `Hết giờ! Không ai đoán được.`, 'system');
        renderScores(scores, null);
        disableGuessInput(true);
        updateActionArea(null);
    });

    socket.on(`${GAME_ID}-game-over`, ({ finalScores }) => {
        $gameStatus.textContent = '🏆 TRÒ CHƠI KẾT THÚC!';
        disableGuessInput(true);
        $drawingTools.classList.add('hidden');
        showRankingPopup(finalScores, true); 
    });

    socket.on(`${GAME_ID}-game-restarted`, () => {
        hidePopup(); 
        $gameStatus.textContent = 'Đang chờ bắt đầu...';
        clearCanvas();
        updateActionArea(null);
    });

    function pickAvatarFor(name) {
        const safeName = name || 'guest';
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
    }

    function renderScores(scores, drawerName) {
        if (!$scoreGrid) return;
        $scoreGrid.innerHTML = '';
        const playerNames = roomPlayers.map(p => p.name); 
        const currentScores = scores || {}; 
        const mergedScores = playerNames.reduce((acc, name) => ({ ...acc, [name]: currentScores[name] || 0 }), { ...currentScores });
        const sortedPlayers = playerNames.sort((a, b) => mergedScores[b] - mergedScores[a]);
        sortedPlayers.forEach((name, i) => {
            const isDrawer = name === drawerName;
            const isHost = name === currentHost;
            const isYou = name === playerName;
            const playerObj = roomPlayers.find(p => p.name === name);
            const displayName = playerObj ? playerObj.displayName || name : name; 
            const rank = i + 1;
            const icon = isDrawer ? '<i class="fas fa-pencil-alt pen-icon"></i>' : '';
            const crown = isHost ? '👑' : '';
            const row = document.createElement('div');
            row.id = `row-${name}`;
            row.className = `player-row ${isYou ? 'me' : ''} ${isDrawer ? 'drawer' : ''}`;
            row.innerHTML = `
                <div class="rank">#${rank}</div>
                <img src="${pickAvatarFor(name)}" class="p-avatar">
                <div class="p-info">
                    <div class="p-name">${displayName} ${crown} ${icon}</div>
                    <div class="p-score">${mergedScores[name] || 0} điểm</div>
                </div>
            `;
            $scoreGrid.appendChild(row);
        });
    }

    function showRankingPopup(scores, isFinal) {
        hidePopup();
        const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
        const title = isFinal ? "🏆 TỔNG KẾT TRẬN ĐẤU" : "✨ KẾT QUẢ VÒNG";
        let htmlContent = `<h2 class="modal-title">${title}</h2>`;
        htmlContent += `<div class="modal-list">`;
        sortedScores.forEach(([name, score], idx) => {
            const rankClass = idx === 0 ? 'top1' : (idx === 1 ? 'top2' : (idx === 2 ? 'top3' : ''));
            const playerObj = roomPlayers.find(p => p.name === name);
            const displayName = playerObj ? playerObj.displayName || name : name; 
            const avatar = pickAvatarFor(name);
            htmlContent += `
            <div class="player-row modal-row">
                <div class="rank ${rankClass}">#${idx + 1}</div>
                <img src="${avatar}" class="p-avatar">
                <div class="p-info">
                    <div class="p-name">${displayName}</div>
                    <div class="p-score">${score} điểm</div>
                </div>
            </div>`;
        });
        htmlContent += `</div>`;
        htmlContent += `<div class="modal-actions">`;
        if (isFinal) {
            if (currentHost === playerName) {
                htmlContent += `<button id="btnRestart" class="btn-start">Chơi Lại</button>`;
            } else {
                htmlContent += `<p class="waiting-text">Đang chờ chủ phòng chơi lại...</p>`;
            }
            htmlContent += `<button id="btnExit" class="tool-btn btn-danger" style="width:auto;padding:0 20px;">Thoát</button>`;
        }
        htmlContent += `</div>`;
        const modal = document.createElement('div');
        modal.id = 'resultModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-box">${htmlContent}</div>`;
        document.body.appendChild(modal);
        if (isFinal) {
            const btnRestart = document.getElementById('btnRestart');
            if (btnRestart) {
                btnRestart.onclick = () => {
                    socket.emit(`${GAME_ID}-restart-game`, { roomCode });
                    btnRestart.style.display = 'none';
                };
            }
            const btnExit = document.getElementById('btnExit');
            if (btnExit) {
                btnExit.onclick = () => {
                    window.location.href = '/';
                };
            }
        }
    }

    function hidePopup() {
        const modal = document.getElementById('resultModal');
        if (modal) modal.remove();
    }
})();