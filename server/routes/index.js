import express from "express"
import mongoose from "mongoose"
import authRoutes from "./authRoutes.js"
import userRoutes from "./userRoutes.js"
import messageRoutes from "./messageRoutes.js"
import storyRoutes from "./storyRoutes.js"
import notificationRoutes from "./notificationRoutes.js"
import avatarRoutes from "./avatarRoutes.js"
import subscriptionRoutes from "./subscriptionRoutes.js"
import { protect } from "../middleware/auth.js"
import logger from "../logger.js"

const router = express.Router()

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || "1.0.0",
  })
})

// Add diagnostic route for debugging avatar endpoint issues
router.get("/debug-routes", (req, res) => {
  const mountedRoutes = {
    message: "Routes currently mounted in the server",
    timestamp: new Date().toISOString(),
    routes: {
      "GET /api/health": "API health check",
      "GET /api/avatar/health": "Avatar routes health check",
      "GET /api/avatar/:userId": "Get user avatar",
      "GET /api/debug-routes": "This route - shows available routes",
      "GET /api/debug-auth": "Authentication debugging route (protected)"
    }
  };
  return res.status(200).json(mountedRoutes);
})

// Debug route to diagnose auth and user ID issues
router.get("/debug-auth", protect, (req, res) => {
  // Check if user exists in request
  if (!req.user) {
    return res.status(500).json({
      success: false,
      error: "No user in request",
    });
  }

  // Extract user details for debugging
  const userIdRaw = req.user.id;
  const userIdStr = String(userIdRaw);
  
  // Check if ID is a valid MongoDB ObjectID
  const isValidObjectId = mongoose.Types.ObjectId.isValid(userIdStr);
  
  // Check if we can convert it to an ObjectId
  let objectIdResult = null;
  let objectIdError = null;
  try {
    objectIdResult = new mongoose.Types.ObjectId(userIdStr);
  } catch (err) {
    objectIdError = err.message;
  }

  // Log the results for server-side debugging
  logger.info(`Debug Auth Route - User ID Check:`, {
    id: userIdStr,
    valid: isValidObjectId,
    error: objectIdError
  });

  // Return detailed diagnostics
  return res.status(200).json({
    success: true,
    diagnostics: {
      user: {
        id: userIdRaw,
        idType: typeof userIdRaw,
        idString: userIdStr,
        idLength: userIdStr.length,
        isValidObjectId: isValidObjectId,
        objectIdResult: objectIdResult ? objectIdResult.toString() : null,
        objectIdError: objectIdError,
        idMatchesFormat: /^[0-9a-fA-F]{24}$/.test(userIdStr)
      },
      token: {
        exists: !!req.headers.authorization,
        format: req.headers.authorization ? req.headers.authorization.substring(0, 15) + '...' : null
      },
      tests: {
        conversationsTest: `/api/messages/conversations will ${isValidObjectId ? 'likely work' : 'likely fail'}`,
        resetInstructions: "To reset your session: localStorage.clear(); sessionStorage.clear(); window.location.href='/login';"
      }
    }
  });
})

// Mount routes
router.use("/auth", authRoutes)
router.use("/users", userRoutes)
router.use("/messages", messageRoutes)
router.use("/stories", storyRoutes)
router.use("/notifications", notificationRoutes)
router.use("/avatar", avatarRoutes)
// Also mount at '/avatars' for backwards compatibility 
router.use("/avatars", avatarRoutes)
router.use("/subscription", subscriptionRoutes)

export default router
