(function() {
  const API_BASE_URL= 'https://datn-socket.up.railway.app'; 
  window.__chatbot_API_BASE__ = API_BASE_URL; 

  const socket = io(API_BASE_URL, { 
    path: '/socket.io',
    transports: ['websocket', 'polling'] 
  });
  
  let LANGS = {};
  const currentLang = localStorage.getItem('lang') || 'vi';

  async function loadLanguage() {
    try {
      const res = await fetch('/lang.json');
      LANGS = await res.json();
      updateRoomUI();
    } catch (e) {
      console.error("Không tải được ngôn ngữ:", e);
    }
  }
  
  function t(key, defaultText) {
    return LANGS[currentLang]?.[key] || defaultText || key;
  }

  function updateRoomUI() {
    const leaveBtn = document.querySelector('.leave-btn');
    if(leaveBtn) leaveBtn.innerHTML = `<i class="fas fa-arrow-left"></i> ${t('leave_room', 'Rời phòng')}`;
    
    const copyBtn = document.querySelector('.copy-btn');
    if(copyBtn) copyBtn.innerHTML = `<i class="far fa-copy"></i> ${t('copy_code', 'Sao chép')}`;
    
    const readyText = document.getElementById('readyText'); 
    if(readyText) readyText.innerText = t('waiting_host', 'Đang chờ chủ phòng...');
  }

  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('code');
  const gameId = urlParams.get('gameId');
  const gameName = urlParams.get('game');
  const usernameFromURL = urlParams.get('user');

  if (!roomCode || !gameId || !gameName || !usernameFromURL) {
    alert(t('missing_info', 'Thiếu thông tin phòng. Vui lòng kiểm tra lại!'));
    window.location.href = "index.html"; 
    return;
  }
  
  const playerName = usernameFromURL;
  loadLanguage(); 

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
    alert(message || t('room_error', "Không thể vào phòng này!"));
    window.location.href = "index.html";
  });

  let currentHost = null;

  function getAvatarUrl(name) {
    const safeName = name || 'guest';
    return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
  }

  socket.on("update-players", ({ list = [], host }) => {
    currentHost = host;
    const isHost = (playerName === host); 
    
    const listEl = document.getElementById("playerList");
    if (listEl) {
      if (!Array.isArray(list) || list.length === 0) {
        listEl.innerHTML = `<li style="text-align:center">${t('no_players', 'Chưa có người chơi nào.')}</li>`;
        return; 
      }
      
      const sortedList = list.sort((a, b) => {
          const nameA = a.name; 
          const nameB = b.name;
          return (nameA === host ? -1 : nameB === host ? 1 : 0);
      });
      
      listEl.innerHTML = sortedList.map(player => {
        const p_name = player.name;
        const p_displayName = player.players.find(p => p.name === username)?.displayName  ; 
        const isPlayerHost = (p_name === host);
        const avatarUrl = getAvatarUrl(p_name);

        const kickButton = (isHost && !isPlayerHost) 
          ? `<button class="kick-btn" onclick="window.kickPlayer('${p_name}')" title="${t('kick', 'Mời ra')}" style="margin-left: auto; color: #ff4757; background: none; border: 1px solid #ff4757; border-radius: 4px; padding: 2px 8px; cursor: pointer;">
               <i class="fas fa-times"></i> ${t('kick', 'Kick')}
             </button>`
          : "";

        const hostTag = isPlayerHost 
          ? `<span style="color:#ff9800; font-size: 0.9em; margin-left:4px;">(👑 ${t('host', 'Chủ phòng')})</span>` 
          : "";

        return `<li style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 8px 12px; border-bottom: 1px solid #eee;">
                  <img src="${avatarUrl}" alt="${p_name}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #eee; object-fit: cover;">
                  <span style="font-weight: 600; color: #333;">${p_displayName} ${hostTag}</span>
                  ${kickButton}
                </li>`;
      }).join("");
    }

    const startBtn = document.querySelector(".start-btn");
    if (startBtn) {
        startBtn.style.display = isHost ? "inline-block" : "none";
        startBtn.innerText = t('start_game', 'Bắt đầu');
    }
  });

  window.leaveRoom = function() {
    let msg = t('confirm_leave', "Bạn có chắc chắn muốn thoát khỏi phòng này?");
    
    if (playerName === currentHost) {
        msg = t('confirm_leave_host', "⚠️ BẠN ĐANG LÀ CHỦ PHÒNG!\n\nNếu bạn thoát, quyền chủ phòng sẽ được chuyển tự động.\n\nBạn có chắc chắn muốn thoát không?");
    }
    
    if (confirm(msg)) {
        socket.emit("leaveRoom", { code: roomCode, player: playerName });
        window.location.href = "index.html";
    }
  };

  window.addEventListener("beforeunload", () => {
    socket.emit("leaveRoom", { code: roomCode, player: playerName });
  });

  window.copyCode = function() {
    navigator.clipboard.writeText(roomCode).then(() => {
        alert(t('copied', "📋 Mã phòng đã được sao chép!"));
    }).catch(err => {});
  };

  window.startGame = function() {
    socket.emit('startGame', { code: roomCode });
  }

  window.kickPlayer = function(playerToKick) {
    if (confirm(t('confirm_kick', `Bạn có chắc muốn mời người chơi này ra khỏi phòng?`))) {
      socket.emit('kickPlayer', { code: roomCode, playerToKick: playerToKick });
    }
  }

  socket.on('kicked', ({ message }) => {
    alert(message || t('kicked_msg', 'Bạn đã bị chủ phòng mời ra khỏi phòng!'));
    window.location.href = 'index.html';
  });

  socket.on('game-started', (data) => {
    const params = new URLSearchParams({
      code: roomCode, gameId: gameId, game: gameName, user: playerName 
    }).toString();
    window.location.href = `game/${data.gameId}/index.html?${params}`;
  });

})();