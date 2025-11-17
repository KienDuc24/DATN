// js/room.js (Logic gốc + Logic Bot cập nhật)

// --- IIFE 1: Logic phòng chờ (Gốc) ---
(function() {
  const BASE_API_URL = 'https://datn-socket.up.railway.app'; 
  window.__chatbot_API_BASE__ = BASE_API_URL; 

  const socket = io(BASE_API_URL, { 
    path: '/socket.io',
    transports: ['websocket', 'polling'] 
  });
  
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('code');
  const gameId = urlParams.get('gameId'); // Quan trọng cho Bot
  const gameName = urlParams.get('game');
  let username = urlParams.get('user'); // Dùng let

  if (!roomCode || !gameId || !gameName) {
    alert('Thiếu thông tin phòng (code, gameId, gameName). Vui lòng kiểm tra lại!');
    window.location.href = "index.html"; 
    return;
  }
  
  // Xử lý username (giống logic của bạn)
  if (!username) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    username = user.username || user.displayName || user.name;
  }
  if (!username) {
    username = sessionStorage.getItem("playerName");
  }
  if (!username) {
    username = "Guest_" + Math.random().toString(36).substring(2, 8);
    // Sửa lỗi: Gán vào 'username' chứ không phải 'playerName'
    if (username) sessionStorage.setItem("playerName", username); 
  }
  // Gán lại playerName (tên biến cũ của bạn)
  const playerName = username;

  console.log("👤 Tên người dùng hiện tại:", playerName);

  // Hiển thị thông tin phòng
  if (document.getElementById("roomCode")) document.getElementById("roomCode").innerText = roomCode;
  if (document.getElementById("roomCodeDisplay")) document.getElementById("roomCodeDisplay").innerText = roomCode;
  if (document.getElementById("gameName")) document.getElementById("gameName").innerText = gameName; 

  // THÊM MỚI: Lấy icon game (từ logic mới)
  const $gameIcon = document.getElementById("gameIcon");
  if ($gameIcon) {
    $gameIcon.src = `game/${gameId}/Img/logo.png`;
    $gameIcon.onerror = () => { $gameIcon.src = 'img/fav.svg'; }; // Fallback
  }

  socket.emit("joinRoom", { code: roomCode, gameId: gameId, user: playerName });

  socket.on("room-error", ({ message }) => {
    alert(message || "Không thể vào phòng này!");
    window.location.href = "index.html";
  });

  let currentHost = null;

  socket.on("update-players", ({ list = [], host }) => {
    currentHost = host;
    const isHost = (playerName === host); 
    console.log("👥 Danh sách người chơi hiện tại:", list);

    const listEl = document.getElementById("playerList");
    if (listEl) {
      if (list.length === 0) {
        listEl.innerHTML = `<li id="loadingPlayers">Chưa có người chơi nào.</li>`;
      } else {
        // Sắp xếp host lên đầu
        const sortedList = list.sort((a, b) => {
            // Sửa: Xử lý cả 'a' và 'a.name'
            const nameA = (typeof a === 'object' && a.name) ? a.name : a; 
            const nameB = (typeof b === 'object' && b.name) ? b.name : b;
            return (nameA === host ? -1 : nameB === host ? 1 : 0);
        });
        
        listEl.innerHTML = sortedList.map(player => {
          const p_name = (typeof player === 'object' && player.name) ? player.name : player; // Xử lý cả object và string
          const isPlayerHost = (p_name === host);
          
          const kickButton = (isHost && !isPlayerHost) 
            ? `<button class="kick-btn" onclick="window.kickPlayer('${p_name}')" title="Kick ${p_name}">
                 <i class="fas fa-times"></i> Kick
               </button>`
            : "";

          const hostTag = isPlayerHost 
            ? `<span>(👑 Chủ phòng)</span>` 
            : "";

          return `<li>
                    <span>${p_name} ${hostTag}</span>
                    ${kickButton}
                  </li>`;
        }).join("");
      }
    }

    const startBtn = document.querySelector(".start-btn");
    if (startBtn) startBtn.style.display = isHost ? "inline-block" : "none";
  });

  window.leaveRoom = function() {
    socket.emit("leaveRoom", { code: roomCode, player: playerName });
    window.location.href = "index.html";
  };

  window.addEventListener("beforeunload", () => {
    socket.emit("leaveRoom", { code: roomCode, player: playerName });
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

  // THÊM: Logic kick
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
      user: playerName
    }).toString();
    window.location.href = `game/${data.gameId}/index.html?${params}`;
  });

})(); 
// --- Hết IIFE 1 ---


