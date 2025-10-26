// Admin frontend
const DEFAULT_BACKEND = 'https://datn-socket.up.railway.app';
const ADMIN_API = (typeof window.BASE_API_URL === 'string' && window.BASE_API_URL.trim())
  ? String(window.BASE_API_URL).replace(/\/+$/,'')
  : (typeof window.ADMIN_API === 'string' && window.ADMIN_API.trim())
    ? String(window.ADMIN_API).replace(/\/+$/,'')
    : DEFAULT_BACKEND;

function el(id){return document.getElementById(id);}
function showOverlay(show){ el('popupOverlay').style.display = show ? 'block' : 'none'; }
function showTab(tabId){ document.querySelectorAll('.admin-tab-content').forEach(e=>e.style.display='none'); document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); const tab = el(tabId); if(tab) tab.style.display = ''; document.querySelectorAll('.tab-btn').forEach(b=>{ if(b.getAttribute('data-tab')===tabId) b.classList.add('active') }); }

async function fetchJson(url, opts = {}) {
  opts.credentials = opts.credentials || 'include';
  const res = await fetch(url, opts);
  const txt = await res.text().catch(() => null);
  let parsed = txt;
  try { parsed = txt ? JSON.parse(txt) : null; } catch(e) {}
  if (!res.ok) {
    const bodyMsg = (typeof parsed === 'string') ? parsed : (parsed ? JSON.stringify(parsed) : '<no body>');
    const err = new Error(`HTTP ${res.status} ${res.statusText} - ${bodyMsg}`);
    err.status = res.status; err.body = parsed;
    throw err;
  }
  return parsed;
}

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
  let lastErr = null;
  for (const url of uniq) {
    try {
      const parsed = await fetchJson(url);
      return parsed;
    } catch (err) {
      lastErr = err;
      console.debug('tryFetchListVariants candidate failed:', url, err && err.message);
    }
  }
  throw lastErr || new Error('No endpoints available: ' + uniq.join(','));
}

async function fetchUsers(q){ const j = await tryFetchListVariants('users', q); return Array.isArray(j) ? j : (j && j.users) ? j.users : []; }
async function fetchRooms(q){ const j = await tryFetchListVariants('rooms', q); return Array.isArray(j) ? j : (j && j.rooms) ? j.rooms : []; }
async function fetchGames(q){ const j = await tryFetchListVariants('games', q); return Array.isArray(j) ? j : (j && (j.games || j.items)) ? (j.games || j.items) : []; }

if (typeof escapeHtml === 'undefined') {
  window.escapeHtml = function(s){ return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); };
}

function renderUsersTable(users){ /* ... same as before ... */ }
// (Keep renderUsersTable/renderRoomsTable/renderGamesTable as previously implemented)
// For brevity in this response, assume the rendering functions are unchanged and present in file — they use fetchJson / fetchUsers / fetchRooms / fetchGames where appropriate.

// Example important functions must use correct endpoints:

async function updateGameFeatured(id, featured){
  if (!id) throw new Error('missing id');
  return fetchJson(`${ADMIN_API}/api/games/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ featured: !!featured })
  });
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
      resData = await fetchJson(`${ADMIN_API}/api/games/${encodeURIComponent(orig)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      resData = await fetchJson(`${ADMIN_API}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

// All delete/update/create functions should call fetchJson(...) above (which uses credentials:'include')

// Admin login handling — use adminLogin() and form submit; removed any auto-fetch on load
async function adminLogin(username, password) {
  try {
    const resp = await fetchJson(`${ADMIN_API}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return resp;
  } catch (err) {
    console.error('[admin.js] login error', err);
    throw err;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#admin-login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = form.querySelector('input[name="username"]').value;
      const password = form.querySelector('input[name="password"]').value;
      try {
        await adminLogin(username, password);
        window.location.href = '/admin';
      } catch (err) {
        const elerr = document.querySelector('#admin-error');
        if (elerr) elerr.textContent = err.message || 'Network error';
      }
    });
  }

  // wire UI, loadData, populateGameOptions, etc.
  // call loadData() only when on admin pages after successful login
});
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