const mongoose = require('mongoose');
const { Schema } = mongoose;

const playHistorySchema = new Schema({
  gameId: { type: String },
  gameName: { type: String },
  action: { type: String, default: 'played' },
  result: { type: String },
  playedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  username: { type: String, required: true, unique: true },
  displayName: { type: String },
  password: { type: String },
  avatar: { type: String },
  role: {
    type: String,
    enum: ['player', 'admin'],
    default: 'player'
  },
  playHistory: { type: [playHistorySchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);