// --- IIFE 2: Logic Chatbot AI (ĐÃ CẬP NHẬT) ---
(function() {
  const API_BASE_URL =
    window.__chatbot_API_BASE__ ||
    '/api'; // Fallback

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

  const gameId = new URLSearchParams(window.location.search).get('gameId');

  // SỬA: Hàm thêm nút lựa chọn
  function addSuggestionButtons() {
    // Kiểm tra xem nút đã tồn tại chưa
    if (document.getElementById('chat-suggestions')) return;

    const suggestionsEl = document.createElement('div');
    suggestionsEl.id = 'chat-suggestions';
    suggestionsEl.className = 'chat-suggestions';
    suggestionsEl.innerHTML = `
        <button class="suggestion-btn" data-question="Mô tả game này">Mô tả game <i class="fas fa-info-circle"></i></button>
        <button class="suggestion-btn" data-question="Cách chơi game này thế nào?">Giải thích luật chơi <i class="fas fa-book"></i></button>
    `;
    chatMessages.appendChild(suggestionsEl);

    // Thêm sự kiện click cho các nút
    suggestionsEl.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.getAttribute('data-question');
            // Gửi câu hỏi từ nút như một tin nhắn
            handleSendChat(question); 
        });
    });
  }

  // SỬA: Hàm xóa nút lựa chọn
  function removeSuggestionButtons() {
    const suggestionsEl = document.getElementById('chat-suggestions');
    if (suggestionsEl) {
        suggestionsEl.remove();
    }
  }

  aiToolsIcon.addEventListener('click', () => {
    aichatbot.classList.toggle('hidden');
    // SỬA: Khi mở, thêm tin nhắn chào và các nút (nếu chat trống)
    if (!aichatbot.classList.contains('hidden') && !chatMessages.querySelector('.chat-message')) {
        addMessageToChat('🤖 Chào bạn. Tôi có thể giúp gì? Hãy chọn một chủ đề hoặc tự đặt câu hỏi nhé!', 'ai');
        addSuggestionButtons(); // Thêm nút
    }
  });

  closechatbot.addEventListener('click', () => {
    aichatbot.classList.add('hidden');
  });
  
  function addMessageToChat(text, sender) {
    if (!chatMessages) return;
    
    // SỬA: Khi người dùng gửi tin, xóa các nút gợi ý
    if (sender === 'user') {
        removeSuggestionButtons();
    }

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${sender}`; 
    messageEl.textContent = text;
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
    return messageEl;
  }

  async function getInstructionsFromAI(question) {
    const normalizedQuestion = String(question || '').trim();
    if (!normalizedQuestion) return '❌ Vui lòng nhập câu hỏi hợp lệ.';
    
    if (!gameId) {
        return '❌ Lỗi: Không tìm thấy gameId của phòng này.';
    }

    const endpoint = `${API_BASE_URL}/api/ai/ask`; 
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            question: normalizedQuestion,
            gameId: gameId 
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

  // SỬA: Cho phép truyền câu hỏi được định nghĩa trước
  async function handleSendChat(predefinedQuestion = null) {
    const question = predefinedQuestion || chatInput.value.trim();
    if (!question) return;
    
    chatInput.disabled = true;
    sendChat.disabled = true;

    // SỬA: Xóa nút gợi ý ngay khi bắt đầu gửi
    removeSuggestionButtons();
    
    addMessageToChat(question, 'user');
    chatInput.value = ''; 

    const loaderMessage = addMessageToChat('🤖 Đang suy nghĩ...', 'ai loader');

    const aiResponse = await getInstructionsFromAI(question);

    loaderMessage.remove(); 
    addMessageToChat(aiResponse, 'ai'); 

    chatInput.disabled = false;
    sendChat.disabled = false;
    chatInput.focus();
  }
  
  sendChat.addEventListener('click', () => handleSendChat(null)); 
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendChat(null);
    }
  });

})();
