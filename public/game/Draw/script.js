(() => {
    const GAME_ID = 'DG';
    const API_BASE_URL = window.API_BASE_URL || 'https://datn-socket.up.railway.app';

    window.socket = window.socket || (window.io && io(API_BASE_URL, { transports: ['websocket'], secure: true }));

    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const roomCode = params.get('code') || '';
    let playerName = params.get('user'); 

    if (!playerName || !roomCode) {
        alert('Lỗi: Thiếu thông tin phòng hoặc người dùng. Đang quay về trang chủ.');
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

        const avatarUrl = isSystem 
            ? '/img/fav.png' 
            : `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(name)}`;

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
            btn.innerText = 'BẮT ĐẦU GAME';
            btn.onclick = () => socket.emit(`${GAME_ID}-start-game`, { roomCode });
            $actionArea.appendChild(btn);
        }
    }

    socket.on(`${GAME_ID}-room-update`, ({ state, room }) => {
        currentHost = room.host;
        roomPlayers = room.players; 
        
        if ($room) $room.textContent = room.code || '—';
        if ($playersCount) $playersCount.textContent = roomPlayers.length;
        
        renderScores(state.scores, state.drawer, roomPlayers);
        updateActionArea(state.drawer);
        
        if(state.drawer) {
            const drawerName = getDisplayName(state.drawer);
            $gameStatus.textContent = `Vòng chơi: ${drawerName} đang vẽ`;
        } else {
            $gameStatus.textContent = 'Đang chờ bắt đầu...';
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
        
        renderScores(scores, drawer, roomPlayers);
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
        
        renderScores(scores, currentDrawer, roomPlayers);
        if (player === playerName) {
            disableGuessInput(true);
            if ($guessInput) $guessInput.placeholder = 'Bạn đã đoán đúng!';
        }
    });

    socket.on(`${GAME_ID}-end-round`, ({ word, scores, drawer, guessed }) => {
        currentDrawer = null;
        $drawingTools.classList.add('hidden'); 
        $gameStatus.textContent = `Vòng kết thúc! Từ khóa: ${word}`;
        $wordHint.innerText = word;
        
        if (guessed) appendChat('Hệ thống', `Từ khóa đã được đoán.`, 'system');
        else appendChat('Hệ thống', `Hết giờ! Không ai đoán được.`, 'system');
        
        renderScores(scores, null, roomPlayers);
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
        if ($gameStatus) $gameStatus.textContent = 'Đang chờ bắt đầu...';
    });

    function pickAvatarFor(name) {
        const safeName = name || 'guest';
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
    }

    function renderScores(scores, drawerName, playerList = []) {
        if (!$scoreGrid) return;
        $scoreGrid.innerHTML = '';
        
        const safePlayerList = Array.isArray(playerList) ? playerList : [];
        const playerNames = safePlayerList.map(p => p.name); 
        const currentScores = scores || {}; 
        
        const mergedScores = playerNames.reduce((acc, name) => ({ ...acc, [name]: currentScores[name] || 0 }), { ...currentScores });
        const sortedPlayers = playerNames.sort((a, b) => mergedScores[b] - mergedScores[a]);
        
        sortedPlayers.forEach((name, i) => {
            const isDrawer = name === drawerName;
            const isHost = name === currentHost;
            const isYou = name === playerName;
            
            const playerObj = safePlayerList.find(p => p.name === name);
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
    
    function getSortedScores(scores) {
        if (!scores || typeof scores !== 'object') return [];
        return Object.entries(scores).sort(([, a], [, b]) => b - a);
    }
    
    function showRankingPopup(scores, isFinal) {
        hidePopup(); 
        const sortedScores = getSortedScores(scores);
        const title = isFinal ? '🏆 KẾT QUẢ CHUNG CUỘC' : '✨ KẾT QUẢ VÒNG ĐẤU';
        let content = `<h2 style="color:var(--accent-yellow); margin-bottom: 20px;">${title}</h2>`;
        
        content += '<ol style="padding: 0; list-style-position: inside; text-align: left; font-size: 1.1em; max-height: 250px; overflow-y: auto;">';
        sortedScores.forEach(([player, score], index) => {
            const isWinner = index === 0 && isFinal;
            const rankStyle = isWinner ? 'color: var(--accent-green); font-weight: bold;' : '';
            const playerObj = roomPlayers.find(p => p.name === player);
            const displayName = playerObj ? playerObj.displayName || player : player; 
            content += `<li style="${rankStyle}"><strong>${displayName}</strong>: ${score} điểm</li>`;
        });
        content += '</ol>';
        content += '<div id="popup-actions" style="margin-top: 30px; display: flex; justify-content: center; gap: 20px;">';
        
        if (isFinal) {
            content += `<button id="popup-continue" class="btn-start">Chơi Lại</button>`;
            content += `<button id="popup-exit" class="tool-btn btn-danger" style="width:auto;padding:0 20px;">Thoát</button>`;
        }
        content += '</div>';

        const modal = document.createElement('div');
        modal.id = 'rankingModal';
        modal.className = 'overlay'; 
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';
        
        modal.innerHTML = `<div class="panel" style="width:90%;max-width:500px;height:auto;padding:30px;background:#2c3e50;border:1px solid #fff3;">${content}</div>`;
        document.body.appendChild(modal);

        if (isFinal) {
            const continueBtn = document.getElementById('popup-continue');
            if (continueBtn) {
                continueBtn.addEventListener('click', () => {
                    hidePopup();
                    socket.emit(`${GAME_ID}-restart-game`, { roomCode }); 
                });
            }
            const exitBtn = document.getElementById('popup-exit');
            if (exitBtn) {
                exitBtn.addEventListener('click', () => {
                    window.location.href = '/'; 
                });
            }
        }
    }
    function hidePopup() {
        const modal = document.getElementById('rankingModal');
        if (modal) modal.remove();
    }
})();