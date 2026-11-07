import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { setEmail } from '../../redux/slices/authSlice';
const RESEND_SECONDS = 20;

const VerifyOtp = ({ setShowOtpPopup, email }) => {
    const [otp, setOtp] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
    const canResend = secondsLeft === 0;
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { verifyOtp, resendOtp } = useAuth();
    const { loading, navigation } = useSelector((state) => state.auth);

    useEffect(() => {
        if (secondsLeft === 0) return;

        const id = setInterval(() => {
            setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
        }, 1000);

        return () => clearInterval(id);
    }, [secondsLeft]);

    const handleResentOtp = async (e) => {
        e.preventDefault();
        if (!canResend) return;

        let type = "verifysignup"
        await resendOtp(email, type);
        setSecondsLeft(RESEND_SECONDS);
    }

    const handleOtpVerification = async (e) => {
        e.preventDefault();
        const response = await verifyOtp(email, otp);
        if (response.data.message === "otpverified") {
            toast.success('Otp Verified Successfully', {
                duration: 2000,
                position: 'bottom-right',
            });
            localStorage.setItem("email", response.data.data);
            localStorage.setItem("is_logged_in", true);
            dispatch(setEmail(response.data.data));
            if (navigation) {
                navigate(navigation)
            } else {
                navigate('/')
            }
            setShowOtpPopup(false);
            setOtp('');
        }
    };

    const closeOtpPopup = () => {
        setShowOtpPopup(false);
        setOtp('');
    };
    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                    onClick={closeOtpPopup}
                ></div>

                <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300">

                    <div className="p-8">
                        <button
                            onClick={closeOtpPopup}
                            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="text-center space-y-4 mb-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl">
                                <ShieldCheck size={32} />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                                    Verify Your Email
                                </h2>
                                <p className="text-sm text-slate-500">
                                    We've sent a 6-digit code to your inbox.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleOtpVerification} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">
                                    Security Code
                                </label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all text-center text-2xl font-bold tracking-[0.5em] text-slate-900 placeholder:text-slate-300"
                                    placeholder="000000"
                                    maxLength={6}
                                    required
                                />
                            </div>

                            <div className="text-center">
                                <p className="text-sm text-slate-500">
                                    Didn't receive the code?{' '}
                                    <button
                                        onClick={handleResentOtp}
                                        disabled={!canResend}
                                        type="button"
                                        className={`font-bold transition-colors ${canResend
                                            ? "text-blue-600 hover:text-blue-700 hover:underline"
                                            : "text-slate-400 cursor-not-allowed"
                                            }`}
                                    >
                                        {canResend ? "Resend OTP" : `Resend in ${secondsLeft}s`}
                                    </button>
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin h-5 w-5" />
                                ) : (
                                    "Verify & Complete Registration"
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    )
}

export default VerifyOtp