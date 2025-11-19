// public/admin.js (FINAL: Thêm chức năng Tạo User)

const ADMIN_API = 'https://datn-socket.up.railway.app'; 

// Các endpoint API
const API_ENDPOINTS = {
    STATS: `${ADMIN_API}/api/admin/stats`,
    USERS: `${ADMIN_API}/api/admin/users`,
    ROOMS: `${ADMIN_API}/api/admin/rooms`,
    GAMES: `${ADMIN_API}/api/admin/games`,
    SYNC_GAMES: `${ADMIN_API}/api/admin/games/sync`,
    
    // Helper để tạo URL chi tiết
    USER_ID: (id) => `${ADMIN_API}/api/admin/users/${id}`,
    GAME_ID: (id) => `${ADMIN_API}/api/admin/games/${id}`,
    ROOM_ID: (id) => `${ADMIN_API}/api/admin/rooms/${id}`
};

// Trạng thái trang hiện tại cho từng tab
let pageState = {
    users: 1,
    rooms: 1,
    games: 1
};

// Cache dữ liệu trang hiện tại (để dùng cho Edit)
let currentDataCache = {
    users: [],
    games: []
};

// Hàng chờ thay đổi (Pending Changes)
let pendingChanges = []; 

// --- Socket.io ---
let socket;
try {
    socket = io(ADMIN_API, {
        path: '/socket.io',
        transports: ['websocket'],
        withCredentials: true
    });
    socket.on('connect', () => {
        console.log('Admin Socket Connected');
        logActivity('Connected to Admin Socket', 'success');
    });
    socket.on('disconnect', () => logActivity('Disconnected from Admin Socket', 'danger'));
} catch (e) { console.error("Socket Error:", e); }

// --- DOM Elements ---
const el = id => document.getElementById(id);
const showOverlay = show => { const o = el('adminOverlay'); if(o) o.style.display = show ? 'flex' : 'none'; };

// --- FORM MODAL LOGIC (Đã sửa lỗi tham chiếu) ---
const gameModal = el('gameModal');
const gameForm = el('gameForm');
let isEditingGame = false; 

const userModal = el('userModal'); // Modal Sửa User
const userForm = el('userForm');
let isEditingUser = false; 

// BỔ SUNG: Modal Thêm User
const addUserModal = el('addUserModal');
const addUserForm = el('addUserForm');

// --- 1. MAIN INIT ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupTabs();
    setupNavToggle();
    
    // Gán sự kiện cho các nút chính
    const btnAddGame = el('addGameBtn');
    if(btnAddGame) btnAddGame.onclick = () => openGameForm(null);
    
    // BỔ SUNG: NÚT THÊM NGƯỜI DÙNG
    const btnAddUser = el('addUserBtn');
    if(btnAddUser) btnAddUser.onclick = openAddUserForm;
    
    const btnSync = el('syncGamesBtn');
    if(btnSync) btnSync.onclick = syncGames;
    
    const btnLogout = el('logoutBtn');
    if(btnLogout) btnLogout.onclick = logoutAdmin;

    const btnRefresh = el('refreshDataBtn');
    if(btnRefresh) btnRefresh.onclick = loadData;
    
    // Search Listeners (Debounce)
    if(el('usersSearch')) el('usersSearch').onkeyup = debounce(() => { pageState.users = 1; fetchUsers(el('usersSearch').value); }, 400);
    if(el('roomsSearch')) el('roomsSearch').onkeyup = debounce(() => { pageState.rooms = 1; fetchRooms(el('roomsSearch').value); }, 400);
    if(el('gamesSearch')) el('gamesSearch').onkeyup = debounce(() => { pageState.games = 1; fetchGames(el('gamesSearch').value); }, 400);

    // Form Submits
    if(gameForm) gameForm.onsubmit = saveGame;
    if(userForm) userForm.onsubmit = saveUser; // Sửa thông tin user
    if(addUserForm) addUserForm.onsubmit = saveNewUser; // BỔ SUNG: Thêm user mới
    
    // Socket listeners (Đã thêm log)
    if(socket) {
        socket.on('admin-stats-update', () => { loadStats(); logActivity('Dashboard Stats Updated', 'info'); });
        socket.on('admin-users-changed', () => { fetchUsers(el('usersSearch')?.value || ''); logActivity('User list updated', 'info'); });
        socket.on('admin-rooms-changed', () => { fetchRooms(el('roomsSearch')?.value || ''); logActivity('Room list updated', 'warning'); });
        socket.on('admin-games-changed', () => { fetchGames(el('gamesSearch')?.value || ''); logActivity('Game list updated', 'info'); });
    }

    // Event Delegation cho bảng (QUAN TRỌNG)
    setupTableDelegation();
    
    // Setup Modals
    setupModals();

    // Load Data
    loadData();
});

