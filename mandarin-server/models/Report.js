// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  details: { type: String },
  resolved: { type: Boolean, default: false },
  action: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);
