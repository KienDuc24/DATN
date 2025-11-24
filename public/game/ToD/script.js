(() => {
  const SOCKET_URL = "https://datn-socket.up.railway.app";
  window.__SOCKET_URL__ = SOCKET_URL;
  window.socket = window.socket || (window.io && io(SOCKET_URL, { transports: ['websocket'], secure: true }));

  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  const roomCode = params.get('code') || '';
  let playerName = params.get('user'); 
  
  if (!playerName || !roomCode) {
    alert('Lỗi: Thiếu thông tin phòng.');
    window.location.href = '/'; 
    return; 
  }
  window.playerName = playerName;
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
  let roomPlayersList = [];

  socket.on('connect', () => {
    socket.emit('tod-join', { roomCode, player: playerName }); 
    socket.emit('tod-who', { roomCode });
  });

  socket.on('tod-join-failed', ({ reason }) => {
    alert(reason); window.location.href = '/';
  });
  socket.on('kicked', () => {
    alert('Bạn đã bị kick.'); window.location.href = '/';
  });

  function pickAvatarFor(playerObj = {}) {
    const fallbackName = playerObj.name || playerObj.username || 'guest';
    return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(fallbackName)}`;
  }

  function getDisplayName(username) {
      if (!username) return '';
      const p = roomPlayersList.find(p => p.name === username);
      return p ? (p.displayName || p.name) : username;
  }

  function renderPlayers(players = [], askedName, host) { 
    if ($playersCount) $playersCount.textContent = `${players.length}`;
    if (!$avatars) return;
    $avatars.innerHTML = ''; 
    
    const campfireEl = document.createElement('div');
    campfireEl.className = 'campfire';
    campfireEl.innerHTML = `<img src="/game/ToD/Img/campfire.gif" alt="Campfire" class="campfire-gif">`;
    $avatars.appendChild(campfireEl);
    
    if (!players.length) return;

    players.forEach((p) => {
      const username = p && p.name ? p.name : String(p); 
      const display = p && p.displayName ? p.displayName : username;
      const imgUrl = pickAvatarFor(p);
      
      const el = document.createElement('div');
      el.className = 'player' + (username === playerName ? ' you' : '') + (username === askedName ? ' asked' : '') + (username === host ? ' host' : ''); 
      
      const crown = (username === host) ? '<div class="crown">👑</div>' : '';
      
      el.innerHTML = `<div class="pic">${crown}<img src="${imgUrl}" alt="${username}"></div>
                      <div class="name-container">
                        <div class="name">${display}</div>
                      </div>`;
      $avatars.appendChild(el);
    });
  }

  socket.on('tod-joined', (payload) => {
    const rc = payload.roomCode || roomCode;
    const host = payload.host || '';
    const players = payload.players || []; 
    const participantsCount = players.length;
    const status = payload.status || 'open';
    
    roomPlayersList = players; 
    currentHost = host; 
    
    if ($room) $room.textContent = rc;
    if ($playersCount) $playersCount.textContent = participantsCount;

    renderPlayers(players, currentAskedPlayer, currentHost);

    if (controls) {
      let startBtn = document.getElementById('startRoundBtn');
      if (!startBtn) {
        startBtn = document.createElement('button');
        startBtn.id = 'startRoundBtn';
        startBtn.className = 'btn btn-primary';
        startBtn.textContent = '🚀 Bắt đầu';
        startBtn.style.margin = '0.5rem';
        startBtn.addEventListener('click', () => socket.emit('tod-start-round', { roomCode: rc }));
        controls.appendChild(startBtn);
      }
      const isHost = (host && playerName === host);
      const isGameNotRunning = !currentAskedPlayer; 
      startBtn.style.display = (isHost && isGameNotRunning && status !== 'closed') ? 'inline-block' : 'none';
    }
  });

  socket.on('tod-your-turn', ({ player }) => {
    currentAskedPlayer = player; 
    socket.emit('tod-who', { roomCode }); 
    
    const playerDisplay = getDisplayName(player);

    if ($turnText) $turnText.textContent = player === playerName ? '👉 Đến lượt bạn' : `⏳ ${playerDisplay} đang chọn...`;
    
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

  const toggleBtn = document.getElementById('toggleQuestion');
  toggleBtn && toggleBtn.addEventListener('click', (e)=>{ 
      const q = document.getElementById('questionCard');
      if(q) q.classList.toggle('collapsed'); 
  });

  socket.on('tod-question', ({ player, choice, question, totalVoters }) => {
    currentAskedPlayer = player; 
    socket.emit('tod-who', { roomCode }); 
    
    const playerDisplay = getDisplayName(player);

    if ($question) {
      $question.classList.remove('hidden');
      $question.classList.remove('collapsed');
      $question.className = `question-card ${choice}`;
      const qText = $question.querySelector('.q-text');
      if (qText) qText.textContent = `${playerDisplay} - ${choice}: ${question}`;
    }
    if ($turnText) $turnText.textContent = `${playerDisplay} đang thực hiện`;
    
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

  socket.on('tod-voted', ({ voted, total }) => {
      if ($voteCount) $voteCount.textContent = voted;
      if ($voteTotal) $voteTotal.textContent = total;
  });

  socket.on('tod-result', ({ result }) => {
    currentAskedPlayer = null; 
    socket.emit('tod-who', { roomCode }); 
    if ($voteInfo) $voteInfo.style.display = 'none';
    if ($turnText) $turnText.textContent = result === 'accepted' ? '✅ Chấp nhận' : '❌ Thất bại';
    if (result === 'accepted' && $question) $question.classList.add('hidden');
  });

  const backBtn = document.querySelector('.back-btn');
  if (backBtn) {
      backBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (confirm('Thoát phòng game?')) {
              socket.disconnect(); 
              window.location.href = '/'; 
          }
      });
  }
})();