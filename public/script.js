// public/script.js (FULL VERSION - RESTORED & FIXED)

// --- Biến cục bộ cho script.js (nếu cần) ---
let MAX_SHOW = getMaxShow();

// --- 1. Render & Cập nhật Giao diện (UI Rendering) ---

/** Render 1 game card */
function renderGameCard(game) {
  const name = getGameName(game, currentLang);
  const desc = getGameDesc(game, currentLang);
  const category = getGameCategory(game, currentLang);
  
  // --- FIX: Logic hiển thị Badge (Coming Soon / Hot) ---
  let badgeHtml = "";
  if (game.isComingSoon) {
      // Badge màu xám cho game đang phát triển
      const badgeText = (LANGS[currentLang] && LANGS[currentLang].badge_coming_soon) || "Coming Soon";
      badgeHtml = `<div class="game-badge coming-soon" style="background: linear-gradient(90deg, #7f8c8d, #95a5a6);">${badgeText}</div>`;
  } else if (game.badge) {
      // Badge bình thường (ví dụ: HOT, NEW)
      badgeHtml = `<div class="game-badge">${game.badge}</div>`;
  }

  // Style chặn click nếu game chưa ra mắt
  const cursorStyle = game.isComingSoon ? 'cursor: not-allowed; opacity: 0.85;' : '';

  return `
    <div class="game-card" 
         onclick="handleGameClick('${game.id}', '${name.replace(/'/g, "\\'")}')"
         style="${cursorStyle}"
    >
      ${badgeHtml}
      <img src="game/${game.id}/Img/logo.png" alt="${name}" onerror="this.src='img/fav.svg'" />
      <div class="game-title">${name}</div>
      <div class="game-category">${category}</div>
      <div class="game-desc">${desc}</div>
      ${game.players ? `<div class="game-players">👥 ${game.players} ${LANGS[currentLang]?.players || ''}</div>` : ""}
    </div>
  `;
}

/** Render slider cho 1 nhóm game với nút < > */
function renderSlider(games, sliderId, pageKey) {
  // 1. Tìm container cha và thanh cuộn
  const sliderContainer = document.getElementById(sliderId)?.parentElement; 
  if (!sliderContainer) return;
  
  const slider = sliderContainer.querySelector('.games-slider-scroll'); 
  if (!slider) {
      console.warn('Không tìm thấy .games-slider-scroll cho sliderId:', sliderId);
      return;
  }

  // 2. Render game
  slider.innerHTML = games.map(renderGameCard).join('');

  // 3. Xóa các nút < > cũ (nếu có)
  sliderContainer.querySelectorAll('.slider-btn').forEach(btn => btn.remove());

  // 4. Dùng setTimeout để đợi trình duyệt render và tính toán
  setTimeout(() => {
    // 5. Kiểm tra xem nội dung có thực sự bị tràn không
    const hasOverflow = slider.scrollWidth > slider.clientWidth + 5; // +5px cho chắc chắn
    
    if (hasOverflow) {
      // 6. Tạo nút Trái (<)
      const btnLeft = document.createElement('button');
      btnLeft.className = 'slider-btn left';
      btnLeft.innerHTML = '‹'; 
      
      // 7. Tạo nút Phải (>)
      const btnRight = document.createElement('button');
      btnRight.className = 'slider-btn right';
      btnRight.innerHTML = '›'; 
      
      btnLeft.onclick = (e) => {
        e.stopPropagation(); 
        slider.scrollBy({ left: -slider.clientWidth * 0.8, behavior: 'smooth' }); // Cuộn 80%
      };
      
      btnRight.onclick = (e) => {
        e.stopPropagation(); 
        slider.scrollBy({ left: slider.clientWidth * 0.8, behavior: 'smooth' }); // Cuộn 80%
      };

      sliderContainer.appendChild(btnLeft);
      sliderContainer.appendChild(btnRight);

      // --- 8. HÀM KIỂM TRA VỊ TRÍ CUỘN (LOGIC MỚI) ---
      const updateButtonVisibility = () => {
        const scrollLeft = slider.scrollLeft;
        const scrollWidth = slider.scrollWidth;
        const clientWidth = slider.clientWidth;

        // Kiểm tra vị trí đầu (ẩn nút < nếu ở đầu)
        if (scrollLeft < 10) { // 10px sai số
          btnLeft.style.display = 'none';
        } else {
          btnLeft.style.display = 'flex';
        }

        // Kiểm tra vị trí cuối (ẩn nút > nếu ở cuối)
        if (scrollWidth - scrollLeft - clientWidth < 10) { // 10px sai số
          btnRight.style.display = 'none';
        } else {
          btnRight.style.display = 'flex';
        }
      };
      // --- KẾT THÚC LOGIC MỚI ---

      // 9. Gắn sự kiện 'scroll' vào thanh cuộn
      slider.addEventListener('scroll', updateButtonVisibility);
      
      // 10. Chạy 1 lần khi tải để set trạng thái ban đầu (ẩn nút <)
      updateButtonVisibility();
    }
  }, 100); 
}


