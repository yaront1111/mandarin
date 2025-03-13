// routes/authRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('../config');
const logger = require('../logger');
const router = express.Router();

// Helper to wrap async route handlers
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Middleware to protect routes
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Log headers for debugging
  logger.debug(`Auth request headers: ${JSON.stringify(req.headers)}`);

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    logger.debug(`Token extracted from Authorization header: ${token ? token.substring(0, 15) + '...' : 'undefined'}`);
  }
  // Alternative check for token in cookies if using credentials
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
    logger.debug(`Token extracted from cookies: ${token.substring(0, 15)}...`);
  }

  if (!token) {
    logger.warn(`Authentication failed: No token provided (IP: ${req.ip})`);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route - no token provided'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET);
    logger.debug(`Token verified for user ID: ${decoded.id}`);

    // Get user from database
    const user = await User.findById(decoded.id);

    if (!user) {
      logger.warn(`Authentication failed: User not found for ID ${decoded.id}`);
      return res.status(401).json({
        success: false,
        error: 'User not found for this token'
      });
    }

    // Update last active timestamp
    user.lastActive = Date.now();
    await user.save();

    // Attach user to request object
    req.user = user;
    next();
  } catch (err) {
    logger.error(`Token verification error: ${err.message}`);

    // Check if token expired
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired, please login again'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }
});

// Helper to send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  user.password = undefined; // Remove password from the output

  logger.debug(`Generated token for user ${user._id}: ${token.substring(0, 15)}...`);

  res.status(statusCode).json({
    success: true,
    token,
    data: user
  });
};

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', asyncHandler(async (req, res, next) => {
  try {
    const { email, password, nickname, details } = req.body;

    logger.info(`New user registration attempt: ${email}`);

    // Validate input data
    if (!email || !password || !nickname) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email, password, and nickname'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { nickname }] });
    if (existingUser) {
      const field = existingUser.email === email ? 'Email' : 'Nickname';
      logger.warn(`Registration failed: ${field} already exists (${email})`);
      return res.status(400).json({
        success: false,
        error: `${field} already exists`
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      nickname,
      details,
      isOnline: true,
      lastActive: Date.now()
    });

    logger.info(`User registered successfully: ${user._id} (${email})`);

    sendTokenResponse(user, 201, res);
  } catch (err) {
    logger.error(`Registration error: ${err.message}`);

    // Handle duplicate key errors (error code 11000)
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }
    next(err); // Pass other errors to the global error handler
  }
}));

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  logger.info(`Login attempt: ${email}`);

  if (!email || !password) {
    logger.warn(`Login failed: Missing email or password (${email || 'no email provided'})`);
    return res.status(400).json({
      success: false,
      error: 'Please provide an email and password'
    });
  }

  // Find user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    logger.warn(`Login failed: User not found (${email})`);
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  // Check password
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    logger.warn(`Login failed: Invalid password (${email})`);
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  // Update user status
  user.isOnline = true;
  user.lastActive = Date.now();
  await user.save();

  logger.info(`User logged in successfully: ${user._id} (${email})`);

  sendTokenResponse(user, 200, res);
}));

// @route   POST /api/auth/logout (changed from GET to POST)
// @desc    Logout user and update status
// @access  Private
router.post('/logout', protect, asyncHandler(async (req, res) => {
  logger.info(`Logout: User ${req.user._id} (${req.user.email})`);

  // Update user status
  req.user.isOnline = false;
  req.user.lastActive = Date.now();
  await req.user.save();

  res.status(200).json({ success: true, data: {} });
}));

// Keep old GET endpoint for backward compatibility temporarily
router.get('/logout', protect, asyncHandler(async (req, res) => {
  logger.info(`Logout (GET): User ${req.user._id} (${req.user.email})`);

  req.user.isOnline = false;
  req.user.lastActive = Date.now();
  await req.user.save();

  res.status(200).json({
    success: true,
    data: {},
    message: 'Note: Using GET for logout is deprecated, please use POST /api/auth/logout instead'
  });
}));

// @route   GET /api/auth/me
// @desc    Get current user data
// @access  Private
router.get('/me', protect, asyncHandler(async (req, res) => {
  logger.debug(`Get user profile: ${req.user._id}`);

  // Get fresh user data
  const user = await User.findById(req.user._id);

  if (!user) {
    logger.error(`User not found for ID ${req.user._id} (user was deleted?)`);
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  res.status(200).json({ success: true, data: user });
}));

// @route   GET /api/auth/test-connection
// @desc    Test API connection
// @access  Public
router.get('/test-connection', (req, res) => {
  logger.debug(`API connection test from ${req.ip}`);

  res.status(200).json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh authentication token
// @access  Public (with token)
router.post('/refresh-token', asyncHandler(async (req, res) => {
  let token;

  // Check for token in request body, headers, or cookies
  if (req.body.token) {
    token = req.body.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    logger.warn(`Token refresh failed: No token provided (IP: ${req.ip})`);
    return res.status(400).json({
      success: false,
      error: 'Please provide a token'
    });
  }

  try {
    // Verify and decode token
    const decoded = jwt.verify(token, config.JWT_SECRET, { ignoreExpiration: true });

    // Find user
    const user = await User.findById(decoded.id);

    if (!user) {
      logger.warn(`Token refresh failed: User not found for ID ${decoded.id}`);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate new token
    const newToken = user.getSignedJwtToken();

    logger.info(`Token refreshed for user ${user._id}`);

    res.status(200).json({
      success: true,
      token: newToken
    });
  } catch (err) {
    logger.error(`Token refresh error: ${err.message}`);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
}));

// Global error handler for this router
router.use((err, req, res, next) => {
  logger.error(`Auth error: ${err.message}\n${err.stack}`);

  res.status(500).json({
    success: false,
    error: err.message || 'Server Error'
  });
});

module.exports = router;
