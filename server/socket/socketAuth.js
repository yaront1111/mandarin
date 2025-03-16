// server/socket/socketAuth.js
const jwt = require("jsonwebtoken")
const { User } = require("../models")
const logger = require("../logger")

/**
 * Socket.IO authentication middleware
 * Verifies JWT token and attaches user to socket
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    // Get token from handshake query or auth
    const token =
      socket.handshake.query?.token ||
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1]

    if (!token) {
      logger.warn(`Socket ${socket.id} connection attempt without token`)
      return next(new Error("Authentication token is required"))
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      if (!decoded || !decoded.id) {
        logger.warn(`Socket ${socket.id} provided invalid token`)
        return next(new Error("Invalid authentication token"))
      }

      // Find user
      const user = await User.findById(decoded.id).select("-password")

      if (!user) {
        logger.warn(`Socket ${socket.id} token has valid format but user not found: ${decoded.id}`)
        return next(new Error("User not found"))
      }

      // Check token version to handle revoked tokens
      if (user.version && decoded.version && user.version !== decoded.version) {
        logger.warn(`Socket ${socket.id} token is outdated for user ${user._id}`)
        return next(new Error("Token has been revoked"))
      }

      // Attach user to socket
      socket.user = user

      // Update user's online status
      await User.findByIdAndUpdate(user._id, {
        isOnline: true,
        lastActive: Date.now(),
      })

      logger.info(`Socket ${socket.id} authenticated as user ${user._id}`)

      // Proceed with connection
      next()
    } catch (jwtError) {
      logger.error(`Socket ${socket.id} JWT verification error: ${jwtError.message}`)
      return next(new Error("Invalid authentication token"))
    }
  } catch (error) {
    logger.error(`Socket auth error: ${error.message}`)
    return next(new Error("Authentication error"))
  }
}

module.exports = { socketAuthMiddleware }
