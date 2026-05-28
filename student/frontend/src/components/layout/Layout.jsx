import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useLocation, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  LayoutDashboard, FileText, Eye, Ticket, User, LogOut, Menu, Bell, X,
  CalendarRange, CheckCircle, XCircle, CreditCard, FileCheck, ShieldCheck,
  Info, AlertTriangle, BellOff
} from 'lucide-react';
import '../../pages/Dashboard.css';

const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';

// Per-type icon and colour config
const TYPE_CONFIG = {
  success:     { icon: CheckCircle,  color: '#10b981', bg: '#d1fae5' },
  danger:      { icon: XCircle,      color: '#ef4444', bg: '#fee2e2' },
  warning:     { icon: AlertTriangle,color: '#f59e0b', bg: '#fef3c7' },
  payment:     { icon: CreditCard,   color: '#6366f1', bg: '#ede9fe' },
  result:      { icon: FileCheck,    color: '#0ea5e9', bg: '#e0f2fe' },
  hall_ticket: { icon: Ticket,       color: '#8b5cf6', bg: '#ede9fe' },
  counselling: { icon: FileText,     color: '#14b8a6', bg: '#ccfbf1' },
  direct_pass: { icon: ShieldCheck,  color: '#0891b2', bg: '#cffafe' },
  info:        { icon: Info,         color: '#64748b', bg: '#f1f5f9' },
};

function NotifIcon({ type, size = 16 }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <span style={{
      width: 32, height: 32, borderRadius: '50%',
      background: cfg.bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0
    }}>
      <Icon size={size} color={cfg.color} />
    </span>
  );
}

