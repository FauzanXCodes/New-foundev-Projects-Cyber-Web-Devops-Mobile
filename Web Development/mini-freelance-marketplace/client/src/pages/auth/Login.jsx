import React, { useState } from 'react';
import {
    Briefcase,
    Mail,
    Lock,
    Eye,
    EyeOff,
    AtSign,
    ShieldCheck,
    KeyRound,
    X,
    Loader2,
    LockIcon,
    ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VerifyOtp from '../../components/reusable/VerifyOtp';
import { useDispatch, useSelector } from 'react-redux';
import useAuth from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import Header from '../../components/reusable/Header';

const Login = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch();

    const { loading } = useSelector((state) => state.auth)
    const { login, resendOtp, sendForgotPassword, verifyForgotPasswordOtp, resetPassword } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showOtpPopup, setShowOtpPopup] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotPasswordStep, setForgotPasswordStep] = useState(1);
    const [forgotEmail, setForgotEmail] = useState('');
    const [token, setForgotUniqueid] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };
    const handleLogin = async (e) => {
        e.preventDefault();
        if (!formData.email || !formData.password) {
            toast.error('Please enter both email and password.', {
                duration: 2000,
                position: 'bottom-right',
            });
            return;
        }
        const response = await login(formData, navigate);
        if (response.data.message === "verificationrequired") {
            setShowOtpPopup(true);
        }
    };
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        if (forgotPasswordStep === 1) {
            const response = await sendForgotPassword(forgotEmail);
            if (response.data.message === "otpsent") {
                toast.success("Otp Has been sent to your mail.", { duration: 3000, position: 'bottom-right' });
                setForgotPasswordStep(2);
            } else if (response.data.message === "verificationrequired") {
                await resendOtp(forgotEmail, "verifysignup")
                setShowOtpPopup(true);
            }
        } else if (forgotPasswordStep === 2) {
            const response = await verifyForgotPasswordOtp(forgotEmail, otp);
            if (response.data.message === "otpverified") {
                setForgotUniqueid(response.data.uniqueid);
                toast.success("Otp Has been verified.", { duration: 2000, position: 'bottom-right' });
                setForgotPasswordStep(3);
            }
        } else {
            if (newPassword < 8) {
                toast.error("Minimum password length is 8", { duration: 2000, position: 'bottom-right' })
                return;
            }
            if (newPassword !== confirmPassword) {
                toast.error("Both Passwords should match.", { duration: 2000, position: 'bottom-right' })
                return;
            }
            const response = await resetPassword({ forgotEmail, token, newPassword, confirmPassword });
            if (response.data.message === "passwordchanged") {
                toast.success("Password Changed", { duration: 2000, position: 'bottom-right' })
                setShowForgotPassword(false);
                setForgotPasswordStep(1);
                setForgotEmail('');
                setOtp('');
                setNewPassword('');
                setConfirmPassword('');
            }
        }
    };

    const handleResentOtp = async (e) => {
        e.preventDefault();
        let type = "forgotpassword"
        await resendOtp(forgotEmail, type);
    }

    const closeForgotPassword = () => {
        setShowForgotPassword(false);
        setForgotPasswordStep(1);
        setForgotEmail('');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
    };
    return (
        <>
            <Header />
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
                <div className="hidden lg:block absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="hidden lg:block absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="w-full max-w-[480px] space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

                    <div className="text-center space-y-6">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500 rounded-3xl shadow-xl shadow-blue-500/20 text-white">
                            <Briefcase size={36} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                                Welcome Back
                            </h1>
                            <p className="text-slate-500">
                                Enter your details to login
                            </p>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-200">
                        <form className="space-y-5" onSubmit={handleLogin}>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1" htmlFor="email">
                                    Email Address
                                </label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                        <AtSign size={18} />
                                    </span>
                                    <input
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:bg-white rounded-xl text-slate-900 placeholder:text-slate-400 transition-all outline-none"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="Enter email address"
                                        type="email"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                                        Password
                                    </label>
                                    <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs font-semibold text-blue-600 hover:underline">
                                        Forgot Password?
                                    </button>
                                </div>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                        <Lock size={18} />
                                    </span>
                                    <input
                                        className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:bg-white rounded-xl text-slate-900 placeholder:text-slate-400 transition-all outline-none"
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        placeholder="••••••••"
                                        type={showPassword ? "text" : "password"}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5 active:scale-[0.98]">
                                Login
                            </button>

                        </form>
                    </div>

                    <p className="text-center text-slate-500 text-sm">
                        Don't have an account?
                        <button type="button" onClick={() => { navigate('/signup') }} className="text-blue-600 font-bold hover:underline ml-1">
                            Sign Up
                        </button>
                    </p>
                </div>
            </div>
            {showForgotPassword && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
                        onClick={closeForgotPassword}
                    ></div>

                    <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300">

                        <div className="flex h-1.5 w-full bg-slate-100">
                            <div className={`transition-all duration-500 bg-blue-500 h-full ${forgotPasswordStep === 1 ? 'w-1/3' : forgotPasswordStep === 2 ? 'w-2/3' : 'w-full'
                                }`}></div>
                        </div>

                        <div className="p-8">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex flex-col gap-1">
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                                        {forgotPasswordStep === 1 && 'Reset Password'}
                                        {forgotPasswordStep === 2 && 'Verify OTP'}
                                        {forgotPasswordStep === 3 && 'New Password'}
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        {forgotPasswordStep === 1 && 'Enter email to receive a code'}
                                        {forgotPasswordStep === 2 && 'Check your inbox for the code'}
                                        {forgotPasswordStep === 3 && 'Create a strong new password'}
                                    </p>
                                </div>
                                <button
                                    onClick={closeForgotPassword}
                                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {loading ? (
                                <div className="flex flex-col justify-center items-center h-48 space-y-4">
                                    <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
                                    <p className="text-sm text-slate-500 font-medium">Processing request...</p>
                                </div>
                            ) : (
                                <form onSubmit={handleForgotPassword} className="space-y-5">

                                    {forgotPasswordStep === 1 && (
                                        <div className="space-y-2">
                                            <div className="flex justify-center mb-4">
                                                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                                                    <KeyRound size={32} />
                                                </div>
                                            </div>
                                            <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                                            <input
                                                type="email"
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                                placeholder="name@example.com"
                                                required
                                            />
                                        </div>
                                    )}

                                    {forgotPasswordStep === 2 && (
                                        <div className="space-y-4">
                                            <div className="flex justify-center mb-4">
                                                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                                                    <ShieldCheck size={32} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-700 ml-1">Security Code</label>
                                                <input
                                                    type="text"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value)}
                                                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-center text-2xl font-bold tracking-[0.5em] text-slate-900"
                                                    placeholder="000000"
                                                    maxLength={6}
                                                    required
                                                />
                                            </div>
                                            <p className="text-sm text-slate-500 text-center">
                                                Didn't receive the code?{' '}
                                                <button onClick={handleResentOtp} type="button" className="text-blue-600 hover:text-blue-700 font-bold hover:underline">
                                                    Resend OTP
                                                </button>
                                            </p>
                                        </div>
                                    )}

                                    {forgotPasswordStep === 3 && (
                                        <div className="space-y-4">
                                            <div className="flex justify-center mb-4">
                                                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                                                    <LockIcon size={32} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-700 ml-1">New Password</label>
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                                    placeholder="••••••••"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-700 ml-1">Confirm Password</label>
                                                <input
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                                    placeholder="••••••••"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98] mt-2"
                                    >
                                        {forgotPasswordStep === 1 && 'Send Verification Code'}
                                        {forgotPasswordStep === 2 && 'Verify Code'}
                                        {forgotPasswordStep === 3 && 'Update Password'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>

            )}

            {
                showOtpPopup && (
                    <VerifyOtp setShowOtpPopup={setShowOtpPopup} email={formData.email || forgotEmail} />
                )
            }
        </>
    );
};

export default Login;