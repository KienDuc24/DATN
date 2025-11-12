// public/admin.js

const ADMIN_API = 'https://datn-socket.up.railway.app'; 
let allGamesCache = []; // Cache để lấy thông tin game
let pendingChanges = []; // Hàng chờ thay đổi

// --- THÊM MỚI: Kết nối Socket Admin ---
try {
  const socket = io(ADMIN_API, { path: '/socket.io', withCredentials: true });
  socket.on('connect', () => {
    console.log('Admin socket connected');
  });
  socket.on('admin-rooms-changed', () => {
    console.log('Admin: Rooms changed, reloading data...');
    loadData();
  });
  socket.on('admin-users-changed', () => {
    console.log('Admin: Users changed, reloading data...');
    loadData();
  });
  socket.on('admin-games-changed', () => {
      console.log('Admin: Games changed, reloading data...');
      loadData();
  });
  socket.on('admin-user-status-changed', () => {
    console.log('Admin: User status changed, reloading data...');
    loadData();
  });
} catch (e) {
  console.error("Socket.IO connection failed.", e);
}
// ------------------------------------

function el(id){return document.getElementById(id);}
// ... (các hàm tiện ích giữ nguyên) ...
function showOverlay(show){ el('popupOverlay').style.display = show ? 'block' : 'none'; }
function debounce(fn,wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }
if (typeof escapeHtml === 'undefined') {
  window.escapeHtml = function(s){
    return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  };
}

