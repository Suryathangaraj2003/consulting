const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phone: {
      type: String,
      required: true,
    },
    userType: {
      type: String,
      enum: ["client", "counselor"],
      required: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    // Counselor specific fields
    licenseNumber: {
      type: String,
      required: function () {
        return this.userType === "counselor"
      },
    },
    specialization: {
      type: String,
      enum: ["mental-health", "relationship", "career", "family", "addiction", "trauma"],
      required: function () {
        return this.userType === "counselor"
      },
    },
    experience: {
      type: String,
      required: function () {
        return this.userType === "counselor"
      },
    },
    bio: {
      type: String,
      required: function () {
        return this.userType === "counselor"
      },
    },
    hourlyRate: {
      type: Number,
      required: function () {
        return this.userType === "counselor"
      },
    },
    availability: [
      {
        day: String,
        startTime: String,
        endTime: String,
      },
    ],
    rating: {
      type: Number,
      default: 0,
    },
    totalSessions: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

module.exports = mongoose.model("User", userSchema)
