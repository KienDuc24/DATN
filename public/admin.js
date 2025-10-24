// Admin frontend: fetch data from /api/*, edit modal UI, delete actions.
// Use configured BASE_API_URL if set, otherwise default to current origin (no trailing slash)
const ADMIN_API = (typeof window.BASE_API_URL === 'string' && window.BASE_API_URL.trim())
  ? String(window.BASE_API_URL).replace(/\/+$/,'')
  : window.location.origin.replace(/\/+$/,'');

function el(id){return document.getElementById(id);}
function showOverlay(show){ el('popupOverlay').style.display = show ? 'block' : 'none'; }

// TAB switch
function showTab(tabId){
  document.querySelectorAll('.admin-tab-content').forEach(e=>e.style.display='none');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  const tab = el(tabId);
  if(tab) tab.style.display = '';
  document.querySelectorAll('.tab-btn').forEach(b=>{ if(b.getAttribute('data-tab')===tabId) b.classList.add('active') });
}

// -- new helper: fetch, parse body (json/text) and throw Error with status+body on non-ok
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const txt = await res.text().catch(() => null);
  let parsed = txt;
  try { parsed = txt ? JSON.parse(txt) : null; } catch(e) { /* keep raw text */ }
  if (!res.ok) {
    const bodyMsg = (typeof parsed === 'string') ? parsed : (parsed ? JSON.stringify(parsed) : '<no body>');
    const err = new Error(`HTTP ${res.status} ${res.statusText} - ${bodyMsg}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

// helper: try a list endpoint variants (plural/singular, with/without /api, absolute/relative)
async function tryFetchListVariants(endpointBase, q) {
  const qstr = q ? ('?q=' + encodeURIComponent(q)) : '';
  const candidates = [];
  const name = endpointBase.replace(/^\//,'');
  const variants = [name, name.endsWith('s') ? name.slice(0,-1) : (name + 's')];
  variants.forEach(v => {
    candidates.push(`${ADMIN_API}/api/${v}${qstr}`);
    candidates.push(`${ADMIN_API}/${v}${qstr}`);
    candidates.push(`/api/${v}${qstr}`);
    candidates.push(`/${v}${qstr}`);
  });
  const uniq = Array.from(new Set(candidates));
  console.debug('tryFetchListVariants will try:', uniq); // <-- thêm dòng debug
  let lastErr = null;
  for (const url of uniq) {
    try {
      const parsed = await fetchJson(url, { credentials: 'same-origin' });
      return parsed;
    } catch (err) {
      lastErr = err;
      // continue trying other variants
      console.debug('tryFetchListVariants candidate failed:', url, err && err.message);
    }
  }
  throw lastErr || new Error('No endpoints available: ' + uniq.join(','));
}

// Fetch helpers (use tryFetchListVariants)
async function fetchUsers(q){
  const j = await tryFetchListVariants('users', q);
  // support API returning { users: [...] } or plain array
  return Array.isArray(j) ? j : (j && j.users) ? j.users : [];
}
async function fetchRooms(q){
  const j = await tryFetchListVariants('rooms', q);
  return Array.isArray(j) ? j : (j && j.rooms) ? j.rooms : [];
}
async function fetchGames(q){
  const j = await tryFetchListVariants('games', q);
  return Array.isArray(j) ? j : (j && (j.games || j.items)) ? (j.games || j.items) : [];
}

// Add/modify functions for games CRUD via server API

// ensure escape helper exists
if (typeof escapeHtml === 'undefined') {
  window.escapeHtml = function(s){
    return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  };
}

// Render users table
function renderUsersTable(users){
  const tbody = document.getElementById('adminUsersList');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!Array.isArray(users) || users.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" style="padding:18px;color:var(--muted);text-align:center">Không có người dùng</td>`;
    tbody.appendChild(tr);
    return;
  }

  users.forEach(u => {
    const id = u._id || u.id || '';
    const username = escapeHtml(u.username || u.displayName || '');
    // gameHistory: show last 5 entries (if array), else show count or '-'
    let gh = '-';
    if (Array.isArray(u.gameHistory) && u.gameHistory.length) {
      const last = u.gameHistory.slice(-5).map(it => (typeof it === 'string' ? it : (it.name || it.id || JSON.stringify(it))));
      gh = `${last.join(', ')}${u.gameHistory.length > 5 ? ` (… +${u.gameHistory.length - 5})` : ''}`;
    } else if (typeof u.gameHistory === 'number') {
      gh = String(u.gameHistory);
    }

    // status heuristic: prefer explicit fields, fallback to '-'
    let status = '-';
    if (u.currentRoom) status = `Đang tham gia: ${escapeHtml(String(u.currentRoom))}`;
    else if (u.isOnline) status = 'Online';
    else status = 'Offline';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="min-width:220px"><div style="font-weight:600">${username}</div></td>
      <td style="max-width:480px;color:var(--muted);font-size:13px">${escapeHtml(gh)}</td>
      <td>${escapeHtml(status)}</td>
      <td style="display:flex;gap:8px;align-items:center">
        <button class="icon-btn icon-edit" title="Sửa" data-id="${id}" aria-label="Sửa">
          <!-- edit icon -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button class="icon-btn icon-delete" title="Xóa" data-id="${id}" aria-label="Xóa">
          <!-- delete icon -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // bind actions
  tbody.querySelectorAll('.icon-edit').forEach(btn => btn.addEventListener('click', onEditUser));
  tbody.querySelectorAll('.icon-delete').forEach(btn => btn.addEventListener('click', onDeleteUser));
  tbody.querySelectorAll('.icon-add').forEach(btn => btn.addEventListener('click', onAddUser));
}

// handlers: onAddUser uses existing user modal if present
function onAddUser(e){
  // open form modal to create new user
  if (typeof openUserForm === 'function') return openUserForm(null);
  alert('Chưa có form tạo user (openUserForm).');
}

// onEditUser and onDeleteUser assumed implemented earlier in file; if not, provide minimal fallback:
if (typeof onEditUser !== 'function'){
  async function onEditUser(e){
    const id = e.currentTarget.dataset.id;
    alert('Edit user not implemented on server for id=' + id);
  }
}
if (typeof onDeleteUser !== 'function'){
  async function onDeleteUser(e){
    const id = e.currentTarget.dataset.id;
    if (!confirm('Xác nhận xóa user?')) return;
    try {
      const res = await fetch(`${ADMIN_API}/api/user/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(txt || res.status);
      }
      alert('Đã xóa user');
      loadData();
    } catch (err) {
      console.error('delete user error', err);
      alert('Xóa thất bại: ' + (err.message || err));
    }
  }
}

// Render rooms table
function renderRoomsTable(rooms){
  const tbody = document.getElementById('adminRoomsList');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!Array.isArray(rooms) || rooms.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="padding:18px;color:var(--muted);text-align:center">Không có phòng chơi</td>`;
    tbody.appendChild(tr);
    return;
  }

  rooms.forEach(r => {
    // normalize fields - adapt to your DB shape
    const roomId = r.code || r.id || r._id || '';
    const gameName = (r.game && (r.game.name || r.game.title)) ? (r.game.name || r.game.title) : (r.game || r.gameName || '');
    const owner = (r.owner && (r.owner.username || r.owner.displayName)) ? (r.owner.username || r.owner.displayName) : (r.owner || r.ownerName || '');
    const participants = Array.isArray(r.participants) ? r.participants.map(p => (typeof p === 'string' ? p : (p.username || p.displayName || p.id))).join(', ') : (r.participants ? String(r.participants) : '-');
    const status = r.status || (r.isOpen ? 'Đang mở' : (r.isPlaying ? 'Đang chơi' : 'Đã đóng')) || '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="min-width:240px"><div style="font-weight:600">${escapeHtml(gameName)}</div></td>
      <td>${escapeHtml(String(roomId))}</td>
      <td>${escapeHtml(owner)}</td>
      <td style="max-width:360px;color:var(--muted);font-size:13px">${escapeHtml(participants || '-')}</td>
      <td>${escapeHtml(status)}</td>
      <td style="display:flex;gap:6px">
        <button class="icon-btn icon-edit" title="Sửa" data-id="${escapeHtml(roomId)}" aria-label="Sửa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button class="icon-btn icon-delete" title="Xóa" data-id="${escapeHtml(roomId)}" aria-label="Xóa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.icon-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      if (typeof onEditRoom === 'function') return onEditRoom(e);
      alert('Edit room handler not implemented');
    });
  });
  tbody.querySelectorAll('.icon-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      if (typeof onDeleteRoom === 'function') return onDeleteRoom(e);
      alert('Delete room handler not implemented');
    });
  });
}

