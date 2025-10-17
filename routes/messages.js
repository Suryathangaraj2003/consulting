const express = require("express");
const Message = require("../models/Message");
const Appointment = require("../models/Appointment");
const auth = require("../middleware/auth");

const router = express.Router();

// Get messages for a specific appointment
router.get("/appointment/:appointmentId", auth, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { userId, userType } = req.user;

    // Validate user type
    if (!userType || !['client', 'counselor'].includes(userType)) {
      return res.status(403).json({ message: "Invalid user type" });
    }

    // Verify appointment exists and populate client/counselor data
    const appointment = await Appointment.findById(appointmentId)
      .populate("client", "firstName lastName avatar")
      .populate("counselor", "firstName lastName specialization avatar");
    
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Verify user has access to this appointment
    const isClient = appointment.client._id.toString() === userId;
    const isCounselor = appointment.counselor._id.toString() === userId;
    
    if (!isClient && !isCounselor) {
      return res.status(403).json({ message: "Not authorized to access this appointment" });
    }

    // Validate user type matches appointment role
    if (userType === 'client' && !isClient) {
      return res.status(403).json({ message: "Client can only access their own appointments" });
    }
    if (userType === 'counselor' && !isCounselor) {
      return res.status(403).json({ message: "Counselor can only access their own appointments" });
    }

    // Get messages for this appointment
    const messages = await Message.find({ appointment: appointmentId })
      .populate("sender", "firstName lastName avatar")
      .populate("receiver", "firstName lastName avatar")
      .sort({ createdAt: 1 });

    // Log messages for debugging
    console.log(`Found ${messages.length} messages for appointment ${appointmentId}`);
    messages.forEach((message, index) => {
      if (!message.sender) {
        console.warn(`Message ${index} has no sender:`, message);
      }
      if (!message.receiver) {
        console.warn(`Message ${index} has no receiver:`, message);
      }
      
      // Log detailed message structure for debugging
      console.log(`Message ${index}:`, {
        id: message._id,
        senderId: message.sender?._id,
        senderName: message.sender ? `${message.sender.firstName} ${message.sender.lastName}` : 'No sender',
        receiverId: message.receiver?._id,
        receiverName: message.receiver ? `${message.receiver.firstName} ${message.receiver.lastName}` : 'No receiver',
        content: message.content?.substring(0, 50) + '...'
      });
    });

    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Send a message
router.post("/", auth, async (req, res) => {
  try {
    const { appointmentId, content, messageType = "text", attachments = [] } = req.body;
    const { userId, userType } = req.user;

    // Validate input
    if (!appointmentId || !content || content.trim().length === 0) {
      return res.status(400).json({ message: "Appointment ID and content are required" });
    }

    // Validate user type
    if (!userType || !['client', 'counselor'].includes(userType)) {
      return res.status(403).json({ message: "Invalid user type" });
    }

    // Validate message type
    if (!['text', 'file', 'image'].includes(messageType)) {
      return res.status(400).json({ message: "Invalid message type" });
    }

    // Verify appointment exists and populate client/counselor data
    const appointment = await Appointment.findById(appointmentId)
      .populate("client", "firstName lastName avatar")
      .populate("counselor", "firstName lastName specialization avatar");
    
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Verify user has access to this appointment
    const isClient = appointment.client._id.toString() === userId;
    const isCounselor = appointment.counselor._id.toString() === userId;
    
    if (!isClient && !isCounselor) {
      return res.status(403).json({ message: "Not authorized to send messages for this appointment" });
    }

    // Validate user type matches appointment role
    if (userType === 'client' && !isClient) {
      return res.status(403).json({ message: "Client can only send messages to their own appointments" });
    }
    if (userType === 'counselor' && !isCounselor) {
      return res.status(403).json({ message: "Counselor can only send messages to their own appointments" });
    }

    // Check appointment status - only allow messages for active appointments
    if (!['scheduled', 'confirmed', 'in-progress'].includes(appointment.status)) {
      return res.status(400).json({ message: "Cannot send messages for this appointment status" });
    }

    // Determine receiver (if sender is client, receiver is counselor, and vice versa)
    const receiverId = isClient ? appointment.counselor._id : appointment.client._id;

    // Create new message with validation
    const message = new Message({
      sender: userId,
      receiver: receiverId,
      appointment: appointmentId,
      content: content.trim(),
      messageType,
      attachments: attachments || []
    });

    // Validate message before saving
    const validationError = message.validateSync();
    if (validationError) {
      return res.status(400).json({ 
        message: "Message validation failed", 
        errors: validationError.errors 
      });
    }

    await message.save();
    
    // Populate sender and receiver data
    await message.populate("sender", "firstName lastName avatar");
    await message.populate("receiver", "firstName lastName avatar");

    // Verify population worked
    if (!message.sender) {
      console.error("Failed to populate sender for message:", message._id);
      return res.status(500).json({ message: "Failed to populate sender data" });
    }
    if (!message.receiver) {
      console.error("Failed to populate receiver for message:", message._id);
      return res.status(500).json({ message: "Failed to populate receiver data" });
    }
    
    // Log detailed message structure for debugging
    console.log('New message created successfully:', {
      id: message._id,
      senderId: message.sender._id,
      senderName: `${message.sender.firstName} ${message.sender.lastName}`,
      receiverId: message.receiver._id,
      receiverName: `${message.receiver.firstName} ${message.receiver.lastName}`,
      appointmentId: message.appointment,
      content: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
      userType: userType,
      appointmentStatus: appointment.status,
      // Debug authentication info
      authUserId: userId,
      authUserType: userType,
      isClient: isClient,
      isCounselor: isCounselor,
      appointmentClientId: appointment.client._id.toString(),
      appointmentCounselorId: appointment.counselor._id.toString()
    });

    res.status(201).json({
      message: "Message sent successfully",
      data: message
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark messages as read
router.patch("/read", auth, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const { userId, userType } = req.user;

    // Validate input
    if (!appointmentId) {
      return res.status(400).json({ message: "Appointment ID is required" });
    }

    // Validate user type
    if (!userType || !['client', 'counselor'].includes(userType)) {
      return res.status(403).json({ message: "Invalid user type" });
    }

    // Verify appointment exists and user has access
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Verify user has access to this appointment
    const isClient = appointment.client.toString() === userId;
    const isCounselor = appointment.counselor.toString() === userId;
    
    if (!isClient && !isCounselor) {
      return res.status(403).json({ message: "Not authorized to access this appointment" });
    }

    // Mark all unread messages as read for this user in this appointment
    const result = await Message.updateMany(
      { 
        appointment: appointmentId, 
        receiver: userId, 
        isRead: false 
      },
      { isRead: true }
    );

    console.log(`Marked ${result.modifiedCount} messages as read for user ${userId} in appointment ${appointmentId}`);

    res.json({ 
      message: "Messages marked as read",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Mark messages as read error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get unread message count for a user
router.get("/unread-count", auth, async (req, res) => {
  try {
    const { userId, userType } = req.user;

    // Validate user type
    if (!userType || !['client', 'counselor'].includes(userType)) {
      return res.status(403).json({ message: "Invalid user type" });
    }

    const unreadCount = await Message.countDocuments({
      receiver: userId,
      isRead: false
    });

    console.log(`User ${userId} (${userType}) has ${unreadCount} unread messages`);

    res.json({ 
      unreadCount,
      userType,
      userId
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