/** Hiển thị các slider theo thể loại */
function renderGamesByCategory() {
  const categoryList = document.getElementById('category-list');
  if (!categoryList) return;
  categoryList.innerHTML = ''; // Xóa nội dung cũ

  Object.keys(gamesByCategory).forEach(cat => {
    const catKey = cat.replace(/\s+/g, '-');
    const sliderId = `catSlider-${catKey}`; // ID mới cho thanh cuộn
    
    const section = document.createElement('div');
    section.className = 'category-slider-section';
    
    section.innerHTML = `
      <div class="section-title-row" id="cat-${catKey}">
        <div class="section-title">${cat}</div>
      </div>
      ${renderSortDropdown(`cat-${catKey}`)}
      
      <div class="games-slider-container">
        <div class="games-slider-scroll" id="${sliderId}">
          </div>
      </div>
    `;
    
    categoryList.appendChild(section);
    
    // Gọi renderSlider cho slider của thể loại này
    renderSlider(gamesByCategory[cat], sliderId, `cat-${catKey}`);
  });
}


/** Render dropdown sắp xếp */
function renderSortDropdown(key = '') {
  return `
    <div class="sort-dropdown-row">
      <label class="sort-label" data-i18n="sort_by">Sắp xếp theo</label>
      <div class="sort-dropdown">
        <select class="sort-select" onchange="sortGames('${key}', this)">
          <option value="newest" data-i18n="sort_newest">Mới nhất</option>
          <option value="oldest" data-i18n="sort_oldest">Cũ nhất</option>
          <option value="players_asc" data-i18n="sort_players_asc">Số người tăng</option>
          <option value="players_desc" data-i18n="sort_players_desc">Số người giảm</option>
          <option value="az" data-i18n="sort_az">A-Z</option>
          <option value="za" data-i18n="sort_za">Z-A</option>
        </select>
      </div>
    </div>
  `;
}

/** Hiển thị kết quả tìm kiếm */
function renderSearchResults(filtered, keyword) {
    const main = document.querySelector('.main-content');
    let searchResultDiv = document.getElementById('search-result');

    // Ẩn các mục khác
    Array.from(main.children).forEach(child => {
        if (child.id !== 'search-result') child.style.display = 'none';
    });

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
        text = (text === undefined || text === null) ? '' : String(text);
        if (!text) return '';
        return text.replace(
        new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
        '<span style="background:#ff9800;color:#fff;border-radius:4px;padding:1px 4px;">$1</span>'
        );
    }

    const sliderId = "searchSlider";
    
    // --- FIX: Xây dựng HTML cho thẻ game trong kết quả tìm kiếm (kèm Badge) ---
    const cardsHtml = filtered.map(game => {
        const name = getGameName(game, currentLang);
        const desc = getGameDesc(game, currentLang);
        const category = getGameCategory(game, currentLang);
        
        let badgeHtml = "";
        if (game.isComingSoon) {
            const badgeText = (LANGS[currentLang] && LANGS[currentLang].badge_coming_soon) || "Coming Soon";
            badgeHtml = `<div class="game-badge coming-soon" style="background: linear-gradient(90deg, #7f8c8d, #95a5a6);">${badgeText}</div>`;
        } else if (game.badge) {
            badgeHtml = `<div class="game-badge">${game.badge}</div>`;
        }
        
        const cursorStyle = game.isComingSoon ? 'cursor: not-allowed; opacity: 0.85;' : '';

        return `
        <div class="game-card" 
             onclick="handleGameClick('${game.id}', '${name.replace(/'/g, "\\'")}')"
             style="${cursorStyle}"
        >
            ${badgeHtml}
            <img src="game/${game.id}/Img/logo.png" alt="${name}" onerror="this.src='img/fav.svg'" />
            <div class="game-title">${highlight(name)}</div>
            <div class="game-category">${highlight(category)}</div>
            <div class="game-desc">${highlight(desc)}</div>
            ${game.players ? `<div class="game-players">👥 ${highlight(game.players)} ${LANGS[currentLang]?.players || 'người chơi'}</div>` : ""}
        </div>
        `;
    }).join('');
    // -----------------------------------------------------------------------

    searchResultDiv.innerHTML = `
        <div class="section-title-row">
        <div class="section-title">Kết quả tìm kiếm cho "<span style="color:#ff9800">${keyword}</span>"</div>
        </div>
        
        <div class="games-slider-container">
          <div class="games-slider-scroll" id="${sliderId}">
             ${cardsHtml}
          </div>
        </div>
    `;
    
    // Gọi renderSlider để gắn logic cuộn
    renderSlider(filtered, sliderId, 'search');
}

