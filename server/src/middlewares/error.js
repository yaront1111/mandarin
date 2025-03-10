// src/middlewares/error.js
const logger = require('../utils/logger'); // Ensure your logger is configured appropriately

function errorMiddleware(err, req, res, next) {
  // Log the error along with key request details
  logger.error(`Error [${req.method} ${req.path}]: ${err.message}`, {
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
    stack: err.stack,
    error: err,
  });

  // Determine the status code; default to 500 (Internal Server Error)
  const statusCode = err.statusCode || 500;

  // Build a consistent error response
  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    ...(err.errors && { errors: err.errors })
  };

  res.status(statusCode).json(response);
}

module.exports = errorMiddleware;
