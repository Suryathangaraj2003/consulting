const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");

dotenv.config();

// Connect to MongoDB using the same connection string as server
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/counseling-platform";

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createTestCounselors() {
  try {
    // Clear existing test counselors
    await User.deleteMany({ email: { $regex: /test.*@example\.com/ } });
    
    // Create multiple test counselors
    const counselors = [
      {
        firstName: "Dr. Sarah",
        lastName: "Johnson",
        email: "sarah.test@example.com",
        password: "123456",
        phone: "1234567890",
        userType: "counselor",
        licenseNumber: "LIC123",
        specialization: "mental-health",
        experience: "5 years",
        bio: "Experienced mental health counselor with expertise in anxiety and depression.",
        hourlyRate: 100,
        rating: 4.8,
        totalSessions: 120
      },
      {
        firstName: "Dr. Michael",
        lastName: "Chen",
        email: "michael.test@example.com",
        password: "123456",
        phone: "1234567891",
        userType: "counselor",
        licenseNumber: "LIC124",
        specialization: "relationship",
        experience: "8 years",
        bio: "Specialized in relationship counseling and family therapy.",
        hourlyRate: 120,
        rating: 4.9,
        totalSessions: 200
      },
      {
        firstName: "Dr. Emily",
        lastName: "Davis",
        email: "emily.test@example.com",
        password: "123456",
        phone: "1234567892",
        userType: "counselor",
        licenseNumber: "LIC125",
        specialization: "career",
        experience: "3 years",
        bio: "Career counselor helping professionals find their path.",
        hourlyRate: 90,
        rating: 4.7,
        totalSessions: 80
      }
    ];

    for (const counselorData of counselors) {
      const counselor = new User(counselorData);
      await counselor.save();
      console.log(`Created counselor: ${counselor.firstName} ${counselor.lastName} (${counselor.userType})`);
    }

    // Test the registration endpoint by making a request
    const axios = require("axios");
    try {
      const response = await axios.post("http://localhost:5000/api/auth/register", {
        firstName: "Test",
        lastName: "Counselor",
        email: "test.counselor@example.com",
        password: "123456",
        phone: "1234567893",
        userType: "counselor",
        licenseNumber: "LIC126",
        specialization: "trauma",
        experience: "6 years",
        bio: "Trauma specialist with extensive experience.",
        hourlyRate: 110
      });
      
      console.log("Registration test successful:", response.data.user.userType);
    } catch (error) {
      console.log("Registration test failed:", error.response?.data || error.message);
    }

    console.log("Test counselors created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error creating test counselors:", error);
    process.exit(1);
  }
}

createTestCounselors(); 