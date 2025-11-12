// js/auth.js
import { validateRegister, saveUserToLocal, getUserSafe } from './utils.js';
import { BASE_API_URL } from './main.js'; // Import hằng số từ main

/**
 * Hiển thị thông tin người dùng lên UI (header, dropdown).
 */
export function showUserInfo(user) {
  if (!user) return;

  // Ẩn nút Đăng nhập/Đăng ký
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
 * Ẩn thông tin người dùng, hiện lại nút Đăng nhập/Đăng ký (khi đăng xuất).
 */
export function showGuestUI() {
  document.getElementById('headerAuthBtns')?.style.setProperty('display', 'flex'); // Hoặc 'block', 'flex' tùy layout
  document.getElementById('sidebarAuthBtns')?.style.setProperty('display', 'block'); // Hoặc 'block', 'flex' tùy layout
  document.getElementById('userInfo')?.style.setProperty('display', 'none', 'important');
  document.getElementById('userDropdown')?.style.setProperty('display', 'none');
}

/**
 * Mở Modal Xác thực và hiển thị tab (login hoặc register).
 */
export function openAuthModal(tab = 'login') {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'flex';
    showAuthTab(tab);
  }
}

/**
 * Đóng Modal Xác thực.
 */
export function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Chuyển tab trong Modal Xác thực.
 */
export function showAuthTab(tab) {
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
 * Khởi tạo tất cả các event listener cho form Đăng nhập/Đăng ký.
 */
export function initAuth() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const anonymousLoginBtn = document.getElementById('anonymousLoginBtn');
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const facebookLoginBtn = document.getElementById('facebookLoginBtn');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  
  // Nút mở modal (ví dụ)
  // document.getElementById('open-login-btn').onclick = () => openAuthModal('login');
  // document.getElementById('open-register-btn').onclick = () => openAuthModal('register');
  
  // Chuyển tab
  loginTab?.addEventListener('click', () => showAuthTab('login'));
  registerTab?.addEventListener('click', () => showAuthTab('register'));
  
  // Đăng nhập
  if (loginForm) {
    loginForm.onsubmit = async function(e) {
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
          saveUserToLocal(data.user);
          closeAuthModal();
          showUserInfo(data.user);
          alert('Đăng nhập thành công!');
        } else {
          if (messageEl) messageEl.innerText = 'Lỗi: Không nhận được token hoặc user';
        }
      } catch (err) {
        console.error('[client] login error', err);
        if (messageEl) messageEl.innerText = 'Lỗi kết nối máy chủ: ' + err.message;
      }
    };
  }
  
  // Đăng ký
  if (registerForm) {
    registerForm.onsubmit = async function(e) {
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
  }
  
  // Đăng nhập ẩn danh
  if (anonymousLoginBtn) {
    anonymousLoginBtn.onclick = function() {
      const username = 'guest_' + Math.random().toString(36).substring(2, 10);
      const user = { username, displayName: username, name: username };
      saveUserToLocal(user);
      closeAuthModal();
      showUserInfo(user);
      alert('Bạn đã đăng nhập ẩn danh với tên: ' + username);
    };
  }

  // Đăng nhập Google
  if (googleLoginBtn) {
    googleLoginBtn.onclick = function() {
      window.location.href = `${BASE_API_URL}/auth/google`;
    };
  }

  // Đăng nhập Facebook
  if (facebookLoginBtn) {
    facebookLoginBtn.onclick = function() {
      alert('Tính năng đăng nhập Facebook sẽ được bổ sung sau!');
    };
  }

  // Quên mật khẩu
  document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => {
    alert('Tính năng quên mật khẩu sẽ được bổ sung sau!');
  });
  
  // Ẩn/Hiện mật khẩu (Đăng nhập)
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
  
  // Ẩn/Hiện mật khẩu (Đăng ký)
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