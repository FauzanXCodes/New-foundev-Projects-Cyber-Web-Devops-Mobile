import React, { useState } from 'react';
import {
    X,
    Calendar,
    XCircle,
    Briefcase,
    IndianRupee
} from 'lucide-react';
import useGigs from '../../hooks/useGigs';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';

const CreateProjectModal = ({ isOpen, onClose }) => {
    const { createGig } = useGigs();
    const { projects_loading, projects, page, hasMore } = useSelector((state) => state.projects);

    const [skillInput, setSkillInput] = useState('');
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        budgetType: 'fixed',
        budgetRange: '',
        skillsRequired: ['Communication Skills'],
        contractAddress: '',
        deadline: ''
    });

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSkillKeyDown = (e) => {
        if (e.key === 'Enter' && skillInput.trim()) {
            e.preventDefault();
            if (!formData.skillsRequired.includes(skillInput.trim())) {
                setFormData(prev => ({
                    ...prev,
                    skillsRequired: [...prev.skillsRequired, skillInput.trim()]
                }));
            }
            setSkillInput('');
        }
    };

    const removeSkill = (skillToRemove) => {
        setFormData(prev => ({
            ...prev,
            skillsRequired: prev.skillsRequired.filter(s => s !== skillToRemove)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.description || !formData.budgetRange || !formData.contractAddress || !formData.deadline) return toast.error("Please fill all required fields", { duration: 2000, position: 'bottom-right' })
        await createGig(formData)
    };

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
                        <h2 className="text-slate-900 text-lg font-bold tracking-tight">Create New Project</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Project Title</label>
                        <input
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            className="w-full rounded-xl border-slate-200 bg-slate-50/50 px-4 h-12 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="e.g. Design a high-converting landing page"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full min-h-[120px] rounded-xl border-slate-200 bg-slate-50/50 p-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none resize-none"
                            placeholder="Describe requirements, goals, and deliverables..."
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Location</label>
                        <textarea
                            name="contractAddress"
                            value={formData.contractAddress}
                            onChange={handleChange}
                            className="w-full rounded-xl border-slate-200 bg-slate-50/50 px-4 h-12 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="Enter Project Location (eg.. Remote)"
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700 ml-1">Budget Type</label>
                        <div className="flex p-1.5 bg-slate-100 rounded-2xl">
                            {['fixed', 'hourly'].map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, budgetType: type }))}
                                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${formData.budgetType === type
                                        ? 'bg-white shadow-md text-blue-600'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {type === 'fixed' ? 'Fixed Price' : 'Hourly Rate'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Budget Range</label>
                            <div className="relative group">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                                <input
                                    name="budgetRange"
                                    type="text"
                                    value={formData.budgetRange}
                                    onChange={handleChange}
                                    className="w-full pl-9 pr-4 h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    placeholder="500-700"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Skills Required</label>
                        <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                            {formData.skillsRequired.map(skill => (
                                <div key={skill} className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100">
                                    {skill}
                                    <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red-500">
                                        <XCircle size={14} />
                                    </button>
                                </div>
                            ))}
                            <input
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-1 min-w-[100px]"
                                placeholder="Type and press Enter..."
                                value={skillInput}
                                onChange={(e) => setSkillInput(e.target.value)}
                                onKeyDown={handleSkillKeyDown}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 pb-4">
                        <label className="text-sm font-bold text-slate-700 ml-1">Project Deadline</label>
                        <div className="relative group">
                            <input
                                name="deadline"
                                type="date"
                                value={formData.deadline}
                                onChange={handleChange}
                                className="w-full rounded-xl border-slate-200 bg-slate-50/50 h-12 px-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none cursor-pointer"
                            />
                            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-500" size={18} />
                        </div>
                    </div>
                    <div className="p-6 bg-white border-t border-slate-100 flex gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={projects_loading}
                            className="flex-[2] h-12 rounded-2xl bg-blue-600 text-white font-bold shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
                        >
                            Post Project
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProjectModal;