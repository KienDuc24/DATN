// public/admin.js
const ADMIN_API = ''; // SỬA: Dùng relative path

function el(id){return document.getElementById(id);}
function showOverlay(show){ el('popupOverlay').style.display = show ? 'block' : 'none'; }

// Hàm debounce (bị thiếu trong code gốc)
function debounce(fn,wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }

// Hàm escape (để an toàn)
if (typeof escapeHtml === 'undefined') {
  window.escapeHtml = function(s){
    return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  };
}

// TAB switch
function showTab(tabId){
  document.querySelectorAll('.admin-tab-content').forEach(e=>e.style.display='none');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sidebar nav a').forEach(a=>a.classList.remove('active')); // Thêm
  
  const tab = el(tabId);
  if(tab) tab.style.display = '';
  
  document.querySelectorAll('.tab-btn').forEach(b=>{ if(b.getAttribute('data-tab')===tabId) b.classList.add('active') });
  document.querySelectorAll('.sidebar nav a').forEach(a=>{ if(a.getAttribute('data-tab')===tabId) a.classList.add('active') }); // Thêm
}

// --- Helpers Fetch (đã sửa đường dẫn) ---
async function fetchApi(url) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) {
    // Nếu bị 401 (hết hạn token), tự động logout
    if (res.status === 401) {
        alert('Phiên đăng nhập hết hạn.');
        logoutAdmin();
    }
    const txt = await res.text().catch(()=>'');
    throw new Error(txt || res.statusText);
  }
  return res.json();
}
async function fetchUsers(q){
  const url = new URL(`${ADMIN_API}/api/admin/users`, window.location.origin);
  if (q) url.searchParams.set('q', q);
  const j = await fetchApi(url.toString());
  return j.users || [];
}
async function fetchRooms(q){
  const url = new URL(`${ADMIN_API}/api/admin/rooms`, window.location.origin);
  if (q) url.searchParams.set('q', q);
  const j = await fetchApi(url.toString());
  return j.rooms || [];
}
async function fetchGames(q){
  const url = new URL(`${ADMIN_API}/api/admin/games`, window.location.origin);
  if (q) url.searchParams.set('q', q);
  const j = await fetchApi(url.toString());
  return j.games || [];
}

