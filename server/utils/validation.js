/**
 * Utilities for validating input data across the application
 */
import mongoose from 'mongoose';
import { createBadRequestError } from './errorHandler.js';

/**
 * Validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - Whether ID is valid
 */
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validate and format a MongoDB ObjectId
 * @param {string} id - ID to validate
 * @param {string} errorMessage - Custom error message
 * @returns {string} - Validated ID
 * @throws {Error} - If ID is invalid
 */
export const validateObjectId = (id, errorMessage = 'Invalid ID format') => {
  if (!isValidObjectId(id)) {
    throw createBadRequestError(errorMessage);
  }
  return id;
};

/**
 * Express middleware for validating ObjectId parameters
 * @param {string} paramName - Parameter name to validate
 * @param {string} errorMessage - Custom error message
 * @returns {Function} - Express middleware
 */
export const validateIdParam = (paramName = 'id', errorMessage) => {
  return (req, res, next) => {
    try {
      const customError = errorMessage || `Invalid ${paramName} format`;
      const id = req.params[paramName];
      
      if (!id) {
        throw createBadRequestError(`Missing required parameter: ${paramName}`);
      }
      
      if (!isValidObjectId(id)) {
        throw createBadRequestError(customError);
      }
      
      next();
    } catch (error) {
      res.status(error.status || 400).json({
        success: false,
        error: error.message
      });
    }
  };
};

/**
 * Validate request parameters
 * @param {Object} req - Express request object
 * @param {Array} params - Array of required param names
 * @returns {Object} - Validation result with isValid and error
 */
export const validateRequestParams = (req, params) => {
  const missing = params.filter(param => !req.params[param]);
  if (missing.length > 0) {
    return {
      isValid: false,
      error: `Missing required parameters: ${missing.join(', ')}`
    };
  }
  
  // Validate ObjectIds
  const invalidIds = params.filter(param => {
    return req.params[param] && !isValidObjectId(req.params[param]);
  });
  
  if (invalidIds.length > 0) {
    return {
      isValid: false,
      error: `Invalid format for IDs: ${invalidIds.join(', ')}`
    };
  }
  
  return { isValid: true };
};

/**
 * Validate request body
 * @param {Object} req - Express request object
 * @param {Array} fields - Array of required field names
 * @returns {Object} - Validation result with isValid and error
 */
export const validateRequestBody = (req, fields) => {
  if (!req.body) {
    return {
      isValid: false,
      error: 'Request body is required'
    };
  }
  
  const missing = fields.filter(field => req.body[field] === undefined);
  if (missing.length > 0) {
    return {
      isValid: false,
      error: `Missing required fields: ${missing.join(', ')}`
    };
  }
  
  return { isValid: true };
};

/**
 * Express middleware for validating request body
 * @param {Array} requiredFields - Required field names
 * @returns {Function} - Express middleware
 */
export const validateBody = (requiredFields = []) => {
  return (req, res, next) => {
    const validation = validateRequestBody(req, requiredFields);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }
    
    next();
  };
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
export const isValidEmail = (email) => {
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {Object} - Validation result with isValid and error
 */
export const validatePassword = (password, options = {}) => {
  const {
    minLength = 8,
    requireLowercase = true,
    requireUppercase = true,
    requireNumber = true,
    requireSpecial = false
  } = options;
  
  if (!password) {
    return {
      isValid: false,
      error: 'Password is required'
    };
  }
  
  if (password.length < minLength) {
    return {
      isValid: false,
      error: `Password must be at least ${minLength} characters`
    };
  }
  
  if (requireLowercase && !/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one lowercase letter'
    };
  }
  
  if (requireUppercase && !/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one uppercase letter'
    };
  }
  
  if (requireNumber && !/\d/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one number'
    };
  }
  
  if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one special character'
    };
  }
  
  return { isValid: true };
};