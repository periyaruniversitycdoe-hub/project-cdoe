const BASE = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/admin-notifications';

function authHeaders() {
    const token = localStorage.getItem('adminToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchNotifications({ page = 1, limit = 20, unread = false, source_type = '' } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (unread)       params.set('unread', 'true');
    if (source_type)  params.set('source_type', source_type);
    const res = await fetch(`${BASE}?${params}`, { headers: authHeaders() });
    return res.json();
}

export async function fetchUnreadCount() {
    const res = await fetch(`${BASE}/count`, { headers: authHeaders() });
    return res.json();
}

export async function markOneRead(id) {
    const res = await fetch(`${BASE}/${id}/read`, {
        method: 'PATCH',
        headers: authHeaders(),
    });
    return res.json();
}

export async function markAllRead() {
    const res = await fetch(`${BASE}/read-all`, {
        method: 'PATCH',
        headers: authHeaders(),
    });
    return res.json();
}

export async function deleteNotification(id) {
    const res = await fetch(`${BASE}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
    });
    return res.json();
}

export async function bulkDeleteNotifications(ids) {
    const res = await fetch(`${BASE}/bulk`, {
        method: 'DELETE',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
    });
    return res.json();
}

export async function deleteCleared() {
    const res = await fetch(`${BASE}/cleared`, {
        method: 'DELETE',
        headers: authHeaders(),
    });
    return res.json();
}

export async function fetchPreferences() {
    const res = await fetch(`${BASE}/preferences`, { headers: authHeaders() });
    return res.json();
}

export async function updatePreferences(prefs) {
    const res = await fetch(`${BASE}/preferences`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
    });
    return res.json();
}

export function getExportUrl() {
    const token = localStorage.getItem('adminToken');
    return `${BASE}/export?token=${encodeURIComponent(token || '')}`;
}

export async function fetchRules() {
    const res = await fetch(`${BASE}/rules`, { headers: authHeaders() });
    return res.json();
}

export async function updateRule(event_key, is_active) {
    const res = await fetch(`${BASE}/rules/${encodeURIComponent(event_key)}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
    });
    return res.json();
}

export async function createAdminNotification(data) {
    const res = await fetch(`${BASE}`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
}


/** Open a Server-Sent Events connection.
 *  Returns the EventSource so the caller can close it on unmount.
 *  Passes the JWT as a query param because EventSource doesn't support headers.
 */
export function openNotificationStream(onMessage, onError) {
    const token = localStorage.getItem('adminToken');
    if (!token) return null;
    const es = new EventSource(`${BASE}/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
        try { onMessage(JSON.parse(e.data)); } catch (_) {}
    };
    if (onError) es.onerror = onError;
    return es;
}

// ── Icon + colour config per source_type ──────────────────────────────────────
export const SOURCE_CONFIG = {
    application:    { icon: '📝', color: '#3b82f6', bg: '#eff6ff',  label: 'Application'    },
    payment:        { icon: '💳', color: '#f59e0b', bg: '#fffbeb',  label: 'Payment'        },
    supervisor:     { icon: '👨‍🏫', color: '#8b5cf6', bg: '#f5f3ff',  label: 'Supervisor'     },
    center:         { icon: '🏫', color: '#10b981', bg: '#ecfdf5',  label: 'Centre'         },
    student:        { icon: '🎓', color: '#0ea5e9', bg: '#f0f9ff',  label: 'Student'        },
    hall_ticket:    { icon: '🎫', color: '#ef4444', bg: '#fef2f2',  label: 'Hall Ticket'    },
    result:         { icon: '📊', color: '#6366f1', bg: '#eef2ff',  label: 'Result'         },
    counselling:    { icon: '📋', color: '#14b8a6', bg: '#f0fdfa',  label: 'Counselling'    },
    chatbot:        { icon: '💬', color: '#0891b2', bg: '#ecfeff',  label: 'Chatbot Query'  },
    password_reset: { icon: '🔐', color: '#dc2626', bg: '#fff1f2',  label: 'Password Reset' },
    system:         { icon: '⚙️', color: '#6b7280', bg: '#f9fafb',  label: 'System'         },
};

export function getSourceConfig(source_type) {
    return SOURCE_CONFIG[source_type] || SOURCE_CONFIG.system;
}

export function formatRelativeTime(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60)   return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
