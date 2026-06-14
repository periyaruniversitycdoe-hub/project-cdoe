import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    Bell, CheckCheck, Trash2, RefreshCw, Filter, Download,
    Settings, Square, CheckSquare, Layers, X, Plus
} from 'lucide-react';
import {
    fetchNotifications,
    markOneRead,
    markAllRead,
    deleteNotification,
    bulkDeleteNotifications,
    deleteCleared,
    fetchPreferences,
    updatePreferences,
    fetchRules,
    updateRule,
    openNotificationStream,
    getSourceConfig,
    getExportUrl,
    formatRelativeTime,
    SOURCE_CONFIG,
    createAdminNotification,
} from '../api/adminNotifications';

const TABS = [
    { key: '',               label: 'All'            },
    { key: 'application',    label: 'Applications'   },
    { key: 'payment',        label: 'Payments'       },
    { key: 'supervisor',     label: 'Supervisors'    },
    { key: 'center',         label: 'Centres'        },
    { key: 'student',        label: 'Students'       },
    { key: 'hall_ticket',    label: 'Hall Tickets'   },
    { key: 'result',         label: 'Results'        },
    { key: 'counselling',    label: 'Counselling'    },
    { key: 'chatbot',        label: 'Chatbot Queries'},
    { key: 'password_reset', label: 'Password Resets'},
    { key: 'system',         label: 'System'         },
    { key: '__manage__',     label: '⚙ Manage Rules' },
];

const PAGE_SIZE = 20;

