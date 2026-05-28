import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Users, FileCheck, Clock, AlertCircle, FileText, UserCheck,
  CreditCard, CheckCircle, RefreshCw, Award, Ticket, GraduationCap,
  TrendingUp, BarChart3, Calendar, ShieldCheck, XCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSession } from '../contexts/SessionContext';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

// ─── Metric Card ──────────────────────────────────────────────────────────────
const MetricCard = ({ color, icon: Icon, count, label, loading, sub }) => (
  <div style={{
    background: color, color: '#fff', padding: '18px 20px', borderRadius: 8,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)', minHeight: 90
  }}>
    <div>
      <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
        {loading ? <span style={{ opacity: 0.5 }}>—</span> : (count ?? 0)}
      </div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{sub}</div>}
    </div>
    <Icon size={40} style={{ opacity: 0.2 }} />
  </div>
);

// ─── Date presets ─────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

const Dashboard = () => {
  const { sessions, activeSession, sessionLabel } = useSession();
  const [stats,    setStats]    = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [aLoading, setALoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState('active');
  const [period,   setPeriod]   = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const applyPreset = (preset) => {
    setPeriod(preset);
    if (preset === 'today')     { setFromDate(today());     setToDate(today()); }
    if (preset === 'yesterday') { setFromDate(yesterday()); setToDate(yesterday()); }
    if (preset === 'month')     { setFromDate(monthStart()); setToDate(today()); }
    if (preset === 'all')       { setFromDate('');          setToDate(''); }
  };

  // Accept signal so each effect can cancel the in-flight request on cleanup.
  const fetchStats = useCallback(async (signal) => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/applications/stats?session_id=${sessionFilter}`,
        { headers, signal }
      );
      setStats(res.data.data);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') toast.error('Failed to load stats');
    } finally { setLoading(false); }
  }, [sessionFilter]);

  const fetchAnalytics = useCallback(async (signal) => {
    setALoading(true);
    try {
      const params = new URLSearchParams({ session_id: sessionFilter });
      if (fromDate) params.set('from_date', fromDate);
      if (toDate)   params.set('to_date',   toDate);
      const res = await axios.get(`${API_URL}/results/analytics?${params}`, { headers, signal });
      setAnalytics(res.data.data);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') { /* non-critical — silent */ }
    } finally { setALoading(false); }
  }, [sessionFilter, fromDate, toDate]);

  useEffect(() => {
    const ac = new AbortController();
    fetchStats(ac.signal);
    return () => ac.abort();
  }, [fetchStats]);

  useEffect(() => {
    const ac = new AbortController();
    fetchAnalytics(ac.signal);
    return () => ac.abort();
  }, [fetchAnalytics]);

  const getStatusBadge = (status) => ({
    'Approved':     'bg-success text-white',
    'Rejected':     'bg-danger text-white',
    'Submitted':    'bg-info text-white',
    'Under Review': 'bg-warning text-dark',
    'Draft':        'bg-secondary text-white',
  }[status] || 'bg-secondary text-white');

  const metricCards = [
    { color: '#2980b9', icon: Users,        count: analytics?.totalRegistrations,   label: 'Total Registrations' },
    { color: '#e67e22', icon: AlertCircle,  count: analytics?.pendingPayment,       label: 'Pending Payments' },
    { color: '#8e44ad', icon: ShieldCheck,  count: analytics?.directPassCount,      label: 'Direct Pass' },
    { color: '#2ecc71', icon: Ticket,       count: analytics?.hallTicketsDownloaded,label: 'Hall Tickets Downloaded' },
    { color: '#3498db', icon: Award,        count: analytics?.totalPresent,         label: 'Total Appeared' },
    { color: '#1abc9c', icon: CheckCircle,  count: analytics?.totalPassed,          label: 'Total Passed' },
    { color: '#e74c3c', icon: XCircle,      count: analytics?.totalFailed,          label: 'Total Failed' },
    { color: '#f39c12', icon: GraduationCap,count: analytics?.counsellingEligible,  label: 'Counselling Eligible' },
  ];

  const legacyCards = [
    { color: '#2980b9', icon: Users,       count: stats?.total,      label: 'All Applications' },
    { color: '#f39c12', icon: FileText,    count: stats?.draft,       label: 'Draft' },
    { color: '#3498db', icon: FileCheck,   count: stats?.submitted,   label: 'Submitted' },
    { color: '#8e44ad', icon: Clock,       count: stats?.review,      label: 'Under Review' },
    { color: '#27ae60', icon: UserCheck,   count: stats?.approved,    label: 'Approved' },
    { color: '#e74c3c', icon: AlertCircle, count: stats?.rejected,    label: 'Rejected' },
    { color: '#e67e22', icon: CreditCard,  count: stats?.payPending,  label: 'Pay Pending' },
    { color: '#16a085', icon: CheckCircle, count: stats?.payReceived, label: 'Pay Received' },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-4">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>Admin Dashboard</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 12 }}>
              <li className="breadcrumb-item active">Home</li>
              <li className="breadcrumb-item active">Dashboard</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto', fontSize: 12 }}
            value={sessionFilter}
            onChange={e => setSessionFilter(e.target.value)}
          >
            <option value="active">Active Session {activeSession ? `(${sessionLabel(activeSession)})` : ''}</option>
            <option value="all">All Sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
          </select>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => { fetchStats(); fetchAnalytics(); }} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Date Filter Panel ── */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Calendar size={16} className="text-muted" />
            <span className="fw-semibold small text-muted me-1">Date Filter:</span>
            {[
              { key: 'today',     label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'month',     label: 'This Month' },
              { key: 'all',       label: 'All Time' },
            ].map(p => (
              <button
                key={p.key}
                className={`btn btn-sm ${period === p.key ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: 11 }}
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
            <div className="d-flex align-items-center gap-1 ms-2">
              <span className="small text-muted">From:</span>
              <input
                type="date" className="form-control form-control-sm" style={{ width: 140, fontSize: 12 }}
                value={fromDate}
                onChange={e => { setFromDate(e.target.value); setPeriod('custom'); }}
              />
              <span className="small text-muted">To:</span>
              <input
                type="date" className="form-control form-control-sm" style={{ width: 140, fontSize: 12 }}
                value={toDate}
                onChange={e => { setToDate(e.target.value); setPeriod('custom'); }}
              />
            </div>
            {(fromDate || toDate) && (
              <button className="btn btn-sm btn-link text-danger p-0" onClick={() => { setFromDate(''); setToDate(''); setPeriod(''); }}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Analytics Cards (date-filtered) ── */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <TrendingUp size={16} style={{ color: '#32c5d2' }} />
        <h6 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 13 }}>
          Analytics {fromDate || toDate ? `(${fromDate || '…'} → ${toDate || '…'})` : '(All Time)'}
        </h6>
        {aLoading && <span className="spinner-border spinner-border-sm text-secondary ms-1" style={{ width: 14, height: 14 }} />}
      </div>
      <div className="row g-3 mb-4">
        {metricCards.map(c => (
          <div key={c.label} className="col-xl-2 col-lg-3 col-md-4 col-sm-6">
            <MetricCard {...c} loading={aLoading} />
          </div>
        ))}
      </div>

      {/* ── Application Status Overview ── */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <BarChart3 size={16} style={{ color: '#32c5d2' }} />
        <h6 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 13 }}>Application Status Overview</h6>
      </div>
      <div className="row g-3 mb-4">
        {legacyCards.map(c => (
          <div key={c.label} className="col-xl-3 col-lg-4 col-md-6">
            <MetricCard {...c} loading={loading} />
          </div>
        ))}
      </div>

      {/* ── Monthly Trend ── */}
      {!aLoading && analytics?.monthly?.length > 0 && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h6 className="mb-0 fw-bold" style={{ color: '#32c5d2' }}>Monthly Registration Trend</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                <thead className="table-light">
                  <tr>
                    <th className="ps-4 py-2">Month</th>
                    <th className="py-2">Registrations</th>
                    <th className="py-2">Approved</th>
                    <th className="py-2">Paid</th>
                    <th className="py-2 pe-4">Approval Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.monthly.map((m, i) => (
                    <tr key={i}>
                      <td className="ps-4 fw-semibold">{m.month}</td>
                      <td>{m.registrations}</td>
                      <td>
                        <span className="badge bg-success">{m.approved || 0}</span>
                      </td>
                      <td>
                        <span className="badge bg-info">{m.paid || 0}</span>
                      </td>
                      <td className="pe-4">
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{ height: 6 }}>
                            <div
                              className="progress-bar bg-success"
                              style={{ width: `${m.registrations > 0 ? Math.round((m.approved || 0) / m.registrations * 100) : 0}%` }}
                            />
                          </div>
                          <span style={{ fontSize: 11, color: '#666', minWidth: 36 }}>
                            {m.registrations > 0 ? Math.round((m.approved || 0) / m.registrations * 100) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Notifications Queue ── */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white d-flex align-items-center justify-content-between py-3 border-bottom-0">
          <h6 className="mb-0 fw-bold" style={{ color: '#32c5d2' }}>
            <AlertCircle size={18} className="me-2 text-warning" /> 
            Payment Action Queue
            {stats?.pendingVerifications > 0 && (
              <span className="badge bg-danger rounded-pill ms-2">{stats.pendingVerifications} Alerts</span>
            )}
          </h6>
          <Link to="/payments" className="btn btn-sm btn-outline-primary" style={{ fontSize: 12 }}>Check Queue</Link>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
              <thead className="table-light">
                <tr>
                  <th className="ps-4 py-3">Time</th>
                  <th className="py-3">App ID</th>
                  <th className="py-3">Amount</th>
                  <th className="py-3">Method</th>
                  <th className="py-3">Transaction Info</th>
                  <th className="py-3 text-end pe-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-4 text-muted">Loading alerts...</td></tr>
                ) : !stats?.paymentAlerts?.length ? (
                  <tr><td colSpan={6} className="text-center py-4 text-muted">Queue is clear! No payments pending verification.</td></tr>
                ) : stats.paymentAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td className="ps-4 text-muted" style={{ fontSize: 12 }}>
                      {new Date(alert.created_at).toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </td>
                    <td className="fw-bold text-primary">{alert.application_id}</td>
                    <td className="fw-semibold text-dark">₹{alert.amount}</td>
                    <td><span className="badge border text-dark" style={{background: '#f8f9fa'}}>{alert.payment_method}</span></td>
                    <td className="text-muted font-monospace small">{alert.transaction_id}</td>
                    <td className="text-end pe-4">
                      <span className="badge bg-warning text-dark"><AlertCircle size={12} className="me-1" /> Pending</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Recent Applications ── */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white d-flex align-items-center justify-content-between py-3">
          <h6 className="mb-0 fw-bold" style={{ color: '#32c5d2' }}>Recent Applications</h6>
          <Link to="/applications" className="btn btn-sm btn-outline-secondary" style={{ fontSize: 12 }}>View All</Link>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
              <thead className="table-light">
                <tr>
                  <th className="ps-4 py-3">S.No</th>
                  <th className="py-3">Application ID</th>
                  <th className="py-3">Applicant Name</th>
                  <th className="py-3">Subject</th>
                  <th className="py-3">Date</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-end pe-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-5 text-muted">Loading...</td></tr>
                ) : !stats?.recent?.length ? (
                  <tr><td colSpan={7} className="text-center py-5 text-muted">No applications found for this session</td></tr>
                ) : stats.recent.map((app, i) => (
                  <tr key={app.id}>
                    <td className="ps-4">{i + 1}</td>
                    <td className="fw-bold text-primary" style={{ fontSize: 12 }}>{app.application_id}</td>
                    <td className="fw-semibold">{app.full_name}</td>
                    <td className="text-muted">{app.subject || '—'}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>
                      {new Date(app.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <span className={`badge rounded-pill px-3 py-1 ${getStatusBadge(app.status)}`} style={{ fontSize: 11 }}>
                        {app.status}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <Link to={`/applications/${app.id}`} className="btn btn-sm btn-outline-info border-0" style={{ fontSize: 11 }}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
