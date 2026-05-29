import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as Icons from 'lucide-react';
import { motion } from 'framer-motion';

const API = (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';

const DynamicIcon = ({ name, className, size = 24, style }) => {
  const IconComponent = Icons[name] || Icons.HelpCircle;
  return <IconComponent className={className} size={size} style={style} />;
};

export default function LandingPage() {
  const [portals, setPortals] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bgIndex, setBgIndex] = useState(0);

  const BG_IMAGES = [
    '/images/bg/1.png',
    '/images/bg/2.jpg',
    '/images/bg/3.jpg',
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setBgIndex(prev => (prev + 1) % BG_IMAGES.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // 1. Fetch University Settings dynamically
    axios.get(`${API}/settings?t=${Date.now()}`)
      .then(res => {
        if (res.data.success) {
          setSettings(res.data.data);
        }
      })
      .catch(err => console.error('Failed to load university settings:', err));

    // 2. Fetch Active Portals dynamically
    axios.get(`${API}/portals/active`)
      .then(res => {
        if (res.data.success) {
          setPortals(res.data.data || []);
        }
      })
      .catch(err => console.error('Failed to load active portals:', err))
      .finally(() => setLoading(false));
  }, []);

  const handlePortalNavigation = (portal) => {
    if (!portal.login_route) return;

    let route = portal.login_route;

    // Dynamically adapt localhost URLs in production to use the current live origin and subpaths
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      if (route.includes('localhost:5173') || route.includes(':5173')) {
        route = route.replace(/https?:\/\/[^\/]+:5173/, window.location.origin + '/student');
      } else if (route.includes('localhost:5174') || route.includes(':5174')) {
        route = route.replace(/https?:\/\/[^\/]+:5174/, window.location.origin + '/admin');
      } else if (route.includes('localhost:5175') || route.includes(':5175')) {
        route = route.replace(/https?:\/\/[^\/]+:5175/, window.location.origin + '/supervisor');
      } else if (route.includes('localhost:5176') || route.includes(':5176')) {
        route = route.replace(/https?:\/\/[^\/]+:5176/, window.location.origin + '/center');
      }
    }

    // Student portal → home page (smart auth detection happens there)
    if (portal.slug === 'student') {
      const studentBase = route.replace(/\/login$/, '').replace(/\/home$/, '');
      window.location.href = `${studentBase}/home`;
      return;
    }

    window.location.href = route;
  };

  const navLinks = [];
  if (settings && Number(settings.about_us_enabled) === 1) {
    navLinks.push({
      title: settings.about_us_title || 'About Us',
      link: settings.about_us_link,
      openMode: settings.about_us_open_mode || '_blank',
      order: settings.about_us_order === undefined ? 1 : settings.about_us_order,
      color: '#4FC3F7', // sky blue
      hoverColor: '#29B6F6',
      icon: 'Info'
    });
  }
  if (settings && Number(settings.policies_enabled) === 1) {
    navLinks.push({
      title: settings.policies_title || 'Policies',
      link: settings.policies_link,
      openMode: settings.policies_open_mode || '_blank',
      order: settings.policies_order === undefined ? 2 : settings.policies_order,
      color: '#26A69A', // teal
      hoverColor: '#00897B',
      icon: 'ShieldAlert'
    });
  }
  if (settings && Number(settings.contact_enabled) === 1) {
    navLinks.push({
      title: settings.contact_title || 'Contact',
      link: settings.contact_link,
      openMode: settings.contact_open_mode || '_self',
      order: settings.contact_order === undefined ? 3 : settings.contact_order,
      color: '#1E88E5', // royal blue
      hoverColor: '#1565C0',
      icon: 'PhoneCall'
    });
  }
  navLinks.sort((a, b) => a.order - b.order);

  const getLogoUrl = (path) => {
    if (!path) return 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?q=80&w=150&auto=format&fit=crop';
    if (path.startsWith('/uploads')) return (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + path;
    return path;
  };

  const getBannerUrl = (path) => {
    if (!path || path.startsWith('/images/portals/')) {
      if (path?.includes('student')) return 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=600&auto=format&fit=crop';
      if (path?.includes('supervisor')) return 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=600&auto=format&fit=crop';
      if (path?.includes('center')) return 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600&auto=format&fit=crop';
      return 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=600&auto=format&fit=crop';
    }
    if (path.startsWith('/uploads')) return (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + path;
    return path;
  };

  return (
    <div className="landing-dashboard" style={{
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      overflow: 'hidden'
    }}>
      {/* ── Slideshow Background ── */}
      {BG_IMAGES.map((src, idx) => (
        <div
          key={src}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            opacity: bgIndex === idx ? 0.9 : 0,
            transition: 'opacity 1s ease-in-out',
            zIndex: 0
          }}
        />
      ))}

      {/* ── Dark Premium Overlay ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        zIndex: 0
      }} />

            {/* ── Dynamic Premium University Header ── */}
      <header style={{
        background: 'linear-gradient(135deg, rgba(30, 60, 114, 0.85) 0%, rgba(42, 82, 152, 0.85) 100%)',
        backdropFilter: 'blur(10px)',
        color: '#ffffff',
        padding: '30px 20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        position: 'relative',
        overflow: 'hidden',
        zIndex: 1,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Subtle decorative glow overlay */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-20%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none'
        }} />

        <div className="container d-flex flex-column flex-md-row align-items-center justify-content-between gap-4" style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <a href="https://www.periyaruniversity.ac.in/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }} className="d-flex flex-column flex-md-row align-items-center text-center text-md-start gap-4 hover-opacity">
            <img
              src={getLogoUrl(settings?.logo)}
              alt="University Logo"
              style={{
                height: '95px',
                objectFit: 'contain',
                filter: 'drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.2))',
                backgroundColor: 'rgba(255,255,255,0.95)',
                padding: '8px',
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.2)'
              }}
            />
            <div>
              <h1 className="fw-bold mb-1" style={{ fontSize: '28px', letterSpacing: '0.5px', textShadow: '0px 2px 4px rgba(0,0,0,0.2)' }}>
                {settings?.university_name_english || 'PERIYAR UNIVERSITY'}
              </h1>
              {settings?.university_name_tamil && (
                <p className="mb-2" style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '18px', fontWeight: '500' }}>
                  {settings.university_name_tamil}
                </p>
              )}
              <div className="d-flex flex-wrap gap-2 justify-content-center justify-content-md-start align-items-center mt-1">
                <span className="badge text-white" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(4px)', padding: '6px 12px', fontSize: '12px', fontWeight: '500', borderRadius: '50px' }}>
                  {settings?.header_line2 || "State University - NAAC 'A++' GRADE"}
                </span>
                <span className="badge text-white" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(4px)', padding: '6px 12px', fontSize: '12px', fontWeight: '500', borderRadius: '50px' }}>
                  {settings?.header_line3 || 'Salem - 636011, Tamil Nadu, INDIA'}
                </span>
              </div>
            </div>
          </a>

          {/* Accreditation / NAAC Shield Block */}
          {settings?.logo2 && (
            <a href="https://www.periyaruniversity.ac.in/" target="_blank" rel="noopener noreferrer" style={{ cursor: 'pointer' }} className="d-none d-lg-block hover-opacity">
              <img
                src={getLogoUrl(settings.logo2)}
                alt="Thanthai Periyar"
                style={{
                  height: '80px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.15))'
                }}
              />
            </a>
          )}
        </div>

        {/* Dynamic Navigation Tabs Row below the branding row - Horizontal Stack */}
        {navLinks.length > 0 && (
          <div className="container mt-4 pt-3 border-top" style={{ maxWidth: '1200px', margin: '0 auto', borderTopColor: 'rgba(255, 255, 255, 0.15)', position: 'relative', zIndex: 10 }}>
            <div className="d-flex align-items-center gap-2 justify-content-center flex-wrap">
              {navLinks.map((tab, idx) => (
                <a
                  key={idx}
                  href={tab.link || '#'}
                  target={tab.openMode}
                  rel={tab.openMode === '_blank' ? 'noopener noreferrer' : undefined}
                  className="btn d-flex align-items-center gap-2 fw-semibold text-white transition-all shadow-sm"
                  style={{
                    backgroundColor: tab.color,
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 18px',
                    fontSize: '13.5px',
                    letterSpacing: '0.2px',
                    transition: 'all 0.2s ease',
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = tab.hoverColor;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = tab.color;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <DynamicIcon name={tab.icon} size={14} />
                  {tab.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── Main Dynamic Portal Grid Body ── */}
      <main className="container py-5 px-4" style={{ flex: '1 0 auto', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div className="text-center mb-5">
          <h2 className="fw-extrabold text-white mb-2" style={{ fontSize: '32px', letterSpacing: '-0.5px', fontWeight: '800', textShadow: '0px 2px 4px rgba(0,0,0,0.3)' }}>
            Ph.D. RESEARCH SECTION PORTAL
          </h2>
          <p className="mx-auto" style={{ maxWidth: '600px', fontSize: '15px', color: 'rgba(255, 255, 255, 0.85)' }}>
            Welcome to the Centralized Research Portal of {settings?.university_name_english || 'Periyar University'}. Please select your portal module below to authenticate and access your academic workload.
          </p>
          <div style={{ width: '60px', height: '4px', backgroundColor: '#38bdf8', margin: '20px auto 0', borderRadius: '10px' }} />
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="row g-4 justify-content-center">
            {[1, 2, 3].map(i => (
              <div key={i} className="col-12 col-md-6 col-lg-4">
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ minHeight: '400px', backgroundColor: '#ffffff' }}>
                  <div className="animate-pulse" style={{ height: '180px', backgroundColor: '#e9ecef' }} />
                  <div className="card-body p-4 d-flex flex-column gap-3">
                    <div className="animate-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e9ecef' }} />
                    <div className="animate-pulse" style={{ width: '60%', height: '24px', backgroundColor: '#e9ecef' }} />
                    <div className="animate-pulse" style={{ width: '100%', height: '60px', backgroundColor: '#e9ecef' }} />
                    <div className="animate-pulse mt-auto" style={{ width: '100%', height: '42px', borderRadius: '8px', backgroundColor: '#e9ecef' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Portal Dynamic Cards Layout */}
        {!loading && (
          <div className="row g-4 justify-content-center">
            {portals.map((portal, idx) => (
              <motion.div
                key={portal.id}
                className="col-12 col-md-6 col-lg-4 d-flex"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                <div
                  className="card border-0 shadow-sm rounded-4 overflow-hidden position-relative w-100 d-flex flex-column transition-all duration-300"
                  style={{
                    backgroundColor: '#ffffff',
                    borderTop: `5px solid ${portal.theme_color || '#008080'}`,
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                  }}
                >
                  {/* Card Content Area */}
                  <div className="card-body p-4 d-flex flex-column text-start" style={{ flex: '1 1 auto' }}>

                    <div className="d-flex align-items-center justify-content-between mb-4">
                      {/* Premium Themed Icon Container */}
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                        style={{
                          width: '50px',
                          height: '50px',
                          backgroundColor: `${portal.theme_color || '#008080'}15`,
                          border: `1.5px solid ${portal.theme_color || '#008080'}`,
                        }}
                      >
                        <DynamicIcon
                          name={portal.icon}
                          style={{ color: portal.theme_color || '#008080' }}
                          size={22}
                        />
                      </div>

                      {/* Active Status Badge */}
                      <span
                        className="px-2 py-1 rounded-3 small fw-bold"
                        style={{
                          backgroundColor: `${portal.theme_color || '#008080'}15`,
                          color: portal.theme_color || '#008080',
                          fontSize: '11px',
                          letterSpacing: '0.5px'
                        }}
                      >
                        Active
                      </span>
                    </div>

                    <h4 className="fw-bold mb-2 text-dark" style={{ fontSize: '20px', letterSpacing: '-0.3px', fontWeight: '700' }}>
                      {portal.name}
                    </h4>

                    <p className="text-muted small mb-4" style={{ lineHeight: '1.6', fontSize: '13.5px', minHeight: '65px' }}>
                      {portal.description || 'Access and manage operations relating to this portal.'}
                    </p>

                    {/* Dynamic Action Login Button */}
                    <button
                      onClick={() => handlePortalNavigation(portal)}
                      className="btn w-100 py-2 mt-auto d-flex align-items-center justify-content-center gap-2 fw-semibold text-white transition-all rounded-3"
                      style={{
                        backgroundColor: portal.theme_color || '#008080',
                        border: 'none',
                        boxShadow: `0 4px 10px rgba(0, 0, 0, 0.1)`,
                        fontSize: '14.5px'
                      }}
                    >
                      {portal.button_label || 'Login'}
                      <Icons.ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Fallback empty message */}
            {portals.length === 0 && (
              <div className="text-center p-5 card border-0 shadow-sm w-100 max-w-lg rounded-4">
                <Icons.Layers size={48} className="text-muted mx-auto mb-3 opacity-60" />
                <h5 className="fw-bold text-dark">No Active Portals Found</h5>
                <p className="text-muted small">Please contact system administrators to register portal cards.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer Branding details ── */}
      <footer className="py-4 mt-auto border-top text-center" style={{
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(10px)',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '13px',
        position: 'relative',
        zIndex: 1,
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div className="container">
          <div className="text-white opacity-75">© {new Date().getFullYear()} {settings?.university_name_english || 'Periyar University'}. All rights reserved.</div>
          <div className="text-white opacity-50 mt-1 small">Centralized Ph.D. Research Section Management | Standalone Portal Dashboard</div>
        </div>
      </footer>
    </div>
  );
}
