const ADMIN_API = 'https://datn-socket.up.railway.app'; 

const API_ENDPOINTS = {
    STATS: `${ADMIN_API}/api/admin/stats`,
    USERS: `${ADMIN_API}/api/admin/users`,
    ROOMS: `${ADMIN_API}/api/admin/rooms`,
    GAMES: `${ADMIN_API}/api/admin/games`,
    REPORTS: `${ADMIN_API}/api/admin/reports`,
    SYNC_GAMES: `${ADMIN_API}/api/admin/games/sync`,
    
    USER_ID: (id) => `${ADMIN_API}/api/admin/users/${id}`,
    GAME_ID: (id) => `${ADMIN_API}/api/admin/games/${id}`,
    ROOM_ID: (id) => `${ADMIN_API}/api/admin/rooms/${id}`,
    REPORT_ID: (id) => `${ADMIN_API}/api/admin/reports/${id}`
};

let pageState = {
    users: 1,
    rooms: 1,
    games: 1,
    reports: 1
};

let currentDataCache = {
    users: [],
    rooms: [],
    games: [],
    reports: []
};

let pendingChanges = []; 

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

const el = id => document.getElementById(id);
const showOverlay = show => { const o = el('adminOverlay'); if(o) o.style.display = show ? 'flex' : 'none'; };

const gameModal = el('gameModal');
const gameForm = el('gameForm');
let isEditingGame = false; 

const userModal = el('userModal'); 
const userForm = el('userForm');
let isEditingUser = false; 

const addUserModal = el('addUserModal');
const addUserForm = el('addUserForm');

