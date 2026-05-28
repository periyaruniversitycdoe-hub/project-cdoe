
import React from 'react';
import { Bell, User, LogOut, CalendarRange, Menu } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';

const Navbar = ({ onMenuClick }) => {
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
  const { activeSession } = useSession();

  const [showNotifications, setShowNotifications] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(3);
  const [settings, setSettings] = React.useState(null);

  React.useEffect(() => {
    fetch((import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/settings')
      .then(r => r.json())
      .then(res => {
        setSettings(res.success ? res.data : res);
      })
      .catch(() => {});
  }, []);

  const notifications = [
    { id: 1, title: 'New Application Received', time: '2 mins ago', icon: '📝' },
    { id: 2, title: 'Database Backup Successful', time: '1 hour ago', icon: '💾' },
    { id: 3, title: 'System Settings Updated', time: '3 hours ago', icon: '⚙️' }
  ];

  return (
    <header className="admin-header">
      {/* Active Session Badge */}
      <div className="d-flex align-items-center gap-2 gap-md-3">
        <button className="btn p-0 me-2 d-lg-none border-0 bg-transparent text-secondary" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={24} />
        </button>
        {activeSession ? (
          <div
            className="d-flex align-items-center gap-2 px-3 py-1 rounded-pill border"
            style={{ background: '#ecfdf5', borderColor: '#6ee7b7', fontSize: 12 }}
          >
            <CalendarRange size={14} style={{ color: '#059669' }} />
            <span className="fw-semibold" style={{ color: '#065f46' }}>
              {activeSession.month} {activeSession.year}
            </span>
            <span
              className="badge rounded-pill ms-1"
              style={{ background: '#059669', color: '#fff', fontSize: 10, padding: '2px 7px' }}
            >
              ACTIVE
            </span>
            <span className="ms-2 d-none d-md-flex align-items-center gap-1" style={{ color: '#374151' }}>
              <span
                title="Registration"
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: activeSession.registration_open ? '#22c55e' : '#d1d5db',
                  display: 'inline-block'
                }}
              />
              <span
                title="Applications"
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: activeSession.application_open ? '#22c55e' : '#d1d5db',
                  display: 'inline-block'
                }}
              />
              <span
                title="Results"
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: activeSession.result_published ? '#22c55e' : '#d1d5db',
                  display: 'inline-block'
                }}
              />
            </span>
          </div>
        ) : (
          <div
            className="d-flex align-items-center gap-2 px-3 py-1 rounded-pill border"
            style={{ background: '#fef2f2', borderColor: '#fca5a5', fontSize: 12 }}
          >
            <CalendarRange size={14} style={{ color: '#dc2626' }} />
            <span className="fw-semibold" style={{ color: '#991b1b' }}>No Active Session</span>
          </div>
        )}
      </div>

      <div className="d-flex align-items-center gap-4">
        {/* Notifications */}
        <div className="dropdown">
          <button
            className="btn btn-link text-muted p-0 position-relative"
            onClick={() => { setShowNotifications(!showNotifications); setUnreadCount(0); }}
            data-bs-toggle="dropdown"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '10px', padding: '3px 6px' }}>
                {unreadCount}
              </span>
            )}
          </button>
          <ul className="dropdown-menu dropdown-menu-end shadow border-0 mt-3 p-0" style={{ width: '300px' }}>
            <li className="px-3 py-2 border-bottom bg-light">
              <span className="fw-bold small text-uppercase">Notifications</span>
            </li>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {notifications.map(n => (
                <li key={n.id} className="border-bottom">
                  <button className="dropdown-item px-3 py-2 d-flex align-items-start gap-3">
                    <span style={{ fontSize: '20px' }}>{n.icon}</span>
                    <div className="flex-grow-1">
                      <p className="mb-0 small fw-semibold" style={{ whiteSpace: 'normal' }}>{n.title}</p>
                      <p className="mb-0 x-small text-muted" style={{ fontSize: '11px' }}>{n.time}</p>
                    </div>
                  </button>
                </li>
              ))}
            </div>
            <li className="text-center py-2">
              <button className="btn btn-link btn-sm text-decoration-none p-0" style={{ fontSize: '12px' }}>View All Notifications</button>
            </li>
          </ul>
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
                src={settings?.logo?.startsWith('/uploads') ? `((import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '')${settings.logo}` : settings?.logo || '/images/pu_logo.png'} 
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
