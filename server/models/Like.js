const mongoose = require("mongoose")

const likeSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
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
)

// Ensure a user can only like another user once
likeSchema.index({ sender: 1, recipient: 1 }, { unique: true })

// Create TTL index to automatically delete likes after 6 months if needed
// likeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 }) // 6 months

const Like = mongoose.model("Like", likeSchema)

module.exports = Like
