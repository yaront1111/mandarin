const express = require("express")
const router = express.Router()
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { check, validationResult } = require("express-validator")
const { User } = require("../models")
const { protect, generateToken, asyncHandler } = require("../middleware/auth")
const config = require("../config")
const logger = require("../logger")
const rateLimit = require("express-rate-limit")
const crypto = require("crypto")

// Configure rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP per 15 minutes
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Password strength validator
const passwordValidator = (value) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  return regex.test(value) ||
    'Password must be at least 8 characters and include uppercase, lowercase, number and special character'
}

// @route   POST /api/auth/register
// @desc    Register a user
// @access  Public
router.post(
  "/register",
  authLimiter,
  [
    check("email", "Please include a valid email").isEmail(),
    check("password").custom(passwordValidator),
    check("nickname", "Nickname is required").not().isEmpty().trim().isLength({ min: 3, max: 30 }),
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      })
    }

    const { email, password, nickname } = req.body

    try {
      // Check if user exists
      let user = await User.findOne({ email })
      if (user) {
        return res.status(400).json({
          success: false,
          error: "User already exists",
        })
      }

      // Create user
      user = new User({
        email,
        password,
        nickname,
        isVerified: false,
        version: 1,
      })

      // Generate verification token
      const verificationToken = user.createVerificationToken()

      // Save user
      await user.save()

      // Note: In production, you would send verification email here
      // sendVerificationEmail(user.email, verificationToken)

      // Create token payload
      const payload = {
        id: user.id,
        role: user.role,
        version: user.version,
      }

      // Generate token
      const token = generateToken(payload)

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          role: user.role,
          isVerified: user.isVerified,
        },
        message: "Registration successful! Please verify your email address."
      })
    } catch (err) {
      logger.error(`Registration error: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  }),
)

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  "/login",
  authLimiter,
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists()
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      })
    }

    const { email, password } = req.body

    try {
      // Check if user exists - explicitly include the password field
      const user = await User.findOne({ email }).select("+password")

      if (!user) {
        logger.warn(`Login attempt with non-existent email: ${email}`)
        return res.status(400).json({
          success: false,
          error: "Invalid credentials",
        })
      }

      // Check if account is locked
      if (user.isLocked && user.isLocked()) {
        const lockTime = new Date(user.lockUntil)
        logger.warn(`Login attempt on locked account: ${email}`)
        return res.status(403).json({
          success: false,
          error: `Account is temporarily locked. Try again after ${lockTime.toLocaleString()}`,
        })
      }

      // Check password
      const isMatch = await user.correctPassword(password, user.password)

      if (!isMatch) {
        // Increment login attempts
        await user.incrementLoginAttempts()

        logger.warn(`Failed login attempt for user: ${email}`)
        return res.status(400).json({
          success: false,
          error: "Invalid credentials",
        })
      }

      // Reset login attempts on successful login
      user.loginAttempts = 0
      user.lockUntil = undefined
      await user.save()

      // Update last active status
      await User.findByIdAndUpdate(user._id, {
        lastActive: Date.now(),
      })

      // Create token payload
      const payload = {
        id: user.id,
        role: user.role,
        version: user.version || 1,
      }

      // Generate token
      const token = generateToken(payload)

      // Create refresh token
      const refreshToken = user.createRefreshToken()
      await user.save()

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          role: user.role,
          isVerified: user.isVerified,
          accountTier: user.accountTier,
        },
      })
    } catch (err) {
      logger.error(`Login error: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  }),
)

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get(
  "/me",
  protect,
  asyncHandler(async (req, res) => {
    try {
      // Get user from database (excluding password)
      const user = await User.findById(req.user._id).select("-password")

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      res.json({
        success: true,
        data: user,
      })
    } catch (err) {
      logger.error(`Get user error: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  }),
)

// @route   POST /api/auth/refresh-token
// @desc    Refresh authentication token
// @access  Public (with token)
router.post(
  "/refresh-token",
  asyncHandler(async (req, res) => {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      })
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, config.JWT_SECRET)

      // Check if user exists
      const user = await User.findById(decoded.id).select("-password")
      if (!user) {
        return res.status(401).json({
          success: false,
          error: "User not found",
        })
      }

      // Check token version to prevent use of revoked tokens
      if (decoded.version !== user.version) {
        return res.status(401).json({
          success: false,
          error: "Token has been revoked",
        })
      }

      // Create new token payload
      const payload = {
        id: user.id,
        role: user.role,
        version: user.version,
      }

      // Generate new token
      const newToken = generateToken(payload)

      res.json({
        success: true,
        token: newToken,
      })
    } catch (err) {
      logger.error(`Token refresh error: ${err.message}`)
      return res.status(401).json({
        success: false,
        error: "Invalid token",
      })
    }
  }),
)

// @route   POST /api/auth/logout
// @desc    Logout user (invalidate tokens)
// @access  Private
router.post(
  "/logout",
  protect,
  asyncHandler(async (req, res) => {
    try {
      // Get the user
      const user = await User.findById(req.user._id)

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      // Clear refresh token
      user.refreshToken = undefined
      user.refreshTokenExpires = undefined

      // Increment token version to invalidate existing tokens
      user.version = (user.version || 0) + 1

      await user.save()

      // Update online status
      await User.findByIdAndUpdate(user._id, {
        isOnline: false,
        lastActive: Date.now(),
      })

      res.json({
        success: true,
        message: "Logged out successfully",
      })
    } catch (err) {
      logger.error(`Logout error: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  })
)

// @route   POST /api/auth/verify-email
// @desc    Verify user email
// @access  Public
router.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Verification token is required",
      })
    }

    try {
      // Hash token
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

      // Find user with token
      const user = await User.findOne({
        verificationToken: hashedToken,
        verificationTokenExpires: { $gt: Date.now() },
      })

      if (!user) {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired verification token",
        })
      }

      // Update user
      user.isVerified = true
      user.verificationToken = undefined
      user.verificationTokenExpires = undefined
      await user.save()

      res.json({
        success: true,
        message: "Email verified successfully",
      })
    } catch (err) {
      logger.error(`Email verification error: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  }),
)

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post(
  "/forgot-password",
  [check("email", "Please include a valid email").isEmail()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      })
    }

    const { email } = req.body

    try {
      const user = await User.findOne({ email })

      if (!user) {
        // Don't reveal that the user doesn't exist
        return res.json({
          success: true,
          message: "If your email is registered, you will receive reset instructions",
        })
      }

      // Generate reset token
      const resetToken = user.createPasswordResetToken()
      await user.save()

      // Note: In production, you would send password reset email here
      // sendPasswordResetEmail(user.email, resetToken)

      res.json({
        success: true,
        message: "If your email is registered, you will receive reset instructions",
      })
    } catch (err) {
      logger.error(`Forgot password error: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  }),
)

