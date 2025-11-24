const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reporterName: { type: String, required: true },
    category: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' },
    note: { type: String }
});

module.exports = mongoose.model('Report', reportSchema);