// Minimal robust client script — safe DOM ops, responsive avatars, socket events.
(() => {
  function ensureJoin() {
    function getParam(name) {
      try {
        const u = new URL(window.location.href);
        return u.searchParams.get(name);
      } catch (e) { return null; }
    }
    const roomCode = getParam('code') || getParam('room') || '';
    const userParam = getParam('user') || `guest_${Math.random().toString(36).slice(2,6)}`;

    // reuse existing io() instance if present
    const socket = (window.socketIoInstance && window.socketIoInstance.socket) || (window.socket = window.io && io()) || (window.io && io());

    if (!socket) {
      console.warn('[ToD][client] socket.io not available');
      return;
    }

    socket.on('connect', () => {
      console.log('[ToD][client] socket connected', socket.id, { roomCode, userParam });
      // emit join so server adds this player to room.players (or at least responds with tod-joined)
      socket.emit('tod-join', { roomCode, player: userParam });
    });

    // show server response — useful to debug participantsCount 0
    socket.on('tod-joined', (payload) => {
      console.log('[ToD][client] evt tod-joined', payload);
      try {
        const countEl = document.getElementById('playersCount');
        const codeEl = document.getElementById('roomCode');
        if (payload && payload.data) {
          if (codeEl) codeEl.textContent = payload.data.roomCode || roomCode || '—';
          if (countEl) countEl.textContent = 'Người chơi: ' + (payload.data.participantsCount || (payload.data.participants && payload.data.participants.length) || 0);
          // optionally render avatars/names into #avatars
          const avatars = document.getElementById('avatars');
          if (avatars && Array.isArray(payload.data.participants)) {
            avatars.innerHTML = payload.data.participants.map(p => {
              const name = p.displayName || p.name || '';
              return `<div class="avatar-item" title="${name}">${(name[0]||'?').toUpperCase()}</div>`;
            }).join('');
          }
        }
      } catch (e) { /* ignore UI update error */ }
    });

    socket.on('connect_error', (err) => console.warn('[ToD][client] connect_error', err));
    socket.on('disconnect', (reason) => console.log('[ToD][client] disconnect', reason));
  }
  ensureJoin();

  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  const roomCode = params.get('code') || '';
  let playerName = params.get('user') || sessionStorage.getItem('playerName') || `guest_${Math.random().toString(36).slice(2,6)}`;

  const avatarParam = params.get('avatar');
  if (avatarParam) { try { sessionStorage.setItem('avatarUrl', avatarParam); } catch(e){} }
  let avatarUrl = sessionStorage.getItem('avatarUrl') || null;
  sessionStorage.setItem('playerName', playerName);

  const $room = document.getElementById('roomCode');
  const $playersCount = document.getElementById('playersCount');
  const $avatars = document.getElementById('avatars');

  // create settings button + modal
  

  const socket = io("https://datn-socket.up.railway.app", { transports: ['websocket'], secure: true });

  socket.on('connect', () => {
    console.log('socket connected', socket.id);
    socket.emit('tod-join', { roomCode, player: playerName });
    socket.emit('tod-who', { roomCode });
    setTimeout(()=> socket.emit('tod-who', { roomCode }), 200);
  });

  socket.on('tod-join-failed', ({ reason }) => {
    alert(reason || 'Không thể vào phòng');
    window.location.href = '/';
  });

  // helper: choose avatar for a player
  function pickAvatarFor(playerObj) {
    // playerObj may be string (name) or object { name, avatar }
    const name = typeof playerObj === 'string' ? playerObj : (playerObj && playerObj.name) ? playerObj.name : String(playerObj || '');
    const providedAvatar = (playerObj && playerObj.avatar) ? playerObj.avatar : null;

    if (providedAvatar) return providedAvatar;
    // if it's current user and we have avatarUrl in sessionStorage, use it (ensure user avatar shown)
    if (name === playerName && avatarUrl) return avatarUrl;
    // otherwise use dicebear seeded by name
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
  }

  function renderPlayers(players = [], askedName) {
    if ($playersCount) $playersCount.textContent = `Người chơi: ${players.length}`;
    if (!$avatars) return;
    $avatars.innerHTML = '';
    if (!players.length) return;
    const area = document.getElementById('camp');
    const w = area.clientWidth;
    const h = area.clientHeight;
    const cx = w / 2;
    const cy = h * 0.46;
    const R = Math.min(w, h) * 0.30;
    players.forEach((p, i) => {
      // allow p to be {name, avatar} or simple {name}
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

  socket.on('tod-joined', ({ players = [], host, lastQuestion=null, lastChoice=null }) => {
    // players may be array of {name} from server; client uses pickAvatarFor to show avatar
    renderPlayers(players, lastQuestion ? players[players.length-1] && players[players.length-1].name : null);
    if (host === playerName) {
      $actionBtns.innerHTML = `<button class="btn btn-primary" id="startRoundBtn">🚀 Bắt đầu</button>`;
      const start = document.getElementById('startRoundBtn');
      start && start.addEventListener('click', () => socket.emit('tod-start-round', { roomCode }));
    } else {
      $actionBtns.innerHTML = '';
    }
  });

  socket.on('tod-your-turn', ({ player }) => {
    $turnText.textContent = player === playerName ? '👉 Đến lượt bạn — chọn Sự thật hoặc Thử thách' : `⏳ ${player} đang chọn...`;
    if (player === playerName) {
      $actionBtns.innerHTML = '';
      const btnT = document.createElement('button'); btnT.className='btn btn-accept'; btnT.textContent='Sự thật'; btnT.onclick = () => socket.emit('tod-choice', { roomCode, player: playerName, choice: 'truth' });
      const btnD = document.createElement('button'); btnD.className='btn btn-reject'; btnD.textContent='Thử thách'; btnD.onclick = () => socket.emit('tod-choice', { roomCode, player: playerName, choice: 'dare' });
      $actionBtns.appendChild(btnT); $actionBtns.appendChild(btnD);
    }
  });

  // Question display: default = FULL (no 'collapsed'). Toggle adds collapsed -> moves to bottom-right and hides text.
  function toggleQuestionExpand() {
    if (!$question) return;
    $question.classList.toggle('collapsed');
    if (!$question.classList.contains('collapsed')) $question.focus();
  }

  // hook toggle button and keyboard
  const toggleBtn = document.getElementById('toggleQuestion');
  toggleBtn && toggleBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleQuestionExpand(); });

  // when server sends question, SHOW it full by default (remove collapsed)
  socket.on('tod-question', ({ player, choice, question }) => {
    if ($question) {
      $question.classList.remove('hidden');
      $question.classList.remove('collapsed'); // show full
      $question.classList.toggle('truth', choice === 'truth');
      $question.classList.toggle('dare', choice === 'dare');
      const qText = $question.querySelector('.q-text');
      if (qText) qText.textContent = `${player} chọn ${choice === 'truth' ? 'Sự thật' : 'Thử thách'}: ${question}`;
    }
    $turnText.textContent = `${player} đang thực hiện`;
    if (playerName === player) { $actionBtns.innerHTML = ''; }
    else {
      $actionBtns.innerHTML = `<button class="btn btn-accept" id="acceptBtn">Thông qua</button><button class="btn btn-reject" id="rejectBtn">Không thông qua</button>`;
      const a = document.getElementById('acceptBtn'), r = document.getElementById('rejectBtn');
      a && (a.onclick = () => { socket.emit('tod-vote', { roomCode, player: playerName, vote: 'accept' }); $actionBtns.innerHTML = ''; });
      r && (r.onclick = () => { socket.emit('tod-vote', { roomCode, player: playerName, vote: 'reject' }); $actionBtns.innerHTML = ''; });
    }
  });

  // keep collapsed state after reject? we let server send new question and client shows it full by default.
  socket.on('tod-result', ({ result }) => {
    if ($voteInfo) $voteInfo.style.display = 'none';
    $turnText.textContent = result === 'accepted' ? '✅ Đa số chấp nhận' : '❌ Không đủ, thử lại';
    if (result === 'accepted' && $question) $question.classList.add('hidden');
    // if rejected, new question will come from server and be shown full
  });

  socket.onAny((ev,p) => console.debug('evt',ev,p));

  window.addEventListener('resize', () => {
    socket.emit('tod-who', { roomCode });
  });

  // fallback cho ActionBtns nếu chưa có (ngăn ReferenceError)
  // Fallback global ActionBtns / $actionBtns để tránh ReferenceError nếu chưa được định nghĩa
  if (typeof window.ActionBtns === 'undefined') {
    window.ActionBtns = {
      disable(selector) {
        document.querySelectorAll(selector || '.action-btn').forEach(b => { try { b.disabled = true; } catch(e){/*ignore*/} });
      },
      enable(selector) {
        document.querySelectorAll(selector || '.action-btn').forEach(b => { try { b.disabled = false; } catch(e){/*ignore*/} });
      },
      setDisabled(disabled, selector) {
        return disabled ? this.disable(selector) : this.enable(selector);
      }
    };
  }
  // alias (nếu code khác dùng $actionBtns)
  if (typeof window.$actionBtns === 'undefined') window.$actionBtns = window.ActionBtns;
})();