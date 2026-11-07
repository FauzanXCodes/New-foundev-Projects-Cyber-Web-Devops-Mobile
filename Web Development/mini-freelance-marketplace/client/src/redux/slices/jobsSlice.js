import { createSlice } from '@reduxjs/toolkit';
const initialState = {
    jobs_loading: false,
    jobs: [],
    page: 1,
    hasMore: false,
    selectedProject: null
};

const jobsSlice = createSlice({
    name: "jobs",
    initialState,
    reducers: {
        setJobsLoading(state, value) {
            state.jobs_loading = value.payload;
        },
        setJobs(state, value) {
            state.jobs = value.payload;
        },
        appendJobs(state, value) {
            state.jobs.push(...value.payload);
        },
        resetJobs(state) {
            state.jobs = [];
            state.page = 1;
            state.hasMore = true;
        },
        setPage(state, value) {
            state.page = value.payload;
        },
        setHasMore(state, value) {
            state.hasMore = value.payload;
        },
        setSelectedProject(state, value) {
            state.selectedProject = value.payload;
        }
    },
});

export const { setJobsLoading, setJobs, appendJobs, resetJobs, setPage, setHasMore, setSelectedProject } = jobsSlice.actions;

export default jobsSlice.reducer;