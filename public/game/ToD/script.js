// public/game/ToD/script.js (Đã XÓA logic chatbot AI)
(() => {
  // --- 1. KẾT NỐI SOCKET VÀ LẤY THÔNG TIN ---
  const SOCKET_URL = "https://datn-socket.up.railway.app";
  // XÓA: window.__chatbot_API_BASE__
  window.__SOCKET_URL__ = SOCKET_URL;
  window.socket = window.socket || (window.io && io(SOCKET_URL, { transports: ['websocket'], secure: true }));

  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  const roomCode = params.get('code') || '';

  let playerName = params.get('user'); 
  
  if (!playerName || !roomCode) {
    alert('Lỗi: Thiếu thông tin phòng hoặc người dùng. Đang quay về trang chủ.');
    window.location.href = '/'; 
    return; 
  }

  window.playerName = playerName;
  try { localStorage.setItem('playerName', playerName); } catch (e) { /* ignore */ }

  const avatarParam = params.get('avatar');
  if (avatarParam) { try { localStorage.setItem('avatarUrl', avatarParam); } catch (e) { /* ignore */ } }
  let avatarUrl = localStorage.getItem('avatarUrl') || sessionStorage.getItem('avatarUrl') || null;
  sessionStorage.setItem('playerName', playerName);

  const $room = document.getElementById('roomCode');
  const $playersCount = document.getElementById('playersCount');
  const $avatars = document.getElementById('avatars');
  const $question = document.getElementById('questionCard');
  
  const $voteInfo = document.getElementById('voteInfo');
  const $voteCount = document.getElementById('voteCount');
  const $voteTotal = document.getElementById('voteTotal');
  
  const controls = document.getElementById('controls');
  let $actionBtns = document.getElementById('actionBtns');
  if (! $actionBtns && controls) {
    $actionBtns = document.createElement('div');
    $actionBtns.id = 'actionBtns';
    $actionBtns.className = 'action-btns';
    controls.appendChild($actionBtns);
  }
  let $turnText = document.getElementById('turnText');
  if (! $turnText && controls) {
    $turnText = document.createElement('div');
    $turnText.id = 'turnText';
    $turnText.className = 'turn-text';
    controls.insertBefore($turnText, $actionBtns || null);
  }
  
  const socket = window.socket;
  let currentAskedPlayer = null; 
  let currentHost = null;

  // --- 2. XỬ LÝ SỰ KIỆN SOCKET (GIỮ NGUYÊN LOGIC GAME) ---

  socket.on('connect', () => {
    console.log('[ToD][client] socket connected', socket.id, { roomCode, playerName });
    // Vì server-side todSocket.js dùng normalizePlayerInput, ta có thể gửi thẳng playerName
    socket.emit('tod-join', { roomCode, player: playerName }); 
    socket.emit('tod-who', { roomCode });
    setTimeout(()=> socket.emit('tod-who', { roomCode }), 200); 
  });

  socket.on('connect_error', (err) => console.warn('[ToD][client] connect_error', err));
  socket.on('disconnect', (reason) => console.log('[ToD][client] disconnect', reason));

  socket.on('tod-join-failed', ({ reason }) => {
    alert(reason || 'Không thể vào phòng');
    window.location.href = '/';
  });

  socket.on('kicked', (data) => {
    alert(data.message || 'Bạn đã bị Admin kick khỏi phòng.');
    window.location.href = '/';
  });

  function pickAvatarFor(playerObj = {}) {
    const avatarUrl = playerObj.avatar || playerObj.avatarUrl;
    if (avatarUrl) return avatarUrl;

    const fallbackName = playerObj.name || playerObj.username || 'guest';
    return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(fallbackName)}`;
  }

  // --- Hàm Render Player (ĐÃ SỬA ĐỂ DÙNG DISPLAY NAME) ---
  function renderPlayers(players = [], askedName, host) { 
    if ($playersCount) $playersCount.textContent = `${players.length}`;
    if (!$avatars) return;
    $avatars.innerHTML = ''; 
    
    // Thêm đống lửa
    const campfireEl = document.createElement('div');
    campfireEl.className = 'campfire';
    campfireEl.innerHTML = `<img src="/game/ToD/Img/campfire.gif" alt="Campfire" class="campfire-gif">`;
    $avatars.appendChild(campfireEl);
    
    if (!players.length) return;

    players.forEach((p, i) => {
      // Lấy username (ID) cho logic so sánh
      const username = p && p.name ? p.name : String(p); 
      
      // Lấy tên hiển thị
      const display = p && p.displayName ? p.displayName : username;
      
      const imgUrl = pickAvatarFor(p);
      const el = document.createElement('div');
      
      el.className = 'player' + 
                    (username === playerName ? ' you' : '') + // So sánh bằng username
                    (username === askedName ? ' asked' : '') +
                    (username === host ? ' host' : ''); // So sánh bằng username
      
      const crown = (username === host) ? '<div class="crown">👑</div>' : '';
      
      // SỬA: Hiển thị Display Name
      el.innerHTML = `<div class="pic">${crown}<img src="${imgUrl}" alt="${username}"></div><div class="name">${display}</div>`;
      $avatars.appendChild(el);
    });
  }
  // --- HẾT HÀM RENDER ---

  socket.on('tod-joined', (payload) => {
    console.log('[ToD][client] evt tod-joined', payload);

    const rc = (payload && (payload.roomCode || (payload.data && payload.data.roomCode))) || roomCode || '';
    const host = (payload && (payload.host || (payload.data && payload.data.host))) || '';
    // Lấy player list, đảm bảo nó là mảng object
    const players = (payload && (payload.players || (payload.data && payload.data.participants))) || []; 
    const participantsCount = payload && (payload.participantsCount || (payload.data && payload.data.participantsCount)) || players.length || 0;
    const status = (payload && payload.status) || 'open';
    
    currentHost = host; 

    if ($room) $room.textContent = rc || '—';
    if ($playersCount) $playersCount.textContent = participantsCount;

    // SỬ DỤNG MẢNG OBJECT PLAYER
    renderPlayers(players, currentAskedPlayer, currentHost);

    if (controls) {
      let startBtn = document.getElementById('startRoundBtn');
      if (!startBtn) {
        startBtn = document.createElement('button');
        startBtn.id = 'startRoundBtn';
        startBtn.className = 'btn btn-primary';
        startBtn.textContent = '🚀 Bắt đầu';
        startBtn.style.margin = '0.5rem';
        startBtn.addEventListener('click', () => {
          console.log('[ToD][client] start clicked by', playerName);
          socket.emit('tod-start-round', { roomCode: rc });
        });
        controls.appendChild(startBtn);
      }
      
      const isHost = (host && playerName === host);
      const isGameNotRunning = !currentAskedPlayer; // Nếu chưa có người được gán lượt chơi (lượt đầu)
      
      startBtn.style.display = (isHost && isGameNotRunning && status !== 'closed') ? 'inline-block' : 'none';
    }
  });

  socket.on('tod-your-turn', ({ player }) => {
    currentAskedPlayer = player; 
    socket.emit('tod-who', { roomCode }); // Render lại (để highlight)
    
    // Lấy displayName cho $turnText (cần thêm logic tìm kiếm)
    const turnDisplay = (payload.players || []).find(p => p.name === player)?.displayName || player;
    if ($turnText) $turnText.textContent = player === playerName ? '👉 Đến lượt bạn — chọn Sự thật hoặc Thử thách' : `⏳ ${turnDisplay} đang chọn...`;
    
    // Ẩn nút "Bắt đầu" ngay khi lượt chơi đầu tiên bắt đầu
    const startBtn = document.getElementById('startRoundBtn');
    if (startBtn) startBtn.style.display = 'none'; 

    if (player === playerName) {
      if ($actionBtns) $actionBtns.innerHTML = '';
      const btnT = document.createElement('button'); btnT.className='btn btn-accept'; btnT.textContent='Sự thật'; btnT.onclick = () => socket.emit('tod-choice', { roomCode, player: playerName, choice: 'truth' });
      const btnD = document.createElement('button'); btnD.className='btn btn-reject'; btnD.textContent='Thử thách'; btnD.onclick = () => socket.emit('tod-choice', { roomCode, player: playerName, choice: 'dare' });
      $actionBtns && $actionBtns.appendChild(btnT) && $actionBtns.appendChild(btnD);
    } else {
        if ($actionBtns) $actionBtns.innerHTML = '';
    }
  });

  function toggleQuestionExpand() {
    if (!$question) return;
    $question.classList.toggle('collapsed');
    if (!$question.classList.contains('collapsed')) $question.focus();
  }
  const toggleBtn = document.getElementById('toggleQuestion');
  toggleBtn && toggleBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleQuestionExpand(); });

  socket.on('tod-question', ({ player, choice, question, totalVoters }) => {
    currentAskedPlayer = player; 
    socket.emit('tod-who', { roomCode }); // Render lại (để highlight)
    
    // Lấy displayName cho câu hỏi
    const askedDisplay = (payload.players || []).find(p => p.name === player)?.displayName || player;

    if ($question) {
      $question.classList.remove('hidden');
      $question.classList.remove('collapsed');
      $question.classList.toggle('truth', choice === 'truth');
      $question.classList.toggle('dare', choice === 'dare');
      const qText = $question.querySelector('.q-text');
      if (qText) qText.textContent = `${askedDisplay} chọn ${choice === 'truth' ? 'Sự thật' : 'Thử thách'}: ${question}`;
    }
    if ($turnText) $turnText.textContent = `${askedDisplay} đang thực hiện`;
    
    if (playerName === player) { 
      $actionBtns && ($actionBtns.innerHTML = ''); 
    } else {
      if ($actionBtns) {
        $actionBtns.innerHTML = '';
        const a = document.createElement('button'); a.className='btn btn-accept'; a.textContent='Thông qua'; a.onclick = () => { socket.emit('tod-vote', { roomCode, player: playerName, vote: 'accept' }); $actionBtns.innerHTML = ''; };
        const r = document.createElement('button'); r.className='btn btn-reject'; r.textContent='Không thông qua'; r.onclick = () => { socket.emit('tod-vote', { roomCode, player: playerName, vote: 'reject' }); $actionBtns.innerHTML = ''; };
        $actionBtns.appendChild(a); $actionBtns.appendChild(r);
      }
      
      if ($voteInfo) $voteInfo.style.display = 'block';
      if ($voteCount) $voteCount.textContent = '0';
      if ($voteTotal) $voteTotal.textContent = totalVoters || '?'; 
    }
  });

  socket.on('tod-voted', ({ player, vote, acceptCount, voted, total }) => {
      console.log(`Vote received: ${player} voted ${vote}. Total: ${voted}/${total}`);
      if ($voteInfo && $voteInfo.style.display !== 'none') {
        if ($voteCount) $voteCount.textContent = voted;
        if ($voteTotal) $voteTotal.textContent = total;
      }
  });

  socket.on('tod-result', ({ result }) => {
    currentAskedPlayer = null; 
    socket.emit('tod-who', { roomCode }); 
    
    if ($voteInfo) $voteInfo.style.display = 'none';
    if ($turnText) $turnText.textContent = result === 'accepted' ? '✅ Đa số chấp nhận' : '❌ Không đủ, thử lại';
    if (result === 'accepted' && $question) $question.classList.add('hidden');
  });

  socket.onAny((ev,p) => console.debug('evt',ev,p));

  window.addEventListener('resize', () => {
    socket.emit('tod-who', { roomCode }); 
  });

  window.addEventListener('beforeunload', () => {
    socket.disconnect();
    console.log('[ToD][client] Disconnecting (beforeunload)');
  });
  
  const backBtn = document.querySelector('.back-btn');
  if (backBtn) {
      backBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (confirm('Bạn có chắc muốn rời khỏi phòng game?')) {
              socket.disconnect(); 
              window.location.href = '/'; 
          }
      });
  }

  if (typeof window.ActionBtns === 'undefined') {
    window.ActionBtns = {
      disable(selector) {
        document.querySelectorAll(selector || '.action-btn').forEach(b => { try { b.disabled = true; } catch(e){} });
      },
      enable(selector) {
        document.querySelectorAll(selector || '.action-btn').forEach(b => { try { b.disabled = false; } catch(e){} });
      },
      setDisabled(disabled, selector) {
        return disabled ? this.disable(selector) : this.enable(selector);
      }
    };
  }
  if (typeof window.$actionBtns === 'undefined') window.$actionBtns = window.ActionBtns;
})();