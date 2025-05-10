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
    
    // Apply photo privacy filtering
    if (targetUser.photos && Array.isArray(targetUser.photos)) {
      // Get only non-deleted photos
      targetUser.photos = targetUser.photos.filter(photo => !photo.isDeleted);
      
      // If not the owner, apply privacy filters
      if (!isOwner) {
        targetUser.photos = targetUser.photos.filter(photo => {
          return photo.privacy === 'public';
          // Add friends_only handling here when implementing friendship system
        });
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
    const photoIds = (req.user.photos || []).map((p) => p._id);
    const { page, limit, skip } = paginate(req);
    const q = { photo: { $in: photoIds } };
    if (["pending", "approved", "rejected"].includes(req.query.status)) q.status = req.query.status;

    const perms = await PhotoPermission.find(q)
      .populate("requestedBy", "nickname photos")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await PhotoPermission.countDocuments(q);

    res.json({
      success: true,
      count: perms.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: perms,
    });
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

    // Notify via socket (omitted for brevity)...

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
    
    // Check if user has allowed private photos
    const allowPrivatePhotos = target.settings?.privacy?.allowPrivatePhotos;
    
    if (allowPrivatePhotos) {
      return res.json({ success: true, status: "approved", message: "Access allowed" });
    } else {
      return res.json({ success: true, status: "none", message: "No access" });
    }
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
 * POST /api/users/photos/approve-all
 * Approve all pending photo requests
 */
router.post(
  "/photos/approve-all",
  protect,
  asyncHandler(async (req, res) => {
    const pending = await PhotoPermission.find({
      photoOwnerId: req.user._id,
      status: "pending",
    });
    if (!pending.length)
      return res.json({ success: true, message: "No pending requests", approvedCount: 0 });

    await Promise.all(
      pending.map((r) => {
        r.status = "approved";
        r.updatedAt = new Date();
        return r.save();
      })
    );
    res.json({
      success: true,
      message: `Approved ${pending.length} requests`,
      approvedCount: pending.length,
    });
  })
);

/**
 * POST /api/users/:id/allow-private-photos
 * Allow access to private photos
 */
router.post(
  "/:id/allow-private-photos",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");
    
    // Only the owner can allow private photos
    if (req.user._id.toString() !== id) {
      return respondError(res, 403, "Only the owner can allow private photos");
    }

    // Update the user's privacy settings
    const user = await User.findById(id);
    if (!user) return respondError(res, 404, "User not found");
    
    // Ensure settings object exists
    if (!user.settings) user.settings = {};
    if (!user.settings.privacy) user.settings.privacy = {};
    
    // Set allowPrivatePhotos to true
    user.settings.privacy.allowPrivatePhotos = true;
    await user.save();

    res.json({
      success: true,
      message: "Private photos access allowed",
      data: { allowPrivatePhotos: true }
    });
  })
);

/**
 * PUT /api/users/:id/approve-photo-access
 * Approve all pending requests from a specific user
 */
router.put(
  "/:id/approve-photo-access",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");

    const pending = await PhotoPermission.find({
      requestedBy: id,
      photoOwnerId: req.user._id,
      status: "pending",
    });
    if (!pending.length)
      return res.json({ success: true, message: "No requests", approvedCount: 0 });

    pending.forEach((r) => {
      r.status = "approved";
      r.updatedAt = new Date();
      r.respondedAt = new Date();
      r.save();
    });

    res.json({
      success: true,
      message: `Approved ${pending.length} requests`,
      approvedCount: pending.length,
    });
  })
);

/**
 * PUT /api/users/:id/reject-photo-access
 * Reject all pending requests from a specific user
 */
router.put(
  "/:id/reject-photo-access",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");

    const pending = await PhotoPermission.find({
      requestedBy: id,
      photoOwnerId: req.user._id,
      status: "pending",
    });
    if (!pending.length)
      return res.json({ success: true, message: "No requests", rejectedCount: 0 });

    pending.forEach((r) => {
      r.status = "rejected";
      r.updatedAt = new Date();
      r.respondedAt = new Date();
      r.save();
    });

    res.json({
      success: true,
      message: `Rejected ${pending.length} requests`,
      rejectedCount: pending.length,
    });
  })
);

/**
 * POST /api/users/photos/:id/request
 * Request access to a single photo
 */
router.post(
  "/photos/:id/request",
  enhancedProtect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    if (!isValidId(id) || !isValidId(userId))
      return respondError(res, 400, "Invalid IDs");

    const owner = await User.findById(userId).select("photos");
    if (!owner) return respondError(res, 404, "User not found");

    const photo = owner.photos.id(id);
    if (!photo) return respondError(res, 404, "Photo not found");
    if (photo.privacy !== 'private') return respondError(res, 400, "Photo not private");
    if (owner._id.toString() === req.user._id.toString())
      return respondError(res, 400, "Cannot request own photo");

    let perm = await PhotoPermission.findOne({ photo: id, requestedBy: req.user._id });
    if (perm) return res.json({ success: true, data: perm, message: "Already requested" });

    perm = new PhotoPermission({ photo: id, requestedBy: req.user._id, status: "pending" });
    await perm.save();

    // socket notification omitted...

    res.status(201).json({ success: true, data: perm });
  })
);

/**
 * PUT /api/users/photos/permissions/:id
 * Respond to a single photo-permission request
 */
router.put(
  "/photos/permissions/:id",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!isValidId(id)) return respondError(res, 400, "Invalid permission ID");
    if (!["approved", "rejected"].includes(status))
      return respondError(res, 400, "Invalid status");

    const perm = await PhotoPermission.findById(id);
    if (!perm) return respondError(res, 404, "Permission not found");

    // Only photo owner may respond
    const owner = await User.findOne({ _id: req.user._id, "photos._id": perm.photo });
    if (!owner) return respondError(res, 403, "Not authorized");

    perm.status = status;
    perm.updatedAt = new Date();
    if (status !== "pending") perm.respondedAt = new Date();
    await perm.save();

    // socket notification omitted...

    res.json({ success: true, data: perm });
  })
);

export default router;