// --- LOGIC THANH XÁC NHẬN (MỚI) ---
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
  // Xóa các thay đổi cũ cho cùng 1 ID (nếu có)
  pendingChanges = pendingChanges.filter(c => c.id !== change.id);
  // Thêm thay đổi mới
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
            
            // --- THÊM DÒNG NÀY ---
            // Sửa lỗi: server route cho 'game' là 'games' (số nhiều)
            // trong khi 'user' và 'room' là số ít.
            const resourceType = (type === 'game') ? 'games' : type;
            // ---------------------

            let res;
            if (action === 'delete') {
                // SỬA: dùng resourceType
                res = await fetch(`${ADMIN_API}/api/admin/${resourceType}/${id}`, { method: 'DELETE', credentials: 'include' });
            } else if (action === 'save') {
                const method = id ? 'PUT' : 'POST';
                // SỬA: dùng resourceType
                const url = id ? `${ADMIN_API}/api/admin/${resourceType}/${id}` : `${ADMIN_API}/api/admin/${resourceType}`;
                res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
            } else if (action === 'update') { // Dùng cho "featured"
                // SỬA: dùng resourceType (Đây là cái bị lỗi của bạn)
                 res = await fetch(`${ADMIN_API}/api/admin/${resourceType}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
            }
            if (!res || !res.ok) throw new Error(await res.text());
            
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
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sidebar nav a').forEach(a=>a.classList.remove('active'));
  
  const tab = el(tabId);
  if(tab) tab.style.display = '';
  
  document.querySelectorAll('.tab-btn').forEach(b=>{ if(b.getAttribute('data-tab')===tabId) b.classList.add('active') });
  document.querySelectorAll('.sidebar nav a').forEach(a=>{ if(a.getAttribute('data-tab')===tabId) a.classList.add('active') });
}

// --- HÀM fetchApi ĐÃ SỬA LỖI VÀ THÊM LOGS ---
async function fetchApi(url) {
    console.log(`[fetchApi] Đang gọi: ${url}`);
    const res = await fetch(url, { credentials: 'include' }); 
    console.log(`[fetchApi] Phản hồi từ ${url}: Status ${res.status}, OK: ${res.ok}`);

    if (!res.ok) {
        let errorMessage = res.statusText;
        try {
            const errorData = await res.json(); 
            if (errorData && errorData.message) {
                errorMessage = errorData.message;
            } else {
                const text = await res.text();
                errorMessage = text || res.statusText;
            }
        } catch (e) {
            console.warn(`[fetchApi] Không thể đọc body lỗi dưới dạng JSON hoặc Text: ${e.message}`);
        }

        if (res.status === 401) {
            alert('Phiên đăng nhập hết hạn.');
            logoutAdmin();
        }
        console.error(`[fetchApi] Lỗi: ${errorMessage}`);
        throw new Error(errorMessage);
    }
    const jsonData = await res.json();
    console.log(`[fetchApi] Dữ liệu JSON nhận được từ ${url}:`, jsonData);
    return jsonData; 
}
// ------------------------------------

async function fetchUsers(q){
  const url = new URL(`${ADMIN_API}/api/admin/users`);
  if (q) url.searchParams.set('q', q);
  const j = await fetchApi(url.toString());
  return j.users || [];
}
async function fetchRooms(q){
  const url = new URL(`${ADMIN_API}/api/admin/rooms`);
  if (q) url.searchParams.set('q', q);
  const j = await fetchApi(url.toString());
  return j.rooms || [];
}
async function fetchGames(q){
  const url = new URL(`${ADMIN_API}/api/admin/games`);
  if (q) url.searchParams.set('q', q);
  const j = await fetchApi(url.toString());
  allGamesCache = j.games || []; // Cập nhật cache
  console.log('[fetchGames] allGamesCache đã cập nhật:', allGamesCache);
  return allGamesCache;
}

// --- Render (Đã sửa logic Status và thêm kiểm tra tbody) ---
function renderUsersTable(users){
  const tbody = el('adminUsersList');
  if (!tbody) { console.warn('adminUsersList tbody not found'); return; }
  tbody.innerHTML = '';
  if (!Array.isArray(users) || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center">Không có người dùng</td></tr>`;
    return;
  }
  users.forEach(u => {
    const id = u._id || u.id || '';
    const username = escapeHtml(u.username || u.displayName || '');
    let gh = '-';
    if (Array.isArray(u.gameHistory) && u.gameHistory.length) {
      gh = `Đã chơi ${u.gameHistory.length} game`;
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
    tr.id = `user-row-${id}`; // Thêm ID
    tr.innerHTML = `
      <td><div style="font-weight:600">${username}</div></td>
      <td>${escapeHtml(gh)}</td>
      <td><span style="color:${statusColor}; font-weight:600;">${escapeHtml(statusText)}</span></td>
      <td style="display:flex;gap:8px;align-items:center">
        <button class="icon-btn icon-edit" title="Sửa" data-id="${id}" aria-label="Sửa"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
        <button class="icon-btn icon-delete" title="Xóa" data-id="${id}" aria-label="Xóa"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.icon-edit').forEach(btn => btn.addEventListener('click', onEditUser));
  tbody.querySelectorAll('.icon-delete').forEach(btn => btn.addEventListener('click', onDeleteUser));
}

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
    const gameName = (r.game && (r.game.name || r.game.type)) ? (r.game.name || r.game.type) : (r.game || '');
    const owner = r.host || '';
    const participants = Array.isArray(r.players) ? r.players.map(p => p.name).join(', ') : '-';
    
    let status = r.status || 'open';
    if (status === 'open') status = 'Đang chờ';
    if (status === 'playing') status = 'Đang chơi';
    if (status === 'closed') status = 'Đã đóng';

    const tr = document.createElement('tr');
    tr.id = `room-row-${roomId}`; // Thêm ID
    tr.innerHTML = `
      <td><div style="font-weight:600">${escapeHtml(gameName)}</div></td>
      <td>${escapeHtml(String(roomId))}</td>
      <td>${escapeHtml(owner)}</td>
      <td style="max-width:360px">${escapeHtml(participants || '-')}</td>
      <td>${escapeHtml(status)}</td>
      <td style="display:flex;gap:6px">
        <button class="icon-btn icon-delete" title="Xóa" data-id="${escapeHtml(roomId)}" aria-label="Xóa"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
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
    const id = g.id || ''; // Đảm bảo lấy 'id' string ở đây
    const title = (g.name && (g.name.vi || g.name.en)) ? (g.name.vi || g.name.en) : (g.title || g.name || '');
    const desc = (g.desc && (g.desc.vi || g.desc.en)) ? (g.desc.vi || g.desc.en) : (g.desc || '');
    const category = (g.category && (g.category.vi || g.category.en)) ? (g.category.vi || g.category.en) : (g.category || '');
    const players = g.players || '';
    const featuredChecked = g.featured ? 'checked' : '';
    const tr = document.createElement('tr');
    tr.id = `game-row-${id}`; // Thêm ID
    tr.innerHTML = `
      <td>
        <div style="font-weight:600">${escapeHtml(title)}</div>
        <div style="color:var(--muted);font-size:12px">${escapeHtml(String(desc).slice(0,120))}</div>
      </td>
      <td>${escapeHtml(category)}</td>
      <td>${escapeHtml(players)}</td>
      <td style="text-align:center">
        <input type="checkbox" class="game-feature-checkbox" data-id="${escapeHtml(id)}" ${featuredChecked} aria-label="Nổi bật"/>
      </td>
      <td style="display:flex;gap:6px">
        <button class="icon-btn icon-edit" title="Sửa" data-id="${escapeHtml(id)}" aria-label="Sửa"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
        <button class="icon-btn icon-delete" title="Xóa" data-id="${escapeHtml(id)}" aria-label="Xóa"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.game-feature-checkbox').forEach(cb => cb.addEventListener('change', onFeatureGame));
  tbody.querySelectorAll('.icon-edit').forEach(b=>b.addEventListener('click', onEditGame));
  tbody.querySelectorAll('.icon-delete').forEach(b=>b.addEventListener('click', onDeleteGame));
}

// --- Handlers ---
function openUserForm(user){ 
  showOverlay(true); el('userFormPopup').style.display = 'block'; 
  el('userFormTitle').innerText = user ? 'Sửa người dùng' : 'Thêm người dùng'; 
  el('userId').value = user? user._id : ''; 
  el('userUsername').value = user? user.username : ''; 
  el('userEmail').value = user? user.email : ''; 
  el('userRole').value = user? user.role || 'user' : 'user'; 
}
function closeUserForm(){ el('userFormPopup').style.display='none'; showOverlay(false); }
async function onEditUser(e){ const id = e.currentTarget.dataset.id; try{ const users = await fetchUsers(); const u = users.find(x=>x._id===id); if(!u) return alert('User not found'); openUserForm(u); }catch(err){ console.error(err); alert('Lỗi'); } }

async function saveUser(e){ 
  e.preventDefault(); 
  const id = el('userId').value; 
  
  // ÁP DỤNG escapeHtml cho tất cả các trường nhập liệu từ form người dùng
  const payload = { 
    username: escapeHtml(el('userUsername').value.trim()), 
    email: escapeHtml(el('userEmail').value.trim()), 
    role: el('userRole').value // Giữ nguyên, vì đây là giá trị chọn (select)
  }; 
  
  if(!payload.username) return alert('Username không được để trống'); 

  addChange({ type: 'user', action: 'save', id: id, payload: payload });
  alert('Đã thêm thay đổi. Nhấn "Lưu thay đổi" để xác nhận.');
  closeUserForm(); 
}
async function onDeleteUser(e){ 
  const id = e.currentTarget.dataset.id; 
  if(!confirm('Xác nhận đưa user này vào hàng chờ xóa?')) return; 
  
  addChange({ type: 'user', action: 'delete', id: id });
  el(`user-row-${id}`).classList.add('row-to-be-deleted');
}

function openRoomForm(room){ 
  showOverlay(true); 
  el('roomFormPopup').style.display = 'block'; 
  el('roomFormTitle').innerText = room ? 'Sửa phòng' : 'Thêm phòng'; 
  el('roomId').value = room? (room.code || room.id || room._id || '') : ''; 
  el('roomName').value = room? (room.name || '') : ''; 
  const sel = el('roomGame');
  const gameId = room ? ( (room.game && (room.game.id || room.game.name || room.game.type)) || room.game || room.gameName ) : '';
  if(sel) sel.value = gameId || '';
  el('roomOwner').value = room? (room.owner || room.host || '') : ''; 
  el('roomStatus').value = room? (room.status || 'Đang chờ') : 'Đang chờ'; 
}
function closeRoomForm(){ el('roomFormPopup').style.display='none'; showOverlay(false); }
async function onEditRoom(e){ const id = e.currentTarget.dataset.id; try{ const rooms = await fetchRooms(); const r = rooms.find(x=>x.code===id); if(!r) return alert('Room not found'); openRoomForm(r); }catch(err){ console.error(err); alert('Lỗi'); } }

async function saveRoom(e){
  e.preventDefault();
  
  // ÁP DỤNG escapeHtml cho ID phòng và các giá trị form
  const id = escapeHtml(el('roomId').value.trim()); 
  const idOrig = el('roomIdOrig').value.trim();
  
  if (!id) return alert('Room ID không được để trống');
  
  const payload = {
    id: id,
    gameId: escapeHtml(el('roomGameId').value.trim()), // Game ID
    password: escapeHtml(el('roomPassword').value), // Mật khẩu (nếu có)
    host: escapeHtml(el('roomHost').value.trim()),   // Host
    status: el('roomStatus').value,                  // Status (select/dropdown)
    participantsCount: el('roomParticipantsCount').value.trim() // Số lượng người chơi
  };

  if(!payload.gameId) return alert('Game ID không được để trống');

  const action = idOrig ? 'update' : 'save';
  addChange({ type: 'room', action: action, id: id, payload: payload, idOrig: idOrig });
  alert('Đã thêm thay đổi. Nhấn "Lưu thay đổi" để xác nhận.');
  closeRoomForm();
}
async function onDeleteRoom(e){ 
  const id = e.currentTarget.dataset.id; // Room ID là 'code'
  if(!confirm('Xác nhận đưa phòng này vào hàng chờ xóa?')) return; 

  addChange({ type: 'room', action: 'delete', id: id });
  el(`room-row-${id}`).classList.add('row-to-be-deleted');
}

function openGameForm(game){
  showOverlay(true);
  el('gameFormPopup').style.display = 'block';
  el('gameFormTitle').innerText = game ? 'Sửa trò chơi' : 'Thêm trò chơi';
  el('gameIdOrig').value = game ? (game.id || '') : '';
  el('gameId').value = game ? (game.id || '') : '';
  el('gameNameVI').value = (game && game.name && game.name.vi) ? game.name.vi : '';
  el('gameNameEN').value = (game && game.name && game.name.en) ? game.name.en : '';
  el('gameDescVI').value = (game && game.desc && game.desc.vi) ? game.desc.vi : '';
  el('gameDescEN').value = (game && game.desc && game.desc.en) ? game.desc.en : '';
  el('gamePlayers').value = game ? (game.players||'') : '';
  el('gameCatVI').value = (game && game.category && game.category.vi) ? game.category.vi : '';
  el('gameCatEN').value = (game && game.category && game.category.en) ? game.category.en : '';
}
function closeGameForm(){ el('gameFormPopup').style.display='none'; showOverlay(false); }
async function onEditGame(e){
  const id = e.currentTarget.dataset.id;
  const g = allGamesCache.find(x => (x.id||x._id) === id); // Thêm x._id để phòng hờ
  if (!g) return alert('Game not found');
  openGameForm(g);
}
async function saveGame(e){
  e.preventDefault();
  
  // ÁP DỤNG escapeHtml cho ID game
  const id = escapeHtml(el('gameId').value.trim()); 
  const idOrig = el('gameIdOrig').value.trim();
  
  if (!id) return alert('Game ID không được để trống');
  
  // ÁP DỤNG escapeHtml cho tất cả các trường trong payload
  const payload = {
    id: id, // Đã được escapeHtml ở trên
    name: { 
      vi: escapeHtml(el('gameNameVI').value.trim()), 
      en: escapeHtml(el('gameNameEN').value.trim()) 
    },
    desc: { 
      vi: escapeHtml(el('gameDescVI').value.trim()), 
      en: escapeHtml(el('gameDescEN').value.trim()) 
    },
    players: escapeHtml(el('gamePlayers').value.trim()),
    category: { 
      vi: escapeHtml(el('gameCatVI').value.trim()), 
      en: escapeHtml(el('gameCatEN').value.trim()) 
    }
  };
  
  const action = idOrig ? 'update' : 'save';
  addChange({ type: 'game', action: action, id: id, payload: payload, idOrig: idOrig });
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
  
  console.log('--- Debug onFeatureGame ---');
  console.log('gameUniqueId từ checkbox (data-id):', id);
  console.log('Giá trị checked:', checked);
  console.log('allGamesCache hiện tại:', allGamesCache);

  const originalGame = allGamesCache.find(g => g.id === id); // Chỉ tìm bằng 'id' string
  if (!originalGame) {
    console.error('Lỗi: Không tìm thấy game trong cache với ID:', id);
    return alert('Không tìm thấy game. Kiểm tra console để debug.');
  }
  
  console.log('Game tìm thấy trong cache:', originalGame);

  const payload = { ...originalGame, featured: !!checked };
  
  addChange({ type: 'game', action: 'update', id: id, payload: payload });
}

// +++ THÊM HÀM MỚI ĐỂ ĐỒNG BỘ GAMES.JSON +++
async function syncGames() {
    if (!confirm('Bạn có chắc muốn ĐỒNG BỘ (Cập nhật/Thêm mới) toàn bộ trò chơi từ tệp games.json không?\n\nHành động này sẽ thêm TẤT CẢ game vào hàng chờ "Lưu thay đổi".\n\n(Nó sẽ KHÔNG XÓA các game đang có trên database mà không có trong tệp .json)')) {
        return;
    }

    try {
        // 1. Lấy dữ liệu từ file games.json tĩnh
        const resJson = await fetch('/games.json');
        if (!resJson.ok) {
            throw new Error(`Không thể tải tệp /games.json. Status: ${resJson.status}`);
        }
        const gamesData = await resJson.json();

        if (!Array.isArray(gamesData) || gamesData.length === 0) {
            return alert('Tệp games.json rỗng hoặc không hợp lệ.');
        }

        let addedCount = 0;
        // 2. THAY ĐỔI LOGIC:
        // Thay vì gọi /sync, chúng ta thêm từng game vào hàng chờ 'pendingChanges'
        for (const game of gamesData) {
            if (!game.id) {
                console.warn('Bỏ qua game không có ID:', game);
                continue;
            }
            
            // Sử dụng logic 'save' hiện có.
            // Chúng ta dùng 'id: game.id' để hàm executePendingChanges biết
            // là cần dùng 'PUT' (update) thay vì 'POST' (create).
            // Điều này giả định server của bạn xử lý "PUT /api/admin/game/:id" 
            // như một lệnh "update or create" (upsert).
            addChange({ 
                type: 'game', 
                action: 'save', 
                id: game.id, // Dùng ID của game để server biết cần PUT
                payload: game 
            });
            addedCount++;
        }

        alert(`Đã thêm ${addedCount} game vào hàng chờ.\n\nHãy nhấn "Lưu thay đổi" (màu xanh lá) để bắt đầu quá trình cập nhật lên database.`);
        
        // Không cần loadData() ngay, vì thay đổi chưa được thực thi

    } catch (err) {
        console.error('Lỗi khi chuẩn bị đồng bộ games:', err);
        alert(`Đã xảy ra lỗi: ${err.message}`);
    }
}

function logoutAdmin(){ 
  fetch(`${ADMIN_API}/admin/logout`, {method:'POST', credentials: 'include'})
    .finally(()=> location.href='/admin-login.html'); 
}

async function loadData(){
  // ... (hàm giữ nguyên) ...
  try{
    const usersQ = el('usersSearch') && el('usersSearch').value.trim();
    const roomsQ = el('roomsSearch') && el('roomsSearch').value.trim();

    const [usersRes, roomsRes, gamesRes] = await Promise.all([
        fetchApi(`${ADMIN_API}/api/admin/users${usersQ?('?q='+encodeURIComponent(usersQ)) : ''}`),
        fetchApi(`${ADMIN_API}/api/admin/rooms${roomsQ?('?q='+encodeURIComponent(roomsQ)) : ''}`),
        fetchApi(`${ADMIN_API}/api/admin/games`)
    ]);
    allGamesCache = gamesRes.games || [];

    renderUsersTable(usersRes.users || []);
    renderRoomsTable(roomsRes.rooms || []);
    renderGamesTable(allGamesCache);
  } catch (err) {
    console.error('loadData error:', err);
  }
}

async function populateGameOptions(){
  // ... (hàm giữ nguyên) ...
  const sel = el('roomGame');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Chọn trò chơi --</option>';
  try{
    const res = await fetch(`/games.json`); 
    if(!res.ok) return console.warn('games.json fetch failed', res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data.games) ? data.games : []);
    list.forEach(g=>{
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

document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.tab-btn').forEach(b=> b.addEventListener('click', ()=> showTab(b.getAttribute('data-tab'))));
  
  // SỬA LẠI LOGIC NÀY
  document.querySelectorAll('.sidebar nav a').forEach(a=>{
    a.addEventListener('click', (e)=>{
      const t = a.getAttribute('data-tab');
      if (t) { // Nếu có 'data-tab' (tức là không phải link 'Trang chủ')
        showTab(t);
        e.preventDefault(); // Ngăn hành vi link mặc định
      }
      // Nếu không có 'data-tab', nó sẽ là một link bình thường (href="/")
    });
  });

  const uSearch = el('usersSearch'); if(uSearch) uSearch.addEventListener('keyup', debounce(()=> loadData(), 400));
  const rSearch = el('roomsSearch'); if(rSearch) rSearch.addEventListener('keyup', debounce(()=> loadData(), 400));
  
  el('userForm') && el('userForm').addEventListener('submit', saveUser);
  el('roomForm') && el('roomForm').addEventListener('submit', saveRoom);
  el('gameForm') && el('gameForm').addEventListener('submit', saveGame);
  
  el('popupOverlay').addEventListener('click', ()=>{ closeUserForm(); closeRoomForm(); closeGameForm(); });

  const addGameBtn = document.querySelector('button[onclick="openGameForm(null)"]');
  if (addGameBtn) { addGameBtn.onclick = () => openGameForm(null); }
  const addRoomBtn = document.querySelector('button[onclick="openRoomForm()"]');
  if(addRoomBtn) { addRoomBtn.onclick = () => { populateGameOptions(); openRoomForm(null); }; }

  showTab('gamesTab');
  loadData();
  populateGameOptions();
});