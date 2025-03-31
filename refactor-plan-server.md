# Server Code Refactoring Plan

## 1. Create Utility Functions for Common Patterns

### Error Handling Utility

```javascript
// utils/errorHandler.js
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
    const field = Object.keys(err.keyValue)[0];
    return { 
      success: false, 
      error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      status: 400
    };
  }
  
  return {
    success: false,
    error: errorMsg,
    status: err.status || 500
  };
};

/**
 * Centralized route error handler (to replace asyncHandler)
 * @param {Function} routeHandler - Async route handler function
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
```

### Validation Utility

```javascript
// utils/validation.js
import mongoose from 'mongoose';

/**
 * Validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - Whether ID is valid
 */
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
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
 * Express middleware for validating ObjectId parameters
 * @param {string} paramName - Parameter name to validate
 * @returns {Function} - Express middleware
 */
export const validateObjectId = (paramName) => {
  return (req, res, next) => {
    if (!isValidObjectId(req.params[paramName])) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format`
      });
    }
    next();
  };
};
```

## 2. Refactor Route Handlers

### Before:

```javascript
router.get(
  "/:id", 
  protect, 
  asyncHandler(async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, error: "Invalid user ID format" });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      
      // ... more logic ...
      
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (err) {
      logger.error(`Error fetching user: ${err.message}`);
      res.status(400).json({ success: false, error: err.message });
    }
  })
);
```

### After:

```javascript
import { routeErrorHandler, validateObjectId } from '../utils/validation.js';

// User route handler in a separate function for clarity
const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found" });
  }
  
  // ... more logic ...
  
  res.status(200).json({
    success: true,
    data: user
  });
};

// Clean route definition with middleware
router.get(
  "/:id", 
  protect, 
  validateObjectId('id'),
  routeErrorHandler(getUserById, 'getUserById')
);
```

## 3. Standardize Socket Event Handlers

### Create a Socket Handler Factory

```javascript
// utils/socketHandlers.js

/**
 * Create authenticated socket event handler
 * @param {string} eventName - Socket event name
 * @param {Function} handler - Handler function (socket, data) => {}
 * @param {Object} options - Additional options
 * @returns {Function} - Configured event handler
 */
export const createAuthenticatedHandler = (eventName, handler, options = {}) => {
  return (socket, io, userConnections) => {
    socket.on(eventName, async (data) => {
      try {
        // Standard authentication check
        if (!socket.user || !socket.user._id) {
          socket.emit(`${eventName}Error`, { 
            error: 'Authentication required' 
          });
          return;
        }
        
        // Apply rate limiting if configured
        if (options.rateLimit && !checkRateLimit(socket, eventName)) {
          socket.emit(`${eventName}Error`, { 
            error: 'Rate limit exceeded' 
          });
          return;
        }
        
        // Track activity time for inactive socket detection
        socket.lastActivity = Date.now();
        
        // Call actual handler with standardized parameters
        await handler(socket, data, io, userConnections);
      } catch (error) {
        logger.error(`Error in ${eventName} handler: ${error.message}`);
        socket.emit(`${eventName}Error`, { 
          error: 'Internal server error' 
        });
      }
    });
  };
};

// Example usage:
const sendMessageHandler = createAuthenticatedHandler(
  'sendMessage',
  async (socket, data, io, userConnections) => {
    // Handler implementation
  },
  { rateLimit: true }
);
```

## 4. Database Query Helpers

```javascript
// utils/dbHelpers.js

/**
 * Get paginated results from a Mongoose query
 * @param {Object} query - Mongoose query
 * @param {Object} options - Pagination options
 * @returns {Object} - Paginated results with metadata
 */
export const getPaginatedResults = async (query, options = {}) => {
  const page = Number.parseInt(options.page, 10) || 1;
  const limit = Number.parseInt(options.limit, 10) || 20;
  const skip = (page - 1) * limit;
  
  const [results, total] = await Promise.all([
    query.skip(skip).limit(limit),
    query.model.countDocuments(query.getQuery())
  ]);
  
  return {
    data: results,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit)
    }
  };
};

/**
 * Apply user privacy settings to response data
 * @param {Object|Array} userData - User data to process
 * @returns {Object|Array} - Processed data with privacy applied
 */
export const applyPrivacySettings = (userData) => {
  const processUser = (user) => {
    const userObj = user.toObject ? user.toObject() : { ...user };
    
    // Apply privacy settings
    if (userObj.settings?.privacy?.showOnlineStatus === false) {
      userObj.isOnline = false;
    }
    
    // Remove settings from response
    delete userObj.settings;
    
    return userObj;
  };
  
  // Handle both single user and arrays
  if (Array.isArray(userData)) {
    return userData.map(processUser);
  }
  
  return processUser(userData);
};
```

## 5. Cleanup Plan

1. Identify and remove unused exports and functions
2. Standardize error handling using the new utility functions
3. Replace duplicate validation code with centralized validators
4. Refactor socket handlers to use the handler factory pattern
5. Update route handlers to follow the new pattern with middleware
6. Ensure consistent success/error response formats
7. Apply privacy settings consistently using utility functions

This refactoring will reduce code duplication, standardize error handling, and improve overall code maintainability while preserving functionality.