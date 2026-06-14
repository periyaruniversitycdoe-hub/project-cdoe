import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, CalendarRange, Menu } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { useNotifications } from '../contexts/NotificationContext';
import { getSourceConfig, formatRelativeTime } from '../api/adminNotifications';

const Navbar = ({ onMenuClick }) => {
    const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
    const { activeSession } = useSession();
    const navigate = useNavigate();

    const { notifications, unreadCount, markOne, markAll } = useNotifications();

    const [showNotifications, setShowNotifications] = React.useState(false);
    const [settings, setSettings] = React.useState(null);
    const dropdownRef = React.useRef(null);

    React.useEffect(() => {
        const ac = new AbortController();
        fetch(
            (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/settings',
            { signal: ac.signal }
        )
            .then(r => r.json())
            .then(res => setSettings(res.success ? res.data : res))
            .catch(err => { if (err.name !== 'AbortError') {} });
        return () => ac.abort();
    }, []);

    React.useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target))
                setShowNotifications(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleNotifClick = async (n) => {
        if (!n.is_read) await markOne(n.id, n.source_type);
        setShowNotifications(false);
        if (n.link) navigate(n.link);
    };

    const handleMarkAllRead = async (e) => {
        e.stopPropagation();
        await markAll();
    };

    return (
        <header className="admin-header">
            <div className="d-flex align-items-center gap-2 gap-md-3">
                <button className="btn p-0 me-2 d-lg-none border-0 bg-transparent text-secondary" onClick={onMenuClick} aria-label="Open menu">
                    <Menu size={24} />
                </button>
                {activeSession ? (
                    <div className="d-flex align-items-center gap-2 px-3 py-1 rounded-pill border" style={{ background: '#ecfdf5', borderColor: '#6ee7b7', fontSize: 12 }}>
                        <CalendarRange size={14} style={{ color: '#059669' }} />
                        <span className="fw-semibold" style={{ color: '#065f46' }}>{activeSession.month} {activeSession.year}</span>
                        <span className="badge rounded-pill ms-1" style={{ background: '#059669', color: '#fff', fontSize: 10, padding: '2px 7px' }}>ACTIVE</span>
                        <span className="ms-2 d-none d-md-flex align-items-center gap-1" style={{ color: '#374151' }}>
                            <span title="Registration" style={{ width: 8, height: 8, borderRadius: '50%', background: activeSession.registration_open ? '#22c55e' : '#d1d5db', display: 'inline-block' }} />
                            <span title="Applications"  style={{ width: 8, height: 8, borderRadius: '50%', background: activeSession.application_open   ? '#22c55e' : '#d1d5db', display: 'inline-block' }} />
                            <span title="Results"       style={{ width: 8, height: 8, borderRadius: '50%', background: activeSession.result_published    ? '#22c55e' : '#d1d5db', display: 'inline-block' }} />
                        </span>
                    </div>
                ) : (
                    <div className="d-flex align-items-center gap-2 px-3 py-1 rounded-pill border" style={{ background: '#fef2f2', borderColor: '#fca5a5', fontSize: 12 }}>
                        <CalendarRange size={14} style={{ color: '#dc2626' }} />
                        <span className="fw-semibold" style={{ color: '#991b1b' }}>No Active Session</span>
                    </div>
                )}
            </div>

            <div className="d-flex align-items-center gap-4">
                {/* Bell */}
                <div className="position-relative" ref={dropdownRef}>
                    <button
                        className="btn btn-link text-muted p-0 position-relative"
                        onClick={() => setShowNotifications(v => !v)}
                        aria-label="Notifications"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '10px', padding: '3px 6px', minWidth: 18 }}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="shadow bg-white rounded-3" style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: 340, zIndex: 1050, boxShadow: '0 10px 40px rgba(0,0,0,0.12)' }}>
                            {/* Header */}
                            <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom" style={{ background: '#f8fafc', borderRadius: '12px 12px 0 0' }}>
                                <span className="fw-bold small text-uppercase" style={{ letterSpacing: '0.05em', color: '#374151' }}>
                                    Notifications
                                    {unreadCount > 0 && <span className="badge bg-danger ms-2 rounded-pill" style={{ fontSize: 10 }}>{unreadCount}</span>}
                                </span>
                                {unreadCount > 0 && (
                                    <button className="btn btn-link btn-sm p-0 text-decoration-none" style={{ fontSize: 11, color: '#6366f1' }} onClick={handleMarkAllRead}>
                                        Mark all read
                                    </button>
                                )}
                            </div>

                            {/* List */}
                            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div className="text-center py-4 text-muted" style={{ fontSize: 13 }}>
                                        <Bell size={28} className="mb-2 opacity-25" />
                                        <p className="mb-0">No notifications yet</p>
                                    </div>
                                ) : notifications.map(n => {
                                    const cfg = getSourceConfig(n.source_type);
                                    return (
                                        <button
                                            key={n.id}
                                            className="w-100 border-0 text-start px-3 py-2 border-bottom d-flex align-items-start gap-3"
                                            style={{ background: n.is_read ? '#fff' : '#f5f8ff', cursor: 'pointer', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                            onMouseLeave={e => e.currentTarget.style.background = n.is_read ? '#fff' : '#f5f8ff'}
                                            onClick={() => handleNotifClick(n)}
                                        >
                                            <div className="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle" style={{ width: 36, height: 36, background: cfg.bg, fontSize: 16, marginTop: 2 }}>
                                                {cfg.icon}
                                            </div>
                                            <div className="flex-grow-1 min-w-0">
                                                <p className="mb-0 small" style={{ fontWeight: n.is_read ? 400 : 600, whiteSpace: 'normal', color: '#1e293b', lineHeight: 1.4 }}>{n.title}</p>
                                                {n.message && <p className="mb-0 text-muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>{n.message.length > 70 ? n.message.slice(0, 70) + '…' : n.message}</p>}
                                                <p className="mb-0 mt-1" style={{ fontSize: 10, color: '#94a3b8' }}>{formatRelativeTime(n.created_at)}</p>
                                            </div>
                                            {!n.is_read && <div className="flex-shrink-0 rounded-circle bg-primary" style={{ width: 7, height: 7, marginTop: 6 }} />}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Footer */}
                            <div className="text-center py-2 border-top" style={{ borderRadius: '0 0 12px 12px' }}>
                                <button className="btn btn-link btn-sm text-decoration-none p-0" style={{ fontSize: 12, color: '#6366f1' }} onClick={() => { setShowNotifications(false); navigate('/notifications'); }}>
                                    View All Notifications
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* User menu */}
                <div className="dropdown">
                    <button className="btn btn-link text-decoration-none d-flex align-items-center gap-2 p-0 text-dark" data-bs-toggle="dropdown">
                        <div className="text-end d-none d-md-block">
                            <p className="mb-0 fw-bold" style={{ fontSize: '13px' }}>{adminUser.full_name || 'Administrator'}</p>
                            <p className="mb-0 text-muted" style={{ fontSize: '11px' }}>{adminUser.role || 'Super Admin'}</p>
                        </div>
                        <div className="bg-white rounded-circle d-flex align-items-center justify-content-center border shadow-sm" style={{ width: 38, height: 38, overflow: 'hidden' }}>
                            <img
                                src={settings?.logo?.startsWith('/uploads') ? `${import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001'}${settings.logo}` : settings?.logo || '/images/pu_logo.png'}
                                alt="Periyar University Logo"
                                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '3px' }}
                            />
                        </div>
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0 mt-2">
                        <li>
                            <button className="dropdown-item py-2" onClick={() => {
                                if (window.confirm('Are you sure want to logout?')) {
                                    localStorage.removeItem('adminToken');
                                    localStorage.removeItem('adminUser');
                                    window.location.href = '/login';
                                }
                            }}>
                                <LogOut size={16} className="me-2" /> Logout
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
