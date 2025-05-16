// routes/userRoutes.js

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import { User, PhotoPermission, Message, Like } from "../models/index.js";
import config from "../config.js";
import { protect, enhancedProtect } from "../middleware/auth.js";
import { canLikeUser } from "../middleware/permissions.js";
import logger from "../logger.js";
import { sendLikeNotification, sendPhotoPermissionRequestNotification, sendPhotoPermissionResponseNotification } from "../socket/notification.js";
import { uploadPhoto } from "../middleware/upload.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

// Validate a Mongo ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Safely stringify an ID
const safeId = (id) =>
  id == null
    ? null
    : typeof id === "object" && id.toString
    ? id.toString()
    : String(id);

// Build pagination params from query
const paginate = (req) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// Centralized error responder
const respondError = (res, status, msg) =>
  res.status(status).json({ success: false, error: msg });

// ─── Multer & Image Processing ──────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store files in the images directory to match existing pattern
    const dir = path.join(config.FILE_UPLOAD_PATH, "images");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only jpg/png/gif images allowed"));
  },
});

// Resize and validate image
async function processImage(filePath) {
  const buffer = fs.readFileSync(filePath);
  const type = await fileTypeFromBuffer(buffer);
  if (!type?.mime.startsWith("image/")) throw new Error("Invalid image");
  const img = sharp(buffer);
  const meta = await img.metadata();
  if (meta.width > 1200 || meta.height > 1200) {
    await img.resize(1200, 1200, { fit: "inside" }).toFile(filePath + ".tmp");
    fs.renameSync(filePath + ".tmp", filePath);
  }
  return meta;
}

// ─── ROUTES ────────────────────────────────────────────────────────────────

/**
 * GET /api/users/likes
 * Get paginated list of users you've liked
 */
router.get(
  "/likes",
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const userId = safeId(req.user._id);
    if (!userId) return respondError(res, 400, "User ID missing");
    const { data: likes, pagination } = await Like.getLikesBySender(userId, {
      page,
      limit,
      populate: true,
    });
    res.json({
      success: true,
      count: likes.length,
      total: pagination.total,
      page: pagination.page,
      pages: pagination.pages,
      data: likes,
    });
  })
);

/**
 * GET /api/users
 * List/filter online users (excludes yourself)
 */
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const q = { _id: { $ne: req.user._id } };
    if (req.query.online === "true") q.isOnline = true;
    if (req.query.gender) q["details.gender"] = req.query.gender;
    if (req.query.minAge) q["details.age"] = { ...q["details.age"], $gte: +req.query.minAge };
    if (req.query.maxAge) q["details.age"] = { ...q["details.age"], $lte: +req.query.maxAge };
    if (req.query.location) q["details.location"] = { $regex: req.query.location, $options: "i" };
    if (req.query.interest) q["details.interests"] = { $in: [req.query.interest] };

    const users = await User.find(q)
      .select("nickname details photos isOnline lastActive settings")
      .sort({ isOnline: -1, lastActive: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(q);
    const data = users.map((u) => {
      const o = u.toObject();
      if (o.settings?.privacy?.showOnlineStatus === false) o.isOnline = false;
      delete o.settings;
      return o;
    });

    res.json({
      success: true,
      count: data.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data,
    });
  })
);

/**
 * GET /api/users/:id
 * Get user profile + message history
 */
