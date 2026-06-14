import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { openNotificationStream, fetchNotifications, fetchUnreadCount, markOneRead, markAllRead, getSourceConfig } from '../api/adminNotifications';

const NotificationContext = createContext(null);

// ── Web Audio chime (no file needed) ─────────────────────────────────────────
function playChime() {
    try {
        const ctx  = new (window.AudioContext || window.webkitAudioContext)();
        const gain = ctx.createGain();
        gain.connect(ctx.destination);

        [[523.25, 0, 0.18], [659.25, 0.12, 0.18], [783.99, 0.24, 0.3]].forEach(([freq, start, dur]) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, ctx.currentTime + start);
            g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        });

        setTimeout(() => ctx.close(), 1500);
    } catch (_) {}
}

// ── Native browser notification ───────────────────────────────────────────────
function showBrowserPush(title, message) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        new Notification(title, {
            body:  message || '',
            icon:  '/images/pu_logo.png',
            badge: '/images/pu_logo.png',
            tag:   'admin-erp-notification',
        });
    } catch (_) {}
}

async function requestPushPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied')  return 'denied';
    return Notification.requestPermission();
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);   // last 5 for Navbar
    const [unreadCount,   setUnreadCount]   = useState(0);
    const [sourceCounts,  setSourceCounts]  = useState({});   // { application: 3, payment: 1 }
    const [preferences,   setPreferences]   = useState({});   // { source_type: { sound_enabled, toast_enabled, push_enabled } }
    const esRef = useRef(null);

    // ── Load preferences from backend once ───────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        const BASE = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/admin-notifications';
        fetch(`${BASE}/preferences`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    const map = {};
                    (data.data || []).forEach(p => { map[p.source_type] = p; });
                    setPreferences(map);
                }
            })
            .catch(() => {});
    }, []);

    // ── Request browser push permission on first load ─────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) requestPushPermission().catch(() => {});
    }, []);

    // ── Initial fetch of last 5 notifications + counts ────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        fetchNotifications({ limit: 5 })
            .then(data => {
                if (data.success) {
                    setNotifications(data.data || []);
                    setUnreadCount(data.unread_count || 0);
                    setSourceCounts(data.by_source || {});
                }
            })
            .catch(() => {});
    }, []);

    // ── SSE real-time stream ──────────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;

        function connect() {
            if (esRef.current) esRef.current.close();

            const es = openNotificationStream((msg) => {
                if (msg.event === 'init') {
                    setUnreadCount(msg.data?.unread_count ?? 0);
                    setSourceCounts(msg.data?.by_source ?? {});

                } else if (msg.event === 'notification') {
                    const n = msg.data;

                    // Update bell list (keep last 5)
                    setNotifications(prev => [n, ...prev].slice(0, 5));
                    setUnreadCount(c => c + 1);
                    setSourceCounts(prev => ({
                        ...prev,
                        [n.source_type]: (prev[n.source_type] || 0) + 1,
                    }));

                    // Per-source preference lookup
                    const pref = preferences[n.source_type] || {};
                    const cfg  = getSourceConfig(n.source_type);

                    // Feature 1: Toast popup
                    if (pref.toast_enabled !== 0) {
                        toast.custom(
                            (t) => (
                                <div
                                    className="d-flex align-items-start gap-2 px-3 py-2 rounded-3 shadow"
                                    style={{
                                        background: '#fff',
                                        border: `1px solid ${cfg.color}30`,
                                        minWidth: 280,
                                        maxWidth: 360,
                                        opacity: t.visible ? 1 : 0,
                                        transition: 'opacity 0.3s',
                                    }}
                                >
                                    <div
                                        className="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle"
                                        style={{ width: 34, height: 34, background: cfg.bg, fontSize: 18, marginTop: 1 }}
                                    >
                                        {cfg.icon}
                                    </div>
                                    <div className="flex-grow-1">
                                        <p className="mb-0 fw-semibold" style={{ fontSize: 13, color: '#1e293b' }}>{n.title}</p>
                                        {n.message && (
                                            <p className="mb-0 text-muted" style={{ fontSize: 11 }}>
                                                {n.message.length > 60 ? n.message.slice(0, 60) + '…' : n.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ),
                            { duration: 4500, position: 'bottom-right' }
                        );
                    }

                    // Feature 3: Sound
                    if (pref.sound_enabled !== 0) playChime();

                    // Feature 2: Browser push notification
                    if (pref.push_enabled !== 0) showBrowserPush(n.title, n.message);

                } else if (msg.event === 'unread_count') {
                    setUnreadCount(msg.data?.count ?? 0);
                    setSourceCounts(msg.data?.by_source ?? {});
                }
            }, () => {
                // On error: reconnect after 5 s
                setTimeout(connect, 5000);
            });

            esRef.current = es;
        }

        connect();
        return () => { esRef.current?.close(); esRef.current = null; };
    }, [preferences]); // re-connect if preferences change so new values take effect

    // ── Exposed actions ───────────────────────────────────────────────────────
    const markOne = useCallback(async (id, source_type) => {
        await markOneRead(id).catch(() => {});
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
        setUnreadCount(c => Math.max(0, c - 1));
        if (source_type) {
            setSourceCounts(prev => ({
                ...prev,
                [source_type]: Math.max(0, (prev[source_type] || 1) - 1),
            }));
        }
    }, []);

    const markAll = useCallback(async () => {
        await markAllRead().catch(() => {});
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
        setSourceCounts({});
    }, []);

    const refreshCounts = useCallback(() => {
        fetchUnreadCount()
            .then(data => {
                if (data.success) {
                    setUnreadCount(data.count || 0);
                    setSourceCounts(data.by_source || {});
                }
            })
            .catch(() => {});
    }, []);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            sourceCounts,
            preferences,
            setPreferences,
            markOne,
            markAll,
            refreshCounts,
            requestPushPermission,
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
    return ctx;
}
