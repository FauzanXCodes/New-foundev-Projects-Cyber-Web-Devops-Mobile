import { createSlice } from '@reduxjs/toolkit';
const initialState = {
    projects_loading: false,
    projects: [],
    page: 1,
    hasMore: false,
    selectedProjectClient: null
};

const projectsSlice = createSlice({
    name: "projects",
    initialState,
    reducers: {
        setProjectsLoading(state, value) {
            state.projects_loading = value.payload;
        },
        setProjects(state, value) {
            state.projects = value.payload;
        },
        appendProjects(state, value) {
            state.projects.push(...value.payload);
        },
        resetProjects(state) {
            state.projects = [];
            state.page = 1;
            state.hasMore = true;
        },
        setPage(state, value) {
            state.page = value.payload;
        },
        setHasMore(state, value) {
            state.hasMore = value.payload;
        },
        setSelectedProjectClient(state, value) {
            state.selectedProjectClient = value.payload;
        }
    },
});

export const { setProjectsLoading, setProjects, appendProjects, resetProjects, setPage, setHasMore, setSelectedProjectClient } = projectsSlice.actions;

export default projectsSlice.reducer;