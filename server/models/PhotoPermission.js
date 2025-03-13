// PhotoPermission.js
const mongoose = require('mongoose');

const PhotoPermissionSchema = new mongoose.Schema({
  photo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PhotoPermission', PhotoPermissionSchema);
