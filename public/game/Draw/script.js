// public/game/DrawGuess/script.js (FIX LỖI handleDrawStart VÀ TẤT CẢ LOGIC)

(() => {
    const GAME_ID = 'DG';
    const SOCKET_URL = "https://datn-socket.up.railway.app";
    window.socket = window.socket || (window.io && io(SOCKET_URL, { transports: ['websocket'], secure: true }));

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
    
    // --- KHAI BÁO BIẾN DOM ---
    const $room = document.getElementById('roomCode');
    const $playersCount = document.getElementById('playersCount');
    const $gameStatus = document.getElementById('game-status');
    const $wordHint = document.getElementById('word-hint');
    const $hintText = document.getElementById('hint-text');
    const $timer = document.getElementById('timer');
    const $scoreGrid = document.getElementById('scoreGrid');
    const $chatMessages = document.getElementById('chatMessages');
    const $guessInput = document.getElementById('guessInput');
    const $sendGuess = document.getElementById('sendGuess');
    const $drawingTools = document.getElementById('drawingTools');
    const $canvas = document.getElementById('drawingCanvas');
    const $clearBtn = document.getElementById('clearBtn');
    const $sizeSlider = document.getElementById('sizeSlider');
    const $eraseBtn = document.getElementById('eraseBtn');
    const $penTool = document.getElementById('penTool');
    const $fillTool = document.getElementById('fillTool');
    const $colorPalette = document.getElementById('colorPalette'); 

    let currentHost = null;
    let currentDrawer = null;
    let roomPlayers = []; 
    let isDrawing = false;
    let currentTool = 'pen';
    let currentColor = '#000000'; 
    let currentSize = $sizeSlider ? parseInt($sizeSlider.value) : 5;
    let lastX = 0;
    let lastY = 0;
    
    const ctx = $canvas ? $canvas.getContext('2d') : null;
    
    if ($canvas) {
        $canvas.width = $canvas.offsetWidth;
        $canvas.height = $canvas.offsetHeight;
    }

    function clearCanvas() {
        if (ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, $canvas.width, $canvas.height);
        }
    }
    clearCanvas();

    // --- LOGIC VẼ (KHAI BÁO HÀM LÊN TRÊN CÙNG) ---
    
    function getMousePos(e) {
        if (!$canvas) return { x: 0, y: 0 };
        const rect = $canvas.getBoundingClientRect();
        let clientX, clientY;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const scaleX = $canvas.width / rect.width;
        const scaleY = $canvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    
    function draw({ type, x, y, color, size }) {
        if (!ctx) return; 
        if (type === 'start') {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.strokeStyle = color;
            ctx.lineWidth = size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        } else if (type === 'move') {
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    }
    
    function emitDraw(type, x, y, color = currentColor, size = currentSize) {
        if (currentDrawer !== playerName || !ctx) return; 

        const data = { type, x, y, color, size };
        socket.emit(`${GAME_ID}-draw`, { roomCode, data });
        draw(data);
    }
    
    function setActiveTool(tool) {
        currentTool = tool;
        isEraser = (tool === 'eraser');
        
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        if ($canvas) $canvas.style.cursor = (tool === 'pen' || tool === 'eraser') ? 'crosshair' : 'pointer';
    }

    // Xử lý ĐỔ MÀU
    function handleFillCanvas(e) {
        if (currentDrawer !== playerName || currentTool !== 'fill' || !ctx) return;
        
        ctx.fillStyle = currentColor;
        ctx.fillRect(0, 0, $canvas.width, $canvas.height);
        
        socket.emit(`${GAME_ID}-fill`, { roomCode, color: currentColor }); 
        
        setActiveTool('pen'); 
    }

    // Xử lý sự kiện Canvas chính
    function handleCanvasClick(e) {
        if (currentTool === 'fill') {
            handleFillCanvas(e);
        }
    }
    
    // HÀM XỬ LÝ SỰ KIỆN VẼ CHÍNH
    function handleDrawStart(e) { 
        if (currentDrawer !== playerName || !$canvas || currentTool === 'fill') return; 
        isDrawing = true;
        const pos = getMousePos(e);
        lastX = pos.x;
        lastY = pos.y;
        
        const drawColor = isEraser ? 'white' : currentColor;
        emitDraw('start', lastX, lastY, drawColor, currentSize);
        e.preventDefault();
    }

    function handleDrawMove(e) { 
        if (!isDrawing || currentDrawer !== playerName || !$canvas || currentTool === 'fill') return;
        const pos = getMousePos(e);
        const drawColor = isEraser ? 'white' : currentColor;
        emitDraw('move', pos.x, pos.y, drawColor, currentSize);
        lastX = pos.x;
        lastY = pos.y;
        e.preventDefault();
    }

    function handleDrawEnd() { 
        if (currentDrawer !== playerName) return;
        isDrawing = false;
    }

    // --- BỎ LOGIC NÚT THOÁT PHÒNG ---

    // GẮN EVENT LISTENERS
    if ($canvas) {
        $canvas.addEventListener('click', handleCanvasClick); 
        $canvas.addEventListener('mousedown', handleDrawStart);
        $canvas.addEventListener('mousemove', handleDrawMove);
        $canvas.addEventListener('mouseup', handleDrawEnd);
        $canvas.addEventListener('mouseout', handleDrawEnd);
        $canvas.addEventListener('touchstart', handleDrawStart);
        $canvas.addEventListener('touchmove', handleDrawMove);
        $canvas.addEventListener('touchend', handleDrawEnd);
    }
    
    // Gắn Event Listeners cho các nút công cụ
    if ($penTool) $penTool.addEventListener('click', () => setActiveTool('pen'));
    if ($eraseBtn) $eraseBtn.addEventListener('click', () => setActiveTool('eraser'));
    if ($fillTool) $fillTool.addEventListener('click', () => setActiveTool('fill'));

    if ($sizeSlider) $sizeSlider.addEventListener('input', (e) => currentSize = parseInt(e.target.value));
    
    if ($clearBtn) $clearBtn.addEventListener('click', () => {
        if (currentDrawer === playerName && confirm('Xác nhận xóa toàn bộ?')) {
            socket.emit(`${GAME_ID}-clear`, { roomCode });
            clearCanvas();
        }
    });
    
    // KHỞI TẠO BẢNG MÀU MỚI
    const colors = [
        '#FFFFFF', '#000000', '#C1C1C1', '#4D4D4D', '#EF130B', '#740B07', 
        '#FF7100', '#C23800', '#FFE400', '#E8A200', '#00CC00', '#005510',
        '#00B2FF', '#00569E', '#231FD3', '#0E0865', '#A300BA', '#550069',
        '#D37CAA', '#A75574', '#A0522D', '#63300D'
    ];
    
    if ($colorPalette) {
        colors.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            
            if (index === 1) { 
                swatch.classList.add('active');
                currentColor = color;
            }
            
            swatch.addEventListener('click', () => {
                currentColor = color;
                $colorPalette.querySelector('.active')?.classList.remove('active');
                swatch.classList.add('active');
                
                if (currentTool === 'eraser') {
                    setActiveTool('pen');
                }
            });
            $colorPalette.appendChild(swatch);
        });
    }

    // --- 2. LOGIC CHAT & ĐOÁN ---
    function renderChatMessage(player, message, type = 'msg-guess') { 
        if (!$chatMessages) return; 
        const el = document.createElement('div');
        el.className = `chat-message ${type}`;
        el.innerHTML = `<strong>${player}:</strong> ${message}`;
        $chatMessages.appendChild(el);
        $chatMessages.scrollTop = $chatMessages.scrollHeight;
    }

    function disableGuessInput(disabled = true) { 
        if (!$guessInput || !$sendGuess) return;
        
        $guessInput.disabled = disabled;
        $sendGuess.disabled = disabled;
        
        if (currentDrawer === playerName) {
             $guessInput.placeholder = 'Bạn là Họa sĩ. Chỉ có thể chat.';
             $guessInput.disabled = false; // Họa sĩ luôn được chat
             $sendGuess.disabled = false;
        } else {
             $guessInput.placeholder = 'Nhập từ khóa đoán hoặc chat...';
        }

        if (disabled) {
            $guessInput.disabled = true;
            $sendGuess.disabled = true;
            $guessInput.placeholder = 'Chờ vòng mới...';
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

    // --- 3. LOGIC SOCKET GAME ---
    socket.on('connect', () => {
        const playerObj = { name: playerName };
        socket.emit(`${GAME_ID}-join`, { roomCode, player: playerObj });
    });

    function pickAvatarFor(name) {
        const player = roomPlayers.find(p => p.name === name);
        if (player && player.avatar) return player.avatar;
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(name)}`;
    }

    socket.on(`${GAME_ID}-room-update`, ({ state, room }) => {
        
        currentHost = room.host;
        roomPlayers = room.players;
        
        if ($room) $room.textContent = room.code || '—';
        if ($playersCount) $playersCount.textContent = roomPlayers.length;
        
        renderScores(state.scores, state.drawer, roomPlayers);
        
        let startBtn = document.getElementById('startGameBtn');
        const gameNotRunning = !state.drawer;
        
        if (!startBtn) {
            startBtn = document.createElement('button');
            startBtn.id = 'startGameBtn';
            startBtn.className = 'btn start-game-btn'; 
            startBtn.textContent = '🚀 BẮT ĐẦU VẼ ĐOÁN';
            startBtn.addEventListener('click', () => {
                socket.emit(`${GAME_ID}-start-game`, { roomCode });
            });
            if ($gameStatus) {
                $gameStatus.appendChild(startBtn);
            }
        }
        
        if (startBtn) {
            if (currentHost === playerName && gameNotRunning) {
                startBtn.style.display = 'inline-block';
                if ($gameStatus) $gameStatus.textContent = '';
                if ($gameStatus) $gameStatus.appendChild(startBtn); 
            } else {
                startBtn.style.display = 'none';
            }
        }

        if (gameNotRunning) {
            disableGuessInput(true); 
            if ($drawingTools) $drawingTools.classList.add('hidden');
            if ($wordHint) $wordHint.classList.add('hidden');

            if (currentHost !== playerName && $gameStatus) {
                $gameStatus.textContent = `Đang chờ ${currentHost} bắt đầu...`;
            } else if (currentHost === playerName && $gameStatus) {
                 $gameStatus.textContent = ''; 
                 if (startBtn) $gameStatus.appendChild(startBtn);
            }
        }
    });

    socket.on(`${GAME_ID}-start-round`, ({ drawer, scores, round, wordHint }) => {
        currentDrawer = drawer;
        clearCanvas();
        
        if ($drawingTools) $drawingTools.classList.toggle('hidden', currentDrawer !== playerName);

        if ($gameStatus) $gameStatus.textContent = `Vòng ${round}: ${drawer} đang vẽ...`;
        
        if ($hintText) $hintText.textContent = '_ '.repeat(wordHint).trim();
        if ($wordHint) $wordHint.classList.remove('hidden');
        
        renderScores(scores, drawer, roomPlayers);
        renderChatMessage('Hệ thống', `Vòng ${round} bắt đầu! ${drawer} đang vẽ.`, 'msg-system');
        
        disableGuessInput(currentDrawer === playerName);
    });
    
    socket.on(`${GAME_ID}-secret-word`, ({ word }) => {
        if ($gameStatus) $gameStatus.textContent = `BẠN ĐANG VẼ: ${word}`;
        if ($wordHint) $wordHint.classList.remove('hidden');
        if ($hintText) $hintText.textContent = word; 
    });

    socket.on(`${GAME_ID}-drawing`, (data) => {
        if (currentDrawer !== playerName) {
            draw(data);
        }
    });
    
    socket.on(`${GAME_ID}-fill-canvas`, ({ color }) => {
        if (currentDrawer !== playerName && ctx) {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, $canvas.width, $canvas.height);
        }
    });
    
    socket.on(`${GAME_ID}-clear-canvas`, () => {
        clearCanvas();
    });

    socket.on(`${GAME_ID}-timer`, ({ time }) => {
        if ($timer) $timer.textContent = time;
    });

    socket.on(`${GAME_ID}-chat-message`, ({ player, message }) => {
        const type = player === currentDrawer ? 'msg-drawer' : 'msg-guess';
        renderChatMessage(player, message, type);
    });

    socket.on(`${GAME_ID}-correct-guess`, ({ player, scores, time }) => {
        const bonus = time || 0;
        renderChatMessage('Hệ thống', `${player} đã đoán đúng! 🎉 (+${50 + bonus} điểm)`, 'msg-correct');
        
        const playerRow = document.querySelector(`.score-row.you`);
        if (player === playerName && playerRow) {
            playerRow.classList.add('flash-correct');
            setTimeout(() => { playerRow.classList.remove('flash-correct'); }, 1500);
        }
        
        renderScores(scores, currentDrawer, roomPlayers);
        
        if (player === playerName) {
            disableGuessInput(true);
            if ($guessInput) $guessInput.placeholder = 'Bạn đã đoán đúng!';
        }
    });

    // SỬA LỖI: LOGIC POPUP KẾT THÚC VÒNG
    socket.on(`${GAME_ID}-end-round`, ({ word, scores, drawer, guessed }) => {
        currentDrawer = null;
        if ($drawingTools) $drawingTools.classList.add('hidden'); 
        if ($gameStatus) $gameStatus.textContent = `Vòng kết thúc! Từ khóa là: ${word}`;
        if ($wordHint) $wordHint.classList.add('hidden'); 
        
        if (guessed) {
            renderChatMessage('Hệ thống', `Từ khóa đã được đoán đúng.`, 'msg-system');
        } else {
            renderChatMessage('Hệ thống', `Hết giờ! Không ai đoán được.`, 'msg-system');
        }
        
        renderScores(scores, null, roomPlayers);
        disableGuessInput(true);

        // Hiển thị Pop-up xếp hạng (false = không phải cuối game, KHÔNG CÓ NÚT)
        showRankingPopup(scores, false); 
        
        setTimeout(() => {
            hidePopup(); // Tự động đóng popup
            
            const startBtn = document.getElementById('startGameBtn');
            if (startBtn && currentHost === playerName) {
                 if ($gameStatus) $gameStatus.textContent = '';
                 if ($gameStatus) $gameStatus.appendChild(startBtn); 
                 startBtn.style.display = 'inline-block';
            } else if (currentHost !== playerName && $gameStatus) {
                $gameStatus.textContent = `Đang chờ ${currentHost} bắt đầu...`;
            }
        }, 5000); // Đợi 5 giây
    });
    
    // SỬA LỖI: LOGIC POPUP KẾT THÚC GAME
    socket.on(`${GAME_ID}-game-over`, ({ finalScores }) => {
        if ($gameStatus) $gameStatus.textContent = '🏆 TRÒ CHƠI KẾT THÚC!';
        
        disableGuessInput(true);
        if ($drawingTools) $drawingTools.classList.add('hidden');
        
        // Hiển thị Pop-up xếp hạng cuối cùng (true = cuối game, CÓ NÚT)
        showRankingPopup(finalScores, true); 
    });

    // --- 4. HÀM RENDER ĐIỂM SỐ (Đã có logic vương miện/icon vẽ) ---
    function renderScores(scores, drawerName, playerList = []) {
        if (!$scoreGrid) return;
        $scoreGrid.innerHTML = '';
        
        const playerNames = playerList.map(p => p.name);
        const mergedScores = playerNames.reduce((acc, name) => ({ ...acc, [name]: scores[name] || 0 }), { ...scores });
        const sortedPlayers = playerNames.sort((a, b) => mergedScores[b] - mergedScores[a]);

        sortedPlayers.forEach(name => {
            const isDrawer = name === drawerName;
            const isHost = name === currentHost;
            const isYou = name === playerName;
            
            const row = document.createElement('div');
            row.className = `score-row ${isDrawer ? 'drawer-turn' : ''} ${isYou ? 'you' : ''}`;
            
            const tags = [];
            if (isDrawer) tags.push('<span class="score-tag tag-drawer">🎨 Đang vẽ</span>');
            if (isHost) tags.push('<span class="score-tag tag-host">👑 Host</span>');
            if (isYou && !isDrawer) tags.push('<span class="score-tag tag-you">Bạn</span>');
            
            const crownIcon = isHost ? '<span class="crown-icon">👑</span>' : '';

            row.innerHTML = `
                ${crownIcon}
                <div><img src="${pickAvatarFor(name)}" alt="${name}"></div>
                <div class="score-name-tags">
                    <span class="player-name">${name}</span>
                    <div class="tags-container">${tags.join(' ')}</div>
                </div>
                <div class="score-value">${mergedScores[name] || 0}</div>
            `;
            $scoreGrid.appendChild(row);
        });
    }
    
    // --- 5. BỔ SUNG: HÀM POP-UP XẾP HẠNG (ĐÃ SỬA LOGIC NÚT) ---
    function getSortedScores(scores) {
        return Object.entries(scores)
            .sort(([, a], [, b]) => b - a);
    }
    
    function showRankingPopup(scores, isFinal) {
        hidePopup(); 
        
        const sortedScores = getSortedScores(scores);
        const title = isFinal ? '🏆 BẢNG XẾP HẠNG CUỐI CÙNG' : '✨ KẾT QUẢ VÒNG ĐẤU';
        
        let content = `<h2 style="color:var(--accent-yellow); margin-bottom: 20px;">${title}</h2>`;
        
        content += '<ol style="padding: 0; list-style-position: inside; text-align: left; font-size: 1.1em; max-height: 250px; overflow-y: auto;">';
        sortedScores.forEach(([player, score], index) => {
            const isWinner = index === 0 && isFinal;
            const rankStyle = isWinner ? 'color: var(--accent-green); font-weight: bold;' : '';
            content += `<li style="${rankStyle}"><strong>${player}</strong>: ${score} điểm</li>`;
        });
        content += '</ol>';
        
        content += '<div id="popup-actions" style="margin-top: 30px; display: flex; justify-content: center; gap: 20px;">';
        
        if (isFinal) {
            // Nút Chơi Lại (reload) và Thoát (về home)
            content += `<button id="popup-continue" class="btn btn-primary">Chơi Lại</button>`;
            content += `<button id="popup-exit" class="btn btn-danger">Thoát</button>`;
        } else {
            // SỬA LỖI: Chỉ hiển thị text, không có nút
            content += `<p>Vòng tiếp theo sẽ bắt đầu sau 5 giây...</p>`;
        }
        content += '</div>';

        const modal = document.createElement('div');
        modal.id = 'rankingModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-content">${content}</div>`;
        document.body.appendChild(modal);
        
        // Thêm CSS cho modal
        const styleId = 'modal-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                .modal-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.8); z-index: 1000;
                    display: flex; justify-content: center; align-items: center;
                    backdrop-filter: blur(5px);
                }
                .modal-content {
                    background: var(--card-bg); padding: 30px; border-radius: var(--border-radius);
                    box-shadow: var(--shadow-base); text-align: center; max-width: 90%;
                }
                .btn-danger { background-color: var(--text-accent); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
                .btn-primary { background-color: var(--accent-green); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
            `;
            document.head.appendChild(style);
        }

        if (isFinal) {
            document.getElementById('popup-continue').addEventListener('click', () => {
                window.location.reload(); 
            });
            document.getElementById('popup-exit').addEventListener('click', () => {
                window.location.href = '/'; 
            });
        }
    }
    
    function hidePopup() {
        const modal = document.getElementById('rankingModal');
        if (modal) modal.remove();
    }

})();