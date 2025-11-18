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
  socket.on("update-players", ({ list = [], host }) => {
    currentHost = host;
    const isHost = (playerName === host); // So sánh bằng username

    console.log("👥 Danh sách người chơi:", list);

    const listEl = document.getElementById("playerList");
    if (listEl) {
      if (list.length === 0) {
        listEl.innerHTML = `<li id="loadingPlayers">Chưa có người chơi nào.</li>`;
      } else {
        // Sắp xếp host lên đầu
        const sortedList = list.sort((a, b) => {
            const uA = a.username || a.name || a; // Hỗ trợ cả cấu trúc cũ và mới
            const uB = b.username || b.name || b;
            return (uA === host ? -1 : uB === host ? 1 : 0);
        });
        
        listEl.innerHTML = sortedList.map(player => {
          // Xử lý dữ liệu linh hoạt (phòng khi server gửi format cũ)
          let p_username, p_display;
          
          if (typeof player === 'object') {
              // Format mới: { username, displayName }
              p_username = player.username || player.name;
              p_display = player.displayName || p_username;
          } else {
              // Format cũ: "string_name"
              p_username = player;
              p_display = player;
          }
          
          const isPlayerHost = (p_username === host);
          const isMe = (p_username === playerName);
          
          // Nút Kick: Gửi p_username (ID) đi
          const kickButton = (isHost && !isMe) 
            ? `<button class="kick-btn" onclick="window.kickPlayer('${p_username}')" title="Kick ${p_display}">
                 ❌
               </button>`
            : "";

          const hostTag = isPlayerHost ? `<span>(👑 Chủ phòng)</span>` : "";
          const youTag = isMe ? `<span>(Bạn)</span>` : "";

          return `<li>
                    <span class="player-name ${isPlayerHost ? 'host' : ''}">
                        ${p_display} ${hostTag} ${youTag}
                    </span>
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