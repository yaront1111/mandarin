const mongoose = require("mongoose")
const Schema = mongoose.Schema

const StorySchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["image", "video", "text"],
    required: true,
  },
  media: {
    type: String,
  },
  content: {
    type: String,
  },
  backgroundColor: {
    type: String,
    default: "#000000",
  },
  fontStyle: {
    type: String,
    default: "default",
  },
  duration: {
    type: Number,
    default: 10, // Duration in seconds
  },
  viewers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // 24 hours in seconds
  },
})

// Ensure media is required for image and video types
StorySchema.pre("save", function (next) {
  if ((this.type === "image" || this.type === "video") && !this.media) {
    return next(new Error("Media is required for image and video stories"))
  }

  if (this.type === "text" && !this.content) {
    return next(new Error("Content is required for text stories"))
  }

  next()
})

module.exports = mongoose.model("Story", StorySchema)
