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

// Create a logger specifically for avatar routes
const log = {
  debug: (msg, ...args) => logger.debug(`[AvatarRoutes] ${msg}`, ...args),
  info: (msg, ...args) => logger.info(`[AvatarRoutes] ${msg}`, ...args),
  warn: (msg, ...args) => logger.warn(`[AvatarRoutes] ${msg}`, ...args),
  error: (msg, ...args) => logger.error(`[AvatarRoutes] ${msg}`, ...args)
};

// Fallback avatar as a base64 encoded SVG - will be served if no default avatar files are found
const fallbackAvatarSvg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="100" fill="#e0e0e0"/>
  <circle cx="100" cy="80" r="40" fill="#bbb"/>
  <circle cx="100" cy="180" r="60" fill="#bbb"/>
</svg>`;

// Function to serve fallback avatar as last resort
const serveInlineFallbackAvatar = (res) => {
  log.warn('Using inline SVG fallback avatar as last resort');
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(fallbackAvatarSvg);
};

// Add a diagnostic route to verify the router is mounted correctly
router.get('/health', (req, res) => {
  console.log(`Avatar route health check called at: ${new Date().toISOString()}`);
  logger.info(`Avatar route health check called at: ${new Date().toISOString()}`);
  return res.status(200).json({
    status: 'ok',
    route: 'avatar',
    timestamp: new Date().toISOString(),
    message: 'Avatar routes are functioning correctly',
    router_path: req.baseUrl,
    full_path: req.originalUrl
  });
});

// Add an explicit route for "default" avatar
router.get('/default', (req, res) => {
  log.debug("Default avatar route called explicitly");
  
  // Send the default avatar - try various formats and locations
  const possiblePaths = [
    path.join(__dirname, "..", "public", "default-avatar1.png"),
    path.join(__dirname, "..", "public", "default-avatar.svg"),
    path.join(process.cwd(), "public", "default-avatar1.png"),
    path.join(process.cwd(), "public", "default-avatar.svg"),
    path.join(process.cwd(), "..", "client", "public", "default-avatar1.png")
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      // If this is an SVG file, set the right content type
      if (filePath.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      }
      
      log.debug(`Serving default avatar from: ${filePath}`);
      return res.sendFile(filePath);
    }
  }
  
  // If no default avatar found, use the inline fallback
  log.warn(`No default avatar file found, using inline SVG fallback`);
  return serveInlineFallbackAvatar(res);
});

/**
 * @route   GET /api/avatar/:userId
 * @desc    Get user avatar by user ID
 * @access  Public
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    log.debug(`Avatar request for userId: ${userId}`);

    // First check if user exists and has photos
    const user = await User.findById(userId).select("photos");

    if (user && user.photos && user.photos.length > 0) {
      // Get the first photo (profile photo)
      const profilePhoto = user.photos[0];
      
      log.debug(`Found profile photo: ${JSON.stringify(profilePhoto)}`);

      // If the photo URL is a full path (starts with http), redirect to it
      if (profilePhoto.url && profilePhoto.url.startsWith("http")) {
        log.debug(`Redirecting to external URL: ${profilePhoto.url}`);
        return res.redirect(profilePhoto.url);
      }

      // Otherwise, it's a local path like "/uploads/images/filename.jpg"
      // First try to resolve it assuming it's a complete path reference
      if (profilePhoto.url && profilePhoto.url.startsWith("/uploads/")) {
        const fullPath = path.join(process.cwd(), profilePhoto.url);
        
        log.debug(`Trying direct path: ${fullPath}`);
        
        if (fs.existsSync(fullPath)) {
          // Set cache headers
          res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day cache
          res.setHeader("Expires", new Date(Date.now() + 86400000).toUTCString());
          
          log.debug(`Serving full path avatar: ${fullPath}`);
          return res.sendFile(fullPath);
        }
      }

      // Extract the filename part only as another approach
      const filename = profilePhoto.url ? profilePhoto.url.split("/").pop() : null;

      if (filename) {
        // Try multiple possible paths
        const possiblePaths = [
          path.join(config.FILE_UPLOAD_PATH, "images", filename),
          path.join(config.FILE_UPLOAD_PATH, "photos", filename),
          path.join(config.FILE_UPLOAD_PATH, "profiles", filename),
          path.join(config.FILE_UPLOAD_PATH, filename)
        ];
        
        log.debug(`Trying multiple possible paths for filename: ${filename}`);
        
        for (const filePath of possiblePaths) {
          if (fs.existsSync(filePath)) {
            // Set cache headers
            res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day cache
            res.setHeader("Expires", new Date(Date.now() + 86400000).toUTCString());
            
            log.debug(`Found and serving file at: ${filePath}`);
            return res.sendFile(filePath);
          }
        }
        
        log.warn(`Avatar file not found in any of the expected locations for filename: ${filename}`);
      } else {
        log.warn(`Could not extract filename from photo URL: ${profilePhoto.url}`);
      }
    } else {
      log.debug(`User ${userId} not found or has no photos.`);
    }

    // If we get here (no photo found via user.photos or file missing), try the legacy path format
    const legacyFilePath = path.join(config.FILE_UPLOAD_PATH, `user-${userId}.jpg`);

    if (fs.existsSync(legacyFilePath)) {
      log.debug(`Serving legacy avatar path for user ${userId}`);
      // Set cache headers
      res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day
      res.setHeader("Expires", new Date(Date.now() + 86400000).toUTCString());

      return res.sendFile(legacyFilePath);
    }

    // If no avatar found, send default avatar - try various formats and locations
    const possiblePaths = [
      path.join(__dirname, "..", "public", "default-avatar1.png"),
      path.join(__dirname, "..", "public", "default-avatar.svg"),
      path.join(process.cwd(), "public", "default-avatar1.png"),
      path.join(process.cwd(), "public", "default-avatar.svg"),
      path.join(process.cwd(), "..", "client", "public", "default-avatar1.png")
    ];
    
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        // If this is an SVG file, set the right content type
        if (filePath.endsWith('.svg')) {
          res.setHeader('Content-Type', 'image/svg+xml');
        }
        
        log.debug(`Serving default avatar from: ${filePath} for user ${userId}`);
        return res.sendFile(filePath);
      }
    }

    // If even the default avatar doesn't exist, use the inline fallback
    log.warn(`No default avatar file found for user ${userId}, using inline SVG fallback`);
    return serveInlineFallbackAvatar(res);

  } catch (err) {
    log.error(`Error fetching avatar for user ${req.params.userId}: ${err.message}`, { stack: err.stack });
    // Avoid sending detailed server errors to client in production if possible
    res.status(500).json({ success: false, error: "Server error fetching avatar" });
  }
});

// Add a default handler for when user ID is not provided
router.get("/", (req, res) => {
  log.debug("Default avatar route called without userId");
  
  // Send the default avatar
  const defaultAvatarPath = path.join(__dirname, "..", "public", "default-avatar1.png");
  const clientDefaultAvatarPath = path.join(process.cwd(), "..", "client", "public", "default-avatar1.png");
  
  if (fs.existsSync(defaultAvatarPath)) {
    log.debug("Serving default avatar from server public dir");
    return res.sendFile(defaultAvatarPath);
  } else if (fs.existsSync(clientDefaultAvatarPath)) {
    log.debug("Serving default avatar from client public dir");
    return res.sendFile(clientDefaultAvatarPath);
  }
  
  // If no default avatar found, send a 404
  return res.status(404).json({ 
    success: false, 
    error: "Default avatar not found" 
  });
});

// Add a catchall route for debugging
router.get("*", (req, res, next) => {
  const path = req.path;
  log.debug(`Uncaught avatar route: ${path}`);
  
  // If this is a standard avatar route, let it pass through to the userId handler
  if (path.match(/^\/[a-f0-9]{24}$/i)) {
    return next();
  }
  
  // For any unknown route, just serve the default avatar
  log.warn(`Unknown avatar route requested: ${path}, serving default avatar`);
  
  // Try to serve the default avatar from various paths
  const possiblePaths = [
    path.join(__dirname, "..", "public", "default-avatar1.png"),
    path.join(__dirname, "..", "public", "default-avatar.svg"),
    path.join(process.cwd(), "public", "default-avatar1.png"),
    path.join(process.cwd(), "public", "default-avatar.svg"),
    path.join(process.cwd(), "..", "client", "public", "default-avatar1.png")
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      // If this is an SVG file, set the right content type
      if (filePath.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      }
      
      log.debug(`Serving default avatar from: ${filePath}`);
      return res.sendFile(filePath);
    }
  }
  
  // If no default avatar found, use the inline fallback
  return serveInlineFallbackAvatar(res);
});

export default router;
