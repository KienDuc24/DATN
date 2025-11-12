// js/main.js

// --- STATE TOÀN CỤC ---
let allGames = [];
let recentGames = [];
let topGames = [];
let featuredGames = [];
let newGames = [];
let gamesByCategory = {};

const BASE_API_URL = 'https.://datn-socket.up.railway.app'; // URL server
let sliderPage = { recent: 0, top: 0, featured: 0, new: 0 };
let MAX_SHOW = getMaxShow();

let LANGS = {};
let currentLang = localStorage.getItem('lang') || 'vi';

// Biến lưu game đang chọn cho modal phòng
let selectedGameId = null;
let selectedGameName = null;


// --- HÀM TIỆN ÍCH CHUNG (Không thuộc Auth/Profile) ---

function showLoading(show = true) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getMaxShow() {
  if (window.innerWidth <= 600) return 2;
  if (window.innerWidth <= 900) return 3;
  if (window.innerWidth <= 1200) return 4;
  return 5;
}

// Lấy tên, mô tả, thể loại game đa ngôn ngữ
function getGameName(game, lang = currentLang) {
  if (!game) return '';
  if (typeof game.name === 'string') return game.name;
  return game.name?.[lang] || game.name?.vi || game.name?.en || '';
}
function getGameDesc(game, lang = currentLang) {
  if (!game) return '';
  if (typeof game.desc === 'string') return game.desc;
  return game.desc?.[lang] || game.desc?.vi || game.desc?.en || '';
}
function getGameCategory(game, lang = currentLang) {
  if (!game) return '';
  if (typeof game.category === 'string') return game.category;
  return game.category?.[lang] || game.category?.vi || game.category?.en || '';
}

// --- LOGIC GIAO DIỆN CHUNG ---

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
  }
}

function toggleCategory(catId) {
  const content = document.getElementById(`${catId}-content`);
  const arrow = document.getElementById(`${catId}-arrow`);
  if (!content || !arrow) return;
  
  if (content.style.display === 'none' || content.style.display === '') {
    content.style.display = 'block';
    arrow.innerHTML = '&#9660;'; // Mũi tên xuống
  } else {
    content.style.display = 'none';
    arrow.innerHTML = '&#9654;'; // Mũi tên sang phải
  }
}

function showMobileSearch() {
  const header = document.querySelector('.header-main');
  if (header) {
    header.classList.add('mobile-searching');
    setTimeout(() => {
      document.getElementById('searchInput')?.focus();
    }, 100);
  }
}

// --- LOGIC NGÔN NGỮ ---

function setLang(lang, firstLoad = false) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  updateLangUI();
  
  // Render lại game khi đổi ngôn ngữ
  if (!firstLoad) {
    rerenderAllSliders();
  }
}

function updateLangUI() {
  if (!LANGS[currentLang]) return;
  const langData = LANGS[currentLang];

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (langData[key]) {
      const icon = el.querySelector('.icon, .eye-icon');
      el.innerHTML = (icon ? icon.outerHTML : '') + ' ' + langData[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (langData[key]) el.placeholder = langData[key];
  });
  
  document.querySelectorAll('.sort-select').forEach(select => {
    select.querySelectorAll('option').forEach(opt => {
      const key = opt.getAttribute('data-i18n');
      if (key && langData[key]) {
        opt.textContent = langData[key];
      }
    });
  });
  
  document.querySelectorAll('.sort-label').forEach(el => {
    el.textContent = langData.sort_by || 'Sắp xếp theo';
  });
}

// --- LOGIC GAME (RENDER, SORT, SEARCH) ---

