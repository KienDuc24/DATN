// public/admin.js (FINAL VERSION: Fix Event Delegation & 401 Error)

const ADMIN_API = 'https://datn-socket.up.railway.app'; 
let allGamesCache = []; // Cache để lấy thông tin game
let allUsersCache = []; // Cache cho Users
let pendingChanges = []; // Hàng chờ thay đổi

// --- Chuẩn hóa API Endpoints ---
const API_ENDPOINTS = {
    USERS: `${ADMIN_API}/api/admin/users`,
    USER_ID: (id) => `${ADMIN_API}/api/admin/users/${id}`,
    GAMES: `${ADMIN_API}/api/admin/games`,
    GAME_ID: (id) => `${ADMIN_API}/api/admin/games/${id}`,
    GAME_SYNC: `${ADMIN_API}/api/admin/games/sync`,
    ROOMS: `${ADMIN_API}/api/admin/rooms`,
    ROOM_ID: (id) => `${ADMIN_API}/api/admin/rooms/${id}`
};

// --- Kết nối Socket Admin ---
try {
  const socket = io(ADMIN_API, { path: '/socket.io', withCredentials: true });
  socket.on('connect', () => console.log('Admin socket connected'));
  socket.on('admin-rooms-changed', () => loadData());
  socket.on('admin-users-changed', () => loadData());
  socket.on('admin-games-changed', () => loadData());
  socket.on('admin-user-status-changed', () => loadData());
} catch (e) {
  console.error("Socket.IO connection failed.", e);
}

function el(id){return document.getElementById(id);}
function showOverlay(show){ 
    const overlay = el('popupOverlay'); 
    if (overlay) overlay.style.display = show ? 'block' : 'none'; 
}
function debounce(fn,wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }

// --- LOGIC THANH XÁC NHẬN ---
function updateConfirmBar() {
    // Tìm nút lưu thay đổi (hỗ trợ cả 2 kiểu ID cũ/mới cho chắc chắn)
    const bar = el('btnConfirmChanges') || el('confirmBar'); 
    const countEl = el('pendingChangesCount');
    
    if (!bar) {
        if (pendingChanges.length > 0) console.warn("Không tìm thấy nút Lưu thay đổi (btnConfirmChanges)");
        return;
    }
    
    if (pendingChanges.length > 0) {
        // Có thay đổi -> Hiện nút
        if (bar.tagName === 'BUTTON') {
             bar.style.display = 'inline-block';
             bar.textContent = `Lưu thay đổi (${pendingChanges.length})`;
             // Nếu có nút Hủy riêng
             const btnCancel = el('btnCancelChanges');
             if(btnCancel) btnCancel.style.display = 'inline-block';
        } else {
            // Logic cho thanh confirm bar cũ (nếu bạn dùng lại)
            bar.style.display = 'flex';
            if(countEl) countEl.textContent = pendingChanges.length;
        }
    } else {
        // Không có thay đổi -> Ẩn nút
        bar.style.display = 'none';
        const btnCancel = el('btnCancelChanges');
        if(btnCancel) btnCancel.style.display = 'none';
    }
}

function addChange(change) {
  let key = change.id;
  // Tạo key duy nhất để không bị trùng lặp thay đổi trên cùng 1 item
  if(change.type === 'user') key = `user-${change.id}`;
  if(change.type === 'game') key = `game-${change.id}`;

  // Xóa thay đổi cũ của item này (nếu có) để cập nhật mới
  pendingChanges = pendingChanges.filter(c => c.key !== key);
  
  change.key = key;
  pendingChanges.push(change);
  
  console.log('Pending Changes:', pendingChanges); // Debug log
  updateConfirmBar();
}

