let MAX_SHOW = getMaxShow();
const API_BASE_URL = window.API_BASE_URL || 'https://datn-socket.up.railway.app';


function renderGameCard(game) {
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
      <div class="game-title">${name}</div>
      <div class="game-category">${category}</div>
      <div class="game-desc">${desc}</div>
      ${game.players ? `<div class="game-players">👥 ${game.players} ${LANGS[currentLang]?.players || ''}</div>` : ""}
    </div>
  `;
}

function renderSlider(games, sliderId, pageKey) {
  const sliderContainer = document.getElementById(sliderId)?.parentElement; 
  if (!sliderContainer) return;
  
  const slider = sliderContainer.querySelector('.games-slider-scroll'); 
  if (!slider) {
      console.warn('Không tìm thấy .games-slider-scroll cho sliderId:', sliderId);
      return;
  }

  slider.innerHTML = games.map(renderGameCard).join('');

  sliderContainer.querySelectorAll('.slider-btn').forEach(btn => btn.remove());
  setTimeout(() => {
    const hasOverflow = slider.scrollWidth > slider.clientWidth + 5; 
    
    if (hasOverflow) {
      const btnLeft = document.createElement('button');
      btnLeft.className = 'slider-btn left';
      btnLeft.innerHTML = '‹'; 
      
      const btnRight = document.createElement('button');
      btnRight.className = 'slider-btn right';
      btnRight.innerHTML = '›'; 
      
      btnLeft.onclick = (e) => {
        e.stopPropagation(); 
        slider.scrollBy({ left: -slider.clientWidth * 0.8, behavior: 'smooth' }); 
      };
      
      btnRight.onclick = (e) => {
        e.stopPropagation(); 
        slider.scrollBy({ left: slider.clientWidth * 0.8, behavior: 'smooth' }); 
      };

      sliderContainer.appendChild(btnLeft);
      sliderContainer.appendChild(btnRight);
      const updateButtonVisibility = () => {
        const scrollLeft = slider.scrollLeft;
        const scrollWidth = slider.scrollWidth;
        const clientWidth = slider.clientWidth;

        if (scrollLeft < 10) { 
          btnLeft.style.display = 'none';
        } else {
          btnLeft.style.display = 'flex';
        }

        if (scrollWidth - scrollLeft - clientWidth < 10) { 
          btnRight.style.display = 'none';
        } else {
          btnRight.style.display = 'flex';
        }
      };
      slider.addEventListener('scroll', updateButtonVisibility);
      
      updateButtonVisibility();
    }
  }, 100); 
}

function renderGamesByCategory() {
  const categoryList = document.getElementById('category-list');
  if (!categoryList) return;
  categoryList.innerHTML = ''; 

  Object.keys(gamesByCategory).forEach(cat => {
    const catKey = cat.replace(/\s+/g, '-');
    const sliderId = `catSlider-${catKey}`; 
    
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
        renderSlider(gamesByCategory[cat], sliderId, `cat-${catKey}`);
  });
}


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

function renderSearchResults(filtered, keyword) {
    const main = document.querySelector('.main-content');
    let searchResultDiv = document.getElementById('search-result');
    Array.from(main.children).forEach(child => {
        if (child.id !== 'search-result') child.style.display = 'none';
    });

    if (!searchResultDiv) {
        searchResultDiv = document.createElement('div');
        searchResultDiv.id = 'search-result';
        main.appendChild(searchResultDiv);
    }
    searchResultDiv.style.display = '';

    if (filtered.length === 0) {
        searchResultDiv.innerHTML = `<div style="color:#ff9800;font-size:1.2rem;padding:32px 0;">Không tìm thấy trò chơi phù hợp.</div>`;
        return;
    }

    const sliderId = "searchSlider";
    
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
    
    renderSlider(filtered, sliderId, 'search');
}

function hideSearchResults() {
    const main = document.querySelector('.main-content');
    const searchResultDiv = document.getElementById('search-result');
    Array.from(main.children).forEach(child => {
        if (child.id !== 'search-result') child.style.display = '';
    });
    if (searchResultDiv) searchResultDiv.style.display = 'none';
}

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
  if (forgotForm) forgotForm.style.display = 'none';
}

function closeAuthModal() {
  const modal = document.querySelector('.auth-form-modal, .auth-modal, .modal');
  if (modal) modal.style.display = 'none';
  const loginForm = document.getElementById('loginForm');
  const forgotForm = document.getElementById('forgotForm');
  if (loginForm && forgotForm) {
      loginForm.style.display = ''; 
      forgotForm.style.display = 'none';
  }
}

function getAvatarUrl(name) {
    const safeName = name || 'guest';
    return `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(safeName)}`;
}

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

function hideUserInfo() {
  const headerAuthBtns = document.getElementById('headerAuthBtns');
  if (headerAuthBtns) headerAuthBtns.style.display = '';
  
  const sidebarAuthBtns = document.getElementById('sidebarAuthBtns');
  if (sidebarAuthBtns) sidebarAuthBtns.style.display = '';

  const userInfo = document.getElementById('userInfo');
  if (userInfo) userInfo.style.display = 'none';
  
  const usernameText = document.getElementById('header-username-text');
  if (usernameText) usernameText.textContent = '';
  
  const userAvatar = document.getElementById('userAvatar');
  if (userAvatar) {
      userAvatar.style.display = 'block';
      userAvatar.src = 'img/guestlogo.png'; 
  }

  const userDropdown = document.getElementById('userDropdown');
  if (userDropdown) userDropdown.style.display = 'none';
  
  console.log('Đã đăng xuất và ẩn thông tin user thành công.');
}

function showLoading(show = true) {
  const spinner = document.getElementById('loadingSpinner');
  if(spinner) spinner.style.display = show ? 'flex' : 'none';
}

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

function showMobileSearch() {
  const header = document.querySelector('.header-main');
  if(header) header.classList.add('mobile-searching');
  setTimeout(() => {
    const searchInput = document.getElementById('searchInput');
    if(searchInput) searchInput.focus();
  }, 100);
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

function rerenderAllSliders() {
  MAX_SHOW = getMaxShow();
  renderSlider(allGames, 'allSlider', 'all');
  renderSlider(featuredGames, 'featuredSlider', 'featured');
  renderGamesByCategory();
  updateLangUI();
}

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

document.addEventListener('DOMContentLoaded', function() {
    
    window.addEventListener('scroll', function() {
        const btn = document.getElementById('backToTopBtn');
        if(!btn) return;
        if (window.scrollY > 200) {
            btn.classList.add('show');
        } else {
            btn.classList.remove('show');
        }
    });

    window.addEventListener('resize', function() {
        const newMax = getMaxShow();
        if (newMax !== MAX_SHOW) {
            rerenderAllSliders();
        }
    });

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
    const forgotBtn = document.getElementById('forgotPasswordBtn'); 
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotForm = document.getElementById('forgotForm');
    const backToLoginBtn = document.getElementById('backToLoginBtn');

    if (forgotBtn) {
        forgotBtn.onclick = function(e) {
            e.preventDefault();
            loginForm.style.display = 'none';
            registerForm.style.display = 'none';
            forgotForm.style.display = 'flex';
        };
    }

    if (backToLoginBtn) {
        backToLoginBtn.onclick = function() {
            forgotForm.style.display = 'none';
            loginForm.style.display = 'flex';
        };
    }

    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const msg = document.getElementById('forgot-message');
            
            const txtSending = (LANGS[currentLang] && LANGS[currentLang].sending) || 'Đang gửi...';
            msg.innerText = txtSending;
            msg.style.color = '#ff9800';
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                
                if (res.ok) {
                    msg.style.color = '#4caf50';
                    const txtSuccess = (LANGS[currentLang] && LANGS[currentLang].sent_success) || 'Đã gửi mail!';
                    msg.innerText = txtSuccess;
                } else {
                    msg.style.color = '#ff4757';
                    const txtError = (LANGS[currentLang] && LANGS[currentLang].sent_error) || 'Lỗi gửi mail.';
                    msg.innerText = data.message || txtError;
                }
            } catch (err) {
                const txtConnErr = (LANGS[currentLang] && LANGS[currentLang].connect_error) || 'Lỗi kết nối.';
                msg.innerText = txtConnErr;
            }
        });
    }

    const sidebarToggle = document.querySelector('.sidebar-toggle');
    if(sidebarToggle) sidebarToggle.onclick = toggleSidebar;
    
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if(sidebarOverlay) sidebarOverlay.onclick = toggleSidebar;

    const searchToggleBtn = document.getElementById('searchToggleBtn');
    if(searchToggleBtn) searchToggleBtn.onclick = showMobileSearch;

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

    const backToTopBtn = document.getElementById('backToTopBtn');
    if(backToTopBtn) backToTopBtn.onclick = scrollToTop;
    
    const authModalClose = document.querySelector('.auth-modal-close');
    if(authModalClose) authModalClose.onclick = () => document.getElementById('auth-modal').style.display = 'none';

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

    profileAndSettingsUI();
});

function profileAndSettingsUI() {
    function getUserSafe() {
        try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
    }

    function applyHeaderUser(updated) {
        const ua = document.getElementById('userAvatar');
        const da = document.getElementById('dropdownAvatar');
        const du = document.getElementById('dropdownUsername');
        
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
        
        const de = document.getElementById('dropdownEmail');
        if (de) de.innerText = updated.email || '';
    }
    window.applyHeaderUser = applyHeaderUser;

    function setupSettingsModal() {
        let modal = document.getElementById('profile-modal');
        if (!modal) return; 
        
        modal.querySelector('#closeProfileModal').onclick = () => modal.style.display = 'none';
    }

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

    function showProfileCenter(show = true) {
        const pop = createProfileCenterPopup();
        const user = getUserSafe();
        const name = user.displayName || user.username || 'Khách';
        const email = user.email || '(Chưa có email)';
        
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
                openSettingsModal(); 
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