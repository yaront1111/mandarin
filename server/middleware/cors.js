// server/middleware/cors.js
const cors = require('cors');
const logger = require('../logger');

/**
 * CORS configuration middleware
 *
 * This module configures CORS settings based on environment.
 * It allows requests from specified origins, with a more flexible
 * approach for development environments.
 *
 * @returns {Function} Express middleware
 */
module.exports = () => {
  // In development, allow multiple origins including different localhost ports
  // In production, use specific domains from environment variables
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS
       ? process.env.ALLOWED_ORIGINS.split(',')
       : [process.env.FRONTEND_URL || 'https://yourdomain.com'])
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'];

  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) {
        logger.info('Request with no origin allowed');
        return callback(null, true);
      }

      // Check if origin is allowed
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        logger.info(`CORS allowed for origin: ${origin}`);
        return callback(null, true);
      }

      // Log rejected origins for debugging
      logger.warn(`CORS rejected for origin: ${origin}`);
      const msg = 'CORS policy does not allow access from the specified Origin';
      return callback(new Error(msg), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true, // Enable credentials for auth scenarios
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
};
