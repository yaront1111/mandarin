// db.js
const mongoose = require('mongoose');
const config = require('./config');
const logger = require('./logger');

const connectDB = async () => {
  try {
    // Updated connection options without deprecated ones
    // useNewUrlParser and useUnifiedTopology are true by default in newer mongoose versions
    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB Connected: ${mongoose.connection.host}`);
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
