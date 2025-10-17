const mongoose = require("mongoose")

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    content: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "file", "image"],
      default: "text",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    attachments: [
      {
        filename: String,
        url: String,
        fileType: String,
      },
    ],
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Message", messageSchema)
