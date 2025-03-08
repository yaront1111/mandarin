const User = require('../models/User');

/**
 * GET /api/users/:id
 * Returns a user's public profile (excluding password).
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('getProfile Error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/users/:id
 * Allows a user to update their profile info.
 */
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('updateProfile Error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Additional functions (example)
 * GET /api/users/:id/like
 * GET /api/users/matches
 * etc.
 */
exports.likeUser = async (req, res) => {
  try {
    // Dummy example: add a "likedUsers" array to the requesting user
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'Current user not found' });
    }

    // Add the target user to current user's "likedUsers" (example)
    currentUser.likedUsers = currentUser.likedUsers || [];
    currentUser.likedUsers.push(req.params.id);
    await currentUser.save();

    res.json({ message: 'User liked successfully.' });
  } catch (error) {
    console.error('likeUser Error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getMatches = async (req, res) => {
  try {
    // Dummy: a "match" means both users liked each other
    // Real logic may vary
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || !currentUser.likedUsers) {
      return res.json([]);
    }

    // We look for users that liked the current user, and current user liked them
    const matches = await User.find({
      _id: { $in: currentUser.likedUsers },
      likedUsers: req.user.id
    }).select('-password');

    res.json(matches);
  } catch (error) {
    console.error('getMatches Error:', error);
    res.status(500).json({ message: error.message });
  }
};
