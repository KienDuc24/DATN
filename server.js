const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const path = require('path');
const MongoStore = require('connect-mongo');
const { v4: uuidv4 } = require('uuid'); // Thêm ở đầu file
require('dotenv').config();
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true
}));

// Kết nối MongoDB
(async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn('MONGODB_URI not set in .env');
    } else {
      await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log('✅ MongoDB connected');
    }
  } catch (err) {
    console.error('❌ MongoDB connection error', err);
  }
})();

// Session cho passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 14 * 24 * 60 * 60 // = 14 days. Default
  })
}));
app.use(passport.initialize());
app.use(passport.session());

// Serialize/deserialize user (demo, thực tế nên lưu vào DB)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Cấu hình Google OAuth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  // Ở đây bạn có thể lưu user vào DB nếu muốn
  // profile chứa thông tin user Google
  return done(null, {
    id: profile.id,
    name: profile.displayName,
    email: profile.emails[0].value
  });
}));

// Route bắt đầu đăng nhập Google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Route callback sau khi xác thực Google
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Đăng nhập thành công, trả về user qua query (bạn nên trả về JWT thực tế)
    const user = req.user;
    // Chuyển về FE kèm thông tin user
    res.redirect(`https://datn-smoky.vercel.app?user=${encodeURIComponent(JSON.stringify(user))}`);
  }
);

// Route kiểm tra đăng nhập (FE có thể gọi để lấy user)
app.get('/api/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Đăng ký
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ message: 'Thiếu tên đăng nhập hoặc mật khẩu.' });

  const existed = await User.findOne({ username });
  if (existed)
    return res.json({ message: 'Tên đăng nhập đã tồn tại.' });

  const hash = await bcrypt.hash(password, 10);
  const user = new User({
    id: uuidv4(), // Tự tạo id
    username,
    password: hash,
    email: `${username}@example.com`, // Tạo email giả nếu không có
    provider: 'local'
  });
  await user.save();
  res.json({ message: 'Đăng ký thành công!', user: { username: user.username } });
});

// Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user)
    return res.json({ message: 'Sai tên đăng nhập hoặc mật khẩu.' });

  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return res.json({ message: 'Sai tên đăng nhập hoặc mật khẩu.' });

  // Có thể trả về token ở đây nếu muốn
  res.json({ message: 'Đăng nhập thành công!', token: 'dummy-token', user: { username: user.username } });
});

app.use('/public', express.static(path.join(__dirname, 'public')));

const authRouter = require('./routes/authRoutes');
app.use('/api/auth', authRouter);

const roomRoutes = require('./routes/roomRoutes');
app.use('/api/room', roomRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ensure uploads directory exists (prevents runtime errors when multer saves files)
try {
  const uploadsDir = path.resolve(__dirname, 'public', 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('[server] ensured uploads dir exists at', uploadsDir);
} catch (e) {
  console.warn('[server] could not create uploads dir', e && e.message ? e.message : e);
}

// Export app cho Vercel
module.exports = app;
if (require.main === module) {
  app.listen(3001, () => console.log('Server running on http://localhost:3001'));
}