async function executePendingChanges() {
    const changesToExecute = [...pendingChanges];
    pendingChanges = [];
    updateConfirmBar();

    let hasError = false;

    for (const change of changesToExecute) {
        try {
            const { type, action, id, payload } = change;
            
            let url = '';
            let method = 'POST';

            if (action === 'delete') {
                method = 'DELETE';
                url = (type === 'game') ? API_ENDPOINTS.GAME_ID(id) : API_ENDPOINTS.USER_ID(id);
            } else if (action === 'update') {
                method = 'PUT';
                url = (type === 'game') ? API_ENDPOINTS.GAME_ID(id) : API_ENDPOINTS.USER_ID(id);
            } else if (action === 'save') {
                method = 'POST';
                url = (type === 'game') ? API_ENDPOINTS.GAMES : API_ENDPOINTS.USERS;
            } else if (type === 'room' && action === 'delete') { 
                method = 'DELETE';
                url = API_ENDPOINTS.ROOM_ID(id);
            }
            
            if (!url) throw new Error(`Hành động không xác định: ${action} cho ${type}`);

            // Gọi API (Đã sửa lỗi 401)
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', 
                body: (method !== 'DELETE') ? JSON.stringify(payload) : undefined
            });
            
            if (!res || !res.ok) {
                const errData = await res.json().catch(() => ({ message: res.statusText }));
                throw new Error(errData.message || `Lỗi ${method} ${url}`);
            }
            
        } catch (err) {
            console.error('Failed to execute change:', change, err);
            alert(`Lỗi khi lưu ${change.type} ${change.id}: ${err.message}`);
            // Đưa lại vào hàng chờ nếu lỗi
            pendingChanges.push(change);
            hasError = true;
        }
    }
    
    updateConfirmBar(); 
    
    if (!hasError && changesToExecute.length > 0) {
        alert('Đã lưu tất cả thành công!');
    }
    loadData(); // Tải lại dữ liệu mới nhất
}

function cancelPendingChanges() {
    if (confirm('Hủy bỏ tất cả thay đổi chưa lưu?')) {
        pendingChanges = [];
        updateConfirmBar();
        loadData(); // Reset lại giao diện về trạng thái gốc
    }
}

// --- UI & NAVIGATION ---
function showTab(tabId){
  document.querySelectorAll('.admin-tab-content').forEach(e => e.style.display = 'none');
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  
  const tabContent = el(tabId);
  if(tabContent) tabContent.style.display = 'block'; 
  
  const tabButton = document.querySelector(`.sidebar nav a[data-tab="${tabId}"]`);
  if(tabButton) tabButton.classList.add('active');
}

async function fetchApi(url) {
    const res = await fetch(url, { credentials: 'include' }); 
    if (!res.ok) {
        if (res.status === 401) {
            alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
            logoutAdmin();
        }
        throw new Error(res.statusText);
    }
    return await res.json(); 
}

// --- DATA FETCHING ---
async function fetchUsers(q){
  const url = new URL(API_ENDPOINTS.USERS);
  if (q) url.searchParams.set('q', q);
  const j = await fetchApi(url.toString());
  allUsersCache = j.users || []; 
  return allUsersCache;
}
async function fetchRooms(q){
  const url = new URL(API_ENDPOINTS.ROOMS);
  if (q) url.searchParams.set('q', q);
  const j = await fetchApi(url.toString());
  return j.rooms || [];
}
async function fetchGames(q){
  const url = new URL(API_ENDPOINTS.GAMES);
  if (q) url.searchParams.set('q', q);
  const j = await fetchApi(url.toString());
  allGamesCache = j.games || [];
  return allGamesCache;
}

