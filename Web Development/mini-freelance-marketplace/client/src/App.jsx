import { useRef, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import useAuth from './hooks/useAuth';
import { useSelector } from 'react-redux';
import { useEffect } from 'react';
import SignUp from './pages/auth/SignUp';
import Login from './pages/auth/Login';
import Cookies from 'js-cookie';
import FindWorkPage from './pages/freelancer/FindWorkPage';
import NotFoundPage from './pages/NotFoundPage';
import Profile from './components/reusable/Profile';
import ManageProjects from './pages/client/ManageProject';
import useGigs from './hooks/useGigs';
import ProjectDetailsPage from './components/reusable/ProjectDetailsPage';
import io from 'socket.io-client';

const ClientRoute = () => {
  const { user, loading } = useSelector((state) => state.auth);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">
      <p>Loading...</p>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user?.type !== "Client") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

const FreelancerRoute = () => {
  const { user, loading } = useSelector((state) => state.auth);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">
      <p>Loading...</p>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user?.type !== "Freelancer") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

function App() {
  const { loading, is_logged_in, user, error, email } = useSelector((state) => state.auth);
  const socketRef = useRef(null);
  const { setupUserSSE } = useAuth();
  const { setupProjectsSSE } = useGigs();
  useEffect(() => {
    if (is_logged_in) {
      const cleanupUser = setupUserSSE();
      const cleanupProjects = setupProjectsSSE();
      return () => {
        cleanupUser();
        cleanupProjects();
      };
    }
  }, [is_logged_in, setupProjectsSSE]);

  useEffect(() => {
    if (!is_logged_in || !user) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }
    if (!socketRef.current) {
      socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
        withCredentials: true,
        transports: ["websocket"],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
      });
    }

    const socket = socketRef.current;

    const onConnect = () => {
      console.log("Connected:", socket.id);
      socket.emit("join", user._id);
    };

    const onNotification = (data) => {
      toast.success(data?.message || "New notification", {
        duration: 3000,
        position: "bottom-right",
        id: data?.id || data?.message,
      });
    };

    socket.off("connect", onConnect);
    socket.off("notification", onNotification);

    socket.on("connect", onConnect);
    socket.on("notification", onNotification);

    return () => {
      socket.off("connect", onConnect);
      socket.off("notification", onNotification);
    };
  }, [is_logged_in, user?._id]);

  return (
    <AppContent />
  );
}
function AppContent() {
  return (
    <>
      <Toaster />
      <Routes>
        {/* AUTHENTICATION */}
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<SignUp />} />

        <Route path='/' element={<LandingPage />} />
        <Route path='/find-work' element={<FindWorkPage />} />

        {/* FREELANCER PAGES */}
        <Route path="/freelancer" element={<FreelancerRoute />}>
          <Route index element={<FindWorkPage />} />
          <Route path='find-work' element={<FindWorkPage />} />
          <Route path='profile' element={<Profile />} />
          <Route path='project/:id' element={<ProjectDetailsPage />} />
        </Route>
        {/* CLIENT PAGES */}
        <Route path="/client" element={<ClientRoute />}>
          <Route index element={<ManageProjects />} />
          <Route path='projects' element={<ManageProjects />} />
          <Route path='profile' element={<Profile />} />
          <Route path='project/:id' element={<ProjectDetailsPage />} />
        </Route>

        {/* NOT FOUND PAGE */}
        <Route path='*' element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default App
