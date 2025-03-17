const express = require("express")
const router = express.Router()
const { protect } = require("../middleware/auth")
const { canCreateStory } = require("../middleware/permissions")
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
    const stories = await Story.find()
      .sort({ createdAt: -1 })
      .populate("user", "nickname username name profilePicture avatar")
      .lean()

    // Add userData for compatibility with frontend
    const storiesWithUserData = stories.map((story) => {
      // If user field is populated, create userData
      if (story.user && typeof story.user === "object") {
        story.userData = { ...story.user }
      }
      return story
    })

    res.json({
      success: true,
      data: storiesWithUserData,
    })
  } catch (err) {
    logger.error(`Error fetching stories: ${err.message}`)
    res.status(500).json({
      success: false,
      error: "Server error",
    })
  }
})

// @route   POST /api/stories
// @desc    Create a new story with media
// @access  Private
router.post("/", protect, canCreateStory, upload.single("media"), async (req, res) => {
  try {
    const { type, content } = req.body

    // Validate input
    if (!type || !["image", "video", "text"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Valid story type is required",
      })
    }

    if (type === "text" && !content) {
      return res.status(400).json({
        success: false,
        error: "Content is required for text stories",
      })
    }

    const newStory = new Story({
      user: req.user._id || req.user.id,
      type,
      mediaType: type, // Set mediaType to match type
      content: type === "text" ? content : undefined,
      text: type === "text" ? content : undefined, // Set text field as well for frontend compatibility
      media: req.file ? `/uploads/${req.file.filename}` : undefined,
      mediaUrl: req.file ? `/uploads/${req.file.filename}` : undefined, // Set mediaUrl for frontend compatibility
    })

    const story = await newStory.save()

    // Update user's lastStoryCreated timestamp
    if (req.updateLastStoryCreated) {
      await User.findByIdAndUpdate(req.user._id || req.user.id, {
        lastStoryCreated: new Date(),
      })
    }

    // Populate user information
    const populatedStory = await Story.findById(story._id)
      .populate("user", "nickname username name profilePicture avatar email")
      .lean()

    res.status(201).json({
      success: true,
      data: populatedStory,
    })
  } catch (err) {
    logger.error(`Error creating story: ${err.message}`)
    res.status(500).json({
      success: false,
      error: err.message || "Server error",
    })
  }
})

// @route   POST /api/stories/text
// @desc    Create a new text-only story
// @access  Private
router.post("/text", protect, canCreateStory, async (req, res) => {
  try {
    const { content, text, backgroundColor, backgroundStyle, fontStyle, duration, extraStyles } = req.body

    // Use either content or text field
    const storyContent = content || text

    // Validate input
    if (!storyContent) {
      return res.status(400).json({
        success: false,
        error: "Content is required for text stories",
      })
    }

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
      mediaType: "text",
      content: storyContent,
      text: storyContent,
      backgroundColor: backgroundColor || "#000000",
      backgroundStyle: backgroundStyle || backgroundColor || "#000000",
      fontStyle: fontStyle || "default",
      duration: Number(duration) || 24, // Default 24 hours
      extraStyles: extraStyles || {},
    })

    const story = await newStory.save()

    // Update user's lastStoryCreated timestamp
    if (req.updateLastStoryCreated) {
      await User.findByIdAndUpdate(userId, {
        lastStoryCreated: new Date(),
      })
    }

    // Populate user data
    const populatedStory = await Story.findById(story._id)
      .populate("user", "nickname username name profilePicture avatar email")
      .lean()

    // Add userData for frontend compatibility
    if (populatedStory.user) {
      populatedStory.userData = { ...populatedStory.user }
    }

    res.status(201).json({
      success: true,
      data: populatedStory,
      story: populatedStory, // Include both data and story for compatibility
    })
  } catch (err) {
    logger.error(`Error creating text story: ${err.message}`)
    res.status(500).json({
      success: false,
      error: err.message || "Server error",
    })
  }
})

