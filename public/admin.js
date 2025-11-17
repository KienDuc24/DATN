// public/admin.js (ĐÃ SỬA LỖI CRUD + THÊM DISPLAYNAME)

const ADMIN_API = 'https://datn-socket.up.railway.app'; 
let allGamesCache = []; // Cache để lấy thông tin game
let allUsersCache = []; // Cache cho Users
let pendingChanges = []; // Hàng chờ thay đổi

// --- SỬA LỖI: Chuẩn hóa API Endpoints ---
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
function showOverlay(show){ el('popupOverlay').style.display = show ? 'block' : 'none'; }
function debounce(fn,wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }

// --- LOGIC THANH XÁC NHẬN ---
function updateConfirmBar() {
    const bar = el('confirmBar');
    const countEl = el('pendingChangesCount');
    if (!bar || !countEl) return;
    if (pendingChanges.length > 0) {
        countEl.textContent = pendingChanges.length;
        bar.style.display = 'flex';
    } else {
        bar.style.display = 'none';
    }
}
function addChange(change) {
  // Thay đổi: id là key (cho user, game)
  let key = change.id;
  // Đối với user (dùng _id), đối với game (dùng id string)
  if(change.type === 'user') key = `user-${change.id}`;
  if(change.type === 'game') key = `game-${change.id}`;

  pendingChanges = pendingChanges.filter(c => c.key !== key);
  change.key = key;
  pendingChanges.push(change);
  updateConfirmBar();
}

async function executePendingChanges() {
    const changesToExecute = [...pendingChanges];
    pendingChanges = [];
    updateConfirmBar();

    for (const change of changesToExecute) {
        try {
            const { type, action, id, payload } = change;
            
            // Sửa: Dùng 'users' và 'games'
            const resourceType = (type === 'game') ? 'games' : 'users'; 

            let res;
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
            }
            
            // --- *** ĐÂY LÀ PHẦN ĐÃ SỬA LỖI 401 *** ---
            res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // 'credentials' phải nằm ngoài 'headers'
                body: JSON.stringify(payload)
            });
            // --- *** KẾT THÚC SỬA LỖI *** ---
            
            if (!res || !res.ok) {
                const errText = await res.json(); // Đọc lỗi từ JSON (thường server trả về JSON)
                throw new Error(errText.message || `Lỗi ${method} ${url}`);
            }
            
        } catch (err) {
            console.error('Failed to execute change:', change, err);
            alert(`Lỗi khi thực thi ${change.action} ${change.type} ${change.id}: ${err.message}`);
        }
    }
    
    alert('Đã lưu tất cả thay đổi!');
    loadData(); // Tải lại toàn bộ
}

function cancelPendingChanges() {
    if (confirm('Bạn có chắc muốn hủy tất cả thay đổi chưa lưu?')) {
        pendingChanges = [];
        updateConfirmBar();
        loadData(); // Tải lại dữ liệu gốc từ server
    }
}
// ------------------------------------

function showTab(tabId){
  document.querySelectorAll('.admin-tab-content').forEach(e=>e.style.display='none');
  document.querySelectorAll('.sidebar nav a').forEach(a=>a.classList.remove('active'));
  
  const tab = el(tabId);
  if(tab) tab.style.display = '';
  
  document.querySelectorAll('.sidebar nav a').forEach(a=>{ if(a.getAttribute('data-tab')===tabId) a.classList.add('active') });
}

// --- HÀM fetchApi (Giữ nguyên) ---
async function fetchApi(url) {
    const res = await fetch(url, { credentials: 'include' }); 
    if (!res.ok) {
        let errorMessage = res.statusText;
        if (res.status === 401) {
            alert('Phiên đăng nhập hết hạn.');
            logoutAdmin();
        }
        console.error(`[fetchApi] Lỗi: ${errorMessage}`);
        throw new Error(errorMessage);
    }
    return await res.json(); 
}

