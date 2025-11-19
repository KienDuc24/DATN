// public/main.js (FULL VERSION - FINAL - Đã sửa lỗi chặn click)

// --- 1. Khởi tạo & Cấu hình ---
let allGames = [];
let featuredGames = [];
let gamesByCategory = {};
let sliderPage = { allGames: 0, featured: 0 };
let LANGS = {};
let currentLang = localStorage.getItem('lang') || 'vi';

// API & Socket URL
const API_BASE_URL = window.BASE_API || 'https://datn-socket.up.railway.app';
const SOCKET_URL = window.SOCKET_URL || 'https://datn-socket.up.railway.app';

const socket = (typeof io === 'function') ? io(SOCKET_URL, {
  path: '/socket.io',
  transports: ['polling', 'websocket'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000
}) : null;

// --- 2. Tải dữ liệu (Data Fetching) & Xử lý ---

/** Tải danh sách game từ API */
async function fetchGames() {
    showLoading(true); // Hàm UI từ script.js
    try {
        const res = await fetch(`${API_BASE_URL}/api/games`);
        let data = await res.json();
        if (!Array.isArray(data)) {
            console.error('API did not return an array of games:', data);
            data = [];
        }
        allGames = data;
        groupGames(allGames);
    } catch (e) {
        console.error("fetchGames failed:", e);
    } finally {
        showLoading(false);
    }
}

/** Phân nhóm & Sắp xếp Game */
function groupGames(games) {
    // Mặc định sắp xếp theo mới nhất
    const sorted = sortGamesLogic(games, 'newest');
    allGames = sorted; 
    
    // Lọc game nổi bật
    featuredGames = allGames.filter(g => g.featured === true); 
    
    // Phân loại theo category
    gamesByCategory = {};
    allGames.forEach(game => {
        const cat = getGameCategory(game, currentLang); // Hàm helper từ script.js
        if (!gamesByCategory[cat]) {
            gamesByCategory[cat] = [];
        }
        gamesByCategory[cat].push(game);
    });

    // Render giao diện (Hàm từ script.js)
    if (typeof rerenderAllSliders === 'function') {
        rerenderAllSliders();
    }
}

/** Logic sắp xếp */
function sortGamesLogic(gamesList, method) {
    const games = [...gamesList]; 
    switch (method) {
        case 'newest':
            return games.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        case 'oldest':
            return games.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        case 'az':
            return games.sort((a, b) => getGameName(a).localeCompare(getGameName(b)));
        case 'za':
            return games.sort((a, b) => getGameName(b).localeCompare(getGameName(a)));
        case 'players_asc':
            return games.sort((a, b) => (parseInt(a.players) || 0) - (parseInt(b.players) || 0));
        case 'players_desc':
            return games.sort((a, b) => (parseInt(b.players) || 0) - (parseInt(a.players) || 0));
        default:
            return games;
    }
}

/** Sắp xếp và Render lại (được gọi bởi dropdown HTML) */
function sortGames(key, selectElement) {
    const method = selectElement.value;
    
    if (key === 'all') {
        const sorted = sortGamesLogic(allGames, method);
        renderSlider(sorted, 'allSlider', 'all');
    } else if (key === 'featured') {
        const sorted = sortGamesLogic(featuredGames, method);
        renderSlider(sorted, 'featuredSlider', 'featured');
    } else if (key.startsWith('cat-')) {
        const catKey = key.replace('cat-', '');
        // Tìm tên category gốc từ key
        const catName = Object.keys(gamesByCategory).find(k => k.replace(/\s+/g, '-') === catKey);
        if (catName) {
            const sorted = sortGamesLogic(gamesByCategory[catName], method);
            const sliderId = `catSlider-${catKey}`; 
            renderSlider(sorted, sliderId, key);
        }
    }
}

/** Tải file ngôn ngữ */
async function fetchLang() {
    try {
        const res = await fetch('/lang.json');
        LANGS = await res.json();
        setLang(currentLang);
    } catch (e) {
        console.error("fetchLang failed:", e);
    }
}

/** Đặt ngôn ngữ */
function setLang(lang) {
    if (!LANGS[lang]) lang = 'vi'; 
    currentLang = lang;
    localStorage.setItem('lang', lang);
    
    if (typeof updateLangUI === 'function') updateLangUI(); // Hàm UI từ script.js
    
    // Cập nhật lại nội dung game (vì category name thay đổi theo ngôn ngữ)
    if (allGames.length > 0) groupGames(allGames);
    
    // Cập nhật select box
    const langSelect = document.getElementById('langSelect');
    if(langSelect) langSelect.value = lang;
}

/** Tìm kiếm */
function searchGames() {
    const keyword = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (keyword.length < 2) {
        if (typeof hideSearchResults === 'function') hideSearchResults(); // Hàm UI
        return;
    }
    
    const filtered = allGames.filter(game => {
        return (
            getGameName(game, 'vi').toLowerCase().includes(keyword) ||
            getGameName(game, 'en').toLowerCase().includes(keyword) ||
            getGameCategory(game, 'vi').toLowerCase().includes(keyword) ||
            getGameCategory(game, 'en').toLowerCase().includes(keyword)
        );
    });
    
    if (typeof renderSearchResults === 'function') {
        renderSearchResults(filtered, keyword); // Hàm UI
    }
}


// --- 3. Logic Phòng (Room) & Chuyển hướng ---

/** Lấy tên user */
function getActiveUsername() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    // Luôn ưu tiên username. Nếu là guest thì username tự sinh.
    return user.username || 'Guest_' + Math.random().toString(36).substring(2, 8);
}

