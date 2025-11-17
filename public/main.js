// public/main.js (MỚI)
// Chứa logic nghiệp vụ, gọi API, Socket, Auth, Room.
// File này nên được tải SAU script.js

// --- 1. Khởi tạo & Cấu hình ---
let allGames = [];
let featuredGames = [];
let gamesByCategory = {};
let sliderPage = { allGames: 0, featured: 0 };
let LANGS = {};
let currentLang = localStorage.getItem('lang') || 'vi';

// API & Socket URL (đã được định nghĩa trong HTML)
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
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/games`);
        let data = await res.json();
        if (!Array.isArray(data)) {
            console.error('API did not return an array of games:', data);
            data = [];
        }
        allGames = data;
        groupGames(allGames);
        sliderPage = { all: 0, featured: 0 };
        // Gọi hàm render
        renderSlider(allGames, 'allSlider', 'all');
        renderSlider(featuredGames, 'featuredSlider', 'featured');
        renderGamesByCategory();
    } catch (e) {
        console.error("Failed to fetch games:", e);
    } finally {
        showLoading(false);
    }
}

/** Tải dữ liệu ngôn ngữ */
async function fetchLang() {
    try {
        const res = await fetch('lang.json');
        LANGS = await res.json();
        setLang(currentLang, true); // Gọi setLang sau khi có data
        // Gán giá trị cho select
        const langSelect = document.getElementById('langSelect');
        if(langSelect) langSelect.value = currentLang;
    } catch (e) {
        console.error("Failed to fetch lang.json:", e);
    }
}

/** Phân nhóm game */
function groupGames(games) {
  games.sort((a, b) => (getGameName(a, 'vi')).localeCompare(getGameName(b, 'vi')));
  allGames = [...games];
  featuredGames = games.filter(g => g.featured === true);
  
  gamesByCategory = {};
  games.forEach(g => {
    const cat = getGameCategory(g, 'vi') || 'Khác';
    const cats = cat.split(',').map(c => c.trim());
    cats.forEach(c => {
        if (!gamesByCategory[c]) gamesByCategory[c] = [];
        gamesByCategory[c].push(g);
    });
  });
}

// --- 3. Logic Tìm kiếm & Sắp xếp ---

/** Logic tìm kiếm */
function searchGames() {
  const keyword = document.getElementById('searchInput').value.toLowerCase().trim();
  
  if (!keyword) {
    hideSearchResults(); // Hàm UI từ script.js
    return;
  }

  const filtered = allGames.filter(g =>
    getGameName(g).toLowerCase().includes(keyword) ||
    getGameDesc(g).toLowerCase().includes(keyword) ||
    getGameCategory(g).toLowerCase().includes(keyword)
  );

  renderSearchResults(filtered, keyword); // Hàm UI từ script.js
}
// Gán sự kiện cho ô tìm kiếm
document.getElementById('searchInput')?.addEventListener('input', searchGames);
document.querySelector('.search-bar button')?.addEventListener('click', searchGames);


/** Logic sắp xếp */
function sortGames(sectionKey, selectEl) {
  if (!selectEl) {
    selectEl = document.querySelector(`[onchange*="sortGames('${sectionKey}'"]`);
  }
  if (!selectEl) return;
  const sortBy = selectEl.value;

  let gamesArr;
  let sliderId;
  let containerId; // ID của container để render
  
  if (sectionKey.startsWith('cat-')) {
    const catName = sectionKey.replace(/^cat-/, '').replace(/-/g, ' ');
    gamesArr = gamesByCategory[catName] ? [...gamesByCategory[catName]] : [];
    containerId = `catGrid-${sectionKey.replace(/^cat-/, '')}`; // Sửa: Dùng ID của grid
  } else if (sectionKey === 'all') {
    gamesArr = [...allGames];
    sliderId = 'allSlider';
  } else if (sectionKey === 'featured') {
    gamesArr = [...featuredGames];
    sliderId = 'featuredSlider';
  } else {
    return;
  }

  // Logic sắp xếp
  if (sortBy === 'newest') gamesArr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if (sortBy === 'oldest') gamesArr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  // ... (các logic sort khác)
  else if (sortBy === 'az') gamesArr.sort((a, b) => getGameName(a).localeCompare(getGameName(b)));
  else if (sortBy === 'za') gamesArr.sort((a, b) => getGameName(b).localeCompare(getGameName(a)));

  // Sửa: Render lại
  if (sliderId) {
      // Nếu là slider (cuộn ngang)
      renderSlider(gamesArr, sliderId, sectionKey);
  } else if (containerId) {
      // Nếu là grid (thể loại)
      const container = document.getElementById(containerId);
      if (container) {
          container.innerHTML = gamesArr.map(renderGameCard).join('');
      }
  }
}

// --- 4. Logic Ngôn ngữ ---
function setLang(lang, firstLoad = false) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  updateLangUI(); // Hàm UI từ script.js
  
  // Render lại game nếu không phải lần tải đầu
  if (!firstLoad) {
    rerenderAllSliders(); // Hàm UI từ script.js
  }
}
// Gán sự kiện đổi ngôn ngữ
document.getElementById('langSelect')?.addEventListener('change', (e) => setLang(e.target.value));


// --- 5. Logic Xác thực (Authentication) ---

/** Lưu user vào local và cập nhật UI */
function saveUserToLocal(user) {
  try {
    if (!user || typeof user !== 'object') return;
    localStorage.setItem('user', JSON.stringify(user));
    if (user.token) localStorage.setItem('token', user.token);
    
    showUserInfo(user); // Hàm UI từ script.js

    // Gửi sự kiện registerSocket
    if (socket && user.username && !user.username.startsWith('guest_')) {
        socket.emit('registerSocket', user.username);
    }
  } catch (err) {
    console.error('saveUserToLocal error', err);
  }
}

/** Kiểm tra tính hợp lệ của đăng ký */
function validateRegister(username, password, password2) {
  const usernameRegex = /^[a-zA-Z0-9_.]{4,20}$/;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+]{6,}$/;
  if (!usernameRegex.test(username)) return 'Tên đăng nhập phải từ 4-20 ký tự, chỉ gồm chữ, số, _ hoặc .';
  if (!passwordRegex.test(password)) return 'Mật khẩu phải từ 6 ký tự, gồm cả chữ và số.';
  if (password !== password2) return 'Mật khẩu nhập lại không khớp.';
  return '';
}

/** Xử lý đăng ký */
document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const password2 = document.getElementById('register-password2').value;
  const msgEl = document.getElementById('register-message');
  
  const msg = validateRegister(username, password, password2);
  if (msg) {
    if(msgEl) msgEl.innerText = msg;
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName: username }) // Gửi username làm displayName
    });
    const data = await res.json();
    if(msgEl) msgEl.innerText = data.message || (res.ok ? 'Đăng ký thành công!' : 'Lỗi không xác định');
    if (res.ok) {
        showAuthTab('login'); // Hàm UI từ script.js
    }
  } catch(e) {
    if(msgEl) msgEl.innerText = 'Lỗi mạng, vui lòng thử lại.';
  }
});

/** Xử lý đăng nhập */
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const msgEl = document.getElementById('login-message');

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) {
            if(msgEl) msgEl.innerText = data.message || 'Đăng nhập thất bại';
            return;
        }
        
        if (data.token && data.user) {
            saveUserToLocal(data.user);
            closeAuthModal(); // Hàm UI từ script.js
            alert('Đăng nhập thành công!');
        } else {
            if(msgEl) msgEl.innerText = 'Phản hồi không hợp lệ từ server';
        }
    } catch (err) {
        console.error('[client] login error', err);
        if(msgEl) msgEl.innerText = 'Lỗi mạng khi đăng nhập.';
    }
});

/** Xử lý đăng nhập Google */
document.getElementById('googleLoginBtn').onclick = function() {
  window.location.href = `${API_BASE_URL}/auth/google`;
};

/** Xử lý đăng nhập Facebook (Placeholder) */
document.getElementById('facebookLoginBtn').onclick = function() {
  alert('Tính năng đăng nhập Facebook sẽ được bổ sung sau!');
};

/** Xử lý đăng nhập ẩn danh */
document.getElementById('anonymousLoginBtn').onclick = function() {
  const username = 'guest_' + Math.random().toString(36).substring(2, 10);
  const user = { username: username, displayName: username }; // Thêm displayName
  saveUserToLocal(user);
  closeAuthModal(); // Hàm UI
  alert('Bạn đã đăng nhập ẩn danh với tên: ' + username);
};

/** Xử lý đăng xuất */
document.getElementById('logoutBtn')?.addEventListener('click', function() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    hideUserInfo(); // Hàm UI
});


// --- 6. Logic Phòng chơi (Room) ---

/** Xử lý khi click vào game card */
function handleGameClick(gameId, gameName) {
  const modal = document.getElementById('roomModal');
  if (!modal) {
    console.error('Element #roomModal không tồn tại');
    return;
  }
  
  window.selectedGameId = gameId;
  window.selectedGameName = gameName;

  const game = allGames.find(g => g.id === gameId);
  let infoHtml = '';
  if (game) {
    const name = getGameName(game, currentLang);
    const desc = getGameDesc(game, currentLang);
    const players = game.players || '';
    const category = getGameCategory(game, currentLang);
    window.selectedGameType = category; // Lưu 'gameType' để gửi đi

    infoHtml = `
      <div class="modal-game-info" style="display:flex;flex-direction:column;align-items:center;margin-bottom:12px;">
        <img src="game/${game.id}/Img/logo.png" alt="${name}" style="width:64px;height:64px;border-radius:14px;margin-bottom:8px;box-shadow:0 2px 8px #ff980033;">
        <div class="modal-game-title" style="font-size:1.15rem;font-weight:700;color:#ff9800;margin-bottom:4px;text-align:center;">${name}</div>
        <div class="modal-game-desc" style="font-size:1rem;color:#444;text-align:center;margin-bottom:4px;">${desc}</div>
        <div class="modal-game-players" style="font-size:0.98rem;color:#43cea2;">👥 ${players} ${LANGS[currentLang]?.room_players || 'players'}</div>
      </div>
    `;
  }

  // Render lại nội dung modal (đây là phần UI, nhưng nó gắn liền với logic nên tạm để đây)
  modal.innerHTML = `
    <div class="modal-content">
      <button class="close-btn" id="closeRoomModal" style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:1.7rem;color:#ff9800;cursor:pointer;z-index:2;">&times;</button>
      ${infoHtml}
      <div class="modal-title" style="font-size:1.13rem;font-weight:bold;color:#ff9800;margin-bottom:18px;text-align:center;">${LANGS[currentLang]?.room_create_or_join || 'Tạo hoặc tham gia phòng'}</div>
      <div class="modal-actions" style="display:flex;gap:16px;margin-bottom:10px;flex-wrap:wrap;">
        <button id="createRoomBtn" style="padding:10px 28px;border-radius:10px;background:linear-gradient(90deg,#ff9800 60%,#ffc107 100%);color:#fff;font-weight:700;font-size:1.05rem;box-shadow:0 2px 8px #ff980033;transition:background 0.18s,transform 0.12s;">${LANGS[currentLang]?.room_create || 'Tạo phòng'}</button>
        <button id="joinRoomBtn" style="padding:10px 28px;border-radius:10px;background:linear-gradient(90deg,#ff9800 60%,#ffc107 100%);color:#fff;font-weight:700;font-size:1.05rem;box-shadow:0 2px 8px #ff980033;transition:background 0.18s,transform 0.12s;">${LANGS[currentLang]?.room_join || 'Tham gia'}</button>
      </div>
      <div id="joinRoomBox" style="display:none;margin-top:18px;text-align:center;">
        <input id="inputJoinRoomCode" placeholder="${LANGS[currentLang]?.room_input_placeholder || 'Nhập mã phòng'}" style="padding:8px 12px;border-radius:8px;border:1.5px solid #ffd54f;margin-right:8px;font-size:1rem;">
        <button id="confirmJoinRoomBtn" style="padding:8px 18px;border-radius:8px;background:#ff9800;color:#fff;font-weight:600;">${LANGS[currentLang]?.room_enter || 'Vào phòng'}</button>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';

  // Gán sự kiện cho các nút vừa tạo
  modal.querySelector('#closeRoomModal').onclick = () => modal.style.display = 'none';
  modal.querySelector('#createRoomBtn').onclick = handleCreateRoom;
  modal.querySelector('#joinRoomBtn').onclick = () => {
    const joinBox = modal.querySelector('#joinRoomBox');
    if(joinBox) joinBox.style.display = 'block';
  };
  modal.querySelector('#confirmJoinRoomBtn').onclick = handleJoinRoom;
}

