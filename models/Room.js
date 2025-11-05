const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Thay đổi: mảng ObjectId để tham chiếu
  gameType: { type: String, required: true }, // Loại game
  gameData: { type: mongoose.Schema.Types.Mixed }, // Thay đổi: lưu dữ liệu game linh hoạt
  maxPlayers: { type: Number, default: 4 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true }); // Thay đổi: thêm timestamps để theo dõi thời gian

module.exports = mongoose.model('Room', roomSchema);