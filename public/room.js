// public/room.js (Logic phòng chờ + Hiển thị tên đúng)

(function() {
  const BASE_API_URL = 'https://datn-socket.up.railway.app'; 
  window.__chatbot_API_BASE__ = BASE_API_URL; // Để chatbot.js dùng

  const socket = io(BASE_API_URL, { 
    path: '/socket.io',
    transports: ['websocket', 'polling'] 
  });
  
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('code');
  const gameId = urlParams.get('gameId');
  const gameName = urlParams.get('game');
  // Lấy username từ URL (đã được truyền từ main.js)
  const usernameFromURL = urlParams.get('user');

  if (!roomCode || !gameId || !gameName || !usernameFromURL) {
    alert('Thiếu thông tin phòng. Vui lòng kiểm tra lại!');
    window.location.href = "index.html"; 
    return;
  }
  
  // Luôn dùng username từ URL làm định danh chính
  const playerName = usernameFromURL;

  console.log("👤 Username hiện tại:", playerName);

  // Hiển thị thông tin phòng
  if (document.getElementById("roomCode")) document.getElementById("roomCode").innerText = roomCode;
  if (document.getElementById("roomCodeDisplay")) document.getElementById("roomCodeDisplay").innerText = roomCode;
  if (document.getElementById("gameName")) document.getElementById("gameName").innerText = gameName; 

  const $gameIcon = document.getElementById("gameIcon");
  if ($gameIcon) {
    $gameIcon.src = `game/${gameId}/Img/logo.png`;
    $gameIcon.onerror = () => { $gameIcon.src = 'img/fav.svg'; }; 
  }

  // Gửi yêu cầu tham gia phòng
  socket.emit("joinRoom", { code: roomCode, gameId: gameId, user: playerName });

  socket.on("room-error", ({ message }) => {
    alert(message || "Không thể vào phòng này!");
    window.location.href = "index.html";
  });

  let currentHost = null;

  // SỬA: Xử lý danh sách người chơi (list là mảng object {username, displayName})
  // public/room.js (Thay thế toàn bộ listener 'update-players')

socket.on("update-players", ({ list = [], host }) => {
    currentHost = host;
    const isHost = (playerName === host); 
    console.log("👥 Danh sách người chơi hiện tại:", list);

    const listEl = document.getElementById("playerList");
    if (listEl) {
      if (!Array.isArray(list) || list.length === 0) {
        listEl.innerHTML = `<li style="text-align:center">Chưa có người chơi nào.</li>`;
        return; 
      }
      
      // 1. Sắp xếp host lên đầu (Sử dụng .name để so sánh)
      const sortedList = list.sort((a, b) => {
          const nameA = a.name; 
          const nameB = b.name;
          return (nameA === host ? -1 : nameB === host ? 1 : 0);
      });
      
      // 2. Render danh sách
      listEl.innerHTML = sortedList.map(player => {
        const p_name = player.name;
        // Hiển thị displayName, nếu null thì hiển thị name (username)
        const p_displayName = player.displayName || p_name; 
        const isPlayerHost = (p_name === host);
        
        const kickButton = (isHost && !isPlayerHost) 
          ? `<button class="kick-btn" onclick="window.kickPlayer('${p_name}')" title="Kick ${p_displayName}">
               <i class="fas fa-times"></i> Kick
             </button>`
          : "";

        const hostTag = isPlayerHost 
          ? `<span>(👑 Chủ phòng)</span>` 
          : "";

        return `<li>
                  <span>${p_displayName} ${hostTag}</span>
                  ${kickButton}
                </li>`;
      }).join("");
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
    }).catch(err => {});
  };

  window.startGame = function() {
    socket.emit('startGame', { code: roomCode });
  }

  window.kickPlayer = function(playerToKick) {
    if (confirm(`Bạn có chắc muốn kick người chơi này không?`)) {
      socket.emit('kickPlayer', { code: roomCode, playerToKick: playerToKick });
    }
  }

  socket.on('kicked', () => {
    alert('Bạn đã bị chủ phòng kick ra khỏi phòng!');
    window.location.href = 'index.html';
  });

  socket.on('game-started', (data) => {
    const params = new URLSearchParams({
      code: roomCode,
      gameId: gameId,
      game: gameName,
      user: playerName // Chuyển tiếp username
    }).toString();
    window.location.href = `game/${data.gameId}/index.html?${params}`;
  });

})();