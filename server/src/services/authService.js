const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const config = require('../config');

function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
}

exports.registerUser = async (userData) => {
  const existing = await User.findOne({ where: { email: userData.email } });
  if (existing) {
    const err = new Error('Email already in use');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.create(userData);
  return { id: user.id, email: user.email };
};

exports.loginUser = async (email, password) => {
  const user = await User.findOne({ where: { email } });
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

  // Save refresh token somewhere (DB, redis, etc.) if needed
  // For a simple approach, you can skip storing and just rely on JWT.

  return {
    user,
    token,
    refreshToken
  };
};

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

exports.logoutUser = async (userId) => {
  // Optionally invalidate refresh tokens in DB or cache
  // For simplicity, do nothing or remove token from a store
  return true;
};
