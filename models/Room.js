const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Chủ phòng
  players: [{
    name: { type: String, required: true }, // Tên của từng người chơi
  }],
  status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' }, // Trạng thái phòng
  createdAt: { type: Date, default: Date.now }, // Thời gian tạo phòng
  game: {
    gameId: { type: String, required: true }, // ID của game
    type: { type: String, required: true }, // Thể loại game
  },
}, { timestamps: true }); // Tự động thêm createdAt và updatedAt

module.exports = mongoose.model('Room', roomSchema);