/**
 * NewsAnnouncementsBoard
 * Vertical auto-scrolling announcement board for PhD portal dashboards.
 * Props:
 *   apiBase      — base API URL e.g. "http://localhost:5000/api"
 *   accentColor  — theme accent hex (default #1e3a5f)
 *   compact      — boolean, renders a slim right-panel version (no filters, smaller rows)
 *   scrollHeight — override scroll area height in px (default 380 full / 420 compact)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Constants ──────────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = {
  news: { icon: '📰', label: 'News', color: '#0369a1', bg: '#e0f2fe' },
  announcement: { icon: '📢', label: 'Announcement', color: '#7c3aed', bg: '#ede9fe' },
  circular: { icon: '📋', label: 'Circular', color: '#0f766e', bg: '#ccfbf1' },
  alert: { icon: '🚨', label: 'Alert', color: '#dc2626', bg: '#fee2e2' },
  deadline: { icon: '⏰', label: 'Deadline', color: '#d97706', bg: '#fef3c7' },
  event: { icon: '🎓', label: 'Event', color: '#059669', bg: '#d1fae5' },
};

const PRIORITIES = {
  urgent: { label: 'Urgent', dot: '#ef4444', text: '#dc2626' },
  high: { label: 'High', dot: '#f59e0b', text: '#d97706' },
  medium: { label: 'Medium', dot: '#3b82f6', text: '#2563eb' },
  low: { label: 'Low', dot: '#10b981', text: '#059669' },
};

const PRI_KEYS = ['urgent', 'high', 'medium', 'low'];

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return fmtDate(d);
}

// ── Detail Modal ───────────────────────────────────────────────────────────────
function DetailModal({ item, filesBase, onClose, categories }) {
  const cats = categories || DEFAULT_CATEGORIES;
  const cat = cats[item.category] || cats.announcement;
  const pri = PRIORITIES[item.priority] || PRIORITIES.medium;

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: 16, fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden',
        animation: 'annFadeIn 0.2s ease-out',
      }}>
        <div style={{ background: cat.color, padding: '18px 22px', position: 'relative' }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.2)',
            border: 'none', color: '#fff', borderRadius: 8, width: 28, height: 28,
            cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
          <div style={{ fontSize: 28, marginBottom: 4 }}>{cat.icon}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2 }}>{cat.label}</div>
          <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: '4px 0 0', lineHeight: 1.35, paddingRight: 32 }}>
            {item.is_pinned ? '📌 ' : ''}{item.title}
          </h2>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: pri.dot, marginRight: 4 }} />
              {pri.label}
            </span>
            <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 10 }}>
              📅 Expires {fmtDate(item.expiry_date)}
            </span>
          </div>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{item.description}</p>
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, display: 'flex', gap: 20 }}>
            <div><div style={{ fontSize: 10, color: '#9ca3af' }}>Published</div><div style={{ fontSize: 12, fontWeight: 600 }}>{fmtDate(item.publish_date)}</div></div>
            <div><div style={{ fontSize: 10, color: '#9ca3af' }}>Expires</div><div style={{ fontSize: 12, fontWeight: 600 }}>{fmtDate(item.expiry_date)}</div></div>
          </div>
          {item.attachment_path && (
            <a href={`${filesBase}${item.attachment_path}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '9px 16px', borderRadius: 8, background: cat.color, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              📎 Download Attachment
            </a>
          )}
          <div style={{ marginTop: 14, textAlign: 'right' }}>
            <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Board ─────────────────────────────────────────────────────────────────
export default function NewsAnnouncementsBoard({ apiBase, accentColor = '#1e3a5f', compact = false, scrollHeight, layout = 'vertical', onViewDetails }) {
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('all');
  const [filterPri, setFilterPri] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [paused, setPaused] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);

  const handleItemClick = (item) => {
    if (typeof onViewDetails === 'function') {
      const handled = onViewDetails(item);
      if (handled) return;
    }
    setDetail(item);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollRef = useRef(null);
  const animRef = useRef(null);
  const lastTime = useRef(null);
  const SPEED = compact ? 35 : 40;

  const boardH = scrollHeight || (compact ? 420 : 380);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchCategories = useCallback(() => {
    fetch(`${apiBase}/news-announcements/categories`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const newCats = {};
          d.data.forEach(c => {
            newCats[c.category_key] = {
              icon: c.icon || '📢',
              label: c.label,
              color: c.color || '#7c3aed',
              bg: c.bg || '#ede9fe'
            };
          });
          setCategories(prev => ({ ...prev, ...newCats }));
        }
      })
      .catch(() => { });
  }, [apiBase]);

  const fetchData = useCallback(() => {
    fetch(`${apiBase}/news-announcements`)
      .then(r => r.json())
      .then(d => { if (d.success) setItems(d.data || []); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [apiBase]);

  useEffect(() => {
    fetchCategories();
    fetchData();
    const id = setInterval(() => {
      fetchCategories();
      fetchData();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchCategories, fetchData]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let list = [...items];
    if (filterCat !== 'all') list = list.filter(i => i.category === filterCat);
    if (filterPri !== 'all') list = list.filter(i => i.priority === filterPri);
    if (search.trim()) list = list.filter(i =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(list);
    setScrollY(0);
    lastTime.current = null;
  }, [items, filterCat, filterPri, search]);

  // ── Smooth scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || filtered.length === 0) return;
    const contentH = el.scrollHeight / 2;
    const step = (ts) => {
      if (!paused) {
        if (lastTime.current === null) lastTime.current = ts;
        const delta = ts - lastTime.current;
        lastTime.current = ts;
        setScrollY(prev => {
          const next = prev + (SPEED * delta) / 1000;
          return next >= contentH ? 0 : next;
        });
      } else {
        lastTime.current = null;
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [filtered, paused, SPEED, isMobile]);

  // ── Full-size row ──────────────────────────────────────────────────────────
  const FullRow = ({ item }) => {
    const cat = categories[item.category] || categories.announcement;
    const pri = PRIORITIES[item.priority] || PRIORITIES.medium;
    return (
      <div onClick={() => handleItemClick(item)}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#fff', border: '1px solid #f1f5f9', borderLeft: `4px solid ${pri.dot}`, cursor: 'pointer', marginBottom: 8, transition: 'box-shadow 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.09)'; e.currentTarget.style.borderColor = cat.color; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#f1f5f9'; }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 9, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' }}>
            {item.is_pinned && <span style={{ fontSize: 9 }}>📌</span>}
            <span style={{ background: cat.bg, color: cat.color, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 7 }}>{cat.label}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 700, color: pri.text }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: pri.dot, display: 'inline-block' }} />{pri.label}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{timeAgo(item.publish_date)} · Exp {fmtDate(item.expiry_date)}</div>
        </div>
        {item.attachment_path && <span style={{ fontSize: 12, flexShrink: 0 }} title="Attachment">📎</span>}
      </div>
    );
  };

  // ── Compact row ────────────────────────────────────────────────────────────
  const CompactRow = ({ item }) => {
    const cat = categories[item.category] || categories.announcement;
    const pri = PRIORITIES[item.priority] || PRIORITIES.medium;
    return (
      <div onClick={() => handleItemClick(item)}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.92)', borderLeft: `3px solid ${pri.dot}`, cursor: 'pointer', marginBottom: 6, backdropFilter: 'blur(4px)', transition: 'background 0.15s, box-shadow 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.10)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        {/* Category icon bubble */}
        <div style={{ width: 28, height: 28, borderRadius: 7, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{cat.icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            {item.is_pinned && <span style={{ fontSize: 9 }}>📌</span>}
            <span style={{ fontSize: 9, fontWeight: 700, color: pri.text, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: pri.dot, display: 'inline-block' }} />
              {pri.label}
            </span>
            <span style={{ background: cat.bg, color: cat.color, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6 }}>{cat.label}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{item.title}</div>
          <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {timeAgo(item.publish_date)}
            {item.attachment_path ? ' · 📎' : ''}
          </div>
        </div>
      </div>
    );
  };

  const filesBase = apiBase.replace('/api', '');
  const Row = compact ? CompactRow : FullRow;

  // ── HORIZONTAL COMPACT LAYOUT ──────────────────────────────────────────────
  if (layout === 'horizontal') {
    const uniBlue = '#1565C0';
    const linkRed = '#CC0000';
    const boardH = 90; // highly compact space-saver

    return (
      <div style={{
        fontFamily: "'Arial', sans-serif",
        background: '#ffffff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        width: '100%',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'stretch',
        marginBottom: '28px',
      }}>
        {/* Left branding block */}
        <div style={{
          background: uniBlue,
          color: '#ffffff',
          padding: isMobile ? '8px 16px' : '16px 20px',
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          justifyContent: isMobile ? 'space-between' : 'center',
          alignItems: 'center',
          textAlign: 'center',
          flexShrink: 0,
          width: isMobile ? '100%' : '180px',
          borderRight: isMobile ? 'none' : '1px solid rgba(0,0,0,0.1)',
          borderBottom: isMobile ? '1px solid rgba(0,0,0,0.1)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: isMobile ? '18px' : '24px' }}>📢</span>
            <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 'bold', letterSpacing: '0.5px' }}>ANNOUNCEMENTS</span>
          </div>
          <span
            onClick={() => setShowAllAnnouncements(true)}
            style={{ fontSize: '11px', color: '#ffeb3b', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
          >
            View All
          </span>
        </div>

        {/* Right scrolling area */}
        <div
          className="announcements-container"
          style={{
            flex: 1,
            position: 'relative',
            height: isMobile ? '280px' : boardH,
            overflow: 'hidden',
            background: '#ffffff',
            padding: '2px 16px'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%' }}>
              <div style={{ width: 16, height: 16, border: `2px solid #ddd`, borderTopColor: uniBlue, borderRadius: '50%', animation: 'annSpin 0.8s linear infinite' }} />
              <span style={{ fontSize: '12px', color: '#999' }}>Loading Announcements...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <span style={{ fontSize: '13px', color: '#999' }}>No announcements available at this time.</span>
            </div>
          ) : (
            <div
              ref={scrollRef}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              style={{
                transform: `translateY(-${scrollY}px)`,
                willChange: 'transform'
              }}
            >
              {(isMobile ? [...filtered.slice(0, 5), ...filtered.slice(0, 5)] : [...filtered, ...filtered]).map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="announcement-item"
                  style={{
                    height: isMobile ? 'auto' : '45px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #f0f0f0',
                    padding: isMobile ? '10px' : '4px 0',
                    boxSizing: 'border-box',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: '11px',
                      background: '#e3f2fd',
                      color: uniBlue,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      flexShrink: 0,
                    }}>
                      {new Date(item.publish_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                    <span
                      className="announcement-title"
                      style={{
                        fontSize: isMobile ? '13px' : '13.5px',
                        fontWeight: '600',
                        color: '#333333',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleItemClick(item)}
                    >
                      {item.title}
                    </span>
                  </div>
                  <span
                    onClick={() => handleItemClick(item)}
                    style={{
                      color: linkRed,
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      flexShrink: 0,
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                  >
                    View Details &rarr;
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {detail && <DetailModal item={detail} filesBase={filesBase} onClose={() => setDetail(null)} categories={categories} />}
        {showAllAnnouncements && <ViewAllModal items={items} CATEGORIES={categories} onClose={() => setShowAllAnnouncements(false)} onOpenDetail={handleItemClick} />}
        <style>{`
          @keyframes annSpin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes annFadeIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
          @media (max-width: 768px) {
            .announcements-container {
              max-height: 280px !important;
              overflow-y: auto !important;
            }
            .announcement-item {
              padding: 10px !important;
              font-size: 13px !important;
            }
            .announcement-title {
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // ── COMPACT LAYOUT — University classic style ──────────────────────────────
  if (compact) {
    // Format date as "DD MMM YYYY"
    const fmtPosted = (d) => {
      if (!d) return '';
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };

    // University blue
    const uniBlue = '#1565C0';
    const linkRed = '#CC0000';

    return (
      <div style={{
        fontFamily: "'Times New Roman', Georgia, serif",
        background: '#ffffff',
        border: '1px solid #c8c8c8',
        boxShadow: '2px 2px 6px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        width: '100%',
      }}>

        {/* ── Blue Header ── */}
        <div style={{
          background: uniBlue,
          padding: '10px 12px',
          textAlign: 'center',
        }}>
          <div style={{
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '14px',
            letterSpacing: '0.3px',
            fontFamily: "'Arial', 'Helvetica', sans-serif",
          }}>
            News and Announcements
          </div>
        </div>

        {/* ── Top "View Details" link (latest item shortcut) ── */}
        {!loading && filtered.length > 0 && (
          <div style={{ padding: '5px 10px', borderBottom: '1px solid #e5e5e5' }}>
            <span
              onClick={() => setDetail(filtered[0])}
              style={{ color: linkRed, fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: "'Arial', sans-serif", textDecoration: 'none' }}
            >
              View Details
            </span>
          </div>
        )}

        {/* ── Scrolling content area ── */}
        <div style={{ position: 'relative', height: boardH, overflow: 'hidden', background: '#ffffff' }}>

          {/* Fade at bottom only */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, background: 'linear-gradient(transparent, #ffffff)', zIndex: 2, pointerEvents: 'none' }} />

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 20, height: 20, border: `2px solid #ddd`, borderTopColor: uniBlue, borderRadius: '50%', animation: 'annSpin 0.8s linear infinite' }} />
              <span style={{ fontSize: 11, color: '#999', fontFamily: 'Arial, sans-serif' }}>Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#999', fontFamily: 'Arial, sans-serif' }}>No announcements available.</div>
            </div>
          ) : (
            <div
              ref={scrollRef}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              style={{ transform: `translateY(-${scrollY}px)`, willChange: 'transform' }}
            >
              {[...filtered, ...filtered].map((item, idx) => (
                <div key={`${item.id}-${idx}`} style={{ borderBottom: '1px solid #e0e0e0', padding: '8px 10px 10px' }}>
                  {/* Posted on date */}
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '13px',
                    color: '#111111',
                    marginBottom: '4px',
                    fontFamily: "'Arial', sans-serif",
                  }}>
                    Posted on {fmtPosted(item.publish_date)}
                  </div>
                  {/* Description text */}
                  <div style={{
                    fontSize: '13px',
                    color: '#222222',
                    lineHeight: '1.55',
                    textAlign: 'justify',
                    marginBottom: '5px',
                    fontFamily: "'Times New Roman', Georgia, serif",
                    wordBreak: 'break-word',
                  }}>
                    {item.title}
                    {item.description && item.description !== item.title && (
                      <span style={{ color: '#444' }}> — {item.description.length > 80 ? item.description.slice(0, 80) + '…' : item.description}</span>
                    )}
                  </div>
                  {/* View Details link */}
                  <div>
                    <span
                      onClick={() => handleItemClick(item)}
                      style={{
                        color: linkRed,
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontFamily: "'Arial', sans-serif",
                        textDecoration: 'none',
                      }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      View Details
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── View All footer ── */}
        <div style={{
          borderTop: '1px solid #e0e0e0',
          padding: '6px 10px',
          textAlign: 'right',
          background: '#ffffff',
        }}>
          <span
            onClick={() => setShowAllAnnouncements(true)}
            style={{
              color: linkRed,
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: "'Arial', sans-serif",
            }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            View All
          </span>
        </div>

        {detail && <DetailModal item={detail} filesBase={filesBase} onClose={() => setDetail(null)} categories={categories} />}
        {showAllAnnouncements && <ViewAllModal items={items} CATEGORIES={categories} onClose={() => setShowAllAnnouncements(false)} onOpenDetail={handleItemClick} />}
        <style>{`
          @keyframes annSpin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes annFadeIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        `}</style>
      </div>
    );
  }

  // ── FULL LAYOUT ────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", background: '#fff', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📢</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>News & Announcements</div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{filtered.length} active · auto-refreshes every 5 min</div>
            </div>
          </div>
          {filtered.length > 0 && (
            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 160px' }}>
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af' }}>🔍</span>
          <input style={{ width: '100%', padding: '5px 8px 5px 26px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
            placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' }}
          value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {Object.keys(categories).map(k => <option key={k} value={k}>{CATEGORIES[k]?.icon || '📢'} {CATEGORIES[k]?.label || k}</option>)}
        </select>
        <select style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' }}
          value={filterPri} onChange={e => setFilterPri(e.target.value)}>
          <option value="all">All Priorities</option>
          {PRI_KEYS.map(k => <option key={k} value={k}>{PRIORITIES[k].label}</option>)}
        </select>
      </div>

      {/* Scrolling board */}
      <div style={{ position: 'relative', height: boardH, overflow: 'hidden', background: '#f8fafc' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 32, background: 'linear-gradient(#f8fafc, transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, background: 'linear-gradient(transparent, #f8fafc)', zIndex: 2, pointerEvents: 'none' }} />
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 30, height: 30, border: `3px solid ${accentColor}33`, borderTopColor: accentColor, borderRadius: '50%', animation: 'annSpin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Loading announcements…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 36 }}>📭</div>
            <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>No announcements available</div>
            <div style={{ fontSize: 11, color: '#d1d5db' }}>Check back later for updates.</div>
          </div>
        ) : (
          <div ref={scrollRef} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
            style={{ padding: '12px 14px 0', transform: `translateY(-${scrollY}px)`, willChange: 'transform' }}>
            {[...filtered, ...filtered].map((item, idx) => (
              <Row key={`${item.id}-${idx}`} item={item} />
            ))}
          </div>
        )}
        {paused && filtered.length > 0 && (
          <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 3, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, pointerEvents: 'none' }}>⏸ PAUSED</div>
        )}
      </div>

      {/* Legend */}
      <div style={{ padding: '8px 14px', background: '#fff', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>PRIORITY:</span>
        {PRI_KEYS.map(k => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: PRIORITIES[k].text }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITIES[k].dot, display: 'inline-block' }} />{PRIORITIES[k].label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#d1d5db' }}>Hover to pause · Click to view</span>
      </div>

      {detail && <DetailModal item={detail} filesBase={filesBase} onClose={() => setDetail(null)} categories={categories} />}
      {showAllAnnouncements && <ViewAllModal items={items} CATEGORIES={categories} onClose={() => setShowAllAnnouncements(false)} onOpenDetail={handleItemClick} />}
      <style>{`
        @keyframes annSpin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes annFadeIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

// ── View All Modal ─────────────────────────────────────────────────────────────
function ViewAllModal({ items, CATEGORIES, onClose, onOpenDetail }) {
  // Generate the active tabs list EXACTLY from dynamic CATEGORIES keys
  const allTabs = Object.keys(CATEGORIES).map(k => ({
    id: k,
    label: CATEGORIES[k]?.label || k,
  }));

  // Reorder: 'announcement' first, 'news' second, then others alphabetically
  allTabs.sort((a, b) => {
    const order = { announcement: 1, news: 2 };
    const valA = order[a.id] || 999;
    const valB = order[b.id] || 999;
    if (valA !== valB) return valA - valB;
    return a.label.localeCompare(b.label);
  });

  const [activeTab, setActiveTab] = useState(() => {
    const keys = Object.keys(CATEGORIES);
    keys.sort((a, b) => {
      const order = { announcement: 1, news: 2 };
      const valA = order[a] || 999;
      const valB = order[b] || 999;
      if (valA !== valB) return valA - valB;
      return a.localeCompare(b);
    });
    return keys[0] || '';
  });

  const tabItems = activeTab ? items.filter(item => item.category === activeTab) : [];

  const getCalendarParts = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { day: '--', monthYear: '--/----' };
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return { day, monthYear: `${month}/${year}` };
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: 16, fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '8px', maxWidth: '840px', width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', maxHeight: '85vh',
        animation: 'annFadeIn 0.2s ease-out', border: '1px solid #c8c8c8'
      }}>
        {/* Modal Header */}
        <div style={{ background: '#1565C0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold', margin: 0, fontFamily: 'Arial, sans-serif', letterSpacing: '0.3px' }}>
            Circulars & Announcements Board
          </h2>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%',
            width: 26, height: 26, cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
          }}>×</button>
        </div>

        {/* Tab Selector Bar */}
        <div style={{
          display: 'flex', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #e0e0e0',
          overflowX: 'auto', background: '#ffffff', whiteSpace: 'nowrap'
        }}>
          {allTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: isActive ? '#007BFF' : '#ffffff',
                  color: isActive ? '#ffffff' : '#9E1B1B',
                  border: isActive ? '1px solid #007BFF' : '1.5px solid #d4af37',
                  padding: '7px 15px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  fontFamily: 'Arial, sans-serif',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Announcements List Container */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#ffffff' }}>
          {tabItems.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#718096' }}>
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📭</span>
              <span style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'Arial, sans-serif' }}>No announcements listed under this category.</span>
            </div>
          ) : (
            tabItems.map(item => {
              const { day, monthYear } = getCalendarParts(item.publish_date);
              return (
                <div key={item.id} style={{
                  display: 'flex', gap: '16px', alignItems: 'flex-start',
                  borderBottom: '1px dashed #cccccc', paddingBottom: '16px', marginBottom: '16px'
                }}>
                  {/* Calendar Date Badge */}
                  <div style={{
                    width: '68px', borderRadius: '6px', overflow: 'hidden',
                    border: '1px solid #c8c8c8', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
                  }}>
                    <div style={{
                      background: '#E53935', color: '#ffffff', fontSize: '9px',
                      fontWeight: 'bold', padding: '3px 0', textAlign: 'center',
                      textTransform: 'uppercase', borderBottom: '1px solid #e0e0e0',
                      fontFamily: 'Arial, sans-serif'
                    }}>
                      Posted on
                    </div>
                    <div style={{
                      background: '#ffffff', padding: '6px 0 8px', textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '22px', fontWeight: '800', color: '#111111',
                        lineHeight: '1.1', fontFamily: "'Arial', sans-serif"
                      }}>
                        {day}
                      </div>
                      <div style={{
                        fontSize: '10px', fontWeight: 'bold', color: '#555555',
                        marginTop: '2px', fontFamily: "'Courier New', Courier, monospace"
                      }}>
                        {monthYear}
                      </div>
                    </div>
                  </div>

                  {/* Title & View Details Area */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      onClick={() => onOpenDetail(item)}
                      style={{
                        margin: '0 0 6px', fontSize: '14.5px', fontWeight: 'bold',
                        color: '#002F6C', lineHeight: '1.45', cursor: 'pointer',
                        fontFamily: "'Arial', sans-serif", textDecoration: 'none'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#CC0000'}
                      onMouseLeave={e => e.currentTarget.style.color = '#002F6C'}
                    >
                      {item.title}
                    </h3>
                    <button
                      onClick={() => onOpenDetail(item)}
                      style={{
                        background: '#005A60', color: '#ffffff', border: 'none',
                        padding: '5px 12px', borderRadius: '4px', fontSize: '11.5px',
                        fontWeight: 'bold', cursor: 'pointer', marginTop: '6px',
                        fontFamily: "'Arial', sans-serif", display: 'inline-flex', alignItems: 'center'
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #e0e0e0', background: '#ffffff',
          textAlign: 'right'
        }}>
          <button onClick={onClose} style={{
            padding: '7px 18px', border: '1px solid #cbd5e1', background: '#ffffff',
            borderRadius: '4px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer',
            color: '#334155', fontFamily: 'Arial, sans-serif'
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