// update: renderGamesTable shows checkbox and wires change handler
function renderGamesTable(games){
  const tbody = document.getElementById('adminGamesList');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!Array.isArray(games) || games.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" style="padding:18px;color:var(--muted);text-align:center">Không có trò chơi</td>`;
    tbody.appendChild(tr);
    return;
  }

  games.forEach(g => {
    const id = g.id || g._id || '';
    const title = (g.name && (g.name.vi || g.name.en)) ? (g.name.vi || g.name.en) : (g.title || g.name || '');
    const desc = (g.desc && (g.desc.vi || g.desc.en)) ? (g.desc.vi || g.desc.en) : (g.desc || '');
    const category = (g.category && (g.category.vi || g.category.en)) ? (g.category.vi || g.category.en) : (g.category || '');
    const players = g.players || '';

    const featuredChecked = g.featured ? 'checked' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="min-width:260px">
        <div style="font-weight:600">${escapeHtml(title)}</div>
        <div style="color:var(--muted);font-size:12px">${escapeHtml(String(desc).slice(0,120))}</div>
      </td>
      <td>${escapeHtml(category)}</td>
      <td>${escapeHtml(players)}</td>
      <td style="text-align:center">
        <input type="checkbox" class="game-feature-checkbox" data-id="${escapeHtml(id)}" ${featuredChecked} aria-label="Nổi bật"/>
      </td>
      <td style="display:flex;gap:6px">
        <button class="icon-btn icon-edit" title="Sửa" data-id="${escapeHtml(id)}" aria-label="Sửa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button class="icon-btn icon-delete" title="Xóa" data-id="${escapeHtml(id)}" aria-label="Xóa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // wire checkbox events
  tbody.querySelectorAll('.game-feature-checkbox').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const cbEl = e.currentTarget;            // giữ tham chiếu
      const id = cbEl.dataset.id;
      const checked = cbEl.checked;
      cbEl.disabled = true;                    // disable UI trong khi chờ
      try {
        await updateGameFeatured(id, checked);
        // thành công: giữ trạng thái mới
      } catch (err) {
        console.error('update featured failed', err);
        alert('Không thể cập nhật trạng thái nổi bật: ' + (err.message || err));
        // revert UI using saved ref
        try { cbEl.checked = !checked; } catch(e2){ console.warn('revert failed', e2); }
      } finally {
        cbEl.disabled = false;
      }
    });
  });

  // bind edit/delete if exist
  tbody.querySelectorAll('.icon-edit').forEach(b=>b.addEventListener('click', (e)=>{ if (typeof onEditGame === 'function') return onEditGame(e); alert('Edit game not implemented'); }));
  tbody.querySelectorAll('.icon-delete').forEach(b=>b.addEventListener('click', (e)=>{ if (typeof onDeleteGame === 'function') return onDeleteGame(e); alert('Delete game not implemented'); }));
}

