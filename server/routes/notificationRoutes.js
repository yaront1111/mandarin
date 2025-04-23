// server/routes/notifications.js
import express from 'express'
import mongoose from 'mongoose'
import { check, validationResult } from 'express-validator'
import asyncHandler from 'express-async-handler'
import { protect } from '../middleware/auth.js'
import { User, Notification } from '../models/index.js'
import logger from '../logger.js'
import config from '../config.js'

const router = express.Router()

// --- Constants & Helpers ---

const DEFAULT_PAGE_SIZE = parseInt(config.NOTIFICATIONS_PER_PAGE, 10) || 20
const ALLOWED_TYPES = Array.isArray(config.ALLOWED_NOTIFICATION_TYPES)
  ? config.ALLOWED_NOTIFICATION_TYPES
  : ['message','like','match','photoRequest','photoResponse','story','comment','system','call']

// Middleware to validate req.params[id] is a Mongo ObjectId
const validateObjectId = param => (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params[param])) {
    return res.status(400).json({ success: false, error: `${param} is not a valid ID` })
  }
  next()
}

// Express‑validator errors
const validateRequest = (req, res, next) => {
  const errs = validationResult(req)
  if (!errs.isEmpty()) {
    return res.status(400).json({ success: false, errors: errs.array() })
  }
  next()
}

// Build a mongoose filter object from query params
function buildFilter(userId, { type, read, sender }) {
  const filter = { recipient: userId }
  if (type && ALLOWED_TYPES.includes(type)) filter.type = type
  if (read === 'true') filter.read = true
  else if (read === 'false') filter.read = false
  if (sender && mongoose.Types.ObjectId.isValid(sender)) filter.sender = sender
  return filter
}

// Emit a notification over socket.io if configured
function emitNotification(io, userId, notification) {
  if (!io?.userConnectionsMap) return
  const sockets = io.userConnectionsMap.get(userId.toString())
  if (!sockets) return
  sockets.forEach(socketId => {
    io.to(socketId).emit('notification', notification)
  })
}

// --- Routes ---

/**
 * GET /api/notifications
 * List notifications with optional filters + pagination.
 */
router.get(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const page  = parseInt(req.query.page,  10) || 1
    const limit = parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE
    const skip  = (page - 1) * limit

    const filter = buildFilter(req.user.id, req.query)

    const [ total, notifications, unreadCount ] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'nickname username photos avatar')
        .lean(),
      Notification.countDocuments({ recipient: req.user.id, read: false })
    ])

    res.json({
      success:     true,
      count:       notifications.length,
      total,
      unreadCount,
      page,
      pages:       Math.ceil(total / limit),
      data:        notifications
    })
  })
)

/**
 * PUT /api/notifications/read
 * Mark multiple notifications as read.
 */
router.put(
  '/read',
  protect,
  [ check('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array') ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const validIds = req.body.ids.filter(mongoose.Types.ObjectId.isValid)
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid notification IDs provided' })
    }

    const result = await Notification.updateMany(
      { id: { $in: validIds }, recipient: req.user.id, read: false },
      { $set: { read: true, readAt: new Date(), updatedAt: new Date() } }
    )

    res.json({ success: true, count: result.modifiedCount })
  })
)

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.put(
  '/:id/read',
  protect,
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const notif = await Notification.findOne({
      id: req.params.id,
      recipient: req.user.id
    })

    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification not found or not yours' })
    }

    if (!notif.read) {
      notif.read    = true
      notif.readAt  = new Date()
      notif.updatedAt = new Date()
      await notif.save()
    }

    res.json({ success: true, data: notif })
  })
)

/**
 * PUT /api/notifications/read-all
 * Mark *all* of this user’s notifications as read.
 */
router.put(
  '/read-all',
  protect,
  asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { $set: { read: true, readAt: new Date(), updatedAt: new Date() } }
    )
    res.json({ success: true, count: result.modifiedCount })
  })
)

/**
 * POST /api/notifications/create
 * Create a new notification (no bundling service).
 */
