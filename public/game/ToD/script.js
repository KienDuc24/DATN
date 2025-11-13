// public/game/DrawGuess/script.js (ĐÃ CẢI TIẾN GIAO DIỆN & FIX LỖI)

(() => {
    const GAME_ID = 'DG';
    const SOCKET_URL = "https://datn-socket.up.railway.app";
    window.socket = window.socket || (window.io && io(SOCKET_URL, { transports: ['websocket'], secure: true }));

    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const roomCode = params.get('code') || '';
    let playerName = params.get('user'); 

    // --- DEBUG 1: KIỂM TRA KHỞI TẠO PLAYER VÀ ROOM CODE ---
    console.log(`[${GAME_ID}][DEBUG INIT] PlayerName (từ URL):`, playerName);
    console.log(`[${GAME_ID}][DEBUG INIT] RoomCode (từ URL):`, roomCode);
    // -----------------------------------------------------

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
    
    // THÊM MỚI: DOM Element cho danh sách người chơi (đã có từ trước)
    let $playerListContainer; 
    
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
    $canvas.width = 800; // Có thể điều chỉnh tùy thuộc vào bố cục CSS
    $canvas.height = 600; // Có thể điều chỉnh tùy thuộc vào bố cục CSS
    
    function clearCanvas() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, $canvas.width, $canvas.height);
    }
    clearCanvas();

    // --- 1. LOGIC VẼ ---
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

        const scaleX = $canvas.width / rect.width;
        const scaleY = $canvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function handleDrawStart(e) {
        if (currentDrawer !== playerName) return; // Chỉ drawer mới được vẽ
        isDrawing = true;
        const pos = getMousePos(e);
        lastX = pos.x;
        lastY = pos.y;
        
        const drawColor = isEraser ? 'white' : currentColor;
        emitDraw('start', lastX, lastY, drawColor, currentSize);
        e.preventDefault();
    }

    function handleDrawMove(e) {
        if (!isDrawing || currentDrawer !== playerName) return; // Chỉ drawer mới được vẽ
        const pos = getMousePos(e);
        const drawColor = isEraser ? 'white' : currentColor;
        emitDraw('move', pos.x, pos.y, drawColor, currentSize);
        lastX = pos.x;
        lastY = pos.y;
        e.preventDefault();
    }

    function handleDrawEnd() {
        if (currentDrawer !== playerName) return; // Chỉ drawer mới được vẽ
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
        
        // Họa sĩ không đoán, chỉ chat
        if (currentDrawer === playerName) {
            socket.emit(`${GAME_ID}-guess`, { roomCode, player: playerName, guess: `(Chat): ${guess}` });
        } else {
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
        const playerObj = { name: playerName }; // Đảm bảo playerName được định nghĩa
        console.log(`[${GAME_ID}][DEBUG JOIN] Gửi join request: room=${roomCode}, player=${playerName}`);
        socket.emit(`${GAME_ID}-join`, { roomCode, player: playerObj });
    });

    function pickAvatarFor(name) {
        const player = roomPlayers.find(p => p.name === name);
        if (player && player.avatar) return player.avatar;
        return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(name)}`;
    }

    socket.on(`${GAME_ID}-room-update`, ({ state, room }) => {
        // --- DEBUG 3: KIỂM TRA TRẠNG THÁI HOST/PLAYER VÀ ĐIỀU KIỆN NÚT BẮT ĐẦU ---
        console.log(`[${GAME_ID}][DEBUG ROOM] Data nhận về: Host=${room.host}, Drawer=${state.drawer}`);
        console.log(`[${GAME_ID}][DEBUG ROOM] Điều kiện Host: (Host === Player) => ${room.host === playerName}`);
        console.log(`[${GAME_ID}][DEBUG ROOM] Điều kiện Game: (!Drawer) => ${!state.drawer}`);
        // -------------------------------------------------------------------------

        currentHost = room.host;
        roomPlayers = room.players;
        
        if ($room) $room.textContent = room.code || '—';
        if ($playersCount) $playersCount.textContent = roomPlayers.length;
        
        // Render điểm số
        renderScores(state.scores, state.drawer, roomPlayers);
        
        // Render danh sách người chơi
        renderPlayerList(roomPlayers);
        
        // --- CẬP NHẬT HIỂN THỊ TÊN HOST RÕ RÀNG TRONG ROOM INFO ---
        const hostEl = document.getElementById('hostDisplay');
        if (hostEl) hostEl.remove();

        const newHostEl = document.createElement('span');
        newHostEl.id = 'hostDisplay';
        newHostEl.style.fontWeight = 'bold';
        newHostEl.style.color = 'var(--accent-yellow)';
        newHostEl.textContent = `👑 Host: ${currentHost}`;

        const roomInfo = document.querySelector('.room-info');
        if (roomInfo) {
             roomInfo.appendChild(newHostEl);
        }
        
        // --- XỬ LÝ NÚT BẮT ĐẦU GAME ---
        let startBtn = document.getElementById('startGameBtn');
        const gameNotRunning = !state.drawer;
        
        // Tạo nút nếu chưa có và là host, game chưa chạy
        if (!startBtn && currentHost === playerName && gameNotRunning) {
            startBtn = document.createElement('button');
            startBtn.id = 'startGameBtn';
            startBtn.className = 'btn btn-primary start-game-btn'; // Thêm class để dễ style
            startBtn.textContent = '🚀 BẮT ĐẦU VẼ ĐOÁN';
            startBtn.addEventListener('click', () => {
                console.log(`[${GAME_ID}][DEBUG START] Host ${playerName} click START.`);
                socket.emit(`${GAME_ID}-start-game`, { roomCode });
            });
            
            // Chèn nút vào vị trí phù hợp (ví dụ: trong game-status)
            if ($gameStatus) {
                $gameStatus.innerHTML = ''; // Xóa text cũ nếu có
                $gameStatus.appendChild(startBtn);
            }
        }
        
        // Hiển thị/Ẩn nút dựa vào trạng thái
        if (startBtn) {
            if (currentHost === playerName && gameNotRunning) {
                startBtn.style.display = 'inline-block';
                $gameStatus.classList.remove('status-waiting'); // Loại bỏ trạng thái chờ
            } else {
                startBtn.style.display = 'none';
            }
        }

        // Cập nhật trạng thái hiển thị
        if (gameNotRunning) {
            if (currentHost !== playerName) {
                $gameStatus.textContent = `Đang chờ ${currentHost} bắt đầu...`;
                $gameStatus.classList.add('status-waiting'); // Thêm class cho trạng thái chờ
            } else if (!startBtn || startBtn.style.display === 'none') {
                // Nếu là host nhưng nút bị ẩn (do game đã chạy), hoặc chưa tạo nút
                $gameStatus.textContent = ''; // Xóa text nếu host đang thấy nút
            }
            disableGuessInput(true);
            $drawingTools.classList.add('hidden'); // Ẩn công cụ vẽ khi chưa bắt đầu
            $wordHint.classList.add('hidden'); // Ẩn gợi ý khi chưa bắt đầu
        } else {
            // Game đang chạy
            $gameStatus.classList.remove('status-waiting');
        }
    });

    socket.on(`${GAME_ID}-start-round`, ({ drawer, scores, round, wordHint }) => {
        currentDrawer = drawer;
        clearCanvas();
        
        // Hiển thị công cụ vẽ cho Họa sĩ, ẩn cho người đoán
        $drawingTools.classList.toggle('hidden', currentDrawer !== playerName);

        $gameStatus.textContent = `Vòng ${round}: ${drawer} đang vẽ...`;
        
        // Hiện gợi ý từ khóa
        $hintText.textContent = '_ '.repeat(wordHint).trim();
        $wordHint.classList.remove('hidden');
        
        renderScores(scores, drawer, roomPlayers);
        renderChatMessage('Hệ thống', `Vòng ${round} bắt đầu! ${drawer} đang vẽ.`, 'msg-system');
        
        disableGuessInput(currentDrawer === playerName); // Họa sĩ không được đoán
    });
    
    socket.on(`${GAME_ID}-secret-word`, ({ word }) => {
        $gameStatus.textContent = `BẠN ĐANG VẼ: ${word}`;
        $wordHint.classList.remove('hidden'); // Đảm bảo gợi ý từ khóa hiện
        $hintText.textContent = word; // Hiện từ khóa đầy đủ cho họa sĩ
    });

    socket.on(`${GAME_ID}-drawing`, (data) => {
        if (currentDrawer !== playerName) { // Chỉ người khác nhận mới vẽ
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
        $drawingTools.classList.add('hidden'); // Ẩn công cụ vẽ
        $gameStatus.textContent = `Vòng kết thúc! Từ khóa là: ${word}`;
        $wordHint.classList.add('hidden'); // Ẩn gợi ý
        
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
                startBtn.style.display = 'inline-block';
                $gameStatus.textContent = ''; // Xóa text cũ
                $gameStatus.appendChild(startBtn); 
            } else if (currentHost !== playerName) {
                $gameStatus.textContent = `Đang chờ ${currentHost} bắt đầu...`;
            }
        }, 5000); // 5 giây chờ trước khi hiển thị lại nút
    });
    
    // --- 4. HÀM RENDER ĐIỂM SỐ CÓ AVATAR ---
    function renderScores(scores, drawerName, playerList = []) {
        if (!$scoreGrid) return;
        $scoreGrid.innerHTML = '';
        
        const playerNames = playerList.map(p => p.name);
        const mergedScores = playerNames.reduce((acc, name) => ({ ...acc, [name]: scores[name] || 0 }), { ...scores });
        const sortedPlayers = playerNames.sort((a, b) => mergedScores[b] - mergedScores[a]);

        sortedPlayers.forEach(name => {
            const isDrawer = name === drawerName;
            
            const playerRow = document.createElement('div');
            playerRow.className = 'score-row';
            if (isDrawer) playerRow.classList.add('drawer-turn');
            if (name === playerName) playerRow.classList.add('you');

            playerRow.innerHTML = `
                <div class="score-avatar-name">
                    <img src="${pickAvatarFor(name)}" alt="${name}" class="player-avatar">
                    <span class="player-name">${isDrawer ? '🎨 ' : ''}${name}</span>
                </div>
                <div class="score-value">${mergedScores[name] || 0}</div>
            `;
            $scoreGrid.appendChild(playerRow);
        });
    }

    // --- 5. HÀM HIỂN THỊ DANH SÁCH NGƯỜI CHƠI (Tối ưu) ---
    function renderPlayerList(players) {
        // Tạo container nếu chưa có (chỉ 1 lần)
        if (!$playerListContainer) {
            $playerListContainer = document.createElement('div');
            $playerListContainer.id = 'playerList';
            $playerListContainer.className = 'player-list-section'; // Thêm class để style
            
            // Tìm vị trí để chèn, ví dụ sau scoreGrid
            const scoreSection = document.getElementById('scoreSection'); // Giả sử có một div với id='scoreSection'
            if (scoreSection) {
                scoreSection.insertAdjacentElement('afterend', $playerListContainer);
            } else {
                // Nếu không tìm thấy scoreSection, chèn vào cuối #gameContainer
                const gameContainer = document.getElementById('gameContainer');
                if (gameContainer) gameContainer.appendChild($playerListContainer);
            }
        }

        $playerListContainer.innerHTML = '<h3>Mọi người trong phòng</h3><ul class="player-list-ul"></ul>'; // Reset và thêm tiêu đề
        const ul = $playerListContainer.querySelector('.player-list-ul');
        if (!ul) return;
        
        players.forEach(p => {
            const li = document.createElement('li');
            li.className = 'player-list-item';
            
            const isHost = p.name === currentHost;
            const isYou = p.name === playerName;

            li.innerHTML = `
                <img src="${pickAvatarFor(p.name)}" alt="${p.name}" class="player-list-avatar">
                <span class="player-list-name">${p.name}</span>
                ${isHost ? '<span class="player-tag host-tag">👑 Host</span>' : ''}
                ${isYou && !isHost ? '<span class="player-tag you-tag">(Bạn)</span>' : ''}
            `;
            ul.appendChild(li);
        });
    }

})();