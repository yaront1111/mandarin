require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/mandarin',
  JWT_SECRET: process.env.JWT_SECRET || 'mandarin-secret-key',
  JWT_EXPIRE: '7d',
  FILE_UPLOAD_PATH: './uploads',
  MAX_FILE_SIZE: 1024 * 1024 * 5, // 5MB
};
