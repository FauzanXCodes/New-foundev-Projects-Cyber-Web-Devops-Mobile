import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!localStorage.getItem('campusbite-token')) { setLoading(false); return; }
    api('/auth/me').then(({ user }) => setUser(user)).catch(() => localStorage.removeItem('campusbite-token')).finally(() => setLoading(false));
  }, []);
  const value = useMemo(() => ({ user, loading, setUser,
    async signIn(credentials) { const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); localStorage.setItem('campusbite-token', result.token); setUser(result.user); return result.user; },
    async register(fields) { const result = await api('/auth/register', { method: 'POST', body: JSON.stringify(fields) }); localStorage.setItem('campusbite-token', result.token); setUser(result.user); return result.user; },
    async signOut() { localStorage.removeItem('campusbite-token'); setUser(null); }
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
