// /app/models/User.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema con cho lịch sử chơi
const playHistorySchema = new Schema({
  gameId: {
    type: String 
  },
  gameName: String,
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
  
  // --- KHÔI PHỤC TRƯỜNG NÀY ---
  displayName: {
    type: String,
    required: true
  },
  // ---------------------------

  email: {
    type: String,
    unique: true,
    sparse: true 
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true 
  },
  
  // --- VẪN XÓA avatar ---

  password: { 
    type: String
  },
  status: { 
    type: String,
    enum: ['online', 'offline', 'playing'],
    default: 'offline'
  },
  socketId: String, 
  
  playHistory: {
    type: [playHistorySchema],
    default: []
  }
}, {
  timestamps: true 
});

module.exports = mongoose.model('User', userSchema);