// server/routes/stories.js
import express from 'express'
import { check, validationResult } from 'express-validator'
import mongoose from 'mongoose'
import asyncHandler from 'express-async-handler'
import { protect } from '../middleware/auth.js'
import { canCreateStory } from '../middleware/permissions.js'
import upload from '../middleware/upload.js'
import Story from '../models/Story.js'
import User from '../models/User.js'
import logger from '../logger.js'
import config from '../config.js'

const router = express.Router()

// -- Constants & Defaults --
const PUBLIC_USER_FIELDS = 'nickname username name profilePicture avatar'
const STORIES_PER_PAGE    = Number(config.STORIES_PER_PAGE)    || 50
const STORY_COOLDOWN_MS   = (Number(config.STORY_COOLDOWN_SEC) || 5) * 1000
const ALLOWED_REACTIONS   = Array.isArray(config.ALLOWED_STORY_REACTIONS)
  ? config.ALLOWED_STORY_REACTIONS
  : ['like','love','laugh','wow','sad','angry']

// -- Middlewares --

/** Validate that `req.params[paramName]` is a Mongo ObjectId */
const validateObjectId = (paramName) => (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
    return res.status(400).json({ success: false, error: `${paramName} is not a valid ID` })
  }
  next()
}

/** Gather express‑validator errors */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() })
  }
  next()
}

// -- Helper Functions --

/** Has this user created a story within the cooldown window? */
async function hasRecentStory(userId) {
  try {
    const cutoff = new Date(Date.now() - STORY_COOLDOWN_MS)
    
    // Check the user's lastStoryCreated field first (more efficient)
    const user = await User.findById(userId).select('lastStoryCreated').lean()
    if (user && user.lastStoryCreated && user.lastStoryCreated > cutoff) {
      return true
    }
    
    // As a fallback, check for any stories in the database
    // But exclude any stories created in the last 2 seconds (to avoid counting the story being created now)
    const justNowBuffer = new Date(Date.now() - 2000) // 2 second buffer
    const count = await Story.countDocuments({ 
      user: userId, 
      createdAt: { $gt: cutoff, $lt: justNowBuffer } 
    })
    return count > 0
  } catch (err) {
    logger.error(`hasRecentStory(${userId}) failed: ${err.message}`)
    // fail‑open so we don't block legit posts if something's wrong
    return false
  }
}

/** Build the payload for a new Story from the request */
function buildStoryPayload({ userId, file, body }) {
  const {
    type,
    content,
    backgroundColor,
    backgroundStyle,
    fontStyle,
    duration,
    extraStyles,
  } = body

  const numericDuration = Number(duration)
  const payload = {
    user:           userId,
    type,
    mediaType:      type,
    text:           type === 'text'  ? content : undefined,
    content:        type === 'text'  ? content : undefined,
    backgroundColor: backgroundColor || '#000000',
    backgroundStyle: backgroundStyle || backgroundColor || '#000000',
    fontStyle:      fontStyle    || 'default',
    duration:       isNaN(numericDuration) ? 24 : numericDuration,
    extraStyles:    extraStyles || {},
  }

  if (file) {
    // multer has written us a file at req.file.path; expose its public URL:
    payload.media    = `/uploads/${file.filename}`
    payload.mediaUrl = `/uploads/${file.filename}`
  }

  return payload
}

/** Normalize a Story document for JSON responses */
function formatForResponse(story) {
  // Attach `userData` (flattened) for frontend convenience:
  if (story.user && typeof story.user === 'object') {
    story.userData = { ...story.user }
  }
  return story
}

/** Build pagination metadata */
function paginate(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  }
}

// -- Routes --

/**
 * GET /api/stories
 * List active (non‑expired) stories, paginated.
 * Public.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page  = parseInt(req.query.page, 10)  || 1
    const limit = parseInt(req.query.limit, 10) || STORIES_PER_PAGE
    const now   = new Date()

    const filter = { expiresAt: { $gt: now } }
    const [ total, stories ] = await Promise.all([
      Story.countDocuments(filter),
      Story.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', PUBLIC_USER_FIELDS)
        .lean()
    ])

    res.json({
      success: true,
      data:   stories.map(formatForResponse),
      pagination: paginate(page, limit, total),
    })
  })
)

/**
 * POST /api/stories
 * Create a new story (image, video, or text).
 * Private.
 */
