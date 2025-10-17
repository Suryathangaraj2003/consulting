const mongoose = require("mongoose")

const appointmentSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    counselor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      default: 50, // minutes
    },
    sessionType: {
      type: String,
      enum: ["video", "chat", "email"],
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "confirmed", "in-progress", "completed", "cancelled"],
      default: "scheduled",
    },
    notes: {
      type: String,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },
    sessionNotes: {
      type: String,
      default: "",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      default: "",
    },
    // Google Meet integration fields
    meetingLink: {
      type: String,
      default: "",
    },
    meetingId: {
      type: String,
      default: "",
    },
    sessionStartTime: {
      type: Date,
    },
    sessionEndTime: {
      type: Date,
    },
    sessionDuration: {
      type: Number, // in minutes
      default: 0,
    },
    // Updated Google Meet fields for manual integration
    googleEventId: {
      type: String,
      default: null,
      index: true
    },
    meetingPlatform: {
      type: String,
      enum: ["google-meet", "google-meet-fallback", "google-meet-manual", null], // Added "google-meet-manual"
      default: null
    },
    meetingCreatedAt: {
      type: Date,
      default: null
    },
    notifications: [{
      message: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      type: {
        type: String,
        enum: ["meeting_notification", "reminder", "cancellation", "update", "meeting_link_shared"], // Added "meeting_link_shared"
        default: "meeting_notification"
      },
      meetingLink: {
        type: String,
        default: ""
      }
    }]
  },
  {
    timestamps: true,
  },
)

// Add indexes for better query performance
appointmentSchema.index({ client: 1, date: -1 })
appointmentSchema.index({ counselor: 1, date: -1 })
appointmentSchema.index({ status: 1, date: 1 })
appointmentSchema.index({ googleEventId: 1 })
appointmentSchema.index({ meetingLink: 1 }) // New index for meeting link queries

module.exports = mongoose.model("Appointment", appointmentSchema)