// --- SỬA LỖI: Cập nhật cache ---
async function fetchUsers(q){
  const url = new URL(API_ENDPOINTS.USERS);
  if (q) url.searchParams.set('q', q);
  const j = await fetchApi(url.toString());
  allUsersCache = j.users || []; // Cập nhật cache
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
  allGamesCache = j.games || []; // Cập nhật cache
  return allGamesCache;
}

// --- SỬA LỖI: CẬP NHẬT RENDER USER ---
function renderUsersTable(users){
  const tbody = el('adminUsersList');
  if (!tbody) { console.warn('adminUsersList tbody not found'); return; }
  tbody.innerHTML = '';
  if (!Array.isArray(users) || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">Không có người dùng</td></tr>`; // Sửa: colspan="6"
    return;
  }
  users.forEach(u => {
    const id = u._id || u.id || '';
    const username = u.username || '';
    
    // THÊM MỚI: Tên hiển thị
    const displayName = u.displayName || 'N/A';
    
    // THÊM MỚI: Lịch sử chơi
    let historyHtml = 'Chưa chơi game nào';
    if (Array.isArray(u.playHistory) && u.playHistory.length) {
      const recentGames = u.playHistory.slice(-3).reverse(); // Lấy 3 game gần nhất
      historyHtml = recentGames.map(game => 
        `<div style="white-space: normal;"><small>${game.gameName || game.gameId} (lúc: ${new Date(game.playedAt).toLocaleString()})</small></div>`
      ).join('');
    }
    
    let statusText = 'Offline';
    let statusColor = '#ef4444';
    if (u.status === 'online') {
        statusText = 'Online';
        statusColor = '#22c55e';
    } else if (u.status === 'playing') {
        statusText = 'Playing';
        statusColor = '#ff9f43';
    }

    const tr = document.createElement('tr');
    tr.id = `user-row-${id}`;
    // Sửa: Thêm 2 <td>
    tr.innerHTML = `
      <td><div style="font-weight:600">${username}</div></td>
      <td>${displayName}</td> <td>${u.email || 'N/A'}</td>
      <td style="font-size: 0.85rem; max-width: 250px;">${historyHtml}</td> <td><span style="color:${statusColor}; font-weight:600;">${statusText}</span></td>
      <td style="display:flex;gap:8px;align-items:center; justify-content: center;">
        <button class="icon-btn icon-edit" title="Sửa" data-id="${id}" aria-label="Sửa"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
        <button class="icon-btn icon-delete" title="Xóa" data-id="${id}" aria-label="Xóa"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.icon-edit').forEach(btn => btn.addEventListener('click', onEditUser));
  tbody.querySelectorAll('.icon-delete').forEach(btn => btn.addEventListener('click', onDeleteUser));
}
// --- KẾT THÚC SỬA ---

function renderRoomsTable(rooms){
  const tbody = el('adminRoomsList');
  if (!tbody) { console.warn('adminRoomsList tbody not found'); return; }
  tbody.innerHTML = '';
  if (!Array.isArray(rooms) || rooms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">Không có phòng chơi</td></tr>`;
    return;
  }
  rooms.forEach(r => {
    const roomId = r.code || r.id || r._id || '';
    const gameName = (r.game && (r.game.gameId || r.game.type)) ? (r.game.gameId || r.game.type) : (r.game || ''); // Sửa: Lấy gameId
    const owner = r.host || '';
    const participants = Array.isArray(r.players) ? r.players.map(p => p.name).join(', ') : '-';
    
    let status = r.status || 'open';
    if (status === 'open') status = 'Đang chờ';
    if (status === 'playing') status = 'Đang chơi';
    if (status === 'closed') status = 'Đã đóng';

    const tr = document.createElement('tr');
    tr.id = `room-row-${roomId}`;
    tr.innerHTML = `
      <td><div style="font-weight:600">${gameName}</div></td>
      <td>${String(roomId)}</td>
      <td>${owner}</td>
      <td style="max-width:360px; white-space: normal;">${participants || '-'}</td>
      <td>${status}</td>
      <td style="display:flex;gap:6px; justify-content: center;">
        <button class="icon-btn icon-delete" title="Xóa" data-id="${roomId}" aria-label="Xóa"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.icon-delete').forEach(btn => btn.addEventListener('click', onDeleteRoom));
}

function renderGamesTable(games){
  const tbody = el('adminGamesList');
  if (!tbody) { console.warn('adminGamesList tbody not found'); return; }
  tbody.innerHTML = '';
  if (!Array.isArray(games) || games.length === 0) {
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
    tr.id = `game-row-${id}`;
    tr.innerHTML = `
      <td>
        <div style="font-weight:600">${title}</div>
        <div style="color:var(--muted);font-size:12px; white-space: normal;">${String(desc).slice(0,120)}</div>
      </td>
      <td>${category}</td>
      <td>${players}</td>
      <td style="text-align:center; vertical-align: middle;">
        <input type="checkbox" class="game-feature-checkbox" data-id="${id}" ${featuredChecked} aria-label="Nổi bật"/>
      </td>
      <td style="display:flex;gap:6px; justify-content: center; vertical-align: middle;">
        <button class="icon-btn icon-edit" title="Sửa" data-id="${id}" aria-label="Sửa"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
        <button class="icon-btn icon-delete" title="Xóa" data-id="${id}" aria-label="Xóa"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.game-feature-checkbox').forEach(cb => cb.addEventListener('change', onFeatureGame));
  tbody.querySelectorAll('.icon-edit').forEach(b=>b.addEventListener('click', onEditGame));
  tbody.querySelectorAll('.icon-delete').forEach(b=>b.addEventListener('click', onDeleteGame));
}

// --- Handlers (ĐÃ CẬP NHẬT) ---
function openUserForm(user){ 
  showOverlay(true); el('userFormPopup').style.display = 'block'; 
  el('userFormTitle').innerText = user ? 'Sửa người dùng' : 'Thêm người dùng'; 
  el('userId').value = user? user._id : ''; 
  el('userUsername').value = user? user.username : ''; 
  
  // THÊM MỚI
  el('userDisplayName').value = user? (user.displayName || '') : ''; 
  
  el('userEmail').value = user? user.email : ''; 
  el('userRole').value = user? user.role || 'user' : 'user'; 
}
function closeUserForm(){ el('userFormPopup').style.display='none'; showOverlay(false); }

async function onEditUser(e){ 
    const id = e.currentTarget.dataset.id; 
    try{ 
        // Dùng cache thay vì fetch
        const u = allUsersCache.find(x=>x._id===id); 
        if(!u) return alert('User not found in cache'); 
        openUserForm(u); 
    } catch(err){ 
        console.error(err); alert('Lỗi'); 
    } 
}

async function saveUser(e){ 
  e.preventDefault(); 
  const id = el('userId').value; 
  
  const payload = { 
    username: el('userUsername').value.trim(), 
    
    // THÊM MỚI
    displayName: el('userDisplayName').value.trim(), 
    
    email: el('userEmail').value.trim(), 
    role: el('userRole').value
  }; 
  
  if(!payload.username) return alert('Username không được để trống'); 

  // Sửa: Dùng 'update' nếu có ID
  const action = id ? 'update' : 'save';
  addChange({ type: 'user', action: action, id: id, payload: payload });
  
  alert('Đã thêm thay đổi. Nhấn "Lưu thay đổi" để xác nhận.');
  closeUserForm(); 
}
async function onDeleteUser(e){ 
  const id = e.currentTarget.dataset.id; 
  if(!confirm('Xác nhận đưa user này vào hàng chờ xóa?')) return; 
  
  addChange({ type: 'user', action: 'delete', id: id });
  el(`user-row-${id}`).classList.add('row-to-be-deleted');
}

// (Các hàm Room... giữ nguyên)
function openRoomForm(room){ 
  showOverlay(true); 
  el('roomFormPopup').style.display = 'block'; 
  el('roomFormTitle').innerText = room ? 'Sửa phòng' : 'Thêm phòng'; 
  
  el('roomId').value = room? (room.code || room.id || room._id || '') : ''; 
  
  el('roomName').value = room? (room.name || '') : ''; 
  const sel = el('roomGame');
  const gameId = room ? ( (room.game && (room.game.gameId || room.game.type)) || '' ) : '';
  if(sel) sel.value = gameId || '';
  
  el('roomOwner').value = room? (room.owner || room.host || '') : ''; 
  el('roomStatus').value = room? (room.status || 'Đang chờ') : 'Đang chờ'; 
}
function closeRoomForm(){ el('roomFormPopup').style.display='none'; showOverlay(false); }
async function onEditRoom(e){ const id = e.currentTarget.dataset.id; try{ const rooms = await fetchRooms(); const r = rooms.find(x=>x.code===id); if(!r) return alert('Room not found'); openRoomForm(r); }catch(err){ console.error(err); alert('Lỗi'); } }
async function saveRoom(e){
  e.preventDefault();
  const id = el('roomId').value.trim(); 
  const roomName = el('roomName').value.trim();
  const roomOwner = el('roomOwner').value.trim();
  if (!roomName) return alert('Tên phòng không được để trống');
  const selGame = el('roomGame');
  if(!selGame || !selGame.value) return alert('Vui lòng chọn trò chơi.');
  const gameName = selGame.options[selGame.selectedIndex].text;
  const payload = {
    code: id || undefined, 
    name: roomName,
    host: roomOwner,
    status: el('roomStatus').value,
    game: { id: selGame.value, name: gameName, type: selGame.value }
  };
  const action = id ? 'update' : 'save';
  addChange({ type: 'room', action: action, id: id, payload: payload }); 
  alert('Đã thêm thay đổi. Nhấn "Lưu thay đổi" để xác nhận.');
  closeRoomForm();
}
async function onDeleteRoom(e){ 
  const id = e.currentTarget.dataset.id; // Room ID là 'code'
  if(!confirm('Xác nhận đưa phòng này vào hàng chờ xóa?')) return; 

  // Sửa: 'room' không được hỗ trợ, nhưng logic backend (adminRoutes)
  // xử lý /api/admin/rooms/:id, nên ta giữ nguyên
  addChange({ type: 'room', action: 'delete', id: id });
  el(`room-row-${id}`).classList.add('row-to-be-deleted');
}


// --- SỬA LỖI MẤT DỮ LIỆU GAME ---
function openGameForm(game){
  showOverlay(true);
  el('gameFormPopup').style.display = 'block';
  el('gameFormTitle').innerText = game ? 'Sửa trò chơi' : 'Thêm trò chơi';
  
  // Lưu ID gốc để tìm trong cache
  el('gameIdOrig').value = game ? (game.id || '') : ''; 
  
  el('gameId').value = game ? (game.id || '') : '';
  // Sửa: Lấy chuẩn Tiếng Việt
  el('gameNameVI').value = (game && game.name && game.name.vi) ? game.name.vi : ( (typeof game?.name === 'string') ? game.name : '' );
  el('gameNameEN').value = (game && game.name && game.name.en) ? game.name.en : '';
  // Sửa: Lấy chuẩn Tiếng Việt
  el('gameDescVI').value = (game && game.desc && game.desc.vi) ? game.desc.vi : ( (typeof game?.desc === 'string') ? game.desc : '' );
  el('gameDescEN').value = (game && game.desc && game.desc.en) ? game.desc.en : '';
  el('gamePlayers').value = game ? (game.players||'') : '';
  // Sửa: Lấy chuẩn Tiếng Việt
  el('gameCatVI').value = (game && game.category && game.category.vi) ? game.category.vi : ( (typeof game?.category === 'string') ? game.category : '' );
  el('gameCatEN').value = (game && game.category && game.category.en) ? game.category.en : '';
}
function closeGameForm(){ el('gameFormPopup').style.display='none'; showOverlay(false); }
async function onEditGame(e){
  const id = e.currentTarget.dataset.id;
  const g = allGamesCache.find(x => (x.id) === id); // Dùng cache
  if (!g) return alert('Game not found in cache');
  openGameForm(g);
}
async function saveGame(e){
  e.preventDefault();
  const id = el('gameId').value.trim(); 
  const idOrig = el('gameIdOrig').value.trim();
  
  if (!id) return alert('Game ID không được để trống');
  
  // 1. Lấy payload gốc từ cache
  let payload = {};
  if (idOrig) {
    const original = allGamesCache.find(g => g.id === idOrig);
    if (original) {
        payload = { ...original }; // Giữ lại TẤT CẢ thông tin gốc
    }
  }

  // 2. Ghi đè các trường từ form
  payload.id = id;
  payload.name = { 
    vi: el('gameNameVI').value.trim(), 
    en: el('gameNameEN').value.trim() 
  };
  payload.desc = { 
    vi: el('gameDescVI').value.trim(), 
    en: el('gameDescEN').value.trim() 
  };
  payload.players = el('gamePlayers').value.trim();
  payload.category = { 
    vi: el('gameCatVI').value.trim(), 
    en: el('gameCatEN').value.trim() 
  };
  
  // Đảm bảo trường featured không bị mất
  payload.featured = payload.featured || false;

  const action = idOrig ? 'update' : 'save';
  addChange({ type: 'game', action: action, id: id, payload: payload });
  alert('Đã thêm thay đổi. Nhấn "Lưu thay đổi" để xác nhận.');
  closeGameForm();
}
async function onDeleteGame(e){
  const id = e.currentTarget.dataset.id;
  if (!confirm('Xác nhận đưa game này vào hàng chờ xóa?')) return;
  
  addChange({ type: 'game', action: 'delete', id: id });
  el(`game-row-${id}`).classList.add('row-to-be-deleted');
}
async function onFeatureGame(e) {
  const cbEl = e.currentTarget;
  const id = cbEl.dataset.id;
  const checked = cbEl.checked;
  
  // 1. Lấy payload gốc từ cache
  const originalGame = allGamesCache.find(g => g.id === id);
  if (!originalGame) {
    console.error('Lỗi: Không tìm thấy game trong cache với ID:', id);
    return alert('Không tìm thấy game. Kiểm tra console để debug.');
  }
  
  // 2. Tạo payload mới chỉ bằng cách cập nhật trường 'featured'
  const payload = { ...originalGame, featured: !!checked };
  
  addChange({ type: 'game', action: 'update', id: id, payload: payload });
}
// --- KẾT THÚC SỬA LỖI GAME ---

async function syncGames() {
    if (!confirm('Bạn có chắc muốn ĐỒNG BỘ (Cập nhật/Thêm mới) toàn bộ trò chơi từ tệp games.json lên Database không?\n\nHành động này sẽ được thực thi ngay lập tức.')) {
        return;
    }
    try {
        const resJson = await fetch('/games.json'); 
        if (!resJson.ok) {
            throw new Error(`Không thể tải tệp /games.json. Status: ${resJson.status}`);
        }
        const gamesData = await resJson.json(); 
        if (!Array.isArray(gamesData) || gamesData.length === 0) {
            return alert('Tệp games.json rỗng hoặc không hợp lệ.');
        }

        const resSync = await fetch(API_ENDPOINTS.GAME_SYNC, { // Sửa: Dùng EPs
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(gamesData) 
        });

        const result = await resSync.json();
        if (!resSync.ok) {
            throw new Error(result.message || 'Lỗi từ server khi đồng bộ');
        }
        alert(`Đồng bộ hoàn tất!\nĐã cập nhật: ${result.updated}\nĐã tạo mới: ${result.created}`);
        loadData();
    } catch (err) {
        console.error('Lỗi khi đồng bộ games:', err);
        alert(`Đã xảy ra lỗi khi đồng bộ: ${err.message}`);
    }
}

function logoutAdmin(){ 
  fetch(`${ADMIN_API}/admin/logout`, {method:'POST', credentials: 'include'})
    .finally(()=> location.href='/admin-login.html'); 
}

async function loadData(){
  try{
    const usersQ = el('usersSearch') && el('usersSearch').value.trim();
    const roomsQ = el('roomsSearch') && el('roomsSearch').value.trim();

    const [usersRes, roomsRes, gamesRes] = await Promise.all([
        fetchUsers(usersQ), // Đã sửa hàm này để cập nhật cache
        fetchRooms(roomsQ),
        fetchGames() // Đã sửa hàm này để cập nhật cache
    ]);

    renderUsersTable(usersRes || []);
    renderRoomsTable(roomsRes || []);
    renderGamesTable(gamesRes || []);
  } catch (err) {
    console.error('loadData error:', err);
  }
}

async function populateGameOptions(){
  const sel = el('roomGame');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Chọn trò chơi --</option>';
  try{
    // Sửa: Lấy từ cache thay vì fetch file
    allGamesCache.forEach(g=>{
      const gid = g.id || '';
      const label = (g.name && (g.name.vi || g.name.en)) ? (g.name.vi || g.name.en) : (g.title || gid);
      if(!gid) return;
      const opt = document.createElement('option');
      opt.value = gid;
      opt.textContent = label;
      sel.appendChild(opt);
    });
  }catch(err){
    console.error('populateGameOptions error', err);
  }
}

// --- SỬA LỖI NAV: Thêm Toggle Button ---
function setupNavToggle() {
    const toggleBtn = el('navToggleBtn');
    const sidebar = el('adminSidebar');
    const overlay = el('popupOverlay'); // Dùng chung overlay
    
    if (toggleBtn && sidebar && overlay) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.style.display = 'block'; // Hiện overlay
        });
        
        // Đóng nav khi bấm vào overlay
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.style.display = 'none';
            // (Đóng cả modal nếu đang mở)
            closeUserForm(); 
            closeRoomForm(); 
            closeGameForm();
        });
    }
}
// --- KẾT THÚC SỬA ---

