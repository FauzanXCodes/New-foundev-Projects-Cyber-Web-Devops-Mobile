import express from "express";
import { rateLimit } from 'express-rate-limit'
import { getUserById, login, LogoutUser, markNotificationAsRead, resendOtp, resetPassword, sendForgotPasswordOtp, signup, verifyForgotPasswordOtp, verifyOtp } from "../controllers/AuthController.js";
import { getUser } from "../middlewares/ServerSentUpdates.js";
import { authenticateUser } from "../middlewares/AuthMiddleware.js";
const router = express.Router();
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
})
const UserFetchLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
})

router.post("/login", limiter, login);

router.post("/logout", limiter, LogoutUser);

router.post("/signup", limiter, signup);

router.post("/verifyOtp", limiter, verifyOtp);

router.post("/resendOtp", limiter, resendOtp);

router.post("/sendForgotPasswordOtp", limiter, sendForgotPasswordOtp);

router.post("/verifyForgotPasswordOtp", limiter, verifyForgotPasswordOtp);

router.post("/resetPassword", limiter, resetPassword);

router.get("/getUser/:email", authenticateUser, getUser);

router.get("/getUserById/:freelancerId", UserFetchLimiter, authenticateUser, getUserById);

router.post("/markNotification", limiter, authenticateUser, markNotificationAsRead);

export default router;