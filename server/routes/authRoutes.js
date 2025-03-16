const express = require("express")
const router = express.Router()
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { check, validationResult } = require("express-validator")
const { User } = require("../models")
const { protect, generateToken, asyncHandler } = require("../middleware/auth")
const config = require("../config")
const logger = require("../logger")

// @route   POST /api/auth/register
// @desc    Register a user
// @access  Public
router.post(
  "/register",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password must be at least 6 characters").isLength({ min: 6 }),
    check("nickname", "Nickname is required").not().isEmpty(),
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
      })

      // Hash password
      const salt = await bcrypt.genSalt(10)
      user.password = await bcrypt.hash(password, salt)

      // Save user
      await user.save()

      // Create token payload
      const payload = {
        id: user.id,
        role: user.role,
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
        },
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
  [check("email", "Please include a valid email").isEmail(), check("password", "Password is required").exists()],
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
      // Check if user exists
      const user = await User.findOne({ email })
      if (!user) {
        return res.status(400).json({
          success: false,
          error: "Invalid credentials",
        })
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password)
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: "Invalid credentials",
        })
      }

      // Create token payload
      const payload = {
        id: user.id,
        role: user.role,
      }

      // Generate token
      const token = generateToken(payload)

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          role: user.role,
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

      // Create new token payload
      const payload = {
        id: user.id,
        role: user.role,
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
// @desc    Logout user (client-side only)
// @access  Public
router.post("/logout", (req, res) => {
  // Logout is handled client-side by removing the token
  res.json({
    success: true,
    message: "Logged out successfully",
  })
})

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
