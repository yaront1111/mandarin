const express = require("express")
const router = express.Router()

// Import route files
const authRoutes = require("./authRoutes")
const userRoutes = require("./userRoutes")
const messageRoutes = require("./messageRoutes")
const storyRoutes = require("./storyRoutes")
const notificationRoutes = require("./notificationRoutes") // Add this line

// Mount routes
router.use("/auth", authRoutes)
router.use("/users", userRoutes)
router.use("/messages", messageRoutes)
router.use("/stories", storyRoutes)
router.use("/notifications", notificationRoutes) // Add this line

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

module.exports = router
