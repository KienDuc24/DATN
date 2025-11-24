const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterName: { type: String, default: 'Anonymous' }, 
  category: { 
    type: String, 
    required: true,
    enum: ['bug', 'harass', 'spam', 'other'] 
  },
  content: { type: String, required: true }, 
  status: { 
    type: String, 
    default: 'pending',
    enum: ['pending', 'reviewed', 'resolved', 'rejected']
  },
  adminNote: { type: String }, 
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);