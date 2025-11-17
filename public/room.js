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
