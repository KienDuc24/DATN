// routes/adminAuthRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Xử lý POST /admin/login (từ admin-login.html)
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Kiểm tra tài khoản admin từ .env
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    // Tạo token
    const token = jwt.sign(
      { user: 'admin', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' } // Hết hạn sau 1 ngày
    );

    // Gửi token về client qua cookie
    res.cookie('admin_token', token, {
      httpOnly: true, // Chỉ server mới được đọc
      secure: process.env.NODE_ENV === 'production', // Chỉ gửi qua HTTPS
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 ngày
    });

    res.json({ ok: true, message: 'Login successful' });
  } else {
    res.status(401).json({ message: 'Invalid username or password' });
  }
});

// Xử lý POST /admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true, message: 'Logged out' });
});

module.exports = router;