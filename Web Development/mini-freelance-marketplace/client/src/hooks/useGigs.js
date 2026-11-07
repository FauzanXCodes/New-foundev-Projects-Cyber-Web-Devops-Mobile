import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { gigsApi } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';
import { setJobsLoading, setJobs, appendJobs, resetJobs, setPage, setHasMore, setSelectedProject } from '../redux/slices/jobsSlice';
import { setProjects } from '../redux/slices/projectsSlice';

export const useGigs = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { jobs_loading, jobs, page, hasMore } = useSelector((state) => state.jobs);
    const { loading, is_logged_in, user, error, email, navigation } = useSelector((state) => state.auth);

    const setupProjectsSSE = useCallback(() => {
        let eventSource;
        let reconnectTimeout;
        if (!is_logged_in) {
            return () => { };
        }
        const connect = () => {
            eventSource = new EventSource(`${import.meta.env.VITE_API_URL}/gigs/getClientProjects`, { withCredentials: true });

            eventSource.onopen = () => console.log('SSE connection opened.');

            eventSource.addEventListener('initial_data', (event) => {
                try {
                    dispatch(setProjects(JSON.parse(event.data)));
                } catch (e) {
                    console.error('Initial data parse error:', e);
                }
            });

            eventSource.addEventListener('projects_update', (event) => {
                try {
                    dispatch(setProjects(JSON.parse(event.data)));
                } catch (e) {
                    console.error('Update parse error:', e);
                }
            });

            eventSource.addEventListener('restricted', () => {
                console.warn('Restricted event — closing SSE.');
                eventSource.close();
            });

            eventSource.onerror = () => {
                console.warn('SSE error — reconnecting in 5s...');
                eventSource.close();
                reconnectTimeout = setTimeout(connect, 5000);
            };

            eventSource.addEventListener('keep-alive', () => {
                // console.log('Ping event — SSE.');
            });
        };

        connect();

        return () => {
            if (eventSource) eventSource.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, [is_logged_in, dispatch]);

    const fetchGigs = async (data) => {
        try {
            dispatch(setJobsLoading(true));
            const response = await gigsApi.getProjects(data);
            if (response.data.message === "projects_received") {
                dispatch(setHasMore(response.data.hasMore));
                if (Number(data.page) > 1) {
                    dispatch(appendJobs(response.data.projects));
                } else {
                    dispatch(setJobs(response.data.projects));
                }
            }
            dispatch(setJobsLoading(false));
            return response;
        } catch (error) {
            dispatch(setJobsLoading(false));
            throw error;
        }
    };

    const fetchGigById = async (data) => {
        try {
            dispatch(setJobsLoading(true));
            const response = await gigsApi.getProjectById(data);
            if (response.data.message === "project_found") {
                dispatch(setSelectedProject(response.data.data))
            }
            dispatch(setJobsLoading(false));
            return response;
        } catch (error) {
            dispatch(setJobsLoading(false));
            throw error;
        }
    };

    const createGig = async (data) => {
        try {
            dispatch(setJobsLoading(true));
            const response = await gigsApi.createGig(data);
            if (response.data.message === "project_posted") {
                toast.success("Project Added Successfully", { duration: 2000, position: 'bottom-right' })
            }
            dispatch(setJobsLoading(false));
            return response;
        } catch (error) {
            dispatch(setJobsLoading(false));
            throw error;
        }
    };

    return {
        setupProjectsSSE,
        fetchGigs,
        fetchGigById,
        createGig
    };
};

export default useGigs; 