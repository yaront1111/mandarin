// models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["message", "like", "match", "photoRequest", "photoResponse", "story", "system"],
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  content: String,
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "referenceModel"
  },
  referenceModel: {
    type: String,
    enum: ["Message", "Like", "Photo", "Story"]
  },
  data: mongoose.Schema.Types.Mixed,
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
