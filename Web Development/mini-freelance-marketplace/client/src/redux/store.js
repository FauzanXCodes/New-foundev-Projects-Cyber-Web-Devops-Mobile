import { configureStore } from "@reduxjs/toolkit"
import authReducer from './slices/authSlice';
import jobReducer from './slices/jobsSlice';
import projectReducer from './slices/projectsSlice'
import bidReducer from './slices/bidsSlice'

const store = configureStore({
  reducer: {
    auth: authReducer,
    jobs: jobReducer,
    projects: projectReducer,
    bids: bidReducer
  },
})

export default store;