// helper: update featured flag via API
async function updateGameFeatured(id, featured){
  if (!id) throw new Error('missing id');
  return fetchJson(`${ADMIN_API}/api/game/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ featured: !!featured })
  });
}

// Game modal handlers
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
    let resData;
    if (orig) {
      resData = await fetchJson(`${ADMIN_API}/api/game/${encodeURIComponent(orig)}`, {
        method: 'PUT', credentials:'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    } else {
      resData = await fetchJson(`${ADMIN_API}/api/game`, {
        method: 'POST', credentials:'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    }
    alert('Lưu thành công');
    closeGameForm();
    loadData();
    return resData;
  }catch(err){
    console.error('saveGame failed', err);
    alert('Lưu thất bại: ' + (err.message || err));
  }
}

// replace other CRUD calls (users/rooms/delete) to use fetchJson for better errors
async function saveUser(e){ e.preventDefault(); const id = el('userId').value; const payload = { username: el('userUsername').value.trim(), email: el('userEmail').value.trim(), role: el('userRole').value }; if(!payload.username) return alert('Username không được để trống'); try{ await fetchJson(`${ADMIN_API}/api/user/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) }); alert('Cập nhật người dùng thành công'); closeUserForm(); loadData(); }catch(err){ console.error('saveUser failed', err); alert('Cập nhật thất bại: '+ (err.message||err)); } }

