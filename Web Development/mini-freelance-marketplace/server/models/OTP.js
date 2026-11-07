import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    otp: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 5*60*1000) }
});


export const OTP = mongoose.model("OTP", otpSchema);