router.get(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");
    const user = await User.findById(id).select("nickname details photos isOnline lastActive createdAt settings");
    if (!user) return respondError(res, 404, "User not found");

    // Filter photos based on privacy and logged-in user
    const targetUser = user.toObject();
    const requestingUserId = req.user._id.toString();
    const isOwner = requestingUserId === id;
    
    // Process photos to include permission data
    if (targetUser.photos && Array.isArray(targetUser.photos)) {
      // Get only non-deleted photos
      targetUser.photos = targetUser.photos.filter(photo => !photo.isDeleted);
      
      // For each photo, add a hasPermission flag based on privacy and permissions
      if (!isOwner && targetUser.photos.length > 0) {
        // Get all private photo IDs
        const privatePhotoIds = targetUser.photos
          .filter(photo => photo.privacy === 'private')
          .map(p => p._id);
          
        // If there are private photos, check for permissions
        let permissions = [];
        if (privatePhotoIds.length > 0) {
          permissions = await PhotoPermission.find({
            photo: { $in: privatePhotoIds },
            requestedBy: requestingUserId,
            status: 'approved'
          });
        }
        
        // Create a set of approved photo IDs for quick lookups
        const approvedPhotoIds = new Set(
          permissions.map(p => p.photo.toString())
        );
        
        // Add permission flags to each photo
        targetUser.photos = targetUser.photos.map(photo => {
          const photoObj = photo;
          
          // Determine if the user has permission to view this photo
          if (photo.privacy === 'public') {
            photoObj.hasPermission = true;
          } else if (photo.privacy === 'private') {
            photoObj.hasPermission = approvedPhotoIds.has(photo._id.toString());
          } else if (photo.privacy === 'friends_only') {
            // TODO: Implement friends logic here if needed
            photoObj.hasPermission = false;
          } else {
            photoObj.hasPermission = false;
          }
          
          return photoObj;
        });
      } else {
        // Owner has permission to all photos
        targetUser.photos = targetUser.photos.map(photo => ({
          ...photo,
          hasPermission: true
        }));
      }
    }
    
    if (targetUser.settings?.privacy?.showOnlineStatus === false) targetUser.isOnline = false;
    delete targetUser.settings;

    const { page, limit, skip } = paginate(req);
    const mQuery = {
      $or: [
        { sender: req.user._id, recipient: id },
        { sender: id, recipient: req.user._id },
      ],
    };
    const messages = await Message.find(mQuery).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const totalMessages = await Message.countDocuments(mQuery);

    const liked = await Like.exists({ sender: req.user._id, recipient: id });
    const mutual = await Like.exists({ sender: id, recipient: req.user._id });

    res.json({
      success: true,
      data: {
        user: targetUser,
        messages,
        messagesPagination: { total: totalMessages, page, pages: Math.ceil(totalMessages / limit) },
        isLiked: !!liked,
        isMutualLike: !!mutual,
      },
    });
  })
);

/**
 * GET /api/users/:id/photo-permissions
 * List your permission requests for someone's private photos
 */
router.get(
  "/:id/photo-permissions",
  enhancedProtect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");
    const target = await User.findById(id).select("photos");
    if (!target) return respondError(res, 404, "User not found");

    const privateIds = target.photos.filter((p) => p.privacy === 'private').map((p) => p._id);
    if (privateIds.length === 0) return res.json({ success: true, data: [] });

    const permissions = await PhotoPermission.find({
      photo: { $in: privateIds },
      requestedBy: req.user._id,
    });

    res.json({
      success: true,
      data: permissions.map((p) => ({
        photo: p.photo,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        respondedAt: p.respondedAt,
        expiresAt: p.expiresAt,
      })),
    });
  })
);

/**
 * PUT /api/users/profile
 * Update your own profile
 */
router.put(
  "/profile",
  protect,
  asyncHandler(async (req, res) => {
    const { nickname, details, settings } = req.body;
    const updates = {};

    if (nickname != null) {
      if (nickname.trim().length < 3) return respondError(res, 400, "Nickname too short");
      updates.nickname = nickname.trim();
    }
    if (details) {
      updates.details = { ...req.user.details };
      if (details.age != null) {
        const age = parseInt(details.age, 10);
        if (age < 18 || age > 120) return respondError(res, 400, "Age 18–120 only");
        updates.details.age = age;
      }
      if (details.gender != null) updates.details.gender = details.gender;
      if (details.location != null) updates.details.location = details.location.trim();
      if (details.bio != null) {
        if (details.bio.length > 500) return respondError(res, 400, "Bio too long");
        updates.details.bio = details.bio.trim();
      }
      if (details.interests != null) {
        const arr = Array.isArray(details.interests)
          ? details.interests
          : details.interests.split(",").map((i) => i.trim()).filter(Boolean);
        if (arr.length > 10) return respondError(res, 400, "Max 10 interests");
        updates.details.interests = arr;
      }
      ["iAm", "lookingFor", "intoTags", "turnOns", "maritalStatus"].forEach((field) => {
        if (details[field] != null) updates.details[field] = details[field];
      });
    }
    if (settings) {
      const existing = (await User.findById(req.user._id)).settings || {};
      updates.settings = { ...existing, ...settings };
    }

    try {
      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      });
      res.json({ success: true, data: user });
    } catch (err) {
      if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return respondError(res, 400, `${field} already in use`);
      }
      respondError(res, 400, err.message);
    }
  })
);

/**
 * POST /api/users/photos
 * Upload a new photo
 */
