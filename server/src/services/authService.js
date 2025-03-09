// server/src/services/authService.js

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const config = require('../config');

/**
 * Generate a JWT access token
 * @param {Object} payload - Payload to sign (e.g. { id: user.id })
 * @returns {string} - JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/**
 * Generate a JWT refresh token
 * @param {Object} payload - Payload to sign
 * @returns {string} - JWT refresh token
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
}

/**
 * Registers a new user.
 * Checks if email is already used; if not, creates the user.
 */
exports.registerUser = async (userData) => {
  const existing = await User.findOne({ where: { email: userData.email } });
  if (existing) {
    const err = new Error('Email already in use');
    err.statusCode = 400;
    throw err;
  }

  // Create user (password is hashed via model hooks)
  const user = await User.create(userData);
  // Return only non-sensitive info
  return { id: user.id, email: user.email };
};

/**
 * Logs in a user.
 * Uses the "withPassword" scope so that the password field is included,
 * then compares the provided password with the stored hash.
 */
exports.loginUser = async (email, password) => {
  // Fetch user with password using named scope 'withPassword'
  const user = await User.scope('withPassword').findOne({ where: { email } });
  if (!user) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }

  if (user.accountStatus !== 'active') {
    const err = new Error('User is banned or inactive');
    err.statusCode = 403;
    throw err;
  }

  const token = generateToken({ id: user.id });
  const refreshToken = generateRefreshToken({ id: user.id });

  // Optionally, save the refresh token to a database or cache

  // Remove password before returning user data (the default toJSON will handle this)
  return {
    user,
    token,
    refreshToken
  };
};

/**
 * Refreshes the JWT tokens.
 * Verifies the provided refresh token and, if valid, returns new tokens.
 */
exports.refreshToken = async (oldRefreshToken) => {
  try {
    const decoded = jwt.verify(oldRefreshToken, config.jwtRefreshSecret);
    const user = await User.findByPk(decoded.id);
    if (!user || user.accountStatus !== 'active') {
      throw new Error('Invalid user');
    }

    const newToken = generateToken({ id: user.id });
    const newRefreshToken = generateRefreshToken({ id: user.id });

    return { token: newToken, refreshToken: newRefreshToken };
  } catch (error) {
    const err = new Error('Invalid refresh token');
    err.statusCode = 401;
    throw err;
  }
};

/**
 * Logs out a user.
 * Optionally, invalidate refresh tokens in a store.
 */
exports.logoutUser = async (userId) => {
  // For a simple implementation, nothing is done.
  // In production, you may want to invalidate the refresh token in your DB/cache.
  return true;
};