async function onDeleteUser(e){ const id = e.currentTarget.dataset.id; if(!confirm('Xác nhận xóa user?')) return; try{ await fetchJson(`${ADMIN_API}/api/user/${encodeURIComponent(id)}`, { method:'DELETE', credentials:'same-origin' }); alert('Đã xóa user'); loadData(); }catch(err){ console.error('delete user failed', err); alert('Xóa thất bại: ' + (err.message || err)); } }

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
    if(id){
      await fetchJson(`${ADMIN_API}/api/room/${encodeURIComponent(id)}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
    } else {
      await fetchJson(`${ADMIN_API}/api/room`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
    }
    alert('Phòng lưu thành công');
    closeRoomForm();
    loadData();
  }catch(err){
    console.error('saveRoom failed', err);
    alert('Cập nhật thất bại: ' + (err.message || err));
  }
}

async function onDeleteRoom(e){ const id = e.currentTarget.dataset.id; if(!confirm('Xác nhận xóa phòng?')) return; try{ await fetchJson(`${ADMIN_API}/api/room/${encodeURIComponent(id)}`, { method:'DELETE', credentials:'same-origin' }); alert('Đã xóa phòng'); loadData(); }catch(err){ console.error('delete room failed', err); alert('Xóa thất bại: ' + (err.message || err)); } }

async function onDeleteGame(e){ const id = e.currentTarget.dataset.id; if (!confirm('Xác nhận xóa trò chơi này?')) return; try{ await fetchJson(`${ADMIN_API}/api/game/${encodeURIComponent(id)}`, { method:'DELETE', credentials:'same-origin' }); alert('Đã xóa trò chơi'); loadData(); }catch(err){ console.error('delete game failed', err); alert('Xóa thất bại: ' + (err.message || err)); } }

// Load data and render
async function loadData(){
  try{
    const usersQ = el('usersSearch') && el('usersSearch').value.trim();
    const roomsQ = el('roomsSearch') && el('roomsSearch').value.trim();

    // fetch in parallel using helpers that handle plural/singular
    const usersPromise = fetchUsers(usersQ).catch(e=>{ throw e; });
    const roomsPromise = fetchRooms(roomsQ).catch(e=>{ throw e; });
    const gamesPromise = fetchGames().catch(e=>{ throw e; });

    const [users, rooms, games] = await Promise.all([usersPromise, roomsPromise, gamesPromise]);

    renderUsersTable(users || []);
    renderRoomsTable(rooms || []);
    renderGamesTable(games || []);
  } catch (err) {
    console.error('loadData error:', err);
    alert('Không thể tải dữ liệu admin. Kiểm tra logs server.\n\n' + (err && (err.message || err.toString())));
  }
}

// modal handlers (unchanged from previous implementation)
function openUserForm(user){ showOverlay(true); el('userFormPopup').style.display = 'block'; el('userFormTitle').innerText = user ? 'Sửa người dùng' : 'Thêm người dùng'; el('userId').value = user? user._id : ''; el('userUsername').value = user? user.username : ''; el('userEmail').value = user? user.email : ''; el('userRole').value = user? user.role || 'user' : 'user'; }
function closeUserForm(){ el('userFormPopup').style.display='none'; showOverlay(false); }
async function onEditUser(e){ const id = e.currentTarget.dataset.id; try{ const users = await fetchUsers(); const u = users.find(x=>x._id===id); if(!u) return alert('User not found'); openUserForm(u); }catch(err){ console.error(err); alert('Lỗi'); } }
async function saveUser(e){ e.preventDefault(); const id = el('userId').value; const payload = { username: el('userUsername').value.trim(), email: el('userEmail').value.trim(), role: el('userRole').value }; if(!payload.username) return alert('Username không được để trống'); try{ await fetchJson(`${ADMIN_API}/api/user/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) }); alert('Cập nhật người dùng thành công'); closeUserForm(); loadData(); }catch(err){ console.error('saveUser failed', err); alert('Cập nhật thất bại: '+ (err.message||err)); } }
async function onDeleteUser(e){ const id = e.currentTarget.dataset.id; if(!confirm('Xác nhận xóa user?')) return; try{ await fetchJson(`${ADMIN_API}/api/user/${encodeURIComponent(id)}`, { method:'DELETE', credentials:'same-origin' }); alert('Đã xóa user'); loadData(); }catch(err){ console.error('delete user failed', err); alert('Xóa thất bại: ' + (err.message || err)); } }

