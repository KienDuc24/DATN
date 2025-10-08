const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, unique: false },
  password: { type: String },
  email: { type: String, unique: true, required: true },
  displayName: { type: String, default: '' },
  avatar: { type: String, default: '' },
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
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);