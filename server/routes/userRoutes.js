// routes/userRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { User, PhotoPermission, Message } = require('../models');
const config = require('../config');
const { protect, asyncHandler } = require('../middleware/auth');
const logger = require('../logger');
const router = express.Router();

// Set up multer storage for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = config.FILE_UPLOAD_PATH;
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create more unique filename with original extension
    const fileExt = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed'));
  }
});

/**
 * @route   GET /api/users
 * @desc    Get all online users except current user
 * @access  Private
 */
router.get('/', protect, asyncHandler(async (req, res) => {
  logger.debug(`Fetching online users for user ${req.user._id}`);

  try {
    const users = await User.find({
      isOnline: true,
      _id: { $ne: req.user._id }
    }).select('nickname details photos isOnline lastActive');

    logger.debug(`Found ${users.length} online users`);

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    logger.error(`Error fetching users: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

/**
 * @route   GET /api/users/:id
 * @desc    Get a single user and message history with that user
 * @access  Private
 */
router.get('/:id', protect, asyncHandler(async (req, res) => {
  logger.debug(`Fetching user profile for ${req.params.id}`);

  try {
    // Find requested user
    const user = await User.findById(req.params.id)
      .select('nickname details photos isOnline lastActive');

    if (!user) {
      logger.warn(`User not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get message history
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: req.params.id },
        { sender: req.params.id, recipient: req.user._id }
      ]
    }).sort({ createdAt: -1 });

    logger.debug(`Returning user profile with ${messages.length} messages`);

    res.status(200).json({
      success: true,
      data: { user, messages }
    });
  } catch (err) {
    logger.error(`Error fetching user: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user's profile
 * @access  Private
 */
router.put('/profile', protect, asyncHandler(async (req, res) => {
  logger.debug(`Updating profile for user ${req.user._id}`);

  try {
    const { nickname, details } = req.body;
    const updateData = {};

    // Only update fields that are provided
    if (nickname) updateData.nickname = nickname;
    if (details) {
      // Ensure we don't overwrite existing fields not included in the request
      updateData.details = { ...req.user.details, ...details };

      // Handle interests as array if it comes as a string
      if (typeof details.interests === 'string') {
        updateData.details.interests = details.interests
          .split(',')
          .map(interest => interest.trim())
          .filter(interest => interest.length > 0);
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    logger.info(`Profile updated for user ${req.user._id}`);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    logger.error(`Error updating profile: ${err.message}`);

    // Special handling for duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }

    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

/**
 * @route   POST /api/users/photos
 * @desc    Upload photo for current user
 * @access  Private
 */
router.post('/photos', protect, upload.single('photo'), asyncHandler(async (req, res) => {
  logger.debug(`Processing photo upload for user ${req.user._id}`);

  try {
    if (!req.file) {
      logger.warn('Photo upload failed: No file provided');
      return res.status(400).json({
        success: false,
        error: 'Please upload a file'
      });
    }

    const { isPrivate } = req.body;
    const isPrivateBoolean = isPrivate === 'true' || isPrivate === true;

    // Add photo to user's photos array
    const photo = {
      url: `/uploads/${req.file.filename}`,
      isPrivate: isPrivateBoolean
    };

    req.user.photos.push(photo);
    await req.user.save();

    const newPhoto = req.user.photos[req.user.photos.length - 1];

    logger.info(`Photo uploaded for user ${req.user._id} (isPrivate: ${isPrivateBoolean})`);

    res.status(200).json({
      success: true,
      data: newPhoto
    });
  } catch (err) {
    logger.error(`Error uploading photo: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

/**
 * @route   POST /api/photos/:id/request
 * @desc    Request permission to view a private photo
 * @access  Private
 */
router.post('/photos/:id/request', protect, asyncHandler(async (req, res) => {
  const photoId = req.params.id;
  const { userId } = req.body;

  logger.debug(`User ${req.user._id} requesting access to photo ${photoId} from user ${userId}`);

  try {
    // Find user who owns the photo
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`Photo access request failed: User ${userId} not found`);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Find photo in user's photos
    const photo = user.photos.id(photoId);
    if (!photo) {
      logger.warn(`Photo access request failed: Photo ${photoId} not found`);
      return res.status(404).json({
        success: false,
        error: 'Photo not found'
      });
    }

    // Verify photo is private
    if (!photo.isPrivate) {
      logger.warn(`Photo access request failed: Photo ${photoId} is not private`);
      return res.status(400).json({
        success: false,
        error: 'Photo is not private'
      });
    }

    // Check if permission request already exists
    let permission = await PhotoPermission.findOne({
      photo: photoId,
      requestedBy: req.user._id
    });

    if (permission) {
      logger.warn(`Photo access request failed: Request already exists`);
      return res.status(400).json({
        success: false,
        error: 'Permission request already exists'
      });
    }

    // Create permission request
    permission = await PhotoPermission.create({
      photo: photoId,
      requestedBy: req.user._id
    });

    logger.info(`Photo access request created: ${permission._id}`);

    res.status(201).json({
      success: true,
      data: permission
    });
  } catch (err) {
    logger.error(`Error requesting photo access: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

/**
 * @route   PUT /api/photos/permissions/:id
 * @desc    Approve or reject a photo permission request
 * @access  Private
 */
router.put('/photos/permissions/:id', protect, asyncHandler(async (req, res) => {
  const permissionId = req.params.id;
  const { status } = req.body;

  logger.debug(`Updating photo permission ${permissionId} to ${status}`);

  try {
    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      logger.warn(`Invalid permission status: ${status}`);
      return res.status(400).json({
        success: false,
        error: 'Status must be either "approved" or "rejected"'
      });
    }

    // Find permission
    const permission = await PhotoPermission.findById(permissionId);
    if (!permission) {
      logger.warn(`Permission ${permissionId} not found`);
      return res.status(404).json({
        success: false,
        error: 'Permission request not found'
      });
    }

    // Verify that the current user owns the photo
    const user = await User.findOne({
      _id: req.user._id,
      'photos._id': permission.photo
    });

    if (!user) {
      logger.warn(`User ${req.user._id} not authorized to update permission ${permissionId}`);
      return res.status(401).json({
        success: false,
        error: 'Not authorized to update this permission'
      });
    }

    // Update permission
    permission.status = status;
    await permission.save();

    logger.info(`Permission ${permissionId} updated to ${status}`);

    res.status(200).json({
      success: true,
      data: permission
    });
  } catch (err) {
    logger.error(`Error updating permission: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

module.exports = router;
