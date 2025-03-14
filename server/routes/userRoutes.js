// routes/userRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { User, PhotoPermission, Message } = require('../models');
const config = require('../config');
const { protect, asyncHandler } = require('../middleware/auth');
const logger = require('../logger');
const mongoose = require('mongoose');
const router = express.Router();

// Set up multer storage for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = config.FILE_UPLOAD_PATH;
    // Create upload directory if it doesn't exist
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

// Configure multer with filters and limits
const upload = multer({
  storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE, // Default 5MB
    files: 1 // Only allow one file per request
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
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
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query with filters
    const query = {
      _id: { $ne: req.user._id }
    };

    // Add optional filters
    if (req.query.online === 'true') {
      query.isOnline = true;
    }

    if (req.query.gender) {
      query['details.gender'] = req.query.gender;
    }

    if (req.query.minAge) {
      query['details.age'] = { ...query['details.age'] || {}, $gte: parseInt(req.query.minAge) };
    }

    if (req.query.maxAge) {
      query['details.age'] = { ...query['details.age'] || {}, $lte: parseInt(req.query.maxAge) };
    }

    if (req.query.location) {
      query['details.location'] = { $regex: req.query.location, $options: 'i' };
    }

    if (req.query.interest) {
      query['details.interests'] = { $in: [req.query.interest] };
    }

    // Execute query with pagination
    const users = await User.find(query)
      .select('nickname details photos isOnline lastActive')
      .sort({ isOnline: -1, lastActive: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await User.countDocuments(query);

    logger.debug(`Found ${users.length} users matching filters`);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page,
      pages: Math.ceil(total / limit),
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
    // Validate the user ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    // Find requested user
    const user = await User.findById(req.params.id)
      .select('nickname details photos isOnline lastActive createdAt');

    if (!user) {
      logger.warn(`User not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get message history with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: req.params.id },
        { sender: req.params.id, recipient: req.user._id }
      ]
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    // Get total count for pagination
    const totalMessages = await Message.countDocuments({
      $or: [
        { sender: req.user._id, recipient: req.params.id },
        { sender: req.params.id, recipient: req.user._id }
      ]
    });

    logger.debug(`Returning user profile with ${messages.length} messages`);

    res.status(200).json({
      success: true,
      data: {
        user,
        messages,
        messagesPagination: {
          total: totalMessages,
          page,
          pages: Math.ceil(totalMessages / limit)
        }
      }
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

    // Validate required fields
    if (nickname && nickname.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Nickname must be at least 3 characters'
      });
    }

    if (details && details.age && (details.age < 18 || details.age > 120)) {
      return res.status(400).json({
        success: false,
        error: 'Age must be between 18 and 120'
      });
    }

    const updateData = {};

    // Only update fields that are provided
    if (nickname) updateData.nickname = nickname.trim();

    if (details) {
      // Ensure we don't overwrite existing fields not included in the request
      updateData.details = { ...req.user.details };

      // Update each provided field
      if (details.age !== undefined) {
        updateData.details.age = parseInt(details.age);
      }

      if (details.gender !== undefined) {
        updateData.details.gender = details.gender;
      }

      if (details.location !== undefined) {
        updateData.details.location = details.location.trim();
      }

      if (details.bio !== undefined) {
        // Validate bio length
        if (details.bio.length > 500) {
          return res.status(400).json({
            success: false,
            error: 'Bio cannot exceed 500 characters'
          });
        }
        updateData.details.bio = details.bio.trim();
      }

      // Handle interests as array if it comes as a string
      if (details.interests !== undefined) {
        if (typeof details.interests === 'string') {
          updateData.details.interests = details.interests
            .split(',')
            .map(interest => interest.trim())
            .filter(interest => interest.length > 0);
        } else if (Array.isArray(details.interests)) {
          // Validate interests format and limit
          if (details.interests.length > 10) {
            return res.status(400).json({
              success: false,
              error: 'Cannot have more than 10 interests'
            });
          }
          updateData.details.interests = details.interests;
        }
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

    // Check if user already has maximum allowed photos (10)
    if (req.user.photos && req.user.photos.length >= 10) {
      // Remove the uploaded file to prevent clutter
      fs.unlinkSync(path.join(config.FILE_UPLOAD_PATH, req.file.filename));

      return res.status(400).json({
        success: false,
        error: 'Maximum number of photos (10) reached. Delete some photos to upload more.'
      });
    }

    // Add photo to user's photos array
    const photo = {
      url: `/uploads/${req.file.filename}`,
      isPrivate: isPrivateBoolean
    };

    // Set as profile photo if it's the first photo
    const isFirstPhoto = !req.user.photos || req.user.photos.length === 0;

    req.user.photos.push(photo);
    await req.user.save();

    const newPhoto = req.user.photos[req.user.photos.length - 1];

    logger.info(`Photo uploaded for user ${req.user._id} (isPrivate: ${isPrivateBoolean})`);

    res.status(200).json({
      success: true,
      data: newPhoto,
      isProfilePhoto: isFirstPhoto
    });
  } catch (err) {
    logger.error(`Error uploading photo: ${err.message}`);

    // If there was an error but the file was uploaded, delete it
    if (req.file) {
      try {
        fs.unlinkSync(path.join(config.FILE_UPLOAD_PATH, req.file.filename));
      } catch (unlinkErr) {
        logger.error(`Error deleting uploaded file after error: ${unlinkErr.message}`);
      }
    }

    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

/**
 * @route   PUT /api/users/photos/:id/privacy
 * @desc    Update photo privacy setting
 * @access  Private
 */
router.put('/photos/:id/privacy', protect, asyncHandler(async (req, res) => {
  const photoId = req.params.id;
  const { isPrivate } = req.body;

  logger.debug(`Updating privacy for photo ${photoId} to ${isPrivate}`);

  try {
    // Validate photo ID format
    if (!mongoose.isValidObjectId(photoId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid photo ID format'
      });
    }

    if (typeof isPrivate !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isPrivate must be a boolean value'
      });
    }

    // Find user with this photo
    const user = await User.findOne({
      _id: req.user._id,
      'photos._id': photoId
    });

    if (!user) {
      logger.warn(`Photo ${photoId} not found or not owned by user ${req.user._id}`);
      return res.status(404).json({
        success: false,
        error: 'Photo not found or not owned by you'
      });
    }

    // Update photo privacy
    const photoIndex = user.photos.findIndex(p => p._id.toString() === photoId);
    user.photos[photoIndex].isPrivate = isPrivate;
    await user.save();

    logger.info(`Photo ${photoId} privacy updated to ${isPrivate}`);

    res.status(200).json({
      success: true,
      data: user.photos[photoIndex]
    });
  } catch (err) {
    logger.error(`Error updating photo privacy: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

/**
 * @route   PUT /api/users/photos/:id/profile
 * @desc    Set photo as profile photo
 * @access  Private
 */
router.put('/photos/:id/profile', protect, asyncHandler(async (req, res) => {
  const photoId = req.params.id;

  logger.debug(`Setting photo ${photoId} as profile photo for user ${req.user._id}`);

  try {
    // Validate photo ID format
    if (!mongoose.isValidObjectId(photoId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid photo ID format'
      });
    }

    // Find user with this photo
    const user = await User.findOne({
      _id: req.user._id,
      'photos._id': photoId
    });

    if (!user) {
      logger.warn(`Photo ${photoId} not found or not owned by user ${req.user._id}`);
      return res.status(404).json({
        success: false,
        error: 'Photo not found or not owned by you'
      });
    }

    // Find the photo index
    const photoIndex = user.photos.findIndex(p => p._id.toString() === photoId);

    // Reorder the photos array to make this photo first
    const photo = user.photos.splice(photoIndex, 1)[0];
    user.photos.unshift(photo);

    await user.save();

    logger.info(`Photo ${photoId} set as profile photo for user ${req.user._id}`);

    res.status(200).json({
      success: true,
      data: user.photos
    });
  } catch (err) {
    logger.error(`Error setting profile photo: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

/**
 * @route   DELETE /api/users/photos/:id
 * @desc    Delete a photo
 * @access  Private
 */
router.delete('/photos/:id', protect, asyncHandler(async (req, res) => {
  const photoId = req.params.id;

  logger.debug(`Deleting photo ${photoId} for user ${req.user._id}`);

  try {
    // Validate photo ID format
    if (!mongoose.isValidObjectId(photoId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid photo ID format'
      });
    }

    // Find user with this photo
    const user = await User.findOne({
      _id: req.user._id,
      'photos._id': photoId
    });

    if (!user) {
      logger.warn(`Photo ${photoId} not found or not owned by user ${req.user._id}`);
      return res.status(404).json({
        success: false,
        error: 'Photo not found or not owned by you'
      });
    }

    // Check if this is the only photo
    if (user.photos.length === 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your only photo'
      });
    }

    // Check if trying to delete the profile photo (first photo)
    if (user.photos[0]._id.toString() === photoId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your profile photo. Set another photo as profile first.'
      });
    }

    // Find the photo to get its filename
    const photoIndex = user.photos.findIndex(p => p._id.toString() === photoId);
    const photo = user.photos[photoIndex];

    // Extract filename from URL
    const filename = photo.url.split('/').pop();

    // Remove photo from user document
    user.photos.splice(photoIndex, 1);
    await user.save();

    // Delete the file from filesystem
    const filePath = path.join(config.FILE_UPLOAD_PATH, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete any permission requests for this photo
    await PhotoPermission.deleteMany({ photo: photoId });

    logger.info(`Photo ${photoId} deleted for user ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (err) {
    logger.error(`Error deleting photo: ${err.message}`);
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
    // Validate IDs
    if (!mongoose.isValidObjectId(photoId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid photo ID or user ID format'
      });
    }

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
 * @route   GET /api/users/photos/permissions
 * @desc    Get all photo permission requests for the current user
 * @access  Private
 */
router.get('/photos/permissions', protect, asyncHandler(async (req, res) => {
  logger.debug(`Fetching photo permissions for user ${req.user._id}`);

  try {
    // Find all permissions related to the current user's photos
    const photoIds = req.user.photos.map(photo => photo._id);

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    let query = { photo: { $in: photoIds } };

    // Add status filter if provided
    if (req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status)) {
      query.status = req.query.status;
    }

    const permissions = await PhotoPermission.find(query)
      .populate('requestedBy', 'nickname photos')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await PhotoPermission.countDocuments(query);

    logger.debug(`Found ${permissions.length} permission requests`);

    res.status(200).json({
      success: true,
      count: permissions.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: permissions
    });
  } catch (err) {
    logger.error(`Error fetching photo permissions: ${err.message}`);
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
    // Validate permission ID
    if (!mongoose.isValidObjectId(permissionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permission ID format'
      });
    }

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

/**
 * @route   GET /api/users/search
 * @desc    Search users with advanced filtering
 * @access  Private
 */
router.get('/search', protect, asyncHandler(async (req, res) => {
  logger.debug(`Searching users with filters`);

  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = { _id: { $ne: req.user._id } };

    // Add filters from query parameters
    if (req.query.nickname) {
      query.nickname = { $regex: req.query.nickname, $options: 'i' };
    }

    if (req.query.gender) {
      query['details.gender'] = req.query.gender;
    }

    if (req.query.minAge) {
      query['details.age'] = { ...query['details.age'] || {}, $gte: parseInt(req.query.minAge) };
    }

    if (req.query.maxAge) {
      query['details.age'] = { ...query['details.age'] || {}, $lte: parseInt(req.query.maxAge) };
    }

    if (req.query.location) {
      query['details.location'] = { $regex: req.query.location, $options: 'i' };
    }

    if (req.query.interests) {
      const interests = req.query.interests.split(',');
      query['details.interests'] = { $in: interests };
    }

    if (req.query.online === 'true') {
      query.isOnline = true;
    }

    // Execute search with pagination
    const users = await User.find(query)
      .select('nickname details photos isOnline lastActive')
      .sort({ isOnline: -1, lastActive: -1 })
      .skip(skip)
      .limit(limit);

    // Count total results for pagination
    const total = await User.countDocuments(query);

    logger.debug(`Found ${users.length} users matching search criteria`);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: users
    });
  } catch (err) {
    logger.error(`Error searching users: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}));

module.exports = router;
