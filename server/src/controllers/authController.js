// server/src/controllers/authController.js

const authService = require('../services/authService');
const { catchAsync } = require('../utils/helpers');

/**
 * Register a new user (without lastName, but including nickname).
 * For this to work properly, ensure your authValidator and DB model
 * include nickname and no longer require lastName.
 */
exports.register = catchAsync(async (req, res) => {
  const {
    email,
    password,
    firstName,
    nickname,
    birthDate,
    gender,
    lookingFor
  } = req.body;

  // Adjust as needed if you require other fields (e.g., phone, username, etc.)
  const data = await authService.registerUser({
    email,
    password,
    firstName,
    nickname,
    birthDate,
    gender,
    lookingFor
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data
  });
});

/**
 * Log in an existing user.
 */
exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const response = await authService.loginUser(email, password);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: response
  });
});

/**
 * Refresh an expired access token using a refresh token.
 */
exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  const tokens = await authService.refreshToken(refreshToken);

  res.status(200).json({
    success: true,
    data: tokens
  });
});

/**
 * Get the current authenticated user (from req.user).
 */
exports.getCurrentUser = catchAsync(async (req, res) => {
  const user = req.user; // from auth middleware
  res.status(200).json({
    success: true,
    data: user
  });
});

/**
 * Log out the current user.
 */
exports.logout = catchAsync(async (req, res) => {
  const userId = req.user.id;
  await authService.logoutUser(userId);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});
