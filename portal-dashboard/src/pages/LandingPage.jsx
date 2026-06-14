import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import * as Icons from 'lucide-react';
import { motion } from 'framer-motion';
import NewsAnnouncementsBoard from '../../../shared/components/NewsAnnouncementsBoard';

const API = (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';

// ── Announcement Display Components ───────────────────────────────────────────

function AnnouncementTicker({ items }) {
  if (!items.length) return null;
  const text = items.map(a => `📢 ${a.title}`).join('   ·   ');
  const first = items[0];
  const speed = first.ticker_speed || 50;
  const dur = Math.max(8, text.length * (100 / speed));
  const animDir = first.ticker_direction === 'left' ? 'tickerLTR' : 'tickerRTL';

  return (
    <div style={{
      background: first.bg_color || '#1e3a5f',
      color: first.text_color || '#fff',
      borderTop: `2px solid ${first.border_color || '#2a52b4'}`,
      borderBottom: `2px solid ${first.border_color || '#2a52b4'}`,
      padding: '8px 0', overflow: 'hidden', position: 'relative', zIndex: 2,
    }}>
      <div style={{
        display: 'inline-block', whiteSpace: 'nowrap',
        animation: `${animDir} ${dur}s linear infinite`,
        paddingLeft: '100%', fontSize: 13, fontWeight: 500,
      }}>
        {text}&nbsp;&nbsp;&nbsp;{text}
      </div>
    </div>
  );
}

function AnnouncementStaticBar({ items }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(a => (
        <div key={a.id} style={{
          background: a.bg_color || '#1e3a5f',
          color: a.text_color || '#fff',
          border: `1px solid ${a.border_color || '#2a52b4'}`,
          padding: '10px 20px', fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Icons.Megaphone size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{a.title}</span>
          {a.attachment_path && (
            <a href={`${API.replace('/api', '')}${a.attachment_path}`} target="_blank" rel="noopener noreferrer"
              style={{ color: a.highlight_color || '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icons.Paperclip size={12} /> Attachment
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function AnnouncementAlert({ items }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(a => (
        <div key={a.id} style={{
          background: a.highlight_color || '#f59e0b',
          color: a.text_color || '#1e293b',
          border: `2px solid ${a.border_color || '#d97706'}`,
          borderRadius: 8, padding: '10px 16px',
          display: 'flex', alignItems: 'flex-start', gap: 10, fontWeight: 600, fontSize: 13,
        }}>
          <Icons.AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div>{a.title}</div>
            {a.content && <div style={{ fontWeight: 400, fontSize: 12, marginTop: 3, opacity: 0.85 }}>{a.content}</div>}
          </div>
          {a.attachment_path && (
            <a href={`${API.replace('/api', '')}${a.attachment_path}`} target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: 'auto', color: a.text_color || '#1e293b', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <Icons.Paperclip size={11} /> View
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function AnnouncementCards({ items }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {items.map(a => (
        <div key={a.id} style={{
          background: '#fff', borderRadius: 10, overflow: 'hidden',
          border: `1px solid ${a.border_color || '#2a52b4'}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <div style={{ background: a.bg_color || '#1e3a5f', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Megaphone size={14} color={a.text_color || '#fff'} />
            <span style={{ color: a.text_color || '#fff', fontSize: 12, fontWeight: 600, flex: 1 }}>{a.category_name}</span>
            <span style={{ background: a.highlight_color || '#f59e0b', color: '#1e293b', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
              {a.priority?.toUpperCase()}
            </span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 6 }}>{a.title}</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{a.content}</div>
            {a.attachment_path && (
              <a href={`${API.replace('/api', '')}${a.attachment_path}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 12, color: '#2563eb', fontWeight: 500 }}>
                <Icons.Paperclip size={12} /> {a.attachment_name || 'Download Attachment'}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AnnouncementPopup({ items, onClose }) {
  const item = items[0];
  if (!item) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{
        background: '#fff', borderRadius: 14, maxWidth: 520, width: '100%',
        border: `3px solid ${item.border_color || '#2a52b4'}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        <div style={{ background: item.bg_color || '#1e3a5f', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: item.text_color || '#fff' }}>
            <Icons.Megaphone size={18} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>{item.category_name}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: item.text_color || '#fff', cursor: 'pointer', padding: 4 }}>
            <Icons.X size={18} />
          </button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{item.title}</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{item.content}</p>
          {item.attachment_path && (
            <a href={`${API.replace('/api', '')}${item.attachment_path}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '8px 14px', borderRadius: 8, background: item.bg_color || '#1e3a5f', color: item.text_color || '#fff', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
              <Icons.Paperclip size={14} /> Download Attachment
            </a>
          )}
        </div>
        <div style={{ padding: '12px 24px 16px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9' }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: item.bg_color || '#1e3a5f', color: item.text_color || '#fff',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>Close</button>
        </div>
      </motion.div>
    </div>
  );
}

// Renders announcements for a given position slot
function AnnouncementSlot({ announcements, position, onClosePopup }) {
  const filtered = announcements.filter(a => a.position === position);
  if (!filtered.length) return null;

  const byMode = (mode) => filtered.filter(a => a.display_mode === mode);

  return (
    <div style={{ width: '100%', position: 'relative', zIndex: 2 }}>
      {byMode('ticker').length  > 0 && <AnnouncementTicker items={byMode('ticker')} />}
      {byMode('alert').length   > 0 && (
        <div style={{ padding: '8px 20px' }}><AnnouncementAlert items={byMode('alert')} /></div>
      )}
      {byMode('static').length  > 0 && <AnnouncementStaticBar items={byMode('static')} />}
      {byMode('card').length    > 0 && (
        <div style={{ padding: '12px 20px' }}><AnnouncementCards items={byMode('card')} /></div>
      )}
    </div>
  );
}

const DynamicIcon = ({ name, className, size = 24, style }) => {
  const IconComponent = Icons[name] || Icons.HelpCircle;
  return <IconComponent className={className} size={size} style={style} />;
};

const POPUP_STORAGE_KEY = 'ann_popup_closed';

export default function LandingPage() {
  const [portals, setPortals] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bgIndex, setBgIndex] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [popupDismissed, setPopupDismissed] = useState(false);

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
      .then(res => { if (res.data.success) setSettings(res.data.data); })
      .catch(err => console.error('Failed to load university settings:', err));

    // 2. Fetch Active Portals dynamically
    axios.get(`${API}/portals/active`)
      .then(res => { if (res.data.success) setPortals(res.data.data || []); })
      .catch(err => console.error('Failed to load active portals:', err))
      .finally(() => setLoading(false));

    // 3. Fetch active announcements (public endpoint — served from student API)
    axios.get(`${API}/announcements/public`)
      .then(res => { if (res.data.success) setAnnouncements(res.data.data || []); })
      .catch(() => {});
  }, []);

  // Determine whether popup should show
  const popupItems = announcements.filter(a => a.display_mode === 'popup');
  const showPopup = popupItems.length > 0 && !popupDismissed;

  const handleClosePopup = useCallback(() => {
    setPopupDismissed(true);
    const first = popupItems[0];
    if (first?.popup_reappear && first?.popup_delay_mins) {
      const reappearAt = Date.now() + first.popup_delay_mins * 60 * 1000;
      sessionStorage.setItem(POPUP_STORAGE_KEY, String(reappearAt));
    }
  }, [popupItems]);

  const handlePortalNavigation = (portal) => {
    if (!portal.login_route) return;

    let route = portal.login_route;

    // Student portal → home page (smart auth detection happens there)
    if (portal.slug === 'student') {
      const studentBase = route.replace(/\/login$/, '').replace(/\/home$/, '');
      window.location.href = `${studentBase}/home`;
      return;
    }

    window.location.href = route;
  };

  const handleAnnouncementDetailsClick = (item) => {
    // 1. If audience is portal-specific (student, supervisor, centre), redirect to that portal!
    if (item.audience && item.audience !== 'all') {
      const portal = portals.find(p => p.slug === item.audience);
      if (portal) {
        handlePortalNavigation(portal);
        return true; // handled redirect
      }
    }
    
    // 2. Generically go to student home portal for any admission or application announcements
    const titleL = (item.title || '').toLowerCase();
    const descL  = (item.description || '').toLowerCase();
    const isAdmission = titleL.includes('admission') || descL.includes('admission') ||
                        titleL.includes('apply') || descL.includes('apply') ||
                        titleL.includes('application') || descL.includes('application') ||
                        titleL.includes('counselling') || descL.includes('counselling') ||
                        titleL.includes('hall ticket') || descL.includes('hall ticket') ||
                        item.category === 'circular' || item.category === 'announcement';
                        
    if (isAdmission) {
      const studentPortal = portals.find(p => p.slug === 'student');
      if (studentPortal) {
        handlePortalNavigation(studentPortal);
        return true; // handled redirect
      }
    }

    return false; // let board display details modal for generic announcements
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

            {/* ── Top Header Announcements (above everything) ── */}
      <AnnouncementSlot announcements={announcements} position="top-header" />

      {/* ── Popup Announcement ── */}
      {showPopup && <AnnouncementPopup items={popupItems} onClose={handleClosePopup} />}

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

      {/* ── Below-Header Announcements ── */}
      <AnnouncementSlot announcements={announcements} position="below-header" />

      {/* ── Main Dynamic Portal Grid Body ── */}
      <main className="container py-5 px-4" style={{ flex: '1 0 auto', maxWidth: '1300px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Above Portal Cards Announcements (old ticker/static system) */}
        <AnnouncementSlot announcements={announcements} position="above-portals" />

        {/* Heading */}
        <div className="text-center mb-4">
          <h2 className="fw-extrabold text-white mb-2" style={{ fontSize: '30px', letterSpacing: '-0.5px', fontWeight: '800', textShadow: '0px 2px 4px rgba(0,0,0,0.3)' }}>
            Ph.D. RESEARCH SECTION PORTAL
          </h2>
          <p className="mx-auto" style={{ maxWidth: '600px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)' }}>
            Welcome to the Centralized Research Portal of {settings?.university_name_english || 'Periyar University'}. Please select your portal module below to authenticate and access your academic workload.
          </p>
          <div style={{ width: '60px', height: '4px', backgroundColor: '#38bdf8', margin: '16px auto 0', borderRadius: '10px' }} />
        </div>

        {/* sleeker, compact horizontal News & Announcements Board placed above portals cards */}
        <NewsAnnouncementsBoard
          apiBase={API}
          accentColor="#1565C0"
          layout="horizontal"
          onViewDetails={handleAnnouncementDetailsClick}
        />

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
                  <div className="card-body p-4 d-flex flex-column text-start" style={{ flex: '1 1 auto' }}>
                    <div className="d-flex align-items-center justify-content-between mb-4">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                        style={{
                          width: '50px', height: '50px',
                          backgroundColor: `${portal.theme_color || '#008080'}15`,
                          border: `1.5px solid ${portal.theme_color || '#008080'}`,
                        }}
                      >
                        <DynamicIcon name={portal.icon} style={{ color: portal.theme_color || '#008080' }} size={22} />
                      </div>
                      <span className="px-2 py-1 rounded-3 small fw-bold"
                        style={{ backgroundColor: `${portal.theme_color || '#008080'}15`, color: portal.theme_color || '#008080', fontSize: '11px', letterSpacing: '0.5px' }}>
                        Active
                      </span>
                    </div>
                    <h4 className="fw-bold mb-2 text-dark" style={{ fontSize: '20px', letterSpacing: '-0.3px', fontWeight: '700' }}>
                      {portal.name}
                    </h4>
                    <p className="text-muted small mb-4" style={{ lineHeight: '1.6', fontSize: '13.5px', minHeight: '65px' }}>
                      {portal.description || 'Access and manage operations relating to this portal.'}
                    </p>
                    <button
                      onClick={() => handlePortalNavigation(portal)}
                      className="btn w-100 py-2 mt-auto d-flex align-items-center justify-content-center gap-2 fw-semibold text-white transition-all rounded-3"
                      style={{ backgroundColor: portal.theme_color || '#008080', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '14.5px' }}
                    >
                      {portal.button_label || 'Login'}
                      <Icons.ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
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

      {/* ── Below Portal Cards Announcements ── */}
      <AnnouncementSlot announcements={announcements} position="below-portals" />

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

      {/* ── Footer Announcements ── */}
      <AnnouncementSlot announcements={announcements} position="footer" />

      {/* ── Ticker / keyframe CSS ── */}
      <style>{`
        @keyframes tickerRTL {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes tickerLTR {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
