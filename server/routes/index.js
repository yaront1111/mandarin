import express from "express"
import authRoutes from "./authRoutes.js"
import userRoutes from "./userRoutes.js"
import messageRoutes from "./messageRoutes.js"
import storyRoutes from "./storyRoutes.js"
import notificationRoutes from "./notificationRoutes.js"
import subscriptionRoutes from "./subscriptionRoutes.js"
import avatarRoutes from "./avatarRoutes.js"

const router = express.Router()

// Mount route files
router.use("/auth", authRoutes)
router.use("/users", userRoutes)
router.use("/messages", messageRoutes)
router.use("/stories", storyRoutes)
router.use("/notifications", notificationRoutes)
router.use("/subscriptions", subscriptionRoutes)
router.use("/avatar", avatarRoutes)

export default router
