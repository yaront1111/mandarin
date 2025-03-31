/**
 * Utilities for standardized API responses
 */

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message
  };
  
  if (data !== null && data !== undefined) {
    response.data = data;
  }
  
  res.status(statusCode).json(response);
};

/**
 * Send paginated success response
 * @param {Object} res - Express response object
 * @param {Object} result - Result with data and pagination
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
export const sendPaginatedSuccess = (res, result, message = 'Success', statusCode = 200) => {
  const { data, pagination } = result;
  
  const response = {
    success: true,
    message,
    data,
    pagination,
    count: data.length,
    total: pagination.total,
    page: pagination.page,
    pages: pagination.pages
  };
  
  res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 * @param {number} statusCode - HTTP status code
 */
export const sendError = (res, error = 'Something went wrong', statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    error
  });
};

/**
 * Send created response
 * @param {Object} res - Express response object
 * @param {any} data - Created resource data
 * @param {string} message - Success message
 */
export const sendCreated = (res, data, message = 'Resource created successfully') => {
  sendSuccess(res, data, message, 201);
};

/**
 * Send no content response
 * @param {Object} res - Express response object
 */
export const sendNoContent = (res) => {
  res.status(204).end();
};

/**
 * Send unauthorized response
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 */
export const sendUnauthorized = (res, error = 'Unauthorized') => {
  sendError(res, error, 401);
};

/**
 * Send forbidden response
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 */
export const sendForbidden = (res, error = 'Forbidden') => {
  sendError(res, error, 403);
};

/**
 * Send not found response
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 */
export const sendNotFound = (res, error = 'Resource not found') => {
  sendError(res, error, 404);
};

/**
 * Send bad request response
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 */
export const sendBadRequest = (res, error = 'Bad request') => {
  sendError(res, error, 400);
};