import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;

const SessionContext = createContext(null);

/**
 * Fetches the full sessions list once at app level and exposes:
 *   activeSession  — the session row where is_active=1, or null
 *   sessions       — all session rows (for filter dropdowns)
 *   loading        — true until first fetch completes
 *   refreshSessions — call after any session mutation to re-sync
 *
 * Polls every 60 s so the indicator stays fresh without requiring a page reload
 * when a session is activated from another browser tab / device.
 */
export const SessionProvider = ({ children }) => {
    const [sessions,      setSessions]      = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [loading,       setLoading]       = useState(true);

    // Accepts a signal so both the initial call and each poll tick can be
    // cancelled — prevents stale state updates if the provider unmounts or
    // the token changes between ticks.
    const fetchSessions = useCallback(async (signal) => {
        const token = localStorage.getItem('adminToken');
        if (!token) { setLoading(false); return; }
        try {
            const res  = await axios.get(`${API_URL}/sessions`, {
                headers: { Authorization: `Bearer ${token}` },
                signal,
            });
            const data = res.data.data || [];
            setSessions(data);
            setActiveSession(data.find(s => s.is_active) || null);
        } catch (err) {
            // ERR_CANCELED = cleanup fired — not an auth/network error.
            if (err?.code !== 'ERR_CANCELED') { /* silently ignore auth/network errors */ }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Each interval tick gets its own AbortController so an in-flight
        // request from the previous tick is cancelled before the next fires.
        let tickAc = new AbortController();
        fetchSessions(tickAc.signal);

        const timer = setInterval(() => {
            tickAc.abort();           // cancel previous tick's request if still pending
            tickAc = new AbortController();
            fetchSessions(tickAc.signal);
        }, 60_000);

        return () => {
            clearInterval(timer);
            tickAc.abort();           // cancel any in-flight request on unmount
        };
    }, [fetchSessions]);

    /** Convenience: human-readable label for a session row */
    const sessionLabel = (s) =>
        s ? `${s.month} ${s.year}${s.is_active ? ' (Active)' : ''}` : '—';

    return (
        <SessionContext.Provider value={{
            sessions,
            activeSession,
            loading,
            refreshSessions: fetchSessions,
            sessionLabel,
        }}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
    return ctx;
};
