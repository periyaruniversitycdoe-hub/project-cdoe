import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import axios from 'axios';
import {
  PlusCircle, FileText, CheckCircle, Clock, Copy, Check,
  AlertCircle, ChevronRight, Ticket, CreditCard, GraduationCap,
  Award, UserCheck, FileCheck, Eye, ShieldCheck, XCircle,
  Download, ReceiptText, Mail, CalendarClock, AlertTriangle, Timer
} from 'lucide-react';
import './Dashboard.css';

// ─── Counselling Countdown Timer ──────────────────────────────────────────────
// Shows time until counselling opens (upcoming) or closes (active). Re-renders every minute.
const CounsellingCountdown = ({ startDate, endDate, windowActive }) => {
  const [remaining, setRemaining] = useState(null);
  const [phase, setPhase]         = useState('loading'); // 'upcoming' | 'open' | 'closed'
  const timerRef = useRef(null);

  const compute = useCallback(() => {
    const now = Date.now();
    if (endDate && now > new Date(endDate).getTime()) {
      setPhase('closed'); setRemaining(null); return;
    }
    // Window not yet started — count down to start
    if (startDate && !windowActive && now < new Date(startDate).getTime()) {
      const diff = new Date(startDate).getTime() - now;
      const totalSecs = Math.floor(diff / 1000);
      setPhase('upcoming');
      setRemaining({
        days:    Math.floor(totalSecs / 86400),
        hours:   Math.floor((totalSecs % 86400) / 3600),
        minutes: Math.floor((totalSecs % 3600) / 60),
      });
      return;
    }
    // Window open — count down to end
    if (endDate && windowActive) {
      const diff = new Date(endDate).getTime() - now;
      if (diff <= 0) { setPhase('closed'); setRemaining(null); return; }
      const totalSecs = Math.floor(diff / 1000);
      setPhase('open');
      setRemaining({
        days:    Math.floor(totalSecs / 86400),
        hours:   Math.floor((totalSecs % 86400) / 3600),
        minutes: Math.floor((totalSecs % 3600) / 60),
      });
    }
  }, [startDate, endDate, windowActive]);

  useEffect(() => {
    compute();
    timerRef.current = setInterval(compute, 60_000);
    return () => clearInterval(timerRef.current);
  }, [compute]);

  if (!startDate && !endDate) return null;

  if (phase === 'closed') {
    return (
      <div className="alert border-0 rounded-4 py-2 px-3 mb-3"
        style={{ background: '#fef2f2', color: '#991b1b', fontSize: 13 }}>
        <Clock size={14} className="me-1" />
        <strong>Counselling window has closed.</strong> Please contact the university for assistance.
      </div>
    );
  }

  if (phase === 'upcoming' && remaining) {
    return (
      <div className="d-flex align-items-center gap-3 px-3 py-2 mb-3 rounded-4"
        style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1px solid #93c5fd' }}>
        <Clock size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
        <div style={{ fontSize: 13 }}>
          <span className="fw-bold" style={{ color: '#1e40af' }}>Counselling opens in: </span>
          <span className="fw-semibold" style={{ color: '#1d4ed8' }}>
            {remaining.days > 0 && `${remaining.days}d `}
            {remaining.hours}h {remaining.minutes}m
          </span>
          {startDate && (
            <span className="text-muted ms-2" style={{ fontSize: 11 }}>
              (Opens: {startDate})
            </span>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'open' && remaining) {
    return (
      <div className="d-flex align-items-center gap-3 px-3 py-2 mb-3 rounded-4"
        style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '1px solid #6ee7b7' }}>
        <Clock size={18} style={{ color: '#059669', flexShrink: 0 }} />
        <div style={{ fontSize: 13 }}>
          <span className="fw-bold" style={{ color: '#065f46' }}>Counselling closes in: </span>
          <span className="fw-semibold" style={{ color: '#047857' }}>
            {remaining.days > 0 && `${remaining.days}d `}
            {remaining.hours}h {remaining.minutes}m
          </span>
        </div>
      </div>
    );
  }

  return null;
};

const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';

// ─── Pending Payment Card (deferred payment workflow) ────────────────────────
// Shown on dashboard when payment_decision='pay_later' and payment not yet done.
const PendingPaymentCard = ({ pendingStatus, onContinue }) => {
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (!pendingStatus?.payment_due_date) return;
    const compute = () => {
      const now   = Date.now();
      const due   = new Date(pendingStatus.payment_due_date).getTime();
      const diff  = due - now;
      if (diff <= 0) { setCountdown({ expired: true }); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      const s = Math.floor((diff % 60000)    / 1000);
      setCountdown({ d, h, m, s, expired: false, totalMs: diff });
    };
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [pendingStatus?.payment_due_date]);

  const isExpired  = pendingStatus?.is_expired || countdown?.expired;
  const isUrgent   = countdown && !countdown.expired && countdown.totalMs < 86400000; // < 24h
  const isWarning  = countdown && !countdown.expired && countdown.totalMs < 3 * 86400000; // < 3d
  const dueDisplay = pendingStatus?.payment_due_date
    ? new Date(pendingStatus.payment_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  if (isExpired) {
    return (
      <div className="card border-0 rounded-4 mb-4 overflow-hidden shadow"
        style={{ border: '2px solid #fca5a5' }}>
        <div className="card-body p-4" style={{ background: 'linear-gradient(135deg,#fef2f2,#fff5f5)' }}>
          <div className="d-flex align-items-start gap-3">
            <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: 48, height: 48, background: '#fee2e2' }}>
              <XCircle size={26} className="text-danger" />
            </div>
            <div className="flex-grow-1">
              <div className="fw-bold text-danger mb-1" style={{ fontSize: 15 }}>Payment Deadline Expired</div>
              <p className="text-muted small mb-2">
                The payment deadline for your application has passed. Please contact the university to request a deadline extension.
              </p>
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <span className="badge bg-danger px-3 py-2">PAYMENT_EXPIRED</span>
                <span className="text-muted small">Due was: {dueDisplay}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-0 rounded-4 mb-4 overflow-hidden shadow"
      style={{ border: `2px solid ${isUrgent ? '#f97316' : isWarning ? '#f59e0b' : '#3b82f6'}` }}>
      {/* Top accent bar */}
      <div style={{ height: 4, background: isUrgent ? 'linear-gradient(90deg,#ef4444,#f97316)' : isWarning ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#0f4c81,#3b82f6)' }} />
      <div className="card-body p-4" style={{ background: isUrgent ? 'linear-gradient(135deg,#fff7ed,#fff)' : isWarning ? 'linear-gradient(135deg,#fffbeb,#fff)' : 'linear-gradient(135deg,#eff6ff,#fff)' }}>
        <div className="d-flex align-items-start gap-3 flex-wrap">
          <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: 52, height: 52, background: isUrgent ? '#fee2e2' : isWarning ? '#fef3c7' : '#dbeafe' }}>
            {isUrgent ? <AlertTriangle size={28} className="text-danger" /> : <CalendarClock size={28} style={{ color: isWarning ? '#d97706' : '#1e40af' }} />}
          </div>

          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <span className="fw-bold" style={{ fontSize: 15, color: isUrgent ? '#dc2626' : '#0f4c81' }}>
                {isUrgent ? 'URGENT: Payment Due Soon!' : 'Pending Payment'}
              </span>
              <span className={`badge px-3 py-1 ${isUrgent ? 'bg-danger' : isWarning ? 'bg-warning text-dark' : 'bg-primary'}`}
                style={{ fontSize: 11 }}>
                AWAITING PAYMENT
              </span>
            </div>
            <p className="text-muted small mb-3">
              Your application is saved and ready. Complete the ₹{pendingStatus?.amount?.toLocaleString('en-IN') || '1,500'} admission fee payment before the deadline to finalize your admission.
            </p>

            {/* Details row */}
            <div className="d-flex flex-wrap gap-3 mb-3">
              <div className="rounded-3 px-3 py-2 border" style={{ background: '#f8fafc', fontSize: 12 }}>
                <div className="text-muted">Application ID</div>
                <div className="fw-bold font-monospace">{pendingStatus?.application_id}</div>
              </div>
              <div className="rounded-3 px-3 py-2 border" style={{ background: '#f8fafc', fontSize: 12 }}>
                <div className="text-muted">Amount Due</div>
                <div className="fw-bold text-primary">₹{pendingStatus?.amount?.toLocaleString('en-IN') || '1,500'}</div>
              </div>
              <div className="rounded-3 px-3 py-2 border" style={{ background: '#f8fafc', fontSize: 12 }}>
                <div className="text-muted">Payment Deadline</div>
                <div className="fw-bold">{dueDisplay}</div>
              </div>
            </div>

            {/* Countdown timer */}
            {countdown && !countdown.expired && (
              <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                <Timer size={14} className={isUrgent ? 'text-danger' : 'text-muted'} />
                <span className="text-muted small">Time remaining:</span>
                {[
                  { val: countdown.d, label: 'days' },
                  { val: countdown.h, label: 'hrs' },
                  { val: countdown.m, label: 'min' },
                  { val: countdown.s, label: 'sec' },
                ].filter((_, i) => countdown.d > 0 || i > 0).map(({ val, label }) => (
                  <span key={label} className="fw-bold rounded-2 px-2 py-1"
                    style={{ fontSize: 13, background: isUrgent ? '#fee2e2' : '#e0f2fe', color: isUrgent ? '#dc2626' : '#0369a1', minWidth: 42, textAlign: 'center' }}>
                    {String(val).padStart(2, '0')}<span className="fw-normal ms-1" style={{ fontSize: 10 }}>{label}</span>
                  </span>
                ))}
              </div>
            )}

            <button
              className="btn fw-bold rounded-pill px-4 py-2 d-flex align-items-center gap-2"
              style={{
                background: isUrgent ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'linear-gradient(135deg,#0f4c81,#1e6bb8)',
                color: '#fff', border: 'none',
              }}
              onClick={onContinue}
            >
              <CreditCard size={16} />
              Continue Payment
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, logout, token } = useAuthStore();
  const navigate = useNavigate();

  const [copied,        setCopied]        = useState(false);
  const [eligibility,   setEligibility]   = useState(null);
  const [allotment,     setAllotment]     = useState(null);
  const [hallTicket,    setHallTicket]    = useState(null);
  const [sessionInfo,   setSessionInfo]   = useState(null);
  const [univSettings,  setUnivSettings]  = useState(null);
  const [payHistory,    setPayHistory]    = useState([]);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading,  setNotifLoading]  = useState(false);

  const fetchEligibility = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/student/eligibility`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setEligibility(res.data.data);
    } catch {}
  }, [token]);

  const fetchPendingStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/payment/pending-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setPendingStatus(res.data.data);
    } catch {}
  }, [token]);

  // Boot effect: fire all 5 data calls in parallel on mount / token change.
  // Single AbortController cancels every in-flight request on cleanup, making
  // this React StrictMode-safe (double-invoke cancels the first batch before
  // the second fires) and prevents stale state updates after unmount.
  useEffect(() => {
    if (!token) return;
    const ac = new AbortController();
    const { signal } = ac;
    const auth = { Authorization: `Bearer ${token}` };

    axios.get(`${API}/settings`, { signal })
      .then(r => setUnivSettings(r.data.success ? r.data.data : r.data))
      .catch(() => {});

    axios.get(`${API}/student/eligibility`, { headers: auth, signal })
      .then(r => { if (r.data.success) setEligibility(r.data.data); })
      .catch(() => {});

    // Backend always returns 200; available:false means not ready yet
    axios.get(`${API}/student/hall-ticket`, { headers: auth, signal })
      .then(r => setHallTicket(r.data?.available === false ? null : r.data))
      .catch(err => { if (err?.code !== 'ERR_CANCELED') setHallTicket(null); });

    axios.get(`${API}/counselling/my-allotment`, { headers: auth, signal })
      .then(r => { if (r.data.success) setAllotment(r.data.data); })
      .catch(() => {});

    axios.get(`${API}/student/session`, { headers: auth, signal })
      .then(r => setSessionInfo(r.data))
      .catch(() => {});

    // Fetch Notifications
    setNotifLoading(true);
    axios.get(`${API}/notifications`, { headers: auth, signal })
      .then(r => setNotifications(r.data.success ? r.data.data : []))
      .catch(() => {})
      .finally(() => setNotifLoading(false));

    // Load pending payment status for deferred payment card
    axios.get(`${API}/payment/pending-status`, { headers: auth, signal })
      .then(r => { if (r.data.success) setPendingStatus(r.data.data); })
      .catch(() => {});

    return () => ac.abort();
  }, [token]);

  const markRead = async (id) => {
    try {
      await axios.put(`${API}/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch {}
  };

  useEffect(() => {
    if (!token || eligibility?.payment_status !== 'Paid') return;
    const ac = new AbortController();
    axios.get(`${API}/student/payment/history`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ac.signal,
    })
      .then(r => { if (r.data.success) setPayHistory(r.data.data || []); })
      .catch(() => {});
    return () => ac.abort();
  }, [token, eligibility?.payment_status]);

  const copyAppId = () => {
    navigator.clipboard.writeText(user?.application_id || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) { logout(); navigate('/login'); }
  };

  const appStatus           = eligibility?.status || 'Draft';
  const payStatus           = eligibility?.payment_status || 'Unpaid';
  const isDirectPass        = eligibility?.is_direct_pass;
  const isExempted          = eligibility?.is_exempted;
  const isSubmitted         = appStatus !== 'Draft';
  const isPaid              = ['Success', 'Paid', 'Verified', 'Approved'].includes(payStatus);
  const appsClosed          = sessionInfo && !sessionInfo.application_open && !sessionInfo?.result_published;
  const resultPublished     = eligibility?.result_published;
  const paymentWindowActive = eligibility?.payment_window_active !== false;

  // Deferred payment state — show pending card when waiting for payment
  const isAwaitingPayment = pendingStatus?.awaiting_payment && !pendingStatus?.is_paid;
  const paymentDecision   = pendingStatus?.payment_decision || eligibility?.payment_decision;

  return (
    <>

      {/* University Header */}
      <section className="animate-fade-in d-flex flex-column flex-md-row align-items-center text-center text-md-start gap-3 p-3 p-md-4 bg-white rounded-4 shadow-sm mb-4 justify-content-center justify-content-md-start">
        <div style={{ display: 'flex' }}>
          <img
            src={univSettings?.logo?.startsWith('/uploads') ? `(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + ''${univSettings.logo}` : univSettings?.logo || '/images/pu_logo.png'}
            alt="University Logo"
            style={{ height: '90px', maxHeight: '110px', objectFit: 'contain' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 className="responsive-h1" style={{ color: '#901a1e', fontWeight: 'bold', marginBottom: '0px', fontFamily: 'serif' }}>
            {univSettings?.university_name_tamil || 'பெரியார் பல்கலைக்கழகம்'}
          </h1>
          <h2 className="responsive-h2" style={{ color: '#0f4c81', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.5px', fontFamily: 'sans-serif' }}>
            {univSettings?.university_name_english || 'PERIYAR UNIVERSITY'}
          </h2>
          <p className="responsive-text" style={{ margin: '0', color: '#111827', fontWeight: '500', lineHeight: '1.4' }}>
            {univSettings?.header_line2 || "State University - NAAC 'A++' Grade - NIRF Rank 94"}
          </p>
          <p className="responsive-text" style={{ margin: '0', color: '#111827', fontWeight: '500', lineHeight: '1.4' }}>
            {univSettings?.subtitle || 'Periyar Palkalai Nagar'}
          </p>
        </div>
      </section>

      {/* Stat Grid */}
      <div className="stats-grid">
        {/* Application ID — only shown after registration form submission */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon-box" style={{ background: '#eff6ff', color: '#3b82f6' }}><FileCheck size={20} /></div>
            {user?.application_id ? (
              <button onClick={copyAppId} className="btn btn-link p-0 text-muted" title="Copy Application ID">
                {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              </button>
            ) : null}
          </div>
          <div className="stat-title">Application ID</div>
          {user?.application_id ? (
            <div className="stat-value font-monospace" style={{ fontSize: 14, letterSpacing: '0.5px' }}>
              {user.application_id}
            </div>
          ) : (
            <div className="stat-value" style={{ fontSize: 13, color: '#6b7280' }}>
              Assigned after submission
            </div>
          )}
        </div>

        {/* App Status */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}><Clock size={20} /></div>
            <span className={`pu-badge ${appStatus === 'Approved' ? 'pu-badge-success' : appStatus === 'Submitted' ? 'pu-badge-info' : 'pu-badge-warning'}`}>
              {appStatus}
            </span>
          </div>
          <div className="stat-title">Application Status</div>
          <div className="stat-value">{appStatus === 'Draft' ? 'Draft Application' : appStatus}</div>
        </div>

        {/* Payment */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon-box" style={{
              background: isPaid ? '#ecfdf5' : pendingStatus?.is_expired ? '#fef2f2' : isAwaitingPayment ? '#fff7ed' : '#fff1f2',
              color:      isPaid ? '#059669' : pendingStatus?.is_expired ? '#dc2626' : isAwaitingPayment ? '#d97706' : '#e11d48',
            }}>
              <CreditCard size={20} />
            </div>
            <span className={`pu-badge ${
              isPaid ? 'pu-badge-success' :
              pendingStatus?.is_expired ? 'pu-badge-danger' :
              paymentDecision === 'pay_later' ? 'pu-badge-warning' :
              isAwaitingPayment ? 'pu-badge-warning' : 'pu-badge-danger'
            }`}>
              {isPaid ? 'Paid' :
               pendingStatus?.is_expired ? 'Expired' :
               paymentDecision === 'pay_later' ? 'Pending' :
               isAwaitingPayment ? 'Awaiting' : 'Unpaid'}
            </span>
          </div>
          <div className="stat-title">Payment Status</div>
          <div className="stat-value">Admission Fee</div>
        </div>

        {/* Result / Direct Pass — badge hidden until results are published */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon-box" style={{ background: '#f0f9ff', color: '#0ea5e9' }}>
              {isDirectPass ? <ShieldCheck size={20} /> : <Award size={20} />}
            </div>
            {isDirectPass ? (
              <span className="pu-badge pu-badge-success">Direct Pass</span>
            ) : resultPublished ? (
              <span className={`pu-badge ${
                eligibility?.qualification_status === 'Qualified' ? 'pu-badge-success' :
                eligibility?.qualification_status === 'Failed'    ? 'pu-badge-danger'  : 'pu-badge-warning'
              }`}>
                {isExempted ? 'Exempted' : (eligibility?.qualification_status || 'Pending')}
              </span>
            ) : (
              <span className="pu-badge pu-badge-warning">Awaited</span>
            )}
          </div>
          <div className="stat-title">{isDirectPass ? 'Direct Pass Status' : 'Entrance Result'}</div>
          <div className="stat-value">Ph.D. Admission 2026</div>
        </div>
      </div>

      {/* Communications Feed */}
      {notifications.length > 0 && (
          <div className="card shadow-sm rounded-4 mb-4 border-0 overflow-hidden animate-fade-in">
              <div className="card-header bg-white border-bottom-0 py-3 d-flex align-items-center justify-content-between">
                  <h6 className="mb-0 fw-bold d-flex align-items-center gap-2" style={{ color: '#0f4c81' }}>
                      <Mail size={18} className="text-primary" />
                      University Communications
                  </h6>
                  {notifications.some(n => !n.is_read) && (
                      <span className="badge bg-primary rounded-pill px-2" style={{ fontSize: 10 }}>
                          {notifications.filter(n => !n.is_read).length} New Message
                      </span>
                  )}
              </div>
              <div className="p-0">
                  <div className="list-group list-group-flush">
                      {notifications.slice(0, 3).map(n => (
                          <div 
                              key={n.id} 
                              className={`list-group-item list-group-item-action border-0 px-4 py-3 d-flex align-items-start gap-3 transition-all ${!n.is_read ? 'bg-light' : 'opacity-75'}`}
                              onClick={() => !n.is_read && markRead(n.id)}
                              style={{ 
                                  cursor: n.is_read ? 'default' : 'pointer', 
                                  borderLeft: !n.is_read ? '4px solid #1e3a8a' : '4px solid transparent',
                                  transition: '0.2s'
                              }}
                          >
                              <div className={`p-2 rounded-3 flex-shrink-0 ${!n.is_read ? 'bg-white shadow-sm text-primary' : 'bg-transparent text-muted text-opacity-50'}`}>
                                  <Mail size={16} />
                              </div>
                              <div className="flex-grow-1">
                                  <div className="d-flex align-items-center justify-content-between mb-1">
                                      <h6 className={`mb-0 small fw-bold ${!n.is_read ? 'text-primary' : 'text-dark'}`}>{n.title}</h6>
                                      <span className="text-muted" style={{ fontSize: 10 }}>{new Date(n.created_at).toLocaleDateString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                                  </div>
                                  <p className="text-muted mb-0" style={{ fontSize: 12, lineHeight: 1.5, maxWidth: '100%' }}>{n.message}</p>
                              </div>
                              {!n.is_read && <div className="bg-primary rounded-circle mt-1" style={{ width: 8, height: 8 }}></div>}
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Action Center - Banners */}
      <div className="action-center">

        {/* DIRECT PASS Banner */}
        {isDirectPass && (
          <div className="action-banner border-0 animate-fade-in mb-3"
            style={{ background: 'linear-gradient(135deg,#065f46,#064e3b)', borderRadius: 16 }}>
            <div className="banner-content">
              <div className="banner-icon-bg" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <ShieldCheck size={28} className="text-success" />
              </div>
              <div className="banner-text">
                <h4 className="fw-bold text-white mb-1">You have been granted Direct Pass!</h4>
                <p className="text-white-50 mb-0">
                  Based on your qualification (NET/SET/JRF/SLET), you are exempted from the entrance examination.
                  {eligibility?.eligible_for_counselling
                    ? ' You are now eligible for counselling.'
                    : ' Complete payment and wait for admin approval to access counselling.'}
                </p>
              </div>
            </div>
            {eligibility?.eligible_for_counselling && (
              <button className="banner-btn" onClick={() => navigate('/counselling')} style={{ background: '#10b981', color: '#fff' }}>
                Start Counselling <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {/* Hall Ticket */}
        {!!hallTicket && !isDirectPass && !isExempted && (
          <div className="action-banner" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            <div className="banner-content">
              <div className="banner-icon-bg"><Ticket size={28} /></div>
              <div className="banner-text">
                <h4>Entrance Hall Ticket is Live!</h4>
                <p>Download your admit card for the Ph.D. Entrance Examination.</p>
              </div>
            </div>
            <button className="banner-btn" onClick={() => navigate('/hall-ticket')}>
              Download Now <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── Deferred Payment Card ── */}
        {isAwaitingPayment && pendingStatus && (
          <PendingPaymentCard
            pendingStatus={pendingStatus}
            onContinue={() => navigate('/payment')}
          />
        )}

        {/* Payment window closed notice (only when not in deferred flow) */}
        {isSubmitted && !isPaid && !isAwaitingPayment && !paymentWindowActive && (
          <div className="action-banner" style={{ background: 'linear-gradient(135deg,#6b7280,#4b5563)' }}>
            <div className="banner-content">
              <div className="banner-icon-bg"><CreditCard size={28} /></div>
              <div className="banner-text">
                <h4>Payment Window Closed</h4>
                <p>
                  The payment window is currently closed.
                  {eligibility?.payment_window_open
                    ? ` It will open on ${new Date(eligibility.payment_window_open).toLocaleDateString('en-IN')}.`
                    : ' Please contact the university for assistance.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Application PDF download (after payment) */}
        {isPaid && isSubmitted && (
          <div className="action-banner" style={{ background: 'linear-gradient(135deg,#475569,#1e293b)' }}>
            <div className="banner-content">
              <div className="banner-icon-bg"><FileCheck size={28} /></div>
              <div className="banner-text">
                <h4>Application Submitted &amp; Payment Confirmed</h4>
                <p>Your application is complete. Download your acknowledgement or view details below.</p>
                {payHistory[0]?.paid_at && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Payment Date: {new Date(payHistory[0].paid_at).toLocaleDateString('en-IN')}
                    {payHistory[0].transaction_id ? ` · Txn: ${payHistory[0].transaction_id}` : ''}
                  </div>
                )}
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              {user?.application_id && (
                <a
                  href={`${API}/applications/download-pdf/${user.application_id}`}
                  className="banner-btn"
                  style={{ background: '#10b981', color: '#fff' }}
                  target="_blank" rel="noreferrer"
                >
                  <Download size={16} className="me-1" /> Download PDF
                </a>
              )}
              <button className="banner-btn bg-transparent border text-white" onClick={() => navigate('/review')}>
                <Eye size={16} className="me-1" /> View Application
              </button>
            </div>
          </div>
        )}

        {/* Entrance Result (non-direct-pass, non-exempted) */}
        {eligibility?.show_entrance_result && (
          <div className="action-banner border-0 animate-fade-in mb-3"
            style={{ background: 'linear-gradient(135deg,#0f4c81,#1e3a5f)', borderRadius: 16 }}>
            <div className="banner-content">
              <div className="banner-icon-bg" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <Award size={28} className="text-warning" />
              </div>
              <div className="banner-text">
                <h4 className="fw-bold mb-1 text-white">Entrance Examination Result</h4>
                <div className="mt-2 d-flex flex-column gap-1">
                  <div className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                    <span className="text-white-50" style={{ minWidth: 160 }}>Entrance Mark:</span>
                    <span className="fw-bold text-white">{eligibility.entrance_mark != null ? eligibility.entrance_mark : '—'}</span>
                  </div>
                  <div className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                    <span className="text-white-50" style={{ minWidth: 160 }}>Attendance:</span>
                    <span className="fw-bold text-white">{eligibility.attendance_status || 'N/A'}</span>
                  </div>
                   <div className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                    <span className="text-white-50" style={{ minWidth: 160 }}>Result Status:</span>
                    <span className={`badge px-3 py-1 fw-bold ${eligibility.final_result_status === 'PASS' ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: 11 }}>
                      {eligibility.final_result_status || 'Pending'}
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                    <span className="text-white-50" style={{ minWidth: 160 }}>Qualification Status:</span>
                    <span className={`fw-bold ${['Qualified','Direct Qualified'].includes(eligibility.qualification_status) ? 'text-success' : 'text-danger'}`}>
                      {eligibility.qualification_status || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {eligibility?.eligible_for_counselling && (
              <button className="banner-btn" onClick={() => navigate('/counselling')} style={{ background: '#10b981', color: '#fff' }}>
                Start Counselling <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {/* Direct Qualification Banner (NET/SET/JRF/SLET Exempted) */}
        {(isDirectPass || isExempted) && eligibility?.result_published && (
           <div className="action-banner border-0 animate-fade-in mb-3"
            style={{ background: 'linear-gradient(135deg,#064e3b,#065f46)', borderRadius: 16 }}>
            <div className="banner-content">
              <div className="banner-icon-bg" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <ShieldCheck size={28} className="text-white" />
              </div>
              <div className="banner-text">
                <h4 className="fw-bold mb-1 text-white">Direct Qualification Confirmed</h4>
                <div className="mt-2 d-flex flex-column gap-1">
                  <div className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                    <span className="text-white-50" style={{ minWidth: 160 }}>Exemption Status:</span>
                    <span className="fw-bold text-white">QUALIFIED (Exempted)</span>
                  </div>
                  <div className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                    <span className="text-white-50" style={{ minWidth: 160 }}>Admission Result:</span>
                    <span className="badge bg-success px-3 py-1 fw-bold" style={{ fontSize: 11 }}>PASS</span>
                  </div>
                </div>
              </div>
            </div>
            {eligibility?.eligible_for_counselling && (
              <button className="banner-btn" onClick={() => navigate('/counselling')} style={{ background: '#10b981', color: '#fff' }}>
                Start Counselling <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {/* FAIL result */}
        {eligibility?.result_published && eligibility?.final_result_status === 'FAIL' && !isDirectPass && (
          <div className="alert alert-danger border-0 rounded-4 d-flex align-items-center gap-3 p-3 px-4 mb-3">
            <XCircle size={24} className="text-danger flex-shrink-0" />
            <div>
              <div className="fw-bold">Result: Not Qualified</div>
              <div className="small text-muted">You are not eligible for the current counselling round. Please contact the university for further guidance.</div>
            </div>
          </div>
        )}

        {/* Counselling countdown — shown when student is PASS + Qualified,
            regardless of window state: upcoming → shows opening timer,
            active → shows closing timer, closed → shows locked notice */}
        {(eligibility?.eligible_for_counselling ||
          (eligibility?.final_result_status === 'PASS' &&
           ['Qualified','Direct Qualified'].includes(eligibility?.qualification_status))
        ) && (eligibility?.counselling_start_date || eligibility?.counselling_end_date) && (
          <CounsellingCountdown
            startDate={eligibility.counselling_start_date}
            endDate={eligibility.counselling_end_date}
            windowActive={!!eligibility.counselling_window_active}
          />
        )}

        {/* Counselling Allotment */}
        {!!allotment && allotment.allotment_status !== 'Pending' && (
          <div className="action-banner border-0 animate-fade-in mb-3" style={{
            background: allotment.allotment_status === 'Allotted'
              ? 'linear-gradient(135deg,#064e3b,#065f46)'
              : 'linear-gradient(135deg,#7f1d1d,#991b1b)',
            borderRadius: 16
          }}>
            <div className="banner-content">
              <div className="banner-icon-bg" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <UserCheck size={28} />
              </div>
              <div className="banner-text">
                <h4 className="fw-bold mb-1 text-white">
                  {allotment.allotment_status === 'Allotted' ? 'Seat Allotted!' : 'Seat Not Allotted'}
                </h4>
                {allotment.allotment_status === 'Allotted' && (
                  <div className="mt-2 d-flex flex-column gap-1">
                    <div className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                      <span className="text-white-50" style={{ minWidth: 150 }}>Research Center:</span>
                      <span className="fw-bold text-white">{allotment.allotted_center_name || '—'}</span>
                    </div>
                    <div className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                      <span className="text-white-50" style={{ minWidth: 150 }}>Supervisor:</span>
                      <span className="fw-bold text-white">{allotment.allotted_supervisor_name || '—'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {allotment.allotment_status === 'Allotted' && (
              <button className="banner-btn" onClick={() => navigate('/counselling')} style={{ background: '#10b981', color: '#fff' }}>
                View Details <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {/* Draft banner */}
        {appStatus === 'Draft' && (
          <div className="action-banner" style={{ background: 'linear-gradient(135deg,#0f766e,#134e4a)' }}>
            <div className="banner-content">
              <div className="banner-icon-bg"><PlusCircle size={28} /></div>
              <div className="banner-text">
                <h4>Complete &amp; Submit Your Application</h4>
                <p>Fill all sections, then use "Review &amp; Submit" to finalize.</p>
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <button className="banner-btn" style={{ background: 'rgba(255,255,255,0.15)' }} onClick={() => navigate('/apply')}>
                Edit Form <ChevronRight size={18} />
              </button>
              <button className="banner-btn" style={{ background: '#10b981' }} onClick={() => navigate('/review')}>
                <Eye size={18} className="me-1" /> Review &amp; Submit
              </button>
            </div>
          </div>
        )}

        {/* Payment History */}
        {payHistory.length > 0 && (
          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-header bg-white rounded-top-4 py-2 d-flex align-items-center gap-2">
              <ReceiptText size={15} style={{ color: '#32c5d2' }} />
              <span className="fw-semibold" style={{ fontSize: 14 }}>Payment History</span>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3">Transaction ID</th>
                      <th>Mode</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payHistory.map(p => (
                      <tr key={p.id}>
                        <td className="ps-3 fw-semibold">{p.transaction_id || '—'}</td>
                        <td>{p.payment_mode || '—'}</td>
                        <td>
                          <span className={`badge ${p.payment_status === 'Success' ? 'bg-success' : 'bg-secondary'}`}>
                            {p.payment_status}
                          </span>
                        </td>
                        <td className="text-muted">
                          {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {appsClosed && (
          <div className="alert alert-warning border-0 shadow-sm rounded-4 d-flex align-items-center gap-3 p-3 px-4">
            <AlertCircle size={24} className="text-warning" />
            <div>
              <div className="fw-bold">Submissions Closed</div>
              <div className="small text-muted">The university has currently closed the application submission portal for this session.</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Dashboard;
