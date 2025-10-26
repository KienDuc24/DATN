const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// POST /api/admin/login
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ ok: false, message: 'username/password required' });

    const user = await User.findOne({ username: username.trim() });
    if (!user) return res.status(401).json({ ok: false, message: 'invalid credentials' });

    const match = await bcrypt.compare(password, user.password || '');
    if (!match) return res.status(401).json({ ok: false, message: 'invalid credentials' });

    if (user.role !== 'admin') return res.status(403).json({ ok: false, message: 'not admin' });

    // set httpOnly cookie with user id for admin session
    res.cookie('adminUser', String(user._id), { httpOnly: true, sameSite: 'lax' });
    return res.json({ ok: true, user: { _id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    console.error('[adminAuth] login error', err && err.message);
    return res.status(500).json({ ok: false, message: 'error' });
  }
});

// POST /api/admin/logout
router.post('/admin/logout', (req, res) => {
  res.clearCookie('adminUser');
  return res.json({ ok: true });
});

// POST /api/admin/create-first-admin
// Dùng để tạo tài khoản admin đầu tiên. Yêu cầu body.secret === process.env.ADMIN_SECRET
router.post('/admin/create-first-admin', async (req, res) => {
  try {
    const secret = req.body && req.body.secret;
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ ok: false, message: 'forbidden' });
    }

    // nếu đã có admin thì không tạo nữa
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) return res.status(400).json({ ok: false, message: 'admin exists' });

    const { username, password, email, displayName } = req.body || {};
    if (!username || !password) return res.status(400).json({ ok: false, message: 'username/password required' });

    const exist = await User.findOne({ username: username.trim() });
    if (exist) return res.status(400).json({ ok: false, message: 'username exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = new User({
      username: username.trim(),
      password: hash,
      email: email || '',
      displayName: displayName || username.trim(),
      role: 'admin'
    });
    await user.save();
    return res.json({ ok: true, user: { _id: user._id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('[adminAuth] create-first-admin error', err && err.message);
    return res.status(500).json({ ok: false, message: 'error' });
  }
});

module.exports = router;