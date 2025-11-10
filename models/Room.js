const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roomSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    default: () => {
      const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
      const number = Math.floor(100 + Math.random() * 900); // 100-999
      return letter + number;
    }
  },
  host: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  players: [{ name: String }], // Danh sách người chơi
  game: {
    gameId: { type: String, required: true },
    type: { type: String }
  },
  status: { type: String, default: 'waiting' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', roomSchema);