const express = require("express")
const router = express.Router()
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const { protect } = require("../middleware/auth")
const Story = require("../models/Story")
const User = require("../models/User")
const logger = require("../logger")

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/stories")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, "story-" + uniqueSuffix + path.extname(file.originalname))
  },
})

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
})

// GET all stories
router.get("/", protect, (req, res) => {
  Story.find()
    .sort({ createdAt: -1 })
    .populate("user", "name username avatar")
    .then((stories) => {
      res.json({
        success: true,
        data: stories
      })
    })
    .catch((err) => {
      logger.error(`Error fetching stories: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error"
      })
    })
})

// POST create a new story with media
router.post(
  "/",
  protect,
  (req, res, next) => {
    // This is a middleware to handle the upload
    upload.single("media")(req, res, (err) => {
      if (err) {
        logger.error(`Upload error: ${err.message}`)
        return res.status(400).json({
          success: false,
          error: err.message
        })
      }
      next()
    })
  },
  (req, res) => {
    // This is the actual route handler
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded"
      })
    }

    const newStory = new Story({
      user: req.user.id,
      mediaUrl: `/uploads/stories/${req.file.filename}`,
      mediaType: req.file.mimetype.startsWith("image/") ? "image" : "video",
      caption: req.body.caption || "",
      duration: req.body.duration || 24, // Default 24 hours
    })

    newStory
      .save()
      .then((story) => {
        return Story.findById(story._id).populate("user", "name username avatar")
      })
      .then((story) => {
        res.status(201).json({
          success: true,
          data: story
        })
      })
      .catch((err) => {
        logger.error(`Error saving story: ${err.message}`)
        res.status(500).json({
          success: false,
          error: "Server error"
        })
      })
  },
)

// POST create a new text-only story
router.post("/text", protect, (req, res) => {
  try {
    const { text, background, backgroundStyle, font, fontStyle, duration, extraStyles } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Text content is required"
      })
    }

    const newStory = new Story({
      user: req.user.id,
      mediaType: "text",
      mediaUrl: "text", // Using a placeholder value since mediaUrl is required
      text: text,
      backgroundStyle: backgroundStyle || "#000000",
      fontStyle: fontStyle || "'Helvetica', sans-serif",
      extraStyles: extraStyles || {},
      duration: parseInt(duration) || 24, // Default 24 hours
    })

    newStory
      .save()
      .then((story) => {
        return Story.findById(story._id).populate("user", "name username avatar")
      })
      .then((story) => {
        res.status(201).json({
          success: true,
          data: story
        })
      })
      .catch((err) => {
        logger.error(`Error saving text story: ${err.message}`)
        res.status(500).json({
          success: false,
          error: "Server error"
        })
      })
  } catch (err) {
    logger.error(`Error creating text story: ${err.message}`)
    res.status(500).json({
      success: false,
      error: "Server error"
    })
  }
})

// GET stories by user ID
router.get("/user/:userId", protect, (req, res) => {
  Story.find({ user: req.params.userId })
    .sort({ createdAt: -1 })
    .populate("user", "name username avatar")
    .then((stories) => {
      res.json({
        success: true,
        data: stories
      })
    })
    .catch((err) => {
      logger.error(`Error fetching user stories: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error"
      })
    })
})

// POST mark story as viewed
router.post("/:id/view", protect, (req, res) => {
  Story.findById(req.params.id)
    .then((story) => {
      if (!story) {
        return res.status(404).json({
          success: false,
          error: "Story not found"
        })
      }

      if (!story.viewers.includes(req.user.id)) {
        story.viewers.push(req.user.id)
        return story.save()
      }

      return story
    })
    .then(() => {
      res.json({ success: true })
    })
    .catch((err) => {
      logger.error(`Error marking story as viewed: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error"
      })
    })
})

// POST react to a story
router.post("/:id/react", protect, (req, res) => {
  const { reactionType } = req.body

  if (!reactionType) {
    return res.status(400).json({
      success: false,
      error: "Reaction type is required"
    })
  }

  // Here you would implement the reaction logic
  // For example, updating a reactions array on the Story model

  res.json({
    success: true,
    message: "Reaction added successfully"
  })
})

// GET reactions for a story
router.get("/:id/reactions", protect, (req, res) => {
  // Here you would implement fetching reactions for a story
  // For example, return the reactions array from the Story model

  res.json({
    success: true,
    data: [] // Replace with actual reactions data
  })
})

// POST comment on a story
router.post("/:id/comment", protect, (req, res) => {
  const { comment } = req.body

  if (!comment) {
    return res.status(400).json({
      success: false,
      error: "Comment content is required"
    })
  }

  // Here you would implement the commenting logic
  // For example, updating a comments array on the Story model

  res.json({
    success: true,
    message: "Comment added successfully"
  })
})

// GET comments for a story
router.get("/:id/comments", protect, (req, res) => {
  // Here you would implement fetching comments for a story
  // For example, return the comments array from the Story model

  res.json({
    success: true,
    data: [] // Replace with actual comments data
  })
})

// DELETE a story
router.delete("/:id", protect, (req, res) => {
  Story.findById(req.params.id)
    .then((story) => {
      if (!story) {
        return res.status(404).json({
          success: false,
          error: "Story not found"
        })
      }

      if (story.user.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: "Not authorized"
        })
      }

      return Story.deleteOne({ _id: story._id })
    })
    .then(() => {
      res.json({ success: true })
    })
    .catch((err) => {
      logger.error(`Error deleting story: ${err.message}`)
      res.status(500).json({
        success: false,
        error: "Server error"
      })
    })
})

module.exports = router
