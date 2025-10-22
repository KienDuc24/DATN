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

/* Replace previous upload handlers with this robust handler that:
 - supports multer.disk (req.file.path) and multer memory (req.file.buffer)
 - supports formidable (file.filepath || file.path)
 - uploads to Cloudinary if configured (or returns /uploads URL fallback)
 - only unlink when localPath is a valid string, and catches errors
*/
const util = require('util');
const stat = util.promisify(fs.stat);
async function safeUnlink(p) {
  try {
    if (!p || typeof p !== 'string') return;
    // ensure file exists before unlink
    await stat(p);
    fs.unlink(p, (err) => { if (err) console.warn('[authRoutes] unlink warn', err && err.message); });
  } catch (e) {
    // ignore missing file
  }
}

async function uploadLocalOrBufferToCloudinary(localPath, buffer) {
  if (!cloudinary) {
    // no cloudinary - return fallback url pointing to uploads (may not persist on Vercel)
    if (localPath && typeof localPath === 'string') {
      const savedName = path.basename(localPath);
      return `${'https'/*proto*/}://${process.env.FRONTEND_HOST || '' || 'your-domain'}/uploads/${savedName}`;
    }
    throw new Error('No cloudinary and no localPath');
  }

  // if buffer present: upload via upload_stream
  if (buffer && Buffer.isBuffer(buffer)) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'avatars' }, (err, result) => {
        if (err) return reject(err);
        return resolve(result && (result.secure_url || result.url));
      });
      stream.end(buffer);
    });
  }

  // otherwise upload from local file path
  if (localPath && typeof localPath === 'string') {
    const result = await uploadToCloudinary(localPath); // existing helper that uses cloudinary.uploader.upload
    return result && (result.secure_url || result.url);
  }

  throw new Error('No valid input to upload');
}

// unified route (works with multer if available OR formidable fallback)
router.post('/user/upload-avatar', async (req, res, next) => {
  try {
    // if multer available and put file on disk or in memory
    if (req.file) {
      // multer disk: req.file.path; multer memory: req.file.buffer
      const localPath = req.file.path || null;
      const buffer = req.file.buffer || null;
      let finalUrl = '';
      try {
        finalUrl = await uploadLocalOrBufferToCloudinary(localPath, buffer);
      } catch (errUp) {
        console.error('[authRoutes] cloudinary upload failed (multer path/buffer)', errUp && errUp.message);
        // fallback: serve local file if exists
        if (localPath) finalUrl = `${req.protocol}://${req.get('host')}/uploads/${path.basename(localPath)}`;
        else throw errUp;
      } finally {
        // cleanup local file if a path was created
        await safeUnlink(localPath);
      }

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

    // formidable fallback: parse form if no req.file
    if (useFormidable || (!req.file && req.headers['content-type'] &&
        req.headers['content-type'].startsWith('multipart/form-data'))) {
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

        // formidable v2 uses file.filepath; older use file.path
        const localPath = file.filepath || file.path || null;
        let finalUrl = '';
        try {
          // upload localPath to cloudinary or return fallback
          finalUrl = await uploadLocalOrBufferToCloudinary(localPath, null);
        } catch (errUp) {
          console.error('[authRoutes] cloudinary upload failed (formidable)', errUp && errUp.message);
          if (localPath) finalUrl = `${req.protocol}://${req.get('host')}/uploads/${path.basename(localPath)}`;
          else return res.status(500).json({ ok: false, message: 'Upload failed' });
        } finally {
          await safeUnlink(localPath);
        }

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

    // no file detected
    return res.status(400).json({ ok: false, message: 'No file data' });
  } catch (err) {
    console.error('[authRoutes] upload avatar error (unified handler)', err && err.stack);
    return res.status(500).json({ ok: false, message: 'Upload failed' });
  }
});

module.exports = router;