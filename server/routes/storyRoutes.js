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
      res.json(stories)
    })
    .catch((err) => {
      logger.error(`Error fetching stories: ${err.message}`)
      res.status(500).json({ error: "Server error" })
    })
})

// POST create a new story
// Note: We're using separate middleware functions here
router.post(
  "/",
  protect,
  (req, res, next) => {
    // This is a middleware to handle the upload
    upload.single("media")(req, res, (err) => {
      if (err) {
        logger.error(`Upload error: ${err.message}`)
        return res.status(400).json({ error: err.message })
      }
      next()
    })
  },
  (req, res) => {
    // This is the actual route handler
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    const newStory = new Story({
      user: req.user.id,
      mediaUrl: `/uploads/stories/${req.file.filename}`,
      mediaType: req.file.mimetype.startsWith("image/") ? "image" : "video",
      caption: req.body.caption || "",
    })

    newStory
      .save()
      .then((story) => {
        return Story.findById(story._id).populate("user", "name username avatar")
      })
      .then((story) => {
        res.status(201).json(story)
      })
      .catch((err) => {
        logger.error(`Error saving story: ${err.message}`)
        res.status(500).json({ error: "Server error" })
      })
  },
)

// GET stories by user ID
router.get("/user/:userId", protect, (req, res) => {
  Story.find({ user: req.params.userId })
    .sort({ createdAt: -1 })
    .populate("user", "name username avatar")
    .then((stories) => {
      res.json(stories)
    })
    .catch((err) => {
      logger.error(`Error fetching user stories: ${err.message}`)
      res.status(500).json({ error: "Server error" })
    })
})

// PUT mark story as viewed
router.put("/:id/view", protect, (req, res) => {
  Story.findById(req.params.id)
    .then((story) => {
      if (!story) {
        return res.status(404).json({ error: "Story not found" })
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
      res.status(500).json({ error: "Server error" })
    })
})

// DELETE a story
router.delete("/:id", protect, (req, res) => {
  Story.findById(req.params.id)
    .then((story) => {
      if (!story) {
        return res.status(404).json({ error: "Story not found" })
      }

      if (story.user.toString() !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" })
      }

      return Story.deleteOne({ _id: story._id })
    })
    .then(() => {
      res.json({ success: true })
    })
    .catch((err) => {
      logger.error(`Error deleting story: ${err.message}`)
      res.status(500).json({ error: "Server error" })
    })
})

module.exports = router