const reportModal = el('reportModal');
const reportForm = el('reportForm');
let isEditingReport = false;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupTabs();
    setupNavToggle();
    
    const btnAddGame = el('addGameBtn');
    if(btnAddGame) btnAddGame.onclick = () => openGameForm(null);
    
    const btnAddUser = el('addUserBtn');
    if(btnAddUser) btnAddUser.onclick = openAddUserForm;
    
    const btnSync = el('syncGamesBtn');
    if(btnSync) btnSync.onclick = syncGames;
    
    const btnLogout = el('logoutBtn');
    if(btnLogout) btnLogout.onclick = logoutAdmin;

    const btnRefresh = el('refreshDataBtn');
    if(btnRefresh) btnRefresh.onclick = loadData;
    
    if(el('usersSearch')) el('usersSearch').onkeyup = debounce(() => { pageState.users = 1; fetchUsers(el('usersSearch').value); }, 400);
    if(el('roomsSearch')) el('roomsSearch').onkeyup = debounce(() => { pageState.rooms = 1; fetchRooms(el('roomsSearch').value); }, 400);
    if(el('gamesSearch')) el('gamesSearch').onkeyup = debounce(() => { pageState.games = 1; fetchGames(el('gamesSearch').value); }, 400);
    if(el('reportsSearch')) el('reportsSearch').onkeyup = debounce(() => { pageState.reports = 1; fetchReports(el('reportsSearch').value); }, 400); // THÊM MỚI

    if(gameForm) gameForm.onsubmit = saveGame;
    if(userForm) userForm.onsubmit = saveUser; 
    if(addUserForm) addUserForm.onsubmit = saveNewUser; 
    if(reportForm) reportForm.onsubmit = saveReport;
    
    if(socket) {
        socket.on('admin-stats-update', () => { loadStats(); logActivity('Dashboard Stats Updated', 'info'); });
        socket.on('admin-users-changed', () => { fetchUsers(el('usersSearch')?.value || ''); logActivity('User list updated', 'info'); });
        socket.on('admin-rooms-changed', () => { fetchRooms(el('roomsSearch')?.value || ''); logActivity('Room list updated', 'warning'); });
        socket.on('admin-games-changed', () => { fetchGames(el('gamesSearch')?.value || ''); logActivity('Game list updated', 'info'); });
        socket.on('admin-reports-changed', () => { fetchReports(el('reportsSearch')?.value || ''); logActivity('Report list updated', 'warning'); });
    }

    const toggleAddPassBtn = el('toggleAddPassword');
    const addPasswordInput = el('addPasswordInput');

    if (toggleAddPassBtn && addPasswordInput) {
        toggleAddPassBtn.addEventListener('click', () => {
            const isPassword = addPasswordInput.type === 'password';
            addPasswordInput.type = isPassword ? 'text' : 'password';
            
            const icon = toggleAddPassBtn.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye', !isPassword);
                icon.classList.toggle('fa-eye-slash', isPassword);
            }
        });
    }
    setupTableDelegation();
    setupModals();
    loadData();

    const btnReports = document.getElementById('btn-reports');
    const reportsSection = document.getElementById('reports-section');
    const reportsTableBody = document.getElementById('reports-table-body');
    const reportsPagination = document.getElementById('reports-pagination');
    
    const adminReportModal = document.getElementById('adminReportModal');
    const closeAdminReportModal = document.getElementById('closeAdminReportModal');
    const adminReportForm = document.getElementById('adminReportForm');

    let currentReportsPage = 1;

    btnReports.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.main-content > section').forEach(s => s.style.display = 'none');
        reportsSection.style.display = 'block';
        document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
        btnReports.classList.add('active');
        loadReports(1);
    });

    const categoryMap = {
        'bug': 'Lỗi kỹ thuật', 'harass': 'Quấy rối', 'spam': 'Spam', 'other': 'Khác'
    };

    async function loadReports(page) {
        currentReportsPage = page;
        reportsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>';
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/report/admin?page=${page}&limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            reportsTableBody.innerHTML = '';
            if (data.reports.length === 0) {
                reportsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Chưa có báo cáo nào.</td></tr>';
            } else {
                data.reports.forEach(report => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${report._id.substring(0, 8)}...</td>
                        <td>${report.reporterName}</td>
                        <td><span class="badge badge-${report.category}">${categoryMap[report.category] || report.category}</span></td>
                        <td>${new Date(report.createdAt).toLocaleDateString()}</td>
                        <td><span class="badge status-${report.status}">${t('admin_report_status_' + report.status, report.status)}</span></td>
                        <td>
                            <button class="btn-action btn-view" data-id="${report._id}"><i class="fas fa-eye"></i> Xem</button>
                        </td>
                    `;
                    reportsTableBody.appendChild(row);
                });
            }
            renderPagination(reportsPagination, data.currentPage, data.totalPages, loadReports);
            updatePageLanguage(); 

            document.querySelectorAll('.btn-view').forEach(btn => {
                btn.addEventListener('click', () => openAdminReportModal(btn.dataset.id));
            });

        } catch (error) {
            console.error('Lỗi tải báo cáo:', error);
            reportsTableBody.innerHTML = '<tr><td colspan="6" style="color:red;text-align:center;">Lỗi tải dữ liệu.</td></tr>';
        }
    }

    async function openAdminReportModal(id) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/report/admin/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const report = await res.json();

            document.getElementById('editReportId').value = report._id;
            document.getElementById('detailReportId').textContent = report._id;
            document.getElementById('detailReporter').textContent = report.reporterName;
            document.getElementById('detailCategory').textContent = categoryMap[report.category] || report.category;
            document.getElementById('detailDate').textContent = new Date(report.createdAt).toLocaleString();
            document.getElementById('detailContentText').textContent = report.content;
            document.getElementById('detailStatus').value = report.status;
            document.getElementById('detailAdminNote').value = report.adminNote || '';

            adminReportModal.classList.remove('hidden');
        } catch (error) {
            console.error('Lỗi lấy chi tiết báo cáo:', error);
            alert('Không thể lấy thông tin báo cáo.');
        }
    }

    closeAdminReportModal.addEventListener('click', () => adminReportModal.classList.add('hidden'));

    adminReportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editReportId').value;
        const status = document.getElementById('detailStatus').value;
        const adminNote = document.getElementById('detailAdminNote').value;
        const token = localStorage.getItem('token');

        try {
            const res = await fetch(`/api/report/admin/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status, adminNote })
            });
            if (res.ok) {
                alert('Cập nhật báo cáo thành công!');
                adminReportModal.classList.add('hidden');
                loadReports(currentReportsPage); 
            } else {
                alert('Cập nhật thất bại.');
            }
        } catch (error) {
            console.error('Lỗi cập nhật:', error);
            alert('Lỗi server.');
        }
    });
});

function checkAuth() {
    if (!document.cookie.includes('admin_token')) {
        window.location.href = '/admin-login'; 
    }
}


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
    await Promise.all([
        fetchUsers(''),
        fetchRooms(''),
        fetchGames(''),
        fetchReports('')
    ]);
}

