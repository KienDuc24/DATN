// Lấy dữ liệu game từ games.json
let allGames = [];
let featuredGames = [];
let gamesByCategory = {};


// Use same origin API by default (safer). If you need cross-domain, set this env.
const API_BASE_URL = 'https://datn-socket.up.railway.app'; // Đường dẫn API
// Lưu vị trí trang hiện tại cho từng slider
let sliderPage = {
  allGames: 0,
  featured: 0,
};

let MAX_SHOW = getMaxShow();

// Hàm render 1 game card
function renderGameCard(game) {
  const name = getGameName(game, currentLang);
  const desc = getGameDesc(game, currentLang);
  const category = getGameCategory(game, currentLang);
  return `
    <div class="game-card" onclick="handleGameClick('${game.id}', '${name.replace(/'/g, "\\'")}')">
      ${game.badge ? `<div class="game-badge">${game.badge}</div>` : ""}
      <img src="game/${game.id}/Img/logo.png" alt="${name}" />
      <div class="game-title">${name}</div>
      <div class="game-category">${category}</div>
      <div class="game-desc">${desc}</div>
      ${game.players ? `<div class="game-players">👥 ${game.players} ${LANGS[currentLang]?.players || ''}</div>` : ""}
    </div>
  `;
}

// Render slider cho 1 nhóm game với nút < >
function renderSlider(games, sliderId, nextBtnId, prevBtnId, pageKey) {
  const sliderContainer = document.getElementById(sliderId)?.parentElement;
  if (!sliderContainer) return;

  // Xóa nút cũ nếu có
  sliderContainer.querySelectorAll('.slider-btn').forEach(btn => btn.remove());

  let page = sliderPage[pageKey] || 0;
  const totalPage = Math.ceil(games.length / MAX_SHOW);

  const start = page * MAX_SHOW;
  const end = Math.min(start + MAX_SHOW, games.length);
  const showGames = games.slice(start, end);

  // Render game card
  const slider = document.getElementById(sliderId);
  slider.innerHTML = showGames.map(renderGameCard).join('');

  // Nếu số lượng game > MAX_SHOW thì thêm nút chuyển
  if (games.length > MAX_SHOW) {
    // Nút prev
    const prevBtn = document.createElement('button');
    prevBtn.className = 'slider-btn left';
    prevBtn.innerHTML = '&#8249;';
    prevBtn.style.display = page > 0 ? 'flex' : 'none';
    prevBtn.onclick = () => {
      sliderPage[pageKey]--;
      renderSlider(games, sliderId, nextBtnId, prevBtnId, pageKey);
    };
    sliderContainer.insertBefore(prevBtn, slider);

    // Nút next
    const nextBtn = document.createElement('button');
    nextBtn.className = 'slider-btn right';
    nextBtn.innerHTML = '&#8250;';
    nextBtn.style.display = end < games.length ? 'flex' : 'none';
    nextBtn.onclick = () => {
      sliderPage[pageKey]++;
      renderSlider(games, sliderId, nextBtnId, prevBtnId, pageKey);
    };
    sliderContainer.appendChild(nextBtn);
  }
}

// Khi bấm "Xem thêm" (card cuối)
function showAllGames(pageKey) {
  // Có thể mở modal, chuyển trang, hoặc render toàn bộ game
  alert('Hiển thị tất cả game cho mục này!');
}

