import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as LucideIcons from 'lucide-react';
import { Bell, X } from 'lucide-react';
import useAuthStore from '../store/authStore';

const API      = (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';
const ADMIN_API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';
const POLL_MS  = 15000; // 15-second real-time sync

/* ── Announcement badge — shared between scrolling & static modes ──────────
   Pure presentational component; no state, no side effects.                  */
function AnnBadge({ ann }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '5px 15px',
      borderRadius: '20px',
      backgroundColor: ann.background_color || '#991b1b',
      color: ann.text_color || '#ffffff',
      fontWeight: 'bold',
      fontSize: '13px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      <span>{ann.announcement_text}</span>
      {ann.session_text && (
        <span style={{
          fontSize: '10px',
          backgroundColor: 'rgba(255,255,255,0.25)',
          padding: '1px 6px',
          borderRadius: '10px',
          textTransform: 'uppercase',
        }}>{ann.session_text}</span>
      )}
    </div>
  );
}

function parseBold(str) {
  const parts = str.split('**');
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <strong key={i}>{part}</strong>;
    }
    return part;
  });
}

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) {
      return <h5 key={idx} className="fw-bold mt-3 mb-2 text-dark" style={{ fontSize: '14px' }}>{trimmed.replace('### ', '')}</h5>;
    }
    if (trimmed.startsWith('## ')) {
      return <h4 key={idx} className="fw-bold mt-3 mb-2 text-dark" style={{ fontSize: '15px' }}>{trimmed.replace('## ', '')}</h4>;
    }
    if (trimmed.startsWith('# ')) {
      return <h3 key={idx} className="fw-bold mt-3 mb-2 text-dark" style={{ fontSize: '16px' }}>{trimmed.replace('# ', '')}</h3>;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bulletText = trimmed.replace(/^[-*]\s+/, '');
      return (
        <li key={idx} className="ms-3" style={{ listStyleType: 'disc', fontSize: 13, lineHeight: 1.6 }}>
          {parseBold(bulletText)}
        </li>
      );
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const listText = trimmed.replace(/^\d+\.\s+/, '');
      return (
        <li key={idx} className="ms-3" style={{ listStyleType: 'decimal', fontSize: 13, lineHeight: 1.6 }}>
          {parseBold(listText)}
        </li>
      );
    }
    if (trimmed === '') {
      return <div key={idx} className="my-2" />;
    }
    return <p key={idx} className="mb-2" style={{ fontSize: 13, lineHeight: 1.6 }}>{parseBold(trimmed)}</p>;
  });
}

