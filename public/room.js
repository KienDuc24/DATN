// js/room.js (Đã cập nhật lại toàn bộ)

(function() {
  const BASE_API_URL = 'https://datn-socket.up.railway.app'; // URL của socket server
  window.__chatbot_API_BASE__ = BASE_API_URL; // Cung cấp base URL cho chatbot AI

  const socket = io(BASE_API_URL, { 
    path: '/socket.io',
    transports: ['websocket', 'polling'] 
  });

  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('code');
  const gameId = urlParams.get('gameId'); // Rất quan trọng cho AI
  const gameName = urlParams.get('game');
  let username = urlParams.get('user'); // Giữ let để có thể thay đổi

  if (!roomCode || !gameId || !gameName) {
    alert('Thiếu thông tin phòng (code, gameId, gameName). Vui lòng kiểm tra lại!');
    window.location.href = "index.html"; 
    return;
  }
  
  // Ưu tiên username từ URL, nếu không có thì tìm trong localStorage/sessionStorage
  if (!username) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    username = user.username || user.displayName || user.name;
  }
  if (!username) {
    username = sessionStorage.getItem("playerName");
  }
  if (!username) {
    username = "Guest_" + Math.random().toString(36).substring(2, 8); // Tạo guest nếu không có
  }

  console.log("👤 Tên người dùng hiện tại:", username);

  // --- DOM Elements ---
  const $roomCode = document.getElementById("roomCode");
  const $roomCodeDisplay = document.getElementById("roomCodeDisplay");
  const $gameName = document.getElementById("gameName");
  const $gameIcon = document.getElementById("gameIcon");
  const $playerGrid = document.getElementById("playerGrid");
  const $startBtn = document.querySelector(".start-btn");

  // Hiển thị thông tin phòng
  if ($roomCode) $roomCode.innerText = roomCode;
  if ($roomCodeDisplay) $roomCodeDisplay.innerText = roomCode;
  if ($gameName) $gameName.innerText = gameName; 
  // SỬA: Lấy icon game từ thư mục game
  if ($gameIcon) {
    $gameIcon.src = `game/${gameId}/Img/logo.png`;
    $gameIcon.onerror = () => { $gameIcon.src = 'img/fav.svg'; }; // Fallback
  }

  // Gửi sự kiện vào phòng
  socket.emit("joinRoom", { code: roomCode, gameId: gameId, user: username });

  socket.on("room-error", ({ message }) => {
    alert(message || "Không thể vào phòng này!");
    window.location.href = "index.html";
  });

  // --- Hàm render danh sách người chơi (MỚI) ---
  function renderPlayerList(players = [], host) {
    if (!$playerGrid) return;
    
    $playerGrid.innerHTML = ''; // Xóa nội dung cũ
    
    if (players.length === 0) {
      $playerGrid.innerHTML = `<div>Đang chờ người chơi...</div>`;
      return;
    }

    const isHost = (username === host); // Kiểm tra xem bạn có phải chủ phòng không

    // Sắp xếp: Host luôn lên đầu
    players.sort((a, b) => (a.name === host ? -1 : b.name === host ? 1 : 0));

    players.forEach(player => {
      const p_name = player.name || '...';
      const isCurrentPlayer = (p_name === username);
      const isPlayerHost = (p_name === host);
      
      const kickButton = (isHost && !isPlayerHost) // Chỉ host mới thấy nút kick, và không thể tự kick
        ? `<button class="kick-btn" onclick="window.kickPlayer('${p_name}')" title="Kick ${p_name}">
             <i class="fas fa-times"></i>
           </button>`
        : "";

      const hostTag = isPlayerHost 
        ? `<span class="host-tag" title="Chủ phòng">👑</span>` 
        : "";
        
      const avatarSrc = player.avatar || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(p_name)}`;

      const playerCard = document.createElement('div');
      playerCard.className = 'player-card';
      if (isCurrentPlayer) playerCard.classList.add('you'); // Thêm class 'you' (CSS có thể style)

      playerCard.innerHTML = `
        ${hostTag}
        <img src="${avatarSrc}" alt="${p_name}" class="player-avatar">
        <span class="player-name">${p_name}</span>
        ${kickButton}
      `;
      $playerGrid.appendChild(playerCard);
    });
  }
  
  socket.on("update-players", ({ list = [], host }) => {
    const isHost = (username === host);
    
    renderPlayerList(list, host);

    if ($startBtn) $startBtn.style.display = isHost ? "flex" : "none";
  });

  window.leaveRoom = function() {
    socket.emit("leaveRoom", { code: roomCode, player: username });
    window.location.href = "index.html";
  };

  window.addEventListener("beforeunload", () => {
    socket.emit("leaveRoom", { code: roomCode, player: username });
  });

  window.copyCode = function() {
    navigator.clipboard.writeText(roomCode).then(() => {
      alert("📋 Mã phòng đã được sao chép!");
    }).catch(err => {
      alert('Lỗi khi sao chép. Vui lòng thử lại.');
    });
  };

  window.startGame = function() {
    console.log('Chủ phòng yêu cầu bắt đầu game...');
    socket.emit('startGame', { code: roomCode });
  }

  window.kickPlayer = function(playerToKick) {
    if (confirm(`Bạn có chắc muốn kick người chơi "${playerToKick}" không?`)) {
      console.log(`Yêu cầu kick: ${playerToKick}`);
      socket.emit('kickPlayer', { code: roomCode, playerToKick: playerToKick });
    }
  }

  socket.on('kicked', () => {
    alert('Bạn đã bị chủ phòng kick ra khỏi phòng!');
    window.location.href = 'index.html';
  });

  socket.on('game-started', (data) => {
    console.log(`Server đã bắt đầu game. Chuyển hướng tới: game/${data.gameId}/index.html`);
    const params = new URLSearchParams({
      code: roomCode,
      gameId: gameId,
      game: gameName,
      user: username
    }).toString();
    window.location.href = `game/${data.gameId}/index.html?${params}`;
  });

})();


// --- THÊM MỚI: LOGIC CHATBOT AI (Đã di chuyển từ ToD) ---
(function() {
  const API_BASE_URL =
    window.__chatbot_API_BASE__ ||
    document.body.dataset.apiBase ||
    '/api';

  const aiToolsIcon = document.getElementById('ai-tools-icon');
  const aichatbot = document.getElementById('ai-chatbot');
  const chatInput = document.getElementById('chatInput');
  const sendChat = document.getElementById('sendChat');
  const chatMessages = document.getElementById('chatMessages');
  const closechatbot = document.getElementById('closechatbot');

  if (!aiToolsIcon || !aichatbot || !chatInput || !sendChat || !chatMessages || !closechatbot) {
      console.warn('AI chatbot elements not found. Skipping AI chat logic.');
      return;
  }

  // Lấy gameId từ URL (đã được định nghĩa ở scope ngoài)
  const gameId = new URLSearchParams(window.location.search).get('gameId');

  // Hiển thị hoặc ẩn chatbot
  aiToolsIcon.addEventListener('click', () => {
    aichatbot.classList.toggle('hidden');
    // Khởi tạo tin nhắn đầu tiên nếu trống
    if (!chatMessages.children.length) {
        addMessageToChat('🤖 Chào bạn. Tôi là AI Hướng dẫn. Hãy hỏi tôi về luật chơi của game này!', 'ai');
    }
  });

  closechatbot.addEventListener('click', () => {
    aichatbot.classList.add('hidden');
  });
  
  function addMessageToChat(text, sender) {
    if (!chatMessages) return;
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${sender}`; // 'ai' or 'user'
    messageEl.textContent = text;
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Cuộn xuống dưới
    return messageEl;
  }

  // Gửi câu hỏi đến API Backend (ĐÃ SỬA)
  async function getInstructionsFromAI(question) {
    const normalizedQuestion = String(question || '').trim();
    if (!normalizedQuestion) return '❌ Vui lòng nhập câu hỏi hợp lệ.';
    
    // SỬA: Phải gửi cả gameId để AI biết đọc luật nào
    if (!gameId) {
        return '❌ Lỗi: Không tìm thấy gameId của phòng này.';
    }

    const endpoint = `${API_BASE_URL}/api/ai/ask`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // SỬA: Gửi cả question và gameId
        body: JSON.stringify({ 
            question: normalizedQuestion,
            gameId: gameId // Gửi ID game (ví dụ: "ToD" hoặc "Draw")
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        return payload?.error || `❌ API trả về lỗi (${response.status}).`;
      }

      if (typeof payload?.answer === 'string' && payload.answer.trim()) {
        return payload.answer.trim();
      }

      return '❌ Server không trả về câu trả lời hợp lệ.';
    } catch (error) {
      console.error('[AI Chatbot] Request failed', endpoint, error);
      return '❌ Lỗi kết nối đến máy chủ AI.';
    }
  }

  // Xử lý gửi câu hỏi
  async function handleSendChat() {
    const question = chatInput.value.trim();
    if (!question) return;
    
    chatInput.disabled = true;
    sendChat.disabled = true;

    addMessageToChat(question, 'user');
    chatInput.value = ''; // Xóa input ngay

    // Thêm loader
    const loaderMessage = addMessageToChat('🤖 Đang suy nghĩ...', 'ai loader');

    // Gửi câu hỏi đến AI
    const aiResponse = await getInstructionsFromAI(question);

    // Xóa loader và hiển thị câu trả lời từ AI
    loaderMessage.remove(); // Xóa tin nhắn "Đang suy nghĩ..."
    addMessageToChat(aiResponse, 'ai'); // Thêm câu trả lời thật

    // Kích hoạt lại input/button
    chatInput.disabled = false;
    sendChat.disabled = false;
    chatInput.focus();
  }
  
  sendChat.addEventListener('click', handleSendChat);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendChat();
    }
  });

})();