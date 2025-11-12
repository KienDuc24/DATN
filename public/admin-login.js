// public/admin-login.js

document.addEventListener('DOMContentLoaded', function() {
  const BASE_API_URL = 'https://datn-socket.up.railway.app';
  const loginBtn = document.getElementById('login');
  const passInput = document.getElementById('p');
  const userIpnut = document.getElementById('u');
  const toggleBtn = document.getElementById('togglePass');
  const icon = toggleBtn.querySelector('i');
  
  // Gán sự kiện
  loginBtn.addEventListener('click', handleLogin);
  passInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleLogin();
  });
  userIpnut.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleLogin();
  });
  toggleBtn.addEventListener('click', function() {
      if (passInput.type === 'password') {
          passInput.type = 'text';
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
      } else {
          passInput.type = 'password';
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
      }
  });

  // Hàm xử lý đăng nhập
  async function handleLogin() {
    const u = userIpnut.value.trim();
    const p = passInput.value;
    const msg = document.getElementById('msg');
    msg.textContent = '';
    
    if (!u || !p) {
        msg.textContent = 'Vui lòng nhập cả username và password.';
        return;
    }

    try {
      const res = await fetch(`${BASE_API_URL}/admin/login`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
        credentials: 'include' // Gửi cookie
      });
      
      const j = await res.json();
      if (res.ok && j.ok) {
        location.href = '/admin.html'; // Chuyển hướng
      } else {
        msg.textContent = j.message || 'Login failed';
      }
    } catch (e) {
      msg.textContent = 'Network error';
    }
  };
});