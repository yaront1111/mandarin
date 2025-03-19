/**
 * routes/index.js
 *
 * Main router file for the API.
 * Mounts all sub-route modules using ES Modules.
 */

import express from "express";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import messageRoutes from "./messageRoutes.js";
import storyRoutes from "./storyRoutes.js";
import notificationRoutes from "./notificationRoutes.js";

const router = express.Router();

// Mount sub-routes under the API prefix
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/messages", messageRoutes);
router.use("/stories", storyRoutes);
router.use("/notifications", notificationRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default router;
