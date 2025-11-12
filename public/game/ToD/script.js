// public/game/ToD/script.js
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
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
  }

  function renderPlayers(players = [], askedName) {
    if ($playersCount) $playersCount.textContent = `Người chơi: ${players.length}`;
    if (!$avatars) return;
    $avatars.innerHTML = '';
    if (!players.length) return;
    const area = document.getElementById('camp');
    const w = area ? area.clientWidth : 600;
    const h = area ? area.clientHeight : 400;
    const cx = w / 2;
    const cy = h * 0.46;
    const R = Math.min(w, h) * 0.30;
    players.forEach((p, i) => {
      const name = p && p.name ? p.name : String(p);
      const imgUrl = pickAvatarFor(p);
      const el = document.createElement('div');
      el.className = 'player' + (name === playerName ? ' you' : '') + (name === askedName ? ' asked' : '');
      const angle = (2 * Math.PI * i) / players.length - Math.PI / 2;
      const x = cx + R * Math.cos(angle);
      const y = cy + R * Math.sin(angle);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.innerHTML = `<div class="pic"><img src="${imgUrl}" alt="${name}"></div><div class="name">${name}</div>`;
      $avatars.appendChild(el);
    });
  }

  socket.on('tod-joined', (payload) => {
    console.log('[ToD][client] evt tod-joined', payload);

    const rc = (payload && (payload.roomCode || (payload.data && payload.data.roomCode))) || roomCode || '';
    const host = (payload && (payload.host || (payload.data && payload.data.host))) || '';
    const players = (payload && (payload.players || (payload.data && payload.data.participants))) || [];
    const participantsCount = payload && (payload.participantsCount || (payload.data && payload.data.participantsCount)) || players.length || 0;

    if ($room) $room.textContent = rc || '—';
    if ($playersCount) $playersCount.textContent = 'Người chơi: ' + participantsCount;

    renderPlayers(players);

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
    }
  });

  socket.on('tod-result', ({ result }) => {
    if ($voteInfo) $voteInfo.style.display = 'none';
    if ($turnText) $turnText.textContent = result === 'accepted' ? '✅ Đa số chấp nhận' : '❌ Không đủ, thử lại';
    if (result === 'accepted' && $question) $question.classList.add('hidden');
  });

  socket.onAny((ev,p) => console.debug('evt',ev,p));

  window.addEventListener('resize', () => {
    socket.emit('tod-who', { roomCode });
  });

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