// Sắp xếp và phân nhóm game
function groupGames(games) {
  // Sắp xếp
  games.sort((a, b) => (getGameName(a, 'vi')).localeCompare(getGameName(b, 'vi')));
  
  allGames = [...games]; // 'Tất cả game'
  
  // --- PHẦN QUAN TRỌNG LÀ ĐÂY ---
  // Lọc 'featuredGames' theo trường 'featured: true'
  featuredGames = games.filter(g => g.featured === true);
  // ---------------------------------
  
  
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


// Hiển thị các slider theo thể loại (có nút < > và logic "Xem thêm")
function renderCategorySliders() {
  const main = document.querySelector('.main-content');
  document.querySelectorAll('.category-slider-section').forEach(e => e.remove());

  Object.keys(gamesByCategory).forEach(cat => {
    const section = document.createElement('div');
    section.className = 'category-slider-section';
    const catKey = cat.replace(/\s+/g, '-');
    section.innerHTML = `
      <div class="section-title-row" id="cat-${catKey}">
        <div class="section-title">${cat}</div>
      </div>
      ${renderSortDropdown('newest', `cat-${catKey}`)}
      <div class="games-slider-container" id="cat-container-${catKey}">
        <div class="games-slider" id="catSlider-${catKey}"></div>
      </div>
    `;
    main.appendChild(section);
    if (!sliderPage[`cat-${catKey}`]) sliderPage[`cat-${catKey}`] = 0;
    renderCategorySlider(cat, catKey);
  });
}

function renderCategorySlider(cat, catKey) {
  renderSlider(
    gamesByCategory[cat],
    `catSlider-${catKey}`,
    `catShowMore-${catKey}`,
    `catShowMore-${catKey}-prev`,
    `cat-${catKey}`
  );
}

// Tìm kiếm
function searchGames() {
  const keyword = document.getElementById('searchInput').value.toLowerCase().trim();
  const main = document.querySelector('.main-content');
  let searchResultDiv = document.getElementById('search-result');

  // Nếu không nhập gì, hiển thị lại toàn bộ
  if (!keyword) {
    Array.from(main.children).forEach(child => {
      if (child.id !== 'search-result') child.style.display = '';
    });
    if (searchResultDiv) searchResultDiv.style.display = 'none';
    return;
  }

  Array.from(main.children).forEach(child => {
    if (child.id !== 'search-result') child.style.display = 'none';
  });

  // Sửa đoạn này:
  const filtered = allGames.filter(g =>
    getGameName(g).toLowerCase().includes(keyword) ||
    getGameDesc(g).toLowerCase().includes(keyword) ||
    getGameCategory(g).toLowerCase().includes(keyword)
  );

  // Tạo vùng kết quả nếu chưa có
  if (!searchResultDiv) {
    searchResultDiv = document.createElement('div');
    searchResultDiv.id = 'search-result';
    main.appendChild(searchResultDiv);
  }
  searchResultDiv.style.display = '';

  // Nếu không có kết quả
  if (filtered.length === 0) {
    searchResultDiv.innerHTML = `<div style="color:#ff9800;font-size:1.2rem;padding:32px 0;">Không tìm thấy trò chơi phù hợp.</div>`;
    return;
  }

  // Hàm làm nổi bật từ khóa
  function highlight(text) {
    text = (text === undefined || text === null) ? '' : String(text); // ép về chuỗi
    if (!text) return '';
    return text.replace(
      new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
      '<span style="background:#ff9800;color:#fff;border-radius:4px;padding:1px 4px;">$1</span>'
    );
  }

  // Hiển thị kết quả
  searchResultDiv.innerHTML = `
    <div class="section-title-row">
      <div class="section-title">Kết quả tìm kiếm cho "<span style="color:#ff9800">${keyword}</span>"</div>
    </div>
    <div class="games-slider" style="flex-wrap:wrap;gap:32px 24px;">
      ${filtered.map(game => {
        const name = getGameName(game, currentLang);
        const desc = getGameDesc(game, currentLang);
        const category = getGameCategory(game, currentLang);
        return `
          <div class="game-card" onclick="handleGameClick('${game.id}', '${game.name}')">
            ${game.badge ? `<div class="game-badge">${game.badge}</div>` : ""}
            <img src="game/${game.id}/Img/logo.png" alt="${name}" />
            <div class="game-title">${highlight(name)}</div>
            <div class="game-category">${highlight(category)}</div>
            <div class="game-desc">${highlight(desc)}</div>
            ${game.players ? `<div class="game-players">👥 ${highlight(game.players)} ${LANGS[currentLang]?.players || 'người chơi'}</div>` : ""}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Sắp xếp game
function sortGames(sectionKey, selectEl) {
  // Nếu không truyền selectEl, tự tìm select theo sectionKey
  if (!selectEl) {
    selectEl = document.querySelector(
      `[onchange*="sortGames('${sectionKey}'"]`
    );
  }
  if (!selectEl) return;
  const sortBy = selectEl.value;

  // Lấy mảng game đúng theo sectionKey
  let gamesArr;
  if (sectionKey.startsWith('cat-')) {
    const catName = sectionKey.replace(/^cat-/, '').replace(/-/g, ' ');
    gamesArr = allGames.filter(g => (getGameCategory(g) || '').toLowerCase().includes(catName.toLowerCase()));
  } else if (sectionKey === 'all') {
    gamesArr = allGames.slice();
  } else if (sectionKey === 'featured') {
    gamesArr = featuredGames.slice();
  } else {
    return;
  }

  // Sắp xếp
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

  // Render lại slider
  renderSlider(
    gamesArr,
    sectionKey.startsWith('cat-') ? `catSlider-${sectionKey.replace(/^cat-/, '')}` : `${sectionKey}Slider`,
    '',
    '',
    sectionKey
  );
}

// Hiển thị game theo thể loại
function renderGamesByCategory() {
  // Gom game theo từng thể loại
  const categoryMap = {};
  allGames.forEach(game => {
    const cats = (getGameCategory(game) || 'Khác').split(',').map(c => c.trim());
    cats.forEach(cat => {
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(game);
    });
  });

  const categoryList = document.getElementById('category-list');
  categoryList.innerHTML = '';
  Object.keys(categoryMap).forEach(cat => {
    const catKey = cat.replace(/\s+/g, '-');
    const section = document.createElement('div');
    section.className = 'category-slider-section';
    section.innerHTML = `
      <div class="section-title-row" id="cat-${catKey}">
        <div class="section-title">${cat}</div>
      </div>
      <div class="sort-dropdown-row">
        <label class="sort-label" data-i18n="sort_by"></label>
        <div class="sort-dropdown">
          <select class="sort-select" onchange="sortGames('cat-${catKey}', this)">
            <option value="newest" data-i18n="sort_newest"></option>
            <option value="oldest" data-i18n="sort_oldest"></option>
            <option value="players_asc" data-i18n="sort_players_asc"></option>
            <option value="players_desc" data-i18n="sort_players_desc"></option>
            <option value="az" data-i18n="sort_az"></option>
            <option value="za" data-i18n="sort_za"></option>
          </select>
        </div>
      </div>
      <div class="games-slider-container" id="cat-container-${catKey}">
        <div class="games-slider" id="catSlider-${catKey}"></div>
      </div>
    `;
    categoryList.appendChild(section);

    // Khởi tạo trang cho từng thể loại
    if (!sliderPage[`cat-${catKey}`]) sliderPage[`cat-${catKey}`] = 0;
    renderSlider(
      categoryMap[cat],
      `catSlider-${catKey}`,
      `catShowMore-${catKey}`,
      `catShowMore-${catKey}-prev`,
      `cat-${catKey}`
    );
  });
}

// Khởi tạo
function showLoading(show = true) {
  document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
}
// Sử dụng khi fetch dữ liệu:
showLoading(true);
// Gọi API từ database thay vì file tĩnh
fetch(`${API_BASE_URL}/api/games`) 
  .then(res => res.json())
  .then(data => {
    if (!Array.isArray(data)) {
        console.error('API did not return an array of games:', data);
        data = []; // Ngăn lỗi nếu API hỏng
    }
    showLoading(false);
    allGames = data;
    groupGames(allGames);
    sliderPage = { all: 0, featured: 0 };
    renderSlider(allGames, 'allSlider', 'all');
    renderSlider(featuredGames, 'featuredSlider', 'featured');
    renderGamesByCategory();
  });

// Hàm bật/tắt sidebar
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar.classList.contains('show')) {
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
  } else {
    sidebar.classList.add('show');
    overlay.classList.add('show');
  }
}

function toggleCategory(catId) {
  const content = document.getElementById(`${catId}-content`);
  const arrow = document.getElementById(`${catId}-arrow`);
  if (!content || !arrow) return;
  if (content.style.display === 'none' || content.style.display === '') {
    content.style.display = 'block';
    arrow.innerHTML = '&#9660;'; // mũi tên xuống
  } else {
    content.style.display = 'none';
    arrow.innerHTML = '&#9654;'; // mũi tên sang phải
  }
}

function showMobileSearch() {
  const header = document.querySelector('.header-main');
  header.classList.add('mobile-searching');
  // Hiện thanh tìm kiếm, focus vào input
  setTimeout(() => {
    document.getElementById('searchInput').focus();
  }, 100);
}

// Khi input mất focus, nếu không có nội dung thì ẩn thanh tìm kiếm mobile
document.getElementById('searchInput').addEventListener('blur', function() {
  setTimeout(() => { // Đợi 1 chút để tránh mất khi click nút search
    if (window.innerWidth <= 700 && !this.value) {
      document.querySelector('.header-main').classList.remove('mobile-searching');
    }
  }, 150);
});

// Khi submit tìm kiếm, cũng ẩn thanh tìm kiếm mobile nếu không có nội dung
document.getElementById('searchInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && window.innerWidth <= 700 && !this.value) {
    document.querySelector('.header-main').classList.remove('mobile-searching');
  }
});

// Hiện/ẩn nút khi cuộn trang
window.addEventListener('scroll', function() {
  const btn = document.getElementById('backToTopBtn');
  if (window.scrollY > 200) {
    btn.classList.add('show');
  } else {
    btn.classList.remove('show');
  }
});

// Hàm cuộn lên đầu trang
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let LANGS = {};
let currentLang = localStorage.getItem('lang') || 'vi';

fetch('lang.json')
  .then(res => res.json())
  .then(data => {
    LANGS = data;
    setLang(currentLang, true);
    document.getElementById('langSelect').value = currentLang;
  });

function setLang(lang, firstLoad = false) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  updateLangUI();
  // Render lại các slider/game khi đổi ngôn ngữ
  renderSlider(allGames, 'allSlider', 'allShowMore', 'allShowMore-prev', 'all');
  renderSlider(featuredGames, 'featuredSlider', 'featuredShowMore', 'featuredShowMore-prev', 'featured');
  renderGamesByCategory();
  updateLangUI(); // <-- Thêm dòng này
}