document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.tab-btn').forEach(b=> b.addEventListener('click', ()=> showTab(b.getAttribute('data-tab'))));
  
  document.querySelectorAll('.sidebar nav a').forEach(a=>{
    a.addEventListener('click', (e)=>{
      const t = a.getAttribute('data-tab');
      if (t) {
        e.preventDefault();
        showTab(t);
        // Tự động đóng nav trên mobile
        if (window.innerWidth < 768) {
            el('adminSidebar').classList.remove('active');
            el('popupOverlay').style.display = 'none';
        }
      }
    });
  });

  const uSearch = el('usersSearch'); if(uSearch) uSearch.addEventListener('keyup', debounce(()=> loadData(), 400));
  const rSearch = el('roomsSearch'); if(rSearch) rSearch.addEventListener('keyup', debounce(()=> loadData(), 400));
  
  el('userForm') && el('userForm').addEventListener('submit', saveUser);
  el('roomForm') && el('roomForm').addEventListener('submit', saveRoom);
  el('gameForm') && el('gameForm').addEventListener('submit', saveGame);
  
  // (Sự kiện click overlay đã được gán ở setupNavToggle)

  const addGameBtn = document.querySelector('button[onclick="openGameForm(null)"]');
  if (addGameBtn) { addGameBtn.onclick = () => openGameForm(null); }
  
  const addUserBtn = document.querySelector('button[onclick="openUserForm(null)"]');
  if (addUserBtn) { addUserBtn.onclick = () => openUserForm(null); }

  const addRoomBtn = document.querySelector('button[onclick="openRoomForm()"]');
  if(addRoomBtn) { addRoomBtn.onclick = async () => { 
      if(allGamesCache.length === 0) await fetchGames(); // Đảm bảo đã tải game
      populateGameOptions(); 
      openRoomForm(null); 
  }; }

  // Gán sự kiện cho thanh confirm
  el('btnConfirmChanges').addEventListener('click', executePendingChanges);
  el('btnCancelChanges').addEventListener('click', cancelPendingChanges);
  
  // Gán sự kiện cho nút sync
  el('btnSyncGames').addEventListener('click', syncGames);
  
  // Gán sự kiện logout
  el('btnLogout').addEventListener('click', logoutAdmin);

  // Gán sự kiện toggle nav
  setupNavToggle();

  showTab('gamesTab');
  loadData();
});