function openRoomForm(room){ showOverlay(true); el('roomFormPopup').style.display = 'block'; el('roomFormTitle').innerText = room ? 'Sửa phòng' : 'Thêm phòng'; el('roomId').value = room? room._id : ''; el('roomName').value = room? room.name : ''; el('roomGame').value = room? room.game : ''; el('roomOwner').value = room? room.owner : ''; el('roomStatus').value = room? room.status : 'Đang mở'; }
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
    if(id){
      await fetchJson(`${ADMIN_API}/api/room/${encodeURIComponent(id)}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
    } else {
      await fetchJson(`${ADMIN_API}/api/room`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
    }
    alert('Phòng lưu thành công');
    closeRoomForm();
    loadData();
  }catch(err){
    console.error('saveRoom failed', err);
    alert('Cập nhật thất bại: ' + (err.message || err));
  }
}
async function onDeleteRoom(e){ const id = e.currentTarget.dataset.id; if(!confirm('Xác nhận xóa phòng?')) return; try{ await fetchJson(`${ADMIN_API}/api/room/${encodeURIComponent(id)}`, { method:'DELETE', credentials:'same-origin' }); alert('Đã xóa phòng'); loadData(); }catch(err){ console.error('delete room failed', err); alert('Xóa thất bại: ' + (err.message || err)); } }

function logoutAdmin(){ fetch('/admin/logout',{method:'POST', credentials:'same-origin'}).finally(()=> location.href='/admin-login.html'); }

document.addEventListener('DOMContentLoaded', ()=>{
  // wire tab buttons
  document.querySelectorAll('.tab-btn').forEach(b=> b.addEventListener('click', ()=> showTab(b.getAttribute('data-tab'))));
  const uSearch = el('usersSearch'); if(uSearch) uSearch.addEventListener('keyup', debounce(()=> loadData(), 400));
  const rSearch = el('roomsSearch'); if(rSearch) rSearch.addEventListener('keyup', debounce(()=> loadData(), 400));
  el('userForm') && el('userForm').addEventListener('submit', saveUser);
  el('roomForm') && el('roomForm').addEventListener('submit', saveRoom);
  el('popupOverlay').addEventListener('click', ()=>{ closeUserForm(); closeRoomForm(); });
  // show users tab by default
  showTab('usersTab');
  loadData();
});

// wire "Add game" button
function openGameFormForNew(){ openGameForm(null); }

// integrate into DOM ready
document.addEventListener('DOMContentLoaded', ()=>{
  // existing wiring...
  // add Add-game button handler (if exists)
  const addGameBtn = document.querySelector('button[onclick="openGameForm()"]');
  if (addGameBtn) { addGameBtn.onclick = openGameFormForNew; }
  // ensure game form submit handler
  el('gameForm') && el('gameForm').addEventListener('submit', saveGame);
  // initial load already called below in previous code
});

// populate room game select from public/games.json
async function populateGameOptions(){
  const sel = el('roomGame');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Chọn trò chơi --</option>';
  try{
    const res = await fetch(`${window.location.origin}/games.json`, { credentials: 'same-origin' });
    if(!res.ok) return console.warn('games.json fetch failed', res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data.games) ? data.games : []);
    list.forEach(g=>{
      const gid = g.id || g._id || (g.name && (g.name.en || g.name.vi)) || '';
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

// openRoomForm: set select value when editing
function openRoomForm(room){
  showOverlay(true);
  el('roomFormPopup').style.display = 'block';
  el('roomFormTitle').innerText = room ? 'Sửa phòng' : 'Thêm phòng';
  el('roomId').value = room? (room._id || room.id || '') : '';
  el('roomName').value = room? (room.name || '') : '';
  // try to set select by room.game.id / room.game / room.gameName
  const sel = el('roomGame');
  const gameId = room ? ( (room.game && (room.game.id || room.game.name || room.game.title)) || room.game || room.gameName ) : '';
  if(sel){
    // ensure options exist, try to set value (if not yet populated it will be set after populate)
    sel.value = gameId || '';
  }
  el('roomOwner').value = room? (room.owner || '') : '';
  el('roomStatus').value = room? (room.status || 'Đang mở') : 'Đang mở';
}

// saveRoom: read selected option (id + text) and send as game object
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
      res = await fetch(`${ADMIN_API}/api/room/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
    } else {
      // if API supports create
      res = await fetch(`${ADMIN_API}/api/room`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
    }
    if(!res.ok){
      const txt = await res.text().catch(()=>null);
      throw new Error(txt||res.status);
    }
    alert('Phòng lưu thành công');
    closeRoomForm();
    loadData();
  }catch(err){
    console.error(err);
    alert('Cập nhật thất bại: ' + (err.message || err));
  }
}

// ensure game options populated on startup and before opening form
document.addEventListener('DOMContentLoaded', ()=>{
  // existing wiring...
  populateGameOptions().catch(()=>{});
  // re-populate when opening add-room form button (in case games.json changed)
  const addRoomBtn = document.querySelector('button[onclick="openRoomForm()"]');
  if(addRoomBtn){
    addRoomBtn.addEventListener('click', ()=> populateGameOptions());
  }
  // also repopulate when rooms tab is activated
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      if(b.getAttribute('data-tab') === 'roomsTab') populateGameOptions();
    });
  });
});

function debounce(fn,wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }