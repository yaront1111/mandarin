// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  // For potential location usage (e.g., getNearbyUsers):
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Optional: for geospatial indexing if you want to do real "nearby" queries
userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
