// controllers/userController.js (FULL CODE - FINAL)
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Thêm cái này
const sendEmail = require('../utils/sendEmail'); // Thêm cái này

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

// 1. Gửi yêu cầu quên mật khẩu
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống.' });
    }
    if (!user.password) {
       return res.status(400).json({ message: 'Tài khoản này dùng Google, không thể đổi mật khẩu.' });
    }

    // Tạo token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Lưu vào DB (Hết hạn sau 10 phút)
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; 

    await user.save();

    // Tạo Link reset (Trỏ về file reset.html ở Frontend)
    const frontendURL = process.env.FRONTEND_URL || 'https://datn-smoky.vercel.app';
    const resetUrl = `${frontendURL}/reset.html?token=${resetToken}`;

    const message = `
      <h1>Bạn đã yêu cầu lấy lại mật khẩu</h1>
      <p>Vui lòng nhấp vào liên kết bên dưới để đặt lại mật khẩu:</p>
      <a href="${resetUrl}" clicktracking=off>${resetUrl}</a>
      <p>Liên kết này sẽ hết hạn sau 10 phút.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Camping Game - Lấy lại mật khẩu',
        message
      });
      res.status(200).json({ message: 'Email đã được gửi!' });
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ message: 'Không thể gửi email. Vui lòng thử lại.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi Server' });
  }
};

// 2. Đặt lại mật khẩu mới
exports.resetPassword = async (req, res) => {
  try {
    // Mã hóa token gửi lên để so sánh với DB
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() } // Kiểm tra còn hạn không
    });

    if (!user) {
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }

    // Đặt mật khẩu mới
    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: 'Mật khẩu đã được thay đổi thành công! Vui lòng đăng nhập lại.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi Server' });
  }
};

// 3. Lấy thông tin user từ token (trước khi đặt lại mật khẩu)
exports.getResetInfo = async (req, res) => {
  try {
    const token = req.params.token;
    // Mã hóa token từ URL để so sánh với token đã mã hóa trong DB
    const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() } // Kiểm tra còn hạn
    });

    if (!user) {
      return res.status(400).json({ valid: false, message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }

    // Trả về thông tin công khai (tên hiển thị hoặc email/username)
    // Ưu tiên hiển thị email hoặc username
    const accountName = user.email || user.username;

    res.status(200).json({ 
        valid: true, 
        account: accountName,
        displayName: user.displayName
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi Server' });
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