/** Ẩn kết quả tìm kiếm và hiện lại các slider */
function hideSearchResults() {
    const main = document.querySelector('.main-content');
    const searchResultDiv = document.getElementById('search-result');
    Array.from(main.children).forEach(child => {
        if (child.id !== 'search-result') child.style.display = '';
    });
    if (searchResultDiv) searchResultDiv.style.display = 'none';
}


/** Hiển thị modal */
function openAuthModal(tab = 'login') {
  document.getElementById('auth-modal').style.display = 'flex';
  showAuthTab(tab);
  document.getElementById('loginTab').onclick = function() {
    showAuthTab('login');
  };
  document.getElementById('registerTab').onclick = function() {
    showAuthTab('register');
  };
}

/** Chuyển tab trong modal Auth */
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

/** Đóng modal Auth */
function closeAuthModal() {
  const modal = document.querySelector('.auth-form-modal, .auth-modal, .modal');
  if (modal) modal.style.display = 'none';
}

// --- HÀM HELPER TẠO AVATAR DICEBEAR (Dùng chung) ---
function getAvatarUrl(name) {
    const safeName = name || 'guest';
    return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
}

/** Cập nhật UI header khi đăng nhập */
function showUserInfo(user) {
  const headerAuthBtns = document.getElementById('headerAuthBtns');
  if (headerAuthBtns) headerAuthBtns.style.display = 'none';
  const sidebarAuthBtns = document.getElementById('sidebarAuthBtns');
  if (sidebarAuthBtns) sidebarAuthBtns.style.display = 'none';

  const userInfo = document.getElementById('userInfo');
  const userAvatar = document.getElementById('userAvatar'); 
  
  if (userInfo) {
    userInfo.style.display = 'flex';
  }
  
  // --- FIX: Hiển thị Avatar DiceBear ---
  const avatarUrl = getAvatarUrl(user.username);
  if (userAvatar) {
    userAvatar.style.display = 'block'; 
    userAvatar.src = avatarUrl;
  }

  let usernameText = document.getElementById('header-username-text');
  if (!usernameText) {
      usernameText = document.createElement('span');
      usernameText.id = 'header-username-text';
      usernameText.style.cssText = 'color: #ff9800; font-weight: 700; margin-right: 10px; cursor: pointer;'; 
      userInfo.prepend(usernameText); 
  }
  usernameText.textContent = user.displayName || user.username || 'User'; 


  // Cập nhật dropdown
  const dropdownAvatar = document.getElementById('dropdownAvatar');
  const dropdownUsername = document.getElementById('dropdownUsername');
  const dropdownEmail = document.getElementById('dropdownEmail'); 
  
  if (dropdownAvatar) {
      dropdownAvatar.style.display = 'block'; 
      dropdownAvatar.src = avatarUrl;
  }
  if (dropdownUsername) dropdownUsername.innerText = user.displayName || user.username || 'User';
  if (dropdownEmail) dropdownEmail.innerText = user.email || ''; 
}


/** Ẩn UI user khi đăng xuất */
function hideUserInfo() {
    const headerAuthBtns = document.getElementById('headerAuthBtns');
    if (headerAuthBtns) headerAuthBtns.style.display = '';
    const sidebarAuthBtns = document.getElementById('sidebarAuthBtns');
    if (sidebarAuthBtns) sidebarAuthBtns.style.display = '';
    const userInfo = document.getElementById('userInfo');
    if (userInfo) userInfo.style.display = 'none';
    
    const usernameText = document.getElementById('header-username-text');
    if(usernameText) usernameText.textContent = '';
    
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.style.display = 'block';
        userAvatar.src = 'img/guestlogo.png'; // Về mặc định
    }

    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) userDropdown.style.display = 'none';
}

