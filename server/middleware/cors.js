// server/middleware/cors.js
const cors = require('cors');

/**
 * CORS configuration middleware
 *
 * This module configures CORS settings based on environment.
 * In development, it allows requests from localhost:3000
 * In production, it allows requests from your production domain
 *
 * @returns {Function} Express middleware
 */
module.exports = () => {
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'https://yourdomain.com']
    : ['http://localhost:3000'];

  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'CORS policy does not allow access from the specified Origin';
        return callback(new Error(msg), false);
      }

      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false, // Set to true if using cookies/sessions
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
};
