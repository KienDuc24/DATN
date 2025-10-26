const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PlayerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, default: null },     // legacy / login username
  name: { type: String, default: null },         // client-provided name (used by ToD)
  displayName: { type: String, default: null },  // readable name
  avatar: { type: String, default: null }        // optional, allowed but you said ko cần
}, { _id: false });

const RoomSchema = new Schema({
  code: { type: String, required: true, unique: true },        // mã phòng hiển thị
  game: {
    id: { type: String },
    name: { type: String },
  },
  owner: {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    username: { type: String }
  },
  // keep both participants and players for compatibility
  participants: { type: [PlayerSchema], default: [] },
  players: { type: [PlayerSchema], default: [] },

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

// export
module.exports = mongoose.models.Room || mongoose.model('Room', RoomSchema);

