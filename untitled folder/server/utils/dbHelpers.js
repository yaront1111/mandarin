/**
 * Database helper utilities for common operations
 */
import mongoose from 'mongoose';
import { createNotFoundError } from './errorHandler.js';

/**
 * Get paginated results from a Mongoose query
 * @param {Object} query - Mongoose query object
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} - Paginated results with metadata
 */
export const getPaginatedResults = async (query, options = {}) => {
  const page = Number.parseInt(options.page, 10) || 1;
  const limit = Number.parseInt(options.limit, 10) || 20;
  const skip = (page - 1) * limit;
  
  // Clone the query to use for count
  const countQuery = query.model.find().merge(query);
  
  // Execute the queries in parallel
  const [results, total] = await Promise.all([
    query.skip(skip).limit(limit).exec(),
    countQuery.countDocuments()
  ]);
  
  return {
    data: results,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      hasMore: page < Math.ceil(total / limit)
    }
  };
};

/**
 * Find document by ID with error handling
 * @param {Model} model - Mongoose model
 * @param {string} id - Document ID
 * @param {Object} options - Query options
 * @returns {Promise<Document>} - Found document
 * @throws {Error} - If document not found
 */
export const findByIdOrThrow = async (model, id, options = {}) => {
  const { select, populate, lean = false } = options;
  
  let query = model.findById(id);
  
  if (select) {
    query = query.select(select);
  }
  
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach(field => {
        query = query.populate(field);
      });
    } else {
      query = query.populate(populate);
    }
  }
  
  if (lean) {
    query = query.lean();
  }
  
  const doc = await query.exec();
  
  if (!doc) {
    const modelName = model.modelName || 'Document';
    throw createNotFoundError(`${modelName} not found`);
  }
  
  return doc;
};

/**
 * Apply user privacy settings to user data
 * @param {Object|Array} userData - User data to process
 * @returns {Object|Array} - Processed data with privacy applied
 */
export const applyPrivacySettings = (userData) => {
  const processUser = (user) => {
    // Skip if no user data
    if (!user) return null;
    
    // Convert to plain object if it's a Mongoose document
    const userObj = user.toObject ? user.toObject() : { ...user };
    
    // Apply privacy settings
    if (userObj.settings?.privacy?.showOnlineStatus === false) {
      userObj.isOnline = false;
    }
    
    // Apply read receipts privacy setting
    if (userObj.settings?.privacy?.showReadReceipts === false) {
      if (userObj.lastRead) {
        delete userObj.lastRead;
      }
    }
    
    // Apply last seen privacy setting
    if (userObj.settings?.privacy?.showLastSeen === false) {
      if (userObj.lastActive) {
        delete userObj.lastActive;
      }
    }
    
    // Remove settings from response to prevent leaking user settings
    delete userObj.settings;
    
    return userObj;
  };
  
  // Handle both single user and arrays
  if (Array.isArray(userData)) {
    return userData.map(user => processUser(user)).filter(Boolean);
  }
  
  return processUser(userData);
};

/**
 * Create standard query options from request query params
 * @param {Object} reqQuery - Express request query object
 * @returns {Object} - Standardized query options
 */
export const createQueryOptions = (reqQuery) => {
  const options = {
    page: Number.parseInt(reqQuery.page, 10) || 1,
    limit: Number.parseInt(reqQuery.limit, 10) || 20,
    sort: reqQuery.sort || '-createdAt',
    select: reqQuery.select || '',
    lean: reqQuery.lean !== 'false'
  };
  
  // Handle populate parameter
  if (reqQuery.populate) {
    try {
      // Check if it's a JSON string
      if (reqQuery.populate.startsWith('[') || reqQuery.populate.startsWith('{')) {
        options.populate = JSON.parse(reqQuery.populate);
      } else {
        // Comma-separated field names
        options.populate = reqQuery.populate.split(',');
      }
    } catch (error) {
      // If parsing fails, use as is
      options.populate = reqQuery.populate;
    }
  }
  
  return options;
};

/**
 * Create standard filter object from request query params
 * @param {Object} reqQuery - Express request query object
 * @param {Array} allowedFields - Fields that can be used for filtering
 * @returns {Object} - MongoDB filter object
 */
export const createFilterObject = (reqQuery, allowedFields = []) => {
  const filter = {};
  
  // Copy query
  const queryObj = { ...reqQuery };
  
  // Remove special fields
  const excludedFields = ['page', 'limit', 'sort', 'select', 'populate', 'lean'];
  excludedFields.forEach(field => delete queryObj[field]);
  
  // Filter only allowed fields if specified
  if (allowedFields.length > 0) {
    Object.keys(queryObj).forEach(key => {
      if (!allowedFields.includes(key)) {
        delete queryObj[key];
      }
    });
  }
  
  // Handle range operators
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, match => `$${match}`);
  
  return JSON.parse(queryStr);
};