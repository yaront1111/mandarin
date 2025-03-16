// server/socket/socketAuth.js
const jwt = require("jsonwebtoken")
const { User } = require("../models")
const config = require("../config")
const logger = require("../logger")
const mongoose = require("mongoose")

const isTokenExpired = (token) => {
  try {
    const decoded = jwt.decode(token)
    if (!decoded || !decoded.exp) return true
    // Add a 5-second buffer for clock differences
    return decoded.exp < Math.floor(Date.now() / 1000) + 5
  } catch (err) {
    logger.error(`Error checking token expiration: ${err.message}`)
    return true
  }
}

const socketAuthMiddleware = async (socket, next) => {
  try {
    const token =
      socket.handshake.query?.token ||
      (socket.handshake.headers.authorization?.startsWith("Bearer ")
        ? socket.handshake.headers.authorization.substring(7)
        : null)

    if (!token) {
      logger.warn(`Socket authentication failed: No token provided (IP: ${socket.handshake.address})`)
      return next(new Error("Authentication required"))
    }

    if (isTokenExpired(token)) {
      logger.warn(`Socket authentication failed: Token expired (IP: ${socket.handshake.address})`)
      return next(new Error("Token expired"))
    }

    const decoded = jwt.verify(token, config.JWT_SECRET)

    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      logger.warn(`Socket authentication failed: Invalid user ID format (IP: ${socket.handshake.address})`)
      return next(new Error("Invalid user ID"))
    }

    const user = await User.findById(decoded.id)
    if (!user) {
      logger.warn(`Socket authentication failed: User not found for ID ${decoded.id}`)
      return next(new Error("User not found"))
    }

    // Attach user data and timestamps to the socket object
    socket.user = { _id: user._id, nickname: user.nickname }
    socket.authTimestamp = Date.now()
    socket.userId = user._id.toString()

    logger.debug(`Socket ${socket.id} authenticated for user ${user.nickname} (${user._id})`)
    next()
  } catch (err) {
    logger.error(`Socket authentication error: ${err.message}`)
    next(new Error("Authentication failed"))
  }
}

module.exports = { socketAuthMiddleware, isTokenExpired }
