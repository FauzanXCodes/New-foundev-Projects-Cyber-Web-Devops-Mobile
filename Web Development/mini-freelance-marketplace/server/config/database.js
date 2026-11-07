import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const connect = async () => {
    try {
        await mongoose.connect(process.env.MONGODBURL);
        console.log("✅ Successfully connected to the database.");
    } catch (error) {
        console.error("❌ Database connection failed!", error);
        process.exit(1);
    }
};