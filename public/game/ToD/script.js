// publicscript.js
(() => {
  // --- 1. KẾT NỐI SOCKET VÀ LẤY THÔNG TIN ---
  const SOCKET_URL = "https://datn-socket.up.railway.app";
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

  // --- 2. XỬ LÝ SỰ KIỆN SOCKET (ĐÃ GOM LẠI) ---

  socket.on('connect', () => {
    console.log('[ToD][client] socket connected', socket.id, { roomCode, playerName });
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

  function pickAvatarFor(playerObj) {
    const name = typeof playerObj === 'string' ? playerObj : (playerObj && playerObj.name) ? playerObj.name : String(playerObj || '');
    const providedAvatar = (playerObj && playerObj.avatar) ? playerObj.avatar : null;
    if (providedAvatar) return providedAvatar;
    if (name === playerName && avatarUrl) return avatarUrl;
    return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(name)}`;
  }

  // --- HÀM RENDER ĐÃ SỬA LỖI ---
  function renderPlayers(players = [], askedName) {
    if ($playersCount) $playersCount.textContent = `${players.length}`;
    if (!$avatars) return;
    $avatars.innerHTML = ''; // Xóa avatar cũ
    
    // Thêm đống lửa vào trước
    const campfireEl = document.createElement('div');
    campfireEl.className = 'campfire';
    campfireEl.innerHTML = `<img src="Img/campfire.gif" alt="Campfire" class="campfire-gif">`;
    $avatars.appendChild(campfireEl);
    
    if (!players.length) return;

    // --- SỬA LỖI: Lấy kích thước từ $avatars (player-grid) ---
    const area = $avatars; 
    const w = area ? area.clientWidth : 500; 
    const h = area ? area.clientHeight : 350; 
    // --- HẾT SỬA ---

    const cx = w / 2; // Tâm X
    const cy = h / 2; // Tâm Y
    const R = Math.min(w, h) * 0.38; // Bán kính
    
    players.forEach((p, i) => {
      const name = p && p.name ? p.name : String(p);
      const imgUrl = pickAvatarFor(p);
      const el = document.createElement('div');
      
      el.className = 'player' + (name === playerName ? ' you' : '') + (name === askedName ? ' asked' : '');
      
      const angle = (2 * Math.PI * i) / players.length - (Math.PI / 2); 
      
      // SỬA: Tính toán X, Y và đã trừ đi 50% (transform)
      const x = cx + R * Math.cos(angle);
      const y = cy + R * Math.sin(angle);
      
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.innerHTML = `<div class="pic"><img src="${imgUrl}" alt="${name}"></div><div class="name">${name}</div>`;
      $avatars.appendChild(el);
    });
  }
  // --- HẾT HÀM RENDER ---

  socket.on('tod-joined', (payload) => {
    console.log('[ToD][client] evt tod-joined', payload);

    const rc = (payload && (payload.roomCode || (payload.data && payload.data.roomCode))) || roomCode || '';
    const host = (payload && (payload.host || (payload.data && payload.data.host))) || '';
    const players = (payload && (payload.players || (payload.data && payload.data.participants))) || [];
    const participantsCount = payload && (payload.participantsCount || (payload.data && payload.data.participantsCount)) || players.length || 0;

    if ($room) $room.textContent = rc || '—';
    if ($playersCount) $playersCount.textContent = participantsCount;

    renderPlayers(players, currentAskedPlayer); // Truyền người đang bị hỏi

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
      startBtn.style.display = (host && playerName && String(host) === String(playerName)) ? 'inline-block' : 'none';
    }
  });

  socket.on('tod-your-turn', ({ player }) => {
    currentAskedPlayer = player; 
    socket.emit('tod-who', { roomCode }); // Render lại
    
    if ($turnText) $turnText.textContent = player === playerName ? '👉 Đến lượt bạn — chọn Sự thật hoặc Thử thách' : `⏳ ${player} đang chọn...`;
    
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

  socket.on('tod-question', ({ player, choice, question }) => {
    currentAskedPlayer = player; 
    socket.emit('tod-who', { roomCode }); 

    if ($question) {
      $question.classList.remove('hidden');
      $question.classList.remove('collapsed');
      $question.classList.toggle('truth', choice === 'truth');
      $question.classList.toggle('dare', choice === 'dare');
      const qText = $question.querySelector('.q-text');
      if (qText) qText.textContent = `${player} chọn ${choice === 'truth' ? 'Sự thật' : 'Thử thách'}: ${question}`;
    }
    if ($turnText) $turnText.textContent = `${player} đang thực hiện`;
    
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
      if ($voteTotal) $voteTotal.textContent = '?'; 
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
    // Gọi lại 'tod-who' để render lại vị trí avatar
    socket.emit('tod-who', { roomCode }); 
  });

  // --- THÊM MỚI: Xử lý rời phòng khi đóng tab/back ---
  window.addEventListener('beforeunload', () => {
    // socket.disconnect() sẽ kích hoạt sự kiện 'disconnecting' trên server
    socket.disconnect();
    console.log('[ToD][client] Disconnecting (beforeunload)');
  });
  
  // (Gán sự kiện cho nút "Quay lại trang chủ")
  const backBtn = document.querySelector('.back-btn');
  if (backBtn) {
      backBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (confirm('Bạn có chắc muốn rời khỏi phòng game?')) {
              socket.disconnect(); // Kích hoạt 'disconnecting'
              window.location.href = '/'; // Quay về trang chủ
          }
      });
  }
  // --- HẾT THÊM MỚI ---

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