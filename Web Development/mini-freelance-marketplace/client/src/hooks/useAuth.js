import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { authApi, notificationsApi } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    setLoading,
    setUser,
    setError,
    setEmail,
    resetAuth,
    setLoginStatus
} from '../redux/slices/authSlice';
import { useCallback } from 'react';
import Cookies from 'js-cookie';
import { useRef } from 'react';

export const useAuth = () => {
    const dispatch = useDispatch();
    const { loading, is_logged_in, user, error, email, navigation } = useSelector((state) => state.auth);
    const navigate = useNavigate();
    const location = useLocation();
    const locationRef = useRef(location.pathname);
    useEffect(() => {
        locationRef.current = location.pathname;
    }, [location.pathname]);
    const setupUserSSE = useCallback(() => {
        let eventSource;
        let reconnectTimeout;
        if (!is_logged_in) {
            dispatch(setError("Authentication required for real-time updates."));
            return () => { };
        }
        const connect = () => {
            eventSource = new EventSource(`${import.meta.env.VITE_API_URL}/auth/getUser/${email}`, { withCredentials: true });
            eventSource.onopen = () => console.log('SSE connection opened.');

            eventSource.addEventListener('initial_user_data', (event) => {
                try {
                    dispatch(setLoading(true));
                    const parseddata = JSON.parse(event.data);
                    dispatch(setUser(parseddata));
                    dispatch(setLoading(false));
                    const currentPath = locationRef.current;
                    if (parseddata?.type == "Client") {
                        if (!currentPath.startsWith('/client')) {
                            navigate('/client');
                        }
                    } else if (parseddata?.type == "Freelancer") {
                        if (!currentPath.startsWith('/freelancer')) {
                            navigate('/freelancer');
                        }
                    } else if (currentPath.startsWith('/login') || currentPath.startsWith('/signup')) {
                        if (navigation) {
                            navigate(navigation);
                        } else {
                            navigate('/');
                        }
                    }
                } catch (e) {
                    console.error('Initial data parse error:', e);
                }
            });

            eventSource.addEventListener('user_update', (event) => {
                try {
                    dispatch(setUser(JSON.parse(event.data)));
                    dispatch(setLoading(false))
                } catch (e) {
                    console.error('Update parse error:', e);
                }
            });

            eventSource.addEventListener('restricted', () => {
                console.warn('Restricted event — closing SSE.');
                eventSource.close();
            });

            eventSource.addEventListener('keep-alive', () => {
                // console.log('Ping event — SSE.');
            });

            eventSource.onerror = () => {
                console.warn('SSE error — reconnecting in 5s...');
                eventSource.close();
                setTimeout(() => {
                    dispatch(setUser(null));
                }, 10000);
                reconnectTimeout = setTimeout(connect, 5000);
            };
        };

        connect();

        return () => {
            if (eventSource) eventSource.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, [is_logged_in, email, dispatch, navigate]);

    const signUp = async (data, navigate) => {
        try {
            dispatch(setLoading(true));
            const response = await authApi.signup(data);
            dispatch(setLoading(false));
            if (response.data.message == "User registered successfully") {
                toast.success('Check your mail box for otp', {
                    duration: 2000,
                    position: 'bottom-right',
                });
            }
            return response;
        } catch (error) {
            dispatch(setLoading(false));
            dispatch(setError(error.message));
            throw error;
        }
    };

    const verifyOtp = async (email, otp) => {
        try {
            dispatch(setLoading(true));
            const response = await authApi.verifyOtp(email, otp);
            dispatch(setLoading(false));
            return response;
        } catch (error) {
            dispatch(setLoading(false));
            dispatch(setError(error.message));
            throw error;
        }
    };

    const resendOtp = async (email, type) => {
        try {
            dispatch(setLoading(true));
            const response = await authApi.resendOtp(email, type);
            dispatch(setLoading(false));
            if (response.data.message == "otpsent") {
                toast.success('Otp Has Been Sent to Email', {
                    duration: 2000,
                    position: 'bottom-right',
                });
            }
            return response;
        } catch (error) {
            dispatch(setLoading(false));
            dispatch(setError(error.message));
            throw error;
        }
    };

    const handleLogout = async (navigate) => {
        try {
            localStorage.removeItem("email");
            localStorage.removeItem("is_logged_in");
            dispatch(resetAuth());
            navigate('/')
            await authApi.logout()
            toast.success('Logged Out Successfully', {
                duration: 2000,
                position: 'bottom-right',
            });

        } catch (error) {
            dispatch(setError(error.message));
            throw error;
        }
    }

    const login = async (data, navigate) => {
        try {
            dispatch(setLoading(true));
            const response = await authApi.login(data);
            dispatch(setLoading(false));
            if (response.data.message == "userlogin") {
                localStorage.setItem("email", response.data.UserSchema);
                localStorage.setItem("is_logged_in", true);
                dispatch(setEmail(response.data.UserSchema));
                dispatch(setLoginStatus(true));
                if (navigation) {
                    navigate(navigation)
                }
                else {
                    navigate('/')
                }
                toast.success('Login Successful', {
                    duration: 2000,
                    position: 'bottom-right',
                });
            }
            return response;
        } catch (error) {
            dispatch(setLoading(false));
            dispatch(setError(error.message));
            throw error;
        }
    };

    const sendForgotPassword = async (email) => {
        try {
            dispatch(setLoading(true));
            const response = await authApi.sendForgotPasswordOtp(email);
            dispatch(setLoading(false));
            return response;
        } catch (error) {
            dispatch(setLoading(false));
            dispatch(setError(error.message));
            throw error;
        }
    };

    const verifyForgotPasswordOtp = async (email, otp) => {
        try {
            dispatch(setLoading(true));
            const response = await authApi.verifyForgotPasswordOtp(email, otp);
            dispatch(setLoading(false));
            return response;
        } catch (error) {
            dispatch(setLoading(false));
            dispatch(setError(error.message));
            throw error;
        }
    };

    const resetPassword = async (data) => {
        try {
            dispatch(setLoading(true));
            const response = await authApi.resetPassword(data);
            dispatch(setLoading(false));
            return response;
        } catch (error) {
            dispatch(setLoading(false));
            dispatch(setError(error.message));
            throw error;
        }
    };

    const updateNotification = async (data) => {
        try {
            dispatch(setLoading(true));
            const response = await notificationsApi.markAsRead(data);
            if (response.data.message === "notification_updated") {
                toast.success('Notification marked as read', {
                    duration: 2000,
                    position: 'bottom-right',
                });
            }
            dispatch(setLoading(false));
            return response;
        } catch (error) {
            dispatch(setLoading(false));
            dispatch(setError(error.message));
            throw error;
        }
    };

    return {
        signUp,
        handleLogout,
        verifyOtp,
        resendOtp,
        login,
        sendForgotPassword,
        verifyForgotPasswordOtp,
        resetPassword,
        setupUserSSE,
        updateNotification
    };
};

export default useAuth; 