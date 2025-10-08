const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true }, // ID duy nhất cho mỗi user
  username: { type: String, unique: false }, // Google user có thể không có username
  password: { type: String }, // Google user không cần password
  email: { type: String, unique: true, required: true },
  displayName: { type: String, default: '' }, // Tên hiển thị
  avatar: { type: String, default: '' },      // Link ảnh đại diện
  role: { type: String, default: 'user' },    // 'user' hoặc 'admin'
  provider: { type: String, enum: ['local', 'google'], default: 'local' }, // Phân biệt loại tài khoản
  googleId: { type: String, default: null },  // Lưu ID Google nếu đăng nhập Google
  gameHistory: [
    {
      gameId: String,
      gameName: String,
      playedAt: { type: Date, default: Date.now },
      score: Number
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);