/** Lấy tên user (ưu tiên displayName) */
function getActiveUsername() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const username = user.displayName || user.username || 'Guest_' + Math.random().toString(36).substring(2, 8);
    return username;
}


/** Gọi API tạo phòng */
async function handleCreateRoom() {
    const gameIdLocal = window.selectedGameId || '';
    const gameNameLocal = window.selectedGameName || '';
    const username = getActiveUsername(); // Dùng hàm helper

    const gameTypeLocal = window.selectedGameType || '';
    const roleLocal = 'host';

    if (!gameIdLocal || !username || !gameTypeLocal) {
      alert('Thiếu thông tin game, loại game hoặc người chơi!');
      return;
    }
    
    const payload = {
      player: username,
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
      if (!roomCode) {
        alert('Server không trả về mã phòng.');
        return;
      }
      
      // Chuyển hướng
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
      // Endpoint kiểm tra phòng
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

      const username = getActiveUsername(); // Dùng hàm helper

      // Chuyển hướng
      const qs = new URLSearchParams({
        code: code,
        gameId: data.room.game.gameId,
        game: data.room.game.type, // Lấy tên game từ server
        user: username
      }).toString();
      window.location.href = `/room.html?${qs}`;
    } catch (err) {
      console.error('[client] join room error', err);
      alert('Lỗi khi tham gia phòng: ' + (err && err.message));
    }
}


