import mongoose from 'mongoose';
const BidSchema = new mongoose.Schema(
    {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
        freelancerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Freelancer",
        },
        proposalText: { type: String, required: true },
        bidAmount: { type: Number, required: true },
        status: {
            type: String,
            enum: ['pending', 'hired', 'rejected'],
            default: 'pending'
        }
    },
    {
        timestamps: true,
    }
);


export const Bid = mongoose.model("Bid", BidSchema);