function updateLangUI() {
  if (!LANGS[currentLang]) return;
  // Đổi text các phần có data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (LANGS[currentLang][key]) {
      if (el.tagName === 'A' && el.querySelector('.icon')) {
        const icon = el.querySelector('.icon');
        el.innerHTML = icon.outerHTML + ' ' + LANGS[currentLang][key];
      } else {
        el.innerText = LANGS[currentLang][key];
      }
    }
  });
  // Đổi placeholder cho các input có data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (LANGS[currentLang][key]) {
      el.placeholder = LANGS[currentLang][key];
    }
  });
  // Đổi placeholder tìm kiếm
  const searchInput = document.getElementById('searchInput');
  if (searchInput && LANGS[currentLang].search_placeholder)
    searchInput.placeholder = LANGS[currentLang].search_placeholder;
  // Đổi các label sắp xếp (nếu có)
  document.querySelectorAll('.sort-dropdown select').forEach(sel => {
    sel.options[0].text = LANGS[currentLang].sort_newest;
    sel.options[1].text = LANGS[currentLang].sort_oldest;
    sel.options[2].text = LANGS[currentLang].sort_players_asc;
    sel.options[3].text = LANGS[currentLang].sort_players_desc;
    sel.options[4].text = LANGS[currentLang].sort_az;
    sel.options[5].text = LANGS[currentLang].sort_za;
  });
  // Đổi nút đăng nhập/đăng ký
  document.querySelectorAll('.auth-btn')[0].innerText = LANGS[currentLang].login;
  document.querySelectorAll('.auth-btn')[1].innerText = LANGS[currentLang].register;

  const authOr = document.querySelector('.auth-or span');
  if (authOr && LANGS[currentLang].or) authOr.innerText = LANGS[currentLang].or;

  document.querySelectorAll('.sort-label').forEach(el => {
    el.textContent = LANGS[currentLang]?.sort_by || 'Sắp xếp theo';
  });
  document.querySelectorAll('.sort-select').forEach(select => {
    select.querySelectorAll('option').forEach(opt => {
      const key = opt.getAttribute('data-i18n');
      if (key && LANGS[currentLang][key]) {
        opt.textContent = LANGS[currentLang][key];
      }
    });
  });
}

// Hiển thị modal
function openAuthModal(tab = 'login') {
  document.getElementById('auth-modal').style.display = 'flex';
  showAuthTab(tab);
  // Gán lại sự kiện mỗi lần mở modal
  document.getElementById('loginTab').onclick = function() {
    showAuthTab('login');
  };
  document.getElementById('registerTab').onclick = function() {
    showAuthTab('register');
  };
}

function showAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  if (tab === 'login') {
    loginForm.style.display = '';
    registerForm.style.display = 'none';
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = '';
    loginTab.classList.remove('active');
    registerTab.classList.add('active');
  }
}


/**
 * Lưu user/token vào localStorage và cập nhật UI
 * Gọi từ các handler đăng nhập (login/google/anonymous)
 */
function saveUserToLocal(user) {
  try {
    if (!user || typeof user !== 'object') return;
    // lưu user đầy đủ
    localStorage.setItem('user', JSON.stringify(user));
    // nếu có token thì lưu
    if (user.token) localStorage.setItem('token', user.token);
    // cập nhật giao diện
    if (typeof showUserInfo === 'function') {
      showUserInfo(user);
    }
  } catch (err) {
    console.error('saveUserToLocal error', err);
  }
}

// Regex kiểm tra username và password
function validateRegister(username, password, password2) {
  // Username: 4-20 ký tự, chữ cái, số, _ hoặc .
  const usernameRegex = /^[a-zA-Z0-9_.]{4,20}$/;
  // Password: ít nhất 6 ký tự, có chữ và số
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+]{6,}$/;
  if (!usernameRegex.test(username)) {
    return 'Tên đăng nhập phải từ 4-20 ký tự, chỉ gồm chữ, số, _ hoặc .';
  }
  if (!passwordRegex.test(password)) {
    return 'Mật khẩu phải từ 6 ký tự, gồm cả chữ và số.';
  }
  if (password !== password2) {
    return 'Mật khẩu nhập lại không khớp.';
  }
  return '';
}

