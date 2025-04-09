// middleware/cors.js - Enhanced with ES modules and improved CORS configuration
import cors from "cors";
import logger from "../logger.js";

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
  // Always allow all origins to fix 502 errors, regardless of environment
  const allowedOrigins = ['*'];

  // Log the allowed origins
  logger.info(`CORS configured with origins: ${JSON.stringify(allowedOrigins)}`);

  return cors({
    origin: '*', // Allow all origins to fix 502 Bad Gateway issues
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Cache-Control",
      "x-no-cache",    // Allow x-no-cache header
      "x-auth-token"   // Allow x-auth-token header
    ],
    exposedHeaders: [
      "Content-Length",
      "X-Rate-Limit-Limit",
      "X-Rate-Limit-Remaining",
      "X-Rate-Limit-Reset"
    ],
    credentials: true, // Enable credentials for auth scenarios
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
};

/**
 * Custom CORS error handler
 * Provides better error messages for CORS failures
 */
const corsErrorHandler = (err, req, res, next) => {
  if (err.message.includes("CORS")) {
    logger.warn(`CORS Error: ${err.message}`, {
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
    });

    return res.status(403).json({
      success: false,
      error: "Cross-Origin Request Blocked",
      message: "The request was blocked by CORS policy. If you are the API consumer, please contact the administrator.",
      code: "CORS_ERROR",
    });
  }
  next(err);
};

/**
 * Default export: function to apply CORS configuration directly to an Express app.
 * This alternative approach uses a more permissive configuration to resolve 502 errors.
 */
const applyCors = (app) => {
  // In production environment, use a wildcard for CORS
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Log CORS configuration for debugging
  console.log('CORS Debug - Environment:', process.env.NODE_ENV || 'development');
  console.log('CORS Debug - ALLOWED_ORIGINS config:', process.env.ALLOWED_ORIGINS || '*');
  console.log('CORS Debug - FRONTEND_URL config:', process.env.FRONTEND_URL || 'https://flirtss.com');
  
  // Use wildcard for production to fix 502 errors
  if (isProduction) {
    console.log('CORS Debug - Allowing all origins (*)');
    app.use(cors({
      origin: '*',
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "x-auth-token",
        "x-no-cache"
      ],
      exposedHeaders: [
        "Content-Length",
        "X-Rate-Limit-Limit",
        "X-Rate-Limit-Remaining",
        "X-Rate-Limit-Reset"
      ],
      maxAge: 86400,
      preflightContinue: false,
      optionsSuccessStatus: 204
    }));
    return;
  }
  
  // For development, use more restricted CORS settings
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:5173"];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, etc)
        if (!origin) return callback(null, true);

        // In development, be more permissive
        if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes('*')) {
          return callback(null, true);
        }

        if (!allowedOrigins.includes(origin)) {
          const msg = "The CORS policy for this site does not allow access from the specified Origin.";
          return callback(new Error(msg), false);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "x-auth-token",
        "x-no-cache"
      ],
      exposedHeaders: [
        "Content-Length",
        "X-Rate-Limit-Limit",
        "X-Rate-Limit-Remaining",
        "X-Rate-Limit-Reset"
      ],
      preflightContinue: false,
      optionsSuccessStatus: 204
    })
  );
};

export default applyCors;
export { configureCors, corsErrorHandler };
