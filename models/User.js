const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String },
  email: { type: String, unique: true, sparse: true },
  displayName: { type: String },
  avatar: { type: String, default: '' },
  avatarUrl: { type: String, default: null }, // <-- thêm trường avatarUrl
  role: { type: String, default: 'user' },
  provider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleId: { type: String, default: null },
  gameHistory: [
    {
      gameId: String,
      gameName: String,
      playedAt: { type: Date, default: Date.now },
      score: Number
    }
  ],
}, {
  timestamps: true
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);