// Đăng ký
document.getElementById('registerForm').onsubmit = async function(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const password2 = document.getElementById('register-password2').value;
  const msg = validateRegister(username, password, password2);
  if (msg) {
    document.getElementById('register-message').innerText = msg;
    return;
  }
  const res = await fetch(`${BASE_API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  document.getElementById('register-message').innerText = data.message || '';
  if (data.user) {
    showAuthTab('login');
  }
};

// Đăng nhập ẩn danh
document.getElementById('anonymousLoginBtn').onclick = function() {
  const username = 'guest_' + Math.random().toString(36).substring(2, 10);
  const user = { username };
  saveUserToLocal(user);
  closeAuthModal();
  showUserInfo(user);
  alert('Bạn đã đăng nhập ẩn danh với tên: ' + username);
};

// Đăng nhập Google (giả lập)
document.getElementById('googleLoginBtn').onclick = function() {
  window.location.href = `${BASE_API}/auth/google`;
};

// Đăng nhập Facebook (giả lập)
document.getElementById('facebookLoginBtn').onclick = function() {
  alert('Tính năng đăng nhập Facebook sẽ được bổ sung sau!');
  // Thực tế: chuyển hướng đến OAuth Facebook hoặc mở popup
};

// Cuộn lên đầu trang
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getGameName(game, lang = currentLang) {
  if (typeof game.name === 'string') return game.name;
  return game.name?.[lang] || game.name?.vi || game.name?.en || '';
}
function getGameDesc(game, lang = currentLang) {
  if (typeof game.desc === 'string') return game.desc;
  return game.desc?.[lang] || game.desc?.vi || game.desc?.en || '';
}
function getGameCategory(game, lang = currentLang) {
  if (typeof game.category === 'string') return game.category;
  return game.category?.[lang] || game.category?.vi || game.category?.en || '';
}

// Đăng nhập
document.addEventListener('DOMContentLoaded', function() {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      showUserInfo(user);
    } catch {}
  }
});

// Khi đăng nhập Google thành công
const params = new URLSearchParams(window.location.search);
if (params.has('user')) {
  const user = JSON.parse(decodeURIComponent(params.get('user')));
  saveUserToLocal(user);
  // localStorage.setItem('user', JSON.stringify(user));
  // window.history.replaceState({}, document.title, window.location.pathname);
  // showUserInfo(user);
  // alert('Đăng nhập Google thành công! Xin chào ' + (user.name || user.email));
}

// Khi đăng nhập ẩn danh
const anonymousBtn = document.getElementById('anonymousLoginBtn');
if (anonymousBtn) {
  anonymousBtn.onclick = function() {
    const username = 'guest_' + Math.random().toString(36).substring(2, 10);
    const user = { username };
    saveUserToLocal(user);
    closeAuthModal();
    showUserInfo(user);
    alert('Bạn đã đăng nhập ẩn danh với tên: ' + username);
  };
}

function showUserInfo(user) {
  // Ẩn nút đăng nhập/đăng ký trên header và sidebar
  const headerAuthBtns = document.getElementById('headerAuthBtns');
  if (headerAuthBtns) headerAuthBtns.style.display = 'none';
  const sidebarAuthBtns = document.getElementById('sidebarAuthBtns');
  if (sidebarAuthBtns) sidebarAuthBtns.style.display = 'none';

  // Hiện avatar trên header
  const userInfo = document.getElementById('userInfo');
  const userAvatar = document.getElementById('userAvatar');
  if (userInfo && userAvatar) {
    userInfo.style.display = 'flex';
    // Avatar: ưu tiên Google, Facebook, mặc định là guest
    let avatar = user.avatar || user.picture || '';
    avatar = 'img/avt.png';
    userAvatar.src = avatar;

    // Cập nhật dropbox
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownUsername = document.getElementById('dropdownUsername');
    const dropdownEmail = document.getElementById('dropdownEmail');
    if (dropdownAvatar) dropdownAvatar.src = avatar;
    if (dropdownUsername) dropdownUsername.innerText = user.username || user.name || user.displayName || 'User';
    
  }
}

// Hiện/ẩn dropbox khi hover hoặc click
document.addEventListener('DOMContentLoaded', function() {
  const userInfo = document.getElementById('userInfo');
  const userDropdown = document.getElementById('userDropdown');
  let dropdownVisible = false;

  if (userInfo && userDropdown) {
    // Chỉ hiện dropbox khi CLICK vào avatar
    userInfo.onclick = function(e) {
      e.stopPropagation();
      dropdownVisible = !dropdownVisible;
      userDropdown.style.display = dropdownVisible ? 'flex' : 'none';
    };
    // Ẩn dropbox khi click ra ngoài
    document.addEventListener('click', function() {
      dropdownVisible = false;
      userDropdown.style.display = 'none';
    });
    // Không ẩn khi click vào dropbox
    userDropdown.onclick = function(e) {
      e.stopPropagation();
    };
  }

  // Đăng xuất
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.onclick = function() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    // Ẩn user info, hiện lại nút đăng nhập/đăng ký
    const headerAuthBtns = document.getElementById('headerAuthBtns');
    if (headerAuthBtns) headerAuthBtns.style.display = '';
    const sidebarAuthBtns = document.getElementById('sidebarAuthBtns');
    if (sidebarAuthBtns) sidebarAuthBtns.style.display = '';
    const userInfo = document.getElementById('userInfo');
    if (userInfo) userInfo.style.display = 'none';
    // Ẩn dropbox nếu đang mở
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) userDropdown.style.display = 'none';
    // Reload lại trang nếu muốn reset toàn bộ state
    // location.reload();
  };
}
  const historyBtn = document.getElementById('historyBtn');
  if (historyBtn) historyBtn.onclick = () => alert('Tính năng lịch sử chơi sẽ được bổ sung sau!');
});

// Đổi avatar và tên tài khoản (demo)
// ---------------------------------------------------------
// Block duplicate bị loại bỏ (xóa toàn bộ DOMContentLoaded xử lý profileModal)
// ---------------------------------------------------------
// Hiện popup khi ấn "Thay đổi hồ sơ"
const profileBtn = document.getElementById('profileBtn');
const profileModal = document.getElementById('profile-modal');
const closeProfileModal = document.getElementById('closeProfileModal');
const modalChangeAvatarBtn = document.getElementById('modalChangeAvatarBtn');
const modalChangeNameBtn = document.getElementById('modalChangeNameBtn');
const settingsBtn = document.getElementById('settingsBtn');

if (settingsBtn && profileModal) {
  settingsBtn.onclick = function(e) {
    e.stopPropagation();
    profileModal.style.display = 'flex';
  };
}
if (closeProfileModal && profileModal) {
  closeProfileModal.onclick = function() {
    profileModal.style.display = 'none';
  };
}
// Đổi avatar (demo)
if (modalChangeAvatarBtn) {
  modalChangeAvatarBtn.onclick = function() {
    alert('Tính năng đổi avatar sẽ được bổ sung sau!');
    profileModal.style.display = 'none';
  };
}
// Đổi tên tài khoản
if (modalChangeNameBtn) {
  modalChangeNameBtn.onclick = function() {
    const userStr = localStorage.getItem('user');
    let user = userStr ? JSON.parse(userStr) : {};
    const newName = prompt('Nhập tên tài khoản mới:', user.name || user.username || '');
    if (newName && newName.trim()) {
      user.name = newName.trim();
      user.displayName = newName.trim();
      user.username = newName.trim(); 
      saveUserToLocal(user);
      showUserInfo(user);
      alert('Đổi tên thành công!');
    }
    profileModal.style.display = 'none';
  };
}


// Hiện thị mật khẩu đăng nhập
document.addEventListener('DOMContentLoaded', function() {
  const pwdInput = document.getElementById('login-password');
  const togglePwdBtn = document.getElementById('togglePassword');
  if (pwdInput && togglePwdBtn) {
    togglePwdBtn.onclick = function(e) {
      e.preventDefault();
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        togglePwdBtn.innerText = '🙈 Ẩn mật khẩu';
      } else {
        pwdInput.type = 'password';
        togglePwdBtn.innerText = '👁 Hiện mật khẩu';
      }
    };
  }

  // Ẩn/hiện mật khẩu đăng ký cho cả 2 ô
  const toggleRegisterBtn = document.getElementById('toggleRegisterPassword');
  const pw1 = document.getElementById('register-password');
  const pw2 = document.getElementById('register-password2');
  if (toggleRegisterBtn && pw1 && pw2) {
    toggleRegisterBtn.onclick = function(e) {
      e.preventDefault();
      const isHidden = pw1.type === 'password';
      pw1.type = isHidden ? 'text' : 'password';
      pw2.type = isHidden ? 'text' : 'password';
      this.querySelector('.eye-icon').textContent = isHidden ? '🙈' : '👁️';
    };
  }
});

// Quên mật khẩu
document.addEventListener('DOMContentLoaded', function() {
  const forgotBtn = document.getElementById('forgotPasswordBtn');
  if (forgotBtn) {
    forgotBtn.onclick = function() {
      alert('Tính năng quên mật khẩu sẽ được bổ sung sau!');
    };
  }
});

// Tab chuyển đổi
document.addEventListener('DOMContentLoaded', function() {
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginTab && registerTab && loginForm && registerForm) {
    loginTab.onclick = function() {
      loginForm.style.display = '';
      registerForm.style.display = 'none';
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
    };
    registerTab.onclick = function() {
      loginForm.style.display = 'none';
      registerForm.style.display = '';
      loginTab.classList.remove('active');
      registerTab.classList.add('active');
    };
  }
});

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.toggle-password-btn-below').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      // Nút nằm ngay sau input cần ẩn/hiện
      const input = btn.previousElementSibling;
      if (input && (input.type === 'password' || input.type === 'text')) {
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🙈 Ẩn mật khẩu';
        } else {
          input.type = 'password';
          btn.textContent = '👁 Hiện mật khẩu';
        }
      }
    });
  });
});

// Thiết lập sự kiện ẩn/hiện mật khẩu cho các nút và input tương ứng


document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleRegisterPassword');
  if (toggleBtn) {
    toggleBtn.onclick = function(e) {
      e.preventDefault();
      const pwInputs = [
        document.getElementById('register-password'),
        document.getElementById('register-password2')
      ];
      const isHidden = pwInputs[0].type === 'password';
      pwInputs.forEach(input => {
        if (input) input.type = isHidden ? 'text' : 'password';
      });
      const eye = this.querySelector('.eye-icon');
      if (eye) eye.textContent = isHidden ? '🙈' : '👁';
      this.innerHTML = `${eye ? eye.outerHTML : ''} ${isHidden ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}`;
    };
  }
});
// Đăng ký
document.getElementById('registerForm').onsubmit = async function(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const password2 = document.getElementById('register-password2').value;
  const msg = validateRegister(username, password, password2);
  if (msg) {
    document.getElementById('register-message').innerText = msg;
    return;
  }
  const res = await fetch(`${BASE_API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  document.getElementById('register-message').innerText = data.message || '';
  if (data.user) {
    showAuthTab('login');
  }
};

// Đăng nhập
document.getElementById('loginForm').onsubmit = async function(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  try {
    const res = await fetch(`${BASE_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const text = await res.text().catch(()=>null);
    console.log('[client] /api/auth/login status=', res.status, 'body=', text);
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch(e) { data = { raw: text }; }
    if (!res.ok) {
      document.getElementById('login-message').innerText = data.message || data.raw || 'Login failed';
      return;
    }
    // success path
    if (data.token && data.user) {
      saveUserToLocal(data.user);
      closeAuthModal();
      showUserInfo(data.user);
      alert('Đăng nhập thành công!');
    } else {
      document.getElementById('login-message').innerText = 'No token/user returned';
    }
  } catch (err) {
    console.error('[client] login error', err);
    alert('Lỗi khi gọi API login: ' + (err && err.message));
  }
};


document.addEventListener('DOMContentLoaded', function() {
  // Ẩn/hiện mật khẩu đăng nhập
  const loginPwdInput = document.getElementById('login-password');
  const loginToggleBtn = document.getElementById('togglePassword');
  if (loginPwdInput && loginToggleBtn) {
    loginToggleBtn.onclick = function(e) {
      e.preventDefault();
      if (loginPwdInput.type === 'password') {
        loginPwdInput.type = 'text';
        this.innerHTML = '🙈 Ẩn mật khẩu';
      } else {
        loginPwdInput.type = 'password';
        this.innerHTML = '👁 Hiện mật khẩu';
      }
    };
  }

  // Ẩn/hiện mật khẩu đăng ký cho cả 2 ô
  const regToggleBtn = document.getElementById('toggleRegisterPassword');
  const regPw1 = document.getElementById('register-password');
  const regPw2 = document.getElementById('register-password2');
  if (regToggleBtn && regPw1 && regPw2) {
    regToggleBtn.onclick = function(e) {
      e.preventDefault();
      const isHidden = regPw1.type === 'password';
      regPw1.type = isHidden ? 'text' : 'password';
      regPw2.type = isHidden ? 'text' : 'password';
      const icon = isHidden ? '🙈' : '👁';
      const text = isHidden ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
      this.innerHTML = `<span class="eye-icon">${icon}</span> ${text}`;
    };
  }
});

// Đóng modal
function closeAuthModal() {
  // Ẩn modal đăng nhập/đăng ký
  const modal = document.querySelector('.auth-form-modal, .auth-modal, .modal');
  if (modal) modal.style.display = 'none';
}
// Khai báo roomModal bên ngoài hàm
const roomModal = document.getElementById('roomModal');
if (!roomModal) {
  console.error('Element #roomModal không tồn tại');
}
// Hàm xử lý khi click vào game
function handleGameClick(gameId, gameName) {
  const modal = document.getElementById('roomModal');
  if (!modal) {
    console.error('Element #roomModal không tồn tại');
    return;
  }
  window.selectedGameId = gameId;
  window.selectedGameName = gameName;
  modal.style.display = 'flex';

  // Lấy thông tin game từ allGames
  const game = allGames.find(g => g.id === gameId);
  let infoHtml = '';
  if (game) {
    const name = getGameName(game, currentLang);
    const desc = getGameDesc(game, currentLang);
    const players = game.players || '';
    
    // --- SỬA LỖI (1/2): Lấy "category" và lưu lại ---
    const category = getGameCategory(game, currentLang);
    window.selectedGameType = category; // Lưu 'gameType' để gửi đi
    // --- Hết phần sửa (1/2) ---

    infoHtml = `
      <div class="modal-game-info" style="display:flex;flex-direction:column;align-items:center;margin-bottom:12px;">
        <img src="game/${game.id}/Img/logo.png" alt="${name}" style="width:64px;height:64px;border-radius:14px;margin-bottom:8px;box-shadow:0 2px 8px #ff980033;">
        <div class="modal-game-title" style="font-size:1.15rem;font-weight:700;color:#ff9800;margin-bottom:4px;text-align:center;">${name}</div>
        <div class="modal-game-desc" style="font-size:1rem;color:#444;text-align:center;margin-bottom:4px;">${desc}</div>
        <div class="modal-game-players" style="font-size:0.98rem;color:#43cea2;">👥 ${players} ${LANGS[currentLang]?.room_players || 'players'}</div>
      </div>
    `;
  }

  // Render lại nội dung modal
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

  // Gán sự kiện cho nút "Đóng" (vì modal được render lại)
  modal.querySelector('#closeRoomModal').onclick = () => modal.style.display = 'none';

  const createRoomBtn = modal.querySelector('#createRoomBtn');
  const joinRoomBtn = modal.querySelector('#joinRoomBtn');
  const confirmJoinRoomBtn = modal.querySelector('#confirmJoinRoomBtn');

  if (!createRoomBtn || !joinRoomBtn || !confirmJoinRoomBtn) {
    console.error('Các nút trong modal không tồn tại');
    return;
  }

  // Gán sự kiện cho nút "Tạo phòng"
  createRoomBtn.onclick = async function() {
    const gameIdLocal = window.selectedGameId || '';
    const gameNameLocal = window.selectedGameName || '';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const username = user.username || user.displayName || 'Guest';

    // --- SỬA LỖI (2/2): Lấy thêm 2 trường và tạo payload đầy đủ ---
    const gameTypeLocal = window.selectedGameType || ''; // Lấy gameType đã lưu
    const roleLocal = 'host'; // Người tạo phòng luôn là "host"

    if (!gameIdLocal || !username || !gameTypeLocal) {
      alert('Thiếu thông tin game, loại game hoặc người chơi. Vui lòng kiểm tra lại!');
      return;
    }
    
    // Tạo payload đầy đủ 4 trường
    const payload = {
      player: username,
      game: gameIdLocal,
      gameType: gameTypeLocal,
      role: roleLocal
    };
    // --- Hết phần sửa (2/2) ---

    try {
      const res = await fetch(`${API_BASE_URL}/api/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) // Gửi payload đầy đủ
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
        gameId: gameIdLocal,
        game: gameNameLocal,
        user: username
      }).toString();

      window.location.href = `/room.html?${qs}`;
    } catch (err) {
      console.error('[client] create room error', err);
      // Hiển thị lỗi chính xác từ server
      alert('Lỗi khi tạo phòng: ' + (err && err.message));
    }
  };

  // Gán sự kiện cho nút "Tham gia phòng"
  joinRoomBtn.onclick = function() {
    modal.querySelector('#joinRoomBox').style.display = 'block';
  };

  // Gán sự kiện cho nút "Xác nhận tham gia phòng"
  confirmJoinRoomBtn.onclick = async function() {
    const code = modal.querySelector('#inputJoinRoomCode').value.trim().toUpperCase();
    const gameId = window.selectedGameId || '';

    if (!code || !gameId) {
      alert('Thiếu mã phòng hoặc gameId!');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/room?code=${encodeURIComponent(code)}&gameId=${encodeURIComponent(gameId)}`);
      if (!res.ok) {
        alert('Không tìm thấy phòng. Vui lòng kiểm tra lại mã phòng.');
        return;
      }

      const data = await res.json();
      if (!data.found || !data.room) {
        alert('Phòng không tồn tại hoặc không hợp lệ.');
        return;
      }

      const user = JSON.parse(localStorage.getItem('user') || '{}');
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
      alert('Lỗi khi tham gia phòng: ' + (err && err.message));
    }
  };



  modal.querySelector('#joinRoomBtn').onclick = function() {
    modal.querySelector('#joinRoomBox').style.display = 'block';
  };

  const goToRoomBtn = modal.querySelector('#goToRoomBtn');
  if (goToRoomBtn) {
    goToRoomBtn.onclick = function() {
      const code = window.generatedRoomCode;
      const gameId = window.selectedGameId || '';
      const gameName = window.selectedGameName || '';
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const username = user.username || user.displayName || 'Guest';

      if (!code || !gameId || !gameName || !username) {
        alert('Thiếu thông tin phòng hoặc người chơi!');
        return;
      }

      window.location.href = `/room.html?code=${code}&gameId=${encodeURIComponent(gameId)}&game=${encodeURIComponent(gameName)}&user=${encodeURIComponent(username)}`;
    };
  }
}

// script.js (Trang chủ Vercel)

// ... (Giữ nguyên toàn bộ code từ đầu đến)

const SOCKET_URL = window.SOCKET_URL || window.__BASE_API__ || window.location.origin;
const socket = (typeof io === 'function') ? io(SOCKET_URL, {
  path: '/socket.io',
  transports: ['polling', 'websocket'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000
}) : null;

// --- THÊM MỚI: Logic cập nhật status 'online' ---
if (socket) {
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const username = user.username || user.displayName;
      if (username && !username.startsWith('guest_')) {
        socket.emit('registerSocket', username);
      }
    } catch (e) { console.error('Error registering socket', e); }
  });
}
// Gửi payload này lên server hoặc socket
function getMaxShow() {
  if (window.innerWidth <= 600) return 2;
  if (window.innerWidth <= 900) return 3;
  if (window.innerWidth <= 1200) return 4;
  return 5;
}
function rerenderAllSliders() {
  MAX_SHOW = getMaxShow();
  renderSlider(allGames, 'allSlider', 'allShowMore', 'allShowMore-prev', 'all');
  renderSlider(featuredGames, 'featuredSlider', 'featuredShowMore', 'featuredShowMore-prev', 'featured');
  renderGamesByCategory();
  updateLangUI(); // <-- Thêm dòng này để cập nhật lại select động
}

window.addEventListener('resize', function() {
  const newMax = getMaxShow();
  if (newMax !== MAX_SHOW) {
    rerenderAllSliders();
  }
});

// Hàm render dropdown sắp xếp
function renderSortDropdown(currentSort, key = '') {
  return `
    <div class="sort-dropdown-row">
      <label class="sort-label" data-i18n="sort_by"></label>
      <div class="sort-dropdown">
        <select class="sort-select" onchange="sortGames('${key}')">
          <option value="newest" data-i18n="sort_newest"></option>
          <option value="oldest" data-i18n="sort_oldest"></option>
          <option value="players_asc" data-i18n="sort_players_asc"></option>
          <option value="players_desc" data-i18n="sort_players_desc"></option>
          <option value="az" data-i18n="sort_az"></option>
          <option value="za" data-i18n="sort_za"></option>
        </select>
      </div>
    </div>
  `;
}

// Sau khi đăng nhập thành công với Google hoặc Facebook
function onLoginSuccess(userInfo) {
  // userInfo.displayName là tên hiển thị Google/Facebook
  // userInfo.username là tên đăng nhập thường (nếu có)
  // userInfo.email, ...
  const username = userInfo.displayName || userInfo.username || userInfo.name || 'Guest';
  localStorage.setItem('user', JSON.stringify({
    username: username,
    displayName: userInfo.displayName || '',
    name: userInfo.name || '',
    email: userInfo.email || ''
  }));
  // Hiển thị tên lên FE
  document.getElementById('user-name').innerText = username;
}

function onGoogleLoginSuccess(googleUser) {
  const profile = googleUser.getBasicProfile();
  const username = profile.getName();
  saveUserToLocal({
    username: username,
    displayName: username,
    email: profile.getEmail()
  });
  document.getElementById('user-name').innerText = username;
}

// --- Remove legacy inline profile-modal and wire settingsBtn to new settings modal ---

// If an old DOM node with id "profile-modal" exists, remove it so it won't show.
const legacyProfileModal = document.getElementById('profile-modal');
if (legacyProfileModal) legacyProfileModal.remove();

// Wire settings button to open the centralized accountSettingsModal created by attachProfileUI()
if (settingsBtn) {
  settingsBtn.onclick = function(e) {
    e.stopPropagation();
    const acct = document.getElementById('accountSettingsModal');
    if (acct) acct.style.display = 'block';
  };
}

// Tạo / hiển thị modal "profile-modal" (Cài đặt tài khoản) và popup giữa màn hình (Hồ sơ)
(function profileAndSettingsUI() {
  // helpers
  function getUserSafe() {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }
  function applyHeaderUser(updated) {
    const ua = document.getElementById('userAvatar');
    const da = document.getElementById('dropdownAvatar');
    const du = document.getElementById('dropdownUsername');
    if (ua && updated.avatar) ua.src = updated.avatar;
    if (da && updated.avatar) da.src = updated.avatar;
    if (du && (updated.displayName || updated.username)) du.innerText = updated.displayName || updated.username;
  }

  // Create profile-modal (settings) if not exists
  function createProfileModal() {
    let modal = document.getElementById('profile-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'profile-modal';
    Object.assign(modal.style, {
      position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1400,
      display: 'none', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)'
    });

    modal.innerHTML = `
      <div id="profile-modal-box" style="width:90%;max-width:480px;background:#fff;border-radius:12px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:700;font-size:1.05rem">Cài đặt tài khoản</div>
          <button id="profile-modal-close" style="background:none;border:none;font-size:1.2rem;cursor:pointer">×</button>
        </div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
          <img id="profile-modal-avatar" src="img/avt.png" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid #eee">
          <div style="flex:1">
            <div style="font-weight:700" id="profile-modal-name-display"></div>
            <div style="color:#666;font-size:0.9rem" id="profile-modal-email-display"></div>
          </div>
        </div>

        <label style="display:block;font-size:0.9rem;margin-bottom:6px">Tên tài khoản (username)</label>
        <input id="profile-modal-name" style="width:100%;padding:8px;border-radius:8px;border:1px solid #ddd;margin-bottom:10px" />

        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="profile-modal-cancel" style="padding:8px 12px;border-radius:8px;background:#eee;border:none">Hủy</button>
          <button id="profile-modal-save" style="padding:8px 12px;border-radius:8px;background:#00b59a;color:#fff;border:none">Lưu</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // events
    modal.querySelector('#profile-modal-close').addEventListener('click', () => modal.style.display = 'none');
    modal.querySelector('#profile-modal-cancel').addEventListener('click', () => modal.style.display = 'none');

    // Save handler: only update username (no avatar upload)
    modal.querySelector('#profile-modal-save').addEventListener('click', async () => {
      const nameEl = document.getElementById('profile-modal-name');
      let user = (function(){ try { return JSON.parse(localStorage.getItem('user')||'{}'); } catch { return {}; } })();
      const token = localStorage.getItem('token') || '';

      if (!user || !(user.username || user._id)) {
        alert('Không tìm thấy user để cập nhật.');
        return;
      }

      const newUsername = nameEl && nameEl.value && nameEl.value.trim();
      if (!newUsername) {
        alert('Username mới không được để trống.');
        return;
      }

      // build payload: current identifier + newUsername
      const payload = { username: user.username || user._id, newUsername: newUsername };

      try {
        const res = await fetch(`${BASE_API}/api/user`, {
          method: 'PUT',
          headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': `Bearer ${token}` } : {}),
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const txt = await res.text().catch(()=> '');
          alert('Cập nhật thất bại: ' + (txt || res.status));
          return;
        }
        const j = await res.json();
        const serverUser = j.user || j;
        if (serverUser) {
          localStorage.setItem('user', JSON.stringify(serverUser));
          // update header/modal UI
          if (typeof applyHeaderUser === 'function') applyHeaderUser(serverUser);
          document.getElementById('profile-modal-name-display').innerText = "Nhập tên mới" || '';
          document.getElementById('profile-modal-email-display').innerText = serverUser.email || '';
          document.getElementById('profile-modal-avatar').src = serverUser.avatar || 'img/avt.png';
          modal.style.display = 'none';
          alert('Cập nhật hồ sơ thành công');
        } else {
          alert('Cập nhật xong nhưng không nhận về user hợp lệ.');
        }
      } catch (err) {
        console.error('profile save error', err);
        alert('Lỗi khi cập nhật hồ sơ');
      }
    });

    return modal;
  }

  // Create centered profile popup (only info, no action buttons)
  function createProfileCenterPopup() {
    let pop = document.getElementById('profile-center-popup');
    if (pop) return pop;

    pop = document.createElement('div');
    pop.id = 'profile-center-popup';
    Object.assign(pop.style, {
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1500,
      display: 'none', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)'
    });
    pop.innerHTML = `
      <div id="profile-center-box" style="min-width:260px;max-width:420px;background:#fff;border-radius:12px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,0.32);text-align:center">
        <button id="profile-center-close" style="position:absolute;right:18px;top:18px;background:none;border:none;font-size:1.2rem;cursor:pointer">×</button>
        <img id="profile-center-avatar" src="img/avt.png" style="width:86px;height:86px;border-radius:50%;object-fit:cover;border:2px solid #eee;margin-bottom:10px">
        <div id="profile-center-name" style="font-weight:700;font-size:1.05rem;margin-bottom:4px"></div>
        <div id="profile-center-email" style="color:#666;margin-bottom:12px"></div>
        <!-- no action buttons per request -->
      </div>
    `;
    document.body.appendChild(pop);

    pop.addEventListener('click', (e) => {
      if (e.target === pop) pop.style.display = 'none';
    });
    pop.querySelector('#profile-center-close').addEventListener('click', () => pop.style.display = 'none');
    return pop;
  }

  // Populate and show center popup
  function showProfileCenter(show = true) {
    const pop = createProfileCenterPopup();
    const user = getUserSafe();
    const avatar = user.avatar || user.picture || 'img/avt.png';
    const name = user.displayName || user.username || user.name || 'Khách';
    const email = user.email || '';
    const aEl = document.getElementById('profile-center-avatar');
    const nEl = document.getElementById('profile-center-name');
    const eEl = document.getElementById('profile-center-email');
    if (aEl) aEl.src = avatar;
    if (nEl) nEl.innerText = name;
    if (eEl) eEl.innerText = email;
    pop.style.display = show ? 'flex' : 'none';
  }

  // Wire buttons
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const modal = createProfileModal();
      // populate fields
      const user = getUserSafe();
      const nameInput = document.getElementById('profile-modal-name');
      const display = document.getElementById('profile-modal-name-display');
      const emailDisplay = document.getElementById('profile-modal-email-display');
      const avatarImg = document.getElementById('profile-modal-avatar');
      if (nameInput) nameInput.value = user.displayName || user.name || user.username || '';
      if (display) display.innerText = user.displayName || user.username || 'Khách';
      if (emailDisplay) emailDisplay.innerText = user.email || '';
      if (avatarImg) avatarImg.src = user.avatar || user.picture || 'img/avt.png';
      modal.style.display = 'flex';
    });
  }

  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showProfileCenter(true);
    });
  }

  // close any created UI when clicking outside
  document.addEventListener('click', () => {
    const pc = document.getElementById('profile-center-popup');
    if (pc) pc.style.display = 'none';
  });
})();

