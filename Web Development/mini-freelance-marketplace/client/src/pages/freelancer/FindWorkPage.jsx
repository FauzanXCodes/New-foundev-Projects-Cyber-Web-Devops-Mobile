import React, { useEffect, useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import Header from '../../components/reusable/Header';
import { useDispatch, useSelector } from 'react-redux';
import { setHasMore, setJobs, setPage } from '../../redux/slices/jobsSlice';
import JobCard from '../../components/reusable/JobCard';
import useGigs from '../../hooks/useGigs';
import CreateProjectModal from '../../components/client/CreateProjectModal';

const FindWorkPage = () => {
  const dispatch = useDispatch()
  const { fetchGigs } = useGigs()
  const [searchQuery, setSearchQuery] = useState('');
  const { jobs_loading, jobs, page, hasMore } = useSelector((state) => state.jobs);
  const sentinelRef = React.useRef(null);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first.isIntersecting) return;
        if (!hasMore || jobs_loading) return;

        const nextPage = page + 1;

        dispatch(setPage(nextPage));
        fetchGigs({ searchType: searchQuery, page: nextPage })
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [page, hasMore]);

  useEffect(() => {
    const getData = setTimeout(() => {
      dispatch(setPage(1))
      dispatch(setJobs([]))
      dispatch(setHasMore(true))
      fetchGigs({ page, searchType: searchQuery });

      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 1000)
    return () => clearTimeout(getData)
  }, [searchQuery]);
  return (
    <div className="bg-slate-50 font-sans text-[#0d141b] min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 w-full mx-auto pb-24">
        <div className="px-4 py-3 bg-white">
          <div className="flex h-12 w-full max-w-lg flex-1 items-stretch rounded-xl shadow-sm bg-[#f0f2f5]">
            <div className="text-[#4c739a] flex items-center justify-center pl-4">
              <Search size={20} />
            </div>
            <input
              className="flex w-full min-w-0 flex-1 rounded-r-xl text-[#0d141b] focus:outline-none border-none bg-transparent h-full placeholder:text-[#4c739a] px-4 pl-2 text-base font-normal"
              placeholder="Search for projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pt-6 pb-2">
          <h3 className="text-[#0d141b] text-lg font-bold leading-tight tracking-tight">Recent Projects</h3>
        </div>

        <div className="space-y-3 p-4">
          {jobs.map((job) => (
            <JobCard key={job._id} job={job} bid={false} />
          ))}

          {jobs.lenght === 0 && (
            <div className="py-4 text-center text-sm text-slate-500">
              No Projects Found...
            </div>
          )}

          {jobs_loading && (
            <div className="py-4 text-center text-sm text-slate-500">
              Loading more...
            </div>
          )}

          <div ref={sentinelRef} className="h-6" />
        </div>
      </main>

    </div>
  );
};


export default FindWorkPage;