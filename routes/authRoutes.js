const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// debug log on load
console.log('[authRoutes] loaded');

// uploads dir: try public/uploads, fallback to os.tmpdir()
let uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('[authRoutes] ensured uploadsDir:', uploadsDir);
} catch (err) {
  console.warn('[authRoutes] cannot create public/uploads, fallback to tmp', err && err.message);
  uploadsDir = os.tmpdir();
  console.log('[authRoutes] using tmp uploadsDir:', uploadsDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

// simple health check for routes
router.get('/_status', (req, res) => res.json({ ok: true, msg: 'authRoutes ok' }));

// Register
router.post('/auth/register', async (req, res) => {
  console.log('[authRoutes] POST /auth/register', req.body && { username: req.body.username });
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ ok: false, message: 'username and password required' });
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ ok: false, message: 'username exists' });
    const hash = await bcrypt.hash(password, 10);
    const u = new User({ username, password: hash, displayName: username });
    await u.save();
    const user = u.toObject();
    delete user.password;
    res.json({ ok: true, user });
  } catch (err) {
    console.error('[authRoutes] register error', err);
    res.status(500).json({ ok: false, message: 'error' });
  }
});

// Login
router.post('/auth/login', async (req, res) => {
  console.log('[authRoutes] POST /auth/login', req.body && { username: req.body.username });
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ ok: false, message: 'username and password required' });
    const u = await User.findOne({ username });
    if (!u) return res.status(400).json({ ok: false, message: 'invalid credentials' });
    const ok = await bcrypt.compare(password, u.password || '');
    if (!ok) return res.status(400).json({ ok: false, message: 'invalid credentials' });
    const user = u.toObject();
    delete user.password;
    return res.json({ ok: true, token: '', user });
  } catch (err) {
    console.error('[authRoutes] login error', err);
    return res.status(500).json({ ok: false, message: 'error' });
  }
});

// Update user (PUT /api/user)
router.put('/user', async (req, res) => {
  console.log('[authRoutes] PUT /user', req.body && { username: req.body.username || req.body._id, fields: Object.keys(req.body || {}) });
  try {
    const body = req.body || {};
    const identifier = body.username || body._id;
    if (!identifier) return res.status(400).json({ ok: false, message: 'username or _id required' });

    const query = body._id ? { _id: body._id } : { username: identifier };
    const allowed = {};
    if (typeof body.displayName === 'string') allowed.displayName = body.displayName;
    if (typeof body.email === 'string') allowed.email = body.email;
    if (typeof body.avatar === 'string') allowed.avatar = body.avatar;

    if (Object.keys(allowed).length === 0) return res.status(400).json({ ok: false, message: 'no updatable fields' });

    const updated = await User.findOneAndUpdate(query, { $set: allowed }, { new: true }).select('-password');
    if (!updated) return res.status(404).json({ ok: false, message: 'User not found' });

    return res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('[authRoutes] update user error', err);
    return res.status(500).json({ ok: false, message: 'Internal error' });
  }
});

// Upload avatar (POST /api/user/upload-avatar)
router.post('/user/upload-avatar', upload.single('avatar'), async (req, res) => {
  console.log('[authRoutes] POST /user/upload-avatar file=', req.file && req.file.filename, 'body=', req.body);
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No file uploaded' });
    const savedName = req.file.filename || path.basename(req.file.path || '');
    const host = req.get('host');
    const proto = req.protocol;
    let url = '';
    if (uploadsDir.includes(path.join(__dirname, '..', 'public'))) {
      url = `${proto}://${host}/uploads/${savedName}`;
    } else {
      // attempt best-effort URL; may not be served on serverless
      url = `${proto}://${host}/uploads/${savedName}`;
    }

    // Optionally update user record if username provided
    const username = req.body.username;
    if (username) {
      const updated = await User.findOneAndUpdate(
        { $or: [{ username }, { _id: username }] },
        { $set: { avatar: url } },
        { new: true }
      ).select('-password');
      if (updated) return res.json({ ok: true, url, user: updated });
    }

    return res.json({ ok: true, url });
  } catch (err) {
    console.error('[authRoutes] upload avatar error', err);
    return res.status(500).json({ ok: false, message: 'Upload failed' });
  }
});

module.exports = router;