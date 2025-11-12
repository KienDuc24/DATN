// routes/adminAuthRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Xử lý POST /admin/login (từ admin-login.html)
router.post('/login', (req, res) => {
  try { // Thêm try...catch để an toàn
    const { username, password } = req.body;

    // Sửa: Dùng ADMIN_USER và ADMIN_PASS (khớp với Railway)
    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASS;
    
    // SỬA LỖI: Dùng ADMIN_SECRET (khớp với Railway)
    const jwtSecret = process.env.ADMIN_SECRET; 
    // const jwtSecret = process.env.JWT_SECRET; // (Code cũ bị lỗi)

    if (!adminUser || !adminPass) {
        return res.status(500).json({ message: 'Lỗi server: ADMIN_USER hoặc ADMIN_PASS chưa được gán.' });
    }
    
    if (!jwtSecret) {
        return res.status(500).json({ message: 'Lỗi server: ADMIN_SECRET (JWT) chưa được gán.' });
    }

    // Kiểm tra tài khoản
    if (username === adminUser && password === adminPass) {
      // Tạo token
      const token = jwt.sign(
        { user: 'admin', role: 'admin' },
        jwtSecret, // Dùng biến đã sửa
        { expiresIn: '1d' }
      );

      // Gửi token về client qua cookie
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 1 ngày
      });

      res.json({ ok: true, message: 'Login successful' });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('[admin/login] Error:', err.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Xử lý POST /admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true, message: 'Logged out' });
});

module.exports = router;