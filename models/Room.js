const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoomSchema = new Schema({
  code: { type: String, required: true, unique: true },        // mã phòng hiển thị
  game: {
    id: { type: String },
    name: { type: String },
    // optional: point to local game folder id
  },
  owner: {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    username: { type: String }
  },
  participants: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    username: { type: String }
  }],
  status: { type: String, enum: ['open','playing','closed','waiting'], default: 'open' },
  isOpen: { type: Boolean, default: true },
  isPlaying: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// update updatedAt on save
RoomSchema.pre('save', function(next){
  this.updatedAt = Date.now();
  next();
});

// Only store minimal fields in DB. Dynamic game state kept in memory by game handler.
module.exports = mongoose.models.Room || mongoose.model('Room', RoomSchema);