// server/middleware/cors.js
import cors from "cors";
import logger from "../logger.js";

/**
 * CORS configuration middleware factory.
 *
 * In production, only allow domains listed in ALLOWED_ORIGINS (or FRONTEND_URL).
 * In development, allow common localhost ports.
 *
 * @returns {import('cors').CorsOptionsDelegate} the configured CORS middleware
 */
export const configureCors = () => {
  const devOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];

  const prodOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : [process.env.FRONTEND_URL || "https://flirtss.com"];

  const allowedOrigins =
    process.env.NODE_ENV === "production" ? prodOrigins : devOrigins;

  logger.info(`CORS allowed origins: ${JSON.stringify(allowedOrigins)}`);

  return cors({
    origin: (origin, callback) => {
      // allow requests with no origin (e.g. curl, mobile apps)
      if (!origin) {
        logger.debug("CORS: no-origin request allowed");
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        logger.debug(`CORS: allowing origin ${origin}`);
        return callback(null, true);
      }
      
      // Special case: If using the main domain but with varying protocols/subdomains
      const mainDomain = 'flirtss.com';
      if (origin && origin.includes(mainDomain)) {
        logger.debug(`CORS: allowing ${mainDomain} subdomain: ${origin}`);
        return callback(null, true);
      }

      // In development, allow all origins for easier debugging
      if (process.env.NODE_ENV !== "production") {
        logger.debug(`CORS: allowing all origins in development mode: ${origin}`);
        return callback(null, true);
      }

      logger.warn(`CORS: rejecting origin ${origin}`);
      return callback(
        new Error(
          "The CORS policy for this site does not allow access from the specified Origin."
        ),
        false
      );
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Cache-Control",
      "x-no-cache",
      "x-auth-token",
    ],
    exposedHeaders: [
      "Content-Length",
      "X-Rate-Limit-Limit",
      "X-Rate-Limit-Remaining",
      "X-Rate-Limit-Reset",
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 204,
  });
};

/**
 * Error handler to catch CORS failures and return a JSON payload.
 */
export const corsErrorHandler = (err, req, res, next) => {
  if (err.message && err.message.includes("CORS")) {
    logger.warn(`CORS error on ${req.method} ${req.originalUrl}: ${err.message}`);
    return res.status(403).json({
      success: false,
      error: "Cross‑Origin Request Blocked",
      message:
        "The request was blocked by CORS policy. If you're the API consumer, please contact the administrator.",
      code: "CORS_ERROR",
    });
  }
  next(err);
};

/**
 * Default export: the same as configureCors()
 */
export default configureCors;
