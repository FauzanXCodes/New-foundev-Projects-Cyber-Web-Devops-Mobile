import React, { useState } from 'react';
import {
    User,
    Mail,
    Phone,
    Lock,
    Eye,
    EyeOff,
    ChevronDown,
    Briefcase,
    Users,
    AtSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import VerifyOtp from '../../components/reusable/VerifyOtp';
import Header from '../../components/reusable/Header';

const SignUp = () => {
    const navigate = useNavigate()
    const { signUp } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const { loading } = useSelector((state) => state.auth)

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        phoneNumber: '',
        password: '',
        gender: '',
        usertype: 'client'
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };
    const [showOtpPopup, setShowOtpPopup] = useState(false);

    const handleSignup = async (e) => {
        e.preventDefault();
        if (formData.password < 8) {
            toast.error("Minimum password length is 8", { duration: 2000, position: 'bottom-right' })
            return;
        }
        const response = await signUp(formData, navigate);
        if (response.data.message == "user_registered") {
            setShowOtpPopup(true);
        }
    };
    return (
        <>
            <Header />
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-200">

                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <h1 className="text-xl font-bold text-slate-800">Register New Account</h1>
                        <div className="w-10"></div>
                    </div>

                    <div className="p-8 md:p-12">
                        <form className="space-y-6" onSubmit={handleSignup}>

                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-500">Join as a</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, usertype: "client" }))}
                                        className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${formData.usertype === 'client'
                                            ? 'border-blue-500 bg-blue-50/50 ring-4 ring-blue-500/10'
                                            : 'border-slate-100 bg-white hover:border-slate-200'
                                            }`}
                                    >
                                        <Briefcase
                                            className={`mb-2 transition-colors ${formData.usertype === 'client' ? 'text-blue-500' : 'text-slate-400'}`}
                                            size={24}
                                        />
                                        <span className={`font-bold transition-colors ${formData.usertype === 'client' ? 'text-blue-600' : 'text-slate-500'}`}>
                                            Client
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, usertype: "freelancer" }))}
                                        className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${formData.usertype === 'freelancer'
                                            ? 'border-blue-500 bg-blue-50/50 ring-4 ring-blue-500/10'
                                            : 'border-slate-100 bg-white hover:border-slate-200'
                                            }`}
                                    >
                                        <User
                                            className={`mb-2 transition-colors ${formData.usertype === 'freelancer' ? 'text-blue-500' : 'text-slate-400'}`}
                                            size={24}
                                        />
                                        <span className={`font-bold transition-colors ${formData.usertype === 'freelancer' ? 'text-blue-600' : 'text-slate-500'}`}>
                                            Freelancer
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700" htmlFor="username">Username</label>
                                    <div className="relative group">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                            <AtSign size={18} />
                                        </span>
                                        <input
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all"
                                            id="username"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleInputChange}
                                            placeholder="Username"
                                            type="text"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700" htmlFor="email">Email Address</label>
                                    <div className="relative group">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                            <Mail size={18} />
                                        </span>
                                        <input
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            placeholder="name@company.com"
                                            type="email"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700" htmlFor="phone">Phone Number</label>
                                    <div className="relative group">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                            <Phone size={18} />
                                        </span>
                                        <input
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all"
                                            id="phone"
                                            name="phoneNumber"
                                            value={formData.phoneNumber}
                                            onChange={handleInputChange}
                                            placeholder="+91 000 000 0000"
                                            type="tel"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700" htmlFor="gender">Gender</label>
                                    <div className="relative group">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                            <Users size={18} />
                                        </span>
                                        <select
                                            className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                                            id="gender"
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                        <Lock size={18} />
                                    </span>
                                    <input
                                        className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all"
                                        id="password"
                                        name='password'
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        placeholder="••••••••"
                                        type={showPassword ? "text" : "password"}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>


                            <button
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98]"
                                type="submit" disabled={loading}
                            >
                                Create Account
                            </button>

                            <p className="text-center text-slate-600 text-sm">
                                Already have an account?
                                <button type="button" onClick={() => { navigate('/login') }} className="text-blue-600 hover:underline font-bold ml-1">Log In</button>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
            {showOtpPopup && (
                <VerifyOtp setShowOtpPopup={setShowOtpPopup} email={formData.email} />
            )}
        </>
    );
};

export default SignUp;