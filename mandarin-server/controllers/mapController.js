const User = require('../models/User');

/**
 * GET /api/map/nearby
 * Example query: ?lat=...&lng=...
 * This is a dummy implementation returning all users.
 * In production, you'd do a geospatial query, e.g.:
 *  User.find({
 *    location: {
 *      $near: {
 *        $geometry: { type: 'Point', coordinates: [lng, lat] },
 *        $maxDistance: 5000 // 5km, for example
 *      }
 *    }
 *  });
 */
exports.getNearbyUsers = async (req, res) => {
  try {
    // Dummy: return all users
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('getNearbyUsers Error:', error);
    res.status(500).json({ message: error.message });
  }
};