function renderGameCard(game) {
  const name = getGameName(game, currentLang);
  const desc = getGameDesc(game, currentLang);
  const category = getGameCategory(game, currentLang);
  
  const card = document.createElement('div');
  card.className = 'game-card';
  card.innerHTML = `
    ${game.badge ? `<div class="game-badge">${game.badge}</div>` : ""}
    <img src="game/${game.id}/Img/logo.png" alt="${name}" />
    <div class="game-title">${name}</div>
    <div class="game-category">${category}</div>
    <div class="game-desc">${desc}</div>
    ${game.players ? `<div class="game-players">👥 ${game.players} ${LANGS[currentLang]?.players || ''}</div>` : ""}
  `;
  
  // Gán sự kiện click để mở modal phòng
  card.onclick = () => handleGameClick(game.id, name.replace(/'/g, "\\'"));
  return card;
}

function renderSlider(games, sliderId, pageKey) {
  const slider = document.getElementById(sliderId);
  const sliderContainer = slider?.parentElement;
  if (!sliderContainer || !slider) return;

  sliderContainer.querySelectorAll('.slider-btn').forEach(btn => btn.remove());

  let page = sliderPage[pageKey] || 0;
  const totalPage = Math.ceil(games.length / MAX_SHOW);

  const start = page * MAX_SHOW;
  const end = Math.min(start + MAX_SHOW, games.length);
  const showGames = games.slice(start, end);

  slider.innerHTML = ''; // Xóa nội dung cũ
  showGames.map(renderGameCard).forEach(cardElement => {
    slider.appendChild(cardElement);
  });

  if (games.length > MAX_SHOW) {
    if (page > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'slider-btn left';
      prevBtn.innerHTML = '&#8249;';
      prevBtn.onclick = () => {
        sliderPage[pageKey]--;
        renderSlider(games, sliderId, pageKey);
      };
      sliderContainer.insertBefore(prevBtn, slider);
    }
    if (end < games.length) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'slider-btn right';
      nextBtn.innerHTML = '&#8250;';
      nextBtn.onclick = () => {
        sliderPage[pageKey]++;
        renderSlider(games, sliderId, pageKey);
      };
      sliderContainer.appendChild(nextBtn);
    }
  }
}

function groupGames(games) {
  games.sort((a, b) => (getGameName(a, 'vi')).localeCompare(getGameName(b, 'vi')));
  
  recentGames = [...games];
  topGames = games.filter(g => g.badge === "Hot" || g.badge === "Top");
  featuredGames = games.filter(g => g.badge === "Hot" || g.badge === "Updated");
  newGames = games.filter(g => g.badge === "New");
  
  gamesByCategory = {};
  games.forEach(g => {
    const cats = (getGameCategory(g, 'vi') || 'Khác').split(',').map(c => c.trim());
    cats.forEach(cat => {
      if (!gamesByCategory[cat]) gamesByCategory[cat] = [];
      gamesByCategory[cat].push(g);
    });
  });
}

function renderGamesByCategory() {
  const categoryList = document.getElementById('category-list');
  if (!categoryList) return;
  
  categoryList.innerHTML = '';
  
  Object.keys(gamesByCategory).sort().forEach(cat => {
    const catKey = cat.replace(/\s+/g, '-');
    const section = document.createElement('div');
    section.className = 'category-slider-section';
    section.innerHTML = `
      <div class="section-title-row" id="cat-${catKey}">
        <div class="section-title">${cat}</div>
      </div>
      ${renderSortDropdown(`cat-${catKey}`)}
      <div class="games-slider-container" id="cat-container-${catKey}">
        <div class="games-slider" id="catSlider-${catKey}"></div>
      </div>
    `;
    categoryList.appendChild(section);

    if (!sliderPage[`cat-${catKey}`]) sliderPage[`cat-${catKey}`] = 0;
    renderSlider(
      gamesByCategory[cat],
      `catSlider-${catKey}`,
      `cat-${catKey}`
    );
  });
}

function renderSortDropdown(key = '') {
  return `
    <div class="sort-dropdown-row">
      <label class="sort-label" data-i18n="sort_by">Sắp xếp theo</label>
      <div class="sort-dropdown">
        <select class="sort-select" onchange="sortGames(event, '${key}')">
          <option value="newest" data-i18n="sort_newest">Mới nhất</option>
          <option value="oldest" data-i18n="sort_oldest">Cũ nhất</option>
          <option value="players_asc" data-i18n="sort_players_asc">Người chơi (tăng)</option>
          <option value="players_desc" data-i18n="sort_players_desc">Người chơi (giảm)</option>
          <option value="az" data-i18n="sort_az">Tên (A-Z)</option>
          <option value="za" data-i18n="sort_za">Tên (Z-A)</option>
        </select>
      </div>
    </div>
  `;
}

function sortGames(event, sectionKey) {
  const selectEl = event.target;
  const sortBy = selectEl.value;

  let gamesArr;
  if (sectionKey.startsWith('cat-')) {
    const catTitleEl = document.getElementById(sectionKey)?.querySelector('.section-title');
    const catName = catTitleEl ? catTitleEl.innerText : '';
    gamesArr = gamesByCategory[catName] ? [...gamesByCategory[catName]] : [];
  } else if (sectionKey === 'recent') {
    gamesArr = [...recentGames];
  } else if (sectionKey === 'top') {
    gamesArr = [...topGames];
  } else if (sectionKey === 'featured') {
    gamesArr = [...featuredGames];
  } else if (sectionKey === 'new') {
    gamesArr = [...newGames];
  } else {
    return;
  }

  if (sortBy === 'newest') {
    gamesArr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sortBy === 'oldest') {
    gamesArr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sortBy === 'players_asc') {
    gamesArr.sort((a, b) => (a.players || 0) - (b.players || 0));
  } else if (sortBy === 'players_desc') {
    gamesArr.sort((a, b) => (b.players || 0) - (a.players || 0));
  } else if (sortBy === 'az') {
    gamesArr.sort((a, b) => getGameName(a).localeCompare(getGameName(b)));
  } else if (sortBy === 'za') {
    gamesArr.sort((a, b) => getGameName(b).localeCompare(getGameName(a)));
  }

  sliderPage[sectionKey] = 0; // Reset về trang đầu
  renderSlider(
    gamesArr,
    sectionKey.startsWith('cat-') ? `catSlider-${sectionKey.replace(/^cat-/, '')}` : `${sectionKey}Slider`,
    sectionKey
  );
}

function searchGames() {
  const keyword = document.getElementById('searchInput').value.toLowerCase().trim();
  const main = document.querySelector('.main-content');
  let searchResultDiv = document.getElementById('search-result');

  if (!main) return;

  Array.from(main.children).forEach(child => {
    if (child.id !== 'search-result') {
      child.style.display = keyword ? 'none' : '';
    }
  });

  if (!searchResultDiv) {
    searchResultDiv = document.createElement('div');
    searchResultDiv.id = 'search-result';
    main.appendChild(searchResultDiv);
  }
  
  if (!keyword) {
    searchResultDiv.style.display = 'none';
    return;
  }

  searchResultDiv.style.display = 'block';

  const filtered = allGames.filter(g =>
    getGameName(g).toLowerCase().includes(keyword) ||
    getGameDesc(g).toLowerCase().includes(keyword) ||
    getGameCategory(g).toLowerCase().includes(keyword)
  );

  if (filtered.length === 0) {
    searchResultDiv.innerHTML = `<div class="section-title-row"><div class="section-title">Không tìm thấy trò chơi phù hợp cho "<span style="color:#ff9800">${keyword}</span>".</div></div>`;
    return;
  }

  function highlight(text) {
    text = (text === undefined || text === null) ? '' : String(text);
    if (!text) return '';
    return text.replace(
      new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
      '<span style="background:#ff9800;color:#fff;border-radius:4px;padding:1px 4px;">$1</span>'
    );
  }

  searchResultDiv.innerHTML = `
    <div class="section-title-row">
      <div class="section-title">Kết quả tìm kiếm cho "<span style="color:#ff9800">${keyword}</span>"</div>
    </div>
    <div class="games-slider" style="flex-wrap:wrap;gap:32px 24px;"></div>
  `;
  
  const sliderContainer = searchResultDiv.querySelector('.games-slider');
  filtered.forEach(game => {
    const card = renderGameCard(game);
    // Áp dụng highlight cho card vừa tạo
    card.querySelector('.game-title').innerHTML = highlight(getGameName(game));
    card.querySelector('.game-category').innerHTML = highlight(getGameCategory(game));
    card.querySelector('.game-desc').innerHTML = highlight(getGameDesc(game));
    if (game.players) {
        card.querySelector('.game-players').innerHTML = `👥 ${highlight(String(game.players))} ${LANGS[currentLang]?.players || 'người chơi'}`;
    }
    sliderContainer.appendChild(card);
  });
}

function rerenderAllSliders() {
  MAX_SHOW = getMaxShow();
  renderSlider(recentGames, 'recentSlider', 'recent');
  renderSlider(topGames, 'topSlider', 'top');
  renderSlider(featuredGames, 'featuredSlider', 'featured');
  renderSlider(newGames, 'newSlider', 'new');
  renderGamesByCategory();
  updateLangUI(); // Cập nhật lại text
}

// --- LOGIC MODAL PHÒNG GAME ---

function handleGameClick(gameId, gameName) {
  selectedGameId = gameId;
  selectedGameName = gameName;
  
  const modal = document.getElementById('roomModal');
  if (!modal) return;
  
  modal.style.display = 'flex';

  const game = allGames.find(g => g.id === gameId);
  let infoHtml = '';
  if (game) {
    const name = getGameName(game, currentLang);
    const desc = getGameDesc(game, currentLang);
    const players = game.players || '';
    infoHtml = `
      <div class="modal-game-info" style="display:flex;flex-direction:column;align-items:center;margin-bottom:12px;">
        <img src="game/${game.id}/Img/logo.png" alt="${name}" style="width:64px;height:64px;border-radius:14px;margin-bottom:8px;box-shadow:0 2px 8px #ff980033;">
        <div class="modal-game-title" style="font-size:1.15rem;font-weight:700;color:#ff9800;margin-bottom:4px;text-align:center;">${name}</div>
        <div class="modal-game-desc" style="font-size:1rem;color:#444;text-align:center;margin-bottom:4px;">${desc}</div>
        <div class="modal-game-players" style="font-size:0.98rem;color:#43cea2;">👥 ${players} ${LANGS[currentLang]?.room_players || 'players'}</div>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="modal-content">
      <button class="close-btn" id="closeRoomModal" style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:1.7rem;color:#ff9800;cursor:pointer;z-index:2;">&times;</button>
      ${infoHtml}
      <div class="modal-title" style="font-size:1.13rem;font-weight:bold;color:#ff9800;margin-bottom:18px;text-align:center;">${LANGS[currentLang]?.room_create_or_join || 'Create or join a room'}</div>
      <div class="modal-actions" style="display:flex;gap:16px;margin-bottom:10px;flex-wrap:wrap;">
        <button id="createRoomBtn" style="padding:10px 28px;border-radius:10px;background:linear-gradient(90deg,#ff9800 60%,#ffc107 100%);color:#fff;font-weight:700;font-size:1.05rem;box-shadow:0 2px 8px #ff980033;transition:background 0.18s,transform 0.12s;">${LANGS[currentLang]?.room_create || 'Create Room'}</button>
        <button id="joinRoomBtn" style="padding:10px 28px;border-radius:10px;background:linear-gradient(90deg,#ff9800 60%,#ffc107 100%);color:#fff;font-weight:700;font-size:1.05rem;box-shadow:0 2px 8px #ff980033;transition:background 0.18s,transform 0.12s;">${LANGS[currentLang]?.room_join || 'Join Room'}</button>
      </div>
      <div id="joinRoomBox" style="display:none;margin-top:18px;text-align:center;">
        <input id="inputJoinRoomCode" placeholder="${LANGS[currentLang]?.room_input_placeholder || 'Enter room code'}" style="padding:8px 12px;border-radius:8px;border:1.5px solid #ffd54f;margin-right:8px;font-size:1rem;">
        <button id="confirmJoinRoomBtn" style="padding:8px 18px;border-radius:8px;background:#ff9800;color:#fff;font-weight:600;">${LANGS[currentLang]?.room_enter || 'Enter Room'}</button>
      </div>
    </div>
  `;

  // Gán sự kiện
  modal.querySelector('#closeRoomModal').onclick = () => modal.style.display = 'none';
  modal.querySelector('#createRoomBtn').onclick = onCreateRoom;
  modal.querySelector('#joinRoomBtn').onclick = () => {
    modal.querySelector('#joinRoomBox').style.display = 'block';
  };
  modal.querySelector('#confirmJoinRoomBtn').onclick = onJoinRoom;
}

async function onCreateRoom() {
  const user = getUserSafe() || {};
  const username = user.username || user.displayName || 'Guest';

  if (!selectedGameId || !username) {
    alert('Thiếu thông tin game hoặc người chơi.');
    return;
  }

  try {
    const res = await fetch(`${BASE_API_URL}/api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: username, game: selectedGameId })
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to create room');
    }

    const data = await res.json();
    const roomCode = data.roomCode || data.code || (data.room && (data.room.id || data.room._id));
    if (!roomCode) {
      alert('Server không trả về mã phòng.');
      return;
    }

    const qs = new URLSearchParams({
      code: roomCode,
      gameId: selectedGameId,
      game: selectedGameName,
      user: username
    }).toString();
    window.location.href = `/room.html?${qs}`;
  } catch (err) {
    console.error('[client] create room error', err);
    alert('Lỗi khi tạo phòng: ' + err.message);
  }
}

async function onJoinRoom() {
  const modal = document.getElementById('roomModal');
  const code = modal.querySelector('#inputJoinRoomCode').value.trim().toUpperCase();
  
  if (!code || !selectedGameId) {
    alert('Thiếu mã phòng hoặc game!');
    return;
  }

  try {
    const res = await fetch(`${BASE_API_URL}/api/room?code=${encodeURIComponent(code)}&gameId=${encodeURIComponent(selectedGameId)}`);
    if (!res.ok) {
      alert('Không tìm thấy phòng. Vui lòng kiểm tra lại mã phòng.');
      return;
    }
    
    const data = await res.json();
    if (!data.found || !data.room) {
      alert('Phòng không tồn tại hoặc không hợp lệ.');
      return;
    }

    const user = getUserSafe() || {};
    const username = user.username || user.displayName || 'Guest';

    const qs = new URLSearchParams({
      code: code,
      gameId: data.room.game.gameId,
      game: data.room.game.type,
      user: username
    }).toString();
    window.location.href = `/room.html?${qs}`;
  } catch (err) {
    console.error('[client] join room error', err);
    alert('Lỗi khi tham gia phòng: ' + err.message);
  }
}


// --- SOCKET.IO ---

const SOCKET_URL = window.SOCKET_URL || window.__BASE_API__ || window.location.origin;
const socket = (typeof io === 'function') ? io(SOCKET_URL, {
  path: '/socket.io',
  transports: ['polling', 'websocket'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000
}) : null;

if (socket) {
  socket.on('connect', () => console.log('Socket.IO connected:', socket.id));
  socket.on('disconnect', () => console.log('Socket.IO disconnected'));
} else {
  console.warn('Socket.IO (io) not found. Socket features will be disabled.');
}


// --- KHỞI TẠO ỨNG DỤNG ---

document.addEventListener('DOMContentLoaded', function() {
  
  // 1. Khởi tạo các module (từ auth.js và profile.js)
  // Các hàm này sẽ gán sự kiện cho các form, nút, modal...
  initAuth();
  initProfile();

  // 2. Gán sự kiện cho các thành phần UI chung
  document.getElementById('searchInput')?.addEventListener('input', searchGames);
  document.getElementById('langSelect')?.addEventListener('change', (e) => setLang(e.target.value));
  document.getElementById('backToTopBtn')?.addEventListener('click', scrollToTop);
  // (Các nút sidebar, search mobile... có thể gán trực tiếp trong HTML onclick="toggleSidebar()")

  // 3. Xử lý UI chung (tìm kiếm mobile, nút scroll)
  document.getElementById('searchInput').addEventListener('blur', function() {
    setTimeout(() => {
      if (window.innerWidth <= 700 && !this.value) {
        document.querySelector('.header-main')?.classList.remove('mobile-searching');
      }
    }, 150);
  });
  document.getElementById('searchInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && window.innerWidth <= 700 && !this.value) {
      document.querySelector('.header-main')?.classList.remove('mobile-searching');
    }
  });
  window.addEventListener('scroll', function() {
    const btn = document.getElementById('backToTopBtn');
    if (btn) {
      window.scrollY > 200 ? btn.classList.add('show') : btn.classList.remove('show');
    }
  });

  // 4. Kiểm tra user đã đăng nhập (từ auth.js)
  const user = getUserSafe();
  if (user) {
    showUserInfo(user);
  }

  // 5. Xử lý đăng nhập Google (redirect)
  const params = new URLSearchParams(window.location.search);
  if (params.has('user')) {
    try {
      const googleUser = JSON.parse(decodeURIComponent(params.get('user')));
      saveUserToLocal(googleUser); // Hàm này đã bao gồm showUserInfo
      window.history.replaceState({}, document.title, window.location.pathname);
      alert('Đăng nhập Google thành công! Xin chào ' + (googleUser.name || googleUser.email));
    } catch {}
  }

  // 6. Tải dữ liệu (Ngôn ngữ và Game)
  showLoading(true);
  
  Promise.all([
    fetch('lang.json').then(res => res.json()),
    fetch('games.json').then(res => res.json())
  ])
  .then(([langData, gameData]) => {
    // Xử lý Ngôn ngữ
    Object.assign(LANGS, langData);
    document.getElementById('langSelect').value = currentLang;
    setLang(currentLang, true); // true = firstLoad

    // Xử lý Game
    allGames = gameData;
    groupGames(allGames);
    
    // Render lần đầu
    rerenderAllSliders();
  })
  .catch(err => {
    console.error('Failed to fetch data', err);
    alert('Lỗi tải dữ liệu. Vui lòng tải lại trang.');
  })
  .finally(() => {
    showLoading(false);
  });

  // 7. Gán sự kiện resize
  window.addEventListener('resize', function() {
    const newMax = getMaxShow();
    if (newMax !== MAX_SHOW) {
      MAX_SHOW = newMax;
      Object.keys(sliderPage).forEach(key => sliderPage[key] = 0); // Reset trang
      rerenderAllSliders();
    }
  });
});