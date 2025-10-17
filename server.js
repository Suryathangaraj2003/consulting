const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")
const http = require("http")
const socketIo = require("socket.io")

// Import routes
const authRoutes = require("./routes/auth")
const appointmentRoutes = require("./routes/appointments")
const paymentRoutes = require("./routes/payments")
const messageRoutes = require("./routes/messages")

dotenv.config()

const app = express()

// Log every request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      'https://newconsulting.netlify.app',
      "https://newconsult.netlify.app",
      process.env.FRONTEND_URL || "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
})

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://localhost:3001",
    "https://newconsulting.netlify.app/",
    "https://newconsult.netlify.app",
    process.env.FRONTEND_URL || "http://localhost:3000"
  ],
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI || "mongodb+srv://suryathangaraj95:suryathangaraj95@cluster0.lxspgu8.mongodb.net/"

mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.log("❌ MongoDB connection error:", err))

// Import models for Socket.IO
const Message = require("./models/Message");
const Appointment = require("./models/Appointment");

// Socket.IO for real-time features
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id)

  // Join a session/appointment room
  socket.on("join-session", (sessionId) => {
    socket.join(sessionId)
    console.log(`🔗 User ${socket.id} joined session: ${sessionId}`)
    
    // Confirm to the client they've joined
    socket.emit("session-joined", { sessionId })
  })

  // Handle sending messages with full database save and broadcast
  socket.on("send-message", async (data) => {
    try {
      const { appointmentId, content, messageType } = data;
      
      console.log('📤 Socket: Received send-message:', {
        appointmentId,
        content: content?.substring(0, 50) + '...',
        messageType,
        socketId: socket.id
      });

      if (!appointmentId || !content) {
        console.error('❌ Socket: Missing appointmentId or content');
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      // Get the appointment to find sender and receiver
      const appointment = await Appointment.findById(appointmentId)
        .populate('client', 'firstName lastName avatar')
        .populate('counselor', 'firstName lastName avatar');

      if (!appointment) {
        console.error('❌ Socket: Appointment not found:', appointmentId);
        socket.emit('error', { message: 'Appointment not found' });
        return;
      }

      // Find the latest message from database (it was already saved by HTTP POST)
      // We fetch it to get the fully populated version with sender/receiver data
      const latestMessage = await Message.findOne({ 
        appointment: appointmentId,
        content: content.trim()
      })
        .populate('sender', 'firstName lastName avatar')
        .populate('receiver', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .limit(1);

      if (latestMessage) {
        console.log('✅ Socket: Found message in database:', {
          messageId: latestMessage._id,
          sender: latestMessage.sender?.firstName,
          receiver: latestMessage.receiver?.firstName,
          content: latestMessage.content.substring(0, 30)
        });
        
        // Broadcast to ALL users in the room (including sender)
        io.to(appointmentId).emit('receive-message', latestMessage);
        
        console.log(`📢 Socket: Message broadcasted to room ${appointmentId}`);
      } else {
        console.warn('⚠️ Socket: Message not found in database, might need a small delay');
        
        // If message not found immediately, wait 100ms and try again
        setTimeout(async () => {
          const retryMessage = await Message.findOne({ 
            appointment: appointmentId,
            content: content.trim()
          })
            .populate('sender', 'firstName lastName avatar')
            .populate('receiver', 'firstName lastName avatar')
            .sort({ createdAt: -1 })
            .limit(1);

          if (retryMessage) {
            console.log('✅ Socket: Found message on retry');
            io.to(appointmentId).emit('receive-message', retryMessage);
          } else {
            console.error('❌ Socket: Message still not found after retry');
          }
        }, 100);
      }

    } catch (error) {
      console.error('❌ Socket: Error in send-message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  })

  // Legacy chat events (keeping for compatibility)
  socket.on("join-chat", (appointmentId) => {
    socket.join(`chat-${appointmentId}`)
    console.log(`📝 User joined chat: ${appointmentId}`)
  })

  socket.on("chat-message", (data) => {
    console.log('💬 Legacy chat-message received:', data);
    socket.to(`chat-${data.appointmentId}`).emit("new-chat-message", data)
  })

  socket.on("video-signal", (data) => {
    console.log('📹 Video signal received:', data.sessionId);
    socket.to(data.sessionId).emit("video-signal", data)
  })

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id)
  })

  // Handle any socket errors
  socket.on("error", (error) => {
    console.error("❌ Socket error:", error);
  })
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/appointments", appointmentRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/messages", messageRoutes)

// Public counselors endpoint for booking dropdown
app.get("/api/counselors", async (req, res) => {
  try {
    const User = require("./models/User");
    const counselors = await User.find({ userType: "counselor" }).select(
      "firstName lastName specialization avatar hourlyRate experience bio rating totalSessions availability"
    );
    res.json(counselors);
  } catch (error) {
    console.error("Get counselors error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok",
    message: "Server is running!",
    timestamp: new Date().toISOString()
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
  console.log(`🌐 Frontend URLs allowed:`)
  console.log(`   - http://localhost:3000`)
  console.log(`   - http://localhost:3001`)
  console.log(`   - https://newconsult.netlify.app`)
})