// @route   POST /api/auth/reset-password
// @desc    Reset password
// @access  Public
router.post(
  "/reset-password",
  [
    check("token", "Reset token is required").exists(),
    check("password").custom(passwordValidator),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      })
    }

    const { token, password } = req.body

    try {
      // Hash token
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

      // Find user with token
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      })

      if (!user) {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired reset token",
        })
      }

      // Update password
      user.password = password
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined

      // Increment version to invalidate existing tokens
      user.version = (user.version || 0) + 1

      await user.save()

      res.json({
        success: true,
        message: "Password reset successful",
      })
    } catch (err) {
      logger.error(`Password reset error: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  }),
)

// @route   POST /api/auth/change-password
// @desc    Change password
// @access  Private
router.post(
  "/change-password",
  protect,
  [
    check("currentPassword", "Current password is required").exists(),
    check("newPassword").custom(passwordValidator),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      })
    }

    const { currentPassword, newPassword } = req.body

    try {
      // Get user with password
      const user = await User.findById(req.user._id).select("+password")

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      // Check current password
      const isMatch = await user.correctPassword(currentPassword, user.password)
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: "Current password is incorrect",
        })
      }

      // Update password
      user.password = newPassword

      // Increment version to invalidate existing tokens
      user.version = (user.version || 0) + 1

      await user.save()

      // Generate new token
      const payload = {
        id: user.id,
        role: user.role,
        version: user.version,
      }

      const token = generateToken(payload)

      res.json({
        success: true,
        message: "Password changed successfully",
        token,
      })
    } catch (err) {
      logger.error(`Change password error: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error",
      })
    }
  }),
)

// @route   GET /api/auth/test-connection
// @desc    Test API connection
// @access  Public
router.get("/test-connection", (req, res) => {
  res.json({
    success: true,
    message: "API connection successful",
    timestamp: new Date().toISOString(),
  })
})

module.exports = router
