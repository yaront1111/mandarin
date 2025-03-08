const { User, Profile, Photo } = require('../models');
const { catchAsync } = require('../utils/helpers');

exports.getProfile = catchAsync(async (req, res) => {
  const userId = req.params.id || req.user.id; // allow "me" or pass in param
  const user = await User.findByPk(userId, {
    include: [Profile, Photo]
  });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  res.json({ success: true, data: user });
});

exports.updateProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { firstName, lastName, bio, interests, locationLat, locationLng } = req.body;

  const user = await User.findByPk(userId, { include: [Profile] });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  // Update user basic fields
  user.firstName = firstName || user.firstName;
  user.lastName = lastName || user.lastName;
  await user.save();

  // Update or create Profile
  if (!user.Profile) {
    user.Profile = await Profile.create({ userId, bio, interests });
  } else {
    user.Profile.bio = bio || user.Profile.bio;
    user.Profile.interests = interests || user.Profile.interests;
    user.Profile.locationLat = locationLat ?? user.Profile.locationLat;
    user.Profile.locationLng = locationLng ?? user.Profile.locationLng;
    await user.Profile.save();
  }

  res.json({ success: true, data: user });
});

exports.deleteAccount = catchAsync(async (req, res) => {
  const userId = req.user.id;
  await User.destroy({ where: { id: userId } });
  res.json({ success: true, message: 'Account deleted' });
});
