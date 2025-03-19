// middleware/cors.js - Enhanced with ES modules and improved CORS configuration
import cors from 'cors';
import logger from '../logger.js';
import config from '../config.js';

/**
 * CORS configuration middleware
 *
 * This module configures CORS settings based on environment.
 * It allows requests from specified origins, with a more flexible
 * approach for development environments.
 *
 * @returns {Function} Express middleware
 */
const configureCors = () => {
  // In development, allow multiple origins including different localhost ports
  // In production, use specific domains from environment variables
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS
       ? process.env.ALLOWED_ORIGINS.split(',')
       : [process.env.FRONTEND_URL || 'https://yourdomain.com'])
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];

  // Log the allowed origins
  logger.info(`CORS configured with origins: ${JSON.stringify(allowedOrigins)}`);

  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) {
        logger.debug('Request with no origin allowed');
        return callback(null, true);
      }

      // Check if origin is allowed
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        logger.debug(`CORS allowed for origin: ${origin}`);
        return callback(null, true);
      }

      // Log rejected origins for debugging
      logger.warn(`CORS rejected for origin: ${origin}`);
      const msg = 'CORS policy does not allow access from the specified Origin';
      return callback(new Error(msg), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control'
    ],
    exposedHeaders: [
      'Content-Length',
      'X-Rate-Limit-Limit',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset'
    ],
    credentials: true, // Enable credentials for auth scenarios
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
};

/**
 * Custom CORS error handler
 * Provides better error messages for CORS failures
 */
const corsErrorHandler = (err, req, res, next) => {
  if (err.message.includes('CORS')) {
    logger.warn(`CORS Error: ${err.message}`, {
      origin: req.headers.origin,
      method: req.method,
      path: req.path
    });

    return res.status(403).json({
      success: false,
      error: 'Cross-Origin Request Blocked',
      message: 'The request was blocked by CORS policy. If you are the API consumer, please contact the administrator.',
      code: 'CORS_ERROR'
    });
  }
  next(err);
};

export { configureCors, corsErrorHandler };
export default configureCors;
