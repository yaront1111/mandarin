// src/middlewares/error.js

function errorMiddleware(err, req, res, next) {
  // Log the error with request details for debugging
  console.error(`❌ Error [${req.method} ${req.path}]:`, err);

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Build the response object
  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
    // Include stack trace only in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    // Include any validation errors (e.g., from Joi) if provided
    ...(err.errors && { errors: err.errors })
  };

  res.status(statusCode).json(response);
}

module.exports = errorMiddleware;
