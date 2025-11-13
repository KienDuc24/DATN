// public/game/DrawGuess/script.js (PHẦN SỬA LỖI CHỨC NĂNG VÀ TỐI ƯU GIAO DIỆN)

(() => {
    const GAME_ID = 'DG';
    const SOCKET_URL = "https://datn-socket.up.railway.app";
    window.socket = window.socket || (window.io && io(SOCKET_URL, { transports: ['websocket'], secure: true }));

    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const roomCode = params.get('code') || '';
    let playerName = params.get('user'); 

    // ... (Khai báo DOM và biến: Giữ nguyên) ...
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
    const $colorPicker = document.getElementById('colorPicker');
    const $sizeSlider = document.getElementById('sizeSlider');
    const $eraseBtn = document.getElementById('eraseBtn');
    
    let $playerListContainer = document.getElementById('playerList');
    
    const ctx = $canvas.getContext('2d');
    const socket = window.socket;

    let currentHost = null;
    let currentDrawer = null;
    let roomPlayers = []; 
    let isDrawing = false;
    let isEraser = false;
    let lastX = 0;
    let lastY = 0;
    let currentColor = $colorPicker.value;
    let currentSize = parseInt($sizeSlider.value);
    
    $canvas.width = 800;
    $canvas.height = 600;
    
    function clearCanvas() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, $canvas.width, $canvas.height);
    }
    clearCanvas();

    // --- 1. LOGIC VẼ (Giữ nguyên) ---
    function emitDraw(type, x, y, color = currentColor, size = currentSize) {
        if (currentDrawer !== playerName) return; 
        const data = { type, x, y, color, size };
        socket.emit(`${GAME_ID}-draw`, { roomCode, data });
        draw(data);
    }

    function draw({ type, x, y, color, size }) {
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
    
    function getMousePos(e) { /* ... (Giữ nguyên) ... */
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

    function handleDrawStart(e) { /* ... (Giữ nguyên) ... */
        if (currentDrawer !== playerName) return;
        isDrawing = true;
        const pos = getMousePos(e);
        lastX = pos.x;
        lastY = pos.y;
        const drawColor = isEraser ? 'white' : currentColor;
        emitDraw('start', lastX, lastY, drawColor, currentSize);
        e.preventDefault();
    }
    function handleDrawMove(e) { /* ... (Giữ nguyên) ... */
        if (!isDrawing || currentDrawer !== playerName) return;
        const pos = getMousePos(e);
        const drawColor = isEraser ? 'white' : currentColor;
        emitDraw('move', pos.x, pos.y, drawColor, currentSize);
        lastX = pos.x;
        lastY = pos.y;
        e.preventDefault();
    }
    function handleDrawEnd() { /* ... (Giữ nguyên) ... */
        if (currentDrawer !== playerName) return;
        isDrawing = false;
    }

    $canvas.addEventListener('mousedown', handleDrawStart);
    $canvas.addEventListener('mousemove', handleDrawMove);
    $canvas.addEventListener('mouseup', handleDrawEnd);
    $canvas.addEventListener('mouseout', handleDrawEnd);
    $canvas.addEventListener('touchstart', handleDrawStart);
    $canvas.addEventListener('touchmove', handleDrawMove);
    $canvas.addEventListener('touchend', handleDrawEnd);

    $colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        isEraser = false;
        $eraseBtn.classList.remove('active');
    });
    $sizeSlider.addEventListener('input', (e) => currentSize = parseInt(e.target.value));
    $clearBtn.addEventListener('click', () => {
        if (currentDrawer === playerName && confirm('Xác nhận xóa toàn bộ?')) {
            socket.emit(`${GAME_ID}-clear`, { roomCode });
            clearCanvas();
        }
    });
    $eraseBtn.addEventListener('click', () => {
        isEraser = true;
        $eraseBtn.classList.add('active');
    });
    $colorPicker.addEventListener('click', () => {
        isEraser = false;
        $eraseBtn.classList.remove('active');
    });

    // --- 2. LOGIC CHAT & ĐOÁN (ĐÃ SỬA LỖI KHÔNG CHAT ĐƯỢC) ---
    function renderChatMessage(player, message, type = 'msg-guess') { /* ... (Giữ nguyên) ... */
        const el = document.createElement('div');
        el.className = `chat-message ${type}`;
        el.innerHTML = `<strong>${player}:</strong> ${message}`;
        $chatMessages.appendChild(el);
        $chatMessages.scrollTop = $chatMessages.scrollHeight;
    }

    function disableGuessInput(disabled = true) {
        // Đã đổi tên thành setInputState để rõ ràng hơn
        
        // Luôn luôn cho phép input cho người đoán (trừ khi họ đã đoán đúng)
        const canGuess = currentDrawer !== playerName;
        
        $guessInput.disabled = false; // Luôn mở input
        $sendGuess.disabled = false; // Luôn mở nút gửi

        if (currentDrawer === playerName) {
             // Họa sĩ chỉ được chat, không được đoán.
             $guessInput.placeholder = 'Bạn là Họa sĩ. Chỉ có thể chat.';
        } else {
             // Người đoán
             $guessInput.placeholder = 'Nhập từ khóa đoán hoặc chat...';
             // (Logic ẩn input nếu đã đoán đúng sẽ được xử lý trong socket.on(correct-guess))
        }

        if (disabled) {
            // Đây là trạng thái chờ vòng mới/chờ Host. Tắt input cho tất cả.
            $guessInput.disabled = true;
            $sendGuess.disabled = true;
            $guessInput.placeholder = 'Chờ vòng mới...';
        }
    }

    function handleSendGuess() {
        const guess = $guessInput.value.trim();
        if (!guess) return;

        $guessInput.value = '';
        
        if (currentDrawer === playerName) {
            // HỌA SĨ: Gửi dưới dạng Chat Message thông thường
            socket.emit(`${GAME_ID}-guess`, { roomCode, player: playerName, guess: `(Chat): ${guess}` });
        } else {
            // NGƯỜI ĐOÁN: Gửi để Server kiểm tra (cả đoán và chat)
            socket.emit(`${GAME_ID}-guess`, { roomCode, player: playerName, guess });
        }
    }

    $sendGuess.addEventListener('click', handleSendGuess);
    $guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendGuess();
    });

    // --- 3. LOGIC SOCKET GAME ---
    socket.on('connect', () => { /* ... (Giữ nguyên) ... */
        console.log(`[${GAME_ID}][client] socket connected`);
        const playerObj = { name: playerName };
        console.log(`[${GAME_ID}][DEBUG JOIN] Gửi join request: room=${roomCode}, player=${playerName}`);
        socket.emit(`${GAME_ID}-join`, { roomCode, player: playerObj });
    });

    function pickAvatarFor(name) { /* ... (Giữ nguyên) ... */
        const player = roomPlayers.find(p => p.name === name);
        if (player && player.avatar) return player.avatar;
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(name)}`;
    }

    socket.on(`${GAME_ID}-room-update`, ({ state, room }) => {
        // ... (Debug logs) ...

        currentHost = room.host;
        roomPlayers = room.players;
        
        if ($room) $room.textContent = room.code || '—';
        if ($playersCount) $playersCount.textContent = roomPlayers.length;
        
        // Render điểm số và danh sách người chơi
        renderScores(state.scores, state.drawer, roomPlayers);
        renderPlayerList(roomPlayers);
        
        // CẬP NHẬT HIỂN THỊ HOST
        const hostDisplay = document.getElementById('hostDisplay');
        if(hostDisplay) hostDisplay.textContent = `👑 Host: ${currentHost}`;

        // --- XỬ LÝ NÚT BẮT ĐẦU GAME ---
        let startBtn = document.getElementById('startGameBtn');
        const gameNotRunning = !state.drawer;
        
        // TẠO NÚT (Nếu là Host và chưa có nút)
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
        
        // Hiển thị/Ẩn nút
        if (currentHost === playerName && gameNotRunning) {
            startBtn.style.display = 'inline-block';
            $gameStatus.textContent = ''; // Xóa text "Đang chờ host..."
            $gameStatus.appendChild(startBtn); 
        } else if (startBtn) {
            startBtn.style.display = 'none';
        }

        if (gameNotRunning) {
            // Nếu game chưa chạy, TẮT input cho TẤT CẢ (disabled=true)
            disableGuessInput(true); 
            // ... (Logic hiển thị trạng thái chờ) ...
        } else {
            // Game đang chạy, MỞ input (disabled=false)
            disableGuessInput(false); 
        }
        // Cập nhật trạng thái hiển thị
        if (gameNotRunning && currentHost !== playerName) {
            $gameStatus.textContent = `Đang chờ ${currentHost} bắt đầu...`;
            disableGuessInput(true);
            $drawingTools.classList.add('hidden');
            $wordHint.classList.add('hidden'); 
        } else if (gameNotRunning && currentHost === playerName) {
             // Đảm bảo host không thấy chữ "Đang chờ" khi nút đã hiện
             $gameStatus.textContent = ''; 
             $gameStatus.appendChild(startBtn);
        } else {
             // Game đang chạy, không hiển thị nút
        }
    });

    socket.on(`${GAME_ID}-start-round`, ({ drawer, scores, round, wordHint }) => {
        currentDrawer = drawer;
        clearCanvas();
        disableGuessInput(false);
        
        $drawingTools.classList.toggle('hidden', currentDrawer !== playerName);

        $gameStatus.textContent = `Vòng ${round}: ${drawer} đang vẽ...`;
        
        // HIỆN GỢI Ý (Đã sửa lỗi)
        $hintText.textContent = '_ '.repeat(wordHint).trim();
        $wordHint.classList.remove('hidden');
        
        renderScores(scores, drawer, roomPlayers);
        renderChatMessage('Hệ thống', `Vòng ${round} bắt đầu! ${drawer} đang vẽ.`, 'msg-system');
        
        disableGuessInput(currentDrawer === playerName);
    });
    
    socket.on(`${GAME_ID}-secret-word`, ({ word }) => {
        // HIỆN TỪ KHÓA ĐẦY ĐỦ CHO HỌA SĨ
        $gameStatus.textContent = `BẠN ĐANG VẼ: ${word}`;
        $wordHint.classList.remove('hidden');
        $hintText.textContent = word; 
    });

    socket.on(`${GAME_ID}-drawing`, (data) => {
        if (currentDrawer !== playerName) {
            draw(data);
        }
    });
    
    socket.on(`${GAME_ID}-clear-canvas`, () => {
        clearCanvas();
    });

    socket.on(`${GAME_ID}-timer`, ({ time }) => {
        $timer.textContent = time;
    });

    socket.on(`${GAME_ID}-chat-message`, ({ player, message }) => {
        const type = player === currentDrawer ? 'msg-drawer' : 'msg-guess';
        renderChatMessage(player, message, type);
    });

    socket.on(`${GAME_ID}-correct-guess`, ({ player, scores }) => {
        renderChatMessage('Hệ thống', `${player} đã đoán đúng! 🎉`, 'msg-correct');
        renderScores(scores, currentDrawer, roomPlayers);
        
        if (player === playerName) {
            disableGuessInput(true);
            $guessInput.placeholder = 'Bạn đã đoán đúng!';
        }
    });

    socket.on(`${GAME_ID}-end-round`, ({ word, scores, drawer, guessed }) => {
        currentDrawer = null;
        $drawingTools.classList.add('hidden'); 
        $gameStatus.textContent = `Vòng kết thúc! Từ khóa là: ${word}`;
        $wordHint.classList.add('hidden'); 
        
        if (guessed) {
            renderChatMessage('Hệ thống', `Từ khóa đã được đoán đúng.`, 'msg-system');
        } else {
            renderChatMessage('Hệ thống', `Hết giờ! Không ai đoán được.`, 'msg-system');
        }
        
        renderScores(scores, null, roomPlayers);
        disableGuessInput(true);
        
        // Hiển thị lại nút Bắt đầu Game sau một thời gian (nếu là Host)
        setTimeout(() => {
            const startBtn = document.getElementById('startGameBtn');
            if (startBtn && currentHost === playerName) {
                 $gameStatus.textContent = '';
                 $gameStatus.appendChild(startBtn); 
                 startBtn.style.display = 'inline-block';
            } else if (currentHost !== playerName) {
                $gameStatus.textContent = `Đang chờ ${currentHost} bắt đầu...`;
            }
        }, 5000); 
    });
    
    // --- 4. HÀM RENDER ĐIỂM SỐ CÓ AVATAR (Tối ưu hiển thị dọc) ---
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

            row.innerHTML = `
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

    function renderPlayerList(players) {
    }

})();