/** Hiển thị loading spinner */
function showLoading(show = true) {
  const spinner = document.getElementById('loadingSpinner');
  if(spinner) spinner.style.display = show ? 'flex' : 'none';
}


// --- 2. Chức năng Phụ & Hiệu ứng (Auxiliary UI) ---

/** Bật/tắt sidebar */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar || !overlay) return;
  if (sidebar.classList.contains('show')) {
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
  } else {
    sidebar.classList.add('show');
    overlay.classList.add('show');
  }
}

/** Mở rộng/thu gọn category */
function toggleCategory(catId) {
  const content = document.getElementById(`${catId}-content`);
  const arrow = document.getElementById(`${catId}-arrow`);
  if (!content || !arrow) return;
  if (content.style.display === 'none' || content.style.display === '') {
    content.style.display = 'block';
    arrow.innerHTML = '&#9660;';
  } else {
    content.style.display = 'none';
    arrow.innerHTML = '&#9654;';
  }
}

/** Hiển thị ô tìm kiếm trên mobile */
function showMobileSearch() {
  const header = document.querySelector('.header-main');
  if(header) header.classList.add('mobile-searching');
  setTimeout(() => {
    const searchInput = document.getElementById('searchInput');
    if(searchInput) searchInput.focus();
  }, 100);
}

/** Cuộn lên đầu trang */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Lấy số lượng card tối đa dựa trên kích thước cửa sổ */
function getMaxShow() {
  // Con số này chỉ còn ý nghĩa cho thanh cuộn ngang
  if (window.innerWidth <= 600) return 2;
  if (window.innerWidth <= 900) return 3;
  if (window.innerWidth <= 1200) return 4;
  return 5;
}

/** Render lại tất cả slider (dùng khi resize hoặc đổi ngôn ngữ) */
function rerenderAllSliders() {
  MAX_SHOW = getMaxShow();
  // Render lại slider (cuộn ngang)
  renderSlider(allGames, 'allSlider', 'all');
  renderSlider(featuredGames, 'featuredSlider', 'featured');
  // Render lại grid (thể loại)
  renderGamesByCategory();
  updateLangUI();
}

// --- 3. Helper đa ngôn ngữ (i18n) ---

/** Cập nhật toàn bộ UI theo ngôn ngữ */
function updateLangUI() {
  if (!LANGS || !LANGS[currentLang]) return;
  const langData = LANGS[currentLang];
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (langData[key]) {
      if (el.tagName === 'A' && el.querySelector('.icon')) {
        const icon = el.querySelector('.icon');
        el.innerHTML = icon.outerHTML + ' ' + langData[key];
      } else if (el.querySelector('.eye-icon')) {
          // FIX: Giữ lại icon mắt cho nút password
          const icon = el.querySelector('.eye-icon');
          const textSpan = el.querySelector('.text');
          if (textSpan) textSpan.innerText = langData[key];
          else el.innerHTML = icon.outerHTML + ' ' + langData[key];
      } else {
        el.innerText = langData[key];
      }
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (langData[key]) el.placeholder = langData[key];
  });

  const searchInput = document.getElementById('searchInput');
  if (searchInput && langData.search_placeholder)
    searchInput.placeholder = langData.search_placeholder;

  document.querySelectorAll('.sort-label').forEach(el => {
    el.textContent = langData.sort_by || 'Sắp xếp theo';
  });

  document.querySelectorAll('.sort-select').forEach(select => {
    select.querySelectorAll('option').forEach(opt => {
      const key = opt.getAttribute('data-i18n');
      if (key && langData[key]) opt.textContent = langData[key];
    });
  });

  const loginBtn = document.querySelector('.auth-btn[data-i18n="login"]');
  if(loginBtn) loginBtn.innerText = langData.login;
  const registerBtn = document.querySelector('.auth-btn[data-i18n="register"]');
  if(registerBtn) registerBtn.innerText = langData.register;

  const authOr = document.querySelector('.auth-or span');
  if (authOr && langData.or) authOr.innerText = langData.or;
}

/** Helper lấy tên game theo ngôn ngữ */
function getGameName(game, lang = currentLang) {
  if (typeof game.name === 'string') return game.name;
  return game.name?.[lang] || game.name?.vi || game.name?.en || '';
}

/** Helper lấy mô tả game theo ngôn ngữ */
function getGameDesc(game, lang = currentLang) {
  if (typeof game.desc === 'string') return game.desc;
  return game.desc?.[lang] || game.desc?.vi || game.desc?.en || '';
}

