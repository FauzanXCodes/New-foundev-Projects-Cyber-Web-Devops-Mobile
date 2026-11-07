import React, { useEffect, useState } from 'react';
import {
    X,
    Briefcase,
    IndianRupee
} from 'lucide-react';
import toast from 'react-hot-toast';
import useBids from '../../hooks/useBids';

const BidModal = ({ project, onClose }) => {
    const { registerBid } = useBids();

    const [formData, setFormData] = useState({
        projectId: '',
        proposalText: '',
        bidAmount: 0
    });
    useEffect(() => {
        if (project?._id) {
            setFormData((prev) => ({
                ...prev,
                projectId: project._id,
            }));
        }
    }, [project?._id]);

    const handleClose = () => {
        setFormData({
            projectId: '',
            proposalText: '',
            bidAmount: 0
        })
        onClose()
    }
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // if (!project._id) return toast.error("Something went wrong.", { duration: 2000, position: 'bottom-right' })
        if (!formData.projectId || !formData.proposalText || !formData.bidAmount) return toast.error("Please fill all required fields", { duration: 2000, position: 'bottom-right' })
        const response = await registerBid(formData, handleClose)
    };
    if (!project) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-6 transition-all">
            <div className="relative flex h-[92vh] w-full max-w-[520px] flex-col bg-white rounded-t-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-300 sm:h-auto sm:max-h-[85vh] sm:rounded-3xl">

                <div className="flex flex-col items-stretch bg-slate-50 shrink-0 sm:hidden">
                    <div className="flex h-6 w-full items-center justify-center">
                        <div className="h-1.5 w-12 rounded-full bg-slate-300"></div>
                    </div>
                </div>

                <div className="flex items-center bg-white px-6 py-4 justify-between border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Briefcase size={20} />
                        </div>
                        <h2 className="text-slate-900 text-lg font-bold tracking-tight">Register Bid</h2>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Proposal Text</label>
                        <input
                            name="proposalText"
                            value={formData.proposalText}
                            onChange={handleChange}
                            className="w-full rounded-xl border-slate-200 bg-slate-50/50 px-4 h-12 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="e.g. Design a high-converting landing page"
                            required
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Bid Amount</label>
                            <div className="relative group">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                                <input
                                    name="bidAmount"
                                    type="text"
                                    value={formData.bidAmount}
                                    onChange={handleChange}
                                    className="w-full pl-9 pr-4 h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    placeholder="500-700"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-white border-t border-slate-100 flex gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] h-12 rounded-2xl bg-blue-600 text-white font-bold shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
                        >
                            Bid Project
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BidModal;