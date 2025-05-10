/**
 * Re-export all utilities for easy importing
 */

import mongoose from "mongoose"
import logger from "../logger.js"

export * from "./errorHandler.js"
export * from "./validation.js"
export * from "./dbHelpers.js"
export * from "./responseHandler.js"
export * from "./idUtils.js" // Export the new ID utilities

/**
 * Safe parse JSON with error handling
 * @param {string} json - JSON string to parse
 * @param {any} defaultValue - Default value if parsing fails
 * @returns {any} - Parsed value or default
 */
export const safeJsonParse = (json, defaultValue = null) => {
  try {
    return json ? JSON.parse(json) : defaultValue
  } catch (error) {
    return defaultValue
  }
}

/**
 * Safely stringify a value to JSON
 * @param {any} value - Value to stringify
 * @param {any} defaultValue - Default value if stringification fails
 * @returns {string} - JSON string or default
 */
export const safeJsonStringify = (value, defaultValue = "{}") => {
  try {
    return JSON.stringify(value)
  } catch (error) {
    return defaultValue
  }
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after delay
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Generate a random string
 * @param {number} length - Length of the string
 * @returns {string} - Random string
 */
export const randomString = (length = 10) => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

/**
 * Mask sensitive data from logs
 * @param {Object} data - Data object
 * @param {Array} sensitiveFields - Fields to mask
 * @returns {Object} - Masked data object
 */
export const maskSensitiveData = (data, sensitiveFields = ["password", "token", "secret"]) => {
  if (!data || typeof data !== "object") return data

  const masked = { ...data }

  sensitiveFields.forEach((field) => {
    if (masked[field]) {
      masked[field] = "********"
    }
  })

  return masked
}

/**
 * Enhanced MongoDB ObjectId validation that checks both format and validity
 * @param {string|Object} id - ID to validate
 * @returns {boolean} - Whether ID is valid
 */
export const isValidObjectId = (id) => {
  if (!id) return false

  // Convert to string if it's an object with toString method
  const idStr = typeof id === "object" && id !== null && typeof id.toString === "function" ? id.toString() : String(id)

  // Check format first - must be 24 hex characters
  if (!/^[0-9a-fA-F]{24}$/.test(idStr)) {
    logger.debug(`ObjectId validation failed - bad format: ${idStr}`)
    return false
  }

  // Then check if Mongoose considers it valid
  const isValid = mongoose.Types.ObjectId.isValid(idStr)
  if (!isValid) {
    logger.debug(`ObjectId validation failed - not valid according to Mongoose: ${idStr}`)
  }

  return isValid
}

/**
 * Helper to safely convert any value to a MongoDB ObjectId
 * @param {any} id - ID to convert
 * @returns {mongoose.Types.ObjectId|null} - Mongoose ObjectId or null if invalid
 */
export const safeObjectId = (id) => {
  try {
    if (!id) return null

    // If already an ObjectId, return it
    if (id instanceof mongoose.Types.ObjectId) return id

    // Convert to string
    const idStr = String(id)

    // Extract a potential ObjectId from string (handle corrupted formats)
    const match = idStr.match(/([0-9a-fA-F]{24})/)
    const cleanId = match ? match[1] : idStr

    // Create and return ObjectId if valid
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      return new mongoose.Types.ObjectId(cleanId)
    }

    return null
  } catch (err) {
    logger.error(`Failed to convert to ObjectId: ${id}`, err)
    return null
  }
}