router.post(
  '/create',
  protect,
  [
    check('recipientId')
      .notEmpty().withMessage('recipientId is required')
      .bail()
      .isMongoId().withMessage('recipientId must be a valid ID'),
    check('type')
      .notEmpty().withMessage('type is required')
      .bail()
      .isIn(ALLOWED_TYPES)
      .withMessage(`type must be one of ${ALLOWED_TYPES.join(', ')}`)
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { recipientId, type, title, content, data = {} } = req.body

    // ensure recipient exists
    if (!await User.exists({ id: recipientId })) {
      return res.status(404).json({ success: false, error: 'Recipient not found' })
    }

    const now = new Date()
    const notification = new Notification({
      recipient:  recipientId,
      sender:     req.user.id,
      type,
      title:      title || '',
      content:    content || '',
      data,
      read:       false,
      createdAt:  now,
      updatedAt:  now
    })
    await notification.save()

    // real‑time emit
    emitNotification(req.app.io, recipientId, notification)

    res.status(201).json({ success: true, data: notification })
  })
)

/**
 * POST /api/notifications/create-test
 * Generate a dummy notification for dev/testing.
 */
router.post(
  '/create-test',
  protect,
  [
    check('type')
      .optional()
      .isIn(ALLOWED_TYPES)
      .withMessage(`type must be one of ${ALLOWED_TYPES.join(', ')}`)
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const type = req.body.type || 'system'
    let title, content, data = {}

    switch (type) {
      case 'message':
        title   = 'Test Message'
        content = 'This is a test message notification.'
        data    = { messageId: new mongoose.Types.ObjectId() }
        break
      case 'like':
        title   = 'Test Like'
        content = 'Someone liked your profile.'
        data    = { likeId: new mongoose.Types.ObjectId() }
        break
      case 'match':
        title   = 'Test Match'
        content = 'You have a new match!'
        data    = { matchId: new mongoose.Types.ObjectId() }
        break
      case 'story':
        title   = 'Test Story'
        content = 'Someone posted a new story.'
        data    = { storyId: new mongoose.Types.ObjectId() }
        break
      default:
        title   = `Test ${type}`
        content = `This is a test ${type} notification.`
    }

    const now = new Date()
    const notification = new Notification({
      recipient:  req.user.id,
      sender:     req.user.id,
      type,
      title,
      content,
      data,
      read:       false,
      createdAt:  now,
      updatedAt:  now
    })
    await notification.save()

    emitNotification(req.app.io, req.user.id, notification)

    res.status(201).json({ success: true, data: notification })
  })
)

/**
 * GET /api/notifications/count
 * Retrieve per‑type and overall read/unread totals.
 */
router.get(
  '/count',
  protect,
  asyncHandler(async (req, res) => {
    const userId = req.user.id

    // by‑type + read/unread
    const byType = await Notification.aggregate([
      { $match: { recipient: userId } },
      { $group: { id: { type: '$type', read: '$read' }, count: { $sum: 1 } } },
      { $group: {
          id: '$id.type',
          read:   { $sum: { $cond: [ { $eq: ['$id.read', true] }, '$count', 0 ] } },
          unread: { $sum: { $cond: [ { $eq: ['$id.read', false] }, '$count', 0 ] } },
          total:  { $sum: '$count' }
      }},
      { $sort: { id: 1 } }
    ])

    // overall totals
    const totalsAgg = await Notification.aggregate([
      { $match: { recipient: userId } },
      { $group: { id: '$read', count: { $sum: 1 } } }
    ])
    const totals = { read: 0, unread: 0, total: 0 }
    totalsAgg.forEach(item => {
      if (item.id) totals.read = item.count
      else totals.unread = item.count
      totals.total += item.count
    })

    res.json({ success: true, counts: { byType, totals } })
  })
)

/**
 * DELETE /api/notifications/:id
 * Delete one notification (must belong to you).
 */
router.delete(
  '/:id',
  protect,
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const notif = await Notification.findOne({
      id: req.params.id,
      recipient: req.user.id
    })
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Not found or not yours' })
    }
    await notif.remove()
    res.json({ success: true, message: 'Deleted' })
  })
)

/**
 * DELETE /api/notifications/clear-all
 * Bulk‑delete notifications, optionally only those already read.
 */
router.delete(
  '/clear-all',
  protect,
  asyncHandler(async (req, res) => {
    const filter = { recipient: req.user.id }
    if (req.query.readOnly === 'true') filter.read = true

    const result = await Notification.deleteMany(filter)
    res.json({
      success: true,
      count: result.deletedCount,
      message: 'Notifications cleared'
    })
  })
)

export default router