/** Xử lý khi click vào game card */
function handleGameClick(gameId, gameName) {
    // Kiểm tra đăng nhập
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.username && !user.isGuest) { // Nếu chưa đăng nhập gì cả
        openAuthModal('login');
        return;
    }

    // --- KIỂM TRA GAME ĐANG PHÁT TRIỂN (isComingSoon) ---
    // Tìm game trong danh sách đã tải
    const game = allGames.find(g => g.id === gameId);
    
    // Nếu game tồn tại VÀ có cờ isComingSoon = true
    if (game && game.isComingSoon) {
        // Lấy thông báo từ file ngôn ngữ, fallback an toàn nếu chưa tải xong
        const msg = (LANGS[currentLang] && LANGS[currentLang].game_developing) || "Game này đang được phát triển!";
        alert(msg);
        return; // DỪNG LẠI, KHÔNG MỞ MODAL
    }
    // ----------------------------------------------------

    const modal = document.getElementById('roomModal');
    if (!modal) return;
    
    window.selectedGameId = gameId;
    window.selectedGameName = gameName;
    
    let infoHtml = '';
    
    if (game) {
        window.selectedGameType = getGameCategory(game, currentLang);
        const name = getGameName(game, currentLang);
        const desc = getGameDesc(game, currentLang);
        const players = game.players || '';
        
        infoHtml = `
          <div class="modal-game-info" style="display:flex;flex-direction:column;align-items:center;margin-bottom:12px;">
            <img src="game/${game.id}/Img/logo.png" alt="${name}" style="width:64px;height:64px;border-radius:14px;margin-bottom:8px;box-shadow:0 2px 8px #ff980033;" onerror="this.src='img/fav.svg'">
            <div class="modal-game-title" style="font-size:1.15rem;font-weight:700;color:#ff9800;margin-bottom:4px;text-align:center;">${name}</div>
            <div class="modal-game-desc" style="font-size:1rem;color:#444;text-align:center;margin-bottom:4px;">${desc}</div>
            <div class="modal-game-players" style="font-size:0.98rem;color:#43cea2;">👥 ${players} ${LANGS[currentLang]?.room_players || 'players'}</div>
          </div>
        `;
    }
    
    // Render Modal Content đầy đủ
    modal.innerHTML = `
      <div class="modal-content">
        <button class="close-btn" id="closeRoomModal" style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:1.7rem;color:#ff9800;cursor:pointer;z-index:2;">&times;</button>
        ${infoHtml}
        <div class="modal-title" style="font-size:1.13rem;font-weight:bold;color:#ff9800;margin-bottom:18px;text-align:center;">
            ${LANGS[currentLang]?.room_create_or_join || 'Tạo hoặc tham gia phòng'}
        </div>
        <div class="modal-actions" style="display:flex;gap:16px;margin-bottom:10px;flex-wrap:wrap;justify-content:center;">
          <button id="createRoomBtn" style="padding:10px 28px;border-radius:10px;background:linear-gradient(90deg,#ff9800 60%,#ffc107 100%);color:#fff;font-weight:700;font-size:1.05rem;box-shadow:0 2px 8px #ff980033;transition:background 0.18s,transform 0.12s;">
            ${LANGS[currentLang]?.room_create || 'Tạo phòng'}
          </button>
          <button id="joinRoomBtn" style="padding:10px 28px;border-radius:10px;background:linear-gradient(90deg,#ff9800 60%,#ffc107 100%);color:#fff;font-weight:700;font-size:1.05rem;box-shadow:0 2px 8px #ff980033;transition:background 0.18s,transform 0.12s;">
            ${LANGS[currentLang]?.room_join || 'Tham gia'}
          </button>
        </div>
        <div id="joinRoomBox" style="display:none;margin-top:18px;text-align:center;width:100%;">
          <input id="inputJoinRoomCode" placeholder="${LANGS[currentLang]?.room_input_placeholder || 'Nhập mã phòng'}" style="padding:8px 12px;border-radius:8px;border:1.5px solid #ffd54f;margin-bottom:8px;font-size:1rem;width:100%;box-sizing:border-box;">
          <button id="confirmJoinRoomBtn" style="padding:8px 18px;border-radius:8px;background:#ff9800;color:#fff;font-weight:600;width:100%;">
            ${LANGS[currentLang]?.room_enter || 'Vào phòng'}
          </button>
        </div>
      </div>
    `;
    
    modal.style.display = 'flex';

    // Gán sự kiện
    modal.querySelector('#closeRoomModal').onclick = () => modal.style.display = 'none';
    modal.querySelector('#createRoomBtn').onclick = handleCreateRoom;
    modal.querySelector('#joinRoomBtn').onclick = () => {
        const joinBox = modal.querySelector('#joinRoomBox');
        if(joinBox) joinBox.style.display = 'block';
    };
    modal.querySelector('#confirmJoinRoomBtn').onclick = handleJoinRoom;
}

