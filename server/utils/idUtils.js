/**
 * idUtils.js - Standardized user ID handling utilities
 * 
 * This file provides a comprehensive set of utilities for handling MongoDB ObjectIds
 * and user IDs consistently throughout the application.
 */

import mongoose from 'mongoose';
import logger from '../logger.js';

const { Types } = mongoose;
const { ObjectId } = Types;

/**
 * Convert any ID format to a string consistently
 * @param {any} id - ID in any format (ObjectId, string, etc.)
 * @returns {string|null} - String ID or null if invalid/empty
 */
export function normalizeIdToString(id) {
  if (!id) return null;
  
  // Handle different input types
  if (typeof id === 'string') return id;
  if (id instanceof ObjectId) return id.toString();
  if (typeof id === 'object' && id !== null) {
    if (id._id) return normalizeIdToString(id._id);
    if (id.id) return normalizeIdToString(id.id);
    if (id.userId) return normalizeIdToString(id.userId);
    if (id.toString) return id.toString();
  }
  
  // Last resort - try to stringify
  try {
    return String(id);
  } catch (err) {
    logger.error(`Failed to normalize ID to string: ${id}`);
    return null;
  }
}

/**
 * Convert any ID format to a valid MongoDB ObjectId
 * @param {any} id - ID in any format
 * @returns {ObjectId|null} - MongoDB ObjectId or null if invalid/empty
 */
export function normalizeIdToObjectId(id) {
  if (!id) return null;
  
  // Already an ObjectId
  if (id instanceof ObjectId) return id;
  
  // Extract from object
  if (typeof id === 'object' && id !== null) {
    if (id._id) return normalizeIdToObjectId(id._id);
    if (id.id) return normalizeIdToObjectId(id.id);
    if (id.userId) return normalizeIdToObjectId(id.userId);
  }
  
  // Convert string to ObjectId
  const idStr = normalizeIdToString(id);
  if (!idStr) return null;
  
  try {
    if (ObjectId.isValid(idStr)) {
      return new ObjectId(idStr);
    }
  } catch (err) {
    logger.error(`Failed to convert to ObjectId: ${idStr}`, err);
  }
  
  return null;
}

/**
 * Check if two IDs (in any format) refer to the same entity
 * @param {any} id1 - First ID
 * @param {any} id2 - Second ID
 * @returns {boolean} - True if IDs refer to the same entity
 */
export function areIdsEqual(id1, id2) {
  const str1 = normalizeIdToString(id1);
  const str2 = normalizeIdToString(id2);
  return Boolean(str1 && str2 && str1 === str2);
}

/**
 * Validate if an ID is a valid MongoDB ObjectId
 * @param {any} id - ID to validate
 * @returns {boolean} - True if valid MongoDB ObjectId
 */
export function isValidId(id) {
  if (!id) return false;
  
  const idStr = normalizeIdToString(id);
  if (!idStr) return false;
  
  return ObjectId.isValid(idStr);
}

/**
 * Extract user ID from a request object in a standardized way
 * @param {Object} req - Express request object
 * @returns {ObjectId|null} - User's ObjectId or null
 */
export function getUserIdFromRequest(req) {
  if (!req || !req.user) return null;
  
  // Try to get ID from standard locations
  const idFromUser = req.user._id || req.user.id || req.user.userId;
  if (idFromUser) return normalizeIdToObjectId(idFromUser);
  
  return null;
}

/**
 * Extract user ID from a token payload consistently
 * @param {Object} decoded - Decoded JWT token
 * @returns {string|null} - User ID string or null
 */
export function extractUserIdFromToken(decoded) {
  if (!decoded) return null;
  
  // Check all possible locations in order of preference
  const userId = decoded._id || decoded.id || decoded.userId || 
                (decoded.user && (decoded.user._id || decoded.user.id || decoded.user.userId));
  
  return normalizeIdToString(userId);
}

/**
 * Create a standardized user object with consistent ID fields
 * @param {Object} user - User document
 * @returns {Object} - User object with standardized ID fields
 */
export function createStandardUserObject(user) {
  if (!user) return null;
  
  // Extract and normalize the ID
  const idString = normalizeIdToString(user);
  if (!idString) return null;
  
  // Start with a clean object or user's own data
  const standardUser = typeof user.toObject === 'function' 
    ? user.toObject() 
    : (typeof user === 'object' ? { ...user } : {});
  
  // Ensure all ID fields are consistently set
  standardUser._id = idString;
  standardUser.id = idString;
  standardUser.userId = idString;
  
  return standardUser;
}