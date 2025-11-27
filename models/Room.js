const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  displayName: String,
  avatar: String
});

const roomSchema = new mongoose.Schema({
  code: { 
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  host: { 
    type: String, 
    required: true
  },
  players: [playerSchema], 
  game: {
    gameId: { type: String, required: true }, 
    type: { type: String } 
  },
  status: {
    type: String,
    enum: ['open', 'playing', 'closed'],
    default: 'open'
  }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);