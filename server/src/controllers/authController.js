// server/src/controllers/authController.js

const authService = require('../services/authService');
const { catchAsync } = require('../utils/helpers');
const logger = require('../utils/logger'); // Ensure you have a configured logger

/**
 * Register a new user.
 * Expects: email, password, firstName, nickname, birthDate, gender, lookingFor.
 * Note: Make sure to validate/sanitize input either here or via middleware.
 */
exports.register = catchAsync(async (req, res) => {
  const { email, password, firstName, nickname, birthDate, gender, lookingFor } = req.body;

  // Log the registration attempt (avoid logging sensitive data)
  logger.info(`Registering new user: ${email}`);

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
 * Expects: email, password.
 */
exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  logger.info(`Login attempt for user: ${email}`);
  const response = await authService.loginUser(email, password);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: response
  });
});

/**
 * Refresh an expired access token using a refresh token.
 * Expects: refreshToken.
 */
exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  // Optionally log the refresh attempt (avoid logging full tokens in production)
  logger.info(`Refreshing token for a user`);

  const tokens = await authService.refreshToken(refreshToken);

  res.status(200).json({
    success: true,
    data: tokens
  });
});

/**
 * Get the current authenticated user.
 * Assumes that authentication middleware attaches the user to req.user.
 */
exports.getCurrentUser = catchAsync(async (req, res) => {
  const user = req.user; // Provided by the auth middleware
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

  logger.info(`User ${userId} logging out`);
  await authService.logoutUser(userId);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});
