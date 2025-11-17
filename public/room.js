// js/room.js

const BASE_API_URL = 'https://datn-socket.up.railway.app'; // URL của socket server

const socket = io(BASE_API_URL, { 
  path: '/socket.io',
  transports: ['websocket', 'polling'] 
});

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('code');
const gameId = urlParams.get('gameId');
const gameName = urlParams.get('game');
const username = urlParams.get('user');

if (!roomCode || !gameId || !gameName || !username) {
  alert('Thiếu thông tin phòng. Vui lòng kiểm tra lại!');
  window.location.href = "index.html"; 
} else {
  console.log('Thông tin phòng:', { roomCode, gameId, gameName, username });
}

let playerName = username; 
if (!playerName) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  playerName = user.username || user.displayName || user.name;
}
if (!playerName) {
  playerName = sessionStorage.getItem("playerName");
}
if (!playerName) {
  playerName = prompt("Tên của bạn là?");
  if (playerName) sessionStorage.setItem("playerName", playerName);
}
if (!playerName) playerName = "Guest";

console.log("👤 Tên người dùng hiện tại:", playerName);

// Hiển thị thông tin phòng
if (document.getElementById("roomCode")) document.getElementById("roomCode").innerText = roomCode;
if (document.getElementById("roomCodeDisplay")) document.getElementById("roomCodeDisplay").innerText = roomCode;
if (document.getElementById("gameName")) document.getElementById("gameName").innerText = gameName; 
if (document.getElementById("room-username")) document.getElementById("room-username").innerText = playerName;

socket.emit("joinRoom", { code: roomCode, gameId: gameId, user: playerName });

socket.on("room-error", ({ message }) => {
  alert(message || "Không thể vào phòng này!");
  window.location.href = "index.html";
});

let currentHost = null;

socket.on("update-players", ({ list = [], host }) => {
  currentHost = host;
  const isHost = (playerName === host); // Kiểm tra xem bạn có phải chủ phòng không
  console.log("👥 Danh sách người chơi hiện tại:", list);

  const listEl = document.getElementById("playerList");
  if (listEl) {
    if (list.length === 0) {
      listEl.innerHTML = `<li>Chưa có người chơi nào.</li>`;
    } else {
      const sortedList = list.sort((a, b) => (a === host ? -1 : b === host ? 1 : 0));
      
      // --- CẬP NHẬT GIAO DIỆN ---
      // Thêm nút "Kick" nếu bạn là chủ phòng
      listEl.innerHTML = sortedList.map(name => {
        // Nút Kick chỉ hiển thị nếu BẠN là host VÀ người chơi này KHÔNG PHẢI là bạn
        const kickButton = (isHost && name !== host) 
          ? `<button class="kick-btn" onclick="kickPlayer('${name}')">Kick</button>`
          : "";
          
        return `<li>
                  ${name} ${name === host ? "(👑 Chủ phòng)" : ""}
                  ${kickButton}
                </li>`;
      }).join("");
      // ----------------------------
    }
  }

  const startBtn = document.querySelector(".start-btn");
  if (startBtn) startBtn.style.display = isHost ? "inline-block" : "none";
});

window.leaveRoom = function leaveRoom() {
  socket.emit("leaveRoom", { code: roomCode, player: playerName });
  window.location.href = "index.html";
};

window.addEventListener("beforeunload", () => {
  socket.emit("leaveRoom", { code: roomCode, player: playerName });
});

window.copyCode = function copyCode() {
  navigator.clipboard.writeText(roomCode);
  alert("📋 Mã phòng đã được sao chép!");
};

window.startGame = function startGame() {
  console.log('Chủ phòng yêu cầu bắt đầu game...');
  socket.emit('startGame', { code: roomCode });
}

// --- THÊM MỚI (1/2): HÀM GỬI SỰ KIỆN KICK ---
window.kickPlayer = function kickPlayer(playerToKick) {
  if (confirm(`Bạn có chắc muốn kick người chơi "${playerToKick}" không?`)) {
    console.log(`Yêu cầu kick: ${playerToKick}`);
    socket.emit('kickPlayer', { code: roomCode, playerToKick: playerToKick });
  }
}
// ----------------------------------------

// --- THÊM MỚI (2/2): LẮNG NGHE SỰ KIỆN KHI BẠN BỊ KICK ---
socket.on('kicked', () => {
  alert('Bạn đã bị chủ phòng kick ra khỏi phòng!');
  window.location.href = 'index.html';
});
// ------------------------------------------------

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

socket.on('kicked', (data) => {
    alert(data.message || 'Bạn đã bị Admin kick khỏi phòng.');
    window.location.href = 'index.html';
});


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