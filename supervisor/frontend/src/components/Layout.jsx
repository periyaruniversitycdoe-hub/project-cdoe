import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/dashboard',               label: 'Dashboard',           icon: '⊞' },
  { to: '/apply',                   label: 'My Application',      icon: '📋' },
  { to: '/permission-applications', label: 'Assigned Applications', icon: '🗂️' },
  { to: '/profile',                 label: 'My Profile',           icon: '👤' },
];

const BRAND_GRADIENT = 'linear-gradient(180deg,#4338ca 0%,#312e81 100%)';
const ACCENT = '#4338ca';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  function handleLogout() {
    if (!window.confirm('Are you sure you want to logout?')) return;
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  }

  const initials = (user?.name || 'S').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Inter', system-ui, sans-serif; }
        .sv-nav-link { display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:10px; font-size:14px; font-weight:500; color:rgba(255,255,255,0.72); margin-bottom:4px; transition:all 0.18s; cursor:pointer; text-decoration:none; }
        .sv-nav-link:hover { background:rgba(255,255,255,0.12); color:#fff; }
        .sv-nav-link.active { background:rgba(255,255,255,0.2); color:#fff; font-weight:700; box-shadow:0 2px 8px rgba(0,0,0,0.12); }
        .sv-sidebar { width:250px; min-height:100vh; background:${BRAND_GRADIENT}; color:#fff; display:flex; flex-direction:column; flex-shrink:0; position:sticky; top:0; height:100vh; overflow-y:auto; transition:transform 0.3s ease; }
        .sv-drawer { position:fixed; top:0; left:0; height:100%; width:280px; background:${BRAND_GRADIENT}; z-index:1001; display:flex; flex-direction:column; transform:translateX(-100%); transition:transform 0.3s cubic-bezier(.4,0,.2,1); box-shadow:4px 0 24px rgba(0,0,0,0.25); }
        .sv-drawer.open { transform:translateX(0); }
        .sv-backdrop { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:1000; opacity:0; transition:opacity 0.3s; }
        .sv-backdrop.open { display:block; opacity:1; }
        .sv-topbar { position:sticky; top:0; z-index:100; background:rgba(255,255,255,0.97); backdrop-filter:blur(12px); border-bottom:1px solid #e2e8f0; padding:0 20px; height:64px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
        .sv-hamburger { display:none; background:none; border:none; cursor:pointer; padding:8px; border-radius:8px; color:#374151; }
        .sv-logout-btn { display:flex; align-items:center; gap:8px; background:none; border:1.5px solid rgba(255,255,255,0.25); color:rgba(255,255,255,0.85); padding:10px 14px; border-radius:10px; cursor:pointer; font-size:13px; font-weight:600; width:100%; transition:all 0.18s; }
        .sv-logout-btn:hover { background:rgba(255,59,48,0.18); border-color:rgba(255,100,90,0.5); color:#ff6b6b; }
        .sv-avatar { width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg,${ACCENT},#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px; flex-shrink:0; }
        .sv-content { flex:1; padding:24px; overflow-y:auto; min-height:0; background:#f8fafc; }
        @media (max-width:767px) {
          .sv-sidebar { display:none !important; }
          .sv-hamburger { display:flex !important; align-items:center; justify-content:center; }
          .sv-content { padding:16px; }
        }
        @media (min-width:768px) {
          .sv-drawer { display:none !important; }
          .sv-backdrop { display:none !important; }
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>

        {/* ── Desktop Sidebar ── */}
        <aside className="sv-sidebar">
          <SidebarContent user={user} initials={initials} nav={NAV} onLogout={handleLogout} accent={ACCENT} />
        </aside>

        {/* ── Mobile Drawer ── */}
        <div className={`sv-backdrop ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
        <div className={`sv-drawer ${drawerOpen ? 'open' : ''}`}>
          <SidebarContent user={user} initials={initials} nav={NAV} onLogout={handleLogout} accent={ACCENT} onClose={() => setDrawerOpen(false)} />
        </div>

        {/* ── Main Content ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Topbar */}
          <header className="sv-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button className="sv-hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>Supervisor Portal</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>PhD Research Management</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right', display: isMobile ? 'none' : 'block' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{user?.name || 'Supervisor'}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{user?.email || ''}</div>
              </div>
              <div className="sv-avatar">{initials}</div>
              {/* Desktop logout in topbar */}
              <button onClick={handleLogout} title="Logout"
                style={{ display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', border: '1.5px solid #fecaca', color: '#dc2626', padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <LogoutIcon /> Logout
              </button>
            </div>
          </header>

          {/* Page Content */}
          <main className="sv-content">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}

function SidebarContent({ user, initials, nav, onLogout, accent, onClose }) {
  return (
    <>
      {/* Brand */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.2 }}>Supervisor Portal</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3 }}>PhD ERP · Periyar University</div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '6px 8px', lineHeight: 1 }}>✕</button>
        )}
      </div>

      {/* User Card */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{initials}</div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Supervisor'}</div>
          <div style={{ fontSize: 11, opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email || ''}</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, padding: '0 6px', marginBottom: 8 }}>Navigation</div>
        {nav.map(n => {
          // Hide restricted routes if not Approved
          const restricted = ['/profile', '/permission-applications'];
          if (restricted.includes(n.to) && user?.supervisor_status !== 'Approved') return null;
          
          return (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `sv-nav-link${isActive ? ' active' : ''}`}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '16px 16px 24px' }}>
        <button className="sv-logout-btn" onClick={onLogout}>
          <LogoutIcon /> Sign Out
        </button>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 12 }}>© 2025 Periyar University</div>
      </div>
    </>
  );
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
