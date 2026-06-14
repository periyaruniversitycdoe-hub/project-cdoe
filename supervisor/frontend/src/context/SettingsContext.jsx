import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const SettingsContext = createContext({ settings: {}, loading: true });

const API = import.meta.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002';

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const esRef = useRef(null);

    async function fetchSettings() {
        try {
            const r = await fetch(`${API}/api/settings`);
            const d = await r.json();
            if (d.success) setSettings(d.data || {});
        } catch (_) {}
        setLoading(false);
    }

    useEffect(() => {
        fetchSettings();

        // SSE: admin pushes settings-updated event → re-fetch immediately
        try {
            const es = new EventSource(`${API}/api/settings/events`);
            esRef.current = es;
            es.addEventListener('settings-updated', fetchSettings);
            es.onerror = () => {}; // EventSource auto-reconnects
        } catch (_) {}

        // Fallback polling every 60 s (guards against SSE connection drops)
        const poll = setInterval(fetchSettings, 60000);

        return () => {
            if (esRef.current) { esRef.current.close(); esRef.current = null; }
            clearInterval(poll);
        };
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, loading }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => useContext(SettingsContext);
