// public/admin.js (FINAL VERSION: Pagination + Sort Latest + Full Features)

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
    socket.on('connect', () => console.log('Admin Socket Connected'));
} catch (e) { console.error("Socket Error:", e); }

// --- DOM Elements ---
const el = id => document.getElementById(id);
const showOverlay = show => { const o = el('adminOverlay'); if(o) o.style.display = show ? 'flex' : 'none'; };

// --- 1. MAIN INIT ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupTabs();
    setupNavToggle();
    
    // Gán sự kiện cho các nút chính
    const btnAddGame = el('addGameBtn');
    if(btnAddGame) btnAddGame.onclick = () => openGameForm(null);
    
    const btnSync = el('syncGamesBtn');
    if(btnSync) btnSync.onclick = syncGames;
    
    const btnLogout = el('logoutBtn');
    if(btnLogout) btnLogout.onclick = logoutAdmin;

    const btnRefresh = el('refreshDataBtn');
    if(btnRefresh) btnRefresh.onclick = loadData;
    
    // Nút Lưu thay đổi (Nếu có dùng tính năng batch update)
    const btnConfirm = el('btnConfirmChanges');
    if(btnConfirm) btnConfirm.onclick = executePendingChanges;

    // Search Listeners (Debounce)
    if(el('usersSearch')) el('usersSearch').onkeyup = debounce(() => { pageState.users = 1; fetchUsers(el('usersSearch').value); }, 400);
    if(el('roomsSearch')) el('roomsSearch').onkeyup = debounce(() => { pageState.rooms = 1; fetchRooms(el('roomsSearch').value); }, 400);
    if(el('gamesSearch')) el('gamesSearch').onkeyup = debounce(() => { pageState.games = 1; fetchGames(el('gamesSearch').value); }, 400);

    // Form Submits
    const fGame = el('gameForm');
    if(fGame) fGame.onsubmit = saveGame;
    
    // Socket listeners
    if(socket) {
        socket.on('admin-stats-update', loadStats);
        socket.on('admin-users-changed', () => fetchUsers(el('usersSearch')?.value || ''));
        socket.on('admin-rooms-changed', () => fetchRooms(el('roomsSearch')?.value || ''));
        socket.on('admin-games-changed', () => fetchGames(el('gamesSearch')?.value || ''));
    }

    // Event Delegation cho bảng (QUAN TRỌNG)
    setupTableDelegation();

    // Load Data
    loadData();
});

function checkAuth() {
    // Kiểm tra cookie (đơn giản)
    if (!document.cookie.includes('admin_token')) {
        // window.location.href = '/admin-login'; // Bỏ comment dòng này nếu muốn chặn chặt
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
            
            // Đóng sidebar trên mobile
            if(window.innerWidth < 768) {
                const sidebar = el('adminSidebar'); // Chú ý ID trong HTML là class hay ID
                if(document.querySelector('.admin-sidebar').classList.contains('active')) {
                    document.querySelector('.sidebar-toggle')?.click();
                }
            }
        });
    });
}

function setupNavToggle() {
    // Nếu có nút toggle sidebar (cho mobile)
    // ... (Logic toggle sidebar)
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
        if(el('totalGames')) el('totalGames').innerText = data.totalGames;
        if(el('totalRooms')) el('totalRooms').innerText = data.totalRooms;
        if(el('onlineUsers')) el('onlineUsers').innerText = data.onlineUsers;
        if(el('totalUsers')) el('totalUsers').innerText = data.totalUsers;
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

function renderPagination(type, meta, fetchFunc) {
    // meta: { total, page, pages }
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
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">Không có dữ liệu</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr>
            <td><div class="user-cell"><img src="https://api.dicebear.com/7.x/micah/svg?seed=${u.username}" alt="avt"><span>${u.username}</span></div></td>
            <td>${u.displayName || ''}</td>
            <td>${u.email || '-'}</td>
            <td>${u.googleId ? '<span class="badge google">Google</span>' : '<span class="badge local">Local</span>'}</td>
            <td><span class="status-dot ${u.status}"></span> ${u.status}</td>
            <td>${new Date(u.createdAt).toLocaleDateString()}</td>
            <td>
                <button class="action-btn delete" data-id="${u._id}" data-type="user" title="Xóa"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
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
            <td>${new Date(r.createdAt).toLocaleTimeString()}</td>
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
            <td><img src="/game/${g.id}/Img/logo.png" class="game-thumb" onerror="this.src='/img/fav.svg'"></td>
            <td>
                <div><b>VI:</b> ${g.name?.vi || ''}</div>
                <div style="color:#666;font-size:0.9em"><b>EN:</b> ${g.name?.en || ''}</div>
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

    // Bảng User
    const usersList = el('adminUsersList');
    if (usersList) {
        usersList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (btn && btn.classList.contains('delete')) {
                if(confirm('Xóa user này?')) deleteItem('users', btn.dataset.id);
            }
        });
    }
}

// --- API CALLS FOR ACTIONS ---

async function deleteItem(type, id) {
    showOverlay(true);
    const endpoint = type === 'games' ? API_ENDPOINTS.GAME_ID(id) 
                   : type === 'rooms' ? API_ENDPOINTS.ROOM_ID(id)
                   : API_ENDPOINTS.USER_ID(id);
                   
    await fetchApi(endpoint, { method: 'DELETE' });
    showOverlay(false);
    // Socket sẽ tự update UI
}

async function toggleFeatured(id, checked) {
    await fetchApi(API_ENDPOINTS.GAME_ID(id), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ featured: checked })
    });
}

async function syncGames() {
    if (!confirm('Quét lại thư mục và đồng bộ CSDL?')) return;
    showOverlay(true);
    try {
        // Lấy danh sách file JSON gốc (nếu cần) hoặc chỉ gọi API sync
        const resSync = await fetchApi(API_ENDPOINTS.SYNC_GAMES, { method: 'POST' });
        alert(`Đồng bộ xong: ${resSync.updated} cập nhật, ${resSync.created} mới.`);
    } catch(e) { alert('Lỗi: ' + e.message); }
    showOverlay(false);
}

function logoutAdmin() {
    fetch(`${ADMIN_API}/admin/logout`, {method:'POST', credentials: 'include'})
      .finally(()=> location.href='/admin-login.html'); 
}

// --- FORM MODAL LOGIC ---
const modal = el('gameModal');
const form = el('gameForm');
let isEditing = false;

function openGameForm(game) {
    isEditing = !!game;
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
        form.reset();
        el('gameIdInput').disabled = false;
        el('gameIdOriginal').value = '';
    }
    modal.style.display = 'block';
}

if(modal) {
    document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
        btn.onclick = () => modal.style.display = 'none';
    });

    form.onsubmit = async (e) => {
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

        const url = isEditing ? API_ENDPOINTS.GAME_ID(payload.id) : API_ENDPOINTS.GAMES;
        const method = isEditing ? 'PUT' : 'POST';

        await fetchApi(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        modal.style.display = 'none';
        showOverlay(false);
    };
}

// Helper Debounce
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}