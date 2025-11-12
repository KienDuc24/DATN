// js/main.js

// Import các hàm khởi tạo và tiện ích
import { getUserSafe } from './utils.js';
import { initUI, showLoading } from './ui.js';
import { initAuth, showUserInfo } from './auth.js';
import { initProfile } from './profile.js';
import {
  groupGames,
  renderSlider,
  renderGamesByCategory,
  rerenderAllSliders,
  searchGames,
  sortGames
} from './game.js';
import { getMaxShow } from './utils.js';
// (socket được import nếu cần, ví dụ: import { socket } from './socket.js';)

// --- State Toàn cục (Export để các module khác import) ---
export let allGames = [];
export let recentGames = [];
export let topGames = [];
export let featuredGames = [];
export let newGames = [];
export let gamesByCategory = {};

export const BASE_API_URL = 'https://datn-socket.up.railway.app';

export let sliderPage = {
  recent: 0,
  top: 0,
  featured: 0,
  new: 0
};
export let MAX_SHOW = getMaxShow();

export let LANGS = {};
export let currentLang = localStorage.getItem('lang') || 'vi';

// --- Logic Đa ngôn ngữ ---
/**
 * Cập nhật UI dựa trên ngôn ngữ đã chọn.
 */
export function updateLangUI() {
  if (!LANGS[currentLang]) return;
  const langData = LANGS[currentLang];

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (langData[key]) {
      // Giữ lại icon nếu có
      const icon = el.querySelector('.icon, .eye-icon');
      el.innerHTML = (icon ? icon.outerHTML : '') + ' ' + langData[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (langData[key]) el.placeholder = langData[key];
  });
  
  // Cập nhật các select sắp xếp
  document.querySelectorAll('.sort-select').forEach(select => {
    select.querySelectorAll('option').forEach(opt => {
      const key = opt.getAttribute('data-i18n');
      if (key && langData[key]) {
        opt.textContent = langData[key];
      }
    });
  });
  
  // Cập nhật các label sắp xếp
  document.querySelectorAll('.sort-label').forEach(el => {
    el.textContent = langData.sort_by || 'Sắp xếp theo';
  });
}

/**
 * Đặt ngôn ngữ mới và render lại UI.
 */
export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  
  // Cập nhật text tĩnh
  updateLangUI();
  
  // Render lại các game (vì tên game/thể loại đã thay đổi)
  rerenderAllSliders();
}

// --- Gán hàm vào Window (cho các sự kiện inline) ---
// Các hàm này phải được truy cập toàn cục vì chúng được gọi từ HTML (onchange)
window.setLang = setLang;
window.sortGamesHandler = (key, selectEl) => {
  sortGames(key, selectEl);
};
// Gán các hàm UI vào window nếu cần (ví dụ: onclick="toggleSidebar()")
// window.toggleSidebar = toggleSidebar; 
// window.toggleCategory = toggleCategory;
// window.showMobileSearch = showMobileSearch;
// window.openAuthModal = openAuthModal;

// --- Khởi tạo Ứng dụng ---
document.addEventListener('DOMContentLoaded', function() {
  
  // 1. Khởi tạo các mô-đun UI
  initUI();
  initAuth();
  initProfile();

  // 2. Gán sự kiện cho các thành phần UI còn lại
  document.getElementById('searchInput')?.addEventListener('input', searchGames);
  document.getElementById('langSelect')?.addEventListener('change', (e) => setLang(e.target.value));

  // 3. Kiểm tra user đã đăng nhập
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      showUserInfo(JSON.parse(userStr));
    } catch {}
  }

  // 4. Xử lý đăng nhập Google (redirect)
  const params = new URLSearchParams(window.location.search);
  if (params.has('user')) {
    try {
      const user = JSON.parse(decodeURIComponent(params.get('user')));
      saveUserToLocal(user);
      window.history.replaceState({}, document.title, window.location.pathname); // Xóa param
      showUserInfo(user);
      alert('Đăng nhập Google thành công! Xin chào ' + (user.name || user.email));
    } catch {}
  }

  // 5. Tải dữ liệu
  showLoading(true);
  
  // Tải ngôn ngữ
  fetch('lang.json')
    .then(res => res.json())
    .then(data => {
      Object.assign(LANGS, data); // Gán vào state
      document.getElementById('langSelect').value = currentLang;
      setLang(currentLang); // Áp dụng ngôn ngữ
    })
    .catch(err => console.error('Failed to fetch lang.json', err));

  // Tải game
  fetch('games.json')
    .then(res => res.json())
    .then(data => {
      Object.assign(allGames, data); // Gán vào state
      
      groupGames();
      
      // Render lần đầu
      renderSlider(recentGames, 'recentSlider', 'recent');
      renderSlider(topGames, 'topSlider', 'top');
      renderSlider(featuredGames, 'featuredSlider', 'featured');
      renderSlider(newGames, 'newSlider', 'new');
      renderGamesByCategory();
      
      updateLangUI(); // Đảm bảo text ngôn ngữ đúng sau khi render
    })
    .catch(err => console.error('Failed to fetch games.json', err))
    .finally(() => showLoading(false));

  // 6. Gán sự kiện resize
  window.addEventListener('resize', function() {
    const newMax = getMaxShow();
    if (newMax !== MAX_SHOW) {
      MAX_SHOW = newMax;
      // Reset trang về 0 khi resize
      Object.keys(sliderPage).forEach(key => sliderPage[key] = 0);
      rerenderAllSliders();
      updateLangUI();
    }
  });
});