// --- RENDER FUNCTIONS ---
function renderUsersTable(users){
  const tbody = el('adminUsersList'); 
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">Không có người dùng</td></tr>`;
    return;
  }

  users.forEach(u => {
    const id = u._id || u.id || '';
    const username = u.username || '';
    const displayName = u.displayName || 'N/A';
    const passwordHash = u.password || 'N/A';
    
    // Format lịch sử chơi
    let historyHtml = 'Chưa chơi game nào';
    if (Array.isArray(u.playHistory) && u.playHistory.length) {
      const recentGames = u.playHistory.slice(-3).reverse();
      historyHtml = recentGames.map(game => 
        `<div style="white-space: normal; font-size: 11px; margin-bottom: 2px;">• ${game.gameName || game.gameId} (${new Date(game.playedAt).toLocaleDateString('vi-VN')})</div>`
      ).join('');
    }
    
    // Format trạng thái
    let statusHtml = '<span style="color:#ef4444;font-weight:600;">Offline</span>';
    if (u.status === 'online') statusHtml = '<span style="color:#22c55e;font-weight:600;">Online</span>';
    else if (u.status === 'playing') statusHtml = '<span style="color:#ff9f43;font-weight:600;">Playing</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${username}</td>
      <td>${displayName}</td>
      <td>${u.email || 'N/A'}</td>
      <td>${historyHtml}</td>
      <td>${statusHtml}</td>
      <td style="text-align:center;">
        <button class="icon-btn icon-edit" title="Sửa" data-id="${id}">✏️</button>
        <button class="icon-btn icon-delete" title="Xóa" data-id="${id}">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  // Lưu ý: Sự kiện click được xử lý bởi Event Delegation ở cuối file
}

function renderRoomsTable(rooms){
  const tbody = el('adminRoomsList'); 
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (!rooms || rooms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">Không có phòng chơi</td></tr>`;
    return;
  }

  rooms.forEach(r => {
    const roomId = r.code || r.id || r._id || '';
    const gameName = (r.game && (r.game.gameId || r.game.type)) ? (r.game.gameId || r.game.type) : (r.game || '');
    const owner = r.host || '';
    const participants = Array.isArray(r.players) ? r.players.map(p => p.name).join(', ') : '-';
    
    let status = r.status === 'playing' ? 'Đang chơi' : (r.status === 'closed' ? 'Đã đóng' : 'Đang chờ');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${gameName}</strong></td>
      <td>${String(roomId)}</td>
      <td>${owner}</td>
      <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis;">${participants}</td>
      <td>${status}</td>
      <td style="text-align:center;">
        <button class="icon-btn icon-delete" title="Xóa phòng" data-id="${roomId}">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderGamesTable(games){
  const tbody = el('adminGamesList'); 
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (!games || games.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">Không có trò chơi</td></tr>`;
    return;
  }

  games.forEach(g => {
    const id = g.id || '';
    const title = (g.name && (g.name.vi || g.name.en)) ? (g.name.vi || g.name.en) : (g.title || g.name || '');
    const desc = (g.desc && (g.desc.vi || g.desc.en)) ? (g.desc.vi || g.desc.en) : (g.desc || '');
    const category = (g.category && (g.category.vi || g.category.en)) ? (g.category.vi || g.category.en) : (g.category || '');
    const players = g.players || '';
    const featuredChecked = g.featured ? 'checked' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="font-weight:700; font-size: 1.05em;">${title}</div>
        <div style="color:#888;font-size:12px; margin-top:4px;">${String(desc).slice(0,80)}...</div>
      </td>
      <td>${category}</td>
      <td>${players}</td>
      <td style="text-align:center;">
        <input type="checkbox" class="game-feature-checkbox" data-id="${id}" ${featuredChecked} style="width:20px;height:20px;cursor:pointer;" />
      </td>
      <td style="text-align:center;">
        <button class="icon-btn icon-edit" title="Sửa" data-id="${id}">✏️</button>
        <button class="icon-btn icon-delete" title="Xóa" data-id="${id}">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- HANDLERS (Xử lý sự kiện) ---

// 1. Game Handlers
function openGameForm(game){
  showOverlay(true);
  el('gameFormPopup').style.display = 'block';
  el('gameFormTitle').innerText = game ? 'Sửa trò chơi' : 'Thêm trò chơi';
  
  // Reset form nếu thêm mới
  if (!game) {
      el('gameForm').reset();
      el('gameIdOrig').value = '';
  } else {
      el('gameIdOrig').value = game.id || ''; 
      el('gameId').value = game.id || '';
      el('gameNameVI').value = game.name?.vi || '';
      el('gameNameEN').value = game.name?.en || '';
      el('gameDescVI').value = game.desc?.vi || '';
      el('gameDescEN').value = game.desc?.en || '';
      el('gameCatVI').value = game.category?.vi || '';
      el('gameCatEN').value = game.category?.en || '';
      el('gamePlayers').value = game.players || '';
  }
}
function closeGameForm(){ el('gameFormPopup').style.display='none'; showOverlay(false); }

function onFeatureGame(e) {
  const id = e.target.dataset.id;
  const checked = e.target.checked;
  const originalGame = allGamesCache.find(g => g.id === id);
  
  if (originalGame) {
    const payload = { ...originalGame, featured: checked };
    addChange({ type: 'game', action: 'update', id: id, payload: payload });
  }
}

// 2. User Handlers
function openUserForm(user){ 
  showOverlay(true); el('userFormPopup').style.display = 'block'; 
  el('userFormTitle').innerText = user ? 'Sửa người dùng' : 'Thêm người dùng'; 
  
  if (!user) {
      el('userForm').reset();
      el('userId').value = '';
  } else {
      el('userId').value = user._id || ''; 
      el('userUsername').value = user.username || ''; 
      el('userDisplayName').value = user.displayName || ''; 
      el('userEmail').value = user.email || ''; 
      // el('userRole').value = user.role || 'user';
  }
}
function closeUserForm(){ el('userFormPopup').style.display='none'; showOverlay(false); }

// --- SUBMIT HANDLERS ---

async function saveGame(e){
  e.preventDefault();
  const id = el('gameId').value.trim(); 
  const idOrig = el('gameIdOrig').value.trim();
  if (!id) return alert('Game ID không được để trống');
  
  const payload = {
      id: id,
      name: { vi: el('gameNameVI').value.trim(), en: el('gameNameEN').value.trim() },
      desc: { vi: el('gameDescVI').value.trim(), en: el('gameDescEN').value.trim() },
      category: { vi: el('gameCatVI').value.trim(), en: el('gameCatEN').value.trim() },
      players: el('gamePlayers').value.trim()
      // featured giữ nguyên từ gốc hoặc mặc định false
  };
  
  // Nếu sửa, giữ lại thuộc tính featured cũ
  if (idOrig) {
      const old = allGamesCache.find(g => g.id === idOrig);
      if (old) payload.featured = old.featured;
  }

  const action = idOrig ? 'update' : 'save';
  addChange({ type: 'game', action: action, id: id, payload: payload });
  alert('Đã thêm thay đổi vào hàng chờ.');
  closeGameForm();
}

async function saveUser(e){ 
  e.preventDefault(); 
  const id = el('userId').value; 
  const payload = { 
    username: el('userUsername').value.trim(), 
    displayName: el('userDisplayName').value.trim(), 
    email: el('userEmail').value.trim(),
    // role: el('userRole').value 
  }; 
  if(!payload.username) return alert('Username là bắt buộc'); 

  const action = id ? 'update' : 'save';
  addChange({ type: 'user', action: action, id: id, payload: payload });
  alert('Đã thêm thay đổi vào hàng chờ.');
  closeUserForm(); 
}

// --- MAIN INIT & EVENT DELEGATION ---
function setupNavToggle() {
    const toggleBtn = el('navToggleBtn');
    const sidebar = el('adminSidebar');
    const overlay = el('popupOverlay');
    if (toggleBtn && sidebar && overlay) {
        toggleBtn.onclick = () => {
            sidebar.classList.toggle('active');
            overlay.style.display = 'block';
        };
        overlay.onclick = () => {
            sidebar.classList.remove('active');
            overlay.style.display = 'none';
            // Đóng mọi modal
            document.querySelectorAll('.popup-modal').forEach(m => m.style.display='none');
        };
    }
}

async function syncGames() {
    if (!confirm('Đồng bộ toàn bộ game từ games.json?')) return;
    try {
        const res = await fetch('/games.json');
        const games = await res.json();
        const resSync = await fetch(API_ENDPOINTS.GAME_SYNC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(games)
        });
        const result = await resSync.json();
        alert(`Đồng bộ xong: ${result.updated} cập nhật, ${result.created} mới.`);
        loadData();
    } catch(e) { alert('Lỗi đồng bộ: ' + e.message); }
}

function logoutAdmin(){ 
  fetch(`${ADMIN_API}/admin/logout`, {method:'POST', credentials: 'include'})
    .finally(()=> location.href='/admin-login.html'); 
}

async function loadData(){
  try {
    const qG = el('gamesSearch') ? el('gamesSearch').value : '';
    const qU = el('usersSearch') ? el('usersSearch').value : '';
    const qR = el('roomsSearch') ? el('roomsSearch').value : '';

    const [u, r, g] = await Promise.all([
        fetchUsers(qU), fetchRooms(qR), fetchGames(qG)
    ]);
    renderUsersTable(u);
    renderRoomsTable(r);
    renderGamesTable(g);
  } catch (err) { console.error(err); }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Nav & Overlay
    setupNavToggle();

    // 2. Gán sự kiện cho các nút chính (kiểm tra tồn tại để tránh lỗi null)
    const btnAddGame = el('btnAddGame');
    if(btnAddGame) btnAddGame.onclick = () => openGameForm(null);
    
    const btnAddUser = el('btnAddUser');
    if(btnAddUser) btnAddUser.onclick = () => openUserForm(null);

    const btnSync = el('btnSyncGames');
    if(btnSync) btnSync.onclick = syncGames;
    
    const btnLogout = el('btnLogout');
    if(btnLogout) btnLogout.onclick = logoutAdmin;
    
    // Nút Lưu/Hủy thay đổi
    const btnConfirm = el('btnConfirmChanges');
    if(btnConfirm) btnConfirm.onclick = executePendingChanges;
    const btnCancel = el('btnCancelChanges');
    if(btnCancel) btnCancel.onclick = cancelPendingChanges;

    // 3. Search Inputs
    ['gamesSearch', 'usersSearch', 'roomsSearch'].forEach(id => {
        const inp = el(id);
        if(inp) inp.onkeyup = debounce(loadData, 400);
    });

    // 4. Form Submits
    const fGame = el('gameForm');
    if(fGame) fGame.onsubmit = saveGame;
    const fUser = el('userForm');
    if(fUser) fUser.onsubmit = saveUser;

    // 5. Tab Navigation
    document.querySelectorAll('.sidebar nav a[data-tab]').forEach(a => {
        a.onclick = (e) => {
            e.preventDefault();
            showTab(a.getAttribute('data-tab'));
            if(window.innerWidth < 768) el('popupOverlay').click(); // Đóng nav mobile
        };
    });

    // 6. EVENT DELEGATION (Quan trọng nhất để fix lỗi sự kiện bảng)
    
    // Delegation cho bảng Game (Edit, Delete, Checkbox)
    const gamesList = el('adminGamesList');
    if (gamesList) {
        gamesList.addEventListener('click', (e) => {
            const target = e.target.closest('button, input'); // Tìm nút hoặc input
            if (!target) return;

            const id = target.dataset.id;
            
            if (target.classList.contains('icon-edit')) {
                const game = allGamesCache.find(g => g.id === id);
                if(game) openGameForm(game);
            } 
            else if (target.classList.contains('icon-delete')) {
                if(confirm('Xóa game này?')) addChange({ type: 'game', action: 'delete', id: id });
            }
        });
        
        // Riêng sự kiện change cho checkbox
        gamesList.addEventListener('change', (e) => {
            if (e.target.classList.contains('game-feature-checkbox')) {
                onFeatureGame(e);
            }
        });
    }

    // Delegation cho bảng User (Edit, Delete)
    const usersList = el('adminUsersList');
    if (usersList) {
        usersList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;

            if (btn.classList.contains('icon-edit')) {
                const user = allUsersCache.find(u => u._id === id);
                if(user) openUserForm(user);
            }
            else if (btn.classList.contains('icon-delete')) {
                if(confirm('Xóa người dùng này?')) addChange({ type: 'user', action: 'delete', id: id });
            }
        });
    }

    // Delegation cho bảng Room (Delete)
    const roomsList = el('adminRoomsList');
    if (roomsList) {
        roomsList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;

            if (btn.classList.contains('icon-delete')) {
                if(confirm('Xóa phòng này?')) addChange({ type: 'room', action: 'delete', id: id });
            }
        });
    }

    // Init Load
    showTab('gamesTab');
    loadData();
});