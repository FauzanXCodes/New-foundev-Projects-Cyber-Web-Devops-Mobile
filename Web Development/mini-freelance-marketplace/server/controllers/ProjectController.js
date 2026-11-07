import mongoose from "mongoose";
import { sendProjectsClientUpdater } from "../middlewares/ServerSentUpdates.js";
import { Client } from "../models/Client.js";
import { Project } from "../models/Project.js";
import { respond } from "../utils/respond.js";
import { Bid } from "../models/Bid.js";

export const createProject = async (req, res) => {
    try {
        if (req?.user.type !== "Client") {
            return respond(res, "Access denied.", 403, false);
        }

        const {
            title,
            description,
            budgetType,
            budgetRange,
            skillsRequired,
            contractAddress,
            deadline
        } = req.body;

        if (!title || !description) {
            return respond(res, "Title and description are required.", 400, false);
        }
        if (!budgetType || !budgetRange || !skillsRequired || !contractAddress || !deadline) {
            return respond(res, "Fill All Fields.", 400, false);
        }

        const [year, month, day] = deadline.split('-');
        const formattedDeadline = new Date(`${year}-${month}-${day}`);
        const newProject = new Project({
            title,
            description,
            clientId: req.user._id,
            budgetType,
            budgetRange,
            skillsRequired,
            contractAddress,
            deadline: formattedDeadline,
            status: 'open'
        });

        await newProject.save();

        await Client.findByIdAndUpdate(req.user._id, {
            $push: { projects: newProject._id },
        });

        await sendProjectsClientUpdater(req.user._id)

        return res.status(201).json({
            success: true,
            message: "project_posted",
            project: newProject
        });

    } catch (error) {
        return respond(res, "Error Occured", 500, false);
    }
};

export const getClientProjects = async (clientId, verified = false) => {
    try {
        const projects = verified ? await Project.find({ clientId }).sort({ createdAt: -1 }) : null;
        if (!projects) {
            throw new Error("Projects not found");
        } else {
            return projects;
        }
    } catch (error) {
        console.log(error)
    }
};

export const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return respond(res, "Project Not Found", 400, false);
        }
        let populateOptions = [
            { path: "clientId" },
        ];
        if (req.user.type === "Client") {
            populateOptions.push({
                path: "bids",
                populate: { path: "freelancerId", select: "username email additionalDetails" }
            });
        }
        const project = await Project.findOne({ _id: id }).populate(populateOptions);
        if (!project) {
            return respond(res, "Project Not Found", 400, false);
        }
        return respond(res, "project_found", 200, true, project);

    } catch (error) {
        return respond(res, "Error Occured", 500, false);
    }
};

export const fetchAllProjects = async (req, res) => {
    const { searchType,
        jobType,
        status,
        skills,
        budgetRange,
        deadlineBefore,
        page = 1,
        limit = 5
    } = req.query;
    const matchStage = {};
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    try {
        if (searchType) {
            matchStage.$or = [
                { title: { $regex: searchType, $options: "i" } },
                { description: { $regex: searchType, $options: "i" } },
                { budgetType: { $regex: searchType, $options: "i" } },
                { status: { $regex: searchType, $options: "i" } }
            ];
        }
        if (jobType) {
            matchStage.budgetType = jobType;
        }
        if (jobType) {
            matchStage.budgetRange = budgetRange;
        }
        if (status) {
            matchStage.status = status;
        }
        if (skills && skills.length > 0) {
            matchStage.skillsRequired = { $in: skills };
        }
        if (deadlineBefore) {
            matchStage.deadline = { $lte: new Date(deadlineBefore) };
        }
        const total = await Project.countDocuments(matchStage);

        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: "clients",
                    localField: "clientId",
                    foreignField: "_id",
                    as: "client"
                }
            },
            { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },

            {
                $sort: {
                    createdAt: -1
                }
            },
            { $skip: (pageNum - 1) * limitNum },
            { $limit: limitNum },
            {
                $project: {
                    title: 1,
                    description: 1,
                    budgetType: 1,
                    budgetRange: 1,
                    skillsRequired: 1,
                    contractAddress: 1,
                    status: 1,
                    deadline: 1,
                    createdAt: 1,
                    client: {
                        _id: 1,
                        username: 1,
                        email: 1
                    }
                }
            }
        ];
        const projects = await Project.aggregate(pipeline);
        const hasMore = pageNum * limitNum < total;
        res.json({
            message: "projects_received",
            page,
            limit,
            hasMore,
            projects,
        });
    } catch (error) {
        return respond(res, "Error Occured", 500, false);
    }
};