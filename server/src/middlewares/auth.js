// /server/src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const logger = require('../utils/logger'); // Optional: Winston logger

// Custom Unauthorized Error for clarity
class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 401;
  }
}

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Authentication token missing or invalid'));
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      logger.error('JWT verification failed:', err);
      return next(new UnauthorizedError('Invalid token'));
    }

    // Check that the token contains an ID
    if (!decoded || !decoded.id) {
      return next(new UnauthorizedError('Invalid token payload'));
    }

    const user = await User.findByPk(decoded.id);
    if (!user || user.accountStatus !== 'active') {
      return next(new UnauthorizedError('Invalid or inactive user'));
    }

    // Attach user data to request (consider using a subset of the user object for security)
    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    error.statusCode = error.statusCode || 401;
    next(error);
  }
};
