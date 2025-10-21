const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  order: { type: Number, default: 0 }
}, { _id: false });

const RoomSchema = new mongoose.Schema({
  code: { type: String, required: true, index: true, unique: true },
  gameId: { type: String, default: null },
  players: { type: [PlayerSchema], default: [] },
  currentIndex: { type: Number, default: 0 },
  locked: { type: Boolean, default: false },
  votes: { type: [{ player: String, vote: String }], default: [] },
  lastQuestion: { type: String, default: "" },
  lastChoice: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.models.Room || mongoose.model('Room', RoomSchema);