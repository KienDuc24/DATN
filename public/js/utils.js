// js/utils.js

/**
 * Lưu đối tượng user vào localStorage.
 * Hàm này CHỈ lưu, không cập nhật UI.
 */
export function saveUserToLocal(user) {
  try {
    if (!user || typeof user !== 'object') return;
    localStorage.setItem('user', JSON.stringify(user));
    if (user.token) localStorage.setItem('token', user.token);
  } catch (err) {
    console.error('saveUserToLocal error', err);
  }
}

/**
 * Lấy user từ localStorage một cách an toàn.
 */
export function getUserSafe() {
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Validate dữ liệu form đăng ký.
 * Trả về chuỗi lỗi nếu thất bại, chuỗi rỗng nếu thành công.
 */
export function validateRegister(username, password, password2) {
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

// Lấy tên, mô tả, thể loại game đa ngôn ngữ
export function getGameName(game, lang) {
  if (!game) return '';
  if (typeof game.name === 'string') return game.name;
  return game.name?.[lang] || game.name?.vi || game.name?.en || '';
}

export function getGameDesc(game, lang) {
  if (!game) return '';
  if (typeof game.desc === 'string') return game.desc;
  return game.desc?.[lang] || game.desc?.vi || game.desc?.en || '';
}

export function getGameCategory(game, lang) {
  if (!game) return '';
  if (typeof game.category === 'string') return game.category;
  return game.category?.[lang] || game.category?.vi || game.category?.en || '';
}

// Cuộn lên đầu trang
export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Tính toán số lượng card tối đa dựa trên kích thước màn hình
export function getMaxShow() {
  if (window.innerWidth <= 600) return 2;
  if (window.innerWidth <= 900) return 3;
  if (window.innerWidth <= 1200) return 4;
  return 5;
}