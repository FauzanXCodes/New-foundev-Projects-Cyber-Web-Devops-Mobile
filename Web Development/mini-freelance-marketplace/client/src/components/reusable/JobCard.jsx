import { MapPin, ExternalLink } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

const JobCard = ({ job, bid }) => {
    const navigate = useNavigate();
    return (
        <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 p-5 transition-all hover:shadow-md active:scale-[0.99] cursor-pointer group">
            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                    <h4 className="text-slate-900 text-lg font-bold leading-tight group-hover:text-blue-600 transition-colors">
                        {job.title}
                    </h4>
                </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
                <p className="text-blue-600 font-bold text-base">
                    {job.budgetRange}
                </p>
                <div className="flex items-center text-slate-400 text-sm">
                    <span className="w-1 h-1 bg-slate-300 rounded-full mr-2"></span>
                    Posted {new Date(job.createdAt).toLocaleDateString('en-IN')}
                </div>
            </div>

            <p className="text-slate-600 text-sm font-normal leading-relaxed line-clamp-2 mb-5">
                {job.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-5">
                {job.skillsRequired.map((skill) => (
                    <span
                        key={skill}
                        className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold border border-blue-100/50"
                    >
                        {skill}
                    </span>
                ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5 max-w-[60%]">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    <span className="text-slate-500 text-xs truncate font-mono bg-slate-50 px-2 py-1 rounded">
                        {job.contractAddress}
                    </span>
                </div>
                {!bid && (
                    <button
                        type='button'
                        onClick={() => { navigate(`/freelancer/project/${job._id}`) }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-10 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/10 flex items-center gap-2"
                    >
                        View Details
                        <ExternalLink size={14} />
                    </button>
                )}
                 {bid && (
                    <button
                        type='button'
                        onClick={() => { navigate(`/client/project/${job._id}`) }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-10 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/10 flex items-center gap-2"
                    >
                        View Bids
                        <ExternalLink size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default JobCard;