/** Gọi API tạo phòng */
async function handleCreateRoom() {
    const gameIdLocal = window.selectedGameId;
    const gameNameLocal = window.selectedGameName;
    const username = getActiveUsername(); 

    const gameTypeLocal = window.selectedGameType || '';
    const roleLocal = 'host';

    if (!gameIdLocal || !username || !gameTypeLocal) {
      alert('Thiếu thông tin game hoặc người chơi!');
      return;
    }
    
    const payload = {
      player: username, // Gửi username lên server
      game: gameIdLocal,
      gameType: gameTypeLocal,
      role: roleLocal
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Lỗi không xác định' }));
        throw new Error(error.error || 'Tạo phòng thất bại');
      }

      const data = await res.json();
      const roomCode = data.roomCode || (data.room && data.room.code);
      
      // Chuyển hướng: Truyền username qua URL
      const qs = new URLSearchParams({
        code: roomCode,
        gameId: gameIdLocal,
        game: gameNameLocal,
        user: username 
      }).toString();
      window.location.href = `/room.html?${qs}`;

    } catch (err) {
      console.error('[client] create room error', err);
      alert('Lỗi khi tạo phòng: ' + (err && err.message));
    }
}

/** Gọi API tham gia phòng */
async function handleJoinRoom() {
    const modal = document.getElementById('roomModal');
    const code = modal.querySelector('#inputJoinRoomCode').value.trim().toUpperCase();
    const gameId = window.selectedGameId || '';

    if (!code || !gameId) {
      alert('Thiếu mã phòng hoặc gameId!');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/room?code=${encodeURIComponent(code)}&gameId=${encodeURIComponent(gameId)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({message: 'Phòng không tìm thấy.'}));
        alert(errData.message || 'Lỗi khi kiểm tra phòng.');
        return;
      }
      const data = await res.json();
      if (!data.found || !data.room) {
        alert('Phòng không tồn tại hoặc không hợp lệ.');
        return;
      }

      const username = getActiveUsername(); 

      const qs = new URLSearchParams({
        code: code,
        gameId: data.room.game.gameId,
        game: data.room.game.type,
        user: username 
      }).toString();
      window.location.href = `/room.html?${qs}`;
    } catch (err) {
      console.error('[client] join room error', err);
      alert('Lỗi khi tham gia phòng: ' + (err && err.message));
    }
}


// --- 4. Logic Xác thực (Authentication) ---

/** Lưu user vào LocalStorage và cập nhật UI */
function saveUserToLocal(user) {
    localStorage.setItem('user', JSON.stringify(user));
    showUserInfo(user); 
    closeAuthModal();
    if (socket && user.username && !user.username.startsWith('guest_')) {
        socket.emit('registerSocket', user.username);
    }
}

/** Xử lý Đăng xuất (Đảm bảo cleanup và chuyển hướng sạch sẽ) */
async function handleLogout() {
    showLoading(true);
    try {
        await fetch(`${API_BASE_URL}/api/logout`, { 
            method: 'POST', 
            credentials: 'include' 
        });
    } catch (e) {
        console.error("Logout failed (fetch error):", e);
    } finally {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        hideUserInfo(); 
        showLoading(false);
        // Chuyển hướng về trang chủ chính
        window.location.href = "/index.html"; 
    }
}


