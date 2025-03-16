const express = require("express")
const router = express.Router()
const { protect } = require("../middleware/auth")
const upload = require("../middleware/upload")
const { check, validationResult } = require("express-validator")
const Story = require("../models/Story")
const User = require("../models/User")
const logger = require("../logger")

// @route   GET /api/stories
// @desc    Get all stories
// @access  Public
router.get("/", async (req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 }).populate("user", "name avatar")

    res.json(stories)
  } catch (err) {
    logger.error(`Error fetching stories: ${err.message}`)
    res.status(500).json({ error: "Server error" })
  }
})

// @route   POST /api/stories
// @desc    Create a new story with media
// @access  Private
router.post("/", protect, upload.single("media"), async (req, res) => {
  try {
    const { type, content } = req.body

    // Validate input
    if (!type || !["image", "video", "text"].includes(type)) {
      return res.status(400).json({ error: "Valid story type is required" })
    }

    if (type === "text" && !content) {
      return res.status(400).json({ error: "Content is required for text stories" })
    }

    const newStory = new Story({
      user: req.user._id || req.user.id,
      type,
      content: type === "text" ? content : undefined,
      media: req.file ? `/uploads/${req.file.filename}` : undefined,
    })

    const story = await newStory.save()
    res.status(201).json(story)
  } catch (err) {
    logger.error(`Error creating story: ${err.message}`)
    res.status(500).json({ error: "Server error" })
  }
})

// @route   POST /api/stories/text
// @desc    Create a new text-only story
// @access  Private
router.post("/text", protect, async (req, res) => {
  try {
    const { content, backgroundColor, fontStyle, duration } = req.body

    // Validate input
    if (!content) {
      return res.status(400).json({ error: "Content is required for text stories" })
    }

    // Debug user object
    logger.debug(`User object in request: ${JSON.stringify(req.user)}`)

    // Ensure we have a valid user ID
    const userId = req.user._id || req.user.id
    if (!userId) {
      logger.error("No user ID found in request")
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      })
    }

    const newStory = new Story({
      user: userId,
      type: "text",
      content,
      backgroundColor: backgroundColor || "#000000",
      fontStyle: fontStyle || "default",
      duration: duration || 10, // Default 10 seconds
    })

    const story = await newStory.save()

    // Populate user data
    const populatedStory = await Story.findById(story._id)
      .populate("user", "username nickname name profilePicture avatar email")
      .lean()

    res.status(201).json({
      success: true,
      story: populatedStory,
    })
  } catch (err) {
    logger.error(`Error creating text story: ${err.message}`)
    res.status(500).json({
      success: false,
      error: "Server error",
    })
  }
})

// @route   GET /api/stories/:id
// @desc    Get a story by ID
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const story = await Story.findById(req.params.id).populate("user", "name avatar")

    if (!story) {
      return res.status(404).json({ error: "Story not found" })
    }

    res.json(story)
  } catch (err) {
    logger.error(`Error fetching story: ${err.message}`)
    res.status(500).json({ error: "Server error" })
  }
})

// @route   DELETE /api/stories/:id
// @desc    Delete a story
// @access  Private
router.delete("/:id", protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id)

    if (!story) {
      return res.status(404).json({ error: "Story not found" })
    }

    // Check user
    if (story.user.toString() !== req.user.id) {
      return res.status(401).json({ error: "User not authorized" })
    }

    await story.remove()
    res.json({ msg: "Story removed" })
  } catch (err) {
    logger.error(`Error deleting story: ${err.message}`)
    res.status(500).json({ error: "Server error" })
  }
})

// @route   POST /api/stories/:id/view
// @desc    Mark a story as viewed
// @access  Private
router.post("/:id/view", protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id)

    if (!story) {
      return res.status(404).json({ error: "Story not found" })
    }

    // Check if user has already viewed this story
    if (story.viewers && story.viewers.includes(req.user.id)) {
      return res.json({ msg: "Story already viewed" })
    }

    // Add user to viewers array
    if (!story.viewers) {
      story.viewers = []
    }
    story.viewers.push(req.user.id)
    await story.save()

    res.json({ success: true, msg: "Story marked as viewed" })
  } catch (err) {
    logger.error(`Error marking story as viewed: ${err.message}`)
    res.status(500).json({ success: false, error: "Server error" })
  }
})

module.exports = router
