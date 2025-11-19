// public/room.js (FULL CODE - Đã thêm xác nhận khi thoát)

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

  // Hiển thị thông tin phòng
  if (document.getElementById("roomCode")) document.getElementById("roomCode").innerText = roomCode;
  if (document.getElementById("roomCodeDisplay")) document.getElementById("roomCodeDisplay").innerText = roomCode;
  if (document.getElementById("gameName")) document.getElementById("gameName").innerText = gameName; 

  const $gameIcon = document.getElementById("gameIcon");
  if ($gameIcon) {
    $gameIcon.src = `game/${gameId}/Img/logo.png`;
    $gameIcon.onerror = () => { $gameIcon.src = 'img/fav.svg'; }; 
  }

  // Tham gia phòng
  socket.emit("joinRoom", { code: roomCode, gameId: gameId, user: playerName });

  socket.on("room-error", ({ message }) => {
    alert(message || "Không thể vào phòng này!");
    window.location.href = "index.html";
  });

  // Biến lưu trữ chủ phòng hiện tại để kiểm tra khi thoát
  let currentHost = null;

  // --- HÀM HELPER TẠO AVATAR ---
  function getAvatarUrl(name) {
    const safeName = name || 'guest';
    return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
  }

  // Cập nhật danh sách người chơi
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
      
      // Sắp xếp: Chủ phòng lên đầu
      const sortedList = list.sort((a, b) => {
          const nameA = a.name; 
          const nameB = b.name;
          return (nameA === host ? -1 : nameB === host ? 1 : 0);
      });
      
      // Render danh sách
      listEl.innerHTML = sortedList.map(player => {
        const p_name = player.name;
        const p_displayName = player.displayName || p_name; 
        const isPlayerHost = (p_name === host);
        
        const avatarUrl = getAvatarUrl(p_name);

        // Nút Kick chỉ hiện với Host và không kick chính mình
        const kickButton = (isHost && !isPlayerHost) 
          ? `<button class="kick-btn" onclick="window.kickPlayer('${p_name}')" title="Kick ${p_displayName}" style="margin-left: auto; color: #ff4757; background: none; border: 1px solid #ff4757; border-radius: 4px; padding: 2px 8px; cursor: pointer;">
               <i class="fas fa-times"></i> Kick
             </button>`
          : "";

        const hostTag = isPlayerHost 
          ? `<span style="color:#ff9800; font-size: 0.9em; margin-left:4px;">(👑 Chủ phòng)</span>` 
          : "";

        return `<li style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 8px 12px; border-bottom: 1px solid #eee;">
                  <img src="${avatarUrl}" alt="${p_name}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #eee; object-fit: cover;">
                  <span style="font-weight: 600; color: #333;">${p_displayName} ${hostTag}</span>
                  ${kickButton}
                </li>`;
      }).join("");
    }

    // Hiển thị nút bắt đầu nếu là Host
    const startBtn = document.querySelector(".start-btn");
    if (startBtn) startBtn.style.display = isHost ? "inline-block" : "none";
  });

  // --- CẬP NHẬT: Hàm thoát phòng có xác nhận ---
  window.leaveRoom = function() {
    let msg = "Bạn có chắc chắn muốn thoát khỏi phòng này?";
    
    // Cảnh báo đặc biệt nếu là chủ phòng
    if (playerName === currentHost) {
        msg = "⚠️ BẠN ĐANG LÀ CHỦ PHÒNG!\n\nNếu bạn thoát, quyền chủ phòng sẽ được chuyển tự động cho người kế tiếp trong danh sách.\n\nBạn có chắc chắn muốn thoát không?";
    }
    
    if (confirm(msg)) {
        socket.emit("leaveRoom", { code: roomCode, player: playerName });
        window.location.href = "index.html";
    }
  };

  window.addEventListener("beforeunload", () => {
    // Không cần confirm ở đây vì trình duyệt đã có cơ chế riêng, chỉ emit để server biết
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
    if (confirm(`Bạn có chắc muốn mời người chơi này ra khỏi phòng?`)) {
      socket.emit('kickPlayer', { code: roomCode, playerToKick: playerToKick });
    }
  }

  socket.on('kicked', ({ message }) => {
    alert(message || 'Bạn đã bị chủ phòng mời ra khỏi phòng!');
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