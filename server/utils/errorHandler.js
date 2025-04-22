// server/utils/errorHandler.js

import logger from '../logger.js'

const log = logger.child({ component: 'ErrorHandler' })

/**
 * Generic HTTP error with status, optional code and details.
 */
export class HTTPError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string} [code]
   * @param {any} [details]
   */
  constructor(message, status = 500, code = null, details = null) {
    super(message)
    this.name = this.constructor.name
    this.status = status
    if (code) this.code = code
    if (details) this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Shorthand factories for common HTTP errors.
 */
export const BadRequestError = (message = 'Bad request') =>
  new HTTPError(message, 400)
export const UnauthorizedError = (message = 'Unauthorized') =>
  new HTTPError(message, 401)
export const ForbiddenError = (message = 'Forbidden') =>
  new HTTPError(message, 403)
export const NotFoundError = (resource = 'Resource') =>
  new HTTPError(`${resource} not found`, 404)

// Add alias exports to maintain backward compatibility
export const createBadRequestError = BadRequestError;
export const createNotFoundError = NotFoundError;
export const createUnauthorizedError = UnauthorizedError;
export const createForbiddenError = ForbiddenError;

/**
 * Wrap async route handlers to forward errors to Express.
 * @param {Function} fn Async route handler
 */
export const catchAsync = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

/**
 * Central Express error‐handling middleware.
 */
export function errorMiddleware(err, req, res, next) {
  let status = err.status || 500
  let message = err.message || 'Internal Server Error'

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Field'
    status = 400
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
  }
  // Mongoose validation
  else if (err.name === 'ValidationError') {
    status = 400
    message =
      Object.values(err.errors || {})
        .map(e => e.message)
        .join(', ') || 'Validation error'
  }
  // Mongoose cast errors (invalid ObjectId, etc.)
  else if (err.name === 'CastError') {
    status = 400
    message = `Invalid ${err.path}`
  }
  // JWT errors
  else if (err.name === 'JsonWebTokenError') {
    status = 401
    message = 'Invalid token'
  } else if (err.name === 'TokenExpiredError') {
    status = 401
    message = 'Token expired'
  }

  // Log full error
  log.error({ err, path: req.path, method: req.method }, message)

  // Respond
  res
    .status(status)
    .json({
      success: false,
      error: message,
      ...(err.code && { code: err.code }),
    })
}
