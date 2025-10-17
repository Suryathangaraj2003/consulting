const mongoose = require("mongoose");
const User = require("./models/User");
const dotenv = require("dotenv");

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/counseling-platform";

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createTestUsers() {
  try {
    console.log("Creating test users...\n");

    // Create test client
    const existingClient = await User.findOne({ email: "client@test.com" });
    if (!existingClient) {
      const client = new User({
        firstName: "John",
        lastName: "Doe",
        email: "client@test.com",
        password: "123456",
        phone: "1234567890",
        userType: "client"
      });
      await client.save();
      console.log("✅ Created test CLIENT:");
      console.log("   Email: client@test.com");
      console.log("   Password: 123456");
      console.log("   Type: client\n");
    } else {
      console.log("ℹ️  Test client already exists:");
      console.log("   Email: client@test.com");
      console.log("   Password: 123456");
      console.log("   Type: client\n");
    }

    // Create test counselor
    const existingCounselor = await User.findOne({ email: "counselor@test.com" });
    if (!existingCounselor) {
      const counselor = new User({
        firstName: "Dr. Sarah",
        lastName: "Smith",
        email: "counselor@test.com",
        password: "123456",
        phone: "1234567891",
        userType: "counselor",
        licenseNumber: "LIC001",
        specialization: "mental-health",
        experience: "5 years",
        bio: "Experienced mental health counselor",
        hourlyRate: 100,
        rating: 4.8,
        totalSessions: 50
      });
      await counselor.save();
      console.log("✅ Created test COUNSELOR:");
      console.log("   Email: counselor@test.com");
      console.log("   Password: 123456");
      console.log("   Type: counselor\n");
    } else {
      console.log("ℹ️  Test counselor already exists:");
      console.log("   Email: counselor@test.com");
      console.log("   Password: 123456");
      console.log("   Type: counselor\n");
    }

    console.log("\n📝 Use these credentials to test the application:");
    console.log("\nCLIENT LOGIN:");
    console.log("  Email: client@test.com");
    console.log("  Password: 123456");
    console.log("  Select: Client");
    console.log("\nCOUNSELOR LOGIN:");
    console.log("  Email: counselor@test.com");
    console.log("  Password: 123456");
    console.log("  Select: Counselor");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating test users:", error);
    process.exit(1);
  }
}

createTestUsers();