// @route   GET /api/stories/:id
// @desc    Get a story by ID
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate("user", "nickname username name profilePicture avatar")
      .lean()

    if (!story) {
      return res.status(404).json({
        success: false,
        error: "Story not found",
      })
    }

    // Add userData for compatibility
    if (story.user) {
      story.userData = { ...story.user }
    }

    res.json({
      success: true,
      data: story,
    })
  } catch (err) {
    logger.error(`Error fetching story: ${err.message}`)
    res.status(500).json({
      success: false,
      error: "Server error",
    })
  }
})

// @route   GET /api/stories/user/:userId
// @desc    Get stories for a specific user
// @access  Public
router.get("/user/:userId", async (req, res) => {
  try {
    // Validate userId
    if (!req.params.userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID format",
      })
    }

    const stories = await Story.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .populate("user", "nickname username name profilePicture avatar email")
      .lean()

    // Add userData for compatibility
    const storiesWithUserData = stories.map((story) => {
      if (story.user) {
        story.userData = { ...story.user }
      }
      return story
    })

    res.json({
      success: true,
      data: storiesWithUserData,
    })
  } catch (err) {
    logger.error(`Error fetching user stories: ${err.message}`)
    res.status(500).json({
      success: false,
      error: "Server error",
    })
  }
})

// @route   DELETE /api/stories/:id
// @desc    Delete a story
// @access  Private
router.delete("/:id", protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id)

    if (!story) {
      return res.status(404).json({
        success: false,
        error: "Story not found",
      })
    }

    // Check user
    if (story.user.toString() !== (req.user._id || req.user.id).toString()) {
      return res.status(401).json({
        success: false,
        error: "User not authorized",
      })
    }

    await Story.deleteOne({ _id: req.params.id })
    res.json({
      success: true,
      message: "Story removed",
    })
  } catch (err) {
    logger.error(`Error deleting story: ${err.message}`)
    res.status(500).json({
      success: false,
      error: "Server error",
    })
  }
})

// @route   POST /api/stories/:id/view
// @desc    Mark a story as viewed
// @access  Private
router.post("/:id/view", protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id)

    if (!story) {
      return res.status(404).json({
        success: false,
        error: "Story not found",
      })
    }

    // Check if user has already viewed this story
    if (story.viewers && story.viewers.includes(req.user._id || req.user.id)) {
      return res.json({
        success: true,
        message: "Story already viewed",
      })
    }

    // Add user to viewers array
    if (!story.viewers) {
      story.viewers = []
    }
    story.viewers.push(req.user._id || req.user.id)
    await story.save()

    res.json({
      success: true,
      message: "Story marked as viewed",
    })
  } catch (err) {
    logger.error(`Error marking story as viewed: ${err.message}`)
    res.status(500).json({
      success: false,
      error: "Server error",
    })
  }
})

// @route   POST /api/stories/:id/react
// @desc    React to a story
// @access  Private
router.post("/:id/react", protect, async (req, res) => {
  try {
    const { reactionType } = req.body

    if (!reactionType) {
      return res.status(400).json({
        success: false,
        error: "Reaction type is required",
      })
    }

    const story = await Story.findById(req.params.id)

    if (!story) {
      return res.status(404).json({
        success: false,
        error: "Story not found",
      })
    }

    // Initialize reactions array if it doesn't exist
    if (!story.reactions) {
      story.reactions = []
    }

    // Check if user already reacted
    const existingReaction = story.reactions.find(
      (r) => r.user && r.user.toString() === (req.user._id || req.user.id).toString(),
    )

    if (existingReaction) {
      // Update existing reaction
      existingReaction.type = reactionType
      existingReaction.updatedAt = Date.now()
    } else {
      // Add new reaction
      story.reactions.push({
        user: req.user._id || req.user.id,
        type: reactionType,
        createdAt: Date.now(),
      })
    }

    await story.save()

    res.json({
      success: true,
      message: "Reaction added",
      data: story.reactions,
    })
  } catch (err) {
    logger.error(`Error adding reaction to story: ${err.message}`)
    res.status(500).json({
      success: false,
      error: "Server error",
    })
  }
})

module.exports = router
