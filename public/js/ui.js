// js/ui.js
import { scrollToTop } from './utils.js';

/**
 * Hiển thị hoặc ẩn spinner loading.
 */
export function showLoading(show = true) {
  const loadingSpinner = document.getElementById('loadingSpinner');
  if (loadingSpinner) {
    loadingSpinner.style.display = show ? 'flex' : 'none';
  }
}

/**
 * Bật/tắt sidebar.
 */
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
  }
}

/**
 * Bật/tắt một mục thể loại trong sidebar.
 */
export function toggleCategory(catId) {
  const content = document.getElementById(`${catId}-content`);
  const arrow = document.getElementById(`${catId}-arrow`);
  if (!content || !arrow) return;
  
  if (content.style.display === 'none' || content.style.display === '') {
    content.style.display = 'block';
    arrow.innerHTML = '&#9660;'; // Mũi tên xuống
  } else {
    content.style.display = 'none';
    arrow.innerHTML = '&#9654;'; // Mũi tên sang phải
  }
}

/**
 * Hiển thị thanh tìm kiếm trên mobile.
 */
export function showMobileSearch() {
  const header = document.querySelector('.header-main');
  if (header) {
    header.classList.add('mobile-searching');
    setTimeout(() => {
      document.getElementById('searchInput')?.focus();
    }, 100);
  }
}

/**
 * Khởi tạo các event listener cho UI chung.
 */
export function initUI() {
  const searchInput = document.getElementById('searchInput');
  const backToTopBtn = document.getElementById('backToTopBtn');

  // Ẩn thanh tìm kiếm mobile khi blur
  if (searchInput) {
    searchInput.addEventListener('blur', function() {
      setTimeout(() => {
        if (window.innerWidth <= 700 && !this.value) {
          document.querySelector('.header-main')?.classList.remove('mobile-searching');
        }
      }, 150);
    });

    // Ẩn thanh tìm kiếm mobile khi nhấn Enter (nếu trống)
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && window.innerWidth <= 700 && !this.value) {
        document.querySelector('.header-main')?.classList.remove('mobile-searching');
      }
    });
  }
  
  // Hiển thị nút "back to top" khi cuộn
  window.addEventListener('scroll', function() {
    if (backToTopBtn) {
      window.scrollY > 200 ? backToTopBtn.classList.add('show') : backToTopBtn.classList.remove('show');
    }
  });

  // Gán sự kiện click cho nút "back to top"
  if (backToTopBtn) {
    backToTopBtn.onclick = scrollToTop;
  }
  
  // Gán sự kiện cho các nút UI chung (bạn có thể thêm vào đây)
  // Ví dụ: document.getElementById('menu-toggle-btn').onclick = toggleSidebar;
  // Ví dụ: document.getElementById('mobile-search-btn').onclick = showMobileSearch;
}