const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const fs = require('fs');
const util = require('util');

const User = require('../models/User');
const bcrypt = require('bcryptjs');

console.log('[authRoutes] loaded');

// uploads dir (local storage)
let uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('[authRoutes] ensured uploadsDir:', uploadsDir);
} catch (err) {
  console.warn('[authRoutes] cannot create public/uploads, fallback to tmp', err && err.message);
  uploadsDir = os.tmpdir();
  console.log('[authRoutes] using tmp uploadsDir:', uploadsDir);
}

// try multer; if require fails, fallback to formidable
let multerInstance = null;
let useFormidable = false;
try {
  multerInstance = require('multer');
  console.log('[authRoutes] multer loaded');
} catch (err) {
  console.warn('[authRoutes] multer require failed, falling back to formidable:', err && err.message);
  useFormidable = true;
}

let uploadHandler = null;
if (!useFormidable && multerInstance) {
  const storage = multerInstance.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
    }
  });
  uploadHandler = multerInstance({ storage });
}

// simple health
router.get('/_status', (req, res) => res.json({ ok: true, uploadsDir }));

// GET user by username or id
router.get('/user', async (req, res) => {
  try {
    const username = req.query.username || req.query.id || req.query._id;
    if (!username) return res.status(400).json({ ok: false, message: 'username or id required' });
    const q = req.query._id || req.query.id ? { _id: username } : { username };
    const user = await User.findOne(q).select('-password -passwordHash');
    if (!user) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, user });
  } catch (err) {
    console.error('[authRoutes] get user error', err && err.message);
    return res.status(500).json({ ok: false, message: 'error' });
  }
});

// Register
router.post('/auth/register', async (req, res) => {
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
    console.error('[authRoutes] register error', err && err.message);
    res.status(500).json({ ok: false, message: 'error' });
  }
});

// Login (simple)
router.post('/auth/login', async (req, res) => {
  function dbg(req) {
    console.log('[authRoutes] %s %s body=%j query=%j cookies=%j', req.method, req.originalUrl, req.body, req.query, req.cookies);
  }
  dbg(req);
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
    console.error('[authRoutes] login error', err && (err.stack || err));
    return res.status(500).json({ ok: false, message: 'server error', error: err.message });
  }
});

// Update user
router.put('/user', async (req, res) => {
  console.log('[authRoutes] PUT /user body=', req.body);
  try {
    const body = req.body || {};
    const identifier = body.username || body._id;
    if (!identifier) {
      console.warn('[authRoutes] missing identifier in body');
      return res.status(400).json({ ok: false, message: 'username or _id required in request body' });
    }

    const query = body._id ? { _id: body._id } : { username: identifier };
    const updates = {};

    if (typeof body.avatar === 'string') updates.avatar = body.avatar;

    if (typeof body.newUsername === 'string' && body.newUsername.trim() !== '') {
      const newUsername = body.newUsername.trim();
      if (newUsername !== identifier) {
        const exists = await User.findOne({ username: newUsername });
        if (exists) {
          console.warn('[authRoutes] new username already exists', newUsername);
          return res.status(400).json({ ok: false, message: 'username already exists' });
        }
        updates.username = newUsername;
      }
    }

    if (Object.keys(updates).length === 0) {
      console.warn('[authRoutes] no updatable fields provided');
      return res.status(400).json({ ok: false, message: 'no updatable fields provided' });
    }

    console.log('[authRoutes] updating user', { query, updates });
    const updated = await User.findOneAndUpdate(query, { $set: updates }, { new: true, runValidators: true }).select('-password');
    if (!updated) {
      console.warn('[authRoutes] user not found for', query);
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    console.log('[authRoutes] update success', updated._id.toString());
    return res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('[authRoutes] update user error', err && (err.stack || err.message));
    if (err && err.name && err.name.includes('Mongo')) {
      return res.status(500).json({ ok: false, message: 'MongoDB error', detail: err.message });
    }
    return res.status(500).json({ ok: false, message: 'Internal error' });
  }
});

// helpers: local storage helpers
const stat = util.promisify(fs.stat);
async function safeUnlink(p) {
  try {
    if (!p || typeof p !== 'string') return;
    await stat(p);
    fs.unlink(p, (err) => { if (err) console.warn('[authRoutes] unlink warn', err && err.message); });
  } catch (e) { /* ignore */ }
}

function localUrlForFilename(filename, req) {
  // return absolute URL to uploaded file
  const host = req && req.get ? req.get('host') : '';
  const proto = (req && req.protocol) || 'https';
  return `${proto}://${host}/uploads/${encodeURIComponent(filename)}`;
}

// unified upload handler (no cloudinary)
async function unifiedUploadHandlerLogic(req, res) {
  try {
    if (req.file) {
      const localPath = req.file.path || null;
      const savedName = localPath ? path.basename(localPath) : null;
      const finalUrl = savedName ? localUrlForFilename(savedName, req) : null;

      const username = (req.body && req.body.username) || null;
      if