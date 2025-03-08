// /server/src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findByPk(decoded.id);
    if (!user || user.accountStatus !== 'active') {
      throw new Error('Invalid or inactive user');
    }

    req.user = user;
    next();
  } catch (error) {
    error.statusCode = 401;
    next(error);
  }
};