/** Helper lấy thể loại game theo ngôn ngữ */
function getGameCategory(game, lang = currentLang) {
  if (typeof game.category === 'string') return game.category;
  return game.category?.[lang] || game.category?.vi || game.category?.en || '';
}


// --- 4. Gắn các sự kiện UI ---
document.addEventListener('DOMContentLoaded', function() {
    
    // Nút Back-to-top
    window.addEventListener('scroll', function() {
        const btn = document.getElementById('backToTopBtn');
        if(!btn) return;
        if (window.scrollY > 200) {
            btn.classList.add('show');
        } else {
            btn.classList.remove('show');
        }
    });

    // Resize window
    window.addEventListener('resize', function() {
        const newMax = getMaxShow();
        if (newMax !== MAX_SHOW) {
            rerenderAllSliders();
        }
    });

    // --- FIX: LOGIC HIỆN/ẨN MẬT KHẨU (Dùng LANGS) ---

    const loginPwdInput = document.getElementById('login-password');
    const loginToggleBtn = document.getElementById('togglePassword');
    
    if (loginPwdInput && loginToggleBtn) {
        loginToggleBtn.onclick = function(e) {
            e.preventDefault();
            const isHidden = loginPwdInput.type === 'password';
            loginPwdInput.type = isHidden ? 'text' : 'password';
            
            const icon = isHidden ? '🙈' : '👁';
            const textKey = isHidden ? 'hide_pass' : 'show_pass';
            const textVal = (LANGS[currentLang] && LANGS[currentLang][textKey]) || (isHidden ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
            
            this.innerHTML = `<span class="eye-icon">${icon}</span> <span class="text" data-i18n="${textKey}">${textVal}</span>`;
        };
    }

    const toggleRegisterBtn = document.getElementById('toggleRegisterPassword');
    const pw1 = document.getElementById('register-password');
    const pw2 = document.getElementById('register-password2');
    
    if (toggleRegisterBtn && pw1 && pw2) {
        toggleRegisterBtn.onclick = function(e) {
            e.preventDefault();
            const isHidden = pw1.type === 'password';
            pw1.type = isHidden ? 'text' : 'password';
            pw2.type = isHidden ? 'text' : 'password';
            
            const icon = isHidden ? '🙈' : '👁️';
            const textKey = isHidden ? 'hide_pass' : 'show_pass';
            const textVal = (LANGS[currentLang] && LANGS[currentLang][textKey]) || (isHidden ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
            
            this.innerHTML = `<span class="eye-icon">${icon}</span> <span class="text" data-i18n="${textKey}">${textVal}</span>`;
        };
    }
    
    // --- KẾT THÚC FIX ---


    // Quên mật khẩu
    const forgotBtn = document.getElementById('forgotPasswordBtn');
    if (forgotBtn) {
        forgotBtn.onclick = function() {
            alert('Tính năng quên mật khẩu sẽ được bổ sung sau!');
        };
    }

    // Nút toggle sidebar
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    if(sidebarToggle) sidebarToggle.onclick = toggleSidebar;
    
    // Overlay sidebar
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if(sidebarOverlay) sidebarOverlay.onclick = toggleSidebar;

    // Nút tìm kiếm mobile
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    if(searchToggleBtn) searchToggleBtn.onclick = showMobileSearch;

    // Ẩn tìm kiếm mobile khi blur
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('blur', function() {
            setTimeout(() => { 
                if (window.innerWidth <= 700 && !this.value) {
                document.querySelector('.header-main').classList.remove('mobile-searching');
                }
            }, 150);
        });
        
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && window.innerWidth <= 700 && !this.value) {
                document.querySelector('.header-main').classList.remove('mobile-searching');
            }
        });
    }

    // Nút cuộn lên top
    const backToTopBtn = document.getElementById('backToTopBtn');
    if(backToTopBtn) backToTopBtn.onclick = scrollToTop;
    
    // Nút đóng modal auth
    const authModalClose = document.querySelector('.auth-modal-close');
    if(authModalClose) authModalClose.onclick = () => document.getElementById('auth-modal').style.display = 'none';

    // Dropdown user
    const userInfo = document.getElementById('userInfo');
    const userDropdown = document.getElementById('userDropdown');
    let dropdownVisible = false;

    if (userInfo && userDropdown) {
        userInfo.onclick = function(e) {
            e.stopPropagation();
            dropdownVisible = !dropdownVisible;
            userDropdown.style.display = dropdownVisible ? 'flex' : 'none';
        };
        
        document.addEventListener('click', function() {
            dropdownVisible = false;
            userDropdown.style.display = 'none';
        });
        userDropdown.onclick = function(e) {
            e.stopPropagation();
        };
    }

    // KHỞI TẠO UI PROFILE & SETTINGS
    profileAndSettingsUI();
});

