// Add this to your Like.js model file

const mongoose = require("mongoose")

// Create a custom schema type for flexible IDs
const FlexibleIdSchema = {
  type: mongoose.Schema.Types.Mixed,
  get: function(val) {
    return val ? val.toString() : val;
  },
  set: function(val) {
    return val ? val.toString() : val;
  },
  validate: {
    validator: function(v) {
      // Accept both string IDs and ObjectIDs
      return v === null || v === undefined || 
             typeof v === 'string' || 
             v instanceof mongoose.Types.ObjectId ||
             mongoose.Types.ObjectId.isValid(v);
    },
    message: props => `${props.value} is not a valid ID`
  }
};

const likeSchema = new mongoose.Schema(
  {
    sender: {
      ...FlexibleIdSchema,
      ref: "User",
      required: true,
    },
    recipient: {
      ...FlexibleIdSchema,
      ref: "User",
      required: true,
    },
    // Optional message with the like
    message: {
      type: String,
      maxlength: 200,
    },
    // Track if this like has been seen by the recipient
    seen: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Ensure a user can only like another user once - use string representation
likeSchema.index({ 
  sender: 1, 
  recipient: 1 
}, { 
  unique: true,
  // Use a custom collation to handle different string formats
  collation: { locale: 'en', strength: 2 }
});

// Add hook to ensure IDs are stored as strings
likeSchema.pre('save', function(next) {
  if (this.sender) this.sender = this.sender.toString();
  if (this.recipient) this.recipient = this.recipient.toString();
  next();
});

// Add hook for find queries to handle different ID formats
likeSchema.pre(/^find/, function(next) {
  // If finding by sender or recipient, allow string or ObjectId
  const query = this.getQuery();
  
  if (query.sender && typeof query.sender === 'string') {
    try {
      const objectId = mongoose.Types.ObjectId.createFromHexString(query.sender);
      query.$or = [{ sender: query.sender }, { sender: objectId }];
      delete query.sender;
    } catch (e) {
      // If not a valid ObjectId, keep the original query
    }
  }
  
  if (query.recipient && typeof query.recipient === 'string') {
    try {
      const objectId = mongoose.Types.ObjectId.createFromHexString(query.recipient);
      query.$or = query.$or || [];
      query.$or.push({ recipient: query.recipient }, { recipient: objectId });
      delete query.recipient;
    } catch (e) {
      // If not a valid ObjectId, keep the original query
    }
  }
  
  next();
});

const Like = mongoose.model("Like", likeSchema);

module.exports = Like;
