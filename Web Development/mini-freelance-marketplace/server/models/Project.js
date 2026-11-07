import mongoose from 'mongoose';
const ProjectSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true },
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true
        },
        budgetType: { type: String, enum: ['fixed', 'hourly'], default: 'fixed', required: true },
        budgetRange: {
            type: String,
            required: true
        },
        skillsRequired: [String],
        status: {
            type: String,
            enum: ['open', 'assigned', 'rejected'],
            default: 'open'
        },
        contractAddress: { type: String, required: true },
        deadline: Date,
        bids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Bid",
            }
        ]
    },
    {
        timestamps: true,
    }
);

export const Project = mongoose.model("Project", ProjectSchema);