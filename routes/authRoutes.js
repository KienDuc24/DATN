const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const fs = require('fs');
const util = require('util');
const bcrypt = require('bcryptjs');

const User = require('../models/User');

console.log('[authRoutes] loaded');

// uploads dir (local)
let uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('[authRoutes] ensured uploadsDir:', uploadsDir);
} catch (err) {
  console.warn('[authRoutes] cannot create public/uploads, fallback to tmp', err && err.message);
  uploadsDir = os.tmpdir();
}

// try multer; fallback to formidable if unavailable
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

// helpers
const stat = util.promisify(fs.stat);
async function safeUnlink(p) {
  try {
    if (!p || typeof p !== 'string') return;
    await stat(p);
    fs.unlink(p, (err) => { if (err) console.warn('[authRoutes] unlink warn', err && err.message); });
  } catch (e) { /* ignore */ }
}

function localUrlForFilename(filename, req) {
  const host = req && req.get ? req.get('host') : '';
  const proto = (req && req.protocol) || 'https';
  return `${proto}://${host}/uploads/${encodeURIComponent(filename)}`;
}

/* Routes */

// simple health
router.get('/_status', (req, res) => res.json({ ok: true, uploadsDir }));

// GET user by username or id
router.get('/user', async (req, res) => {
  try {
    const identifier = req.query.username || req.query.id || req.query._id;
    if (!identifier) return res.status(400).json({ ok: false, message: 'username or id required' });
    const q = req.query._id || req.query.id ? { _id: identifier } : { username: identifier };
    const user = await User.findOne(q).select('-password');
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

// Login
router.post('/auth/login', async (req, res) => {
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
    return res.status(500).json({ ok: false, message: 'server error' });
  }
});

// Update user
router.put('/user', async (req, res) => {
  try {
    const body = req.body || {};
    const identifier = body.username || body._id;
    if (!identifier) return res.status(400).json({ ok: false, message: 'username or _id required in body' });

    const query = body._id ? { _id: body._id } : { username: identifier };
    const updates = {};

    if (typeof body.avatar === 'string') updates.avatar = body.avatar;

    if (typeof body.newUsername === 'string' && body.newUsername.trim() !== '') {
      const newUsername = body.newUsername.trim();
      if (newUsername !== identifier) {
        const exists = await User.findOne({ username: newUsername });
        if (exists) return res.status(400).json({ ok: false, message: 'username already exists' });
        updates.username = newUsername;
      }
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ ok: false, message: 'no updatable fields provided' });

    const updated = await User.findOneAndUpdate(query, { $set: updates }, { new: true, runValidators: true }).select('-password');
    if (!updated) return res.status(404).json({ ok: false, message: 'User not found' });
    return res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('[authRoutes] update user error', err && (err.stack || err.message));
    return res.status(500).json({ ok: false, message: 'Internal error' });
  }
});

// unified upload handler (no cloudinary)
async function unifiedUploadHandlerLogic(req, res) {
  try {
    // multer path
    if (req.file) {
      const localPath = req.file.path || null;
      const savedName = localPath ? path.basename(localPath) : null;
      const finalUrl = savedName ? localUrlForFilename(savedName, req) : null;
      const username = (req.body && req.body.username) || null;
      if (username) {
        const updated = await User.findOneAndUpdate(
          { $or: [{ username }, { _id: username }] },
          { $set: { avatar: finalUrl } },
          { new: true }
        ).select('-password');
        return res.json({ ok: true, url: finalUrl, user: updated || null });
      }
      return res.json({ ok: true, url: finalUrl });
    }

    // formidable fallback for multipart
    if (useFormidable || (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data'))) {
      const formidable = require('formidable');
      const form = new formidable.IncomingForm({
        uploadDir: uploadsDir,
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024
      });
      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error('[authRoutes] formidable parse error', err && err.message);
          return res.status(500).json({ ok: false, message: 'parse error' });
        }
        const file = files.avatar || files.file || null;
        if (!file) return res.status(400).json({ ok: false, message: 'No file uploaded' });
        const localPath = file.filepath || file.path || null;
        const savedName = localPath ? path.basename(localPath) : null;
        const finalUrl = savedName ? localUrlForFilename(savedName, req) : null;
        const username = fields.username;
        if (username) {
          const updated = await User.findOneAndUpdate(
            { $or: [{ username }, { _id: username }] },
            { $set: { avatar: finalUrl } },
            { new: true }
          ).select('-password');
          return res.json({ ok: true, url: finalUrl, user: updated || null });
        }
        return res.json({ ok: true, url: finalUrl });
      });
      return;
    }

    return res.status(400).json({ ok: false, message: 'No file data' });
  } catch (err) {
    console.error('[authRoutes] upload avatar error (unified)', err && err.stack);
    return res.status(500).json({ ok: false, message: 'Upload failed' });
  }
}

// register avatar upload route
if (uploadHandler) {
  router.post('/user/upload-avatar', uploadHandler.single('avatar'), (req, res) => unifiedUploadHandlerLogic(req, res));
} else {
  router.post('/user/upload-avatar', (req, res) => unifiedUploadHandlerLogic(req, res));
}

// OAuth stubs (no-op)
router.get('/google', (req, res, next) => { console.log('[authRoutes] GET /google'); next(); });
router.get('/google/callback', (req, res, next) => { console.log('[authRoutes] GET /google/callback'); next(); });

module.exports = router;