router.post(
  "/photos",
  protect,
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    if (!req.file) return respondError(res, 400, "No file uploaded");
    
    const loggedInUserId = req.user._id;
    console.log(`PHOTO UPLOAD: User ID: ${loggedInUserId}`);
    
    // Fetch the full Mongoose User document
    const userDocument = await User.findById(loggedInUserId);
    if (!userDocument) {
      console.error(`PHOTO UPLOAD ERROR: User document not found for ID: ${loggedInUserId}`);
      return respondError(res, 404, "User not found");
    }
    
    if ((userDocument.photos || []).length >= 10) {
      fs.unlinkSync(req.file.path);
      return respondError(res, 400, "Max 10 photos");
    }

    try {
      const meta = await processImage(req.file.path);
      // Set URL to match the actual location where the file is stored
      const url = `/uploads/images/${path.basename(req.file.path)}`;
      
      // Create photo data object
      const photoData = {
        url, 
        privacy: req.body.privacy || 'private',
        metadata: {
          ...meta,
          filename: path.basename(req.file.path),
          mimeType: req.file.mimetype,
          size: req.file.size
        }
      };
      
      // Use our new method to add the photo on the Mongoose document
      await userDocument.addPhoto(photoData);
      
      // Find the newly added photo (last one)
      const addedPhoto = userDocument.photos[userDocument.photos.length - 1];

      res.json({
        success: true,
        data: addedPhoto,
        isProfilePhoto: addedPhoto.isProfile,
        url,
      });
    } catch (err) {
      fs.unlinkSync(req.file.path);
      respondError(res, 400, err.message);
    }
  })
);

/**
 * PUT /api/users/photos/:id/privacy
 * Set a photo's privacy level
 */
router.put(
  "/photos/:id/privacy",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const loggedInUserId = req.user._id;
    
    console.log(`PRIVACY UPDATE: User ID: ${loggedInUserId}, Photo ID: ${id}, Body:`, req.body);
    
    if (!isValidId(id)) {
      console.error(`PRIVACY UPDATE ERROR: Invalid photo ID format: ${id}`);
      return respondError(res, 400, "Invalid photo ID");
    }
    
    const { privacy } = req.body;
    if (!privacy || !['public', 'private', 'friends_only'].includes(privacy)) {
      console.error(`PRIVACY UPDATE ERROR: Invalid privacy value: ${privacy}`);
      return respondError(res, 400, "Privacy must be 'public', 'private', or 'friends_only'");
    }

    try {
      // Fetch the full Mongoose User document
      const userDocument = await User.findById(loggedInUserId);
      if (!userDocument) {
        console.error(`PRIVACY UPDATE ERROR: User document not found for ID: ${loggedInUserId}`);
        return respondError(res, 404, "User not found");
      }
      
      // Log user photos before the operation
      console.log(`PRIVACY UPDATE: User photos count: ${userDocument.photos?.length || 0}`);
      console.log(`PRIVACY UPDATE: Photo IDs:`, userDocument.photos?.map(p => p._id?.toString()));
      
      // Call the method on the Mongoose document
      await userDocument.updatePhotoPrivacy(id, privacy);
      
      // Get the updated photo after the operation
      const updatedUser = await User.findById(loggedInUserId);
      const updatedPhoto = updatedUser.photos.id(id);
      
      if (!updatedPhoto) {
        console.error(`PRIVACY UPDATE ERROR: Photo not found after update: ${id}`);
        return respondError(res, 404, "Photo not found after update");
      }
      
      console.log(`PRIVACY UPDATE SUCCESS: Updated photo privacy to ${privacy} for photo ${id}`);
      res.json({ success: true, data: updatedPhoto });
    } catch (err) {
      console.error(`PRIVACY UPDATE ERROR: ${err.message}`);
      if (err.message === 'Photo not found' || err.message === 'Cannot update privacy of deleted photo') {
        return respondError(res, 404, err.message);
      }
      respondError(res, 400, err.message);
    }
  })
);

/**
 * PUT /api/users/photos/:id/profile
 * Make one photo your profile picture
 */
