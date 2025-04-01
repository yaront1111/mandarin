/**
 * Utilities for standardized error handling across the application
 */
import logger from '../logger.js';

/**
 * Standard error response formatter
 * @param {Error} err - Error object
 * @param {string} context - Context where error occurred
 * @returns {Object} - Formatted error response
 */
export const formatErrorResponse = (err, context) => {
  const errorMsg = err.message || "An error occurred";
  logger.error(`Error in ${context}: ${errorMsg}`);
  
  // Handle specific error types
  if (err.code === 11000) {
    // MongoDB duplicate key error
    const field = Object.keys(err.keyValue || {})[0] || 'Field';
    return { 
      success: false, 
      error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      status: 400
    };
  }
  
  // Handle validation errors (from MongoDB/Mongoose)
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map(e => e.message).join(', ');
    return {
      success: false,
      error: errors || 'Validation error',
      status: 400
    };
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return {
      success: false,
      error: 'Invalid token',
      status: 401
    };
  }
  
  if (err.name === 'TokenExpiredError') {
    return {
      success: false,
      error: 'Token expired',
      status: 401
    };
  }
  
  // Default error response
  return {
    success: false,
    error: errorMsg,
    status: err.status || 500
  };
};

/**
 * Centralized route error handler for route handlers
 * @param {Function} routeHandler - Async route handler function
 * @param {string} context - Context name for logging
 * @returns {Function} - Express middleware
 */
export const routeErrorHandler = (routeHandler, context) => {
  return async (req, res, next) => {
    try {
      await routeHandler(req, res, next);
    } catch (err) {
      const errorResponse = formatErrorResponse(err, context);
      res.status(errorResponse.status).json({
        success: false,
        error: errorResponse.error
      });
    }
  };
};

/**
 * Create an error with HTTP status code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {Error} - Error with status code
 */
export const createError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.status = statusCode;
  return error;
};

/**
 * Not found error creator
 * @param {string} resource - Resource that wasn't found
 * @returns {Error} - Error with 404 status
 */
export const createNotFoundError = (resource = 'Resource') => {
  return createError(`${resource} not found`, 404);
};

/**
 * Unauthorized error creator
 * @param {string} message - Error message
 * @returns {Error} - Error with 401 status
 */
export const createUnauthorizedError = (message = 'Unauthorized') => {
  return createError(message, 401);
};

/**
 * Forbidden error creator
 * @param {string} message - Error message
 * @returns {Error} - Error with 403 status
 */
export const createForbiddenError = (message = 'Forbidden') => {
  return createError(message, 403);
};

/**
 * Bad request error creator
 * @param {string} message - Error message
 * @returns {Error} - Error with 400 status
 */
export const createBadRequestError = (message = 'Bad request') => {
  return createError(message, 400);
};