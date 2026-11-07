import jwt from "jsonwebtoken";
import { Freelancer } from "../models/Freelancer.js";
import dotenv from "dotenv";
import { Client } from "../models/Client.js";

dotenv.config();

export const authenticateUser = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, message: "Access denied. No token provided." });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.email || !decoded?.sessionId || !decoded) {
            return res.status(401).json({ success: false, message: "Invalid token." });
        }
        const user = await Freelancer.findOne({ email: decoded.email, sessionId: decoded.sessionId }).select("-password") || await Client.findOne({ email: decoded.email, sessionId: decoded.sessionId }).select("-password");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        req.user = user;
        next();
    } catch (error) {
        console.error("Authentication error:", error);
        res.status(401).json({ success: false, message: "Unauthorized access." });
    }
};