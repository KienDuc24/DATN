const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const fs = require('fs');
const util = require('util');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

console.log('[authRoutes] loaded');

// cloudinary setup (optional)
let cloudinary = null;
try {
  const cld = require('cloudinary');
  cloudinary = cld.v2;
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
  console.log('[authRoutes] cloudinary init (may be unconfigured)');
} catch (err) {
  console.warn('[authRoutes] cloudinary not available:', err && err.message);
  cloudinary = null;
}

// uploads dir (temp)
let uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('[authRoutes] ensured uploadsDir:', uploadsDir);
} catch (err) {
  console.warn('[authRoutes] cannot create public/uploads, fallback to tmp', err && err.message);
  uploadsDir = os.tmpdir();
  console.log('[authRoutes] using tmp uploadsDir:', uploadsDir);
}

// try multer; if ESM-only fails, fallback to formidable
let multer;
try {
  multer = require('multer');
  if (multer && multer.default) multer = multer.default;
  console.log('[authRoutes] multer loaded, memoryStorage=', typeof (multer && multer.memoryStorage));
} catch (e) {
  console.warn('[authRoutes] multer require failed, fallback to formidable. Error:', e && e.message);
  multer = null;
}

let uploadMiddleware = null;
if (multer && typeof multer.memoryStorage === 'function') {
  const storage = multer.memoryStorage();
  uploadMiddleware = multer({ storage });
  console.log('[authRoutes] uploadMiddleware configured (multer)');
} else {
  console.log('[authRoutes] using fallback upload handling (no multer)');
}

// Example: log incoming registration/login hits
router.post('/login', async (req, res) => {
  console.log('[authRoutes] POST /api/auth/login body keys:', Object.keys(req.body));
  // ...existing login logic...
});

router.post('/register', async (req, res) => {
  console.log('[authRoutes] POST /api/auth/register body keys:', Object.keys(req.body));
  // ...existing register logic...
});

// simple health
router.get('/_status', (req, res) => res.json({ ok: true, uploadsDir }));

// GET user by username or id: GET /api/user?username=... or ?id=...
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
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login (simple)
router.post('/auth/login', async (req, res) => {
  // debug helper
  function dbg(req) {
    console.log('[authRoutes] %s %s body=%j query=%j cookies=%j', req.method, req.originalUrl, req.body, req.query, req.cookies);
  }
  dbg(req);
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Update user (PUT /api/user) - replace displayName behavior with username change
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

    // avatar allowed
    if (typeof body.avatar === 'string') updates.avatar = body.avatar;

    // newUsername -> replace username in DB (ensure uniqueness)
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

// helpers
async function uploadToCloudinary(filePath) {
  if (!cloudinary) throw new Error('Cloudinary not configured');
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, { folder: 'avatars' }, (err, result) => {
      if (err) return reject(err);
      return resolve(result);
    });
  });
}
const stat = util.promisify(fs.stat);
async function safeUnlink(p) {
  try {
    if (!p || typeof p !== 'string') return;
    await stat(p);
    fs.unlink(p, (err) => { if (err) console.warn('[authRoutes] unlink warn', err && err.message); });
  } catch (e) { /* ignore */ }
}

async function uploadLocalOrBufferToCloudinary(localPath, buffer) {
  if (!cloudinary) {
    if (localPath && typeof localPath === 'string') {
      const savedName = path.basename(localPath);
      return `${'https'}://${process.env.FRONTEND_HOST || '' || ''}/uploads/${savedName}`;
    }
    throw new Error('No cloudinary configured and no localPath available');
  }

  if (buffer && Buffer.isBuffer(buffer)) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'avatars' }, (err, result) => {
        if (err) return reject(err);
        return resolve(result && (result.secure_url || result.url));
      });
      stream.end(buffer);
    });
  }

  if (localPath && typeof localPath === 'string') {
    const r = await uploadToCloudinary(localPath);
    return r && (r.secure_url || r.url);
  }

  throw new Error('No valid input to upload');
}

// unified upload handler
async function unifiedUploadHandlerLogic(req, res) {
  try {
    // multer populated req.file if used as middleware
    if (req.file) {
      const localPath = req.file.path || null;
      const buffer = req.file.buffer || null;
      let finalUrl = '';
      try {
        finalUrl = await uploadLocalOrBufferToCloudinary(localPath, buffer);
      } catch (errUp) {
        console.error('[authRoutes] cloudinary upload failed (multer)', errUp && errUp.message);
        if (localPath) finalUrl = `${req.protocol}://${req.get('host')}/uploads/${path.basename(localPath)}`;
        else return res.status(500).json({ ok: false, message: 'Upload failed' });
      } finally {
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

    // if not multer, use formidable fallback
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
        let finalUrl = '';
        try {
          finalUrl = await uploadLocalOrBufferToCloudinary(localPath, null);
        } catch (err2) {
          console.error('[authRoutes] cloudinary upload failed (formidable)', err2 && err2.message);
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

    return res.status(400).json({ ok: false, message: 'No file data' });
  } catch (err) {
    console.error('[authRoutes] upload avatar error (unified)', err && err.stack);
    return res.status(500).json({ ok: false, message: 'Upload failed' });
  }
}

// register route using multer if available, otherwise plain handler
if (uploadHandler) {
  router.post('/user/upload-avatar', uploadHandler.single('avatar'), (req, res) => unifiedUploadHandlerLogic(req, res));
} else {
  router.post('/user/upload-avatar', (req, res) => unifiedUploadHandlerLogic(req, res));
}

// GET /auth/google (OAuth start) & callback
const passport = require('passport'); // Cần cài đặt passport
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET);
  res.redirect(`/room?token=${token}`); // Chuyển hướng với token
});

module.exports = router;