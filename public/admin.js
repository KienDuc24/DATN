// public/admin.js (ĐÃ SỬA LỖI MẤT DỮ LIỆU GAME KHI CẬP NHẬT)

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
            
            const resourceType = (type === 'game') ? 'games' : type;

            let res;
            if (action === 'delete') {
                res = await fetch(`${ADMIN_API}/api/admin/${resourceType}/${id}`, { method: 'DELETE', credentials: 'include' });
            } else if (action === 'save' || action === 'update') {
                
                // --- SỬA LỖI LOGIC HTTP METHOD TẠI ĐÂY ---
                let method = 'PUT'; // Mặc định là PUT (cập nhật)
                let url = `${ADMIN_API}/api/admin/${resourceType}/${id}`;
                
                if (action === 'save' && id) {
                    // Nếu là SAVE (tạo mới) VÀ có ID nghiệp vụ (như Draw), ta vẫn dùng PUT (Upsert)
                    // (Giả định Backend xử lý PUT /games/ID là Upsert)
                    method = 'PUT'; 
                } else if (action === 'save' && !id) {
                    // Nếu là SAVE (tạo mới) và không có ID, ta dùng POST
                    method = 'POST';
                    url = `${ADMIN_API}/api/admin/${resourceType}`;
                } else if (action === 'update') {
                    // Nếu là Update, dùng PUT (cập nhật tài liệu hiện có)
                    method = 'PUT';
                    url = `${ADMIN_API}/api/admin/${resourceType}/${id}`;
                }
                // ------------------------------------------

                res = await fetch(url, {
                    method: method,
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
  
  // GỌI HÀM CHECK ANALYTICS STATUS (nếu muốn)
  if (tabId === 'analyticsTab') {
    // Nếu bạn muốn hiển thị lại trạng thái tích hợp script tĩnh, hãy uncomment hàm này
    // checkAnalyticsStatus(); 
  }
}

// --- HÀM checkAnalyticsStatus (GIỮ CHỖ) ---
function checkAnalyticsStatus() {
    const scriptStatusEl = el('analyticsScriptStatus');
    const idInput = el('vercelAnalyticsId');
    if (!scriptStatusEl || !idInput) return;
    
    // Logic kiểm tra script
    const isLoaded = document.querySelector('script[src*="/_vercel/insights/script.js"]');
    
    if (isLoaded) {
        scriptStatusEl.textContent = 'ĐÃ TÍCH HỢP';
        scriptStatusEl.style.color = '#22c55e'; // var(--success)
        const sdId = isLoaded.getAttribute('data-sd-id');
        if (sdId) {
            idInput.value = sdId;
        }
    } else {
        scriptStatusEl.textContent = 'CHƯA TÌM THẤY';
        scriptStatusEl.style.color = '#ef4444'; // var(--danger)
        idInput.value = '';
    }
}
// ---------------------------------------

// --- HÀM fetchApi (Giữ nguyên) ---
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
    const username = u.username || u.displayName || ''; 
    let gh = '-';
    if (Array.isArray(u.playHistory) && u.playHistory.length) { // <-- ĐÃ SỬA: dùng playHistory
      gh = `Đã chơi ${u.playHistory.length} game`; // <-- ĐÃ SỬA: dùng playHistory
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
    tr.innerHTML = `
      <td><div style="font-weight:600">${username}</div></td>
      <td>${gh}</td>
      <td><span style="color:${statusColor}; font-weight:600;">${statusText}</span></td>
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
    tr.id = `room-row-${roomId}`;
    tr.innerHTML = `
      <td><div style="font-weight:600">${gameName}</div></td>
      <td>${String(roomId)}</td>
      <td>${owner}</td>
      <td style="max-width:360px">${participants || '-'}</td>
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
        <div style="color:var(--muted);font-size:12px">${String(desc).slice(0,120)}</div>
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
  
  const payload = { 
    username: el('userUsername').value.trim(), 
    email: el('userEmail').value.trim(), 
    role: el('userRole').value
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

// Hàm openRoomForm
function openRoomForm(room){ 
  showOverlay(true); 
  el('roomFormPopup').style.display = 'block'; 
  el('roomFormTitle').innerText = room ? 'Sửa phòng' : 'Thêm phòng'; 
  
  el('roomId').value = room? (room.code || room.id || room._id || '') : ''; 
  
  el('roomName').value = room? (room.name || '') : ''; 
  const sel = el('roomGame');
  const gameId = room ? ( (room.game && (room.game.id || room.game.type)) || '' ) : '';
  if(sel) sel.value = gameId || '';
  
  el('roomOwner').value = room? (room.owner || room.host || '') : ''; 
  el('roomStatus').value = room? (room.status || 'Đang chờ') : 'Đang chờ'; 
}
function closeRoomForm(){ el('roomFormPopup').style.display='none'; showOverlay(false); }
async function onEditRoom(e){ const id = e.currentTarget.dataset.id; try{ const rooms = await fetchRooms(); const r = rooms.find(x=>x.code===id); if(!r) return alert('Room not found'); openRoomForm(r); }catch(err){ console.error(err); alert('Lỗi'); } }

// Hàm saveRoom
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
    
    game: { 
        id: selGame.value, 
        name: gameName, 
        type: selGame.value 
    }
  };

  const action = id ? 'update' : 'save';
  addChange({ type: 'room', action: action, id: id, payload: payload }); 
  
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
  el('gameId').value = game ? (game.id || '') : '';
}
function closeGameForm(){ el('gameFormPopup').style.display='none'; showOverlay(false); }
async function onEditGame(e){
  const id = e.currentTarget.dataset.id;
  const g = allGamesCache.find(x => (x.id||x._id) === id);
  if (!g) return alert('Game not found');
  openGameForm(g);
}
async function saveGame(e){
  e.preventDefault();
  const id = el('gameId').value.trim(); 
  const idOrig = el('gameIdOrig').value.trim();
  
  if (!id) return alert('Game ID không được để trống');
  
  // KHỞI TẠO PAYLOAD TỪ GAME GỐC ĐỂ TRÁNH MẤT DỮ LIỆU
  let payload = {};
  if (idOrig) {
      const original = allGamesCache.find(g => g.id === idOrig);
      if (original) {
          payload = { ...original }; // Giữ lại TẤT CẢ thông tin gốc
          if (id !== idOrig) payload.id = id; 
      }
  }

  // GHI ĐÈ các trường từ form
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
  if (typeof payload.featured === 'undefined') {
       payload.featured = false;
  }

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

  const originalGame = allGamesCache.find(g => g.id === id);
  if (!originalGame) {
    console.error('Lỗi: Không tìm thấy game trong cache với ID:', id);
    return alert('Không tìm thấy game. Kiểm tra console để debug.');
  }
  
  console.log('Game tìm thấy trong cache:', originalGame);

  // Đảm bảo payload là game gốc + trường featured mới
  const payload = { ...originalGame, featured: !!checked };
  
  addChange({ type: 'game', action: 'update', id: id, payload: payload });
}

// +++ THÊM HÀM MỚI ĐỂ ĐỒNG BỘ GAMES.JSON +++
async function syncGames() {
    if (!confirm('Bạn có chắc muốn ĐỒNG BỘ (Cập nhật/Thêm mới) toàn bộ trò chơi từ tệp games.json lên Database không?\n\nHành động này sẽ được thực thi ngay lập tức.')) {
        return;
    }

    try {
        // 1. Lấy dữ liệu từ file games.json tĩnh
        const resJson = await fetch('/games.json'); 
        if (!resJson.ok) {
            throw new Error(`Không thể tải tệp /games.json. Status: ${resJson.status}`);
        }
        const gamesData = await resJson.json(); // Đây là mảng [ { game1 }, { game2 } ]

        if (!Array.isArray(gamesData) || gamesData.length === 0) {
            return alert('Tệp games.json rỗng hoặc không hợp lệ.');
        }

        // 2. GỌI ENDPOINT SYNC CỦA BACKEND
        const resSync = await fetch(`${ADMIN_API}/api/admin/games/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(gamesData) // Gửi toàn bộ mảng game lên
        });

        const result = await resSync.json();

        if (!resSync.ok) {
            throw new Error(result.message || 'Lỗi từ server khi đồng bộ');
        }

        alert(`Đồng bộ hoàn tất!\nĐã cập nhật: ${result.updated}\nĐã tạo mới: ${result.created}`);
        
        // 3. Tải lại dữ liệu (vì socket 'admin-games-changed' có thể chưa kịp chạy)
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
  
  document.querySelectorAll('.sidebar nav a').forEach(a=>{
    a.addEventListener('click', (e)=>{
      const t = a.getAttribute('data-tab');
      if (t) {
        showTab(t);
        e.preventDefault();
      }
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