require('dotenv').config();
const path = require('path'); // Add path import as it's used below

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/mandarin',
  JWT_SECRET: process.env.JWT_SECRET || 'mandarin-secret-key',
  JWT_EXPIRE: '7d',
  JWT_COOKIE_EXPIRE: 30, // 30 days for cookie expiration
  REFRESH_TOKEN_EXPIRE: 90, // 90 days for refresh token
  FILE_UPLOAD_PATH: process.env.FILE_UPLOAD_PATH || path.join(__dirname, 'uploads'),
  MAX_FILE_SIZE: 1024 * 1024 * 5, // 5MB
};
