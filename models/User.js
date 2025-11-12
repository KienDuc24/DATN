// /app/models/User.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema con cho lịch sử chơi
const playHistorySchema = new Schema({
  gameId: {
    type: Schema.Types.ObjectId,
    ref: 'Game' // Tham chiếu đến model 'Game'
  },
  // Bạn có thể thêm các trường khác như:
  // result: String, // 'win', 'loss'
  // score: Number,
  playedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Schema chính cho User
const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true
  },
  // Thêm các trường khác của bạn ở đây (ví dụ: password, avatar...)

  playHistory: {
    type: [playHistorySchema],
    default: []
  }
}, {
  timestamps: true // Tự động thêm createdAt và updatedAt
});

// Dòng quan trọng: Export model 'User', KHÔNG PHẢI 'Room'
module.exports = mongoose.model('User', userSchema);