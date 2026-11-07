import express from 'express';
import cors from 'cors';
import http from 'http';
import cookieParser from "cookie-parser";
import { connect } from './config/database.js';
import userRoutes from './routes/AuthRoutes.js';
import projectRoutes from './routes/ProjectRoutes.js';
import bidRoutes from './routes/BidRoutes.js';
import dotenv from "dotenv"
import { Server } from 'socket.io';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
dotenv.config()

const app = express();
const server = http.createServer(app);
const port = process.env.port || 5000;
const io = new Server(server, {
    cors: {
        origin: process.env.origin,
        credentials: true,
    },
});

app.set('io', io);
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} has been connected to socket`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});
connect();
app.use(express.json());
app.use(cookieParser());

app.use(helmet());

const corsoptions = {
    origin: process.env.origin,
    methods: "GET, POST, PUT, DELETE, HEAD, PATCH",
    credentials: true,
}
app.use(cors(corsoptions));
app.set('trust proxy', 'loopback')

app.use("/api/v1/auth", userRoutes);
app.use("/api/v1/gigs", projectRoutes);
app.use("/api/v1/bids", bidRoutes);
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
})
app.get('/', limiter, (req, res) => {
    return res.json({
        success: true,
        message: "Your server is up and running",
    });
});


server.listen(port, () => console.log(`Server running on port ${port}`));