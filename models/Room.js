const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: { type: String, default: null } // lưu avatar (nếu có)
}, { _id: false });

const RoomSchema = new mongoose.Schema({
  code: { type: String, required: true, index: true, unique: true },
  host: { type: String, default: null },
  players: { type: [PlayerSchema], default: [] },
  locked: { type: Boolean, default: false } // phòng đang chơi hay chờ
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Only store minimal fields in DB. Dynamic game state kept in memory by game handler.
module.exports = mongoose.models.Room || mongoose.model('Room', RoomSchema);