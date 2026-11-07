import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './Auth';
import { ToastProvider } from './components';
import Landing from './Landing';
import AuthPage from './AuthPage';

const StudentApp = lazy(() => import('./Student'));
const AdminApp = lazy(() => import('./Admin'));
const routeLoader = <div className="page-loader"><span className="loader-ring" /><b>Setting your table…</b></div>;

function Guard({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader"><span className="loader-ring" /><b>Setting your table…</b></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/staff' : '/app'} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return <ToastProvider><Routes>
    <Route path="/" element={user ? <Navigate to={user.role === 'admin' ? '/staff' : '/app'} replace /> : <Landing />} />
    <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/staff' : '/app'} replace /> : <AuthPage />} />
    <Route path="/register" element={user ? <Navigate to="/app" replace /> : <AuthPage register />} />
    <Route path="/app/*" element={<Guard role="student"><Suspense fallback={routeLoader}><StudentApp /></Suspense></Guard>} />
    <Route path="/staff/*" element={<Guard role="admin"><Suspense fallback={routeLoader}><AdminApp /></Suspense></Guard>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></ToastProvider>;
}
