// controllers/mapController.js
const User = require('../models/User');

exports.getNearbyUsers = async (req, res) => {
  try {
    // Dummy implementation: return all users
    // In production, calculate distance based on coordinates from req.query
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
