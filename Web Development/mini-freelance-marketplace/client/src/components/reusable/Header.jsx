import React, { useEffect, useRef, useState } from "react";
import { Bell, Briefcase, CheckCheck, Menu, Trash2, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { useSelector } from "react-redux";

const Header = () => {
    const { updateNotification } = useAuth()
    const [open, setOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();
    const { handleLogout } = useAuth()
    const { loading, is_logged_in, user, error, email, navigation } = useSelector((state) => state.auth);
    const signOut = async () => {
        setOpen(false);
        await handleLogout(navigate)
    };

    useEffect(() => {
        const onDown = (e) => {
            if (!open) return;
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const handleMarkAsRead = async (notificationId) => {
        const userId = user._id;
        await updateNotification({ notificationId, userId });
    }

    const NavLinks = ({ mobile = false }) => (
        <nav className={mobile ? "flex flex-col gap-1" : "hidden md:flex items-center gap-2"}>
            {is_logged_in && user?.type == "Client" && (
                <Link
                    to="/client/projects"
                    className={`px-3 py-2 rounded-lg text-sm font-medium text-white/90 hover:text-white hover:bg-slate-800 ${mobile ? "w-full" : ""
                        }`}
                    onClick={() => setOpen(false)}
                >
                    Projects
                </Link>
            )}
            {user?.type === "Freelancer" && (
                <Link
                    to="/freelancer/find-work"
                    className={`px-3 py-2 rounded-lg text-sm font-medium text-white/90 hover:text-white hover:bg-slate-800 ${mobile ? "w-full" : ""
                        }`}
                    onClick={() => setOpen(false)}
                >
                    Find Projects
                </Link>
            )}

            {is_logged_in && user && (
                <Link
                    to={
                        user?.type === "Client"
                            ? "/client/profile"
                            : user?.type === "Freelancer"
                                ? "/freelancer/profile"
                                : "/profile"
                    }
                    className={`px-3 py-2 rounded-lg text-sm font-medium text-white/90 hover:text-white hover:bg-slate-800 ${mobile ? "w-full" : ""
                        }`}
                    onClick={() => setOpen(false)}
                >
                    Profile
                </Link>
            )}

            {is_logged_in ? (
                <button
                    type="button"
                    onClick={signOut}
                    className={`px-3 py-2 rounded-lg text-sm font-medium text-white/90 hover:text-white hover:bg-slate-800 text-left ${mobile ? "w-full" : ""
                        }`}
                >
                    Logout
                </button>
            ) : (
                <>
                    <Link
                        to="/login"
                        className={`px-3 py-2 rounded-lg text-sm font-medium text-white/90 hover:text-white hover:bg-slate-800 ${mobile ? "w-full" : ""
                            }`}
                        onClick={() => setOpen(false)}
                    >
                        Login
                    </Link>

                    <Link
                        to="/signup"
                        className={`px-3 py-2 rounded-lg text-sm font-medium text-white hover:bg-blue-600 bg-blue-500 ${mobile ? "w-full text-center" : ""
                            }`}
                        onClick={() => setOpen(false)}
                    >
                        Sign Up
                    </Link>
                </>
            )}
        </nav>
    );

    return (
        <header className="sticky top-0 z-50 bg-[#1a2632] border-b border-slate-800">
            <div className="flex items-center p-4 justify-between mx-auto">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#137fec]/10 border-2 border-[#137fec]/20 flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-[#137fec]" />
                    </div>
                    <h2 className="text-white text-lg font-bold leading-tight tracking-tight">
                        GigFlow
                    </h2>
                </div>

                <div className="ml-auto">
                    <NavLinks />
                </div>

                <div className="flex items-center gap-1 relative" ref={menuRef}>
                    {is_logged_in && (
                        <button
                            type="button"
                            onClick={() => {
                                setShowNotifications((s) => !s);
                                setOpen(false);
                            }}
                            className="relative flex items-center justify-center rounded-full w-10 h-10 text-white hover:bg-slate-800"
                            aria-label="Notifications"
                        >
                            <Bell size={20} />
                            {user?.notifications && user.notifications.length > 0 && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                        </button>
                    )}

                    <button
                        type="button"
                        className="md:hidden flex items-center justify-center rounded-full w-10 h-10 text-white hover:bg-slate-800"
                        onClick={() => setOpen((s) => !s)}
                        aria-expanded={open}
                        aria-label="Open menu"
                    >
                        {open ? <X size={20} /> : <Menu size={20} />}
                    </button>

                    {open && (
                        <div className="md:hidden absolute right-0 top-12 w-56 rounded-xl border border-slate-700 bg-[#13202b] shadow-xl overflow-hidden">
                            <div className="p-2">
                                <NavLinks mobile />
                            </div>
                        </div>
                    )}
                    {showNotifications && (
                        <div className="absolute right-0 md:right-0 top-12 w-80 rounded-xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50">
                                <h4 className="text-slate-800 font-bold text-sm">Notifications</h4>
                            </div>

                            <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                {!user?.notifications || user.notifications.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-slate-400 text-sm">
                                        No new notifications
                                    </div>
                                ) : (
                                    user.notifications.map((notification) => (
                                        <div
                                            key={notification._id}
                                            className={`group px-4 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-all flex gap-3 ${!notification.read ? 'bg-blue-50/30' : ''}`}
                                        >
                                            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!notification.read ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                                            <div className="flex-1">
                                                <p className={`text-sm leading-snug ${!notification.read ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-[12px] text-slate-400 font-bold uppercase">
                                                        {new Date(notification.createdAt).toLocaleDateString('en-IN')}
                                                    </span>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {!notification.read && (
                                                            <button
                                                                type="button"
                                                                disabled={loading} onClick={() => { handleMarkAsRead(notification._id) }} title="Mark as read" className="text-blue-600 hover:bg-blue-100 p-1 rounded">
                                                                <CheckCheck size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
