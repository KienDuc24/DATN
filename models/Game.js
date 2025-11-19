// models/Game.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const LangSchema = new Schema({
  vi: { type: String, required: true },
  en: { type: String, required: true }
}, { _id: false });

const gameSchema = new Schema({
  id: { // Mã nghiệp vụ (ví dụ: "Draw", "ToD")
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: { type: LangSchema, required: true },
  desc: { type: LangSchema, required: true },
  players: { type: String, required: true },
  category: { type: LangSchema, required: true },
  featured: {
    type: Boolean,
    default: false, 
  },
  // --- THÊM MỚI: Cờ đánh dấu game đang phát triển ---
  isComingSoon: {
    type: Boolean,
    default: true // Mặc định là True (chưa chơi được)
  }
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);