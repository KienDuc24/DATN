const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const uploadHandler = multer({ storage }).single('file'); // Middleware for single file upload

console.log('[authRoutes] loaded');

// Cloudinary setup (optional)
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
      secure: true,
    });
  }
  console.log('[authRoutes] cloudinary init (may be unconfigured)');
} catch (err) {
  console.warn('[authRoutes] cloudinary not available:', err && err.message);
  cloudinary = null;
}

// Uploads directory
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('[authRoutes] ensured uploadsDir:', uploadsDir);
} catch (err) {
  console.warn('[authRoutes] cannot create public/uploads, fallback to tmp', err && err.message);
}

// Example: Log incoming registration/login hits
router.post('/login', async (req, res) => {
  console.log('[authRoutes] POST /api/auth/login body keys:', Object.keys(req.body));
  // ...existing login logic...
});

router.post('/register', uploadHandler, async (req, res) => {
  console.log('[authRoutes] POST /api/auth/register body keys:', Object.keys(req.body));
  // ...existing register logic...
});

// Simple health check
router.get('/_status', (req, res) => res.json({ ok: true, uploadsDir }));

// GET user by username or id
router.get('/user', async (req, res) => {
  try {
    const username = req.query.username || req.query.id || req.query._id;
    if (!username) return res.status(400).json({ ok: false, message: 'username or id required' });
    const query = req.query._id || req.query.id ? { _id: username } : { username };
    const user = await User.findOne(query).select('-password');
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

// Login
router.post('/auth/login', async (req, res) => {
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

// Upload route
router.post('/upload', uploadHandler, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  // Access uploaded file via req.file
  console.log(req.file);

  res.status(200).json({ message: 'File uploaded successfully' });
});

module.exports = router;