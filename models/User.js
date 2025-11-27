const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid'); 

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

const userSchema = new Schema({
  id: {
    type: String,
    unique: true,
    default: () => uuidv4(), 
    required: true
  },

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
  password: { 
    type: String
  },
  resetPasswordToken: { 
    type: String
  },
  resetPasswordExpires:{ 
    type: Date
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