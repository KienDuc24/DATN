// js/profile.js
import { getUserSafe, saveUserToLocal } from './utils.js';
import { showGuestUI } from './auth.js';
import { BASE_API_URL } from './main.js';

const FALLBACK_AVATAR = 'img/avt.png';

/**
 * Áp dụng thông tin user lên header và dropdown.
 */
function applyHeaderUser(user) {
  const avatar = user.avatar || user.picture || FALLBACK_AVATAR;
  const name = user.displayName || user.username || user.name || 'User';

  const userAvatar = document.getElementById('userAvatar');
  const dropdownAvatar = document.getElementById('dropdownAvatar');
  const dropdownUsername = document.getElementById('dropdownUsername');

  if (userAvatar) userAvatar.src = avatar;
  if (dropdownAvatar) dropdownAvatar.src = avatar;
  if (dropdownUsername) dropdownUsername.innerText = name;
}

/**
 * Tạo và quản lý Modal Cài đặt (đổi tên, avatar).
 */
function initSettingsModal() {
  let modal = document.getElementById('profile-modal');
  if (!modal) {
    // Tạo modal nếu chưa có
    modal = document.createElement('div');
    modal.id = 'profile-modal';
    Object.assign(modal.style, {
      position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1400,
      display: 'none', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)'
    });
    
    modal.innerHTML = `
      <div id="profile-modal-box" style="width:90%;max-width:480px;background:#fff;border-radius:12px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-weight:700;font-size:1.05rem">Cài đặt tài khoản</div>
          <button id="profile-modal-close" style="background:none;border:none;font-size:1.2rem;cursor:pointer">×</button>
        </div>
        
        <div style="text-align:center;margin-bottom:12px">
          <img id="profile-modal-avatar" src="${FALLBACK_AVATAR}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:1px solid #eee;cursor:pointer">
          <input type="file" id="profile-modal-file" accept="image/*" style="display:none">
          <div style="font-size:0.9rem;color:#007bff;cursor:pointer" onclick="document.getElementById('profile-modal-file').click()">Đổi avatar</div>
        </div>

        <label style="display:block;font-size:0.9rem;margin-bottom:6px">Tên tài khoản (username)</label>
        <input id="profile-modal-name" style="width:100%;padding:8px;border-radius:8px;border:1px solid #ddd;margin-bottom:10px" />

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
          <button id="profile-modal-cancel" style="padding:8px 12px;border-radius:8px;background:#eee;border:none;cursor:pointer">Hủy</button>
          <button id="profile-modal-save" style="padding:8px 12px;border-radius:8px;background:#00b59a;color:#fff;border:none;cursor:pointer">Lưu</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  // Lấy các element
  const closeBtn = document.getElementById('profile-modal-close');
  const cancelBtn = document.getElementById('profile-modal-cancel');
  const saveBtn = document.getElementById('profile-modal-save');
  const nameInput = document.getElementById('profile-modal-name');
  const avatarImg = document.getElementById('profile-modal-avatar');
  const fileInput = document.getElementById('profile-modal-file');
  let previewUrl = null;

  // Đóng modal
  const closeModal = () => {
    modal.style.display = 'none';
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    fileInput.value = ''; // Reset file input
  };

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  
  // Xem trước avatar
  avatarImg.onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    avatarImg.src = previewUrl;
  };

  // Mở modal (gán cho nút 'settingsBtn')
  document.getElementById('settingsBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const user = getUserSafe() || {};
    
    nameInput.value = user.displayName || user.username || user.name || '';
    avatarImg.src = user.avatar || user.picture || FALLBACK_AVATAR;
    
    modal.style.display = 'flex';
  });

  // Lưu thay đổi
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.innerText = 'Đang lưu...';

    const token = localStorage.getItem('token') || '';
    let user = getUserSafe() || {};
    const newUsername = nameInput.value.trim();
    const file = fileInput.files?.[0];
    
    let updatedUser = { ...user };

    try {
      // 1. Upload avatar nếu có
      if (file) {
        const formData = new FormData();
        formData.append('avatar', file);
        if (user.username) formData.append('username', user.username);
        else if (user._id) formData.append('username', user._id); // Server có thể cần
        
        const resUpload = await fetch(`${BASE_API_URL}/api/user/upload-avatar`, {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData,
        });

        if (!resUpload.ok) throw new Error('Upload avatar thất bại');
        
        const uploadResult = await resUpload.json();
        updatedUser.avatar = uploadResult.url || (uploadResult.user && uploadResult.user.avatar);
      }

      // 2. Cập nhật username (và avatar URL nếu có)
      const payload = {
        username: user.username || user._id, // Mã định danh hiện tại
        newUsername: newUsername,
        avatar: updatedUser.avatar || user.avatar // Gửi URL avatar mới (nếu có)
      };

      const resUpdate = await fetch(`${BASE_API_URL}/api/user`, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': `Bearer ${token}` } : {}),
        body: JSON.stringify(payload),
      });

      if (!resUpdate.ok) {
        const err = await resUpdate.json();
        throw new Error(err.message || 'Cập nhật hồ sơ thất bại');
      }

      const updateResult = await resUpdate.json();
      const serverUser = updateResult.user || updateResult;
      
      // Lưu user mới vào local và cập nhật UI
      saveUserToLocal(serverUser);
      applyHeaderUser(serverUser);
      
      alert('Cập nhật hồ sơ thành công!');
      closeModal();

    } catch (err) {
      console.error('Profile save error:', err);
      alert('Lỗi: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerText = 'Lưu';
    }
  };
}

/**
 * Tạo và quản lý Popup xem thông tin (chỉ xem).
 */
function initProfilePopup() {
  let pop = document.getElementById('profile-center-popup');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'profile-center-popup';
    Object.assign(pop.style, {
      position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1500,
      display: 'none', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)'
    });
    pop.innerHTML = `
      <div id="profile-center-box" style="min-width:260px;max-width:420px;background:#fff;border-radius:12px;padding:24px;box-shadow:0 12px 40px rgba(0,0,0,0.32);text-align:center;position:relative;">
        <button id="profile-center-close" style="position:absolute;right:10px;top:10px;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#888;">&times;</button>
        <img id="profile-center-avatar" src="${FALLBACK_AVATAR}" style="width:86px;height:86px;border-radius:50%;object-fit:cover;border:2px solid #eee;margin-bottom:10px">
        <div id="profile-center-name" style="font-weight:700;font-size:1.1rem;margin-bottom:4px"></div>
        <div id="profile-center-email" style="color:#666;font-size:0.95rem;margin-bottom:12px"></div>
      </div>
    `;
    document.body.appendChild(pop);
    
    // Đóng khi click ra ngoài
    pop.onclick = (e) => {
      if (e.target.id === 'profile-center-popup') pop.style.display = 'none';
    };
    // Đóng bằng nút X
    pop.querySelector('#profile-center-close').onclick = () => pop.style.display = 'none';
  }

  // Gán sự kiện mở popup cho nút 'profileBtn'
  document.getElementById('profileBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    
    const user = getUserSafe() || {};
    const avatar = user.avatar || user.picture || FALLBACK_AVATAR;
    const name = user.displayName || user.username || user.name || 'Khách';
    const email = user.email || '(Chưa có email)';

    document.getElementById('profile-center-avatar').src = avatar;
    document.getElementById('profile-center-name').innerText = name;
    document.getElementById('profile-center-email').innerText = email;
    
    pop.style.display = 'flex';
  });
}

/**
 * Khởi tạo logic cho dropdown và đăng xuất.
 */
export function initProfile() {
  const userInfo = document.getElementById('userInfo');
  const userDropdown = document.getElementById('userDropdown');
  const logoutBtn = document.getElementById('logoutBtn');
  let dropdownVisible = false;

  // Quản lý click dropdown
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

  // Nút Đăng xuất
  if (logoutBtn) {
    logoutBtn.onclick = function() {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      showGuestUI();
      // Tùy chọn: reload lại trang để reset toàn bộ state
      // location.reload(); 
    };
  }

  // Khởi tạo các modal
  initSettingsModal();
  initProfilePopup();
  
  // Gán sự kiện cho các nút khác trong dropdown (nếu có)
  document.getElementById('historyBtn')?.addEventListener('click', () => {
    alert('Tính năng lịch sử chơi sẽ được bổ sung sau!');
  });
}