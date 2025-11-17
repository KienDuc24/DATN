// public/admin.js (ĐÃ SỬA LỖI API + THÊM CỘT)

(async () => {
  const ADMIN_API = 'https://datn-socket.up.railway.app';
  let allGamesCache = [];
  let allUsersCache = [];
  let allRooms = [];
  let pendingGameChanges = { new: [], updated: {}, deleted: [] };
  let pendingUserChanges = { new: [], updated: {}, deleted: [] };

  // --- SỬA LỖI: Chuẩn hóa API Endpoints (Thêm 's') ---
  const API_ENDPOINTS = {
    USERS: `${ADMIN_API}/api/admin/users`,
    USER_ID: (id) => `${ADMIN_API}/api/admin/users/${id}`,
    GAMES: `${ADMIN_API}/api/admin/games`,
    GAME_ID: (id) => `${ADMIN_API}/api/admin/games/${id}`,
    GAME_SYNC: `${ADMIN_API}/api/admin/games/sync`,
    ROOMS: `${ADMIN_API}/api/admin/rooms`,
    ROOM_ID: (id) => `${ADMIN_API}/api/admin/rooms/${id}`
  };
  // --- KẾT THÚC SỬA ---

  const token = localStorage.getItem('adminToken');
  if (!token) {
    if (window.location.pathname !== '/admin-login.html') {
      window.location.href = '/admin-login.html';
    }
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchData = async (endpoint) => {
    try {
      const res = await fetch(endpoint, { headers, credentials: 'include' }); // Thêm credentials
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin-login.html';
      }
      if (!res.ok) throw new Error(`Fetch failed ${endpoint} with status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const sendData = async (endpoint, method, body) => {
    try {
      const res = await fetch(endpoint, { method, headers, body: JSON.stringify(body), credentials: 'include' }); // Thêm credentials
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin-login.html';
      }
      return res;
    } catch (err) {
      console.error('Send data error:', err);
    }
  };

  // --- Render User (ĐÃ CẬP NHẬT) ---
  const renderUser = (user) => {
    const tpl = document.getElementById('user-item-template').content.cloneNode(true);
    const row = tpl.querySelector('tr');
    row.dataset.id = user._id; // Dùng _id của Mongoose

    tpl.querySelector('.user-username').textContent = user.username;
    
    // THÊM MỚI: Tên hiển thị
    tpl.querySelector('.user-displayName').textContent = user.displayName || 'N/A';
    
    tpl.querySelector('.user-email').textContent = user.email || 'N/A';
    
    // THÊM MỚI: Lịch sử chơi
    const historyCell = tpl.querySelector('.user-history');
    if (user.playHistory && user.playHistory.length > 0) {
      const recentGames = user.playHistory.slice(-3).reverse(); // Lấy 3 game gần nhất
      historyCell.innerHTML = recentGames.map(game => 
        `<div style="white-space: normal;"><small>${game.gameName || game.gameId} (lúc: ${new Date(game.playedAt).toLocaleString()})</small></div>`
      ).join('');
    } else {
      historyCell.textContent = 'Chưa chơi game nào';
    }

    // Cập nhật Trạng thái
    let statusText = 'Offline';
    let statusColor = '#ef4444';
    if (user.status === 'online') {
        statusText = 'Online';
        statusColor = '#22c55e';
    } else if (user.status === 'playing') {
        statusText = 'Playing';
        statusColor = '#ff9f43';
    }
    const statusEl = tpl.querySelector('.user-status');
    statusEl.textContent = statusText;
    statusEl.style.color = statusColor;
    statusEl.style.fontWeight = '600';

    tpl.querySelector('.btn-edit').onclick = () => showUserModal(user);
    tpl.querySelector('.btn-delete-user').onclick = () => onDeleteUser(user._id);
    return tpl;
  };

  // --- Render Game (Không đổi) ---
  const renderGame = (game) => {
    const tpl = document.getElementById('game-item-template').content.cloneNode(true);
    const row = tpl.querySelector('tr');
    row.dataset.id = game.id; // Dùng ID nghiệp vụ (string)
    if (game._id) row.dataset.dbId = game._id;
    
    const title = (game.name && (game.name.vi || game.name.en)) ? (game.name.vi || game.name.en) : (game.title || game.name || '');
    const desc = (game.desc && (game.desc.vi || g.desc.en)) ? (game.desc.vi || game.desc.en) : (game.desc || '');
    const category = (game.category && (game.category.vi || g.category.en)) ? (game.category.vi || game.category.en) : (game.category || '');

    tpl.querySelector('.game-name').textContent = title;
    tpl.querySelector('.game-desc').textContent = desc.slice(0, 120) + '...';
    tpl.querySelector('.game-category').textContent = category;
    tpl.querySelector('.game-players').textContent = game.players;
    
    const featureCheck = tpl.querySelector('.game-feature');
    featureCheck.checked = game.featured || false;
    featureCheck.onchange = () => onFeatureGame(game.id, featureCheck.checked);
    
    tpl.querySelector('.btn-edit-game').onclick = () => onEditGame(game.id);
    tpl.querySelector('.btn-delete-game').onclick = () => onDeleteGame(game.id);
    return tpl;
  };

  // --- Render Room (Không đổi) ---
  const renderRoom = (room) => {
    const tpl = document.getElementById('room-item-template').content.cloneNode(true);
    tpl.querySelector('.room-code').textContent = room.code;
    tpl.querySelector('.room-game').textContent = room.game?.gameId || 'N/A';
    tpl.querySelector('.room-host').textContent = room.host;
    tpl.querySelector('.room-players').textContent = room.players?.length || 0;
    
    let status = room.status || 'open';
    if (status === 'open') status = 'Đang chờ';
    if (status === 'playing') status = 'Đang chơi';
    if (status === 'closed') status = 'Đã đóng';
    tpl.querySelector('.room-status').textContent = status;
    
    tpl.querySelector('.btn-delete-room').onclick = () => onDeleteRoom(room.code);
    return tpl;
  };

  // --- Load Data (Không đổi) ---
  const loadData = async () => {
    const [usersData, gamesData, roomsData] = await Promise.all([
      fetchData(API_ENDPOINTS.USERS),
      fetchData(API_ENDPOINTS.GAMES),
      fetchData(API_ENDPOINTS.ROOMS)
    ]);
    allUsersCache = usersData?.users || [];
    allGamesCache = gamesData?.games || [];
    allRooms = roomsData?.rooms || [];
    
    const userTbody = document.getElementById('user-table-body');
    const gameTbody = document.getElementById('game-table-body');
    const roomTbody = document.getElementById('room-table-body');
    
    if(userTbody) userTbody.innerHTML = '';
    if(gameTbody) gameTbody.innerHTML = '';
    if(roomTbody) roomTbody.innerHTML = '';
    
    allUsersCache.forEach(u => userTbody.appendChild(renderUser(u)));
    allGamesCache.forEach(g => gameTbody.appendChild(renderGame(g)));
    allRooms.forEach(r => roomTbody.appendChild(renderRoom(r)));
  };

  // --- User Actions (ĐÃ CẬP NHẬT) ---
  const showUserModal = (user = {}) => {
    document.getElementById('user-modal-title').textContent = user._id ? 'Sửa người dùng' : 'Thêm người dùng';
    document.getElementById('user-id').value = user._id || '';
    document.getElementById('user-username').value = user.username || '';
    document.getElementById('user-displayName').value = user.displayName || ''; // THÊM MỚI
    document.getElementById('user-email').value = user.email || '';
    document.getElementById('user-role').value = user.role || 'user'; // Sửa: Thêm role
    document.getElementById('user-modal').style.display = 'block';
    showOverlay(true);
  };
  
  const closeUserModal = () => {
    document.getElementById('user-modal').style.display = 'none';
    showOverlay(false);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const body = {
      username: document.getElementById('user-username').value,
      displayName: document.getElementById('user-displayName').value, // THÊM MỚI
      email: document.getElementById('user-email').value,
      role: document.getElementById('user-role').value
    };
    
    const endpoint = id ? API_ENDPOINTS.USER_ID(id) : API_ENDPOINTS.USERS;
    const method = id ? 'PUT' : 'POST';
    
    const res = await sendData(endpoint, method, body);
    if (res.ok) {
      closeUserModal();
      await loadData();
    } else {
      alert('Lỗi lưu User: ' + await res.text());
    }
  };
  
  const onDeleteUser = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa người dùng này?')) return;
    const res = await sendData(API_ENDPOINTS.USER_ID(id), 'DELETE');
    if (res.ok) await loadData();
    else alert('Lỗi xóa User');
  };

  // --- Game Actions (SỬA LỖI MẤT DỮ LIỆU) ---
  const onEditGame = (gameId) => {
    const game = allGamesCache.find(g => g.id === gameId);
    if (!game) return alert('Không tìm thấy game trong cache');
    showGameModal(game);
  };

  const showGameModal = (game = {}) => {
    document.getElementById('game-modal-title').textContent = game.id ? 'Sửa trò chơi' : 'Thêm trò chơi';
    document.getElementById('game-id-orig').value = game.id || ''; // Lưu ID gốc
    document.getElementById('game-id').value = game.id || '';
    document.getElementById('game-id').disabled = !!game.id; // Không cho sửa ID nếu đã tồn tại

    document.getElementById('game-name-vi').value = game.name?.vi || '';
    document.getElementById('game-name-en').value = game.name?.en || '';
    document.getElementById('game-desc-vi').value = game.desc?.vi || '';
    document.getElementById('game-desc-en').value = game.desc?.en || '';
    document.getElementById('game-category-vi').value = game.category?.vi || '';
    document.getElementById('game-category-en').value = game.category?.en || '';
    document.getElementById('game-players').value = game.players || '';
    
    document.getElementById('game-modal').style.display = 'block';
    showOverlay(true);
  };

  const closeGameModal = () => {
    document.getElementById('game-modal').style.display = 'none';
    showOverlay(false);
  };

  const saveGame = async (e) => {
    e.preventDefault();
    const idOrig = document.getElementById('game-id-orig').value;
    const id = document.getElementById('game-id').value;

    // 1. LẤY PAYLOAD GỐC (SỬA LỖI MẤT DATA)
    let payload = allGamesCache.find(g => g.id === idOrig) || {};
    
    // 2. GHI ĐÈ TỪ FORM
    payload = {
        ...payload, // Giữ lại các trường cũ (như _id, featured)
        id: id,
        name: {
            vi: document.getElementById('game-name-vi').value,
            en: document.getElementById('game-name-en').value
        },
        desc: {
            vi: document.getElementById('game-desc-vi').value,
            en: document.getElementById('game-desc-en').value
        },
        category: {
            vi: document.getElementById('game-category-vi').value,
            en: document.getElementById('game-category-en').value
        },
        players: document.getElementById('game-players').value
    };
    
    const endpoint = idOrig ? API_ENDPOINTS.GAME_ID(idOrig) : API_ENDPOINTS.GAMES;
    const method = idOrig ? 'PUT' : 'POST';

    const res = await sendData(endpoint, method, payload);
    if (res.ok) {
      closeGameModal();
      await loadData();
    } else {
      alert('Lỗi lưu Game: ' + await res.text());
    }
  };

  const onFeatureGame = async (gameId, isFeatured) => {
    // 1. LẤY PAYLOAD GỐC (SỬA LỖI MẤT DATA)
    const payload = allGamesCache.find(g => g.id === gameId);
    if (!payload) return alert('Không tìm thấy game trong cache');
    
    // 2. CẬP NHẬT TRƯỜNG 'featured'
    payload.featured = isFeatured;
    
    const res = await sendData(API_ENDPOINTS.GAME_ID(gameId), 'PUT', payload);
    if (!res.ok) {
        alert('Lỗi cập nhật "Nổi bật"');
        await loadData(); // Load lại để reset checkbox
    }
    // (Không cần loadData() nếu thành công, vì socket sẽ tự gọi)
  };

  const onDeleteGame = async (gameId) => {
    if (!confirm('Bạn có chắc muốn xóa game này?')) return;
    const res = await sendData(API_ENDPOINTS.GAME_ID(gameId), 'DELETE');
    if (res.ok) await loadData();
    else alert('Lỗi xóa Game');
  };

  // --- Room Actions ---
  const onDeleteRoom = async (roomCode) => {
    if (!confirm('Bạn có chắc muốn xóa phòng này? Tất cả người chơi sẽ bị kick.')) return;
    const res = await sendData(API_ENDPOINTS.ROOM_ID(roomCode), 'DELETE');
    if (res.ok) await loadData();
    else alert('Lỗi xóa Phòng');
  };

  // --- Đồng bộ games.json (Không đổi) ---
  const syncGames = async () => {
      if (!confirm('Bạn có chắc muốn đồng bộ (Upsert) toàn bộ game từ public/games.json? Mọi thay đổi chưa lưu sẽ bị mất.')) return;
      try {
        const res = await fetch('/games.json'); 
        const games = await res.json();
        const syncRes = await sendData(API_ENDPOINTS.GAME_SYNC, 'POST', games);
        if (!syncRes.ok) throw new Error(await syncRes.text());
        alert('Đồng bộ thành công!');
        await loadData();
      } catch (err) {
        alert('Lỗi khi đồng bộ: ' + err.message);
      }
  };
  
  // --- Đăng xuất (Không đổi) ---
  function logoutAdmin(){ 
    localStorage.removeItem('adminToken');
    window.location.href = '/admin-login.html';
  }

  // --- SỬA LỖI NAV: Thêm Toggle Button ---
  function setupNavToggle() {
      const toggleBtn = document.getElementById('navToggleBtn');
      const sidebar = document.getElementById('adminSidebar');
      const overlay = document.getElementById('popupOverlay');
      
      if (toggleBtn && sidebar && overlay) {
          const closeNav = () => {
              sidebar.classList.remove('active');
              overlay.style.display = 'none';
          };
      
          toggleBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const isActive = sidebar.classList.contains('active');
              if (isActive) {
                  closeNav();
              } else {
                  sidebar.classList.add('active');
                  overlay.style.display = 'block';
              }
          });
          
          overlay.addEventListener('click', () => {
              closeNav();
              closeUserModal();
              closeGameModal();
              // (Thêm các hàm close modal khác nếu có)
          });
      }
  }

  // --- Init & Gán sự kiện ---
  document.addEventListener('DOMContentLoaded', async () => {
    // Gán sự kiện cho các tab
    document.querySelectorAll('.tab-btn').forEach(b=> b.addEventListener('click', (e)=> {
        e.preventDefault();
        showTab(b.getAttribute('data-tab'));
        // Tự động đóng nav trên mobile
        if (window.innerWidth < 768) {
            el('adminSidebar').classList.remove('active');
            el('popupOverlay').style.display = 'none';
        }
    }));
    
    // Gán sự kiện cho các nút modal
    el('btn-add-user').onclick = () => showUserModal();
    el('user-modal-close').onclick = closeUserModal;
    el('user-form').onsubmit = saveUser;

    el('btn-add-game').onclick = () => showGameModal();
    el('game-modal-close').onclick = closeGameModal;
    el('game-form').onsubmit = saveGame;

    // Gán sự kiện cho thanh confirm (nếu bạn dùng logic cũ)
    // el('btnConfirmChanges').addEventListener('click', executePendingChanges);
    // el('btnCancelChanges').addEventListener('click', cancelPendingChanges);
    
    el('btn-sync-games').onclick = syncGames;
    el('logout-btn').onclick = logoutAdmin; // Sửa: Dùng id mới 'logout-btn'

    // Gán sự kiện toggle nav
    setupNavToggle();

    // Tải dữ liệu lần đầu
    await loadData();
    showTab('user-management-tab'); // Mở tab User đầu tiên
  });

})();