router.put(
  "/photos/:id/profile",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const loggedInUserId = req.user._id;
    
    console.log(`PROFILE PHOTO UPDATE: User ID: ${loggedInUserId}, Photo ID: ${id}`);
    
    if (!isValidId(id)) {
      console.error(`PROFILE PHOTO ERROR: Invalid photo ID format: ${id}`);
      return respondError(res, 400, "Invalid photo ID");
    }

    try {
      // Fetch the full Mongoose User document
      const userDocument = await User.findById(loggedInUserId);
      if (!userDocument) {
        console.error(`PROFILE PHOTO ERROR: User document not found for ID: ${loggedInUserId}`);
        return respondError(res, 404, "User not found");
      }
      
      // Log user photos before the operation
      console.log(`PROFILE PHOTO UPDATE: User photos count: ${userDocument.photos?.length || 0}`);
      console.log(`PROFILE PHOTO UPDATE: Photo IDs:`, userDocument.photos?.map(p => p._id?.toString()));
      
      // Call the method on the Mongoose document
      await userDocument.setProfilePhoto(id);
      
      // Get updated user data with photos
      const updatedUser = await User.findById(loggedInUserId).select('photos');
      
      if (!updatedUser || !updatedUser.photos) {
        console.error(`PROFILE PHOTO ERROR: Failed to retrieve updated user photos`);
        return respondError(res, 500, "Failed to retrieve updated user photos");
      }
      
      // Verify the photo was set as profile
      const profilePhoto = updatedUser.photos.find(p => p.isProfile && p._id.toString() === id);
      if (!profilePhoto) {
        console.error(`PROFILE PHOTO ERROR: Failed to set photo ${id} as profile`);
      } else {
        console.log(`PROFILE PHOTO SUCCESS: Set photo ${id} as profile`);
      }
      
      res.json({ success: true, data: updatedUser.photos });
    } catch (err) {
      console.error(`PROFILE PHOTO ERROR: ${err.message}`);
      if (err.message === 'Photo not found' || err.message === 'Cannot set deleted photo as profile photo') {
        return respondError(res, 404, err.message);
      }
      respondError(res, 400, err.message);
    }
  })
);

/**
 * DELETE /api/users/photos/:id
 * Delete (soft) a photo
 */
router.delete(
  "/photos/:id",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const loggedInUserId = req.user._id;
    
    console.log(`DELETE PHOTO: User ID: ${loggedInUserId}, Photo ID: ${id}`);
    
    if (!isValidId(id)) {
      console.error(`DELETE PHOTO ERROR: Invalid photo ID format: ${id}`);
      return respondError(res, 400, "Invalid photo ID");
    }

    try {
      // Fetch the full Mongoose User document
      const userDocument = await User.findById(loggedInUserId);
      if (!userDocument) {
        console.error(`DELETE PHOTO ERROR: User document not found for ID: ${loggedInUserId}`);
        return respondError(res, 404, "User not found");
      }
      
      // Call the method on the Mongoose document
      await userDocument.softDeletePhoto(id);
      
      console.log(`DELETE PHOTO SUCCESS: Deleted photo ${id}`);
      res.json({ success: true, message: "Photo deleted", data: { photoId: id } });
    } catch (err) {
      console.error(`DELETE PHOTO ERROR: ${err.message}`);
      if (err.message === 'Photo not found' || err.message === 'Cannot delete profile photo. Set another photo as profile first.') {
        return respondError(res, 404, err.message);
      }
      respondError(res, 400, err.message);
    }
  })
);

/**
 * GET /api/users/photos/permissions
 * Get incoming requests for your photos
 */
router.get(
  "/photos/permissions",
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const { status } = req.query;
    
    try {
      // Get all photo IDs that belong to the user
      const user = await User.findById(req.user._id).select("photos");
      if (!user) return respondError(res, 404, "User not found");
      
      const photoIds = user.photos.map(p => p._id);
      
      // Build query based on filters
      const query = { photoOwnerId: req.user._id };
      
      // Filter by status if provided
      if (status && ["pending", "approved", "rejected"].includes(status)) {
        query.status = status;
      }
      
      // Get permissions with pagination
      const [permissions, total] = await Promise.all([
        PhotoPermission.find(query)
          .populate("requestedBy", "nickname photos") // Include basic info about the requester
          .populate("photo", "url") // Include photo URL
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        PhotoPermission.countDocuments(query)
      ]);
      
      res.json({
        success: true,
        count: permissions.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: permissions,
      });
    } catch (err) {
      logger.error(`Error fetching photo permissions: ${err.message}`);
      respondError(res, 500, "Failed to fetch photo permissions");
    }
  })
);

/**
 * GET /api/users/search
 * Advanced user search/filter
 */
