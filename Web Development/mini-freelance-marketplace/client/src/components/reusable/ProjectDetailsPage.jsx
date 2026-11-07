import React, { useEffect, useState } from 'react';
import {
    ArrowLeft,
    Share2,
    Circle,
    Banknote,
    ChevronDown,
    Calendar,
    UploadCloud,
    Send
} from 'lucide-react';
import Header from './Header';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import useGigs from '../../hooks/useGigs';
import useBids from '../../hooks/useBids';
import BidModal from '../freelancer/BidModal';

const ProjectDetailsPage = () => {
    const { id } = useParams();
    const { fetchGigById } = useGigs()
    const { hire } = useBids();
    const dispatch = useDispatch();
    const { loading, is_logged_in, user, error, email, navigation } = useSelector((state) => state.auth);

    const { jobs_loading, jobs, page, hasMore, selectedProject } = useSelector((state) => state.jobs);
    const [bidPopup, setBidPopup] = useState('')
    useEffect(() => {
        const getData = setTimeout(() => {
            fetchGigById(id);
        }, 500)
        return () => clearTimeout(getData)
    }, [dispatch, id]);

    const handleHire = async (bidId) => {
        await hire(bidId, selectedProject._id)
    }

    return (
        <>
            <div className="bg-[#f6f7f8] font-sans text-[#0d141b] min-h-screen">
                <Header />
                {jobs_loading && (
                    <div className="py-4 text-center text-sm text-slate-500">
                        Loading more...
                    </div>
                )}
                {selectedProject && (
                    <>
                        <main className="mx-auto">
                            <section className="bg-white pt-6 px-4">
                                <h1 className="text-[#0d141b] tracking-tight text-2xl font-bold leading-tight pb-3">
                                    {selectedProject.title}
                                </h1>
                                <div className="flex gap-2 pb-5 flex-wrap">
                                    <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-emerald-100 px-3">
                                        <Circle size={8} className="fill-emerald-500 text-emerald-500" />
                                        <p className="text-emerald-700 text-xs font-semibold">{selectedProject.status}</p>
                                    </div>
                                    <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-slate-100 px-3">
                                        <p className="text-slate-600 text-xs font-medium">Posted {new Date(selectedProject.createdAt).toLocaleDateString('en-IN')}</p>
                                    </div>
                                    <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-slate-100 px-3">
                                        <p className="text-slate-600 text-xs font-medium">{selectedProject.contractAddress}</p>
                                    </div>
                                </div>
                            </section>

                            <div className="px-4 py-3">
                                <div className="p-5 flex flex-col items-stretch justify-start rounded-2xl shadow-sm bg-white border border-slate-200">
                                    <div className="flex w-full flex-col items-stretch justify-center gap-1">
                                        <p className="text-[#137fec] text-xs font-bold leading-normal uppercase tracking-widest">
                                            Estimated Budget
                                        </p>
                                        <div className="flex items-center justify-between mt-1">
                                            <div>
                                                <p className="text-[#0d141b] text-xl font-bold leading-tight tracking-tight">
                                                    {selectedProject.budgetType}
                                                </p>
                                                <p className="text-slate-500 text-base font-normal leading-normal">
                                                    {selectedProject.budgetRange}
                                                </p>
                                            </div>
                                            <div className="bg-blue-50 p-3 rounded-xl">
                                                <Banknote className="text-[#137fec]" size={32} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <section className="bg-white mt-2 p-5 sm:px-10 border-y border-slate-100">
                                <h3 className="text-[#0d141b] text-lg font-bold leading-tight tracking-tight pb-3">
                                    Job Description
                                </h3>
                                <div className="space-y-4">
                                    <p className="text-slate-600 text-sm leading-relaxed">
                                        {selectedProject.description}
                                    </p>
                                </div>
                            </section>

                            <section className="bg-white mt-2 p-5 sm:px-10 border-y border-slate-100">
                                <h3 className="text-[#0d141b] text-lg font-bold leading-tight tracking-tight pb-3">
                                    Required Skills
                                </h3>
                                <div className="flex gap-2 flex-wrap">
                                    {selectedProject.skillsRequired.map((skill) => (
                                        <div key={skill} className="flex h-9 items-center justify-center rounded-xl bg-blue-50 px-4 border border-blue-100">
                                            <p className="text-[#137fec] text-sm font-semibold">{skill}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="bg-white mt-2 p-5 border-y border-slate-100">
                                <h3 className="text-[#0d141b] text-lg font-bold leading-tight tracking-tight pb-3">
                                    Project Timeline
                                </h3>
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                                    <div className="flex size-12 items-center justify-center rounded-full bg-white text-[#137fec] shadow-sm">
                                        <Calendar size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Deadline: {(new Date(selectedProject.deadline).toLocaleDateString('en-IN', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        }))}</p>
                                    </div>
                                </div>
                            </section>

                        </main>
                        {/* {user && user?.type == "Client" && (
                            <div className="flex justify-center bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 mx-auto">
                                <button
                                    type='button' className="sm:w-1/2 w-full flex items-center justify-center gap-3 bg-[#137fec] text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98] transition-all"
                                >
                                    <span className="text-lg">Submit Proposal</span>
                                    <Send size={20} />
                                </button>
                            </div>
                        )} */}
                        {user?.type === "Client" &&
                            selectedProject?.bids?.map((bid) => (
                                <section className="bg-white mt-2 p-5 sm:px-10 border-y border-slate-100">
                                    <div key={bid._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6">
                                        <div className="flex flex-col md:flex-row gap-6">
                                            <div className="flex-1">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                                                    <div>
                                                        <h4 className="text-xl font-bold text-slate-900 hover:text-primary cursor-pointer transition-colors">{bid.freelancerId.username}</h4>
                                                    </div>
                                                    <div className="bg-slate-50  rounded-xl px-6 py-3 flex gap-8">
                                                        <div className="text-center">
                                                            <p className="text-primary text-xl font-bold">{bid.bidAmount}</p>
                                                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Bid Amount</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mb-6">
                                                    <p className="text-slate-600  leading-relaxed mb-3">
                                                        {bid.proposalText}
                                                    </p>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 ">
                                                    <div className="flex gap-2 overflow-auto">
                                                        {bid.freelancerId.additionalDetails.skills.map(tag => (
                                                            <span key={tag} className="px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button type='button' onClick={() => { handleHire(bid._id) }} className="px-8 py-2.5 bg-primary text-white font-bold rounded-lg text-sm shadow-md shadow-primary/20 hover:bg-blue-600 hover:scale-[1.02] active:scale-95 transition-all">Hire Now</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            ))}
                        {user?.type !== "Client" &&
                            selectedProject && (
                                <div className="flex justify-center bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 mx-auto">
                                    <button
                                        type='button' onClick={() => { setBidPopup(selectedProject) }} className="sm:w-1/2 w-full flex items-center justify-center gap-3 bg-[#137fec] text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-[0.98] transition-all"
                                    >
                                        <span className="text-lg">Submit Proposal</span>
                                        <Send size={20} />
                                    </button>
                                </div>
                            )}
                    </>
                )}
            </div>
            <BidModal project={bidPopup} onClose={() => setBidPopup("")} />
        </>
    );
};

export default ProjectDetailsPage;