const Layout = () => {
  const { user, logout, token } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [univSettings,    setUnivSettings]    = useState(null);
  const [sessionInfo,     setSessionInfo]     = useState(null);
  const [hallTicket,      setHallTicket]      = useState(null);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [notifOpen,       setNotifOpen]       = useState(false);
  const [notifications,   setNotifications]   = useState([]);
  const [unread,          setUnread]          = useState(0);
  const prevUnreadRef = useRef(0);
  const esRef         = useRef(null);

  // University settings
  useEffect(() => {
    axios.get(`${API}/settings`)
      .then(res => setUnivSettings(res.data.success ? res.data.data : res.data))
      .catch(() => {});
  }, []);

  // Session info
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/student/session`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setSessionInfo(res.data))
      .catch(() => setSessionInfo(null));
  }, [token]);

  // Hall ticket — backend always returns 200; available:false means not ready yet
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/student/hall-ticket`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setHallTicket(res.data?.available === false ? null : res.data))
      .catch(() => setHallTicket(null));
  }, [token]);

  // ── SSE real-time notifications ────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    if (!token) return;
    if (esRef.current) esRef.current.close();

    const es = new EventSource(`${API}/student/notifications/stream?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const incoming   = data.notifications || [];
        const newUnread  = data.unread        || 0;
        const newItems   = data.newItems      || [];

        setNotifications(incoming);
        setUnread(newUnread);

        // Toast each brand-new unread notification
        if (newItems.length > 0 && prevUnreadRef.current !== undefined) {
          newItems.forEach(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            toast(n.title, {
              icon: React.createElement(cfg.icon, { size: 18, color: cfg.color }),
              duration: 5000,
              style: { fontSize: 13 },
            });
          });
        }
        prevUnreadRef.current = newUnread;
      } catch (_) {}
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 15 s if connection drops
      setTimeout(connectSSE, 15000);
    };
  }, [token]);

  useEffect(() => {
    connectSSE();
    return () => { if (esRef.current) esRef.current.close(); };
  }, [connectSSE]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleMarkAllRead = () => {
    axios.put(`${API}/student/notifications/read-all`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setUnread(0);
        setNotifications(n => n.map(x => ({ ...x, is_read: 1 })));
        prevUnreadRef.current = 0;
      })
      .catch(() => {});
  };

  const handleMarkOneRead = (id) => {
    axios.put(`${API}/student/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: 1 } : x));
        setUnread(u => Math.max(0, u - 1));
      })
      .catch(() => {});
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      if (esRef.current) esRef.current.close();
      logout();
      navigate('/login');
    }
  };

  const closeSidebar = () => setSidebarOpen(false);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-wrapper">
      <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={closeSidebar} />

      <aside className={`dashboard-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img
              src={univSettings?.logo?.startsWith('/uploads') ? `(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + ''${univSettings.logo}` : univSettings?.logo || '/images/pu_logo.png'}
              alt="PU" className="sidebar-logo"
            />
            <div className="sidebar-brand-text">
              PERIYAR<br/><span style={{fontSize:'0.8rem',opacity:0.8}}>UNIVERSITY</span>
            </div>
            <button className="btn d-lg-none ms-auto text-white p-0" onClick={closeSidebar}>
              <X size={24} />
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Main Menu</div>
          <Link to="/dashboard"  className={`nav-item-link ${location.pathname === '/dashboard'  ? 'active' : ''}`} onClick={closeSidebar}><LayoutDashboard size={20}/><span className="nav-item-text">Dashboard</span></Link>
          <Link to="/apply"      className={`nav-item-link ${location.pathname === '/apply'      ? 'active' : ''}`} onClick={closeSidebar}><FileText size={20}/><span className="nav-item-text">My Application</span></Link>
          <Link to="/review"     className={`nav-item-link ${location.pathname === '/review'     ? 'active' : ''}`} onClick={closeSidebar}><Eye size={20}/><span className="nav-item-text">Review &amp; Submit</span></Link>
          {!!hallTicket && (
            <Link to="/hall-ticket" className={`nav-item-link ${location.pathname === '/hall-ticket' ? 'active' : ''}`} onClick={closeSidebar}><Ticket size={20}/><span className="nav-item-text">Hall Ticket</span></Link>
          )}
          <div className="nav-section-label mt-4">Account</div>
          <Link to="/profile" className={`nav-item-link ${location.pathname === '/profile' ? 'active' : ''}`} onClick={closeSidebar}><User size={20}/><span className="nav-item-text">Profile</span></Link>
        </nav>

        <div className="sidebar-footer">
          <button onClick={() => { handleLogout(); closeSidebar(); }} className="nav-item-link logout-btn border-0 w-100 text-start">
            <LogOut size={20}/><span className="sidebar-footer-text">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button className="btn p-0 me-2 d-lg-none" onClick={() => setSidebarOpen(true)}>
              <Menu size={24}/>
            </button>
          </div>

          <div className="topbar-right">
            {sessionInfo && (
              <div className="d-none d-md-flex align-items-center gap-2 bg-white p-1 px-3 rounded-pill border shadow-sm me-3">
                <CalendarRange size={16} className="text-primary"/>
                <span className="small fw-bold">Session: {sessionInfo.session_name}</span>
              </div>
            )}

            {/* ── Bell Dropdown ── */}
            <div className="position-relative me-2">
              <button
                className="btn position-relative p-2 text-muted"
                onClick={() => setNotifOpen(p => !p)}
                title="Notifications"
              >
                <Bell size={20}/>
                {unread > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{fontSize: 9, padding: '3px 5px', minWidth: 18}}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="position-fixed top-0 start-0 w-100 h-100" style={{zIndex:1040}} onClick={() => setNotifOpen(false)}/>
                  <div className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg border"
                    style={{width: 340, maxHeight: 460, zIndex:1050, top:'100%', display:'flex', flexDirection:'column'}}>

                    {/* Header */}
                    <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <Bell size={15} className="text-primary"/>
                        <span className="fw-bold small">Notifications</span>
                        {unread > 0 && (
                          <span className="badge bg-danger rounded-pill" style={{fontSize:10}}>{unread}</span>
                        )}
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {unread > 0 && (
                          <button className="btn btn-link btn-sm p-0 text-primary" style={{fontSize:11}} onClick={handleMarkAllRead}>
                            Mark all read
                          </button>
                        )}
                        <button className="btn btn-sm p-0 text-muted" onClick={() => setNotifOpen(false)}>
                          <X size={14}/>
                        </button>
                      </div>
                    </div>

                    {/* List */}
                    <div style={{overflowY:'auto', flex:1}}>
                      {notifications.length === 0 ? (
                        <div className="text-center text-muted py-5" style={{fontSize:13}}>
                          <BellOff size={32} className="mb-2 opacity-25"/>
                          <div className="fw-semibold">No notifications yet</div>
                          <div style={{fontSize:11}}>You'll be notified about approvals,<br/>results, hall tickets and more</div>
                        </div>
                      ) : notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => !n.is_read && handleMarkOneRead(n.id)}
                          className={`d-flex align-items-start gap-2 px-3 py-2 border-bottom ${!n.is_read ? 'bg-primary bg-opacity-10' : ''}`}
                          style={{cursor: n.is_read ? 'default' : 'pointer', transition:'background 0.2s'}}
                        >
                          <div className="mt-1">
                            <NotifIcon type={n.type}/>
                          </div>
                          <div style={{flex:1, minWidth:0}}>
                            <div className="fw-semibold text-truncate" style={{fontSize:12}}>
                              {n.title}
                              {!n.is_read && (
                                <span className="ms-1" style={{width:7, height:7, borderRadius:'50%', background:'#3b82f6', display:'inline-block', verticalAlign:'middle'}}/>
                              )}
                            </div>
                            <div className="text-muted" style={{fontSize:11, lineHeight:1.4}}>{n.message}</div>
                            <div className="text-muted mt-1" style={{fontSize:10}}>
                              {new Date(n.created_at).toLocaleString('en-IN', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                      <div className="px-3 py-2 border-top text-center" style={{fontSize:11, color:'#94a3b8'}}>
                        Showing last {notifications.length} notification{notifications.length !== 1 ? 's' : ''} · Updates every 8 seconds
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── Profile Dropdown ── */}
            <div className="position-relative">
              <div className="user-profile-trigger" onClick={() => setProfileDropdown(p => !p)}>
                <div className="avatar-circle">{user?.full_name?.charAt(0) || 'U'}</div>
                <div className="d-none d-sm-block">
                  <div className="fw-bold small">{user?.full_name?.split(' ')[0]}</div>
                  <div className="text-muted" style={{fontSize:'0.7rem'}}>Student Account</div>
                </div>
              </div>
              {profileDropdown && (
                <>
                  <div className="position-fixed top-0 start-0 w-100 h-100" style={{zIndex:1040}} onClick={() => setProfileDropdown(false)}/>
                  <div className="position-absolute end-0 mt-2 bg-white rounded-3 shadow border" style={{minWidth:180, zIndex:1050, top:'100%'}}>
                    <div className="px-3 py-2 border-bottom">
                      <div className="fw-bold small">{user?.full_name}</div>
                      <div className="text-muted" style={{fontSize:'0.7rem'}}>Student Account</div>
                    </div>
                    <button className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 w-100 text-start border-0 bg-transparent"
                      onClick={() => { navigate('/profile'); setProfileDropdown(false); }}>
                      <User size={15}/><span className="small">Profile</span>
                    </button>
                    <button className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 w-100 text-start border-0 bg-transparent text-danger"
                      onClick={() => { setProfileDropdown(false); handleLogout(); }}>
                      <LogOut size={15}/><span className="small">Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <Outlet/>
        </div>
      </main>
    </div>
  );
};

export default Layout;
