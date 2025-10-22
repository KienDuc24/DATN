// Admin frontend: fetch data from /api/admin/*, edit modal UI, delete actions.
const ADMIN_API = window.BASE_API_URL || window.location.origin;

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

// Fetch helpers
async function fetchUsers(q){
  const url = new URL(`${ADMIN_API}/api/admin/users`);
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url.toString(), { credentials: 'same-origin' });
  if (!res.ok) throw new Error('fetch users failed');
  const j = await res.json();
  return j.users || [];
}
async function fetchRooms(q){
  const url = new URL(`${ADMIN_API}/api/admin/rooms`);
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url.toString(), { credentials: 'same-origin' });
  if (!res.ok) throw new Error('fetch rooms failed');
  const j = await res.json();
  return j.rooms || [];
}

// Add/modify functions for games CRUD via server API

// fetch games from server-managed file
async function fetchGames(q){
  const url = new URL(`${ADMIN_API}/api/admin/games`);
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url.toString(), { credentials: 'same-origin' });
  if (!res.ok) throw new Error('fetch games failed');
  const j = await res.json();
  return j.games || [];
}

// renderGamesTable updated (show VI name/desc by default)
function renderGamesTable(games){
  const tbody = el('adminGamesList'); if(!tbody) return;
  tbody.innerHTML = '';
  games.forEach(g=>{
    const title = (g.name && g.name.vi) ? g.name.vi : (g.name && g.name.en) ? g.name.en : (g.name || g.title || '');
    const category = (g.category && g.category.vi) ? g.category.vi : (g.category && g.category.en) ? g.category.en : (g.category || '');
    const players = g.players || '';
    const desc = (g.desc && g.desc.vi) ? g.desc.vi : (g.desc && g.desc.en) ? g.desc.en : (g.desc || '');
    const id = g.id || g._id || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="min-width:260px">
        <div style="font-weight:600">${escapeHtml(title)}</div>
        <div style="color:var(--muted);font-size:12px">${escapeHtml(desc)}</div>
      </td>
      <td>${escapeHtml(category)}</td>
      <td>${escapeHtml(players)}</td>
      <td>${g.featured ? 'Có' : 'Không'}</td>
      <td style="display:flex;gap:8px">
        <button class="icon-btn icon-edit" title="Sửa" data-id="${escapeHtml(id)}" aria-label="Sửa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button class="icon-btn icon-delete" title="Xóa" data-id="${escapeHtml(id)}" aria-label="Xóa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.icon-edit').forEach(b=>b.addEventListener('click', onEditGame));
  tbody.querySelectorAll('.icon-delete').forEach(b=>b.addEventListener('click', onDeleteGame));
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
    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      throw new Error(txt || res.status);
    }
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

// Load data and render
async function loadData(){
  try{
    const usersQ = el('usersSearch') && el('usersSearch').value.trim();
    const roomsQ = el('roomsSearch') && el('roomsSearch').value.trim();

    // helper to fetch and show details on error
    async function safeFetch(url){
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) {
        let bodyText = '';
        try { bodyText = await res.text(); } catch(e) { bodyText = '<no body>'; }
        const err = new Error(`HTTP ${res.status} ${res.statusText} - ${url}\n${bodyText}`);
        err.status = res.status;
        err.body = bodyText;
        throw err;
      }
      return res.json().catch(()=>({}));
    }

    const usersPromise = safeFetch(`${ADMIN_API}/api/admin/users${usersQ?('?q='+encodeURIComponent(usersQ)) : ''}`);
    const roomsPromise = safeFetch(`${ADMIN_API}/api/admin/rooms${roomsQ?('?q='+encodeURIComponent(roomsQ)) : ''}`);
    const gamesPromise = safeFetch(`${ADMIN_API}/api/admin/games`);

    const [usersRes, roomsRes, gamesRes] = await Promise.all([usersPromise.catch(e=>({__err:e})), roomsPromise.catch(e=>({__err:e})), gamesPromise.catch(e=>({__err:e}))]);

    if (usersRes && usersRes.__err) throw usersRes.__err;
    if (roomsRes && roomsRes.__err) throw roomsRes.__err;
    if (gamesRes && gamesRes.__err) throw gamesRes.__err;

    const users = usersRes.users || [];
    const rooms = roomsRes.rooms || [];
    const games = gamesRes.games || [];

    renderUsersTable(users);
    renderRoomsTable(rooms);
    renderGamesTable(games);
  } catch (err) {
    console.error('loadData error:', err);
    // show detailed alert for debugging
    alert('Không thể tải dữ liệu admin. Kiểm tra logs server.\n\n' + (err && (err.message || err.toString())));
  }
}

// modal handlers (unchanged from previous implementation)
function openUserForm(user){ showOverlay(true); el('userFormPopup').style.display = 'block'; el('userFormTitle').innerText = user ? 'Sửa người dùng' : 'Thêm người dùng'; el('userId').value = user? user._id : ''; el('userUsername').value = user? user.username : ''; el('userEmail').value = user? user.email : ''; el('userRole').value = user? user.role || 'user' : 'user'; }
function closeUserForm(){ el('userFormPopup').style.display='none'; showOverlay(false); }
async function onEditUser(e){ const id = e.currentTarget.dataset.id; try{ const users = await fetchUsers(); const u = users.find(x=>x._id===id); if(!u) return alert('User not found'); openUserForm(u); }catch(err){ console.error(err); alert('Lỗi'); } }
async function saveUser(e){ e.preventDefault(); const id = el('userId').value; const payload = { username: el('userUsername').value.trim(), email: el('userEmail').value.trim(), role: el('userRole').value }; if(!payload.username) return alert('Username không được để trống'); try{ const res = await fetch(`${ADMIN_API}/api/admin/user/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) }); if(!res.ok){ const txt = await res.text(); throw new Error(txt||res.status); } alert('Cập nhật người dùng thành công'); closeUserForm(); loadData(); }catch(err){ console.error(err); alert('Cập nhật thất bại: '+ (err.message||err)); } }
async function onDeleteUser(e){ const id = e.currentTarget.dataset.id; if(!confirm('Xác nhận xóa user?')) return; try{ const res = await fetch(`${ADMIN_API}/api/admin/user/${id}`, { method:'DELETE', credentials:'same-origin' }); if(!res.ok) throw new Error('delete failed'); alert('Đã xóa user'); loadData(); }catch(err){ console.error(err); alert('Xóa thất bại'); } }

function openRoomForm(room){ showOverlay(true); el('roomFormPopup').style.display = 'block'; el('roomFormTitle').innerText = room ? 'Sửa phòng' : 'Thêm phòng'; el('roomId').value = room? room._id : ''; el('roomName').value = room? room.name : ''; el('roomGame').value = room? room.game : ''; el('roomOwner').value = room? room.owner : ''; el('roomStatus').value = room? room.status : 'Đang mở'; }
function closeRoomForm(){ el('roomFormPopup').style.display='none'; showOverlay(false); }
async function onEditRoom(e){ const id = e.currentTarget.dataset.id; try{ const rooms = await fetchRooms(); const r = rooms.find(x=>x._id===id); if(!r) return alert('Room not found'); openRoomForm(r); }catch(err){ console.error(err); alert('Lỗi'); } }
async function saveRoom(e){ e.preventDefault(); const id = el('roomId').value; const payload = { name: el('roomName').value.trim(), game: el('roomGame').value.trim(), owner: el('roomOwner').value.trim(), status: el('roomStatus').value }; if(!payload.name) return alert('Tên phòng không được để trống'); try{ let res; if(id){ res = await fetch(`${ADMIN_API}/api/admin/room/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) }); } else { return alert('Tạo phòng mới chưa được hỗ trợ qua API từ admin panel.'); } if(!res.ok) { const txt = await res.text(); throw new Error(txt||res.status); } alert('Phòng cập nhật thành công'); closeRoomForm(); loadData(); }catch(err){ console.error(err); alert('Cập nhật thất bại: '+(err.message||err)); } }
async function onDeleteRoom(e){ const id = e.currentTarget.dataset.id; if(!confirm('Xác nhận xóa phòng?')) return; try{ const res = await fetch(`${ADMIN_API}/api/admin/room/${id}`, { method:'DELETE', credentials:'same-origin' }); if(!res.ok) throw new Error('delete failed'); alert('Đã xóa phòng'); loadData(); }catch(err){ console.error(err); alert('Xóa thất bại'); } }

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

function debounce(fn,wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }