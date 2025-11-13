// public/game/DrawGuess/script.js

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
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentColor = $colorPicker.value;
    let currentSize = $sizeSlider.value;
    
    // --- 1. LOGIC VẼ (DRAWING LOGIC) ---

    // Hàm gửi nét vẽ đến Server
    function emitDraw(type, x, y, color = currentColor, size = currentSize) {
        if (currentDrawer !== playerName) return; 

        const data = { type, x, y, color, size };
        socket.emit(`${GAME_ID}-draw`, { roomCode, data });
        draw(data); // Vẽ cục bộ ngay lập tức
    }

    // Hàm nhận và vẽ từ Server
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
    
    // Hàm làm sạch Canvas
    function clearCanvas() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, $canvas.width, $canvas.height);
    }
    clearCanvas(); // Khởi tạo canvas trắng

    // Xử lý sự kiện chuột/chạm
    function getMousePos(e) {
        const rect = $canvas.getBoundingClientRect();
        let x, y;
        
        if (e.touches && e.touches.length > 0) {
            x = e.touches[0].clientX;
            y = e.touches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }

        // Tỷ lệ hóa tọa độ về kích thước gốc của Canvas (800x600)
        const scaleX = $canvas.width / rect.width;
        const scaleY = $canvas.height / rect.height;
        
        return {
            x: (x - rect.left) * scaleX,
            y: (y - rect.top) * scaleY
        };
    }

    function handleDrawStart(e) {
        if (currentDrawer !== playerName) return;
        isDrawing = true;
        const pos = getMousePos(e);
        lastX = pos.x;
        lastY = pos.y;
        emitDraw('start', lastX, lastY);
        e.preventDefault();
    }

    function handleDrawMove(e) {
        if (!isDrawing || currentDrawer !== playerName) return;
        const pos = getMousePos(e);
        emitDraw('move', pos.x, pos.y);
        lastX = pos.x;
        lastY = pos.y;
        e.preventDefault();
    }

    function handleDrawEnd() {
        if (currentDrawer !== playerName) return;
        isDrawing = false;
    }

    // Gắn sự kiện
    $canvas.addEventListener('mousedown', handleDrawStart);
    $canvas.addEventListener('mousemove', handleDrawMove);
    $canvas.addEventListener('mouseup', handleDrawEnd);
    $canvas.addEventListener('mouseout', handleDrawEnd);

    $canvas.addEventListener('touchstart', handleDrawStart);
    $canvas.addEventListener('touchmove', handleDrawMove);
    $canvas.addEventListener('touchend', handleDrawEnd);

    // Xử lý thanh công cụ
    $colorPicker.addEventListener('input', (e) => currentColor = e.target.value);
    $sizeSlider.addEventListener('input', (e) => currentSize = e.target.value);
    
    $clearBtn.addEventListener('click', () => {
        if (currentDrawer === playerName) {
            socket.emit(`${GAME_ID}-clear`, { roomCode });
            clearCanvas();
        }
    });

    $eraseBtn.addEventListener('click', () => {
        currentColor = 'white'; // Tẩy bằng cách chọn màu nền
    });


    // --- 2. LOGIC CHAT & ĐOÁN ---

    function renderChatMessage(player, message, type = 'msg-guess') {
        const el = document.createElement('div');
        el.className = `chat-message ${type}`;
        el.innerHTML = `<strong>${player}:</strong> ${message}`;
        $chatMessages.appendChild(el);
        $chatMessages.scrollTop = $chatMessages.scrollHeight;
    }

    function handleSendGuess() {
        const guess = $guessInput.value.trim();
        if (!guess) return;

        $guessInput.value = '';
        
        if (currentDrawer === playerName) {
            // Nếu là Họa sĩ, chỉ gửi dưới dạng chat thường
            socket.emit(`${GAME_ID}-guess`, { roomCode, player: playerName, guess: `(Chat): ${guess}` });
        } else {
            // Nếu là người đoán, gửi cả chat và từ khóa đoán
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
        const playerObj = { name: playerName }; // Thêm các thuộc tính khác nếu cần
        socket.emit(`${GAME_ID}-join`, { roomCode, player: playerObj });
    });

    socket.on(`${GAME_ID}-room-update`, ({ state, room }) => {
        console.log(`[${GAME_ID}][client] room-update`, state);
        currentHost = room.host;
        if ($room) $room.textContent = room.code || '—';
        if ($playersCount) $playersCount.textContent = room.players.length;
        
        renderScores(state.scores, state.drawer, room.players);
        
        // Tạo nút bắt đầu game cho Host
        let startBtn = document.getElementById('startGameBtn');
        if (currentHost === playerName && !state.drawer) {
             if (!startBtn) {
                startBtn = document.createElement('button');
                startBtn.id = 'startGameBtn';
                startBtn.className = 'btn btn-primary';
                startBtn.textContent = '🚀 Bắt đầu Vẽ Đoán';
                startBtn.addEventListener('click', () => socket.emit(`${GAME_ID}-start-game`, { roomCode }));
                document.querySelector('.game-status').appendChild(startBtn);
             }
             startBtn.style.display = 'block';
        } else if(startBtn) {
            startBtn.style.display = 'none';
        }

        if (!state.drawer) {
            $gameStatus.textContent = currentHost === playerName ? 'Nhấn Bắt đầu để chơi!' : `${currentHost} đang chờ đợi...`;
            $wordHint.classList.add('hidden');
        }
    });

    socket.on(`${GAME_ID}-start-round`, ({ drawer, scores, round, wordHint }) => {
        currentDrawer = drawer;
        clearCanvas();
        $drawingTools.classList.toggle('hidden', currentDrawer !== playerName);
        $gameStatus.textContent = `${drawer} đang vẽ...`;
        
        // Hiển thị gợi ý
        $hintText.textContent = '_ '.repeat(wordHint).trim();
        $wordHint.classList.remove('hidden');
        
        // Cập nhật điểm và trạng thái người vẽ
        renderScores(scores, drawer);
        renderChatMessage('Hệ thống', `Vòng ${round} bắt đầu! ${drawer} đang vẽ.`, 'msg-system');
    });
    
    socket.on(`${GAME_ID}-secret-word`, ({ word }) => {
        // Chỉ gửi cho Họa sĩ
        $gameStatus.textContent = `BẠN ĐANG VẼ: ${word}`;
    });

    socket.on(`${GAME_ID}-drawing`, (data) => {
        // Vẽ nếu không phải là Họa sĩ (vì Họa sĩ đã vẽ cục bộ)
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
        renderScores(scores, currentDrawer);
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
        
        renderScores(scores, null); // Cập nhật điểm cuối cùng
        
        // Hiển thị lại nút Start cho Host sau 5s chờ
        setTimeout(() => {
            const startBtn = document.getElementById('startGameBtn');
            if (startBtn && currentHost === playerName) startBtn.style.display = 'block';
            $gameStatus.textContent = currentHost === playerName ? 'Nhấn Bắt đầu để chơi!' : `${currentHost} đang chờ đợi...`;
        }, 5000);
    });
    
    // --- 4. HÀM RENDER ĐIỂM SỐ ---
    function renderScores(scores, drawerName, playerList = []) {
        if (!$scoreGrid) return;
        $scoreGrid.innerHTML = '';
        
        let allPlayers = Object.keys(scores);
        // Nếu không có điểm số, lấy từ danh sách players trong room
        if (!allPlayers.length && playerList.length) {
             allPlayers = playerList.map(p => p.name);
             scores = allPlayers.reduce((acc, name) => ({ ...acc, [name]: 0 }), {});
        }
        
        const sortedPlayers = allPlayers.sort((a, b) => (scores[b] || 0) - (scores[a] || 0));

        sortedPlayers.forEach(name => {
            const elPlayer = document.createElement('div');
            elPlayer.className = 'score-player';
            if (name === drawerName) elPlayer.classList.add('drawer');
            if (name === playerName) elPlayer.classList.add('you');
            
            const icon = name === drawerName ? '🎨 ' : (name === playerName ? '👤 ' : '');
            elPlayer.innerHTML = `${icon}${name}`;
            $scoreGrid.appendChild(elPlayer);

            const elScore = document.createElement('div');
            elScore.className = 'score-value';
            elScore.textContent = scores[name] || 0;
            $scoreGrid.appendChild(elScore);
        });
    }

})();