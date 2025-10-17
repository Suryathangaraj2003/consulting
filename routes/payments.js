const express = require("express")
const Payment = require("../models/Payment")
const Appointment = require("../models/Appointment")
const auth = require("../middleware/auth")

const router = express.Router()

// Process payment
router.post("/", auth, async (req, res) => {
  try {
    const { appointmentId, paymentMethod, stripeToken } = req.body
    const clientId = req.user.userId

    // Get appointment details
    const appointment = await Appointment.findById(appointmentId).populate("counselor", "firstName lastName")

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" })
    }

    if (appointment.client.toString() !== clientId) {
      return res.status(403).json({ message: "Not authorized" })
    }

    // Create payment record
    const payment = new Payment({
      client: clientId,
      counselor: appointment.counselor._id,
      appointment: appointmentId,
      amount: appointment.amount,
      paymentMethod,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: "completed", // Mock successful payment
    })

    await payment.save()

    // Update appointment payment status
    appointment.paymentStatus = "paid"
    await appointment.save()

    res.json({
      message: "Payment processed successfully",
      payment,
      transactionId: payment.transactionId,
    })
  } catch (error) {
    console.error("Payment processing error:", error)
    res.status(500).json({ message: "Payment processing failed" })
  }
})

// Get payment history
router.get("/", auth, async (req, res) => {
  try {
    const { userId, userType } = req.user
    let payments

    if (userType === "client") {
      payments = await Payment.find({ client: userId })
        .populate("counselor", "firstName lastName")
        .populate("appointment", "date time sessionType")
        .sort({ createdAt: -1 })
    } else {
      payments = await Payment.find({ counselor: userId })
        .populate("client", "firstName lastName")
        .populate("appointment", "date time sessionType")
        .sort({ createdAt: -1 })
    }

    res.json(payments)
  } catch (error) {
    console.error("Get payments error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