/** Xử lý Cập nhật Profile (FIX LỖI 404 API) */
async function handleUpdateProfile(e) {
    e.preventDefault();
    const displayName = document.getElementById('settings-displayName').value;
    const email = document.getElementById('settings-email').value;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!user.username || user.isGuest) return alert('Lỗi: Bạn phải đăng nhập để cập nhật hồ sơ.');
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/user`, { // Đảm bảo gọi PUT /api/user
            method: 'PUT', 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                username: user.username,
                displayName: displayName, 
                email: email 
            })
        });
        
        if (!res.ok) {
            // Xử lý nếu phản hồi không thành công (400, 404, 500)
            const contentType = res.headers.get("content-type");
            let errorMsg = `Lỗi ${res.status}: ${res.statusText}.`;
            
            if (contentType && contentType.indexOf("application/json") !== -1) {
                // Nếu là JSON, đọc thông báo lỗi từ server
                const errorData = await res.json();
                errorMsg = errorData.message || errorMsg;
            } else {
                // Nếu là HTML (như lỗi 404/500 mặc định), báo lỗi API không tìm thấy
                throw new Error(`API ${res.status} Lỗi: Endpoint cập nhật hồ sơ không tìm thấy hoặc Server bị lỗi.`);
            }
            throw new Error(errorMsg);
        }
        
        // Nếu thành công, phản hồi là JSON
        const updatedUser = await res.json();
        
        saveUserToLocal(updatedUser.user); 
        document.getElementById('profile-modal').style.display = 'none';
        alert('Cập nhật thông tin thành công!');
        
    } catch (err) {
        console.error("Update profile failed:", err);
        // Hiển thị thông báo lỗi rõ ràng hơn
        alert(`CẬP NHẬT THẤT BẠI: ${err.message}`);
    }
}

function openSettingsModal() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.username) return;
    
    document.getElementById('settings-displayName').value = user.displayName || '';
    document.getElementById('settings-email').value = user.email || '';
    
    document.getElementById('profile-modal').style.display = 'flex';
}

// --- 5. Khởi chạy (Initialization) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    
    // Login Google
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    if (googleLoginBtn) {
        googleLoginBtn.onclick = () => {
            window.location.href = `${API_BASE_URL}/auth/google`;
        };
    }
    
    // Login Guest
    const anonymousLoginBtn = document.getElementById('anonymousLoginBtn');
    if (anonymousLoginBtn) {
        anonymousLoginBtn.onclick = () => {
            const guestUser = {
                username: 'guest_' + Date.now(),
                displayName: 'Khách',
                isGuest: true
            };
            saveUserToLocal(guestUser);
        };
    }
    
    // Login Normal
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('login-username').value;
            const p = document.getElementById('login-password').value;
            const msg = document.getElementById('login-message');
            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: u, password: p })
                });
                const data = await res.json();
                if (!res.ok) {
                    if(msg) msg.innerText = data.message || 'Lỗi đăng nhập';
                } else {
                    saveUserToLocal(data.user);
                    alert('Đăng nhập thành công');
                }
            } catch(err) { console.error(err); if(msg) msg.innerText = 'Lỗi mạng'; }
        });
    }

    // Register Normal
    const regForm = document.getElementById('registerForm');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('register-username').value;
            const p = document.getElementById('register-password').value;
            const p2 = document.getElementById('register-password2').value;
            const msg = document.getElementById('register-message');
            
            if(p !== p2) { if(msg) msg.innerText = 'Mật khẩu không khớp'; return; }
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: u, password: p })
                });
                const data = await res.json();
                if (!res.ok) {
                    if(msg) msg.innerText = data.message || 'Lỗi đăng ký';
                } else {
                    alert('Đăng ký thành công');
                    showAuthTab('login');
                }
            } catch(err) { console.error(err); if(msg) msg.innerText = 'Lỗi mạng'; }
        });
    }

    // Check Session
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            showUserInfo(JSON.parse(userStr));
        } catch {}
    }

    // Google Callback
    const params = new URLSearchParams(window.location.search);
    if (params.has('user')) {
        try {
            const user = JSON.parse(decodeURIComponent(params.get('user')));
            saveUserToLocal(user);
            window.history.replaceState({}, document.title, window.location.pathname);
            alert('Đăng nhập Google thành công! Xin chào ' + (user.displayName || user.username));
        } catch(e) {
            console.error("Failed to parse Google user from URL", e);
        }
    }

    // Load Data
    fetchLang();
    fetchGames();

    // Socket Listeners
    if (socket) {
        socket.on('connect', () => {
            console.log('Socket connected:', socket.id);
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const username = user.username;
            if (username && !username.startsWith('guest_')) {
                socket.emit('registerSocket', username);
            }
        });
        
        // --- QUAN TRỌNG: Lắng nghe thay đổi từ Admin ---
        socket.on('admin-games-changed', () => {
            console.log('Game list updated from admin.');
            fetchGames(); // Tải lại danh sách game
        });
        // ----------------------------------------------
    }
    
    // Settings
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleUpdateProfile);
    }
});