async function loadStats() {
    const data = await fetchApi(API_ENDPOINTS.STATS);
    if (data) {
        if(el('totalGames')) el('totalGames').innerText = data.totalGames || 0;
        if(el('totalRooms')) el('totalRooms').innerText = data.totalRooms || 0;
        if(el('onlineUsers')) el('onlineUsers').innerText = data.onlineUsers || 0;
        if(el('totalUsers')) el('totalUsers').innerText = data.totalUsers || 0;
        if(el('totalReports')) el('totalReports').innerText = data.totalReports || 0;
        
    }
}


async function fetchUsers(q) {
    const url = new URL(API_ENDPOINTS.USERS);
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('page', pageState.users);
    
    const j = await fetchApi(url.toString());
    if (j && j.data) {
        currentDataCache.users = j.data; 
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
        currentDataCache.games = j.data; 
        renderGamesTable(j.data);
        renderPagination('games', j, fetchGames);
    }
}

async function fetchReports(q) {
    const url = new URL(API_ENDPOINTS.REPORTS);
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('page', pageState.reports);
    
    const j = await fetchApi(url.toString());
    if (j && j.data) {
        currentDataCache.reports = j.data;
        renderReportsTable(j.data);
        renderPagination('reports', j, fetchReports);
    }
}

function formatDateTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleTimeString('vi-VN', options);
}

function renderPagination(type, meta, fetchFunc) {
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
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center">Không có dữ liệu</td></tr>`; 
        return;
    }

    tbody.innerHTML = users.map(u => {
        
        let historyHtml = 'Chưa có.';
        if (u.playHistory && u.playHistory.length > 0) {
            const recentHistory = u.playHistory.reverse(); 
            historyHtml = recentHistory.map(h => {
                const playedAtFormatted = new Date(h.playedAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric'});
                return `<div>${h.gameName} (${h.gameId}) - ${playedAtFormatted}</div>`;
            }).join('');
        }
        
        return `
            <tr>
                <td><div class="user-cell"><img src="https://api.dicebear.com/7.x/micah/svg?seed=${u.username}" alt="avt"><span>${u.username}</span></div></td>
                <td>${u.displayName || ''}</td>
                <td>${u.email || '-'}</td>
                <td>${u.googleId ? '<span class="badge google">Google</span>' : '<span class="badge local">Local</span>'}</td>
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

const categoryMap = {
    'bug': { text: 'Lỗi kỹ thuật', class: 'bug' },
    'harass': { text: 'Quấy rối', class: 'harass' },
    'spam': { text: 'Spam', class: 'spam' },
    'other': { text: 'Khác', class: 'other' }
};

const statusMap = {
    'pending': { text: 'Đang chờ', class: 'pending' },
    'reviewed': { text: 'Đang xem xét', class: 'reviewed' },
    'resolved': { text: 'Đã giải quyết', class: 'success' },
    'rejected': { text: 'Từ chối', class: 'danger' }
};

function renderReportsTable(reports) {
    const tbody = el('adminReportsList');
    if (!tbody) return;

    if (!reports.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">Không có báo cáo</td></tr>`;
        return;
    }

    tbody.innerHTML = reports.map(r => {
        const cat = categoryMap[r.category] || { text: r.category, class: 'default' };
        const stat = statusMap[r.status] || { text: r.status, class: 'default' };
        return `
            <tr>
                <td>${r._id.substring(0, 8)}...</td>
                <td>${r.reporterName}</td>
                <td><span class="badge badge-${cat.class}">${cat.text}</span></td>
                <td>${formatDateTime(r.createdAt)}</td>
                <td><span class="badge status-${stat.class}">${stat.text}</span></td>
                <td>
                    <button class="btn-action btn-view edit" data-id="${r._id}" data-type="report" title="Xem chi tiết"><i class="fas fa-eye"></i> Xem</button>
                </td>
            </tr>
        `;
    }).join('');
}

function setupTableDelegation() {
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

    const roomsList = el('adminRoomsList');
    if (roomsList) {
        roomsList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (btn && btn.classList.contains('delete')) {
                if(confirm('Đóng phòng này?')) deleteItem('rooms', btn.dataset.id);
            }
        });
    }

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


