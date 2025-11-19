// public/room.js (Cập nhật: Hiển thị Avatar DiceBear trong phòng chờ)

(function() {
  const BASE_API_URL = 'https://datn-socket.up.railway.app'; 
  window.__chatbot_API_BASE__ = BASE_API_URL; 

  const socket = io(BASE_API_URL, { 
    path: '/socket.io',
    transports: ['websocket', 'polling'] 
  });
  
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('code');
  const gameId = urlParams.get('gameId');
  const gameName = urlParams.get('game');
  const usernameFromURL = urlParams.get('user');

  if (!roomCode || !gameId || !gameName || !usernameFromURL) {
    alert('Thiếu thông tin phòng. Vui lòng kiểm tra lại!');
    window.location.href = "index.html"; 
    return;
  }
  
  const playerName = usernameFromURL;
  console.log("👤 Username hiện tại:", playerName);

  if (document.getElementById("roomCode")) document.getElementById("roomCode").innerText = roomCode;
  if (document.getElementById("roomCodeDisplay")) document.getElementById("roomCodeDisplay").innerText = roomCode;
  if (document.getElementById("gameName")) document.getElementById("gameName").innerText = gameName; 

  const $gameIcon = document.getElementById("gameIcon");
  if ($gameIcon) {
    $gameIcon.src = `game/${gameId}/Img/logo.png`;
    $gameIcon.onerror = () => { $gameIcon.src = 'img/fav.svg'; }; 
  }

  socket.emit("joinRoom", { code: roomCode, gameId: gameId, user: playerName });

  socket.on("room-error", ({ message }) => {
    alert(message || "Không thể vào phòng này!");
    window.location.href = "index.html";
  });

  let currentHost = null;

  // --- HÀM HELPER TẠO AVATAR ---
  function getAvatarUrl(name) {
    const safeName = name || 'guest';
    return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
  }

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
      
      const sortedList = list.sort((a, b) => {
          const nameA = a.name; 
          const nameB = b.name;
          return (nameA === host ? -1 : nameB === host ? 1 : 0);
      });
      
      // --- CẬP NHẬT RENDER: THÊM AVATAR VÀO HTML ---
      listEl.innerHTML = sortedList.map(player => {
        const p_name = player.name;
        const p_displayName = player.displayName || p_name; 
        const isPlayerHost = (p_name === host);
        
        // Tạo URL Avatar
        const avatarUrl = getAvatarUrl(p_name);

        const kickButton = (isHost && !isPlayerHost) 
          ? `<button class="kick-btn" onclick="window.kickPlayer('${p_name}')" title="Kick ${p_displayName}" style="margin-left: auto;">
               <i class="fas fa-times"></i>
             </button>`
          : "";

        const hostTag = isPlayerHost 
          ? `<span style="color:#ff9800; font-size: 0.9em; margin-left:4px;">(👑)</span>` 
          : "";

        // Thêm Flexbox để căn chỉnh: Avatar - Tên - Nút Kick
        return `<li style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 8px 12px;">
                  <img src="${avatarUrl}" alt="${p_name}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #eee; object-fit: cover;">
                  <span style="font-weight: 600; color: #333;">${p_displayName} ${hostTag}</span>
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
      user: playerName 
    }).toString();
    window.location.href = `game/${data.gameId}/index.html?${params}`;
  });

})();