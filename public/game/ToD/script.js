// Minimal robust client script — safe DOM ops, responsive avatars, socket events.
(() => {
  // create single socket instance (reuse everywhere)
  const SOCKET_URL = "https://datn-socket.up.railway.app";
  window.socket = window.socket || (window.io && io(SOCKET_URL, { transports: ['websocket'], secure: true }));

  function ensureJoin() {
    function getParam(name) {
      try {
        const u = new URL(window.location.href);
        return u.searchParams.get(name);
      } catch (e) { return null; }
    }
    const roomCode = getParam('code') || getParam('room') || '';
    const userParam = getParam('user') || `guest_${Math.random().toString(36).slice(2,6)}`;

    // reuse single global socket instance
    const socket = window.socket;

    if (!socket) {
      console.warn('[ToD][client] socket.io not available');
      return;
    }

    socket.on('connect', () => {
      console.log('[ToD][client] socket connected', socket.id, { roomCode, userParam });
      // emit join so server adds this player to room.players (or at least responds with tod-joined)
      socket.emit('tod-join', { roomCode, player: userParam });
    });

    socket.on('connect_error', (err) => console.warn('[ToD][client] connect_error', err));
    socket.on('disconnect', (reason) => console.log('[ToD][client] disconnect', reason));
  }
  ensureJoin();

  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  const roomCode = params.get('code') || '';

// Prefer URL param → localStorage → sessionStorage → guest
  let playerName = params.get('user') || localStorage.getItem('playerName') || sessionStorage.getItem('playerName') || `guest_${Math.random().toString(36).slice(2,6)}`;

// expose and persist to localStorage
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

  // ensure controls + action btns + turnText exist
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

  // use the same socket instance created above
  const socket = window.socket;

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

  // single normalized handler for tod-joined
  socket.on('tod-joined', (payload) => {
    console.log('[ToD][client] evt tod-joined', payload);

    // support both shapes (new: payload.roomCode / payload.players; old: payload.data.*)
    const rc = (payload && (payload.roomCode || (payload.data && payload.data.roomCode))) || roomCode || '';
    const host = (payload && (payload.host || (payload.data && payload.data.host))) || '';
    const players = (payload && (payload.players || (payload.data && payload.data.participants))) || [];
    const participantsCount = payload && (payload.participantsCount || (payload.data && payload.data.participantsCount)) || players.length || 0;

    if ($room) $room.textContent = rc || '—';
    if ($playersCount) $playersCount.textContent = 'Người chơi: ' + participantsCount;

    renderPlayers(players);

    // start button only visible for host
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
          // hide immediately after clicking to avoid duplicate clicks
          startBtn.style.display = 'none';
        });
        controls.appendChild(startBtn);
      }
      startBtn.style.display = (host && playerName && String(host) === String(playerName)) ? 'inline-block' : 'none';
    }
  });

  socket.on('tod-your-turn', ({ player }) => {
    // hide start button when round actually starts
    const startBtn = document.getElementById('startRoundBtn');
    if (startBtn) startBtn.style.display = 'none';
    if ($turnText) $turnText.textContent = player === playerName ? '👉 Đến lượt bạn — chọn Sự thật hoặc Thử thách' : `⏳ ${player} đang chọn...`;
    if (player === playerName) {
      if ($actionBtns) $actionBtns.innerHTML = '';
      const btnT = document.createElement('button'); btnT.className='btn btn-accept'; btnT.textContent='Sự thật'; btnT.onclick = () => socket.emit('tod-choice', { roomCode, player: playerName, choice: 'truth' });
      const btnD = document.createElement('button'); btnD.className='btn btn-reject'; btnD.textContent='Thử thách'; btnD.onclick = () => socket.emit('tod-choice', { roomCode, player: playerName, choice: 'dare' });
      $actionBtns && $actionBtns.appendChild(btnT) && $actionBtns.appendChild(btnD);
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
    if (player === playerName) {
      // show answer input for yourself
      const input = document.getElementById('answerInput');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  });

  socket.on('tod-choice', ({ player, choice, roomCode }) => {
    console.log('[ToD][client] evt tod-choice', { player, choice, roomCode });
    if ($turnText) $turnText.textContent = `${player} đã chọn ${choice === 'truth' ? 'Sự thật' : 'Thử thách'}`;
    if (choice === 'truth') {
      // show truth prompt
      const input = document.getElementById('answerInput');
      if (input) {
        input.value = '';
        input.focus();
      }
    } else {
      // clear answer input on dare
      const input = document.getElementById('answerInput');
      if (input) input.value = '';
    }
  });

  socket.on('tod-start-round', ({ player }) => {
    console.log('[ToD][client] evt tod-start-round', { player });
    if ($turnText) $turnText.textContent = `Vòng mới bắt đầu!`;
    // remove any existing question
    if ($question) {
      $question.classList.add('hidden');
      $question.classList.remove('collapsed');
    }
    // clear answer input
    const input = document.getElementById('answerInput');
    if (input) input.value = '';
  });

  // debug: show raw socket events
  const rawLog = document.getElementById('rawLog');
  socket.on('connect', () => { socket.emit('tod-who', { roomCode }); });
  socket.on('disconnect', () => { /* ignore */ });
  socket.on('error', (e) => { console.error('[ToD][client] socket error', e); });
  socket.onAny((event, ...args) => {
    if (event.startsWith('tod-')) {
      const json = JSON.stringify(args, null, 2);
      console.log(`[ToD][client] evt ${event}`, args);
      if (rawLog) {
        const pre = document.createElement('pre');
        pre.className = 'm-0';
        pre.textContent = `[ToD] ${event}: ${json}`;
        rawLog.appendChild(pre);
        rawLog.scrollTop = rawLog.scrollHeight;
      }
    }
  });
})();