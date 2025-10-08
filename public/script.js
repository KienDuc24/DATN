// Lấy dữ liệu game từ games.json
let allGames = [];
let recentGames = [];
let topGames = [];
let featuredGames = [];
let newGames = [];
let gamesByCategory = {};

const BASE_API_URL = 'https://datn-smoky.vercel.app'; // hoặc domain backend thật của bạn
const MAX_SHOW = 5;

// Lưu vị trí trang hiện tại cho từng slider
let sliderPage = {
  recent: 0,
  top: 0,
  featured: 0,
  new: 0
};

// Hàm render 1 game card
function renderGameCard(game) {
  const name = getGameName(game, currentLang);
  const desc = getGameDesc(game, currentLang);
  const category = getGameCategory(game, currentLang);
  return `
    <div class="game-card" onclick="window.location.href='game/${game.id}/index.html'">
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
  const slider = document.getElementById(sliderId);
  const nextBtn = document.getElementById(nextBtnId);
  const prevBtn = document.getElementById(prevBtnId);
  let page = sliderPage[pageKey] || 0;
  const totalPage = Math.ceil(games.length / MAX_SHOW);

  const start = page * MAX_SHOW;
  const end = Math.min(start + MAX_SHOW, games.length);
  const showGames = games.slice(start, end);

  slider.innerHTML = showGames.map(renderGameCard).join('');

  // Nút >
  if (nextBtn) {
    if (end < games.length) {
      nextBtn.style.display = 'flex';
      nextBtn.disabled = false;
      nextBtn.onclick = () => {
        sliderPage[pageKey]++;
        renderSlider(games, sliderId, nextBtnId, prevBtnId, pageKey);
      };
    } else {
      nextBtn.style.display = 'none';
      nextBtn.disabled = true;
    }
  }
  // Nút <
  if (prevBtn) {
    if (page > 0) {
      prevBtn.style.display = 'flex';
      prevBtn.disabled = false;
      prevBtn.onclick = () => {
        sliderPage[pageKey]--;
        renderSlider(games, sliderId, nextBtnId, prevBtnId, pageKey);
      };
    } else {
      prevBtn.style.display = 'none';
      prevBtn.disabled = true;
    }
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
        <div class="sort-dropdown">
          <select id="sortSelect-cat-${catKey}" onchange="sortGames('cat-${catKey}')">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="players-asc">Số người tăng</option>
            <option value="players-desc">Số người giảm</option>
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
          </select>
        </div>
      </div>
      <div class="games-slider-container" id="cat-container-${catKey}">
        <button class="show-more-btn prev-btn" id="catShowMore-${catKey}-prev" style="display:none;">&#8249;</button>
        <div class="games-slider" id="catSlider-${catKey}"></div>
        <button class="show-more-btn next-btn" id="catShowMore-${catKey}" style="display:none;">&#8250;</button>
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
          <div class="game-card" onclick="window.location.href='game/${game.id}/index.html'">
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
function sortGames(sectionKey) {
  let gamesArr;
  let sliderId, nextBtnId, prevBtnId, pageKey;
  let sortBy;

  if (sectionKey.startsWith('cat-')) {
    const catKey = sectionKey.replace('cat-', '');
    sortBy = document.getElementById(`sortSelect-cat-${catKey}`).value;
    gamesArr = gamesByCategory[catKey.replace(/-/g, ' ')];
    sliderId = `catSlider-${catKey}`;
    nextBtnId = `catShowMore-${catKey}`;
    prevBtnId = `catShowMore-${catKey}-prev`;
    pageKey = `cat-${catKey}`;
  } else {
    sortBy = document.getElementById(`sortSelect-${sectionKey}`).value;
    if (sectionKey === 'recent') gamesArr = recentGames;
    if (sectionKey === 'top') gamesArr = topGames;
    if (sectionKey === 'featured') gamesArr = featuredGames;
    if (sectionKey === 'new') gamesArr = newGames;
    sliderId = `${sectionKey}Slider`;
    nextBtnId = `${sectionKey}ShowMore`;
    prevBtnId = `${sectionKey}ShowMore-prev`;
    pageKey = sectionKey;
  }

  if (!gamesArr) return;

  // Sắp xếp
  if (sortBy === 'newest') {
    gamesArr.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  } else if (sortBy === 'oldest') {
    gamesArr.sort((a, b) => (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0));
  } else if (sortBy === 'players-asc') {
    gamesArr.sort((a, b) => {
      const pa = parseInt((a.players || '').replace(/\D/g, '')) || 0;
      const pb = parseInt((b.players || '').replace(/\D/g, '')) || 0;
      return pa - pb;
    });
  } else if (sortBy === 'players-desc') {
    gamesArr.sort((a, b) => {
      const pa = parseInt((a.players || '').replace(/\D/g, '')) || 0;
      const pb = parseInt((b.players || '').replace(/\D/g, '')) || 0;
      return pb - pa;
    });
  } else if (sortBy === 'name-asc') {
    gamesArr.sort((a, b) => getGameName(a).localeCompare(getGameName(b)));
  } else if (sortBy === 'name-desc') {
    gamesArr.sort((a, b) => (b.name || b.id).localeCompare(a.name || a.id));
  }

  sliderPage[pageKey] = 0;
  renderSlider(gamesArr, sliderId, nextBtnId, prevBtnId, pageKey);
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
        <div class="sort-dropdown">
          <select id="sortSelect-cat-${catKey}" onchange="sortGames('cat-${catKey}')">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="players-asc">Số người tăng</option>
            <option value="players-desc">Số người giảm</option>
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
          </select>
        </div>
      </div>
      <div class="games-slider-container" id="cat-container-${catKey}">
        <button class="show-more-btn prev-btn" id="catShowMore-${catKey}-prev" style="display:none;">&#8249;</button>
        <div class="games-slider" id="catSlider-${catKey}"></div>
        <button class="show-more-btn next-btn" id="catShowMore-${catKey}" style="display:none;">&#8250;</button>
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
fetch('games.json')
  .then(res => res.json())
  .then(data => {
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
  if (!firstLoad) document.getElementById('langSelect').value = lang;
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
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user)); // Lưu user vào localStorage
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
  localStorage.setItem('token', 'anonymous');
  localStorage.setItem('username', username);
  localStorage.setItem('user', JSON.stringify(user));
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
  localStorage.setItem('user', JSON.stringify(user));
  window.history.replaceState({}, document.title, window.location.pathname);
  showUserInfo(user);
  alert('Đăng nhập Google thành công! Xin chào ' + (user.name || user.email));
}

// Khi đăng nhập ẩn danh
const anonymousBtn = document.getElementById('anonymousLoginBtn');
if (anonymousBtn) {
  anonymousBtn.onclick = function() {
    const username = 'guest_' + Math.random().toString(36).substring(2, 10);
    const user = { username };
    localStorage.setItem('token', 'anonymous');
    localStorage.setItem('username', username);
    localStorage.setItem('user', JSON.stringify(user));
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
    if (dropdownUsername) dropdownUsername.innerText = user.name || user.username || 'User';
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
        localStorage.setItem('user', JSON.stringify(user));
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
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user)); // Lưu user vào localStorage
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

// Gọi API tạo room và điều hướng sang trang room.html
async function handleGameClick(game) {
  // Gọi API tạo room
  const res = await fetch('/api/room/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: game.name, gameId: game.id })
  });
  const data = await res.json();
  // Điều hướng sang room.html với mã phòng và tên game
  window.location.href = `/room.html?code=${data.code}&game=${encodeURIComponent(game.name)}`;
}
