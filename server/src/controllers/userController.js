// src/controllers/userController.js

const { User, Profile, Photo } = require('../models');
const { catchAsync } = require('../utils/helpers');
const kinkService = require('../services/kinkService');

/**
 * GET /users/me  or  GET /users/:id
 * Fetches a single user's profile (including Profile and Photos).
 * If the requester is authenticated and is viewing someone else's profile,
 * we also calculate kink compatibility.
 */
exports.getProfile = catchAsync(async (req, res) => {
  // The user ID we want to view
  const userId = req.params.id || req.user.id;

  // Fetch user + associated Profile & Photos
  const user = await User.findByPk(userId, {
    include: [Profile, Photo]
  });

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  // By default, no kink compatibility
  let kinkCompatibility = null;

  // If an authenticated user is viewing someone else's profile, calculate compatibility
  if (req.user && req.user.id !== userId) {
    kinkCompatibility = await kinkService.getCompatibilityScore(req.user.id, userId);
  }

  // Return everything, plus the optional kinkCompatibility
  res.json({
    success: true,
    data: {
      user,
      kinkCompatibility
    }
  });
});

/**
 * PUT /users/me
 * Updates the currently logged-in user's basic info and profile.
 */
exports.updateProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const {
    firstName,
    lastName,
    bio,
    interests,
    locationLat,
    locationLng
  } = req.body;

  const user = await User.findByPk(userId, { include: [Profile] });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  // Update user basic fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  await user.save();

  // Update or create Profile
  if (!user.Profile) {
    user.Profile = await Profile.create({
      userId,
      bio: bio || '',
      interests: interests || [],
      locationLat: locationLat ?? null,
      locationLng: locationLng ?? null
    });
  } else {
    if (bio !== undefined) user.Profile.bio = bio;
    if (interests !== undefined) user.Profile.interests = interests;
    if (locationLat !== undefined) user.Profile.locationLat = locationLat;
    if (locationLng !== undefined) user.Profile.locationLng = locationLng;
    await user.Profile.save();
  }

  res.json({
    success: true,
    data: user
  });
});

/**
 * DELETE /users/me
 * Completely deletes the logged-in user's account.
 */
exports.deleteAccount = catchAsync(async (req, res) => {
  const userId = req.user.id;
  await User.destroy({ where: { id: userId } });
  res.json({
    success: true,
    message: 'Account deleted'
  });
});

/**
 * GET /users/stats
 * Get statistics for the current user.
 */
exports.getUserStats = catchAsync(async (req, res) => {
  const userId = req.user.id;

  // Here you would normally query various tables to get actual stats
  // For now, we'll return mock data
  const stats = {
    viewCount: 0,
    likeCount: 0,
    matchCount: 0,
    messageCount: 0,
    profileCompleteness: 0,
    responseRate: 0
  };

  res.json({
    success: true,
    data: stats
  });
});