router.get(
  "/search",
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const q = { _id: { $ne: req.user._id } };
    if (req.query.nickname) q.nickname = { $regex: req.query.nickname, $options: "i" };
    if (req.query.gender) q["details.gender"] = req.query.gender;
    if (req.query.minAge) q["details.age"] = { ...q["details.age"], $gte: +req.query.minAge };
    if (req.query.maxAge) q["details.age"] = { ...q["details.age"], $lte: +req.query.maxAge };
    if (req.query.location) q["details.location"] = { $regex: req.query.location, $options: "i" };
    if (req.query.interests) {
      const arr = req.query.interests.split(",").map((i) => i.trim());
      q["details.interests"] = { $in: arr };
    }
    if (req.query.online === "true") q.isOnline = true;

    const users = await User.find(q)
      .select("nickname details photos isOnline lastActive settings")
      .sort({ isOnline: -1, lastActive: -1 })
      .skip(skip)
      .limit(limit);
    const total = await User.countDocuments(q);

    const data = users.map((u) => {
      const o = u.toObject();
      if (o.settings?.privacy?.showOnlineStatus === false) o.isOnline = false;
      delete o.settings;
      return o;
    });

    res.json({
      success: true,
      count: data.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data,
    });
  })
);

/**
 * GET /api/users/matches
 * Get mutual likes ("matches")
 */
router.get(
  "/matches",
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const liked = await Like.find({ sender: req.user._id }).select("recipient");
    const likedIds = liked.map((l) => l.recipient);
    const q = { sender: { $in: likedIds }, recipient: req.user._id };

    const matches = await Like.find(q)
      .populate("sender", "nickname photos isOnline lastActive details")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Like.countDocuments(q);

    res.json({
      success: true,
      count: matches.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: matches,
    });
  })
);

/**
 * POST /api/users/:id/like
 * Like another user
 */
router.post(
  "/:id/like",
  protect,
  canLikeUser,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");
    const target = await User.findById(id);
    if (!target) return respondError(res, 404, "User not found");

    const exists = await Like.findOne({ sender: req.user._id, recipient: id });
    if (exists) return res.json({ success: false, error: "Already liked" });

    const like = new Like({ sender: req.user._id, recipient: id });
    await like.save();

    // If FREE tier, decrement
    if (req.user.accountTier === "FREE") {
      req.user.dailyLikesRemaining--;
      await req.user.save();
    }

    const mutual = await Like.exists({ sender: id, recipient: req.user._id });

    // Send notification for the like
    const io = req.app.get('io');
    if (io) {
      await sendLikeNotification(io, req.user, target, {
        _id: like._id,
        isMatch: !!mutual
      });
    }

    res.json({
      success: true,
      message: `You liked ${target.nickname}`,
      likesRemaining: req.user.accountTier === "FREE" ? req.user.dailyLikesRemaining : undefined,
      isMatch: !!mutual,
    });
  })
);

/**
 * DELETE /api/users/:id/like
 * Unlike someone
 */
router.delete(
  "/:id/like",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");
    const target = await User.findById(id);
    if (!target) return respondError(res, 404, "User not found");

    const deleted = await Like.findOneAndDelete({ sender: req.user._id, recipient: id });
    if (!deleted) return respondError(res, 404, `You haven't liked ${target.nickname}`);

    res.json({ success: true, message: `You unliked ${target.nickname}` });
  })
);

/**
 * GET /api/users/settings
 * Fetch your settings
 */
router.get("/settings", protect, async (req, res) => {
  const user = await User.findById(req.user._id).select("settings");
  if (!user) return respondError(res, 404, "User not found");
  res.json({ success: true, data: user.settings || {} });
});

/**
 * PUT /api/users/settings
 * Save your settings
 */
router.put("/settings", protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return respondError(res, 404, "User not found");
  user.settings = req.body;
  await user.save();
  res.json({ success: true, data: user.settings });
});

/**
 * PUT /api/users/settings/notifications
 * Update only notification settings
 */
router.put("/settings/notifications", protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return respondError(res, 404, "User not found");
  user.settings = user.settings || {};
  user.settings.notifications = req.body.notifications;
  await user.save();
  res.json({ success: true, data: user.settings });
});

/**
 * PUT /api/users/settings/privacy
 * Update privacy settings
 */
router.put("/settings/privacy", protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return respondError(res, 404, "User not found");
  user.settings = user.settings || {};
  user.settings.privacy = req.body.privacy;
  await user.save();
  res.json({ success: true, data: user.settings });
});

/**
 * GET /api/users/:id/photo-access-status
 * Check private photo access status
 */
