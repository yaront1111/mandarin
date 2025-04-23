// models/Message.js
import mongoose from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import logger from '../logger.js';

const { Schema, model, Types, Error: MongooseError } = mongoose;
const { ObjectId } = Types;

// -----------------------------
// Helper: Safe ObjectId casting
// -----------------------------
function safeObjectId(id, fieldName) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (ObjectId.isValid(id)) return new ObjectId(id);
  throw new MongooseError.CastError('ObjectId', id, fieldName);
}

// -------------------------------------
// Helper: simple pagination for queries
// -------------------------------------
async function paginate(query, { page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    query.skip(skip).limit(limit).lean().exec(),
    query.model.countDocuments(query.getQuery()),
  ]);
  return {
    messages: docs,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// -------------------------
// Attachment Sub-Schema
// -------------------------
const AttachmentSchema = new Schema({
  type: {
    type: String,
    enum: ['image', 'video', 'audio', 'file'],
    required: true,
  },
  url: { type: String, required: true, trim: true },
  filename: { type: String, trim: true },
  size: { type: Number, min: 0, max: 10 * 1024 * 1024 },
  mimeType: { type: String, trim: true },
  metadata: {
    width: Number,
    height: Number,
    duration: Number,
    thumbnail: String,
  },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'ready', 'failed'],
    default: 'ready',
  },
});

// -------------------------
// Reaction Sub-Schema
// -------------------------
const ReactionSchema = new Schema({
  user: { type: ObjectId, ref: 'User', required: true },
  emoji: {
    type: String,
    required: true,
    validate: {
      validator(v) {
        // allow standard and extended emojis
        return /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u.test(v);
      },
      message: props => `Invalid emoji format: ${props.value}`,
    },
  },
  createdAt: { type: Date, default: Date.now },
});

// -------------------------
// Main Message Schema
// -------------------------
const MessageSchema = new Schema({
  sender:    { type: ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: ObjectId, ref: 'User', required: true, index: true },

  type: {
    type: String,
    enum: ['text','wink','video','image','audio','file','contact','system'],
    default: 'text',
    index: true,
  },

  content: {
    type: String,
    required: function() { return this.type === 'text'; },
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
    validate: {
      validator(v) {
        return this.type !== 'text' || (v && v.trim().length > 0);
      },
      message: 'Text messages cannot be empty',
    },
  },

  attachment:       AttachmentSchema,
  read:             { type: Boolean, default: false, index: true },
  readAt:           { type: Date, default: null },
  status: {
    type: String,
    enum: ['sending','sent','delivered','failed'],
    default: 'sent',
    index: true,
  },
  statusUpdatedAt:  { type: Date, default: Date.now },
  isEdited:         { type: Boolean, default: false },
  editHistory: [{
    content: String,
    editedAt: { type: Date, default: Date.now },
  }],

  deletedBySender:    { type: Boolean, default: false },
  deletedByRecipient: { type: Boolean, default: false },

  expiresAfterRead: { type: Boolean, default: false },
  expiryTime:       { type: Number, default: null },

  initiatedBy:     { type: ObjectId, ref: 'User' },
  isForwarded:     { type: Boolean, default: false },
  originalMessage: { type: ObjectId, ref: 'Message' },

  reactions:      [ReactionSchema],

  metadata: {
    clientMessageId: { type: String, index: true },
    contact: {
      name:  String,
      phone: String,
      email: String,
    },
  },

  createdAt: { type: Date, default: Date.now, index: true },
}, {
  timestamps: true,
  toJSON:    { virtuals: true },
  toObject:  { virtuals: true },
});

// -------------------------
// Indexes
// -------------------------
MessageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, recipient: 1, read: 1, createdAt: -1 });
MessageSchema.index({ deletedBySender: 1, deletedByRecipient: 1 });

// -------------------------------------
// Virtual: Conversation ID for grouping
// -------------------------------------
MessageSchema.virtual('conversationId').get(function() {
  const [a, b] = [this.sender.toString(), this.recipient.toString()].sort();
  return `${a}_${b}`;
});

