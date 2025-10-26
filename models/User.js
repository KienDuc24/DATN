const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String },
  email: { type: String, unique: true, sparse: true },
  displayName: { type: String },
  avatar: { type: String, default: '' },
  avatarUrl: { type: String, default: null },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
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
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// hash password before save when modified
userSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password') || !this.password) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// helper to compare password
userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);