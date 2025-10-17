const express = require("express")
const Appointment = require("../models/Appointment")
const User = require("../models/User")
const auth = require("../middleware/auth")

const router = express.Router()

// Get all appointments for a user
router.get("/", auth, async (req, res) => {
  try {
    const { userType, userId } = req.user
    let appointments

    if (userType === "client") {
      appointments = await Appointment.find({ client: userId })
        .populate("counselor", "firstName lastName specialization avatar")
        .sort({ date: -1 })
    } else {
      appointments = await Appointment.find({ counselor: userId })
        .populate("client", "firstName lastName avatar")
        .sort({ date: -1 })
    }

    res.json(appointments)
  } catch (error) {
    console.error("Get appointments error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get single appointment by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("counselor", "firstName lastName specialization avatar")
      .populate("client", "firstName lastName avatar");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.client._id.toString() !== req.user.userId && 
        appointment.counselor._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Log appointment data for debugging
    console.log('Appointment data being sent to client:', {
      id: appointment._id,
      clientId: appointment.client._id,
      clientName: `${appointment.client.firstName} ${appointment.client.lastName}`,
      counselorId: appointment.counselor._id,
      counselorName: `${appointment.counselor.firstName} ${appointment.counselor.lastName}`,
      userId: req.user.userId
    });

    res.json(appointment);
  } catch (error) {
    console.error("Get appointment error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new appointment
router.post("/", auth, async (req, res) => {
  try {
    const { counselorId, date, time, sessionType, notes } = req.body
    const clientId = req.user.userId

    const counselor = await User.findById(counselorId)
    if (!counselor || counselor.userType !== "counselor") {
      return res.status(404).json({ message: "Counselor not found" })
    }

    const appointment = new Appointment({
      client: clientId,
      counselor: counselorId,
      date: new Date(date),
      time,
      sessionType,
      notes,
      amount: counselor.hourlyRate,
    })

    await appointment.save()
    await appointment.populate("counselor", "firstName lastName specialization")

    res.status(201).json({
      message: "Appointment booked successfully",
      appointment,
    })
  } catch (error) {
    console.error("Create appointment error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// NEW: Send meeting link to client (counselor manually shares Google Meet link)
router.post("/:id/send-meeting-link", auth, async (req, res) => {
  try {
    const { meetingLink } = req.body;
    const appointment = await Appointment.findById(req.params.id)
      .populate("client", "firstName lastName email")
      .populate("counselor", "firstName lastName");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Check if user is authorized (should be the counselor)
    if (appointment.counselor._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Validate Google Meet URL format
    if (!meetingLink || !meetingLink.includes('meet.google.com')) {
      return res.status(400).json({ message: "Please provide a valid Google Meet link" });
    }

    // Update appointment with meeting link
    appointment.meetingLink = meetingLink;
    appointment.meetingPlatform = "google-meet-manual";
    appointment.status = "confirmed";
    appointment.meetingCreatedAt = new Date();

    // Add notification
    if (!appointment.notifications) {
      appointment.notifications = [];
    }

    appointment.notifications.push({
      message: `Meeting link shared: ${meetingLink}`,
      timestamp: new Date(),
      type: 'meeting_link_shared',
      meetingLink: meetingLink
    });

    await appointment.save();

    res.json({
      message: "Meeting link sent to client successfully",
      meetingLink: meetingLink,
      appointment: appointment
    });
  } catch (error) {
    console.error("Send meeting link error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// NEW: Get meeting link for client
router.get("/:id/meeting-link", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("counselor", "firstName lastName");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Check if user is authorized (client or counselor)
    if (appointment.client.toString() !== req.user.userId && 
        appointment.counselor._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json({
      meetingLink: appointment.meetingLink || null,
      status: appointment.status,
      meetingAvailable: !!appointment.meetingLink
    });
  } catch (error) {
    console.error("Get meeting link error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATED: Notify client about meeting updates
router.post("/:id/notify-client", auth, async (req, res) => {
  try {
    const { message, meetingLink } = req.body;
    const appointment = await Appointment.findById(req.params.id)
      .populate("client", "firstName lastName email")
      .populate("counselor", "firstName lastName");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.counselor._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (!appointment.notifications) {
      appointment.notifications = [];
    }

    appointment.notifications.push({
      message,
      timestamp: new Date(),
      type: 'meeting_notification',
      meetingLink
    });

    await appointment.save();

    console.log(`Notification for ${appointment.client.email}: ${message}`);

    res.json({ 
      message: "Client notified successfully",
      notification: {
        clientEmail: appointment.client.email,
        message,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error("Notify client error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Start video session
router.post("/:id/start-session", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.counselor.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (appointment.sessionType === 'video' && !appointment.meetingLink) {
      return res.status(400).json({ message: "Meeting link not shared yet" });
    }

    appointment.status = "in-progress";
    appointment.sessionStartTime = new Date();
    await appointment.save();

    res.json({
      message: "Session started successfully",
      appointment: appointment
    });
  } catch (error) {
    console.error("Start session error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// End video session
router.post("/:id/end-session", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.counselor.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const sessionEndTime = new Date();
    
    let duration = null;
    if (appointment.sessionStartTime) {
      duration = Math.round((sessionEndTime - appointment.sessionStartTime) / (1000 * 60));
    }

    appointment.status = "completed";
    appointment.sessionEndTime = sessionEndTime;
    if (duration) {
      appointment.duration = duration;
    }
    await appointment.save();

    res.json({
      message: "Session ended successfully",
      appointment: appointment,
      duration: duration
    });
  } catch (error) {
    console.error("End session error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update appointment status
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { status } = req.body
    const appointmentId = req.params.id

    const appointment = await Appointment.findById(appointmentId)
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" })
    }

    if (appointment.client.toString() !== req.user.userId && appointment.counselor.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" })
    }

    appointment.status = status
    await appointment.save()

    res.json({ message: "Appointment status updated", appointment })
  } catch (error) {
    console.error("Update appointment error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Add session notes (counselor only)
router.patch("/:id/notes", auth, async (req, res) => {
  try {
    const { sessionNotes } = req.body
    const appointmentId = req.params.id

    if (req.user.userType !== "counselor") {
      return res.status(403).json({ message: "Only counselors can add session notes" })
    }

    const appointment = await Appointment.findById(appointmentId)
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" })
    }

    if (appointment.counselor.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized" })
    }

    appointment.sessionNotes = sessionNotes
    await appointment.save()

    res.json({ message: "Session notes updated", appointment })
  } catch (error) {
    console.error("Update session notes error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