router.get(
  "/:id/photo-access-status",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");

    const target = await User.findById(id).select("photos settings");
    if (!target) return respondError(res, 404, "User not found");

    const privatePhotos = target.photos.filter((p) => p.privacy === 'private');
    if (!privatePhotos.length) {
      return res.json({ success: true, status: "approved", message: "No private photos" });
    }
    
    // Owner always has access
    if (req.user._id.toString() === id) {
      return res.json({ success: true, status: "approved", message: "Owner" });
    }
    
    // Check for permissions in the database
    const privatePhotoIds = privatePhotos.map(p => p._id);
    const permissions = await PhotoPermission.find({
      photo: { $in: privatePhotoIds },
      requestedBy: req.user._id
    });
    
    // Check for existing permissions
    if (permissions.length > 0) {
      // If all permissions are approved
      if (permissions.every(p => p.status === 'approved')) {
        return res.json({ success: true, status: "approved", message: "Access granted" });
      }
      
      // If all permissions are rejected
      if (permissions.every(p => p.status === 'rejected')) {
        return res.json({ success: true, status: "rejected", message: "Access denied" });
      }
      
      // If some permissions are pending
      if (permissions.some(p => p.status === 'pending')) {
        return res.json({ success: true, status: "pending", message: "Request awaiting approval" });
      }
    }
    
    // Default case: No permissions yet
    return res.json({ success: true, status: "none", message: "No access" });
  })
);

/**
 * POST /api/users/:id/block
 * Block someone
 */
router.post(
  "/:id/block",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");
    if (req.user._id.toString() === id) return respondError(res, 400, "Cannot block yourself");

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { blockedUsers: id } });
    res.json({ success: true, message: "User blocked" });
  })
);

/**
 * DELETE /api/users/:id/block
 * Unblock someone
 */
router.delete(
  "/:id/block",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");

    await User.findByIdAndUpdate(req.user._id, { $pull: { blockedUsers: id } });
    res.json({ success: true, message: "User unblocked" });
  })
);

/**
 * GET /api/users/blocked
 * List blocked users - production grade implementation
 */
