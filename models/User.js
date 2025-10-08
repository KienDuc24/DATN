const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  displayName: { type: String, default: '' }, // Tên hiển thị
  avatar: { type: String, default: '' },      // Link ảnh đại diện
  gameHistory: [
    {
      gameId: String,
      gameName: String,
      playedAt: { type: Date, default: Date.now },
      score: Number // hoặc các trường khác tuỳ ý
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);