// routes/authRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('../config');
const router = express.Router();

// Helper to wrap async route handlers
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Middleware to protect routes
const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }
});

// Helper to send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  user.password = undefined; // Remove password from the output
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
    const user = await User.create({ email, password, nickname, details });
    sendTokenResponse(user, 201, res);
  } catch (err) {
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
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Please provide an email and password' });
  }
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  user.isOnline = true;
  user.lastActive = Date.now();
  await user.save();
  sendTokenResponse(user, 200, res);
}));

// @route   GET /api/auth/logout
// @desc    Logout user and update status
// @access  Private
router.get('/logout', protect, asyncHandler(async (req, res) => {
  req.user.isOnline = false;
  req.user.lastActive = Date.now();
  await req.user.save();
  res.status(200).json({ success: true, data: {} });
}));

// @route   GET /api/auth/me
// @desc    Get current user data
// @access  Private
router.get('/me', protect, asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
}));

// Global error handler for this router
router.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(400).json({ success: false, error: err.message || 'Server Error' });
});

module.exports = router;