router.get(
  "/blocked",
  protect, // Use the standard protect middleware
  asyncHandler(async (req, res) => {
    try {
      // User ID is already available from the protect middleware
      const userId = req.user._id;
      logger.debug(`Getting blocked users for user ID: ${userId}`);
      
      // Find user and blocked users
      const user = await User.findById(userId).select("blockedUsers");
      if (!user) {
        logger.error(`User not found with ID: ${userId}`);
        return res.status(404).json({ success: false, error: "User not found" });
      }
      
      // Handle case when blockedUsers isn't an array 
      if (!Array.isArray(user.blockedUsers)) {
        user.blockedUsers = [];
        await user.save();
      }
      
      // Get details of blocked users
      const blockedUsers = [];
      if (user.blockedUsers.length > 0) {
        const validIds = user.blockedUsers.filter(id => 
          id && mongoose.Types.ObjectId.isValid(id.toString())
        );
        
        if (validIds.length > 0) {
          const blockedData = await User.find({ 
            _id: { $in: validIds }
          })
          .select("nickname photos isOnline lastActive")
          .lean();
          
          blockedUsers.push(...blockedData);
        }
      }
      
      return res.json({
        success: true,
        count: blockedUsers.length,
        data: blockedUsers
      });
    } catch (err) {
      // Log error but respond with a proper error message
      logger.error(`Blocked users error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve blocked users"
      });
    }
  })
);

/**
 * POST /api/users/:id/report
 * Report a user
 */
router.post(
  "/:id/report",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");
    if (req.user._id.toString() === id) return respondError(res, 400, "Cannot report yourself");

    logger.warn(`REPORT by ${req.user._id} on ${id}: ${reason || "no reason"}`);
    res.json({ success: true, message: "Report received" });
  })
);

/**
 * DELETE /api/users/:id
 * Soft-delete an account (self or admin)
 */
router.delete(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (req.user._id.toString() !== id && req.user.role !== "admin")
      return respondError(res, 403, "Not authorized");
    const user = await User.findById(id);
    if (!user) return respondError(res, 404, "User not found");

    user.active = false;
    user.deletedAt = new Date();
    user.deletedBy = req.user._id;
    await user.save();
    res.json({ success: true, message: "Account deleted" });
  })
);

/**
 * POST /api/users/photos/permissions/approve-all
 * Approve all pending photo requests
 */
router.post(
  "/photos/permissions/approve-all",
  protect,
  asyncHandler(async (req, res) => {
    try {
      // Find all pending permission requests where this user is the owner
      const pending = await PhotoPermission.find({
        photoOwnerId: req.user._id,
        status: "pending",
      });
      
      if (!pending.length) {
        return res.json({ 
          success: true, 
          message: "No pending requests", 
          approvedCount: 0 
        });
      }

      // Approve all pending requests
      await Promise.all(
        pending.map(async (permission) => {
          return permission.approve();
        })
      );

      res.json({
        success: true,
        message: `Approved ${pending.length} requests`,
        approvedCount: pending.length,
      });
    } catch (err) {
      logger.error(`Error approving all photo permissions: ${err.message}`);
      respondError(res, 500, "Failed to approve photo permissions");
    }
  })
);

/**
 * POST /api/users/request-photo-access
 * Request access to a user's private photos
 */
router.post(
  "/request-photo-access/:userId",
  protect,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { message } = req.body;
    
    if (!isValidId(userId)) {
      return respondError(res, 400, "Invalid user ID");
    }
    
    // Cannot request access to your own photos
    if (req.user._id.toString() === userId) {
      return respondError(res, 400, "Cannot request access to your own photos");
    }
    
    try {
      // Get the target user's private photos
      const targetUser = await User.findById(userId).select("photos");
      if (!targetUser) {
        return respondError(res, 404, "User not found");
      }
      
      // Find all private photos
      const privatePhotos = targetUser.photos.filter(photo => 
        photo.privacy === 'private' && !photo.isDeleted
      );
      
      if (privatePhotos.length === 0) {
        return respondError(res, 400, "User has no private photos");
      }
      
      // Create permission requests for each private photo
      const permissionRequests = privatePhotos.map(photo => ({
        photo: photo._id,
        requestedBy: req.user._id,
        photoOwnerId: targetUser._id,
        message: message || '',
        status: 'pending'
      }));
      
      // Insert the permission requests
      const results = await PhotoPermission.insertMany(permissionRequests, { 
        ordered: false,
        // Skip documents that violate the unique constraint
        // (photo + requestedBy combination must be unique)
        // This prevents duplicate requests for the same photo
        skipDuplicates: true
      });
      
      // Send notification for the photo permission request
      const io = req.app.get('io');
      if (io) {
        // Send notification for each permission created
        for (const permission of results) {
          await sendPhotoPermissionRequestNotification(io, req.user, targetUser, permission);
        }
      }
      
      return res.status(201).json({
        success: true,
        message: `Requested access to ${results.length} private photos`,
        requestCount: results.length,
        data: results
      });
    } catch (err) {
      logger.error(`Error requesting photo access: ${err.message}`);
      // If the error is validation related (e.g., already requested)
      if (err.name === 'ValidationError' || err.code === 11000) {
        return respondError(res, 400, err.message || "Error processing request");
      }
      respondError(res, 500, "Failed to request photo access");
    }
  })
);

/**
 * PUT /api/users/respond-photo-access/:userId
 * Respond to all photo access requests from a specific user
 */
router.put(
  "/respond-photo-access/:userId",
  protect,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { status, message } = req.body;
    
    if (!isValidId(userId)) {
      return respondError(res, 400, "Invalid user ID");
    }
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return respondError(res, 400, "Status must be 'approved' or 'rejected'");
    }
    
    try {
      // Find all pending photo permission requests from this user
      const permissions = await PhotoPermission.find({
        requestedBy: userId,
        photoOwnerId: req.user._id,
        status: 'pending'
      });
      
      if (permissions.length === 0) {
        return res.json({
          success: true,
          message: "No pending requests from this user",
          updatedCount: 0
        });
      }
      
      // Process all permissions
      for (const permission of permissions) {
        if (status === 'approved') {
          await permission.approve();
        } else {
          await permission.reject(message);
        }
      }
      
      // Send notifications for the response
      const io = req.app.get('io');
      if (io) {
        const requester = await User.findById(userId);
        if (requester) {
          for (const permission of permissions) {
            await sendPhotoPermissionResponseNotification(io, req.user, requester, permission);
          }
        }
      }
      
      return res.json({
        success: true,
        message: `${status === 'approved' ? 'Approved' : 'Rejected'} ${permissions.length} photo access requests`,
        updatedCount: permissions.length
      });
    } catch (err) {
      logger.error(`Error responding to photo access: ${err.message}`);
      respondError(res, 500, "Failed to respond to photo access requests");
    }
  })
);

/**
 * PUT /api/users/photos/permissions/:permissionId
 * Respond to a specific photo permission request
 */
router.put(
  "/photos/permissions/:permissionId",
  protect,
  asyncHandler(async (req, res) => {
    const { permissionId } = req.params;
    const { status, message } = req.body;
    
    if (!isValidId(permissionId)) {
      return respondError(res, 400, "Invalid permission ID");
    }
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return respondError(res, 400, "Status must be 'approved' or 'rejected'");
    }
    
    try {
      // Find the permission request
      const permission = await PhotoPermission.findById(permissionId);
      
      if (!permission) {
        return respondError(res, 404, "Permission request not found");
      }
      
      // Verify the user is the photo owner
      if (permission.photoOwnerId.toString() !== req.user._id.toString()) {
        return respondError(res, 403, "Not authorized to respond to this request");
      }
      
      // Update the permission
      if (status === 'approved') {
        await permission.approve();
      } else {
        await permission.reject(message);
      }
      
      // Send notification for the response
      const io = req.app.get('io');
      if (io) {
        const requester = await User.findById(permission.requestedBy);
        if (requester) {
          await sendPhotoPermissionResponseNotification(io, req.user, requester, permission);
        }
      }
      
      return res.json({
        success: true,
        message: `Request ${status}`,
        data: permission
      });
    } catch (err) {
      logger.error(`Error updating permission: ${err.message}`);
      respondError(res, 500, "Failed to update permission");
    }
  })
);

/**
 * GET /api/users/photos/permissions/pending
 * Get the count of pending photo access requests
 */
router.get(
  "/photos/permissions/pending/count",
  protect,
  asyncHandler(async (req, res) => {
    try {
      // Count all pending permission requests where this user is the owner
      const pendingCount = await PhotoPermission.countDocuments({
        photoOwnerId: req.user._id,
        status: "pending",
      });
      
      res.json({
        success: true,
        pendingCount
      });
    } catch (err) {
      logger.error(`Error counting pending permissions: ${err.message}`);
      respondError(res, 500, "Failed to count pending permissions");
    }
  })
);

/**
 * POST /api/users/grant-photo-access/:userId
 * Directly grant a user access to all your private photos
 */
router.post(
  "/grant-photo-access/:userId",
  protect,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { message } = req.body;
    
    if (!isValidId(userId)) {
      return respondError(res, 400, "Invalid user ID");
    }
    
    // Cannot grant access to yourself
    if (req.user._id.toString() === userId) {
      return respondError(res, 400, "Cannot grant access to your own photos");
    }
    
    try {
      // Get your own private photos
      const currentUser = await User.findById(req.user._id).select("photos");
      if (!currentUser) {
        return respondError(res, 404, "User not found");
      }
      
      // Find all private photos
      const privatePhotos = currentUser.photos.filter(photo => 
        photo.privacy === 'private' && !photo.isDeleted
      );
      
      if (privatePhotos.length === 0) {
        return respondError(res, 400, "You have no private photos to grant access to");
      }
      
      // Get the recipient user
      const recipientUser = await User.findById(userId);
      if (!recipientUser) {
        return respondError(res, 404, "Recipient user not found");
      }
      
      // Create approved permissions for each private photo
      const permissions = [];
      for (const photo of privatePhotos) {
        // Check if permission already exists
        const existingPermission = await PhotoPermission.findOne({
          photo: photo._id,
          requestedBy: userId,
          photoOwnerId: req.user._id
        });
        
        if (existingPermission) {
          // If it exists, approve it if it's not already approved
          if (existingPermission.status !== 'approved') {
            await existingPermission.approve();
            permissions.push(existingPermission);
          }
        } else {
          // Create a new approved permission
          const newPermission = new PhotoPermission({
            photo: photo._id,
            requestedBy: userId,
            photoOwnerId: req.user._id,
            message: message || 'Access granted by photo owner',
            status: 'approved',
            respondedAt: new Date()
          });
          await newPermission.save();
          permissions.push(newPermission);
        }
      }
      
      // Send notification for the granted access
      const io = req.app.get('io');
      if (io) {
        for (const permission of permissions) {
          await sendPhotoPermissionResponseNotification(io, req.user, recipientUser, permission);
        }
      }
      
      return res.status(201).json({
        success: true,
        message: `Granted access to ${permissions.length} private photos`,
        grantedCount: permissions.length,
        data: permissions
      });
    } catch (err) {
      logger.error(`Error granting photo access: ${err.message}`);
      respondError(res, 500, "Failed to grant photo access");
    }
  })
);

export default router;