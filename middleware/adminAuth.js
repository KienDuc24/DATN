// middleware/adminAuth.js
const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  const token = req.cookies.admin_token; // Lấy token từ cookie

  if (!token) {
    // Nếu truy cập API mà không có token
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    // Xác thực token
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET);
    req.user = decoded; // Lưu thông tin user (là "admin") vào request
    next(); // Cho phép đi tiếp
  } catch (ex) {
    // Token không hợp lệ
    res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = adminAuth;