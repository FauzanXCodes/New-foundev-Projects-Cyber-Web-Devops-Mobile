import axios from 'axios';
import toast from 'react-hot-toast';
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.data.message) {
            toast.error(error.response.data.message, {
                duration: 3000,
                position: 'bottom-right',
                icon: '⚠️',
            })
        }
        return Promise.reject(error);
    }
);

// AUTH ENDPOINTS
export const authApi = {
    login: (data) => api.post('/auth/login', data),
    logout: () => api.post('/auth/logout'),
    signup: (data) => api.post('/auth/signup', data),
    verifyOtp: (email, otp) => api.post('/auth/verifyOtp', { email, otp }),
    resendOtp: (email, type) => api.post('/auth/resendOtp', { email, type }),
    sendForgotPasswordOtp: (email) => api.post('/auth/sendForgotPasswordOtp', { email }),
    verifyForgotPasswordOtp: (email, otp) => api.post('/auth/verifyForgotPasswordOtp', { email, otp }),
    resetPassword: (data) => api.post('/auth/resetPassword', data),
}

export const gigsApi = {
    getProjects: (params) => api.get('/gigs', { params }),
    createGig: (data) => api.post('/gigs', data),
    getProjectById: (id) => api.get(`/gigs/${id}`),
}

export const notificationsApi = {
    markAsRead: (data) => api.post('/auth/markNotification', data),
}

export const bidsApi = {
    createBid: (data) => api.post('/bids', data),
    hire: (bidId, projectId) => api.patch(`/bids/${bidId}/${projectId}/hire`),
    getBids: (params) => api.get('/bids', { params }),
}

export default api; 