// --- 7. Logic Hồ sơ (Profile) --- (KHÔI PHỤC)

/** Gọi API cập nhật user (displayName và email) */
async function updateUserOnServer(payload) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/user`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
        });
        
        const data = await res.json(); // Đọc json dù thành công hay thất bại
        
        if (!res.ok) {
            console.warn('updateUserOnServer failed', res.status, data.message);
            return { success: false, message: data.message || 'Cập nhật thất bại' };
        }
        
        if (data && data.user) {
            localStorage.setItem('user', JSON.stringify(data.user)); // Cập nhật local
            return { success: true, user: data.user };
        }
        return { success: false, message: 'Server không trả về user' };
        
    } catch (err) {
        console.error('updateUserOnServer error', err);
        return { success: false, message: err.message };
    }
}

/** Xử lý khi người dùng submit form Cài đặt */
async function handleUpdateProfile(event) {
    event.preventDefault(); // Ngăn form submit
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.username) {
        alert("Lỗi: Không tìm thấy thông tin user. Vui lòng đăng nhập lại.");
        return;
    }

    const newDisplayName = document.getElementById('settings-displayName').value.trim();
    const newEmail = document.getElementById('settings-email').value.trim();
    
    if (!newDisplayName) {
        alert("Tên hiển thị không được để trống.");
        return;
    }
    
    // (Kiểm tra email cơ bản)
    if (newEmail && !newEmail.includes('@')) {
        alert("Vui lòng nhập email hợp lệ.");
        return;
    }

    const payload = {
        username: user.username, // Dùng username cũ để tìm
        displayName: newDisplayName,
        email: newEmail || user.email // Gửi email mới, nếu rỗng thì giữ email cũ
    };

    const result = await updateUserOnServer(payload);
        
    if(result.success && result.user) {
        saveUserToLocal(result.user); 
        alert('Cập nhật hồ sơ thành công!');
    } else {
        alert(`Cập nhật thất bại: ${result.message}`);
    }
    
    const modal = document.getElementById('profile-modal');
    if(modal) modal.style.display = 'none';
}

/** Mở modal Cài đặt (được gọi từ script.js) */
function openSettingsModal() {
    const modal = document.getElementById('profile-modal'); 
    if (!modal) {
        console.error("Modal #profile-modal không tìm thấy!");
        return;
    }
    
    // Nạp dữ liệu user hiện tại vào form
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const displayNameInput = document.getElementById('settings-displayName');
    const emailInput = document.getElementById('settings-email');
    
    if (displayNameInput) displayNameInput.value = user.displayName || user.username || '';
    if (emailInput) emailInput.value = user.email || '';
    
    // Nút đóng (đã gán ở script.js, nhưng gán lại cho chắc)
    const closeModalBtn = document.getElementById('closeProfileModal');
    if(closeModalBtn) closeModalBtn.onclick = () => modal.style.display = 'none';

    modal.style.display = 'flex';
}


// --- 8. Khởi chạy ---
document.addEventListener('DOMContentLoaded', function() {
    
    // Kiểm tra session đăng nhập
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            showUserInfo(JSON.parse(userStr)); // Hàm UI
        } catch {}
    }

    // Xử lý callback Google
    const params = new URLSearchParams(window.location.search);
    if (params.has('user')) {
        try {
            const user = JSON.parse(decodeURIComponent(params.get('user')));
            saveUserToLocal(user);
            // Xóa query param khỏi URL
            window.history.replaceState({}, document.title, window.location.pathname);
            alert('Đăng nhập Google thành công! Xin chào ' + (user.displayName || user.username));
        } catch(e) {
            console.error("Failed to parse Google user from URL", e);
        }
    }

    // Tải dữ liệu
    fetchLang();
    fetchGames();

    // Kết nối Socket
    if (socket) {
        socket.on('connect', () => {
            console.log('Socket connected:', socket.id);
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const username = user.username; // Dùng username (là duy nhất) để đăng ký socket
            if (username && !username.startsWith('guest_')) {
                socket.emit('registerSocket', username);
            }
        });
    }
    
    // Gán sự kiện Submit cho Form Cài đặt
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleUpdateProfile);
    }
});