router.post(
  '/',
  protect,
  canCreateStory,
  upload.single('media'),
  [
    check('type')
      .isIn(['image','video','text'])
      .withMessage('type must be image, video or text'),
    check('content')
      .if(check('type').equals('text'))
      .notEmpty()
      .withMessage('content is required for text stories'),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const userId = req.user._id

    // enforce cooldown
    if (await hasRecentStory(userId)) {
      return res.status(429).json({
        success: false,
        error: `Please wait ${STORY_COOLDOWN_MS/1000} seconds before posting another story`,
        message: `Please wait ${STORY_COOLDOWN_MS/1000} seconds before posting another story`,
      })
    }

    // assemble and save
    const payload  = buildStoryPayload({ userId, file: req.file, body: req.body })
    const newStory = new Story(payload)
    await newStory.save()

    // update user's lastStoryCreated timestamp
    await User.findByIdAndUpdate(userId, { lastStoryCreated: new Date() })

    // re-fetch fully populated
    const story = await Story.findById(newStory._id)
      .populate('user', `${PUBLIC_USER_FIELDS} email`)
      .lean()

    res.status(201).json({
      success: true,
      data:    formatForResponse(story),
    })
  })
)

/**
 * GET /api/stories/:id
 * Fetch a single story by ID.
 * Public.
 */
router.get(
  '/:id',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const story = await Story.findById(req.params.id)
      .populate('user', PUBLIC_USER_FIELDS)
      .lean()

    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' })
    }

    res.json({ success: true, data: formatForResponse(story) })
  })
)

/**
 * GET /api/stories/user/:userId
 * Fetch active stories for a particular user.
 * Public.
 */
router.get(
  '/user/:userId',
  validateObjectId('userId'),
  asyncHandler(async (req, res) => {
    const page   = parseInt(req.query.page, 10)  || 1
    const limit  = parseInt(req.query.limit, 10) || STORIES_PER_PAGE
    const now    = new Date()
    const filter = {
      user: req.params.userId,
      expiresAt: { $gt: now }
    }

    const [ total, stories ] = await Promise.all([
      Story.countDocuments(filter),
      Story.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', PUBLIC_USER_FIELDS)
        .lean()
    ])

    res.json({
      success: true,
      data:   stories.map(formatForResponse),
      pagination: paginate(page, limit, total),
    })
  })
)

/**
 * DELETE /api/stories/:id
 * Delete your own story.
 * Private.
 */
router.delete(
  '/:id',
  protect,
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const story = await Story.findById(req.params.id)
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' })
    }
    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized' })
    }
    await story.remove()
    res.json({ success: true, message: 'Story deleted' })
  })
)

/**
 * POST /api/stories/:id/view
 * Mark a story as viewed.
 * Private.
 */
router.post(
  '/:id/view',
  protect,
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const story = await Story.findById(req.params.id)
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' })
    }
    const already = story.viewers.some(v => v.user.equals(req.user._id))
    if (!already) {
      story.viewers.push({ user: req.user._id, viewedAt: new Date() })
      await story.save()
    }
    res.json({ success: true, message: already ? 'Already viewed' : 'Marked as viewed' })
  })
)

/**
 * POST /api/stories/:id/react
 * Add a reaction to a story.
 * Private.
 */
router.post(
  '/:id/react',
  protect,
  validateObjectId('id'),
  [
    check('reactionType')
      .isIn(ALLOWED_REACTIONS)
      .withMessage(`reactionType must be one of ${ALLOWED_REACTIONS.join(', ')}`)
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const story = await Story.findById(req.params.id)
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' })
    }
    await story.addReaction(req.user._id, req.body.reactionType)
    res.json({ success: true, data: story.reactions })
  })
)

/**
 * DELETE /api/stories/:id/react
 * Remove your reaction from a story.
 * Private.
 */
router.delete(
  '/:id/react',
  protect,
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const story = await Story.findById(req.params.id)
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' })
    }
    await story.removeReaction(req.user._id)
    res.json({ success: true, data: story.reactions })
  })
)

/**
 * GET /api/stories/:id/viewers
 * List who has viewed a story (owner only).
 * Private.
 */
router.get(
  '/:id/viewers',
  protect,
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const story = await Story.findById(req.params.id)
      .populate('viewers.user', PUBLIC_USER_FIELDS)

    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' })
    }
    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized' })
    }
    res.json({ success: true, data: story.viewers })
  })
)

export default router