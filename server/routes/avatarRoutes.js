// server/routes/avatarRoutes.js - FIXED
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { User } from "../models/index.js";
import config from "../config.js";
import logger from "../logger.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @route   GET /api/avatar/:userId
 * @desc    Get user avatar by user ID
 * @access  Public
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // First check if user exists and has photos
    const user = await User.findById(userId).select("photos");

    if (user && user.photos && user.photos.length > 0) {
      // Get the first photo (profile photo)
      const profilePhoto = user.photos[0];

      // If the photo URL is a full path (starts with http), redirect to it
      if (profilePhoto.url.startsWith("http")) {
        return res.redirect(profilePhoto.url);
      }

      // Otherwise, it's a local path like "/uploads/images/filename.jpg"
      // Extract the filename part only
      const filename = profilePhoto.url.split("/").pop();

      if (filename) {
        // === FIX: Include the 'images' subdirectory in the path ===
        const filePath = path.join(config.FILE_UPLOAD_PATH, "images", filename);

        // Check if file exists at the corrected path
        if (fs.existsSync(filePath)) {
          // Set cache headers
          res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day cache
          res.setHeader("Expires", new Date(Date.now() + 86400000).toUTCString());

          return res.sendFile(filePath); // Send the file from the correct location
        } else {
           logger.warn(`Avatar file not found at calculated path: ${filePath} for URL ${profilePhoto.url}`);
        }
      } else {
         logger.warn(`Could not extract filename from photo URL: ${profilePhoto.url}`);
      }
    } else {
       logger.debug(`User ${userId} not found or has no photos.`);
    }

    // If we get here (no photo found via user.photos or file missing), try the legacy path format
    const legacyFilePath = path.join(config.FILE_UPLOAD_PATH, `user-${userId}.jpg`);

    if (fs.existsSync(legacyFilePath)) {
       logger.debug(`Serving legacy avatar path for user ${userId}`);
      // Set cache headers
      res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day
      res.setHeader("Expires", new Date(Date.now() + 86400000).toUTCString());

      return res.sendFile(legacyFilePath);
    }

    // If no avatar found, send default avatar
    const defaultAvatarPath = path.join(__dirname, "..", "public", "default-avatar.png");

    if (fs.existsSync(defaultAvatarPath)) {
       logger.debug(`Serving default avatar for user ${userId}`);
      return res.sendFile(defaultAvatarPath);
    }

    // If even the default avatar doesn't exist, send 404
    logger.error(`Default avatar not found at ${defaultAvatarPath}. Sending 404 for user ${userId}.`);
    res.status(404).json({ success: false, error: "Avatar not found" });

  } catch (err) {
    logger.error(`Error fetching avatar for user ${req.params.userId}: ${err.message}`);
    // Avoid sending detailed server errors to client in production if possible
    res.status(500).json({ success: false, error: "Server error fetching avatar" });
  }
});

export default router;
