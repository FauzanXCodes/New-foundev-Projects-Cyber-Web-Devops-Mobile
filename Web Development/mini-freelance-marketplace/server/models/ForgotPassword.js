import mongoose from "mongoose";

const ForgotPasswordSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now(),
        expires: 5 * 60,
    }

});

export const ForgotPassword = mongoose.model("ForgotPassword", ForgotPasswordSchema);