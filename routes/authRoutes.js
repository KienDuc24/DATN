const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const router = express.Router();

// Đăng ký
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ message: 'Thiếu thông tin' });
  const existed = await User.findOne({ username });
  if (existed) return res.json({ message: 'Tên đăng nhập đã tồn tại' });
  const hash = await bcrypt.hash(password, 10);
  const user = new User({
    id: uuidv4(),
    username,
    password: hash,
    email: username + '@example.com',
    provider: 'local'
  });
  await user.save();
  res.json({ message: 'Đăng ký thành công', user });
});

// Đăng nhập
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
  res.json({ message: 'Đăng nhập thành công', user });
});

module.exports = router;