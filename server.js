const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true
}));

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.error('MongoDB error:', err));

// Session cho passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
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
    res.redirect(`http://localhost:5500/DATN/public/index.html?user=${encodeURIComponent(JSON.stringify(user))}`);
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
  const user = new User({ username, password: hash });
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

app.listen(3001, () => console.log('Server running on http://localhost:3001'));