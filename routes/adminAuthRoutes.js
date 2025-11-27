const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASS;
    const jwtSecret = process.env.ADMIN_SECRET;

    if (!adminUser || !adminPass || !jwtSecret) {
      return res.status(500).json({ message: 'Lỗi server: Biến môi trường admin chưa được gán.' });
    }

    if (username === adminUser && password === adminPass) {
      const token = jwt.sign(
        { user: 'admin', role: 'admin' },
        jwtSecret,
        { expiresIn: '1d' }
      );

      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
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

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ ok: true, message: 'Logged out' });
});

module.exports = router;