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
 * Get paginated list of users you’ve liked
 */
router.get(
  "/likes",
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const userId = safeId(req.user.id);
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
    const q = { id: { $ne: req.user.id } };
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

    const uObj = user.toObject();
    if (uObj.settings?.privacy?.showOnlineStatus === false) uObj.isOnline = false;
    delete uObj.settings;

    const { page, limit, skip } = paginate(req);
    const mQuery = {
      $or: [
        { sender: req.user.id, recipient: id },
        { sender: id, recipient: req.user.id },
      ],
    };
    const messages = await Message.find(mQuery).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const totalMessages = await Message.countDocuments(mQuery);

    const liked = await Like.exists({ sender: req.user.id, recipient: id });
    const mutual = await Like.exists({ sender: id, recipient: req.user.id });

    res.json({
      success: true,
      data: {
        user: uObj,
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
 * List your permission requests for someone’s private photos
 */
router.get(
  "/:id/photo-permissions",
  enhancedProtect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");
    const target = await User.findById(id).select("photos");
    if (!target) return respondError(res, 404, "User not found");

    const privateIds = target.photos.filter((p) => p.isPrivate).map((p) => p.id);
    if (privateIds.length === 0) return res.json({ success: true, data: [] });

    const permissions = await PhotoPermission.find({
      photo: { $in: privateIds },
      requestedBy: req.user.id,
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
      const existing = (await User.findById(req.user.id)).settings || {};
      updates.settings = { ...existing, ...settings };
    }

    try {
      const user = await User.findByIdAndUpdate(req.user.id, updates, {
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
    if ((req.user.photos || []).length >= 10) {
      fs.unlinkSync(req.file.path);
      return respondError(res, 400, "Max 10 photos");
    }

    try {
      const meta = await processImage(req.file.path);
      const url = `/uploads/images/${path.basename(req.file.path)}`;
      const photo = { url, isPrivate: req.body.isPrivate === "true", metadata: meta };
      req.user.photos.push(photo);
      await req.user.save();

      res.json({
        success: true,
        data: req.user.photos.slice(-1)[0],
        isProfilePhoto: req.user.photos.length === 1,
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
 * Toggle a photo’s privacy
 */
router.put(
  "/photos/:id/privacy",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid photo ID");
    if (typeof req.body.isPrivate !== "boolean")
      return respondError(res, 400, "isPrivate must be boolean");

    const user = await User.findOne({ id: req.user.id, "photos.id": id });
    if (!user) return respondError(res, 404, "Photo not found");

    const p = user.photos.id(id);
    p.isPrivate = req.body.isPrivate;
    await user.save();
    res.json({ success: true, data: p });
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
    if (!isValidId(id)) return respondError(res, 400, "Invalid photo ID");

    const user = await User.findOne({ id: req.user.id, "photos.id": id });
    if (!user) return respondError(res, 404, "Photo not found");

    const p = user.photos.id(id);
    user.photos.pull(id);
    user.photos.unshift(p);
    await user.save();
    res.json({ success: true, data: user.photos });
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
    if (!isValidId(id)) return respondError(res, 400, "Invalid photo ID");

    const user = await User.findOne({ id: req.user.id, "photos.id": id });
    if (!user) return respondError(res, 404, "Photo not found");
    if (user.photos.length === 1) return respondError(res, 400, "Cannot delete only photo");

    const p = user.photos.id(id);
    if (user.photos[0].id.toString() === id)
      return respondError(res, 400, "Cannot delete profile photo");

    user.photos.pull(id);
    await user.save();

    const filePath = path.join(config.FILE_UPLOAD_PATH, "images", path.basename(p.url));
    if (fs.existsSync(filePath)) {
      const delDir = path.join(config.FILE_UPLOAD_PATH, "deleted");
      fs.mkdirSync(delDir, { recursive: true });
      fs.renameSync(filePath, path.join(delDir, path.basename(filePath)));
    }

    res.json({ success: true, message: "Photo deleted", data: { photoId: id } });
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
    const photoIds = (req.user.photos || []).map((p) => p.id);
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
    const q = { id: { $ne: req.user.id } };
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
 * Get mutual likes (“matches”)
 */
router.get(
  "/matches",
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const liked = await Like.find({ sender: req.user.id }).select("recipient");
    const likedIds = liked.map((l) => l.recipient);
    const q = { sender: { $in: likedIds }, recipient: req.user.id };

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

    const exists = await Like.findOne({ sender: req.user.id, recipient: id });
    if (exists) return res.json({ success: false, error: "Already liked" });

    const like = new Like({ sender: req.user.id, recipient: id });
    await like.save();

    // If FREE tier, decrement
    if (req.user.accountTier === "FREE") {
      req.user.dailyLikesRemaining--;
      await req.user.save();
    }

    const mutual = await Like.exists({ sender: id, recipient: req.user.id });

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

    const deleted = await Like.findOneAndDelete({ sender: req.user.id, recipient: id });
    if (!deleted) return respondError(res, 404, `You haven't liked ${target.nickname}`);

    res.json({ success: true, message: `You unliked ${target.nickname}` });
  })
);

/**
 * GET /api/users/settings
 * Fetch your settings
 */
router.get("/settings", protect, async (req, res) => {
  const user = await User.findById(req.user.id).select("settings");
  if (!user) return respondError(res, 404, "User not found");
  res.json({ success: true, data: user.settings || {} });
});

/**
 * PUT /api/users/settings
 * Save your settings
 */
router.put("/settings", protect, async (req, res) => {
  const user = await User.findById(req.user.id);
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
  const user = await User.findById(req.user.id);
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
  const user = await User.findById(req.user.id);
  if (!user) return respondError(res, 404, "User not found");
  user.settings = user.settings || {};
  user.settings.privacy = req.body.privacy;
  await user.save();
  res.json({ success: true, data: user.settings });
});

/**
 * GET /api/users/:id/photo-access-status
 * Check overall access status for someone’s private photos
 */
router.get(
  "/:id/photo-access-status",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");

    const target = await User.findById(id).select("photos");
    if (!target) return respondError(res, 404, "User not found");

    const privatePhotos = target.photos.filter((p) => p.isPrivate);
    if (!privatePhotos.length) {
      return res.json({ success: true, status: "approved", message: "No private photos" });
    }
    if (req.user.id.toString() === id) {
      return res.json({ success: true, status: "approved", message: "Owner" });
    }

    const requests = await PhotoPermission.find({
      photo: { $in: privatePhotos.map((p) => p.id) },
      requestedBy: req.user.id,
    });

    if (!requests.length) {
      return res.json({ success: true, status: "none", message: "No requests" });
    }
    if (requests.some((r) => r.status === "approved")) {
      return res.json({
        success: true,
        status: "approved",
        message: "At least one approved",
      });
    }
    if (requests.every((r) => r.status === "rejected")) {
      return res.json({ success: true, status: "rejected", message: "All rejected" });
    }
    res.json({ success: true, status: "pending", message: "Requests pending" });
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
    if (req.user.id.toString() === id) return respondError(res, 400, "Cannot block yourself");

    await User.findByIdAndUpdate(req.user.id, { $addToSet: { blockedUsers: id } });
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

    await User.findByIdAndUpdate(req.user.id, { $pull: { blockedUsers: id } });
    res.json({ success: true, message: "User unblocked" });
  })
);

/**
 * GET /api/users/blocked
 * List blocked users
 */
router.get(
  "/blocked",
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
      .select("blockedUsers")
      .populate("blockedUsers", "nickname photos isOnline lastActive");
    if (!user) return respondError(res, 404, "User not found");
    res.json({ success: true, count: user.blockedUsers.length, data: user.blockedUsers });
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
    if (req.user.id.toString() === id) return respondError(res, 400, "Cannot report yourself");

    logger.warn(`REPORT by ${req.user.id} on ${id}: ${reason || "no reason"}`);
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
    if (req.user.id.toString() !== id && req.user.role !== "admin")
      return respondError(res, 403, "Not authorized");
    const user = await User.findById(id);
    if (!user) return respondError(res, 404, "User not found");

    user.active = false;
    user.deletedAt = new Date();
    user.deletedBy = req.user.id;
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
      photoOwnerId: req.user.id,
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
 * POST /api/users/:id/request-photo-access
 * Request access to all of someone’s private photos
 */
router.post(
  "/:id/request-photo-access",
  protect,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return respondError(res, 400, "Invalid user ID");
    if (req.user.id.toString() === id)
      return respondError(res, 400, "Cannot request your own photos");

    const owner = await User.findById(id).select("photos");
    if (!owner) return respondError(res, 404, "User not found");

    const privatePhotos = owner.photos.filter((p) => p.isPrivate);
    if (!privatePhotos.length)
      return res.json({
        success: true,
        message: "No private photos",
        requests: [],
      });

    const results = [];
    for (const p of privatePhotos) {
      let reqDoc = await PhotoPermission.findOne({
        photo: p.id,
        requestedBy: req.user.id,
      });
      if (!reqDoc) {
        reqDoc = new PhotoPermission({
          photo: p.id,
          requestedBy: req.user.id,
          photoOwnerId: id,
          status: "pending",
          createdAt: new Date(),
        });
        await reqDoc.save();
      } else if (reqDoc.status === "rejected") {
        reqDoc.status = "pending";
        reqDoc.updatedAt = new Date();
        await reqDoc.save();
      }
      results.push(reqDoc);
    }

    res.json({
      success: true,
      message: `Requested access to ${results.length} photos`,
      requests: results,
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
      photoOwnerId: req.user.id,
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
      photoOwnerId: req.user.id,
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
    if (!photo.isPrivate) return respondError(res, 400, "Photo not private");
    if (owner.id.toString() === req.user.id.toString())
      return respondError(res, 400, "Cannot request own photo");

    let perm = await PhotoPermission.findOne({ photo: id, requestedBy: req.user.id });
    if (perm) return res.json({ success: true, data: perm, message: "Already requested" });

    perm = new PhotoPermission({ photo: id, requestedBy: req.user.id, status: "pending" });
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
    const owner = await User.findOne({ id: req.user.id, "photos.id": perm.photo });
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
