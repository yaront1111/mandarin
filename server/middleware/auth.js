const jwt = require("jsonwebtoken")
const { User } = require("../models")
const config = require("../config")
const logger = require("../logger")

// Generate JWT token
const generateToken = (payload, expiresIn = config.JWT_EXPIRE) => {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn })
}

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET)
  } catch (error) {
    logger.debug(`Token verification failed: ${error.message}`)
    return null
  }
}

// Verify socket token
const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET)
  } catch (error) {
    logger.debug(`Socket token verification failed: ${error.message}`)
    return null
  }
}

// Middleware to protect routes
const protect = (req, res, next) => {
  let token

  // Get token from header or cookie
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Not authorized to access this route",
    })
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET)

    // Find user
    User.findById(decoded.id)
      .then((user) => {
        if (!user) {
          return res.status(401).json({
            success: false,
            error: "User not found",
          })
        }

        // Set user in request
        req.user = user
        next()
      })
      .catch((err) => {
        logger.error(`Auth error: ${err.message}`)
        res.status(500).json({
          success: false,
          error: "Server error",
        })
      })
  } catch (err) {
    logger.error(`Token verification error: ${err.message}`)
    res.status(401).json({
      success: false,
      error: "Not authorized to access this route",
    })
  }
}

// Middleware to restrict access by role
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action",
      })
    }
    next()
  }
}

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = {
  generateToken,
  verifyToken,
  verifySocketToken,
  protect,
  restrictTo,
  asyncHandler,
}