export default function StudentHome() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [settings,       setSettings]       = useState(null);
  const [homeSettings,   setHomeSettings]   = useState({});
  const [notifications,  setNotifications]  = useState([]);
  const [sessionStatus,  setSessionStatus]  = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [announcements,  setAnnouncements]  = useState([]);
  const [actionButtons,  setActionButtons]  = useState([]);
  const [quickLinks,     setQuickLinks]     = useState([]);
  const [contacts,       setContacts]       = useState([]);
  const [layoutBlocks,   setLayoutBlocks]   = useState([]);
  const [declarations,   setDeclarations]   = useState([]);

  // ── Smart auth: already logged-in → straight to dashboard ──────────
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // ── Fetch all live data ─────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const [settingsRes, notifRes, sessionRes, homeRes, annRes, hmRes, decRes] = await Promise.allSettled([
      axios.get(`${API}/settings`),
      axios.get(`${API}/portal-notifications`),
      axios.get(`${API}/active-session`),
      axios.get(`${API}/portal-home/settings`),
      axios.get(`${API}/portal-home/announcements`),
      axios.get(`${API}/home-manager/homepage`),
      axios.get(`${API}/declarations/public`),
    ]);
    if (settingsRes.status === 'fulfilled' && settingsRes.value.data.success)
      setSettings(settingsRes.value.data.data);
    if (notifRes.status === 'fulfilled' && notifRes.value.data.success)
      setNotifications(notifRes.value.data.data || []);
    if (sessionRes.status === 'fulfilled' && sessionRes.value.data.success)
      setSessionStatus(sessionRes.value.data.data);
    if (homeRes.status === 'fulfilled' && homeRes.value.data.success)
      setHomeSettings(homeRes.value.data.data || {});
    if (annRes.status === 'fulfilled' && annRes.value.data.success)
      setAnnouncements(annRes.value.data.data || []);
    if (hmRes.status === 'fulfilled' && hmRes.value.data.success) {
      const hm = hmRes.value.data.data;
      setActionButtons(hm.action_buttons || []);
      setQuickLinks(hm.quick_links || []);
      setContacts(hm.contacts || []);
      setLayoutBlocks(hm.layout || []);
    }
    if (decRes.status === 'fulfilled' && decRes.value.data.success)
      setDeclarations(decRes.value.data.data || []);
    setLoading(false);
  }, []);

  // Initial load + 15-second polling for real-time admin changes
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // SSE: immediately refetch when admin changes notifications/declarations
  useEffect(() => {
    const base = import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000';
    const es = new EventSource(`${base}/api/home-data/events`);
    es.addEventListener('home-data-updated', fetchAll);
    return () => es.close();
  }, [fetchAll]);

  // ── Helpers ─────────────────────────────────────────────────────────
  const logoUrl  = (p) => !p ? '/images/pu_logo.png' : p.startsWith('/uploads') ? (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + p : p;
  const logo2Url = (p) => !p ? null : p.startsWith('/uploads') ? (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + p : p;

  const registrationOpen = sessionStatus?.registration_open;
  const admissionNotifs  = notifications.filter(n => n.type === 'notification');
  const importantDates   = notifications.filter(n => n.type === 'date');

  const yr      = new Date().getFullYear();
  const yrRange = `${yr} - ${String(yr + 1).slice(-2)}`;

  // Admin-overridable values
  const portalTitle    = homeSettings.home_page_title    || 'Ph.D. ADMISSION ONLINE PORTAL';
  const statusText     = homeSettings.admission_status_text || null;
  const showProspectus = !!homeSettings.show_prospectus_btn;
  const prospectusUrl  = `${API}/portal-home/prospectus/download`;

  // Resolve a lucide icon by name string (falls back to a simple arrow span)
  const resolveIcon = (iconName, size = 15) => {
    if (!iconName) return null;
    const Icon = LucideIcons[iconName];
    return Icon ? <Icon size={size} /> : null;
  };

  // Handle dynamic action button click
  const handleBtnClick = (btn) => {
    if (btn.btn_type === 'apply_now')            navigate('/register');
    else if (btn.btn_type === 'applicant_login') navigate('/login');
    else if (btn.btn_type === 'download_prospectus') window.open(prospectusUrl, '_blank');
    else if (btn.btn_type === 'instruction')     setShowInstructions(true);
    else if (btn.url)                            window.open(btn.url, '_blank');
  };

  // Compute which layout blocks are active, in order
  const activeBlocks = layoutBlocks.filter(b => b.is_active).map(b => b.block_key);
  const isBlockVisible = (key) => activeBlocks.length === 0 || activeBlocks.includes(key);

  /* ── inline style objects ──────────────────────────────────────────── */
  const S = {
    page: { minHeight: '100vh', backgroundColor: '#fff', fontFamily: 'Arial,"Times New Roman",serif', color: '#000' },
    header: { borderBottom: '3px solid #00008B', padding: '12px 20px', backgroundColor: '#fff' },
    headerInner: { maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
    logoLeft:  { width: '105px', height: '105px', objectFit: 'contain' },
    logoRight: { width: '95px',  height: '105px', objectFit: 'cover',    border: '2px solid #999' },
    titleBlock: { flex: 1, textAlign: 'center', padding: '0 10px' },
    uniName:  { color: '#00008B', fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0', textTransform: 'uppercase', lineHeight: '1.25' },
    portalName: { color: '#00008B', fontSize: '15px', fontWeight: 'bold', margin: '0 0 4px 0' },
    address:  { fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#222' },

    actionBar:   { borderBottom: '2px solid #ccc', padding: '12px 20px 10px', backgroundColor: '#fff' },
    actionInner: { maxWidth: '1100px', margin: '0 auto', textAlign: 'center' },
    admTitle:    { fontSize: '17px', fontWeight: 'bold', textDecoration: 'underline', color: '#000', display: 'block', marginBottom: '12px' },
    btnRow:      { display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' },
    btn: (bg) => ({
      backgroundColor: bg, color: '#fff', border: 'none', padding: '9px 20px',
      borderRadius: '4px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: '7px', transition: 'opacity .15s',
    }),
    statusRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '750px', margin: '0 auto', padding: '0 4px' },

    main:  { maxWidth: '1100px', margin: '0 auto', padding: '18px 20px' },
    grid:  { display: 'grid', gridTemplateColumns: '1fr 310px', gap: '18px' },
    panel: { border: '1px solid #aaa', borderRadius: '3px', marginBottom: '16px' },
    panelHead: (bg) => ({ backgroundColor: bg, padding: '9px 14px', borderRadius: '3px 3px 0 0', fontWeight: 'bold', fontSize: '14px', color: '#fff' }),
    panelBody: { padding: '12px 14px' },

    listItem: { display: 'flex', gap: '8px', alignItems: 'flex-start', borderBottom: '1px solid #eee', padding: '7px 0', fontSize: '14px' },
    bullet:   (c) => ({ color: c, fontWeight: 'bold', flexShrink: 0, paddingTop: '2px' }),

    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal:   { backgroundColor: '#fff', maxWidth: '620px', width: '92%', borderRadius: '5px', padding: '28px 30px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.35)' },

    footer: { marginTop: '24px', backgroundColor: '#00008B', color: '#fff', borderTop: '3px solid #00008B', padding: '14px 20px', textAlign: 'center', fontSize: '13px' },
  };

  return (
    <div style={S.page}>

      {/* ══ HEADER ══════════════════════════════════════════════════ */}
      <header style={S.header}>
        <div style={S.headerInner}>

          {/* Left logo */}
          <a href="https://www.periyaruniversity.ac.in/" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', cursor: 'pointer' }} className="hover-opacity">
            <img src={logoUrl(settings?.logo)} alt="University Logo" style={S.logoLeft} />
          </a>

          {/* Centre title block */}
          <a href="https://www.periyaruniversity.ac.in/" target="_blank" rel="noopener noreferrer" style={{ ...S.titleBlock, textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }} className="hover-opacity">
            <div>
              <h1 style={S.uniName}>{settings?.university_name_english || 'PERIYAR UNIVERSITY'}</h1>
              {settings?.university_name_tamil && (
                <p style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#00008B', fontWeight: 'bold' }}>
                  {settings.university_name_tamil}
                </p>
              )}
              <h2 style={S.portalName}>{portalTitle}</h2>
              <p style={S.address}>{settings?.header_line3 || 'Salem – 636 011, Tamil Nadu, India'}</p>
            </div>
          </a>

          {/* Right — logo2 / Periyar photo */}
          <a href="https://www.periyaruniversity.ac.in/" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', cursor: 'pointer' }} className="hover-opacity">
            {logo2Url(settings?.logo2) ? (
              <img src={logo2Url(settings.logo2)} alt="Periyar" style={S.logoRight} />
            ) : (
              <div style={{ width: '95px', height: '105px', border: '2px solid #999', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', fontSize: '11px', color: '#555', textAlign: 'center', flexShrink: 0 }}>
                Periyar<br />University
              </div>
            )}
          </a>
        </div>
      </header>

      {/* ══ ACTION BAR ══════════════════════════════════════════════ */}
      <div style={S.actionBar}>
        <div style={S.actionInner}>

          <span style={S.admTitle}>Admission for the year {yrRange}</span>

          {/* Dynamic action buttons from Home Manager */}
          <div style={S.btnRow}>
            {actionButtons.length > 0 ? actionButtons.map(btn => {
              const isProspectus = btn.btn_type === 'download_prospectus';
              const disabled = isProspectus && !showProspectus;
              return (
                <button
                  key={btn.id}
                  style={{ ...S.btn(btn.bg_color || '#009688'), color: btn.text_color || '#fff', ...(disabled ? { opacity: 0.55, cursor: 'not-allowed' } : {}) }}
                  onClick={() => !disabled && handleBtnClick(btn)}
                  disabled={disabled}
                >
                  {resolveIcon(btn.icon)} {btn.name}
                </button>
              );
            }) : (
              /* Fallback static buttons when table not yet seeded */
              <>
                <button style={{ ...S.btn('#009688'), opacity: showProspectus ? 1 : 0.55, cursor: showProspectus ? 'pointer' : 'not-allowed' }}
                  onClick={() => showProspectus && window.open(prospectusUrl, '_blank')} disabled={!showProspectus}>
                  {resolveIcon('Download')} Download Prospectus
                </button>
                <button style={S.btn('#FF8F00')} onClick={() => setShowInstructions(true)}>
                  {resolveIcon('Info')} Instruction
                </button>
                <button style={S.btn('#6A1B9A')} onClick={() => navigate('/register')}>
                  {resolveIcon('GraduationCap')} Apply Now ➜
                </button>
                <button style={S.btn('#2E7D32')} onClick={() => navigate('/login')}>
                  {resolveIcon('LogIn')} Applicant Login ✓
                </button>
              </>
            )}
          </div>

          {/* Status row / Dynamic Marquee */}
          {announcements.length > 0 ? (
            /* ── Marquee / Static announcement strip ──────────────────────────── */
            <div style={{
              overflow: 'hidden',     /* clips the scrolling track */
              position: 'relative',
              width: '100%',
              maxWidth: '850px',
              height: '44px',         /* fixed height → clean clip boundary */
              margin: '0 auto 12px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #ddd',
              borderRadius: '6px',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
              /* NOTE: NO display:flex here — that would blockify the inline-flex
                 inner track and prevent it from overflowing the clip boundary. */
            }}>
              {announcements.some(a => a.is_scrolling_enabled) ? (
                /* ── SCROLLING MODE ─────────────────────────────────────────── */
                /* Animation is driven purely by CSS (.pu-marquee-track in index.css)
                   which overrides the global `animation:none !important` wildcard.
                   Speed flows in via the CSS custom property --marquee-duration.   */
                <div
                  className="pu-marquee-track"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3rem',
                    height: '100%',
                    paddingLeft: '1rem',
                    /* CSS custom property — read by the @keyframes rule in index.css */
                    '--marquee-duration': `${announcements[0]?.animation_speed || 15}s`,
                  }}
                >
                  {/* ── Copy 1 — the visible strip ── */}
                  {announcements.map((ann, idx) => (
                    <AnnBadge key={`c1-${ann.id ?? idx}`} ann={ann} />
                  ))}
                  {/* ── Copy 2 — seamless loop continuation ── */}
                  {announcements.map((ann, idx) => (
                    <AnnBadge key={`c2-${ann.id ?? idx}`} ann={ann} />
                  ))}
                </div>
              ) : (
                /* ── STATIC MODE — centered, no animation ───────────────────── */
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '0 16px',
                  overflow: 'hidden',
                }}>
                  {announcements.map((ann, idx) => (
                    <AnnBadge key={`static-${ann.id ?? idx}`} ann={ann} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Status row Fallback */
            <div style={S.statusRow}>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: registrationOpen ? '#1B5E20' : '#B71C1C' }}>
                {loading
                  ? 'Loading admission status…'
                  : statusText
                    ? statusText
                    : registrationOpen
                      ? `Ph.D. Admission ${yrRange} – Admission Opened`
                      : `Ph.D. Admission – Currently Closed`}
              </span>
              <span style={{ color: '#D81B60', fontSize: '16px', fontWeight: 'bold' }}>{yrRange}</span>
            </div>
          )}
        </div>
      </div>

      {/* ══ INSTRUCTIONS MODAL ══════════════════════════════════════ */}
      {showInstructions && (
        <div style={S.overlay} onClick={() => setShowInstructions(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, color: '#00008B', textDecoration: 'underline', fontWeight: 'bold' }}>
                Instructions for Applicants
              </h4>
              <button onClick={() => setShowInstructions(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
                <X size={20} />
              </button>
            </div>
            <ol style={{ paddingLeft: '22px', lineHeight: '2.1', fontSize: '14px', margin: 0 }}>
              <li>New applicants must <strong>register</strong> with a valid email address to create an account.</li>
              <li>Click <strong>"Apply Now"</strong> to create a new account and begin your application.</li>
              <li>Existing applicants click <strong>"Applicant Login"</strong> to resume their saved application.</li>
              <li>Fill all sections carefully. Click <strong>Save</strong> frequently to preserve your progress.</li>
              <li>Upload documents in <strong>PDF / JPG / PNG</strong> format (max 5 MB each).</li>
              <li>After all sections are complete, submit and complete the <strong>online payment</strong>.</li>
              <li>Your official Application ID (<em>CETPHD format</em>) is generated after payment confirmation.</li>
              <li>Download and keep your payment receipt for all future correspondence.</li>
            </ol>
            <button onClick={() => setShowInstructions(false)}
              style={{ marginTop: '16px', padding: '8px 22px', backgroundColor: '#00008B', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ══ MAIN CONTENT ════════════════════════════════════════════ */}
      <main style={S.main}>
        {/* responsive: stack on mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>

          {/* ── LEFT ────────────────────────────────────────────── */}
          <div style={{ minWidth: 0 }}>

            {/* Admission Notifications */}
            {isBlockVisible('admission_notifications') && <div style={S.panel}>
              <div style={S.panelHead('#00008B')}>📢 &nbsp;Admission Notifications</div>
              <div style={S.panelBody}>
                {admissionNotifs.length === 0 ? (
                  <p style={{ color: '#777', fontSize: '13px', textAlign: 'center', margin: '10px 0', fontStyle: 'italic' }}>
                    No notifications at this time. Please check back soon.
                  </p>
                ) : admissionNotifs.map(n => (
                  <div key={n.id} style={S.listItem}>
                    <span style={S.bullet('#00008B')}>▶</span>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#00008B', fontSize: '14px' }}>{n.title}</div>
                      {n.content && <div style={{ fontSize: '13px', color: '#333', marginTop: '2px' }}>{n.content}</div>}
                      {n.published_at && (
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
                          {new Date(n.published_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>}

            {/* Guidelines & Declarations (Merged) */}
            {isBlockVisible('guidelines') && (
              <div style={S.panel}>
                <div style={S.panelHead('#00008B')}>📝 &nbsp;Guidelines &amp; Declarations</div>
                <div style={declarations.length === 0 ? S.panelBody : {}}>
                  {declarations.length === 0 ? (
                    <p style={{ color: '#777', fontSize: '13px', textAlign: 'center', margin: '10px 0', fontStyle: 'italic' }}>
                      Guidelines will be published shortly. Please check back soon.
                    </p>
                  ) : (
                    <div className="declarations-scroll-container" style={{ height: '500px', overflowY: 'auto', scrollBehavior: 'smooth', position: 'relative' }}>
                      {declarations.map((dec) => (
                        <div key={dec.id} style={{ borderBottom: '1px solid #ddd', backgroundColor: '#fff', position: 'relative' }}>
                          <div style={{
                            position: 'sticky',
                            top: 0,
                            backgroundColor: '#f8f9fa',
                            borderBottom: '2px solid #00008B',
                            padding: '10px 15px',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#00008B',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                          }}>
                            <span>📌</span> {dec.title}
                          </div>
                          
                          <div style={{ padding: '15px 20px' }}>
                            <div className="declaration-markdown-content" style={{ color: '#333' }}>
                              {renderMarkdown(dec.declaration_content)}
                            </div>

                            {dec.attachments && dec.attachments.length > 0 && (
                              <div style={{ marginTop: '16px', borderTop: '1px dashed #ccc', paddingTop: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>
                                  📎 Linked Attachments:
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                                  {dec.attachments.map((att) => {
                                    const isPdf = att.file_type?.includes('pdf') || att.original_name?.toLowerCase().endsWith('.pdf');
                                    const isDoc = att.file_type?.includes('word') || att.original_name?.toLowerCase().endsWith('.doc') || att.original_name?.toLowerCase().endsWith('.docx');
                                    const isImg = att.file_type?.includes('image') || /\.(jpg|jpeg|png)$/i.test(att.original_name);
                                    
                                    const downloadUrl = `${API}/declarations/attachments/download/${att.id}`;
                                    
                                    return (
                                      <div key={att.id} style={{
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '6px',
                                        padding: '10px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        backgroundColor: '#fafafa',
                                        fontSize: '12px'
                                      }}>
                                        <div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                                            {resolveIcon(isPdf ? 'FileText' : isImg ? 'Image' : 'FileText', 14)}
                                            <span className="text-truncate" style={{ maxWidth: '160px', display: 'inline-block' }} title={att.original_name}>{att.original_name}</span>
                                          </div>
                                          <div style={{ color: '#666', fontSize: '10px' }}>
                                            Size: {(att.file_size / 1024 / 1024).toFixed(2)} MB
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                                          <a href={downloadUrl} target="_blank" rel="noreferrer" style={{
                                            flex: 1,
                                            textAlign: 'center',
                                            padding: '4px 8px',
                                            backgroundColor: '#00008B',
                                            color: '#fff',
                                            borderRadius: '4px',
                                            textDecoration: 'none',
                                            fontWeight: 'bold',
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                          }}>
                                            Download
                                          </a>
                                          {(isPdf || isImg) && (
                                            <a href={downloadUrl} target="_blank" rel="noreferrer" style={{
                                              flex: 1,
                                              textAlign: 'center',
                                              padding: '4px 8px',
                                              backgroundColor: '#fff',
                                              color: '#00008B',
                                              border: '1px solid #00008B',
                                              borderRadius: '4px',
                                              textDecoration: 'none',
                                              fontWeight: 'bold',
                                              fontSize: '11px',
                                              cursor: 'pointer'
                                            }}>
                                              Preview
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT ───────────────────────────────────────────── */}
          <div style={{ maxWidth: '340px', width: '100%' }}>

            {/* Important Dates */}
            {isBlockVisible('important_dates') && <div style={S.panel}>
              <div style={S.panelHead('#B71C1C')}>📅 &nbsp;Important Dates</div>
              <div style={S.panelBody}>
                {importantDates.length === 0 ? (
                  <p style={{ color: '#777', fontSize: '13px', textAlign: 'center', margin: '10px 0', fontStyle: 'italic' }}>
                    Dates will be announced shortly.
                  </p>
                ) : importantDates.map(d => (
                  <div key={d.id} style={{ ...S.listItem, alignItems: 'flex-start' }}>
                    <span style={S.bullet('#B71C1C')}>▶</span>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{d.title}</div>
                      {d.content && <div style={{ fontSize: '13px', color: '#B71C1C', fontWeight: 'bold', marginTop: '2px' }}>{d.content}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>}

            {/* Quick Links — dynamic */}
            {isBlockVisible('quick_links') && (
            <div style={S.panel}>
              <div style={S.panelHead('#2E7D32')}>🔗 &nbsp;Quick Links</div>
              <div style={{ padding: '6px 0' }}>
                {quickLinks.length > 0 ? quickLinks.map(link => {
                  const handleClick = () => {
                    if (!link.url) return;
                    if (link.link_type === 'external') window.open(link.url, '_blank');
                    else navigate(link.url);
                  };
                  return (
                    <div key={link.id} onClick={handleClick}
                      style={{ padding: '9px 14px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: link.color || '#6A1B9A', fontWeight: '600', transition: 'background .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <span style={{ fontSize: '11px' }}>▶</span> {link.name}
                    </div>
                  );
                }) : (
                  /* Fallback */
                  [
                    { label: 'Apply Now (New Application)', action: () => navigate('/register'),        color: '#6A1B9A' },
                    { label: 'Existing Applicant Login',    action: () => navigate('/login'),           color: '#2E7D32' },
                    { label: 'Forgot Password',             action: () => navigate('/forgot-password'), color: '#E65100' },
                    showProspectus && { label: 'Download Prospectus', action: () => window.open(prospectusUrl, '_blank'), color: '#009688' },
                  ].filter(Boolean).map(({ label, action, color }) => (
                    <div key={label} onClick={action}
                      style={{ padding: '9px 14px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color, fontWeight: '600', transition: 'background .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <span style={{ fontSize: '11px' }}>▶</span> {label}
                    </div>
                  ))
                )}
              </div>
            </div>
            )}

            {/* Contact — dynamic */}
            {isBlockVisible('contact') && (
            <div style={S.panel}>
              <div style={S.panelHead('#37474F')}>📞 &nbsp;Contact Us</div>
              <div style={{ ...S.panelBody, fontSize: '13px', lineHeight: '1.9' }}>
                {contacts.length > 0 ? contacts.map(c => (
                  <div key={c.id}>
                    <strong>{c.label || c.contact_type}:</strong>&nbsp;{c.value}
                  </div>
                )) : (
                  <>
                    <div><strong>Email:</strong>&nbsp;{settings?.contact_email || 'admissions@periyaruniversity.ac.in'}</div>
                    <div><strong>Phone:</strong>&nbsp;{settings?.contact_phone || '0427-2345766'}</div>
                    <div><strong>Address:</strong>&nbsp;{settings?.header_line3 || 'Salem – 636 011, Tamil Nadu, India'}</div>
                  </>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </main>

      {/* ══ FOOTER ══════════════════════════════════════════════════ */}
      <footer style={S.footer}>
        <div>© {new Date().getFullYear()} {settings?.university_name_english || 'Periyar University'}. All Rights Reserved.</div>
        <div style={{ opacity: 0.75, marginTop: '4px', fontSize: '12px' }}>
          Ph.D. Online Admission Portal · Centralized ERP System · Auto-refreshes every 15 s
        </div>
      </footer>

      {/* Marquee keyframes live in index.css (needed to override the global
           `animation:none !important` wildcard that would kill an inline <style>) */}
    </div>
  );
}
