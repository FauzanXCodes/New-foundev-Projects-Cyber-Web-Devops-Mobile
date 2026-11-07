import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { Bid } from "../models/Bid.js";
import { respond } from "../utils/respond.js";
import { Freelancer } from "../models/Freelancer.js";
import { sendUserUpdater } from "../middlewares/ServerSentUpdates.js";

export const createBid = async (req, res) => {
    if (req?.user.type !== "Freelancer") {
        return respond(res, "Access denied.", 403, false);
    }
    try {
        const freelancerId = req?.user._id;
        const { projectId, proposalText, bidAmount } = req.body;

        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return respond(res, "Invalid or missing projectId.", 400, false);
        }

        if (!proposalText || typeof proposalText !== "string" || !proposalText.trim()) {
            return respond(res, "proposalText is required.", 400, false);
        }

        const amount = Number(bidAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return respond(res, "bidAmount must be a positive number.", 400, false);
        }
        const project = await Project.findById(projectId).select("status clientId");
        if (!project) {
            return respond(res, "Project not found.", 404, false);
        }
        if (project.status !== "open") {
            return respond(res, "Bidding is closed for this project.", 400, false);
        }
        const alreadyBid = await Bid.findOne({ projectId, freelancerId }).select("_id");
        if (alreadyBid) {
            return respond(res, "You have already placed a bid on this project.", 409, false);
        }
        const bid = await Bid.create({
            projectId,
            freelancerId,
            proposalText: proposalText.trim(),
            bidAmount: amount,
            status: "pending",
        });
        await Project.findByIdAndUpdate(project._id, {
            $push: { bids: bid._id },
        });
        await Freelancer.findByIdAndUpdate(req.user._id, {
            $push: { bids: bid._id },
        });
        return respond(res, "bid_registered", 200, true);
    } catch (err) {
        return respond(res, "Error Occured.", 400, false);
    }
}

export const fetchBids = async (req, res) => {
    const { gigId, searchType,
        page = 1,
        limit = 5
    } = req.query;
    if (!gigId) {
        return respond(res, "Invalid gigId.", 400, false);
    }
    if (req?.user.type !== "Client") {
        return respond(res, "Access denied.", 403, false);
    }
    const ownerCheck = await Project.findOne({ _id: gigId }).select("clientId");
    if (!ownerCheck) {
        return respond(res, "Invalid gigId.", 400, false);
    }
    if (!ownerCheck.clientId?.equals(req.user._id)) {
        return respond(res, "Only gig owner can fetch.", 400, false);
    }
    const matchStage = {};
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    try {
        if (!mongoose.Types.ObjectId.isValid(gigId)) {
            return respond(res, "Invalid gigId.", 400, false);
        }
        matchStage.projectId = new mongoose.Types.ObjectId(gigId);

        if (searchType) {
            matchStage.$or = [
                { "freelancer.username": { $regex: searchType, $options: "i" } },
                { "freelancer.email": { $regex: searchType, $options: "i" } }
            ];
        }

        const total = await Bid.countDocuments(matchStage);

        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: "freelancers",
                    localField: "freelancerId",
                    foreignField: "_id",
                    as: "freelancer"
                }
            },
            { $unwind: { path: "$freelancer", preserveNullAndEmptyArrays: true } },

            {
                $sort: {
                    createdAt: -1
                }
            },
            { $skip: (pageNum - 1) * limitNum },
            { $limit: limitNum },
            {
                $project: {
                    proposalText: 1,
                    bidAmount: 1,
                    status: 1,
                    createdAt: 1,
                    freelancer: {
                        _id: 1,
                        username: 1,
                        email: 1
                    }
                }
            }
        ];
        const bids = await Bid.aggregate(pipeline);
        const hasMore = pageNum * limitNum < total;
        res.json({
            message: "bids_received",
            page,
            limit,
            hasMore,
            bids,
        });
    } catch (error) {
        return respond(res, "Error Occured", 500, false);
    }
};

export const hireFreelancer = async (req, res) => {
    if (req?.user.type !== "Client") {
        return respond(res, "Access denied.", 403, false);
    }
    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        const { projectId, bidId } = req.params;
        if (!projectId || !bidId) {
            return respond(res, "Something went wrong", 400, false);
        }
        const project = await Project.findById(projectId).session(session);
        if (!project) {
            return respond(res, "Project Not Found.", 400, false);
        }
        if (project.clientId.toString() !== req.user._id.toString()) {
            return respond(res, "Unauthorized: Access denied.", 403, false);
        }
        if (project.status !== 'open') {
            throw new Error("This project is already assigned or closed.");
        }
        const hiredBid = await Bid.findOneAndUpdate(
            { _id: bidId, projectId: projectId },
            { status: 'hired' },
            { session, new: true }
        );
        if (!hiredBid) {
            throw new Error("Bid not found.");
        }
        project.status = 'assigned';
        await project.save({ session });

        await Bid.updateMany(
            {
                projectId: projectId,
                _id: { $ne: bidId },
                status: 'open'
            },
            { status: 'rejected' },
            { session }
        );
        const notificationMessage = `You were hired for ${project.title}`;
        const user = await Freelancer.findByIdAndUpdate(hiredBid.freelancerId, {
            $push: {
                portfolio: project._id,
                notifications: { message: notificationMessage, read: false }
            }
        }, { new: true, session });
        await sendUserUpdater(user.email);
        await session.commitTransaction();
        const io = req.app?.get('io');
        io.to(hiredBid.freelancerId.toString()).emit('notification', {
            type: 'HIRED',
            message: notificationMessage
        });
        return respond(res, "freelancer_hired", 200, true);

    } catch (error) {
        await session.abortTransaction();
        console.error("Transaction Aborted. Error:", error.message);
        return respond(res, "Failed to complete the hiring process.", 400, false);
    } finally {
        await session.endSession();
    }
};
