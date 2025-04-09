// middleware/cors.js - Fixed CORS for 502 Bad Gateway issues
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
 * Custom OPTIONS request handler to handle preflight requests properly
 * This can help fix 502 Bad Gateway issues with preflight requests
 */
const optionsHandler = (req, res) => {
  // Set necessary CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-auth-token, x-no-cache, Cache-Control');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Respond with 204 No Content for OPTIONS requests
  res.status(204).end();
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
 * This approach uses a very permissive configuration to resolve 502 errors.
 */
const applyCors = (app) => {
  // Log CORS configuration
  console.log('CORS Debug - Environment:', process.env.NODE_ENV || 'development');
  console.log('CORS Debug - ALLOWED_ORIGINS config:', process.env.ALLOWED_ORIGINS || '*');
  console.log('CORS Debug - FRONTEND_URL config:', process.env.FRONTEND_URL || 'https://flirtss.com');
  
  // First, handle OPTIONS requests directly (fixes many CORS preflight issues)
  app.options('*', optionsHandler);
  
  // Apply CORS middleware with permissive settings
  console.log('CORS Debug - Using universal permissive CORS settings');
  app.use(cors({
    origin: '*', // Allow any origin
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With", 
      "Content-Type",
      "Accept",
      "Authorization",
      "x-auth-token",
      "x-no-cache",
      "Cache-Control"
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
  
  // Add manual CORS headers on every response as a backup
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-auth-token, x-no-cache, Cache-Control');
    next();
  });
};

export default applyCors;
export { configureCors, corsErrorHandler, optionsHandler };
