import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Development: redirects /admin/* to the Admin Vite dev server (localhost:5174)
// Production:  this component is never reached — Nginx intercepts /admin/* before
//              portal-dashboard's index.html is served.
const ADMIN_ORIGIN = import.meta.env.VITE_ADMIN_FE_URL || 'http://localhost:5174';

export default function AdminRedirect() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    // Strip /admin prefix — in dev the admin app's base is '/', so its own
    // routes start at '/'.  e.g. /admin/applications → localhost:5174/applications
    const suffix = pathname.replace(/^\/admin/, '') || '/';
    window.location.replace(`${ADMIN_ORIGIN}${suffix}${search}${hash}`);
  }, []); // intentionally empty — run once, on mount

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#64748b',
        gap: 16,
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          border: '3px solid #e2e8f0',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
        }}
      />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
        Opening Admin Portal…
      </p>
      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
        You will be redirected automatically
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