// --- Render Users ---
function renderUsersTable(users){
  const tbody = document.getElementById('adminUsersList');
  if (!tbody) return;
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
    let status = u.isOnline ? 'Online' : 'Offline';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div style="font-weight:600">${username}</div></td>
      <td>${escapeHtml(gh)}</td>
      <td>${escapeHtml(status)}</td>
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

// --- Render Rooms ---
function renderRoomsTable(rooms){
  const tbody = document.getElementById('adminRoomsList');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!Array.isArray(rooms) || rooms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">Không có phòng chơi</td></tr>`;
    return;
  }
  rooms.forEach(r => {
    const roomId = r.code || r.id || r._id || '';
    const gameName = (r.game && r.game.name) ? r.game.name : (r.game || '');
    const owner = r.host || '';
    const participants = Array.isArray(r.players) ? r.players.map(p => p.name).join(', ') : '-';
    const status = r.status || '-';
    const tr = document.createElement('tr');
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

// --- Render Games ---
function renderGamesTable(games){
  const tbody = document.getElementById('adminGamesList');
  if (!tbody) return;
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

// --- Handlers (Sự kiện) ---

// User Handlers
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
  const payload = { username: el('userUsername').value.trim(), email: el('userEmail').value.trim(), role: el('userRole').value }; 
  if(!payload.username) return alert('Username không được để trống'); 
  try{ 
    const res = await fetch(`${ADMIN_API}/api/admin/user/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) }); 
    if(!res.ok){ const txt = await res.text(); throw new Error(txt||res.status); } 
    alert('Cập nhật người dùng thành công'); 
    closeUserForm(); 
    loadData(); 
  }catch(err){ console.error(err); alert('Cập nhật thất bại: '+ (err.message||err)); } 
}
async function onDeleteUser(e){ 
  const id = e.currentTarget.dataset.id; 
  if(!confirm('Xác nhận xóa user?')) return; 
  try{ 
    const res = await fetch(`${ADMIN_API}/api/admin/user/${id}`, { method:'DELETE', credentials:'same-origin' }); 
    if(!res.ok) throw new Error('delete failed'); 
    alert('Đã xóa user'); 
    loadData(); 
  }catch(err){ console.error(err); alert('Xóa thất bại'); } 
}

// Room Handlers
function openRoomForm(room){ 
  showOverlay(true); 
  el('roomFormPopup').style.display = 'block'; 
  el('roomFormTitle').innerText = room ? 'Sửa phòng' : 'Thêm phòng'; 
  el('roomId').value = room? (room._id || room.id || '') : ''; 
  el('roomName').value = room? (room.name || '') : ''; 
  const sel = el('roomGame');
  const gameId = room ? ( (room.game && (room.game.id || room.game.name || room.game.title)) || room.game || room.gameName ) : '';
  if(sel) sel.value = gameId || '';
  el('roomOwner').value = room? (room.owner || room.host || '') : ''; 
  el('roomStatus').value = room? (room.status || 'Đang mở') : 'Đang mở'; 
}
function closeRoomForm(){ el('roomFormPopup').style.display='none'; showOverlay(false); }
async function onEditRoom(e){ const id = e.currentTarget.dataset.id; try{ const rooms = await fetchRooms(); const r = rooms.find(x=>x._id===id); if(!r) return alert('Room not found'); openRoomForm(r); }catch(err){ console.error(err); alert('Lỗi'); } }
async function saveRoom(e){
  e.preventDefault();
  const id = el('roomId').value;
  const payload = {
    name: el('roomName').value.trim(),
    owner: el('roomOwner').value.trim(),
    status: el('roomStatus').value
  };
  const sel = el('roomGame');
  if (sel) {
    const selVal = sel.value;
    if(!selVal) return alert('Vui lòng chọn trò chơi cho phòng.');
    const selText = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : selVal;
    payload.game = { id: selVal, name: selText };
  } else {
    payload.game = el('roomGame').value.trim();
  }
  if(!payload.name) return alert('Tên phòng không được để trống');
  try{
    let res;
    if(id){
      res = await fetch(`${ADMIN_API}/api/admin/room/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
    } else {
      res = await fetch(`${ADMIN_API}/api/admin/room`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
    }
    if(!res.ok){ const txt = await res.text().catch(()=>null); throw new Error(txt||res.status); }
    alert('Phòng lưu thành công');
    closeRoomForm();
    loadData();
  }catch(err){ console.error(err); alert('Cập nhật thất bại: ' + (err.message || err)); }
}
async function onDeleteRoom(e){ 
  const id = e.currentTarget.dataset.id; // Room ID là 'code'
  if(!confirm('Xác nhận xóa phòng?')) return; 
  try{ 
    const res = await fetch(`${ADMIN_API}/api/admin/room/${id}`, { method:'DELETE', credentials:'same-origin' }); 
    if(!res.ok) throw new Error('delete failed'); 
    alert('Đã xóa phòng'); 
    loadData(); 
  }catch(err){ console.error(err); alert('Xóa thất bại'); } 
}

// Game Handlers
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
  try{
    const games = await fetchGames();
    const g = games.find(x => (x.id||x._id) === id);
    if (!g) return alert('Game not found');
    openGameForm(g);
  }catch(err){ console.error(err); alert('Lỗi'); }
}
async function saveGame(e){
  e.preventDefault();
  const orig = el('gameIdOrig').value;
  const id = el('gameId').value.trim();
  if (!id) return alert('ID không được để trống');
  const payload = {
    id,
    name: { vi: el('gameNameVI').value.trim(), en: el('gameNameEN').value.trim() },
    desc: { vi: el('gameDescVI').value.trim(), en: el('gameDescEN').value.trim() },
    players: el('gamePlayers').value.trim(),
    category: { vi: el('gameCatVI').value.trim(), en: el('gameCatEN').value.trim() }
  };
  try{
    let res;
    if (orig) {
      res = await fetch(`${ADMIN_API}/api/admin/games/${encodeURIComponent(orig)}`, {
        method: 'PUT', credentials:'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    } else {
      res = await fetch(`${ADMIN_API}/api/admin/games`, {
        method: 'POST', credentials:'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    }
    if (!res.ok) { const txt = await res.text().catch(()=>null); throw new Error(txt || res.status); }
    alert('Lưu thành công');
    closeGameForm();
    loadData();
  }catch(err){ console.error(err); alert('Lưu thất bại: ' + (err.message||err)); }
}
async function onDeleteGame(e){
  const id = e.currentTarget.dataset.id;
  if (!confirm('Xác nhận xóa trò chơi này?')) return;
  try{
    const res = await fetch(`${ADMIN_API}/api/admin/games/${encodeURIComponent(id)}`, { method: 'DELETE', credentials:'same-origin' });
    if (!res.ok) throw new Error('delete failed');
    alert('Đã xóa trò chơi');
    loadData();
  }catch(err){ console.error(err); alert('Xóa thất bại'); }
}
async function onFeatureGame(e) {
  const cbEl = e.currentTarget;
  const id = cbEl.dataset.id;
  const checked = cbEl.checked;
  cbEl.disabled = true;
  try {
    // SỬA: API này không tồn tại, nhưng logic trong adminRoutes.js CÓ TỒN TẠI
    // Chúng ta sẽ gọi PUT /api/admin/games/:id
    await fetch(`${ADMIN_API}/api/admin/games/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !!checked }) // Chỉ cập nhật trường 'featured'
    });
  } catch (err) {
    console.error('update featured failed', err);
    alert('Không thể cập nhật: ' + (err.message || err));
    try { cbEl.checked = !checked; } catch(e2){ console.warn('revert failed', e2); }
  } finally {
    cbEl.disabled = false;
  }
}

// Logout
function logoutAdmin(){ 
  fetch('/admin/logout', {method:'POST', credentials:'same-origin'})
    .finally(()=> location.href='/admin-login.html'); 
}

// --- Load Data ---
async function loadData(){
  try{
    const usersQ = el('usersSearch') && el('usersSearch').value.trim();
    const roomsQ = el('roomsSearch') && el('roomsSearch').value.trim();

    const [usersRes, roomsRes, gamesRes] = await Promise.all([
        fetchApi(`${ADMIN_API}/api/admin/users${usersQ?('?q='+encodeURIComponent(usersQ)) : ''}`),
        fetchApi(`${ADMIN_API}/api/admin/rooms${roomsQ?('?q='+encodeURIComponent(roomsQ)) : ''}`),
        fetchApi(`${ADMIN_API}/api/admin/games`)
    ]);

    renderUsersTable(usersRes.users || []);
    renderRoomsTable(roomsRes.rooms || []);
    renderGamesTable(gamesRes.games || []);
  } catch (err) {
    console.error('loadData error:', err);
    alert('Không thể tải dữ liệu admin: ' + (err.message || err));
  }
}

async function populateGameOptions(){
  const sel = el('roomGame');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Chọn trò chơi --</option>';
  try{
    // SỬA: Lấy games.json từ trang chủ
    const res = await fetch(`/games.json`, { credentials: 'same-origin' });
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

// --- Khởi tạo (DOM Ready) ---
document.addEventListener('DOMContentLoaded', ()=>{
  // Gán sự kiện
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

  const addGameBtn = document.querySelector('button[onclick="openGameForm()"]');
  if (addGameBtn) { addGameBtn.onclick = () => openGameForm(null); }
  const addRoomBtn = document.querySelector('button[onclick="openRoomForm()"]');
  if(addRoomBtn) { addRoomBtn.onclick = () => { populateGameOptions(); openRoomForm(null); }; }

  // Tải dữ liệu
  showTab('gamesTab'); // Bắt đầu ở tab Games
  loadData();
  populateGameOptions();
});