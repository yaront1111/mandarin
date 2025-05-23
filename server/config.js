// config.js - Enhanced with ES modules and improved configuration management
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

// Get directory name in ES modules context
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment-specific .env file
const envFile = `.env.${process.env.NODE_ENV || "development"}`
dotenv.config({ path: path.resolve(process.cwd(), envFile) })

// Fallback to default .env file if environment-specific one doesn't exist
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

// CORS configuration with improved structure
const createCorsOptions = () => {
  // In development, allow all origins including undefined (for same-origin requests)
  const allowedOrigins =
    process.env.NODE_ENV !== "production"
      ? ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"]
      : process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : [process.env.FRONTEND_URL || "https://flirtss.com"]

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl requests)
      if (!origin || process.env.NODE_ENV !== "production") {
        return callback(null, true)
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error("Not allowed by CORS"))
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    maxAge: 86400, // 24 hours CORS cache
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }
}

// Configuration object with enhanced security and defaults
const config = {
  // Server settings
  PORT: Number.parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  API_VERSION: process.env.API_VERSION || "v1",
  APP_NAME: process.env.APP_NAME || "Flirtss",
  APP_URL: process.env.APP_URL || "https://flirtss.com",

  // Email settings
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM || "noreply@flirtss.com",
  APP_DOMAIN: process.env.APP_DOMAIN || "flirtss.com",
  
  // Resend API settings
  RESEND_API_KEY: process.env.RESEND_API_KEY || (process.env.NODE_ENV === "production" ? null : "re_7k4fkJua_N1aYoE2o8yNQvhTeuk32S5Ux"),
  USE_RESEND: process.env.USE_RESEND === "true" || process.env.NODE_ENV === "production",

  // Database settings
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/mandarin",
  MONGODB_OPTIONS: {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    connectTimeoutMS: 30000,
    heartbeatFrequencyMS: 10000,
    maxPoolSize: 20,
    minPoolSize: 5,
    maxIdleTimeMS: 60000,
  },

  // Authentication settings
  JWT_SECRET:
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production"
      ? null // Force error in production if not set
      : "mandarin-dev-secret-key"),
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
  JWT_COOKIE_EXPIRE: Number.parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 30, // 30 days
  REFRESH_TOKEN_EXPIRE: Number.parseInt(process.env.REFRESH_TOKEN_EXPIRE, 10) || 90, // 90 days
  
  // Subscription settings
  DEFAULT_SUBSCRIPTION_DAYS: Number.parseInt(process.env.DEFAULT_SUBSCRIPTION_DAYS, 10) || 365, // 1 year by default
  ENABLE_DEFAULT_SUBSCRIPTION: process.env.ENABLE_DEFAULT_SUBSCRIPTION !== 'false', // true by default

  // File upload settings
  FILE_UPLOAD_PATH: process.env.FILE_UPLOAD_PATH || path.join(__dirname, "uploads"),
  MAX_FILE_SIZE: Number.parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024, // 5MB

  // Redis configuration (optional)
  REDIS_URL: process.env.REDIS_URL || null,

  // CORS settings
  CORS_OPTIONS: createCorsOptions(),

  // Email settings - Using Resend only
  USE_RESEND: true, // Always use Resend
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@flirtss.com',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'Flirtss',
  
  // SMTP settings (when not using Resend)
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: Number.parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_TLS_REJECT_UNAUTHORIZED: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false',

  // App settings
  APP_NAME: process.env.APP_NAME || 'Flirtss',
  APP_DOMAIN: process.env.APP_DOMAIN || 'flirtss.com',
  APP_URL: process.env.APP_URL || process.env.FRONTEND_URL || 'https://flirtss.com',

  // Ensures JWT secret is set in production
  validateConfig() {
    if (this.NODE_ENV === "production" && !this.JWT_SECRET) {
      throw new Error("JWT_SECRET is required in production environment")
    }

    // Create uploads directory if it doesn't exist
    import("fs").then((fs) => {
      if (!fs.existsSync(this.FILE_UPLOAD_PATH)) {
        fs.mkdirSync(this.FILE_UPLOAD_PATH, { recursive: true })
      }
    })

    return this
  },
}

export default config.validateConfig()
