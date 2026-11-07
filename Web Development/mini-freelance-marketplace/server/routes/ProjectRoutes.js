import express from "express";
import { rateLimit } from 'express-rate-limit'
import { authenticateUser } from "../middlewares/AuthMiddleware.js";
import { createProject, fetchAllProjects,  getProjectById } from "../controllers/ProjectController.js";
import { getProjectsClient } from "../middlewares/ServerSentUpdates.js";
const router = express.Router();
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
})
const fetchlimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
})

router.post("/", limiter, authenticateUser, createProject);

router.get("/getClientProjects", limiter, authenticateUser, getProjectsClient);

router.get("/", fetchlimiter, fetchAllProjects);

router.get("/:id", limiter, authenticateUser, getProjectById);

export default router;