// models/Notification.js
import mongoose from 'mongoose';
import logger from '../logger.js';

const { Schema, model, Types, Error: MongooseError } = mongoose;
const { ObjectId } = Types;

// -----------------------------
// Helper: Safe ObjectId casting
// -----------------------------
function safeObjectId(value, fieldName) {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  if (ObjectId.isValid(value)) return new ObjectId(value);
  throw new MongooseError.CastError('ObjectId', value, fieldName);
}

// -----------------------------
// Notification Schema
// -----------------------------
const notificationSchema = new Schema({
  recipient: {
    type: ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'message',
      'like',
      'match',
      'photoRequest',
      'photoResponse',
      'story',
      'comment',
      'system',
      'call',
    ],
    required: true,
    index: true,
  },
  sender: {
    type: ObjectId,
    ref: 'User',
    index: true,
  },
  title:  { type: String, trim: true },
  content:{ type: String, trim: true },

  // reference to another model (Message, Like, etc.)
  reference: {
    type: ObjectId,
    refPath: 'referenceModel',
  },
  referenceModel: {
    type: String,
    enum: ['Message','Like','Photo','Story','Comment'],
  },

  data: { type: Schema.Types.Mixed },

  read:  { type: Boolean, default: false, index: true },
  readAt:{ type: Date, default: null },

  // bundling fields
  count: { type: Number, default: 1, min: 1 },
  bundleKey: { type: String, index: true },
  parentNotification: {
    type: ObjectId,
    ref: 'Notification',
  },
}, {
  timestamps: true, // adds createdAt & updatedAt
});

// ---------------------------------
// Indexes for efficient querying
// ---------------------------------
notificationSchema.index({ recipient: 1, type: 1, read: 1 });
notificationSchema.index({ recipient: 1, sender: 1, type: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

// -------------------------------------------------
// Pre-save: cast IDs, generate bundleKey, set readAt
// -------------------------------------------------
notificationSchema.pre('save', function(next) {
  try {
    // Cast required ObjectIds
    this.recipient = safeObjectId(this.recipient, 'recipient');
    if (this.sender)    this.sender    = safeObjectId(this.sender,    'sender');
    if (this.reference) this.reference = safeObjectId(this.reference, 'reference');
    if (this.parentNotification) {
      this.parentNotification = safeObjectId(this.parentNotification, 'parentNotification');
    }

    // Build bundleKey on new or when sender/type change
    if (this.isNew || this.isModified('sender') || this.isModified('type')) {
      if (this.recipient && this.sender && this.type) {
        this.bundleKey = `${this.recipient.toString()}:${this.sender.toString()}:${this.type}`;
      }
    }

    // Stamp readAt when marking read
    if (this.isModified('read') && this.read && !this.readAt) {
      this.readAt = new Date();
    }

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Find a recent, un‑bundled notification to group with
 * @param {Object|Types.ObjectId} notificationData
 * @param {number} timeframeMs
 * @returns {Promise<Notification|null>}
 */
notificationSchema.statics.findSimilarForBundling = async function(notificationData, timeframeMs = 3600000) {
  const rec = safeObjectId(notificationData.recipient, 'recipient');
  const snd = safeObjectId(notificationData.sender,    'sender');
  const typ = notificationData.type;

  if (!rec || !snd || !typ) return null;

  const cutoff = new Date(Date.now() - timeframeMs);
  try {
    return this.findOne({
      recipient: rec,
      sender:    snd,
      type:      typ,
      createdAt: { $gte: cutoff },
      parentNotification: { $exists: false },
    }).sort({ createdAt: -1 });
  } catch (err) {
    logger.error(`findSimilarForBundling failed: ${err.message}`);
    return null;
  }
};

/**
 * Create or update a notification, automatically bundling if desired
 * @param {Object} data
 * @param {boolean} enableBundling
 * @returns {Promise<Notification>}
 */
notificationSchema.statics.createWithBundling = async function(data, enableBundling = true) {
  // Validate required
  if (!data.recipient || !data.type) {
    const err = new MongooseError.ValidationError();
    if (!data.recipient) err.addError('recipient', new MongooseError.ValidatorError({ message: 'Recipient is required' }));
    if (!data.type)      err.addError('type',      new MongooseError.ValidatorError({ message: 'Type is required' }));
    throw err;
  }

  // Simple create if bundling off or no sender
  if (!enableBundling || !data.sender) {
    return this.create(data);
  }

  // Attempt to bundle
  const existing = await this.findSimilarForBundling(data);
  if (existing) {
    existing.count += 1;
    existing.read = false;
    existing.updatedAt = new Date();
    if (data.content) existing.content = data.content;
    if (data.data && existing.data) {
      existing.data = { ...existing.data, ...data.data, bundled: true, count: existing.count };
    }
    return existing.save();
  }

  // Otherwise new
  return this.create(data);
};

/**
 * Mark this notification as read
 * @returns {Promise<Notification>}
 */
notificationSchema.methods.markAsRead = async function() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

export default model('Notification', notificationSchema);
