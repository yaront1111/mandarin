// server/routes/authRoutes.js
import express from "express"
import jwt from "jsonwebtoken"
import crypto from "crypto"
import rateLimit from "express-rate-limit"
import { check, validationResult } from "express-validator"
import asyncHandler from "express-async-handler"
import { User } from "../models/index.js"
import { protect, generateToken } from "../middleware/auth.js"
import {
  sendVerificationEmail,
  sendEmailNotification,
} from "../utils/emailService.js"
import config from "../config.js"
import logger from "../logger.js"

const router = express.Router()
const log = logger.child({ component: "AuthRoutes" })

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  message: { success: false, error: "Too many requests—please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

// Helper to return the first validation error
function validationError(res, errors) {
  return res.status(400).json({ success: false, error: errors.array()[0].msg })
}

// Strong password policy
const passwordChecks = [
  check("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must include an uppercase letter")
    .matches(/[a-z]/).withMessage("Password must include a lowercase letter")
    .matches(/\d/).withMessage("Password must include a number")
    .matches(/[@$!%*?&]/).withMessage("Password must include a special character (@$!%*?&)"),
]

// ──────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Create new user & send verification email
// @access  Public
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/register",
  authLimiter,
  [
    check("email").isEmail().withMessage("Invalid email"),
    ...passwordChecks,
    check("nickname")
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage("Nickname must be 3–30 characters"),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return validationError(res, errors)

    const { email, password, nickname, details = {}, accountTier = "FREE", isCouple = false } = req.body

    if (await User.exists({ email })) {
      log.warn(`Attempted register with existing email: ${email}`)
      return res
        .status(400)
        .json({ success: false, error: "Email already in use", code: "EMAIL_EXISTS" })
    }

    const user = new User({ email, password, nickname, details, accountTier, isCouple })
    const verificationToken = user.createVerificationToken()
    await user.save()

    // Send verification email asynchronously
    sendVerificationEmail({ email, nickname, token: verificationToken })
      .then(() => log.info(`Verification email sent to ${email}`))
      .catch(err => log.error(`Email send failure: ${err.message}`))

    const token = generateToken({ id: user.id, role: user.role, version: user.version })
    res.status(201).json({
      success: true,
      message: "Registered—please check your inbox to verify.",
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
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Authenticate & issue JWT + refresh token
// @access  Public
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/login",
  authLimiter,
  [
    check("email").isEmail().withMessage("Invalid email"),
    check("password").exists().withMessage("Password required"),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return validationError(res, errors)

    const { email, password } = req.body
    const user = await User.findOne({ email }).select("+password")
    if (!user) {
      log.warn(`Login failed—no user: ${email}`)
      return res.status(400).json({ success: false, error: "Invalid credentials" })
    }

    if (user.isLocked?.()) {
      const unlockAt = new Date(user.lockUntil).toLocaleString()
      return res.status(403).json({
        success: false,
        error: `Account locked—try again after ${unlockAt}`,
      })
    }

    const correct = await user.correctPassword(password, user.password)
    if (!correct) {
      await user.incrementLoginAttempts()
      log.warn(`Failed login attempt for ${email}`)
      return res.status(400).json({ success: false, error: "Invalid credentials" })
    }

    // Reset counters & update status
    user.loginAttempts = 0
    user.lockUntil = undefined
    await user.save()
    await User.findByIdAndUpdate(user.id, { lastActive: Date.now(), isOnline: true })

    // Issue tokens
    const payload = { id: user.id, role: user.role, version: user.version }
    const token = generateToken(payload)
    user.createRefreshToken()
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
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/verify
// @desc    Verify that the JWT is valid
// @access  Private
// ──────────────────────────────────────────────────────────────────────────────
router.get(
  "/verify",
  protect,
  (req, res) => {
    res.json({ success: true })
  }
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
// ──────────────────────────────────────────────────────────────────────────────
router.get(
  "/me",
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select("-password")
    if (!user) {
      log.warn(`User not found: ${req.user.id}`)
      return res.status(404).json({ success: false, error: "User not found" })
    }
    res.json({ success: true, data: user })
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/refresh-token
// @desc    Refresh JWT using expired token
// @access  Public
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/refresh-token",
  asyncHandler(async (req, res) => {
    const raw = req.body.token
    if (!raw) return res.status(400).json({ success: false, error: "Token required" })

    let decoded
    try {
      decoded = jwt.verify(raw, config.JWT_SECRET, { ignoreExpiration: true })
    } catch (err) {
      log.error(`Refresh error: ${err.message}`)
      return res.status(401).json({ success: false, error: "Invalid token" })
    }

    const user = await User.findById(decoded.id).select("-password")
    if (!user || decoded.version !== user.version) {
      return res.status(401).json({ success: false, error: "Token revoked or user not found" })
    }

    if (Date.now() - decoded.iat * 1000 > config.MAX_REFRESH_AGE_MS) {
      return res.status(401).json({ success: false, error: "Token too old" })
    }

    const newToken = generateToken({ id: user.id, role: user.role, version: user.version })
    res.json({ success: true, token: newToken })
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/logout
// @desc    Invalidate all tokens by bumping version
// @access  Private
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/logout",
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ success: false, error: "User not found" })

    user.refreshToken = undefined
    user.version += 1
    user.isOnline = false
    user.lastActive = Date.now()
    await user.save()

    res.json({ success: true, message: "Logged out" })
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/verify-email
// @desc    Verify email token
// @access  Public
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const { token } = req.body
    if (!token) return res.status(400).json({ success: false, error: "Token required" })

    const hash = crypto.createHash("sha256").update(token).digest("hex")
    const user = await User.findOne({
      verificationToken: hash,
      verificationTokenExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid or expired token" })
    }

    user.isVerified = true
    user.verificationToken = undefined
    user.verificationTokenExpires = undefined
    await user.save()

    res.json({ success: true, message: "Email verified" })
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/resend-verification
// @desc    Throttled resend of verification email
// @access  Private
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/resend-verification",
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ success: false, error: "User not found" })
    if (user.isVerified) return res.status(400).json({ success: false, error: "Already verified" })

    const cooldown = 60 * 60 * 1000
    if (user.verificationTokenExpires > Date.now() - cooldown) {
      return res.status(429).json({ success: false, error: "Please wait before resending." })
    }

    const token = user.createVerificationToken()
    await user.save()
    await sendVerificationEmail({ email: user.email, nickname: user.nickname, token })
    res.json({ success: true, message: "Verification email resent" })
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/forgot-password
// @desc    Issue a password reset token
// @access  Public
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/forgot-password",
  [ check("email").isEmail().withMessage("Invalid email") ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return validationError(res, errors)

    const user = await User.findOne({ email: req.body.email })
    if (user) {
      // Generate and save reset token + expiry
      const resetToken = user.createPasswordResetToken()
      await user.save()

      // Build reset URL
      const resetUrl = `${config.APP_URL}/reset-password?token=${resetToken}`

      // Send reset email
      const mailText = `
Hello ${user.nickname},

You requested a password reset. Click the link below to set a new password:
${resetUrl}

If you did not request this, please ignore this email.
This link expires in 1 hour.
      `.trim()

      try {
        await sendEmailNotification({
          to: user.email,
          subject: "Your password reset link (expires in 1 hour)",
          text: mailText,
        })
        log.info(`Password reset email sent to ${user.email}`)
      } catch (err) {
        log.error(`Error sending reset email to ${user.email}: ${err.message}`)
      }
    }

    // Generic response to prevent email enumeration
    res.json({
      success: true,
      message: "If registered, reset instructions have been sent.",
    })
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/reset-password
// @desc    Reset password using a valid token
// @access  Public
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/reset-password",
  [
    check("token").exists().withMessage("Token required"),
    ...passwordChecks,
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return validationError(res, errors)

    const hash = crypto.createHash("sha256").update(req.body.token).digest("hex")
    const user = await User.findOne({
      passwordResetToken: hash,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password")

    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid or expired token" })
    }

    user.password = req.body.password
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    user.version += 1
    await user.save()

    res.json({ success: true, message: "Password reset successful" })
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/change-password
// @desc    Authenticated password change
// @access  Private
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/change-password",
  protect,
  [
    check("currentPassword").exists().withMessage("Current password required"),
    check("newPassword").exists().withMessage("New password required"),
    ...passwordChecks,
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return validationError(res, errors)

    const user = await User.findById(req.user.id).select("+password")
    if (!user) return res.status(404).json({ success: false, error: "User not found" })

    const ok = await user.correctPassword(req.body.currentPassword, user.password)
    if (!ok) {
      return res.status(400).json({ success: false, error: "Current password incorrect" })
    }

    user.password = req.body.newPassword
    user.version += 1
    await user.save()

    const token = generateToken({ id: user.id, role: user.role, version: user.version })
    res.json({ success: true, message: "Password changed", token })
  })
)

// ──────────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/test-connection
// @desc    Simple connectivity check
// @access  Public
// ──────────────────────────────────────────────────────────────────────────────
router.get("/test-connection", (req, res) => {
  res.json({ success: true, message: "API is up!", timestamp: new Date().toISOString() })
})

export default router
