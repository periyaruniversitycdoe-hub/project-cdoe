import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const SettingsContext = createContext({ settings: {}, loading: true });

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const esRef = useRef(null);

    async function fetchSettings() {
        try {
            const token = localStorage.getItem('adminToken');
            const r = await fetch(`${API}/settings`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const d = await r.json();
            if (d.success) setSettings(d.data || {});
        } catch (_) {}
        setLoading(false);
    }

    useEffect(() => {
        fetchSettings();

        // SSE: re-fetch when admin itself saves settings (confirms DB write propagated)
        try {
            const es = new EventSource(`${API}/settings/events`);
            esRef.current = es;
            es.addEventListener('settings-updated', fetchSettings);
            es.onerror = () => {};
        } catch (_) {}

        const poll = setInterval(fetchSettings, 60000);

        return () => {
            if (esRef.current) { esRef.current.close(); esRef.current = null; }
            clearInterval(poll);
        };
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, loading, refetch: fetchSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => useContext(SettingsContext);
