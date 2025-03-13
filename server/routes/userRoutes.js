// routes/userRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { User, PhotoPermission, Message } = require('../models');
const config = require('../config');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to protect routes (reuse similar to authRoutes)
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }
};

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
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Error: Images Only!'));
  }
});

// @route   GET /api/users
// @desc    Get all online users except current user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const users = await User.find({ isOnline: true, _id: { $ne: req.user._id } })
      .select('nickname details photos isOnline lastActive');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// @route   GET /api/users/:id
// @desc    Get a single user and message history with that user
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('nickname details photos isOnline lastActive');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: req.params.id },
        { sender: req.params.id, recipient: req.user._id }
      ]
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { user, messages } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// @route   PUT /api/users/profile
// @desc    Update current user's profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { nickname, details } = req.body;
    const updateData = {};
    if (nickname) updateData.nickname = nickname;
    if (details) updateData.details = details;
    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// @route   POST /api/users/photos
// @desc    Upload photo for current user
// @access  Private
router.post('/photos', protect, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload a file' });
    }
    const { isPrivate } = req.body;
    req.user.photos.push({
      url: `/uploads/${req.file.filename}`,
      isPrivate: isPrivate === 'true'
    });
    await req.user.save();
    res.status(200).json({ success: true, data: req.user.photos[req.user.photos.length - 1] });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// @route   POST /api/photos/:id/request
// @desc    Request permission to view a private photo
// @access  Private
router.post('/photos/:id/request', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const photo = user.photos.id(req.params.id);
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }
    if (!photo.isPrivate) {
      return res.status(400).json({ success: false, error: 'Photo is not private' });
    }
    let permission = await PhotoPermission.findOne({
      photo: req.params.id,
      requestedBy: req.user._id
    });
    if (permission) {
      return res.status(400).json({ success: false, error: 'Permission request already exists' });
    }
    permission = await PhotoPermission.create({
      photo: req.params.id,
      requestedBy: req.user._id
    });
    res.status(201).json({ success: true, data: permission });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// @route   PUT /api/photos/permissions/:id
// @desc    Approve or reject a photo permission request
// @access  Private
router.put('/photos/permissions/:id', protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    const permission = await PhotoPermission.findById(req.params.id);
    if (!permission) {
      return res.status(404).json({ success: false, error: 'Permission request not found' });
    }
    // Verify that the current user owns the photo
    const user = await User.findOne({ _id: req.user._id, 'photos._id': permission.photo });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }
    permission.status = status;
    await permission.save();
    res.status(200).json({ success: true, data: permission });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
