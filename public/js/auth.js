// js/auth.js

// --- HÀM TIỆN ÍCH USER (Dùng chung) ---

/**
 * Lưu user/token vào localStorage và cập nhật UI
 */
function saveUserToLocal(user) {
  try {
    if (!user || typeof user !== 'object') return;
    localStorage.setItem('user', JSON.stringify(user));
    if (user.token) localStorage.setItem('token', user.token);
    // Cập nhật giao diện ngay lập tức
    showUserInfo(user);
  } catch (err) {
    console.error('saveUserToLocal error', err);
  }
}

/**
 * Lấy thông tin user từ localStorage một cách an toàn
 */
function getUserSafe() {
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Hiển thị thông tin người dùng (avatar, tên) và ẩn nút auth
 */
function showUserInfo(user) {
  if (!user) return;
  
  // Ẩn nút đăng nhập/đăng ký
  document.getElementById('headerAuthBtns')?.style.setProperty('display', 'none', 'important');
  document.getElementById('sidebarAuthBtns')?.style.setProperty('display', 'none', 'important');

  // Hiện avatar trên header
  const userInfo = document.getElementById('userInfo');
  const userAvatar = document.getElementById('userAvatar');
  if (userInfo && userAvatar) {
    userInfo.style.display = 'flex';
    const avatar = user.avatar || user.picture || 'img/avt.png';
    userAvatar.src = avatar;

    // Cập nhật dropdown
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownUsername = document.getElementById('dropdownUsername');
    if (dropdownAvatar) dropdownAvatar.src = avatar;
    if (dropdownUsername) dropdownUsername.innerText = user.displayName || user.username || user.name || 'User';
  }
}

/**
 * Ẩn thông tin người dùng và hiện lại nút auth (khi đăng xuất)
 */
function showGuestUI() {
  document.getElementById('headerAuthBtns')?.style.setProperty('display', 'flex');
  document.getElementById('sidebarAuthBtns')?.style.setProperty('display', 'block');
  document.getElementById('userInfo')?.style.setProperty('display', 'none', 'important');
  document.getElementById('userDropdown')?.style.setProperty('display', 'none');
}

/**
 * Validate form đăng ký
 */
function validateRegister(username, password, password2) {
  const usernameRegex = /^[a-zA-Z0-9_.]{4,20}$/;
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

// --- LOGIC MODAL AUTH ---

function openAuthModal(tab = 'login') {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'flex';
    showAuthTab(tab);
  }
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function showAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');

  if (!loginForm || !registerForm || !loginTab || !registerTab) return;

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
 * Hàm này sẽ được gọi bởi main.js khi DOM đã sẵn sàng
 */
function initAuth() {
  // Gán sự kiện cho các tab
  document.getElementById('loginTab')?.addEventListener('click', () => showAuthTab('login'));
  document.getElementById('registerTab')?.addEventListener('click', () => showAuthTab('register'));

  // Xử lý Form Đăng nhập
  document.getElementById('loginForm').onsubmit = async function(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const messageEl = document.getElementById('login-message');
    
    try {
      const res = await fetch(`${BASE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        if (messageEl) messageEl.innerText = data.message || 'Đăng nhập thất bại';
        return;
      }
      
      if (data.token && data.user) {
        saveUserToLocal(data.user); // Đã bao gồm showUserInfo()
        closeAuthModal();
        alert('Đăng nhập thành công!');
      } else {
        if (messageEl) messageEl.innerText = 'Lỗi: Không nhận được token/user';
      }
    } catch (err) {
      console.error('[client] login error', err);
      if (messageEl) messageEl.innerText = 'Lỗi kết nối máy chủ: ' + (err && err.message);
    }
  };

  // Xử lý Form Đăng ký
  document.getElementById('registerForm').onsubmit = async function(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const password2 = document.getElementById('register-password2').value;
    const messageEl = document.getElementById('register-message');
    
    const msg = validateRegister(username, password, password2);
    if (msg) {
      if (messageEl) messageEl.innerText = msg;
      return;
    }
    
    try {
      const res = await fetch(`${BASE_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (messageEl) messageEl.innerText = data.message || '';

      if (res.ok && data.user) {
        alert('Đăng ký thành công! Vui lòng đăng nhập.');
        showAuthTab('login');
      }
    } catch (err) {
        console.error('[client] register error', err);
        if (messageEl) messageEl.innerText = 'Lỗi kết nối máy chủ: ' + err.message;
    }
  };

  // Xử lý các nút Auth khác
  document.getElementById('anonymousLoginBtn').onclick = function() {
    const username = 'guest_' + Math.random().toString(36).substring(2, 10);
    const user = { username, displayName: username, name: username };
    saveUserToLocal(user);
    closeAuthModal();
    alert('Bạn đã đăng nhập ẩn danh với tên: ' + username);
  };

  document.getElementById('googleLoginBtn').onclick = function() {
    window.location.href = `${BASE_API_URL}/auth/google`;
  };

  document.getElementById('facebookLoginBtn').onclick = function() {
    alert('Tính năng đăng nhập Facebook sẽ được bổ sung sau!');
  };

  document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => {
    alert('Tính năng quên mật khẩu sẽ được bổ sung sau!');
  });
  
  // Xử lý Ẩn/Hiện Mật khẩu (Đăng nhập)
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
  
  // Xử lý Ẩn/Hiện Mật khẩu (Đăng ký)
  const regToggleBtn = document.getElementById('toggleRegisterPassword');
  const regPw1 = document.getElementById('register-password');
  const regPw2 = document.getElementById('register-password2');
  if (regToggleBtn && regPw1 && regPw2) {
    regToggleBtn.onclick = function(e) {
      e.preventDefault();
      const isHidden = regPw1.type === 'password';
      const type = isHidden ? 'text' : 'password';
      regPw1.type = type;
      regPw2.type = type;
      const icon = isHidden ? '🙈' : '👁';
      const text = isHidden ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
      this.innerHTML = `<span class="eye-icon">${icon}</span> ${text}`;
    };
  }
}