// Hàm cập nhật thông tin người dùng lên server
async function updateUserOnServer(user) {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${BASE_API}/api/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(user)
    });
    if (!res.ok) {
      console.warn('updateUserOnServer failed', res.status);
      return null;
    }
    const data = await res.json();
    if (data && data.user) {
      // store canonical user returned by server
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch (err) {
    console.error('updateUserOnServer error', err);
    return null;
  }
}

(function profileAndSettingsUI() {
  // helper: read user from localStorage safely
  function getUserSafe() {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  }

  // Try fetch user from server by username (server supports GET /api/user?username=...)
  async function fetchUserFromServer(identifier) {
    if (!identifier) return null;
    try {
      const res = await fetch(`${BASE_API}/api/user?username=${encodeURIComponent(identifier)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) return null;
      const j = await res.json();
      return j && j.user ? j.user : j;
    } catch (err) {
      console.warn('fetchUserFromServer error', err && err.message);
      return null;
    }
  }

  // header update helper (ensure elements exist)
  if (typeof window.applyHeaderUser !== 'function') {
    window.applyHeaderUser = function(user) {
      try {
        const avatarEl = document.querySelector('#header-avatar');
        const nameEl = document.querySelector('#header-username');
        const FALLBACK_AVATAR = 'https://www.gravatar.com/avatar/?d=mp&s=200';
        if (avatarEl) {
          const a = user && user.avatar;
          avatarEl.src = (a && (a.startsWith('http') || a.startsWith('data:') || a.startsWith('/uploads'))) ? a : FALLBACK_AVATAR;
        }
        if (nameEl) nameEl.textContent = user && (user.displayName || user.username) || 'Khách';
      } catch (e) {}
    };
  }

  function createProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    const nameInput = modal.querySelector('#profile-modal-name'); // now acts as "new username"
    const fileInput = modal.querySelector('#profile-modal-file');
    const avatarImg = modal.querySelector('#profile-modal-avatar');
    const saveBtn = modal.querySelector('#profile-modal-save');
    const cancelBtn = modal.querySelector('#profile-modal-cancel');

    const FALLBACK_AVATAR = 'https://www.gravatar.com/avatar/?d=mp&s=200';

    async function loadProfileIntoModal() {
      let user = getUserSafe() || {};
      // remove blob avatar from local cache (will 404)
      if (user && typeof user.avatar === 'string' && user.avatar.startsWith('blob:')) {
        delete user.avatar;
        try { localStorage.setItem('user', JSON.stringify(user)); } catch (e) {}
      }
      if (user && (user.username || user._id)) {
        const serverUser = await fetchUserFromServer(user.username || user._id).catch(() => null);
        if (serverUser && typeof serverUser === 'object') {
          user = Object.assign({}, user, serverUser);
          try { localStorage.setItem('user', JSON.stringify(user)); } catch (e) {}
        }
      }

      // populate: show current username in input (editing this will change username)
      if (nameInput) nameInput.value = user.username || '';
      if (avatarImg) {
        const a = user.avatar;
        const valid = typeof a === 'string' && (a.startsWith('http') || a.startsWith('data:') || a.startsWith('/uploads'));
        avatarImg.src = valid ? a : FALLBACK_AVATAR;
      }
      if (fileInput) {
        fileInput.value = '';
        if (modal._previewUrl) {
          try { URL.revokeObjectURL(modal._previewUrl); } catch (e) {}
          modal._previewUrl = null;
        }
      }
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (modal._previewUrl) { try { URL.revokeObjectURL(modal._previewUrl); } catch (e) {} modal._previewUrl = null; }
        const url = URL.createObjectURL(f);
        modal._previewUrl = url;
        if (avatarImg) avatarImg.src = url;
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        const token = localStorage.getItem('token') || '';
        let user = getUserSafe() || {};
        try {
          // prepare newUsername from input
          const newUsernameVal = nameInput && nameInput.value ? nameInput.value.trim() : '';
          // upload avatar first if selected
          if (fileInput && fileInput.files && fileInput.files[0]) {
            try {
              const fd = new FormData();
              fd.append('avatar', fileInput.files[0]);
              // send current username so server can attach to right user (server expects username)
              if (user.username) fd.append('username', user.username);
              else if (user._id) fd.append('username', user._id);

              const res = await fetch(`${BASE_API}/api/user/upload-avatar`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: fd
              });
              if (res.ok) {
                const j = await res.json();
                user.avatar = j.url || (j.user && j.user.avatar) || user.avatar;
              } else {
                console.warn('avatar upload failed', res.status);
              }
            } catch (err) {
              console.warn('avatar upload error', err && err.message);
            }
          }

          // Lấy thông tin người dùng từ localStorage
          const user = JSON.parse(localStorage.getItem('user') || '{}');

          // Lấy thông tin game từ games.json dựa trên ID game được chọn
          const selectedGameId = 'Draw'; // ID của game được chọn (ví dụ: 'Draw')
          const selectedGame = allGames.find(game => game.id === selectedGameId); // Tìm game trong danh sách

          // Xây dựng payload
          const payload = {
            player: user.username || user._id || 'Guest', // Tên người chơi (hoặc ID nếu không có username)
            game: selectedGame?.id || '',                // ID của game được chọn
            gameType: selectedGame?.category?.en || 'default', // Loại game (lấy từ games.json hoặc mặc định là 'default')
            role: 'host'                                 // Vai trò mặc định là host (người tạo phòng)
          };
          if (newUsernameVal && newUsernameVal !== (user.username || '')) payload.newUsername = newUsernameVal;
          if (user.avatar) payload.avatar = user.avatar;

          // send PUT
          try {
            const res2 = await fetch(`${BASE_API}/api/user`, {
              method: 'PUT',
              headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': `Bearer ${token}` } : {}),
              body: JSON.stringify(payload)
            });
            if (!res2.ok) {
              const txt = await res2.text().catch(() => '');
              console.warn('update user failed', res2.status, txt);
              alert('Cập nhật thất bại: ' + (txt || res2.status));
              saveBtn.disabled = false;
              return;
            }
            const j2 = await res2.json();
            const serverUser = j2.user || j2;
            // persist canonical user
            try { localStorage.setItem('user', JSON.stringify(serverUser)); } catch (e) {}
            // update header UI (header should use username as display)
            applyHeaderUser(serverUser);
            if (avatarImg) avatarImg.src = serverUser.avatar || FALLBACK_AVATAR;
            if (nameInput) nameInput.value = serverUser.username || '';
            if (modal._previewUrl) { try { URL.revokeObjectURL(modal._previewUrl); } catch (e) {} modal._previewUrl = null; fileInput.value = ''; }
            modal.style.display = 'none';
            alert('Cập nhật hồ sơ thành công');
          } catch (err) {
            console.error('update user error', err && err.message);
            alert('Lỗi khi cập nhật hồ sơ');
          }
        } finally {
          saveBtn.disabled = false;
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (modal._previewUrl) { try { URL.revokeObjectURL(modal._previewUrl); } catch (e) {} modal._previewUrl = null; }
        modal.style.display = 'none';
      });
    }

    // populate on open
    loadProfileIntoModal();
  }

  try { createProfileModal(); } catch (e) { console.warn('createProfileModal init failed', e && e.message); }
})();

async function createRoom(payload) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create room');
    }
    const room = await res.json();
    console.log('[createRoom] Room created:', room);

    // Chuyển người dùng vào phòng chờ
    const roomUrl = `room.html?code=${encodeURIComponent(room.roomCode)}&gameId=${encodeURIComponent(payload.game)}&user=${encodeURIComponent(payload.player)}`;
    window.location.href = roomUrl;
  } catch (err) {
    console.error('[createRoom] Error:', err.message);
    alert('Không thể tạo phòng. Vui lòng thử lại!');
  }
}

async function createRoomAndRedirect() {
  const name = document.getElementById('playerName').value.trim();
  if (!name) {
    alert("Vui lòng nhập tên hiển thị.");
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: name, game: selectedGame })
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to create room');
    }

    const data = await res.json();
    if (data.roomCode) {
      console.log('Redirecting to room:', data.roomCode);
      window.location.href = `room.html?code=${data.roomCode}&game=${encodeURIComponent(selectedGame)}`;
    } else {
      alert('Lỗi tạo phòng!');
    }
  } catch (error) {
    console.error('Error creating room:', error);
    alert('Lỗi kết nối!');
  }
}