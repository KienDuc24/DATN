// public/game/DrawGuess/script.js (ĐÃ CẢI TIẾN)

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
    const $colorPicker = document.getElementById('colorPicker');
    const $sizeSlider = document.getElementById('sizeSlider');
    const $eraseBtn = document.getElementById('eraseBtn');

    const ctx = $canvas.getContext('2d');
    const socket = window.socket;

    let currentHost = null;
    let currentDrawer = null;
    let roomPlayers = []; // Danh sách người chơi trong phòng
    let isDrawing = false;
    let isEraser = false;
    let lastX = 0;
    let lastY = 0;
    let currentColor = $colorPicker.value;
    let currentSize = parseInt($sizeSlider.value);
    
    // Khởi tạo Canvas (đặt kích thước gốc)
    $canvas.width = 800;
    $canvas.height = 600;
    
    function clearCanvas() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, $canvas.width, $canvas.height);
    }
    clearCanvas();

    // --- 1. LOGIC VẼ (DRAWING LOGIC) ---
    function emitDraw(type, x, y, color = currentColor, size = currentSize) {
        if (currentDrawer !== playerName) return; 

        const data = { type, x, y, color, size };
        socket.emit(`${GAME_ID}-draw`, { roomCode, data });
        draw(data); // Vẽ cục bộ ngay lập tức
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
    
    function getMousePos(e) {
        const rect = $canvas.getBoundingClientRect();
        let clientX, clientY;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Tỷ lệ hóa tọa độ về kích thước gốc của Canvas (800x600)
        const scaleX = $canvas.width / rect.width;
        const scaleY = $canvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function handleDrawStart(e) {
        if (currentDrawer !== playerName) return;
        isDrawing = true;
        const pos = getMousePos(e);
        lastX = pos.x;
        lastY = pos.y;
        
        // Điều chỉnh màu nếu đang ở chế độ Tẩy
        const drawColor = isEraser ? 'white' : currentColor;
        emitDraw('start', lastX, lastY, drawColor, currentSize);
        e.preventDefault();
    }

    function handleDrawMove(e) {
        if (!isDrawing || currentDrawer !== playerName) return;
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

    // Gắn sự kiện vẽ
    $canvas.addEventListener('mousedown', handleDrawStart);
    $canvas.addEventListener('mousemove', handleDrawMove);
    $canvas.addEventListener('mouseup', handleDrawEnd);
    $canvas.addEventListener('mouseout', handleDrawEnd);

    $canvas.addEventListener('touchstart', handleDrawStart);
    $canvas.addEventListener('touchmove', handleDrawMove);
    $canvas.addEventListener('touchend', handleDrawEnd);

    // Xử lý thanh công cụ
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

    // --- 2. LOGIC CHAT & ĐOÁN ---
    function renderChatMessage(player, message, type = 'msg-guess') {
        const el = document.createElement('div');
        el.className = `chat-message ${type}`;
        el.innerHTML = `<strong>${player}:</strong> ${message}`;
        $chatMessages.appendChild(el);
        $chatMessages.scrollTop = $chatMessages.scrollHeight;
    }

    function disableGuessInput(disabled = true) {
        $guessInput.disabled = disabled;
        $sendGuess.disabled = disabled;
        if (disabled) {
            $guessInput.placeholder = currentDrawer === playerName ? 'Bạn là Họa sĩ, không được đoán.' : 'Chờ vòng mới...';
        } else {
            $guessInput.placeholder = 'Nhập từ khóa đoán hoặc chat...';
        }
    }

    function handleSendGuess() {
        const guess = $guessInput.value.trim();
        if (!guess) return;

        $guessInput.value = '';
        
        if (currentDrawer === playerName) {
            // Họa sĩ chỉ gửi dưới dạng chat thường
            socket.emit(`${GAME_ID}-guess`, { roomCode, player: playerName, guess: `(Chat): ${guess}` });
        } else {
            // Người chơi gửi cả chat và từ khóa đoán
            socket.emit(`${GAME_ID}-guess`, { roomCode, player: playerName, guess });
        }
    }

    $sendGuess.addEventListener('click', handleSendGuess);
    $guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendGuess();
    });

    // --- 3. LOGIC SOCKET GAME ---
    socket.on('connect', () => {
        console.log(`[${GAME_ID}][client] socket connected`);
        const playerObj = { name: playerName };
        socket.emit(`${GAME_ID}-join`, { roomCode, player: playerObj });
    });

    // Cần hàm giả định này để lấy Avatar (vì Room Model đã lưu players)
    function pickAvatarFor(name) {
        const player = roomPlayers.find(p => p.name === name);
        if (player && player.avatar) return player.avatar;
        // Dicebear fallback (Giả định URL này hoạt động)
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(name)}`;
    }

    socket.on(`${GAME_ID}-room-update`, ({ state, room }) => {
        console.log(`[${GAME_ID}][client] room-update`, state);
        currentHost = room.host;
        roomPlayers = room.players; // Lưu danh sách players
        
        if ($room) $room.textContent = room.code || '—';
        if ($playersCount) $playersCount.textContent = roomPlayers.length;
        
        // Render điểm số (dùng danh sách player)
        renderScores(state.scores, state.drawer, roomPlayers);
        
        // --- XỬ LÝ NÚT BẮT ĐẦU GAME ---
        let startBtn = document.getElementById('startGameBtn');
        const gameNotRunning = !state.drawer;
        
        if (currentHost === playerName && gameNotRunning) {
             if (!startBtn) {
                startBtn = document.createElement('button');
                startBtn.id = 'startGameBtn';
                startBtn.className = 'btn btn-primary';
                startBtn.textContent = '🚀 Bắt đầu Vẽ Đoán';
                startBtn.addEventListener('click', () => socket.emit(`${GAME_ID}-start-game`, { roomCode }));
                
                if ($gameStatus) {
                    $gameStatus.innerHTML = 'Nhấn'; 
                    $gameStatus.appendChild(startBtn); 
                    $gameStatus.insertAdjacentText('beforeend', 'để chơi!');
                }
             }
             startBtn.style.display = 'inline-block';
             disableGuessInput(true); // Tắt đoán khi chờ
        } else if(startBtn) {
            startBtn.style.display = 'none';
        }
        
        if (gameNotRunning && currentHost !== playerName) {
            $gameStatus.textContent = `Đang chờ ${currentHost} bắt đầu...`;
            disableGuessInput(true);
        }
    });

    socket.on(`${GAME_ID}-start-round`, ({ drawer, scores, round, wordHint }) => {
        currentDrawer = drawer;
        clearCanvas();
        $drawingTools.classList.toggle('hidden', currentDrawer !== playerName);
        $gameStatus.textContent = `Vòng ${round}: ${drawer} đang vẽ...`;
        
        // Hiển thị gợi ý
        $hintText.textContent = '_ '.repeat(wordHint).trim();
        $wordHint.classList.remove('hidden');
        
        // Cập nhật điểm và trạng thái người vẽ
        renderScores(scores, drawer, roomPlayers);
        renderChatMessage('Hệ thống', `Vòng ${round} bắt đầu! ${drawer} đang vẽ.`, 'msg-system');
        
        disableGuessInput(currentDrawer === playerName);
    });
    
    socket.on(`${GAME_ID}-secret-word`, ({ word }) => {
        // Chỉ gửi cho Họa sĩ
        $gameStatus.textContent = `BẠN ĐANG VẼ: ${word}`;
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
        
        // Tắt input cho người đoán đúng
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
        
        renderScores(scores, null, roomPlayers); // Cập nhật điểm cuối cùng
        disableGuessInput(true);
        
        setTimeout(() => {
            const startBtn = document.getElementById('startGameBtn');
            if (startBtn && currentHost === playerName) {
                startBtn.style.display = 'inline-block';
                $gameStatus.innerHTML = 'Nhấn'; 
                $gameStatus.appendChild(startBtn); 
                $gameStatus.insertAdjacentText('beforeend', 'để chơi!');
            } else {
                $gameStatus.textContent = `Đang chờ ${currentHost} bắt đầu...`;
            }
        }, 5000);
    });
    
    // --- 4. HÀM RENDER ĐIỂM SỐ CÓ AVATAR ---
    function renderScores(scores, drawerName, playerList = []) {
        if (!$scoreGrid) return;
        $scoreGrid.innerHTML = '';
        
        const playerNames = playerList.map(p => p.name);
        // Khởi tạo điểm số cho những người chưa có
        const mergedScores = playerNames.reduce((acc, name) => ({ ...acc, [name]: scores[name] || 0 }), { ...scores });
        
        const sortedPlayers = playerNames.sort((a, b) => mergedScores[b] - mergedScores[a]);

        sortedPlayers.forEach(name => {
            const playerInfo = playerList.find(p => p.name === name) || { name: name };
            const isDrawer = name === drawerName;
            
            // Avatar
            const elAvatar = document.createElement('div');
            elAvatar.innerHTML = `<img src="${pickAvatarFor(name)}" alt="${name}">`;
            $scoreGrid.appendChild(elAvatar);

            // Tên
            const elPlayer = document.createElement('div');
            elPlayer.className = 'score-player';
            if (isDrawer) elPlayer.classList.add('drawer');
            if (name === playerName) elPlayer.classList.add('you');
            
            elPlayer.innerHTML = isDrawer ? `🎨 ${name}` : name;
            $scoreGrid.appendChild(elPlayer);

            // Điểm
            const elScore = document.createElement('div');
            elScore.className = 'score-value';
            elScore.textContent = mergedScores[name] || 0;
            $scoreGrid.appendChild(elScore);
        });
    }

})();