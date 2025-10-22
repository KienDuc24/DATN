// Lấy dữ liệu game từ games.json
let allGames = [];
let recentGames = [];
let topGames = [];
let featuredGames = [];
let newGames = [];
let gamesByCategory = {};

const BASE_API_URL = 'https://datn-smoky.vercel.app'; // hoặc domain backend thật của bạn

// Lưu vị trí trang hiện tại cho từng slider
let sliderPage = {
  recent: 0,
  top: 0,
  featured: 0,
  new: 0
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
  games.sort((a, b) => (getGameName(a)).localeCompare(getGameName(b)));
  recentGames = games;
  topGames = games.filter(g => g.badge === "Hot" || g.badge === "Top");
  featuredGames = games.filter(g => g.badge === "Hot" || g.badge === "Updated");
  newGames = games.filter(g => g.badge === "New");
  gamesByCategory = {};
  games.forEach(g => {
    const cat = g.category || 'Khác';
    if (!gamesByCategory[cat]) gamesByCategory[cat] = [];
    gamesByCategory[cat].push(g);
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
  } else if (sectionKey === 'recent') {
    gamesArr = recentGames.slice();
  } else if (sectionKey === 'top') {
    gamesArr = topGames.slice();
  } else if (sectionKey === 'featured') {
    gamesArr = featuredGames.slice();
  } else if (sectionKey === 'new') {
    gamesArr = newGames.slice();
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
fetch('games.json')
  .then(res => res.json())
  .then(data => {
    showLoading(false);
    allGames = data;
    groupGames(allGames);
    sliderPage.recent = 0; sliderPage.top = 0; sliderPage.featured = 0; sliderPage.new = 0;
    renderSlider(recentGames, 'recentSlider', 'recentShowMore', 'recentShowMore-prev', 'recent');
    renderSlider(topGames, 'topSlider', 'topShowMore', 'topShowMore-prev', 'top');
    renderSlider(featuredGames, 'featuredSlider', 'featuredShowMore', 'featuredShowMore-prev', 'featured');
    renderSlider(newGames, 'newSlider', 'newShowMore', 'newShowMore-prev', 'new');
    renderGamesByCategory(); // <-- chỉ gọi hàm này cho mục "Game theo thể loại"
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
  renderSlider(recentGames, 'recentSlider', 'recentShowMore', 'recentShowMore-prev', 'recent');
  renderSlider(topGames, 'topSlider', 'topShowMore', 'topShowMore-prev', 'top');
  renderSlider(featuredGames, 'featuredSlider', 'featuredShowMore', 'featuredShowMore-prev', 'featured');
  renderSlider(newGames, 'newSlider', 'newShowMore', 'newShowMore-prev', 'new');
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
// Đăng nhập
document.getElementById('loginForm').onsubmit = async function(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const res = await fetch(`${BASE_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  document.getElementById('login-message').innerText = data.message || '';
  if (data.token && data.user) {
    saveUserToLocal(data.user);
    closeAuthModal();
    showUserInfo(data.user); // Hiện avatar và info như Google
    alert('Đăng nhập thành công!');
  }
};

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
  const res = await fetch(`${BASE_API_URL}/api/auth/register`, {
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
  window.location.href = `${BASE_API_URL}/auth/google`;
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
    if (dropdownEmail) dropdownEmail.innerText = user.email || '';
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

  // Hồ sơ, lịch sử, cài đặt (demo)
  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) profileBtn.onclick = () => alert('Tính năng hồ sơ sẽ được bổ sung sau!');
  const historyBtn = document.getElementById('historyBtn');
  if (historyBtn) historyBtn.onclick = () => alert('Tính năng lịch sử chơi sẽ được bổ sung sau!');
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.onclick = () => alert('Tính năng cài đặt tài khoản sẽ được bổ sung sau!');
});

// Đổi avatar và tên tài khoản (demo)
document.addEventListener('DOMContentLoaded', function() {
  // ...các code khác...

  // Hiện popup khi ấn "Thay đổi hồ sơ"
  const profileBtn = document.getElementById('profileBtn');
  const profileModal = document.getElementById('profile-modal');
  const closeProfileModal = document.getElementById('closeProfileModal');
  const modalChangeAvatarBtn = document.getElementById('modalChangeAvatarBtn');
  const modalChangeNameBtn = document.getElementById('modalChangeNameBtn');

  if (profileBtn && profileModal) {
    profileBtn.onclick = function(e) {
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
        user.username = newName.trim(); // <-- Đảm bảo đồng bộ username
        saveUserToLocal(user);
        showUserInfo(user);
        alert('Đổi tên thành công!');
      }
      profileModal.style.display = 'none';
    };
  }
  // Đóng popup khi click ra ngoài
  if (profileModal) {
    profileModal.addEventListener('click', function(e) {
      if (e.target === profileModal) profileModal.style.display = 'none';
    });
  }
});

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
  const res = await fetch(`${BASE_API_URL}/api/auth/register`, {
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
  const res = await fetch(`${BASE_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  document.getElementById('login-message').innerText = data.message || '';
  if (data.token && data.user) {
    saveUserToLocal(data.user);
    closeAuthModal();
    showUserInfo(data.user); // Hiện avatar và info như Google
    alert('Đăng nhập thành công!');
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
  // Hoặc nếu bạn dùng class để ẩn:
  // if (modal) modal.classList.remove('show');
}

// Hàm sinh mã phòng kiểu A111
// function generateRoomCode() {
//   const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
//   const number = Math.floor(100 + Math.random() * 900); // 100-999
//   return letter + number;
// }

// Hiện modal khi click vào game
function handleGameClick(gameId, gameName) {
  window.selectedGameId = gameId;
  window.selectedGameName = gameName;
  const modal = document.getElementById('roomModal');
  modal.style.display = 'flex';

  // Lấy thông tin game từ allGames
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

  // Render lại nội dung modal
  modal.innerHTML = `
    <div class="modal-content">
      <button class="close-btn" style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:1.7rem;color:#ff9800;cursor:pointer;z-index:2;">&times;</button>
      ${infoHtml}
      <div class="modal-title" style="font-size:1.13rem;font-weight:bold;color:#ff9800;margin-bottom:18px;text-align:center;">${LANGS[currentLang]?.room_create_or_join || 'Create or join a room'}</div>
      <div class="modal-actions" style="display:flex;gap:16px;margin-bottom:10px;flex-wrap:wrap;">
        <button id="createRoomBtn" style="padding:10px 28px;border-radius:10px;background:linear-gradient(90deg,#ff9800 60%,#ffc107 100%);color:#fff;font-weight:700;font-size:1.05rem;box-shadow:0 2px 8px #ff980033;transition:background 0.18s,transform 0.12s;">${LANGS[currentLang]?.room_create || 'Create Room'}</button>
        <button id="joinRoomBtn" style="padding:10px 28px;border-radius:10px;background:linear-gradient(90deg,#ff9800 60%,#ffc107 100%);color:#fff;font-weight:700;font-size:1.05rem;box-shadow:0 2px 8px #ff980033;transition:background 0.18s,transform 0.12s;">${LANGS[currentLang]?.room_join || 'Join Room'}</button>
      </div>
      <div id="roomCodeBox" style="display:none;margin-top:18px;text-align:center;">
        ${LANGS[currentLang]?.room_code || 'Room code'}: <span id="generatedRoomCode" style="font-size:1.1rem;font-weight:bold;color:#43cea2;margin:0 8px;letter-spacing:2px;"></span>
        <button id="goToRoomBtn" style="margin-left:10px;padding:8px 18px;border-radius:8px;background:#ff9800;color:#fff;font-weight:600;">${LANGS[currentLang]?.room_enter || 'Enter Room'}</button>
      </div>
      <div id="joinRoomBox" style="display:none;margin-top:18px;text-align:center;">
        <input id="inputJoinRoomCode" placeholder="${LANGS[currentLang]?.room_input_placeholder || 'Enter room code'}" style="padding:8px 12px;border-radius:8px;border:1.5px solid #ffd54f;margin-right:8px;font-size:1rem;">
        <button id="confirmJoinRoomBtn" style="padding:8px 18px;border-radius:8px;background:#ff9800;color:#fff;font-weight:600;">${LANGS[currentLang]?.room_enter || 'Enter Room'}</button>
      </div>
    </div>
  `;

  // Gán lại sự kiện cho các nút (sau khi render)
  modal.querySelector('.close-btn').onclick = function() {
    modal.style.display = 'none';
  };

  modal.querySelector('#createRoomBtn').onclick = async function() {
    const gameId = window.selectedGameId || '';
    const gameName = window.selectedGameName || '';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const username = user.username || user.displayName || 'Guest';

    // Gửi request tạo phòng lên backend
    const res = await fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player: username,
        game: gameId
      })
    });
    const data = await res.json();
    if (data.roomCode) {
      // Hiển thị mã phòng cho người dùng hoặc chuyển sang phòng luôn
      window.location.href = `/room.html?code=${data.roomCode}&gameId=${encodeURIComponent(gameId)}&game=${encodeURIComponent(gameName)}&user=${encodeURIComponent(username)}`;
    } else {
      alert('Không thể tạo phòng. Vui lòng thử lại!');
    }
  };

  modal.querySelector('#joinRoomBtn').onclick = function() {
    modal.querySelector('#joinRoomBox').style.display = 'block';
    modal.querySelector('#roomCodeBox').style.display = 'none';
  };

  modal.querySelector('#goToRoomBtn').onclick = function() {
    const code = window.generatedRoomCode;
    const gameId = window.selectedGameId || '';
    const gameName = window.selectedGameName || '';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const username = user.username || user.displayName || 'Guest';
    window.location.href = `/room.html?code=${code}&gameId=${encodeURIComponent(gameId)}&game=${encodeURIComponent(gameName)}&user=${encodeURIComponent(username)}`;
  };

  modal.querySelector('#confirmJoinRoomBtn').onclick = async function() {
    const code = modal.querySelector('#inputJoinRoomCode').value.trim().toUpperCase();
    if (!/^[A-Z]\d{3}$/.test(code)) {
      alert(LANGS[currentLang]?.room_invalid_code || 'Invalid room code! (e.g. A123)');
      return;
    }
    // Kiểm tra mã phòng tồn tại qua API
    const res = await fetch(`/api/room?code=${code}`);
    const data = await res.json();
    if (!data.found) {
      alert(LANGS[currentLang]?.room_not_found || 'Room code not found!');
      return;
    }
    const gameId = window.selectedGameId || '';
    const gameName = window.selectedGameName || '';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const username = user.username || user.displayName || 'Guest';
    window.location.href = `/room.html?code=${code}&gameId=${encodeURIComponent(gameId)}&game=${encodeURIComponent(gameName)}&user=${encodeURIComponent(username)}`;
  };
}

const socket = io('https://datn-socket.up.railway.app', {
  transports: ['websocket']
});

// Gửi payload này lên server hoặc socket

function getMaxShow() {
  if (window.innerWidth <= 600) return 2;
  if (window.innerWidth <= 900) return 3;
  if (window.innerWidth <= 1200) return 4;
  return 5;
}
function rerenderAllSliders() {
  MAX_SHOW = getMaxShow();
  renderSlider(recentGames, 'recentSlider', 'recentShowMore', 'recentShowMore-prev', 'recent');
  renderSlider(topGames, 'topSlider', 'topShowMore', 'topShowMore-prev', 'top');
  renderSlider(featuredGames, 'featuredSlider', 'featuredShowMore', 'featuredShowMore-prev', 'featured');
  renderSlider(newGames, 'newSlider', 'newShowMore', 'newShowMore-prev', 'new');
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

// Sau khi đăng nhập ẩn danh
document.getElementById('anonymousLoginBtn').onclick = function() {
  const username = 'guest_' + Math.random().toString(36).substring(2, 10);
  const user = { username };
  saveUserToLocal(user);
  closeAuthModal();
  showUserInfo(user);
  alert('Bạn đã đăng nhập ẩn danh với tên: ' + username);
}

function saveUserToLocal(user) {
  const username = user.username || user.displayName || user.name || 'Guest';
  const userObj = {
    ...user,
    username: username
  };
  localStorage.setItem('user', JSON.stringify(userObj));
}

// --- PROFILE / ACCOUNT SETTINGS UI & logic ---
// create profile popup (shows account info) and settings modal (change name / avatar)
(function attachProfileUI() {
  // create popup (hidden by default)
  const profilePopup = document.createElement('div');
  profilePopup.id = 'profilePopup';
  Object.assign(profilePopup.style, {
    position: 'fixed', right: '18px', top: '70px', zIndex: 1200,
    background: '#fff', color: '#072026', borderRadius: '10px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.25)', padding: '12px', display: 'none', minWidth: '260px'
  });
  profilePopup.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center">
      <img id="popupAvatar" src="img/avt.png" alt="avatar" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #eee">
      <div style="flex:1">
        <div id="popupName" style="font-weight:700"></div>
        <div id="popupEmail" style="font-size:0.85rem;color:#666"></div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;justify-content:space-between">
      <button id="btnViewProfile" style="flex:1;padding:8px;border-radius:8px;border:none;background:#f3f4f6;cursor:pointer">Hồ sơ</button>
      <button id="btnAccountSettings" style="flex:1;padding:8px;border-radius:8px;border:none;background:linear-gradient(90deg,#00d4b4,#00b59a);color:#032">Cài đặt tài khoản</button>
    </div>
  `;
  document.body.appendChild(profilePopup);

  // settings modal (hidden)
  const settingsModal = document.createElement('div');
  settingsModal.id = 'accountSettingsModal';
  Object.assign(settingsModal.style, {
    position: 'fixed', right: '18px', top: '140px', zIndex: 1250,
    background: '#fff', color: '#072026', borderRadius: '12px', padding: '14px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)', display: 'none', minWidth: '300px'
  });
  settingsModal.innerHTML = `
    <div style="font-weight:800;margin-bottom:8px">Cài đặt tài khoản</div>
    <label style="font-size:0.9rem">Tên hiển thị</label>
    <input id="settingName" placeholder="Tên của bạn" style="width:100%;padding:8px;border-radius:8px;border:1px solid #ddd;margin:6px 0">
    <label style="font-size:0.9rem">Avatar (URL)</label>
    <input id="settingAvatar" placeholder="https://..." style="width:100%;padding:8px;border-radius:8px;border:1px solid #ddd;margin:6px 0">
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
      <button id="cancelSettings" style="padding:8px 12px;border-radius:8px;border:none;background:#eee">Hủy</button>
      <button id="saveSettings" style="padding:8px 12px;border-radius:8px;border:none;background:linear-gradient(90deg,#00d4b4,#00b59a);color:#022">Lưu</button>
    </div>
  `;
  document.body.appendChild(settingsModal);

  // helper to open/close popup
  function showProfilePopup(show = true) {
    profilePopup.style.display = show ? 'block' : 'none';
  }
  function showSettingsModal(show = true) {
    settingsModal.style.display = show ? 'block' : 'none';
  }

  // wire header avatar click to toggle popup (header userInfo element should exist)
  const headerUserInfo = document.getElementById('userInfo') || document.getElementById('headerUser') || null;
  if (headerUserInfo) {
    headerUserInfo.addEventListener('click', (e) => {
      e.stopPropagation();
      const visible = profilePopup.style.display === 'block';
      // hide any other modals
      showSettingsModal(false);
      showProfilePopup(!visible);
      // populate data from localStorage user
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const avatar = user.avatar || user.picture || sessionStorage.getItem('avatarUrl') || 'img/avt.png';
      const name = user.displayName || user.name || user.username || 'Khách';
      const email = user.email || '';
      const popupAvatar = document.getElementById('popupAvatar');
      const popupName = document.getElementById('popupName');
      const popupEmail = document.getElementById('popupEmail');
      if (popupAvatar) popupAvatar.src = avatar;
      if (popupName) popupName.innerText = name;
      if (popupEmail) popupEmail.innerText = email;
    });
  }

  // click outside to close
  document.addEventListener('click', () => { showProfilePopup(false); showSettingsModal(false); });

  // buttons
  document.getElementById('btnViewProfile').addEventListener('click', (e) => {
    e.stopPropagation();
    // just re-use popup details - you may expand to a full profile modal if needed
    alert('Hồ sơ:\n' + (document.getElementById('popupName').innerText || '') + '\n' + (document.getElementById('popupEmail').innerText || ''));
  });

  document.getElementById('btnAccountSettings').addEventListener('click', (e) => {
    e.stopPropagation();
    showProfilePopup(false);
    // populate settings inputs
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('settingName').value = user.displayName || user.name || user.username || '';
    document.getElementById('settingAvatar').value = user.avatar || user.picture || sessionStorage.getItem('avatarUrl') || '';
    showSettingsModal(true);
  });

  document.getElementById('cancelSettings').addEventListener('click', (e) => { e.stopPropagation(); showSettingsModal(false); });

  document.getElementById('saveSettings').addEventListener('click', async (e) => {
    e.stopPropagation();
    const newName = document.getElementById('settingName').value.trim();
    const newAvatar = document.getElementById('settingAvatar').value.trim() || null;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const username = user.username || user.displayName || user.name;
    if (!username) { alert('Không có user đăng nhập'); return; }

    try {
      const body = { username: username };
      if (newName) body.displayName = newName;
      if (newAvatar !== null) body.avatarUrl = newAvatar;
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await res.json();
      if (!j || !j.ok) {
        alert('Cập nhật thất bại');
        return;
      }
      // update localStorage user
      const updatedUser = Object.assign({}, user, j.user || {});
      // ensure fields
      if (body.displayName) updatedUser.displayName = body.displayName;
      if (body.avatarUrl !== undefined) updatedUser.avatar = body.avatarUrl;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      // update UI header
      if (document.getElementById('userAvatar')) document.getElementById('userAvatar').src = updatedUser.avatar || 'img/avt.png';
      if (document.getElementById('dropdownAvatar')) document.getElementById('dropdownAvatar').src = updatedUser.avatar || 'img/avt.png';
      if (document.getElementById('dropdownUsername')) document.getElementById('dropdownUsername').innerText = updatedUser.displayName || updatedUser.username || '';

      // persist avatar to sessionStorage for ToD page usage
      if (updatedUser.avatar) sessionStorage.setItem('avatarUrl', updatedUser.avatar);

      // if inside a room, notify server to update Room.players (the server also updates DB)
      // get room code from URL if any
      const urlParams = new URLSearchParams(window.location.search);
      const roomCode = urlParams.get('code');
      if (roomCode) {
        try {
          socket && socket.emit && socket.emit('profile-updated', { roomCode, oldName: username, newName: newName || username, avatar: updatedUser.avatar || null });
        } catch (e) { console.warn('socket emit profile-updated failed', e); }
      }

      showSettingsModal(false);
      alert('Cập nhật hồ sơ thành công');
    } catch (err) {
      console.error('save profile error', err);
      alert('Lỗi khi lưu hồ sơ');
    }
  });

})();