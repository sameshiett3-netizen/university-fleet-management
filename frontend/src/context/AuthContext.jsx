/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Restore the session after a refresh (the cookie is HttpOnly, so we ask the server who we are)
    useEffect(() => {
        let cancelled = false;
        api.get('/auth/session')
            .then((res) => { if (!cancelled) setUser(res.data.user); })
            .catch(() => { if (!cancelled) setUser(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // If the session expires while the app is open, return to the login screen
    useEffect(() => {
        const id = api.interceptors.response.use(
            (res) => res,
            (error) => {
                const url = error.config?.url || '';
                if (error.response?.status === 401 && !url.includes('/auth/')) setUser(null);
                return Promise.reject(error);
            },
        );
        return () => api.interceptors.response.eject(id);
    }, []);

    const login = useCallback(async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        setUser(res.data.user);
        return res.data.user;
    }, []);

    const logout = useCallback(async () => {
        try { await api.post('/auth/logout'); } finally { setUser(null); }
    }, []);

    const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const homePathFor = (user) => (user?.role === 'Admin' ? '/admin' : '/driver');