// ── Preferences Modal ─────────────────────────────────────────────────────────
function PreferencesModal({ onClose }) {
    const [prefs, setPrefs] = React.useState(null);
    const [retention, setRetention] = React.useState(90);
    const [saving, setSaving] = React.useState(false);
    const [saved, setSaved] = React.useState(false);

    React.useEffect(() => {
        fetchPreferences().then(d => {
            if (d.success) {
                const map = {};
                (d.data || []).forEach(p => {
                    if (p.source_type === '__retention__') setRetention(p.retention_days || 90);
                    else map[p.source_type] = p;
                });
                setPrefs(map);
            }
        }).catch(() => {});
    }, []);

    const toggle = (src, field) => {
        setPrefs(prev => ({
            ...prev,
            [src]: { ...(prev[src] || {}), [field]: prev[src]?.[field] === 0 ? 1 : 0 },
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const rows = Object.entries(prefs).map(([source_type, p]) => ({
                source_type,
                enabled:       p.enabled       ?? 1,
                toast_enabled: p.toast_enabled ?? 1,
                sound_enabled: p.sound_enabled ?? 1,
                push_enabled:  p.push_enabled  ?? 1,
            }));
            await updatePreferences({ preferences: rows, retention_days: retention });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    const SOURCE_TYPES = Object.keys(SOURCE_CONFIG).filter(k => k !== 'system');

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="card border-0 shadow-lg" style={{ width: 560, maxWidth: '95vw', maxHeight: '85vh', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom" style={{ background: '#f8fafc' }}>
                    <div className="d-flex align-items-center gap-2">
                        <Settings size={18} style={{ color: '#6366f1' }} />
                        <h6 className="mb-0 fw-bold">Notification Preferences</h6>
                    </div>
                    <button className="btn btn-sm btn-link p-0" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Body */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {!prefs ? (
                        <div className="text-center py-4 text-muted">
                            <div className="spinner-border spinner-border-sm" />
                        </div>
                    ) : (
                        <div className="p-4">
                            {/* Channel legend */}
                            <div className="d-flex gap-3 mb-3" style={{ fontSize: 11, color: '#64748b' }}>
                                <span>🔔 Enabled</span>
                                <span>🍞 Toast</span>
                                <span>🔊 Sound</span>
                                <span>📲 Push</span>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-sm mb-0" style={{ fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <th style={{ fontWeight: 600, paddingLeft: 8 }}>Source</th>
                                            <th className="text-center">🔔</th>
                                            <th className="text-center">🍞 Toast</th>
                                            <th className="text-center">🔊 Sound</th>
                                            <th className="text-center">📲 Push</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {SOURCE_TYPES.map(src => {
                                            const cfg = getSourceConfig(src);
                                            const p   = prefs[src] || {};
                                            return (
                                                <tr key={src}>
                                                    <td style={{ paddingLeft: 8, verticalAlign: 'middle' }}>
                                                        <span style={{ marginRight: 6 }}>{cfg.icon}</span>
                                                        {cfg.label}
                                                    </td>
                                                    {['enabled','toast_enabled','sound_enabled','push_enabled'].map(field => (
                                                        <td key={field} className="text-center" style={{ verticalAlign: 'middle' }}>
                                                            <div
                                                                className="form-check form-switch d-flex justify-content-center mb-0"
                                                                onClick={() => toggle(src, field)}
                                                                style={{ cursor: 'pointer' }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input"
                                                                    checked={(p[field] ?? 1) !== 0}
                                                                    onChange={() => {}}
                                                                    style={{ cursor: 'pointer' }}
                                                                />
                                                            </div>
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Retention */}
                            <div className="mt-4 p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <label className="fw-semibold mb-2 d-block" style={{ fontSize: 13 }}>
                                    Auto-expire old notifications after:
                                </label>
                                <div className="d-flex align-items-center gap-2">
                                    <input
                                        type="range"
                                        className="form-range flex-grow-1"
                                        min={7} max={365} step={1}
                                        value={retention}
                                        onChange={e => setRetention(Number(e.target.value))}
                                    />
                                    <span className="badge bg-secondary rounded-pill" style={{ minWidth: 60, textAlign: 'center' }}>
                                        {retention} days
                                    </span>
                                </div>
                                <div className="d-flex justify-content-between mt-1" style={{ fontSize: 11, color: '#94a3b8' }}>
                                    <span>7 days</span><span>1 year</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="d-flex justify-content-end gap-2 px-4 py-3 border-top" style={{ background: '#f8fafc' }}>
                    <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className={`btn btn-sm ${saved ? 'btn-success' : 'btn-primary'}`}
                        onClick={handleSave}
                        disabled={saving || !prefs}
                    >
                        {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving…</> : saved ? '✓ Saved' : 'Save Preferences'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Notification Rules Panel ──────────────────────────────────────────────────
const CATEGORY_ICON = {
    'Student Portal':    '🎓',
    'Supervisor Portal': '👨‍🏫',
    'Centre Portal':     '🏫',
    'Admin Actions':     '⚙️',
};

function RulesPanel() {
    const [rules,   setRules]   = React.useState(null);
    const [saving,  setSaving]  = React.useState({});
    const [saved,   setSaved]   = React.useState({});

    React.useEffect(() => {
        fetchRules().then(d => { if (d.success) setRules(d.data || []); }).catch(() => {});
    }, []);

    const toggle = async (event_key, current) => {
        const next = current === 0 ? 1 : 0;
        setSaving(s => ({ ...s, [event_key]: true }));
        setRules(prev => prev.map(r => r.event_key === event_key ? { ...r, is_active: next } : r));
        try {
            await updateRule(event_key, next);
            setSaved(s => ({ ...s, [event_key]: true }));
            setTimeout(() => setSaved(s => { const c = { ...s }; delete c[event_key]; return c; }), 1500);
        } catch (_) {
            // revert on error
            setRules(prev => prev.map(r => r.event_key === event_key ? { ...r, is_active: current } : r));
        } finally {
            setSaving(s => { const c = { ...s }; delete c[event_key]; return c; });
        }
    };

    if (!rules) {
        return (
            <div className="text-center py-5 text-muted">
                <div className="spinner-border spinner-border-sm me-2" /> Loading rules…
            </div>
        );
    }

    // Group by category
    const groups = {};
    rules.forEach(r => {
        if (!groups[r.category]) groups[r.category] = [];
        groups[r.category].push(r);
    });

    const activeCount   = rules.filter(r => r.is_active).length;
    const inactiveCount = rules.length - activeCount;

    return (
        <div>
            {/* Summary bar */}
            <div className="d-flex align-items-center gap-3 mb-4 p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-success rounded-pill" style={{ fontSize: 12 }}>{activeCount} active</span>
                    <span className="badge bg-secondary rounded-pill" style={{ fontSize: 12 }}>{inactiveCount} disabled</span>
                </div>
                <p className="mb-0 ms-auto text-muted" style={{ fontSize: 12 }}>
                    Toggle events below to control which actions generate admin notifications. Changes take effect immediately — no restart required.
                </p>
            </div>

            {Object.entries(groups).map(([category, items]) => (
                <div key={category} className="card border-0 shadow-sm mb-3" style={{ borderRadius: 12, overflow: 'hidden' }}>
                    {/* Group header */}
                    <div
                        className="d-flex align-items-center gap-2 px-4 py-2"
                        style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}
                    >
                        <span style={{ fontSize: 16 }}>{CATEGORY_ICON[category] || '📌'}</span>
                        <span className="fw-bold" style={{ fontSize: 13, color: '#374151' }}>{category}</span>
                        <span className="badge rounded-pill ms-auto" style={{ background: '#6366f1', color: '#fff', fontSize: 10 }}>
                            {items.filter(r => r.is_active).length}/{items.length} active
                        </span>
                    </div>

                    {/* Event rows */}
                    {items.map((rule, idx) => {
                        const cfg      = getSourceConfig(rule.source_type);
                        const isActive = rule.is_active !== 0;
                        const isSaving = !!saving[rule.event_key];
                        const justSaved = !!saved[rule.event_key];
                        return (
                            <div
                                key={rule.event_key}
                                className="d-flex align-items-center gap-3 px-4 py-3"
                                style={{
                                    borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none',
                                    background: isActive ? '#fff' : '#fafafa',
                                    opacity: isActive ? 1 : 0.65,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {/* Source icon */}
                                <div
                                    className="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle"
                                    style={{ width: 36, height: 36, background: cfg.bg, fontSize: 16 }}
                                >
                                    {cfg.icon}
                                </div>

                                {/* Label + description */}
                                <div className="flex-grow-1 min-w-0">
                                    <p className="mb-0 fw-semibold" style={{ fontSize: 13, color: '#1e293b' }}>
                                        {rule.label}
                                    </p>
                                    <p className="mb-0 text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                                        {rule.description}
                                    </p>
                                    <code style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                                        {rule.event_key}
                                    </code>
                                </div>

                                {/* Source badge */}
                                <span
                                    className="badge rounded-pill d-none d-md-inline-flex"
                                    style={{ background: cfg.bg, color: cfg.color, fontSize: 10, padding: '3px 10px' }}
                                >
                                    {cfg.label}
                                </span>

                                {/* Toggle */}
                                <div className="flex-shrink-0 d-flex align-items-center gap-2">
                                    {justSaved && <span style={{ fontSize: 10, color: '#10b981' }}>✓ Saved</span>}
                                    {isSaving
                                        ? <div className="spinner-border spinner-border-sm" style={{ width: 20, height: 20, color: '#6366f1' }} />
                                        : (
                                            <div
                                                className="form-check form-switch mb-0"
                                                onClick={() => toggle(rule.event_key, rule.is_active)}
                                                style={{ cursor: 'pointer' }}
                                                title={isActive ? 'Click to disable' : 'Click to enable'}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    checked={isActive}
                                                    onChange={() => {}}
                                                    style={{ cursor: 'pointer', width: 36, height: 20 }}
                                                />
                                            </div>
                                        )
                                    }
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

// ── Create Notification Modal ──────────────────────────────────────────────────
function CreateNotificationModal({ onClose, onCreated }) {
    const [title, setTitle] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [type, setType] = React.useState('info');
    const [sourceType, setSourceType] = React.useState('system');
    const [link, setLink] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Title is required');
            return;
        }
        setSubmitting(true);
        try {
            const res = await createAdminNotification({
                title: title.trim(),
                message: message.trim(),
                type,
                source_type: sourceType,
                link: link.trim() || null
            });
            if (res.success) {
                toast.success('Notification broadcasted successfully!');
                onCreated();
                onClose();
            } else {
                toast.error(res.message || 'Failed to create notification');
            }
        } catch (err) {
            toast.error('Error creating notification');
        } finally {
            setSubmitting(false);
        }
    };

    const SOURCE_OPTIONS = Object.entries(SOURCE_CONFIG).map(([key, cfg]) => ({
        value: key,
        label: cfg.label,
        icon: cfg.icon
    }));

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="card border-0 shadow-lg animate-fade-in" style={{ width: 500, maxWidth: '95vw', borderRadius: 16, overflow: 'hidden' }}>
                {/* Header */}
                <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom" style={{ background: '#f8fafc' }}>
                    <div className="d-flex align-items-center gap-2">
                        <Bell size={18} style={{ color: '#6366f1' }} />
                        <h6 className="mb-0 fw-bold">Create Custom Notification</h6>
                    </div>
                    <button className="btn btn-sm btn-link p-0 text-secondary" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div className="p-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Title */}
                        <div>
                            <label className="form-label fw-semibold mb-1" style={{ fontSize: 13, color: '#374151' }}>
                                Title <span className="text-danger">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="e.g., New student application received"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="form-label fw-semibold mb-1" style={{ fontSize: 13, color: '#374151' }}>
                                Message Description <span className="text-muted fw-normal">(Optional)</span>
                            </label>
                            <textarea
                                className="form-control form-control-sm"
                                rows={3}
                                placeholder="Enter detailed description..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                        </div>

                        <div className="row g-3">
                            {/* Category/Source Type */}
                            <div className="col-md-6">
                                <label className="form-label fw-semibold mb-1" style={{ fontSize: 13, color: '#374151' }}>
                                    Category / Source <span className="text-danger">*</span>
                                </label>
                                <select
                                    className="form-select form-select-sm"
                                    value={sourceType}
                                    onChange={e => setSourceType(e.target.value)}
                                >
                                    {SOURCE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.icon} {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Severity Level */}
                            <div className="col-md-6">
                                <label className="form-label fw-semibold mb-1" style={{ fontSize: 13, color: '#374151' }}>
                                    Type / Severity <span className="text-danger">*</span>
                                </label>
                                <select
                                    className="form-select form-select-sm"
                                    value={type}
                                    onChange={e => setType(e.target.value)}
                                >
                                    <option value="info">ℹ️ Info (Blue)</option>
                                    <option value="success">✅ Success (Green)</option>
                                    <option value="warning">⚠️ Warning (Yellow)</option>
                                    <option value="danger">🚨 Danger (Red)</option>
                                </select>
                            </div>
                        </div>

                        {/* Action Link */}
                        <div>
                            <label className="form-label fw-semibold mb-1" style={{ fontSize: 13, color: '#374151' }}>
                                Action Link / Route <span className="text-muted fw-normal">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="e.g., /applications or /payments"
                                value={link}
                                onChange={e => setLink(e.target.value)}
                            />
                            <small className="text-muted" style={{ fontSize: 11 }}>
                                Clicking this notification will navigate administrators to this path.
                            </small>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="d-flex justify-content-end gap-2 px-4 py-3 border-top" style={{ background: '#f8fafc' }}>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button>
                        <button
                            type="submit"
                            className="btn btn-sm btn-primary"
                            disabled={submitting}
                            style={{ background: '#6366f1', borderColor: '#6366f1' }}
                        >
                            {submitting ? 'Broadcasting…' : 'Broadcast Alert'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
    const navigate = useNavigate();

    const [notifications, setNotifications]   = React.useState([]);
    const [total,         setTotal]           = React.useState(0);
    const [unreadCount,   setUnreadCount]     = React.useState(0);
    const [page,          setPage]            = React.useState(1);
    const [activeTab,     setActiveTab]       = React.useState('');
    const [unreadOnly,    setUnreadOnly]      = React.useState(false);
    const [groupMode,     setGroupMode]       = React.useState(false);
    const [loading,       setLoading]         = React.useState(true);
    const [deletingId,    setDeletingId]      = React.useState(null);
    const [selected,      setSelected]        = React.useState(new Set());
    const [bulkDeleting,  setBulkDeleting]    = React.useState(false);
    const [showPrefs,     setShowPrefs]       = React.useState(false);
    const [showCreate,    setShowCreate]      = React.useState(false);

    const isManageTab = activeTab === '__manage__';
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const allSelected = notifications.length > 0 && selected.size === notifications.length;

    const load = React.useCallback(async (pg = 1, tab = activeTab, unread = unreadOnly) => {
        if (tab === '__manage__') return;
        setLoading(true);
        setSelected(new Set());
        try {
            const data = await fetchNotifications({ page: pg, limit: PAGE_SIZE, unread, source_type: tab });
            if (data.success) {
                setNotifications(data.data || []);
                setTotal(data.total || 0);
                setUnreadCount(data.unread_count || 0);
            }
        } finally {
            setLoading(false);
        }
    }, [activeTab, unreadOnly]);

    React.useEffect(() => { load(1, activeTab, unreadOnly); }, [activeTab, unreadOnly]);

    // SSE — prepend real-time notifications on page 1
    React.useEffect(() => {
        const es = openNotificationStream((msg) => {
            if (msg.event === 'notification') {
                const n = msg.data;
                const tabMatch    = !activeTab    || n.source_type === activeTab;
                const unreadMatch = !unreadOnly   || !n.is_read;
                if (page === 1 && tabMatch && unreadMatch) {
                    setNotifications(prev => [n, ...prev].slice(0, PAGE_SIZE));
                    setTotal(t => t + 1);
                }
                setUnreadCount(c => c + 1);
            } else if (msg.event === 'unread_count') {
                setUnreadCount(msg.data?.count ?? 0);
            }
        });
        return () => es?.close();
    }, [activeTab, unreadOnly, page]);

    const handleTabChange = (tab) => { setActiveTab(tab); setPage(1); };

    const handleMarkOne = async (n) => {
        if (!n.is_read) {
            await markOneRead(n.id).catch(() => {});
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
            setUnreadCount(c => Math.max(0, c - 1));
        }
        if (n.link) navigate(n.link);
    };

    const handleMarkAll = async () => {
        await markAllRead().catch(() => {});
        setNotifications(prev => prev.map(x => ({ ...x, is_read: 1 })));
        setUnreadCount(0);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        setDeletingId(id);
        try {
            await deleteNotification(id);
            setNotifications(prev => prev.filter(x => x.id !== id));
            setTotal(t => Math.max(0, t - 1));
            setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteAllRead = async () => {
        if (!window.confirm('Delete all read notifications?')) return;
        await deleteCleared().catch(() => {});
        load(1, activeTab, unreadOnly);
    };

    const handleBulkDelete = async () => {
        if (!selected.size || !window.confirm(`Delete ${selected.size} selected notification(s)?`)) return;
        setBulkDeleting(true);
        try {
            await bulkDeleteNotifications([...selected]);
            setNotifications(prev => prev.filter(x => !selected.has(x.id)));
            setTotal(t => Math.max(0, t - selected.size));
            setSelected(new Set());
        } finally {
            setBulkDeleting(false);
        }
    };

    const toggleSelect = (id) => {
        setSelected(prev => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    };

    const toggleSelectAll = () => {
        setSelected(allSelected ? new Set() : new Set(notifications.map(n => n.id)));
    };

    const handlePage = (pg) => {
        setPage(pg);
        load(pg, activeTab, unreadOnly);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ── Grouping (client-side by source_type) ─────────────────────────────────
    const grouped = React.useMemo(() => {
        if (!groupMode) return null;
        const map = {};
        notifications.forEach(n => {
            if (!map[n.source_type]) map[n.source_type] = [];
            map[n.source_type].push(n);
        });
        return map;
    }, [notifications, groupMode]);

    const renderNotif = (n, idx, arr) => {
        const cfg = getSourceConfig(n.source_type);
        const isChecked = selected.has(n.id);
        return (
            <div
                key={n.id}
                className="d-flex align-items-start gap-3 px-3 px-md-4 py-3"
                style={{
                    background: isChecked ? '#eef2ff' : n.is_read ? '#fff' : '#f5f8ff',
                    borderBottom: idx < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isChecked ? '#eef2ff' : n.is_read ? '#fff' : '#f5f8ff'; }}
                onClick={() => handleMarkOne(n)}
            >
                {/* Checkbox */}
                <div
                    className="flex-shrink-0 d-flex align-items-center"
                    style={{ paddingTop: 12 }}
                    onClick={e => { e.stopPropagation(); toggleSelect(n.id); }}
                >
                    {isChecked
                        ? <CheckSquare size={16} style={{ color: '#6366f1' }} />
                        : <Square size={16} style={{ color: '#cbd5e1' }} />
                    }
                </div>

                {/* Icon */}
                <div
                    className="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle"
                    style={{ width: 42, height: 42, background: cfg.bg, fontSize: 20, marginTop: 2 }}
                >
                    {cfg.icon}
                </div>

                {/* Content */}
                <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-start justify-content-between gap-2">
                        <div className="min-w-0">
                            <p className="mb-0" style={{ fontWeight: n.is_read ? 400 : 700, fontSize: 14, color: '#1e293b', lineHeight: 1.4 }}>
                                {n.title}
                            </p>
                            {n.message && (
                                <p className="mb-0 text-muted mt-1" style={{ fontSize: 12, lineHeight: 1.4 }}>
                                    {n.message}
                                </p>
                            )}
                            <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                                <span
                                    className="badge rounded-pill"
                                    style={{ background: cfg.bg, color: cfg.color, fontSize: 10, padding: '2px 8px', fontWeight: 600 }}
                                >
                                    {cfg.label}
                                </span>
                                <span className="text-muted" style={{ fontSize: 11 }}>
                                    {formatRelativeTime(n.created_at)}
                                </span>
                            </div>
                        </div>

                        {/* Row actions */}
                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                            {!n.is_read && (
                                <div className="rounded-circle bg-primary" style={{ width: 8, height: 8 }} title="Unread" />
                            )}
                            <button
                                className="btn btn-sm btn-link p-0 text-muted"
                                style={{ opacity: 0.5 }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                                onClick={e => handleDelete(e, n.id)}
                                disabled={deletingId === n.id}
                                title="Delete"
                            >
                                {deletingId === n.id
                                    ? <div className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }} />
                                    : <Trash2 size={14} />
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container-fluid py-4" style={{ maxWidth: 960 }}>
            {/* Page header */}
            <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-2">
                <div>
                    <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
                        <Bell size={22} style={{ color: '#6366f1' }} />
                        Notifications
                        {unreadCount > 0 && (
                            <span className="badge bg-danger rounded-pill" style={{ fontSize: 12 }}>
                                {unreadCount} unread
                            </span>
                        )}
                    </h4>
                    <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                        Real-time events from all portals — applications, payments, registrations &amp; more
                    </p>
                </div>
                {!isManageTab && (
                <div className="d-flex gap-2 flex-wrap">
                    <button
                        className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                        onClick={() => setShowCreate(true)}
                        title="Create custom notification"
                        style={{ background: '#6366f1', borderColor: '#6366f1' }}
                    >
                        <Plus size={14} />
                        Create
                    </button>
                    <button
                        className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                        onClick={() => load(page, activeTab, unreadOnly)}
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                    {unreadCount > 0 && (
                        <button
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                            onClick={handleMarkAll}
                        >
                            <CheckCheck size={14} />
                            Mark all read
                        </button>
                    )}
                    <button
                        className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                        onClick={handleDeleteAllRead}
                        title="Delete all read notifications"
                    >
                        <Trash2 size={14} />
                        Delete all read
                    </button>
                    <a
                        href={getExportUrl()}
                        download
                        className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                        title="Export to Excel"
                    >
                        <Download size={14} />
                        Export
                    </a>
                    <button
                        className={`btn btn-sm d-flex align-items-center gap-1 ${groupMode ? 'btn-indigo' : 'btn-outline-secondary'}`}
                        style={groupMode ? { background: '#6366f1', color: '#fff', borderColor: '#6366f1' } : {}}
                        onClick={() => setGroupMode(v => !v)}
                        title="Toggle grouping by source type"
                    >
                        <Layers size={14} />
                        {groupMode ? 'Grouped' : 'Group'}
                    </button>
                    <button
                        className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                        onClick={() => setShowPrefs(true)}
                        title="Notification preferences"
                    >
                        <Settings size={14} />
                        Preferences
                    </button>
                </div>
                )}
            </div>

            {/* Manage Rules view */}
            {isManageTab && <RulesPanel />}

            {/* Bulk action bar */}
            {!isManageTab && selected.size > 0 && (
                <div
                    className="d-flex align-items-center gap-3 mb-3 px-3 py-2 rounded-3"
                    style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}
                >
                    <span style={{ fontSize: 13, color: '#4338ca', fontWeight: 600 }}>
                        {selected.size} selected
                    </span>
                    <button
                        className="btn btn-sm btn-danger d-flex align-items-center gap-1"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                    >
                        {bulkDeleting
                            ? <><span className="spinner-border spinner-border-sm me-1" />Deleting…</>
                            : <><Trash2 size={13} /> Delete selected</>
                        }
                    </button>
                    <button
                        className="btn btn-sm btn-outline-secondary ms-auto"
                        onClick={() => setSelected(new Set())}
                    >
                        Clear selection
                    </button>
                </div>
            )}

            {/* Tab bar — always visible so admin can switch to/from manage tab */}
            <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: 12 }}>
                <div className="card-body py-2 px-3">
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                        <div className="d-flex gap-1 flex-wrap flex-grow-1">
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    className="btn btn-sm"
                                    style={{
                                        borderRadius: 20,
                                        fontSize: 12,
                                        padding: '3px 12px',
                                        background: activeTab === tab.key
                                            ? (tab.key === '__manage__' ? '#374151' : '#6366f1')
                                            : '#f1f5f9',
                                        color:      activeTab === tab.key ? '#fff' : '#475569',
                                        border:     'none',
                                        fontWeight: activeTab === tab.key ? 600 : 400,
                                        transition: 'all 0.15s',
                                    }}
                                    onClick={() => handleTabChange(tab.key)}
                                >
                                    {tab.key && SOURCE_CONFIG[tab.key] ? `${SOURCE_CONFIG[tab.key].icon} ` : ''}{tab.label}
                                </button>
                            ))}
                        </div>
                        {!isManageTab && (
                            <div className="d-flex align-items-center gap-2">
                                <Filter size={13} className="text-muted" />
                                <label className="form-check-label d-flex align-items-center gap-1" style={{ fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
                                    <input
                                        type="checkbox"
                                        className="form-check-input m-0"
                                        checked={unreadOnly}
                                        onChange={e => { setUnreadOnly(e.target.checked); setPage(1); }}
                                    />
                                    Unread only
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Notification list */}
            {!isManageTab && <div className="card border-0 shadow-sm" style={{ borderRadius: 12, overflow: 'hidden' }}>
                {/* Select all bar */}
                {!loading && notifications.length > 0 && (
                    <div
                        className="d-flex align-items-center gap-2 px-3 px-md-4 py-2 border-bottom"
                        style={{ background: '#f8fafc', fontSize: 12, color: '#64748b' }}
                    >
                        <div
                            className="d-flex align-items-center gap-2"
                            style={{ cursor: 'pointer' }}
                            onClick={toggleSelectAll}
                        >
                            {allSelected
                                ? <CheckSquare size={15} style={{ color: '#6366f1' }} />
                                : <Square size={15} style={{ color: '#cbd5e1' }} />
                            }
                            <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
                        </div>
                        <span className="text-muted ms-2">{total} total</span>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm me-2" role="status" />
                        Loading notifications…
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                        <Bell size={40} className="mb-3 opacity-25" />
                        <p className="mb-0 fw-semibold">No notifications found</p>
                        <p className="mb-0" style={{ fontSize: 13 }}>
                            {unreadOnly ? 'All caught up!' : 'Events will appear here as they happen.'}
                        </p>
                    </div>
                ) : groupMode && grouped ? (
                    Object.entries(grouped).map(([src, items]) => {
                        const cfg = getSourceConfig(src);
                        return (
                            <div key={src}>
                                <div
                                    className="d-flex align-items-center gap-2 px-4 py-2"
                                    style={{ background: cfg.bg, borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: cfg.color }}
                                >
                                    <span>{cfg.icon}</span>
                                    <span>{cfg.label}</span>
                                    <span className="badge rounded-pill" style={{ background: cfg.color, color: '#fff', fontSize: 10 }}>{items.length}</span>
                                </div>
                                {items.map((n, i) => renderNotif(n, i, items))}
                            </div>
                        );
                    })
                ) : (
                    <div>
                        {notifications.map((n, idx) => renderNotif(n, idx, notifications))}
                    </div>
                )}
            </div>}

            {/* Pagination */}
            {!isManageTab && totalPages > 1 && (
                <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
                    <p className="text-muted mb-0" style={{ fontSize: 12 }}>
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                    </p>
                    <div className="d-flex gap-1">
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={page === 1}
                            onClick={() => handlePage(page - 1)}
                        >
                            ‹ Prev
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                            const pg    = start + i;
                            if (pg > totalPages) return null;
                            return (
                                <button
                                    key={pg}
                                    className={`btn btn-sm ${pg === page ? 'btn-primary' : 'btn-outline-secondary'}`}
                                    onClick={() => handlePage(pg)}
                                >
                                    {pg}
                                </button>
                            );
                        })}
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={page === totalPages}
                            onClick={() => handlePage(page + 1)}
                        >
                            Next ›
                        </button>
                    </div>
                </div>
            )}

            {/* Preferences Modal */}
            {showPrefs && <PreferencesModal onClose={() => setShowPrefs(false)} />}

            {/* Create Notification Modal */}
            {showCreate && (
                <CreateNotificationModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => load(1, activeTab, unreadOnly)}
                />
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
}
