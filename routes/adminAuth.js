const express = require('express');
const router = express.Router();

// POST /admin/login  { username, password }
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;
  const SECRET = process.env.ADMIN_SECRET;

  if (!ADMIN_USER || !ADMIN_PASS || !SECRET) return res.status(500).json({ ok: false, message: 'Admin not configured' });

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.cookie('admin_auth', SECRET, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 3600 * 1000
    });
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, message: 'Invalid credentials' });
});

router.post('/admin/logout', (req, res) => {
  res.clearCookie('admin_auth');
  res.json({ ok: true });
});

module.exports = router;