/**
 * Tạo và quản lý UI cho modal Profile (Hồ sơ) và Settings (Cài đặt)
 * (ĐÃ ĐƯỢC PHỤC HỒI ĐẦY ĐỦ)
 */
function profileAndSettingsUI() {
    function getUserSafe() {
        try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
    }

    // Cập nhật avatar/tên trên header
    function applyHeaderUser(updated) {
        const ua = document.getElementById('userAvatar');
        const da = document.getElementById('dropdownAvatar');
        const du = document.getElementById('dropdownUsername');
        
        // FIX: Dùng DiceBear
        const avatarUrl = getAvatarUrl(updated.username);

        if (ua) {
            ua.style.display = 'block'; 
            ua.src = avatarUrl; 
        }
        if (da) {
            da.style.display = 'block';
            da.src = avatarUrl;
        }
        
        const usernameText = document.getElementById('header-username-text');
        if (usernameText) usernameText.textContent = updated.displayName || updated.username || 'User';
        
        if (du && (updated.displayName || updated.username)) du.innerText = updated.displayName || updated.username;
        
        // Cập nhật email trong dropdown
        const de = document.getElementById('dropdownEmail');
        if (de) de.innerText = updated.email || '';
    }
    // Gán vào window để main.js có thể gọi
    window.applyHeaderUser = applyHeaderUser;


    function setupSettingsModal() {
        let modal = document.getElementById('profile-modal');
        if (!modal) return; 
        
        modal.querySelector('#closeProfileModal').onclick = () => modal.style.display = 'none';
    }

    // Tạo popup profile (xem thông tin)
    function createProfileCenterPopup() {
        let pop = document.getElementById('profile-center-popup');
        if (pop) return pop;

        pop = document.createElement('div');
        pop.id = 'profile-center-popup';
        pop.style.cssText = 'position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 1500; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.35);';
        
        pop.innerHTML = `
        <div id="profile-center-box" style="min-width:260px;max-width:420px;background:#23272f; color: #fff; border-radius:12px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,0.32);text-align:center; position: relative; border: 1px solid #ff980033;">
            <button id="profile-center-close" style="position:absolute;right:10px;top:10px;background:none;border:none;font-size:1.2rem;cursor:pointer; color: #ff9800;">×</button>
            <img id="profile-center-avatar" src="" style="width:86px;height:86px;border-radius:50%;object-fit:cover;border:2px solid #ff9800;margin-bottom:10px; display:block; margin-left: auto; margin-right: auto;">
            <div id="profile-center-name" style="font-weight:700;font-size:1.25rem;margin-bottom:4px; color: #ff9800;"></div>
            <div id="profile-center-email" style="color:#bbb;margin-bottom:12px; font-size: 0.95rem;"></div>
        </div>
        `;
        document.body.appendChild(pop);

        pop.addEventListener('click', (e) => {
        if (e.target === pop) pop.style.display = 'none';
        });
        pop.querySelector('#profile-center-close').addEventListener('click', () => pop.style.display = 'none');
        return pop;
    }

    // Hiển thị popup profile
    function showProfileCenter(show = true) {
        const pop = createProfileCenterPopup();
        const user = getUserSafe();
        const name = user.displayName || user.username || 'Khách';
        const email = user.email || '(Chưa có email)';
        
        // FIX: Dùng DiceBear
        const avatarUrl = getAvatarUrl(user.username);

        const aEl = document.getElementById('profile-center-avatar');
        const nEl = document.getElementById('profile-center-name');
        const eEl = document.getElementById('profile-center-email');
        
        if (aEl) {
            aEl.src = avatarUrl;
            aEl.style.display = 'block';
        }
        if (nEl) nEl.innerText = name;
        if (eEl) eEl.innerText = email;
        pop.style.display = show ? 'flex' : 'none';
    }

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if(typeof openSettingsModal === 'function') {
                openSettingsModal(); // Gọi hàm logic từ main.js
            } else {
                alert("Lỗi: Không tìm thấy hàm openSettingsModal()");
            }
        });
    }

    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showProfileCenter(true);
        });
    }

    document.addEventListener('click', () => {
        const pc = document.getElementById('profile-center-popup');
        if (pc) pc.style.display = 'none';
    });
    
    setupSettingsModal();
}