function checkAuth() {
    // Kiểm tra cookie (đơn giản)
    if (!document.cookie.includes('admin_token')) {
        // window.location.href = '/admin-login'; 
    }
}

// --- 2. TABS LOGIC ---
function setupTabs() {
    const tabs = document.querySelectorAll('.nav-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('logout')) return; 
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetId = tab.dataset.tab + 'Tab';
            document.querySelectorAll('.admin-tab-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            
            const targetContent = el(targetId);
            if(targetContent) {
                targetContent.style.display = 'block';
                setTimeout(() => targetContent.classList.add('active'), 50);
            }
        });
    });
}

function setupNavToggle() {
    // Logic toggle sidebar
}

// --- 3. DATA FETCHING ---

async function fetchApi(url, options = {}) {
    options.credentials = 'include'; 
    try {
        const res = await fetch(url, options);
        if (res.status === 401 || res.status === 403) {
            window.location.href = '/admin-login';
            return null;
        }
        return await res.json();
    } catch (err) {
        console.error("API Error:", err);
        return null;
    }
}

async function loadData() {
    await loadStats();
    // Load song song
    await Promise.all([
        fetchUsers(''),
        fetchRooms(''),
        fetchGames('')
    ]);
}

async function loadStats() {
    const data = await fetchApi(API_ENDPOINTS.STATS);
    if (data) {
        if(el('totalGames')) el('totalGames').innerText = data.totalGames || 0;
        if(el('totalRooms')) el('totalRooms').innerText = data.totalRooms || 0;
        if(el('onlineUsers')) el('onlineUsers').innerText = data.onlineUsers || 0;
        if(el('totalUsers')) el('totalUsers').innerText = data.totalUsers || 0;
    }
}

// --- FETCHING VỚI PHÂN TRANG ---

async function fetchUsers(q) {
    const url = new URL(API_ENDPOINTS.USERS);
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('page', pageState.users);
    
    const j = await fetchApi(url.toString());
    if (j && j.data) {
        currentDataCache.users = j.data; // Lưu cache để edit
        renderUsersTable(j.data);
        renderPagination('users', j, fetchUsers);
    }
}

async function fetchRooms(q) {
    const url = new URL(API_ENDPOINTS.ROOMS);
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('page', pageState.rooms);
    
    const j = await fetchApi(url.toString());
    if (j && j.data) {
        renderRoomsTable(j.data);
        renderPagination('rooms', j, fetchRooms);
    }
}

async function fetchGames(q) {
    const url = new URL(API_ENDPOINTS.GAMES);
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('page', pageState.games);
    
    const j = await fetchApi(url.toString());
    if (j && j.data) {
        currentDataCache.games = j.data; // Lưu cache để edit
        renderGamesTable(j.data);
        renderPagination('games', j, fetchGames);
    }
}

// --- 4. RENDER TABLE & PAGINATION ---

function formatDateTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleTimeString('vi-VN', options);
}

function renderPagination(type, meta, fetchFunc) {
    // Logic renderPagination giữ nguyên
    const container = el(`${type}Pagination`);
    if (!container) return;
    
    container.innerHTML = '';
    if (meta.pages <= 1) return; 

    const createBtn = (text, targetPage, isActive = false, isDisabled = false) => {
        const btn = document.createElement('button');
        btn.className = `page-btn ${isActive ? 'active' : ''}`;
        btn.innerText = text;
        btn.disabled = isDisabled;
        if (!isDisabled && !isActive) {
            btn.onclick = () => {
                pageState[type] = targetPage;
                const q = el(`${type}Search`) ? el(`${type}Search`).value : '';
                fetchFunc(q); 
            };
        }
        return btn;
    };

    container.appendChild(createBtn('«', meta.page - 1, false, meta.page === 1));

    for (let i = 1; i <= meta.pages; i++) {
        if (i === 1 || i === meta.pages || (i >= meta.page - 1 && i <= meta.page + 1)) {
             container.appendChild(createBtn(i, i, i === meta.page));
        } else if (i === meta.page - 2 || i === meta.page + 2) {
             const span = document.createElement('span');
             span.innerText = '...';
             span.className = 'page-dots';
             container.appendChild(span);
        }
    }

    container.appendChild(createBtn('»', meta.page + 1, false, meta.page === meta.pages));
    
    const info = document.createElement('span');
    info.className = 'page-info';
    info.innerText = ` (Tổng: ${meta.total})`;
    container.appendChild(info);
}