async function deleteItem(type, id) {
    if (!confirm('Xác nhận xóa/đóng item này?')) return;
    showOverlay(true);
    const endpoint = type === 'games' ? API_ENDPOINTS.GAME_ID(id) 
                   : type === 'rooms' ? API_ENDPOINTS.ROOM_ID(id)
                   : type === 'users' ? API_ENDPOINTS.USER_ID(id)
                   : API_ENDPOINTS.REPORT_ID(id);
                   
    const res = await fetchApi(endpoint, { method: 'DELETE' });
    if(res) logActivity(`Đã xóa/đóng ${type.toUpperCase()} ID: ${id}`, 'success');
    showOverlay(false);
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


function setupModals() {
    if(gameModal) {
        document.querySelectorAll('#gameModal .close-modal, #gameModal .close-modal-btn').forEach(btn => {
            btn.onclick = () => gameModal.style.display = 'none';
        });
    }
    if(userModal) {
        document.querySelectorAll('#userModal .close-modal, #userModal .close-modal-btn').forEach(btn => {
            btn.onclick = () => userModal.style.display = 'none';
        });
    }
    if(addUserModal) {
        document.querySelectorAll('#addUserModal .close-modal, #addUserModal .close-modal-btn').forEach(btn => {
            btn.onclick = () => addUserModal.style.display = 'none';
        });
    }
    if(reportModal) {
        document.querySelectorAll('#reportModal .close-modal, #reportModal .close-modal-btn').forEach(btn => {
            btn.onclick = () => reportModal.style.display = 'none';
        });
    }
}

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

function openAddUserForm() {
    if(addUserForm) addUserForm.reset();
    if (addUserModal) addUserModal.style.display = 'block';
}

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

    const url = API_ENDPOINTS.USERS; 
    const res = await fetchApi(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    if(res && res.ok) { 
        logActivity(`Đã thêm User mới: ${payload.username}`, 'success');
        if (addUserModal) addUserModal.style.display = 'none';
        fetchUsers(''); 
    } else {
        const message = res?.message || 'Lỗi không xác định khi tạo người dùng.';
        logActivity(`Tạo User thất bại: ${message}`, 'danger');
        alert(`Lỗi tạo người dùng: ${message}`);
    }
    
    showOverlay(false);
}

async function openReportModal(reportId) {
    isEditingReport = true;
    showOverlay(true);
    try {
        const report = await fetchApi(API_ENDPOINTS.REPORT_ID(reportId));
        if (!report) throw new Error('Không thể tải thông tin báo cáo');

        const cat = categoryMap[report.category] || { text: report.category };

        el('editReportId').value = report._id;
        el('detailReportId').textContent = report._id;
        el('detailReporter').textContent = report.reporterName;
        el('detailCategory').textContent = cat.text;
        el('detailDate').textContent = new Date(report.createdAt).toLocaleString('vi-VN');
        el('detailContentText').textContent = report.content;
        
        el('detailStatus').value = report.status;
        el('detailAdminNote').value = report.adminNote || '';

        if (reportModal) reportModal.style.display = 'block';
    } catch (e) {
        console.error(e);
        alert('Lỗi khi mở báo cáo: ' + e.message);
    } finally {
        showOverlay(false);
    }
}

async function saveReport(e) {
    e.preventDefault();
    showOverlay(true);

    const reportId = el('editReportId').value;
    const payload = {
        status: el('detailStatus').value,
        adminNote: el('detailAdminNote').value,
    };

    const url = API_ENDPOINTS.REPORT_ID(reportId);

    try {
        const res = await fetchApi(url, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        if(res && res.ok) {
            logActivity(`Báo cáo ${reportId} đã được cập nhật.`, 'success');
            if (reportModal) reportModal.style.display = 'none';
            // Cập nhật lại data trong cache và render lại bảng
            fetchReports(el('reportsSearch')?.value || '');
        } else {
            const msg = res?.error || 'Lỗi không xác định';
            alert('Cập nhật thất bại: ' + msg);
        }
    } catch (error) {
        console.error('Lỗi cập nhật báo cáo:', error);
        alert('Lỗi server khi cập nhật báo cáo.');
    } finally {
        showOverlay(false);
    }
}
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

    if (logList.children.length > 20) {
        logList.removeChild(logList.children[0]);
    }
    
    logList.appendChild(newItem);
    logList.scrollTop = logList.scrollHeight;
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