// -------------------------------------------------
// Pre-save: sanitize, set readAt/statusUpdatedAt, cast IDs
// -------------------------------------------------
MessageSchema.pre('save', function(next) {
  try {
    // sanitize text
    if (this.isModified('content') && this.type === 'text' && this.content) {
      this.content = sanitizeHtml(this.content, {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'discard',
      }).trim().slice(0, 2000);
    }

    // timestamps
    if (this.isModified('read') && this.read && !this.readAt) {
      this.readAt = new Date();
    }
    if (this.isModified('status')) {
      this.statusUpdatedAt = new Date();
    }

    // safe cast ObjectIds
    this.sender    = safeObjectId(this.sender,    'sender');
    this.recipient = safeObjectId(this.recipient, 'recipient');
    if (this.initiatedBy)     this.initiatedBy     = safeObjectId(this.initiatedBy,     'initiatedBy');
    if (this.originalMessage) this.originalMessage = safeObjectId(this.originalMessage, 'originalMessage');

    next();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------
// Static: fetch paginated history
// ---------------------------------
MessageSchema.statics.getConversation = async function(u1, u2, opts = {}) {
  const page   = Number(opts.page)   || 1;
  const limit  = Number(opts.limit)  || 50;
  const includeDeleted = !!opts.includeDeleted;

  const user1 = safeObjectId(u1, 'user1');
  const user2 = safeObjectId(u2, 'user2');

  let orClauses = [
    { sender: user1, recipient: user2 },
    { sender: user2, recipient: user1 },
  ];

  if (!includeDeleted) {
    orClauses = orClauses.map(cond => ({
      ...cond,
      ...(cond.sender.equals(user1)
        ? { deletedBySender: false }
        : { deletedByRecipient: false })
    }));
  }

  const query = this.find({ $or: orClauses }).sort({ createdAt: -1 });
  return paginate(query, { page, limit });
};

// ---------------------------------
// Static: mark many as read
// ---------------------------------
MessageSchema.statics.markAsRead = async function(recipientId, senderId) {
  const r = safeObjectId(recipientId, 'recipientId');
  const s = safeObjectId(senderId,    'senderId');

  const res = await this.updateMany(
    { sender: s, recipient: r, read: false },
    { read: true, readAt: new Date() }
  );
  return res.modifiedCount;
};

// ---------------------------------
// Static: unread count per sender
// ---------------------------------
MessageSchema.statics.getUnreadCountBySender = async function(recipientId) {
  const r = safeObjectId(recipientId, 'recipientId');
  return this.aggregate([
    { $match: { recipient: r, read: false, deletedByRecipient: false } },
    { $group: { id: '$sender', count: { $sum: 1 }, lastMessage: { $max: '$createdAt' } } },
    { $sort: { lastMessage: -1 } },
  ]);
};

// ---------------------------------
// Instance: edit a text message
// ---------------------------------
MessageSchema.methods.editMessage = async function(newContent) {
  if (this.type !== 'text') {
    throw new MongooseError.ValidationError('Only text messages can be edited');
  }
  this.editHistory = this.editHistory || [];
  this.editHistory.push({ content: this.content, editedAt: new Date() });
  this.content = sanitizeHtml(newContent, {
    allowedTags: [], allowedAttributes: {}, disallowedTagsMode: 'discard'
  }).trim().slice(0, 2000);
  this.isEdited = true;
  return this.save();
};

// ---------------------------------
// Instance: add or update reaction
// ---------------------------------
MessageSchema.methods.addReaction = async function(userId, emoji) {
  const uid = safeObjectId(userId, 'reaction.user');
  const existing = this.reactions.find(r => r.user.equals(uid));
  if (existing) {
    existing.emoji     = emoji;
    existing.createdAt = new Date();
  } else {
    this.reactions.push({ user: uid, emoji, createdAt: new Date() });
  }
  return this.save();
};

// ---------------------------------
// Instance: remove a reaction
// ---------------------------------
MessageSchema.methods.removeReaction = async function(userId) {
  const uid = safeObjectId(userId, 'reaction.user');
  this.reactions = this.reactions.filter(r => !r.user.equals(uid));
  return this.save();
};

// ---------------------------------
// Instance: soft-delete for a user
// ---------------------------------
MessageSchema.methods.markAsDeletedFor = async function(userId, mode = 'self') {
  const uid = safeObjectId(userId, 'markAsDeletedFor.user');
  const isSender    = this.sender.equals(uid);
  const isRecipient = this.recipient.equals(uid);

  if (!isSender && !isRecipient) {
    throw new MongooseError.ValidationError('Not authorized to delete this message');
  }

  if (mode === 'self') {
    if (isSender)    this.deletedBySender    = true;
    if (isRecipient) this.deletedByRecipient = true;
  } else if (mode === 'both' && isSender) {
    this.deletedBySender = this.deletedByRecipient = true;
  } else {
    throw new MongooseError.ValidationError('Invalid delete mode');
  }

  // If both parties have deleted, remove from DB
  if (this.deletedBySender && this.deletedByRecipient) {
    return this.constructor.deleteOne({ id: this.id });
  }
  return this.save();
};

// ---------------------------------
// Instance: check hidden status
// ---------------------------------
MessageSchema.methods.isHiddenFrom = function(userId) {
  const uid = safeObjectId(userId, 'isHiddenFrom.user');
  return (this.sender.equals(uid)    && this.deletedBySender)
      || (this.recipient.equals(uid) && this.deletedByRecipient);
};

// -------------------------
// Export Model
// -------------------------
const Message = model('Message', MessageSchema);
export default Message;
