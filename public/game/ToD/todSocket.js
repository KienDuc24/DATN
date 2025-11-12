// public/game/ToD/script.js (ĐÃ SỬA LỖI)
(() => {
  // --- 1. KẾT NỐI SOCKET VÀ LẤY THÔNG TIN ---
  const SOCKET_URL = "https://datn-socket.up.railway.app";
  window.socket = window.socket || (window.io && io(SOCKET_URL, { transports: ['websocket'], secure: true }));

  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  const roomCode = params.get('code') || '';

  // --- SỬA LỖI: Lấy tên người dùng CHÍNH XÁC từ URL ---
  // (Không tạo tên ngẫu nhiên nữa)
  let playerName = params.get('user');
  
  if (!playerName) {
    // Nếu không có tên user từ URL, đây là lỗi, quay về trang chủ
    alert('Lỗi: Không tìm thấy tên người dùng. Vui lòng thử lại.');
    window.location.href = '/'; // Quay về trang chủ
    return; // Dừng chạy code
  }
  // --- HẾT SỬA LỖI ---

  // Lưu lại tên
  window.playerName = playerName;
  try { localStorage.setItem('playerName', playerName); } catch (e) { /* ignore */ }

  // Lấy các element DOM
  const $room = document.getElementById('roomCode');
  const $playersCount = document.getElementById('playersCount');
  const $avatars = document.getElementById('avatars');
  const $question = document.getElementById('questionCard');
  const $voteInfo = document.getElementById('voteInfo');
  const controls = document.getElementById('controls');
  const $actionBtns = document.getElementById('actionBtns');
  const $turnText = document.getElementById('turnText');
  
  // Dùng socket instance đã tạo
  const socket = window.socket;

  // --- 2. XỬ LÝ SỰ KIỆN SOCKET ---

  socket.on('connect', () => {
    console.log('[ToD][client] socket connected', socket.id, { roomCode, playerName });
    // Gửi sự kiện join VỚI TÊN ĐÚNG
    socket.emit('tod-join', { roomCode, player: playerName });
    // Yêu cầu thông tin phòng
    socket.emit('tod-who', { roomCode });
  });

  socket.on('connect_error', (err) => console.warn('[ToD][client] connect_error', err));
  socket.on('disconnect', (reason) => console.log('[ToD][client] disconnect', reason));

  socket.on('tod-join-failed', ({ reason }) => {
    alert(reason || 'Không thể vào phòng');
    window.location.href = '/';
  });

  // (Hàm helper) Lấy avatar
  function pickAvatarFor(playerObj) {
    const name = typeof playerObj === 'string' ? playerObj : (playerObj && playerObj.name) ? playerObj.name : String(playerObj || '');
    const providedAvatar = (playerObj && playerObj.avatar) ? playerObj.avatar : null;
    if (providedAvatar) return providedAvatar;
    let avatarUrl = localStorage.getItem('avatarUrl') || null;
    if (name === playerName && avatarUrl) return avatarUrl;
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
  }

  // (Hàm helper) Vẽ người chơi
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

  // Cập nhật giao diện khi nhận 'tod-joined'
  socket.on('tod-joined', (payload) => {
    console.log('[ToD][client] evt tod-joined', payload);

    const rc = payload.roomCode || roomCode;
    const host = payload.host || '';
    const players = payload.players || [];
    const participantsCount = payload.participantsCount || players.length;

    if ($room) $room.textContent = rc || '—';
    if ($playersCount) $playersCount.textContent = 'Người chơi: ' + participantsCount;

    renderPlayers(players);

    // Hiển thị nút "Bắt đầu" (chỉ cho host)
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

  // Xử lý lượt chơi
  socket.on('tod-your-turn', ({ player }) => {
    if ($turnText) $turnText.textContent = player === playerName ? '👉 Đến lượt bạn — chọn Sự thật hoặc Thách thức' : `⏳ ${player} đang chọn...`;
    
    // Xóa nút "Bắt đầu"
    const startBtn = document.getElementById('startRoundBtn');
    if (startBtn) startBtn.style.display = 'none';

    if (player === playerName) {
      if ($actionBtns) $actionBtns.innerHTML = '';
      const btnT = document.createElement('button'); btnT.className='btn btn-accept'; btnT.textContent='Sự thật'; btnT.onclick = () => socket.emit('tod-choice', { roomCode, player: playerName, choice: 'truth' });
      const btnD = document.createElement('button'); btnD.className='btn btn-reject'; btnD.textContent='Thử thách'; btnD.onclick = () => socket.emit('tod-choice', { roomCode, player: playerName, choice: 'dare' });
      $actionBtns && $actionBtns.appendChild(btnT) && $actionBtns.appendChild(btnD);
    }
  });

  // (Hàm helper) Thu/phóng thẻ câu hỏi
  function toggleQuestionExpand() {
    if (!$question) return;
    $question.classList.toggle('collapsed');
    if (!$question.classList.contains('collapsed')) $question.focus();
  }
  const toggleBtn = document.getElementById('toggleQuestion');
  toggleBtn && toggleBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleQuestionExpand(); });

  // Hiển thị câu hỏi
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

  // Hiển thị kết quả vote
  socket.on('tod-result', ({ result }) => {
    if ($voteInfo) $voteInfo.style.display = 'none';
    if ($turnText) $turnText.textContent = result === 'accepted' ? '✅ Đa số chấp nhận' : '❌ Không đủ, thử lại';
    if (result === 'accepted' && $question) $question.classList.add('hidden');
  });

  socket.onAny((ev,p) => console.debug('evt',ev,p));

  window.addEventListener('resize', () => {
    socket.emit('tod-who', { roomCode });
  });

})();