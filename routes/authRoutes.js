const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const fs = require('fs');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

console.log('[authRoutes] loaded');

// Cloudinary setup
let cloudinary = null;
try {
  const cld = require('cloudinary');
  cloudinary = cld.v2;
  // prefer CLOUDINARY_URL if set, otherwise use individual vars
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
      api_key: process.env.CLOUDINARY_API_KEY || '',
      api_secret: process.env.CLOUDINARY_API_SECRET || '',
      secure: true
    });
  }
  console.log('[authRoutes] cloudinary configured');
} catch (err) {
  console.warn('[authRoutes] cloudinary not available or not configured:', err && err.message);
  cloudinary = null;
}

// ensure uploads dir or fallback to tmp (only for temporary disk storage before upload)
let uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('[authRoutes] ensured uploadsDir:', uploadsDir);
} catch (err) {
  console.warn('[authRoutes] cannot create public/uploads, fallback to tmp', err && err.message);
  uploadsDir = os.tmpdir();
  console.log('[authRoutes] using tmp uploadsDir:', uploadsDir);
}

// Try require multer; if it fails (ESM-only), fall back to formidable
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

// debug health route
router.get('/_status', (req, res) => res.json({ ok: true, msg: 'authRoutes OK', uploadsDir }));

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

// Helper: upload local file at filePath to Cloudinary (if configured)
async function uploadToCloudinary(filePath) {
  if (!cloudinary) throw new Error('Cloudinary not configured');
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, { folder: 'avatars' }, (err, result) => {
      if (err) return reject(err);
      return resolve(result);
    });
  });
}

// Upload avatar (POST /api/user/upload-avatar)
// Supports both multer (disk) and formidable fallback; always uploads to Cloudinary if configured
if (uploadHandler) {
  router.post('/user/upload-avatar', uploadHandler.single('avatar'), async (req, res) => {
    console.log('[authRoutes] POST /user/upload-avatar (multer) file=', req.file && req.file.filename, 'body=', req.body);
    try {
      if (!req.file) return res.status(400).json({ ok: false, message: 'No file uploaded' });
      const localPath = req.file.path;
      let finalUrl = '';
      if (cloudinary) {
        try {
          const r = await uploadToCloudinary(localPath);
          finalUrl = r.secure_url || r.url;
        } catch (err) {
          console.error('[authRoutes] cloudinary upload failed', err);
          // fallback: try to serve local file (may not persist on serverless)
          const savedName = req.file.filename || path.basename(localPath);
          finalUrl = `${req.protocol}://${req.get('host')}/uploads/${savedName}`;
        } finally {
          // cleanup local file
          fs.unlink(localPath, () => {});
        }
      } else {
        const savedName = req.file.filename || path.basename(localPath);
        finalUrl = `${req.protocol}://${req.get('host')}/uploads/${savedName}`;
      }

      const username = req.body.username;
      if (username) {
        const updated = await User.findOneAndUpdate(
          { $or: [{ username }, { _id: username }] },
          { $set: { avatar: finalUrl } },
          { new: true }
        ).select('-password');
        if (updated) return res.json({ ok: true, url: finalUrl, user: updated });
      }
      return res.json({ ok: true, url: finalUrl });
    } catch (err) {
      console.error('[authRoutes] upload avatar error (multer)', err);
      return res.status(500).json({ ok: false, message: 'Upload failed' });
    }
  });
} else {
  // fallback using formidable (CommonJS)
  const formidable = require('formidable');
  router.post('/user/upload-avatar', (req, res) => {
    console.log('[authRoutes] POST /user/upload-avatar (formidable) start');
    const form = new formidable.IncomingForm({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024 // 10MB
    });
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('[authRoutes] formidable parse error', err);
        return res.status(500).json({ ok: false, message: 'parse error' });
      }
      const file = files.avatar || files.file || null;
      if (!file) return res.status(400).json({ ok: false, message: 'No file uploaded' });
      const localPath = file.path;
      try {
        let finalUrl = '';
        if (cloudinary) {
          try {
            const r = await uploadToCloudinary(localPath);
            finalUrl = r.secure_url || r.url;
          } catch (err2) {
            console.error('[authRoutes] cloudinary upload failed (formidable)', err2);
            const savedName = path.basename(localPath);
            finalUrl = `${req.protocol}://${req.get('host')}/uploads/${savedName}`;
          } finally {
            fs.unlink(localPath, () => {});
          }
        } else {
          const savedName = path.basename(localPath);
          finalUrl = `${req.protocol}://${req.get('host')}/uploads/${savedName}`;
        }

        const username = fields.username;
        if (username) {
          const updated = await User.findOneAndUpdate(
            { $or: [{ username }, { _id: username }] },
            { $set: { avatar: finalUrl } },
            { new: true }
          ).select('-password');
          if (updated) return res.json({ ok: true, url: finalUrl, user: updated });
        }
        return res.json({ ok: true, url: finalUrl });
      } catch (err3) {
        console.error('[authRoutes] upload avatar error (formidable)', err3);
        return res.status(500).json({ ok: false, message: 'Upload failed' });
      }
    });
  });
}

module.exports = router;