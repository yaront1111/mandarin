// src/app.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const path = require('path'); // Add this import at the top

const config = require('./config');
const errorMiddleware = require('./middlewares/error');
const routes = require('./routes');
const logger = require('./utils/logger'); // Winston logger

const app = express();

// Security headers
app.use(helmet({
  // Example advanced CSP config
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "*.amazonaws.com"]
    }
  },
  referrerPolicy: { policy: 'no-referrer-when-downgrade' }
}));

// CORS
app.use(cors({
  origin: config.clientUrl,
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gzip compression
app.use(compression());

// Request logging (Morgan) - or replace with Winston's express middleware
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Example: Rate limiting specifically for login/register endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many login attempts, please try again later'
});
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sex Dating API',
      version: '1.0.0',
      description: 'API documentation for the sex dating platform'
    },
    servers: [
      { url: `http://localhost:${config.port}`, description: 'Development server' }
    ]
  },
  apis: ['./src/routes/*.js'] // Where to look for OpenAPI docs in JSDoc
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Mount main routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Global error handler
app.use(errorMiddleware);

module.exports = app;