function renderUsersTable(users) {
    const tbody = el('adminUsersList');
    if (!tbody) return;
    
    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center">Không có dữ liệu</td></tr>`; // Sửa colspan = 8
        return;
    }

    tbody.innerHTML = users.map(u => {
        
        // Tạo nội dung chi tiết cho cột Lịch sử chơi
        let historyHtml = 'Chưa có.';
        if (u.playHistory && u.playHistory.length > 0) {
            // Lấy 3 lần chơi gần nhất
            const recentHistory = u.playHistory.slice(-3).reverse(); 
            historyHtml = recentHistory.map(h => {
                // Định dạng ngày giờ cho lịch sử chơi
                const playedAtFormatted = new Date(h.playedAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric'});
                // Sử dụng h.gameName và h.gameId
                return `<div>${h.gameName} (${h.gameId}) - ${playedAtFormatted}</div>`;
            }).join('');
        }
        
        return `
            <tr>
                <td><div class="user-cell"><img src="https://api.dicebear.com/7.x/micah/svg?seed=${u.username}" alt="avt"><span>${u.username}</span></div></td>
                <td>${u.displayName || ''}</td>
                <td>${u.email || '-'}</td>
                <td>${u.googleId ? '<span class="badge google">Google</span>' : '<span class="badge local">Local</span>'}</td>
                <td><span class="status-dot ${u.status}"></span> ${u.status}</td>
                <td>${formatDateTime(u.createdAt)}</td>
                <td style="font-size:0.85em; color:#64748b; line-height: 1.3;">${historyHtml}</td> <td>
                    <button class="action-btn edit" data-id="${u._id}" data-type="user" title="Sửa"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" data-id="${u._id}" data-type="user" title="Xóa"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderRoomsTable(rooms) {
    const tbody = el('adminRoomsList');
    if (!tbody) return;

    if (!rooms.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">Không có phòng</td></tr>`;
        return;
    }

    tbody.innerHTML = rooms.map(r => `
        <tr>
            <td><strong>${r.code}</strong></td>
            <td>${r.game?.type || '-'}</td>
            <td>${r.host}</td>
            <td>${r.players?.length || 0}</td>
            <td><span class="badge ${r.status}">${r.status}</span></td>
            <td>${formatDateTime(r.createdAt)}</td>
            <td>
                <button class="action-btn delete" data-id="${r.code}" data-type="room" title="Đóng phòng"><i class="fas fa-times"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderGamesTable(games) {
    const tbody = el('adminGamesList');
    if (!tbody) return;

    if (!games.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">Không có game</td></tr>`;
        return;
    }

    tbody.innerHTML = games.map(g => `
        <tr>
            <td>${g.id}</td>
            <td><img src="${ADMIN_API}/game/${g.id}/Img/logo.png" class="game-thumb" onerror="this.src='/img/fav.svg'"></td>
            <td>
                <div><b>VI:</b> ${g.name?.vi || ''}</div>
                <div style="color:#64748b;font-size:0.9em"><b>EN:</b> ${g.name?.en || ''}</div>
            </td>
            <td>${g.players}</td>
            <td>
                <input type="checkbox" ${g.featured ? 'checked' : ''} 
                       data-id="${g.id}" class="game-feature-checkbox toggle-switch">
            </td>
            <td>
                ${g.isComingSoon ? '<span class="badge pending">Sắp ra mắt</span>' : '<span class="badge success">Hoạt động</span>'}
            </td>
            <td>
                <button class="action-btn edit" data-id="${g.id}" data-type="game"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${g.id}" data-type="game"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// --- 5. ACTIONS & EVENT DELEGATION ---

function setupTableDelegation() {
    // Bảng Game
    const gamesList = el('adminGamesList');
    if (gamesList) {
        gamesList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;

            if (btn.classList.contains('edit')) {
                const game = currentDataCache.games.find(g => g.id === id);
                if(game) openGameForm(game);
            } else if (btn.classList.contains('delete')) {
                if(confirm('Xóa game này?')) deleteItem('games', id);
            }
        });

        gamesList.addEventListener('change', (e) => {
            if (e.target.classList.contains('game-feature-checkbox')) {
                toggleFeatured(e.target.dataset.id, e.target.checked);
            }
        });
    }

    // Bảng Room
    const roomsList = el('adminRoomsList');
    if (roomsList) {
        roomsList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (btn && btn.classList.contains('delete')) {
                if(confirm('Đóng phòng này?')) deleteItem('rooms', btn.dataset.id);
            }
        });
    }

    // Bảng User (Sửa: Thêm nút Edit)
    const usersList = el('adminUsersList');
    if (usersList) {
        usersList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;
            
            if (btn.classList.contains('edit')) {
                const user = currentDataCache.users.find(u => u._id === id);
                if(user) openUserForm(user);
            } else if (btn.classList.contains('delete')) {
                if(confirm('Xóa user này?')) deleteItem('users', id);
            }
        });
    }
}

// --- API CALLS FOR ACTIONS ---

async function deleteItem(type, id) {
    if (!confirm('Xác nhận xóa/đóng item này?')) return;
    showOverlay(true);
    const endpoint = type === 'games' ? API_ENDPOINTS.GAME_ID(id) 
                   : type === 'rooms' ? API_ENDPOINTS.ROOM_ID(id)
                   : API_ENDPOINTS.USER_ID(id);
                   
    const res = await fetchApi(endpoint, { method: 'DELETE' });
    if(res) logActivity(`Đã xóa/đóng ${type.toUpperCase()} ID: ${id}`, 'success');
    showOverlay(false);
    // Socket sẽ tự update UI
}

async function toggleFeatured(id, checked) {
    const res = await fetchApi(API_ENDPOINTS.GAME_ID(id), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ featured: checked })
    });
    if(res) logActivity(`Cập nhật game ${id}: Nổi bật = ${checked}`, 'info');
}

async function syncGames() {
    if (!confirm('Quét lại thư mục và đồng bộ CSDL?')) return;
    showOverlay(true);
    try {
        const resSync = await fetchApi(API_ENDPOINTS.SYNC_GAMES, { method: 'POST' });
        if(resSync) logActivity(`Đồng bộ thành công: ${resSync.updated || 0} cập nhật, ${resSync.created || 0} mới.`, 'success');
        else logActivity('Đồng bộ thất bại, kiểm tra console.', 'danger');
    } catch(e) { logActivity('Lỗi: ' + e.message, 'danger'); }
    showOverlay(false);
}

function logoutAdmin() {
    fetch(`${ADMIN_API}/admin/logout`, {method:'POST', credentials: 'include'})
      .finally(()=> location.href='/admin-login.html'); 
}

// --- 6. MODAL HANDLERS ---

function setupModals() {
    // Đóng modal Game
    if(gameModal) {
        document.querySelectorAll('#gameModal .close-modal, #gameModal .close-modal-btn').forEach(btn => {
            btn.onclick = () => gameModal.style.display = 'none';
        });
    }
    // Đóng modal Sửa User
    if(userModal) {
        document.querySelectorAll('#userModal .close-modal, #userModal .close-modal-btn').forEach(btn => {
            btn.onclick = () => userModal.style.display = 'none';
        });
    }
    // Đóng modal Thêm User
    if(addUserModal) {
        document.querySelectorAll('#addUserModal .close-modal, #addUserModal .close-modal-btn').forEach(btn => {
            btn.onclick = () => addUserModal.style.display = 'none';
        });
    }
}

// Mở form sửa Game
function openGameForm(game) {
    isEditingGame = !!game;
    el('modalTitle').innerText = game ? 'Sửa Game' : 'Thêm Game Mới';
    
    if (game) {
        el('gameIdInput').value = game.id;
        el('gameIdInput').disabled = true;
        el('gameIdOriginal').value = game.id;
        el('gameNameVi').value = game.name?.vi || '';
        el('gameNameEn').value = game.name?.en || '';
        el('gameCatVi').value = game.category?.vi || '';
        el('gameCatEn').value = game.category?.en || '';
        el('gameDescVi').value = game.desc?.vi || '';
        el('gameDescEn').value = game.desc?.en || '';
        el('gamePlayers').value = game.players || '';
        el('gameFeatured').checked = game.featured || false;
    } else {
        gameForm.reset();
        el('gameIdInput').disabled = false;
        el('gameIdOriginal').value = '';
    }
    if (gameModal) gameModal.style.display = 'block';
}

// Lưu Game
async function saveGame(e) {
    e.preventDefault();
    showOverlay(true);
    
    const payload = {
        id: el('gameIdInput').value,
        name: { vi: el('gameNameVi').value, en: el('gameNameEn').value },
        category: { vi: el('gameCatVi').value, en: el('gameCatEn').value },
        desc: { vi: el('gameDescVi').value, en: el('gameDescEn').value },
        players: el('gamePlayers').value,
        featured: el('gameFeatured').checked
    };

    const url = isEditingGame ? API_ENDPOINTS.GAME_ID(payload.id) : API_ENDPOINTS.GAMES;
    const method = isEditingGame ? 'PUT' : 'POST';

    const res = await fetchApi(url, {
        method: method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    if(res) logActivity(`Game ${payload.id} đã được lưu thành công.`, 'success');
    if (gameModal) gameModal.style.display = 'none';
    showOverlay(false);
}

// Mở form sửa User
function openUserForm(user) {
    isEditingUser = true;
    el('userModalTitle').innerText = `Sửa User: ${user.username}`;
    
    if (user) {
        el('userIdInput').value = user._id;
        el('userUsernameInput').value = user.username || '';
        el('userDisplayNameInput').value = user.displayName || '';
        el('userEmailInput').value = user.email || '';
        
        const historyText = user.playHistory && user.playHistory.length > 0 
            ? user.playHistory.map(h => {
                 const playedAtFormatted = new Date(h.playedAt).toLocaleTimeString('vi-VN', {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'});
                 return `${h.gameName} (${h.gameId}) - ${playedAtFormatted}`;
            }).join('\n')
            : 'Chưa có lịch sử chơi.';
        el('userPlayHistory').value = historyText;
    } 
    if (userModal) userModal.style.display = 'block';
}

// Lưu User
async function saveUser(e) {
    e.preventDefault();
    showOverlay(true);

    const userId = el('userIdInput').value;
    const payload = {
        displayName: el('userDisplayNameInput').value,
        email: el('userEmailInput').value,
    };

    const url = API_ENDPOINTS.USER_ID(userId);

    const res = await fetchApi(url, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    if(res) logActivity(`User ${res.username} đã được cập nhật thành công.`, 'success');
    if (userModal) userModal.style.display = 'none';
    showOverlay(false);
}

// BỔ SUNG: Mở form thêm người dùng
function openAddUserForm() {
    if(addUserForm) addUserForm.reset();
    if (addUserModal) addUserModal.style.display = 'block';
}

// BỔ SUNG: Lưu người dùng mới (POST)
async function saveNewUser(e) {
    e.preventDefault();
    showOverlay(true);

    const payload = {
        username: el('addUsernameInput').value,
        password: el('addPasswordInput').value,
        displayName: el('addDisplayNameInput').value,
        email: el('addEmailInput').value || undefined,
    };
    
    if (!payload.username || !payload.password || !payload.displayName) {
        alert('Vui lòng nhập Username, Password và Tên hiển thị.');
        showOverlay(false);
        return;
    }

    const url = API_ENDPOINTS.USERS; // POST to /api/admin/users
    
    const res = await fetchApi(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    if(res && res.ok) { 
        logActivity(`Đã thêm User mới: ${payload.username}`, 'success');
        if (addUserModal) addUserModal.style.display = 'none';
        fetchUsers(''); // Tải lại danh sách
    } else {
        const message = res?.message || 'Lỗi không xác định khi tạo người dùng.';
        logActivity(`Tạo User thất bại: ${message}`, 'danger');
        alert(`Lỗi tạo người dùng: ${message}`);
    }
    
    showOverlay(false);
}

// --- 7. LOGGING & UTILS ---

function logActivity(message, type = 'info') {
    const logList = el('activityLog');
    if (!logList) return;

    const timestamp = new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const icon = type === 'success' ? '✅' : type === 'danger' ? '❌' : type === 'warning' ? '⚠️' : '💡';
    const color = type === 'success' ? '#22c55e' : type === 'danger' ? '#ef4444' : type === 'warning' ? '#f97316' : '#94a3b8';
    
    const newItem = document.createElement('li');
    newItem.style.cssText = `padding: 8px 0; border-bottom: 1px dotted var(--border-light); color: ${color}; font-size: 0.9em;`;
    newItem.innerHTML = `
        <span style="color:var(--text-muted); margin-right: 8px;">[${timestamp}]</span> 
        ${icon} ${message}
    `;

    // Giới hạn 20 log item
    if (logList.children.length > 20) {
        logList.removeChild(logList.children[0]);
    }
    
    // Thêm log mới
    logList.appendChild(newItem);
    logList.scrollTop = logList.scrollHeight;
}

// Helper Debounce
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}