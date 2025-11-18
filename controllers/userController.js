// controllers/userController.js (FULL CODE - FINAL)
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- Helper ---
function sanitizeUser(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : Object.assign({}, user);
  delete u.password;
  delete u.passwordHash;
  return u;
}

// === 1. LOGIC AUTH ===

exports.registerUser = async (req, res) => {
  try {
    const { username, password, displayName, email, role } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Thiếu username hoặc password' });
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({ 
        username, 
        displayName: displayName || username,
        email: email || undefined, 
        password: hashedPassword,
        role: role || 'user' 
    });
    
    await user.save();
    
    res.status(201).json({ message: 'User registered successfully', user: sanitizeUser(user) });
  } catch (err) {
    console.error('[userController] /register error:', err.message);
    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
        return res.status(400).json({ message: 'Email này đã được sử dụng.' });
    }
    res.status(500).json({ message: 'Lỗi server khi đăng ký' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Thiếu username hoặc password' });
    }
    
    const user = await User.findOne({ username }); 
    if (!user) {
      return res.status(401).json({ message: 'Sai username hoặc mật khẩu' });
    }
    
    if (!user.password) {
         return res.status(401).json({ message: 'Tài khoản này được tạo bằng Google, hãy đăng nhập bằng Google.' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Sai username hoặc mật khẩu' });
    }
    
    const token = jwt.sign(
        { id: user._id, username: user.username, role: user.role }, 
        process.env.SESSION_SECRET || 'datn_secret_key', 
        { expiresIn: '1d' }
    );
    
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('[userController] /login error:', err.message);
    res.status(500).json({ message: 'Lỗi server khi đăng nhập' });
  }
};

// === 2. LOGIC USER ===

exports.getUserByUsername = async (req, res) => {
  const username = req.params.username || req.query.username;
  if (!username) return res.status(400).json({ ok: false, message: 'username required' });
  
  const user = await User.findOne({ username }).select('-password -passwordHash');
  if (!user) return res.status(404).json({ ok: false, message: 'Not found' });
  
  return res.json({ ok: true, user });
};

exports.updateUser = async (req, res) => {
  try {
    const body = req.body || {};
    const identifier = body.username || body._id || (req.user && req.user.username);
    
    if (!identifier) return res.status(400).json({ ok: false, message: 'username or _id required' });

    const query = body._id ? { _id: body._id } : { username: identifier };
    const allowed = {};
    
    if (typeof body.displayName === 'string') allowed.displayName = body.displayName;
    if (typeof body.email === 'string') allowed.email = body.email;
    
    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ ok: false, message: 'no updatable fields' });
    }

    // Cập nhật user
    const updated = await User.findOneAndUpdate(query, { $set: allowed }, { new: true }).select('-password -passwordHash');
    
    // (ĐÃ XÓA LOGIC CẬP NHẬT ROOM Ở ĐÂY)

    if (!updated) return res.status(404).json({ ok: false, message: 'User not found' });

    return res.json({ ok: true, user: sanitizeUser(updated) });
  } catch (err) {
    console.error('updateUser error', err);
    return res.status(500).json({ ok: false, message: 'Internal error' });
  }
};