// Room.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roomSchema = new Schema({
  code: { // Mã phòng (A123) - Khóa nghiệp vụ
    type: String,
    required: true,
    unique: true,
    default: () => {
      const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      const number = Math.floor(100 + Math.random() * 900);
      return letter + number;
    }
  },
  host: { // Liên kết đến User (host)
    type: Schema.Types.ObjectId, // <-- THAY ĐỔI: Dùng ObjectId
    ref: 'User', // <-- GIỮ NGUYÊN: Liên kết đến model 'User'
    required: true
  },
  players: [{ name: String }],
  game: {
    gameId: { // Liên kết đến Game
      type: Schema.Types.ObjectId, // <-- THAY ĐỔI: Dùng ObjectId
      ref: 'Game', // <-- THÊM: Liên kết đến model 'Game'
      required: true
    },
    type: { type: String } // "type" này có vẻ thừa nếu bạn đã có gameId
  },
  status: { type: String, default: 'waiting' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', roomSchema);