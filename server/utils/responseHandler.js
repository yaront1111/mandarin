/**
 * Utilities for standardized API responses across the application
 * 
 * This module provides a consistent format for all API responses, with
 * additional helper methods for common response patterns.
 * 
 * Standard response formats:
 * - Success: { success: true, data: {...}, message: '...', meta: {...} }
 * - Error: { success: false, error: '...', details: {...} }
 * - Paginated: { success: true, data: [...], pagination: {...} }
 */

import logger from '../logger.js';

// Standard HTTP status codes
export const STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500
};

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 * @param {Object} meta - Additional metadata
 */
export const sendSuccess = (res, data = null, message = null, statusCode = STATUS.OK, meta = null) => {
  const response = {
    success: true
  };
  
  if (message) {
    response.message = message;
  }
  
  if (data !== null && data !== undefined) {
    response.data = data;
  }
  
  if (meta) {
    response.meta = meta;
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Send paginated success response with standardized structure
 * @param {Object} res - Express response object
 * @param {Array} data - Data array
 * @param {Object} pagination - Pagination info with total, page, limit, pages
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code
 * @param {Object} meta - Additional metadata (optional)
 */
export const sendPaginatedSuccess = (res, data = [], pagination = {}, message = null, statusCode = STATUS.OK, meta = null) => {
  const { total = 0, page = 1, limit = 20 } = pagination;
  const pages = Math.ceil(total / limit);
  
  const response = {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages,
      hasMore: page < pages
    },
    count: data.length
  };
  
  if (message) {
    response.message = message;
  }
  
  if (meta) {
    response.meta = meta;
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Send error response with consistent format
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 * @param {number} statusCode - HTTP status code
 * @param {Object} details - Optional error details for debugging
 */
export const sendError = (res, error = 'Something went wrong', statusCode = STATUS.SERVER_ERROR, details = null) => {
  // Log server errors but not client errors
  if (statusCode >= 500) {
    logger.error(`API Error: ${error}`, details || {});
  } else if (statusCode >= 400 && statusCode < 500) {
    logger.warn(`Client Error: ${error}`);
  }

  const response = {
    success: false,
    error
  };

  // Only include details in development/test environment
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send created response (201 status)
 * @param {Object} res - Express response object
 * @param {any} data - Created resource data
 * @param {string} message - Success message
 * @param {Object} meta - Additional metadata
 */
export const sendCreated = (res, data, message = 'Resource created successfully', meta = null) => {
  return sendSuccess(res, data, message, STATUS.CREATED, meta);
};

/**
 * Send no content response (204 status)
 * @param {Object} res - Express response object
 */
export const sendNoContent = (res) => {
  return res.status(STATUS.NO_CONTENT).end();
};

/**
 * Send unauthorized response (401 status)
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 * @param {Object} details - Optional error details
 */
export const sendUnauthorized = (res, error = 'Authentication required', details = null) => {
  return sendError(res, error, STATUS.UNAUTHORIZED, details);
};

/**
 * Send forbidden response (403 status)
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 * @param {Object} details - Optional error details
 */
export const sendForbidden = (res, error = 'Permission denied', details = null) => {
  return sendError(res, error, STATUS.FORBIDDEN, details);
};

/**
 * Send not found response (404 status)
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 * @param {Object} details - Optional error details
 */
export const sendNotFound = (res, error = 'Resource not found', details = null) => {
  return sendError(res, error, STATUS.NOT_FOUND, details);
};

/**
 * Send bad request response (400 status)
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 * @param {Object} details - Optional error details
 */
export const sendBadRequest = (res, error = 'Bad request', details = null) => {
  return sendError(res, error, STATUS.BAD_REQUEST, details);
};

/**
 * Send too many requests response (429 status)
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 * @param {number} retryAfter - Seconds until retry is allowed
 */
export const sendTooManyRequests = (res, error = 'Rate limit exceeded', retryAfter = 60) => {
  res.set('Retry-After', String(retryAfter));
  return sendError(res, error, STATUS.TOO_MANY_REQUESTS);
};

/**
 * Handle validation errors from express-validator
 * @param {Object} res - Express response object
 * @param {Object} validationErrors - Result from validationResult(req)
 */
export const sendValidationError = (res, validationErrors) => {
  const firstError = validationErrors.array()[0];
  return sendError(
    res, 
    firstError.msg,
    STATUS.BAD_REQUEST, 
    validationErrors.array()
  );
};

// Default export for all response utilities
export default {
  STATUS,
  sendSuccess,
  sendPaginatedSuccess,
  sendError,
  sendCreated,
  sendNoContent,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendBadRequest,
  sendTooManyRequests,
  sendValidationError
};