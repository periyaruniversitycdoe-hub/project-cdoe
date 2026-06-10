import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Search, Filter, Eye, CheckCircle, XCircle, Send, UserCheck,
  Building2, ChevronDown, ChevronUp, Download, RefreshCw,
  Clock, AlertCircle, CheckSquare, FileText, History,
  ArrowRight, Award, X, User, BookOpen, MapPin, Phone, Mail,
} from 'lucide-react';

const API     = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';
const getHdr  = () => ({ Authorization: `Bearer ${localStorage.getItem('adminToken')}` });

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_META = {
  Submitted:                      { label: 'Submitted',               color: '#6b7280', bg: '#f3f4f6' },
  Documents_Verified:             { label: 'Docs Verified',           color: '#0891b2', bg: '#e0f2fe' },
  Allocated:                      { label: 'Allocated',               color: '#7c3aed', bg: '#ede9fe' },
  Center_Allocated:               { label: 'Center Allocated',        color: '#7c3aed', bg: '#ede9fe' },
  Supervisor_Allocated:           { label: 'Supervisor Allocated',    color: '#c026d3', bg: '#fae8ff' },
  Forwarded_Center:               { label: 'At Research Center',      color: '#d97706', bg: '#fef3c7' },
  Center_Review_Completed:        { label: 'Center Review Done',      color: '#059669', bg: '#d1fae5' },
  Center_Evaluated:               { label: 'Center Evaluated',        color: '#059669', bg: '#d1fae5' },
  Forwarded_Supervisor:           { label: 'At Supervisor',           color: '#ea580c', bg: '#ffedd5' },
  Supervisor_Interview_Completed: { label: 'Interview Completed',     color: '#16a34a', bg: '#dcfce7' },
  Supervisor_Evaluated:           { label: 'Supervisor Evaluated',    color: '#16a34a', bg: '#dcfce7' },
  Final_Score_Calculated:         { label: 'Score Calculated',        color: '#0369a1', bg: '#e0f2fe' },
  Admin_Review:                   { label: 'Admin Review',            color: '#d97706', bg: '#fff7ed' },
  Approved:                       { label: 'Approved',                color: '#15803d', bg: '#bbf7d0' },
  Waitlisted:                     { label: 'Waitlisted',              color: '#b45309', bg: '#fde68a' },
  Rejected:                       { label: 'Rejected',                color: '#dc2626', bg: '#fee2e2' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{
      background: m.bg, color: m.color,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      border: `1px solid ${m.color}33`, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: '16px 20px', cursor: onClick ? 'pointer' : 'default',
      borderLeft: `4px solid ${color}`, transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value ?? 0}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Timeline item ──────────────────────────────────────────────────────────────
function TimelineItem({ item, isLast }) {
  return (
    <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: '#dbeafe', border: '2px solid #3b82f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle size={14} color="#2563eb" />
        </div>
        {!isLast && <div style={{ width: 2, flex: 1, background: '#e5e7eb', marginTop: 4 }} />}
      </div>
      <div style={{ paddingBottom: isLast ? 0 : 20, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>
          {item.action.replace(/_/g, ' ')}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
          {item.performed_by} · {item.role} ·{' '}
          {new Date(item.created_at).toLocaleString('en-IN')}
        </div>
        {item.remarks && (
          <div style={{
            marginTop: 6, padding: '6px 10px', background: '#f9fafb',
            border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#374151',
          }}>{item.remarks}</div>
        )}
      </div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHead({ title, icon: Icon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 0 8px', borderBottom: '2px solid #e5e7eb', marginBottom: 14,
    }}>
      <Icon size={16} color="#2563eb" />
      <span style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f' }}>{title}</span>
    </div>
  );
}

// ── Field row ──────────────────────────────────────────────────────────────────
function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, marginTop: 2 }}>{value || '—'}</div>
    </div>
  );
}

function FieldGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '0 24px' }}>{children}</div>;
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 900 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', padding: '24px 16px', overflowY: 'auto',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: width,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg,#1e3a5f,#2563eb)',
        }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: 8, cursor: 'pointer', padding: '6px 10px',
          }}><X size={16} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', maxHeight: '80vh' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Education table ─────────────────────────────────────────────────────────────
function EduTable({ rows = [], cols }) {
  if (!rows.length) return <p style={{ color: '#9ca3af', fontSize: 13 }}>No records</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {cols.map(c => (
                <td key={c.key} style={{ padding: '8px 10px', color: '#374151' }}>
                  {c.render ? c.render(r) : (r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function PermissionReviewAllocation() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [apps,      setApps]      = useState([]);
  const [stats,     setStats]     = useState({});
  const [centers,   setCenters]   = useState([]);
  const [supervisors, setSups]    = useState([]);
  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Filters
  const [filters, setFilters] = useState({
    session_id: 'active', workflow_status: '', community: '',
    gender: '', district: '', category: '', center_id: '', supervisor_id: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [viewApp,     setViewApp]     = useState(null);
  const [viewDetail,  setViewDetail]  = useState(null);
  const [historyApp,  setHistoryApp]  = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [allocApp,    setAllocApp]    = useState(null);
  const [decisionApp, setDecisionApp] = useState(null);

  // Forms
  const [allocForm,    setAllocForm]  = useState({ supervisor_id: '', allocation_date: '', remarks: '', academic_mark: '' });
  const [decisionForm, setDecForm]    = useState({ decision: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
      );
      const [appsRes, statsRes, centersRes, supsRes, sessRes] = await Promise.all([
        axios.get(`${API}/permission-review/applications?${params}`, { headers: getHdr() }),
        axios.get(`${API}/permission-review/stats?session_id=${filters.session_id || 'active'}`, { headers: getHdr() }),
        axios.get(`${API}/counselling/research-centers?active=1`, { headers: getHdr() }),
        axios.get(`${API}/counselling/research-supervisors`, { headers: getHdr() }),
        axios.get(`${API}/sessions`, { headers: getHdr() }),
      ]);
      setApps(appsRes.data.data || []);
      setStats(statsRes.data.data || {});
      setCenters(centersRes.data.data || []);
      setSups(supsRes.data.data || []);
      setSessions(sessRes.data.data || []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);


  // ── Actions ──────────────────────────────────────────────────────────────────
  const loadDetail = async (id) => {
    try {
      const res = await axios.get(`${API}/permission-review/applications/${id}`, { headers: getHdr() });
      setViewDetail(res.data.data);
    } catch { toast.error('Failed to load application details'); }
  };

  const loadHistory = async (id) => {
    try {
      const res = await axios.get(`${API}/permission-review/applications/${id}/history`, { headers: getHdr() });
      setHistoryData(res.data.data || []);
      setHistoryApp(id);
    } catch { toast.error('Failed to load history'); }
  };

  const act = async (url, body = {}, successMsg) => {
    setSaving(true);
    try {
      await axios.post(url, body, { headers: getHdr() });
      toast.success(successMsg);
      load();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
      return false;
    } finally { setSaving(false); }
  };

  const verifyDocs = (id) =>
    act(`${API}/permission-review/applications/${id}/verify-documents`, {}, 'Documents verified');

  const forwardCenter = (id) =>
    act(`${API}/permission-review/applications/${id}/forward-center`, {}, 'Forwarded to Research Center');

  const forwardSupervisor = (id) =>
    act(`${API}/permission-review/applications/${id}/forward-supervisor`, {}, 'Forwarded to Supervisor');

  const saveAlloc = async () => {
    if (!allocForm.supervisor_id) return toast.error('Select a Supervisor from the preference list');
    const ok = await act(
      `${API}/permission-review/applications/${allocApp.id}/allocate`,
      allocForm, 'Supervisor and Research Center allocated'
    );
    if (ok) { setAllocApp(null); setAllocForm({ supervisor_id: '', allocation_date: '', remarks: '', academic_mark: '' }); }
  };

  const saveDecision = async () => {
    if (!decisionForm.decision) return toast.error('Select a decision');
    const ok = await act(
      `${API}/permission-review/applications/${decisionApp.id}/final-decision`,
      decisionForm, `Application ${decisionForm.decision}`
    );
    if (ok) { setDecisionApp(null); setDecForm({ decision: '', remarks: '' }); }
  };

  const exportExcel = async () => {
    try {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
      );
      const res = await axios.get(`${API}/permission-review/export/excel?${params}`,
        { headers: getHdr(), responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href = url; a.download = `permission_review_${Date.now()}.xlsx`; a.click();
    } catch { toast.error('Export failed'); }
  };

  // ── Filter change ─────────────────────────────────────────────────────────────
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const centerName  = (id) => centers.find(c => c.id === id)?.center_name || '—';
  const supName     = (id) => supervisors.find(s => s.id === id)?.supervisor_name || '—';
  const ADMIN_URL   = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '0 0 40px' }}>

      {/* ── Page header ── */}
      <div style={{
        background: 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)',
        padding: '24px 28px', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Permission Review &amp; Allocation</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.75, fontSize: 13 }}>
            Review submitted permission forms · Allocate centers &amp; supervisors · Track workflow
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportExcel} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>
            <Download size={15} /> Export Excel
          </button>
          <button onClick={load} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard label="Total"               value={stats.total}                          color="#2563eb" onClick={() => setFilter('workflow_status', '')} />
          <StatCard label="Pending Review"      value={stats.pending_review}                 color="#6b7280" onClick={() => setFilter('workflow_status', 'Submitted')} />
          <StatCard label="Docs Verified"       value={stats.docs_verified}                  color="#0891b2" onClick={() => setFilter('workflow_status', 'Documents_Verified')} />
          <StatCard label="Allocated"           value={stats.allocated}                      color="#7c3aed" onClick={() => setFilter('workflow_status', 'Allocated')} />
          <StatCard label="At Center"           value={stats.forwarded_center}               color="#d97706" onClick={() => setFilter('workflow_status', 'Forwarded_Center')} />
          <StatCard label="Center Review Done"  value={stats.center_review_completed}        color="#059669" onClick={() => setFilter('workflow_status', 'Center_Review_Completed')} />
          <StatCard label="At Supervisor"       value={stats.forwarded_supervisor}           color="#ea580c" onClick={() => setFilter('workflow_status', 'Forwarded_Supervisor')} />
          <StatCard label="Interview Done"      value={stats.supervisor_interview_completed} color="#16a34a" onClick={() => setFilter('workflow_status', 'Supervisor_Interview_Completed')} />
          <StatCard label="Score Calculated"    value={stats.final_score_calculated}         color="#0369a1" onClick={() => setFilter('workflow_status', 'Final_Score_Calculated')} />
          <StatCard label="Approved"            value={stats.approved}                       color="#15803d" onClick={() => setFilter('workflow_status', 'Approved')} />
          <StatCard label="Rejected"            value={stats.rejected}                       color="#dc2626" onClick={() => setFilter('workflow_status', 'Rejected')} />
        </div>

        {/* ── Filters ── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 20px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 280px' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                placeholder="Search by name, app no, email, mobile…"
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px 9px 34px',
                  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Session */}
            <select value={filters.session_id} onChange={e => setFilter('session_id', e.target.value)}
              style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
              <option value="active">Active Session</option>
              <option value="all">All Sessions</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.month} {s.year}</option>)}
            </select>

            {/* Status */}
            <select value={filters.workflow_status} onChange={e => setFilter('workflow_status', e.target.value)}
              style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>

            <button onClick={() => setShowFilters(f => !f)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: showFilters ? '#eff6ff' : '#f9fafb',
              border: `1px solid ${showFilters ? '#93c5fd' : '#d1d5db'}`,
              color: showFilters ? '#2563eb' : '#374151',
              padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
              <Filter size={14} /> Filters {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {showFilters && (
            <div style={{
              borderTop: '1px solid #e5e7eb', padding: '16px 20px',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12,
              background: '#f9fafb',
            }}>
              {[
                { label: 'Category',   key: 'category',    opts: ['', 'Full Time', 'Part Time', 'Foreign National', 'NRI'] },
                { label: 'Community',  key: 'community',   opts: ['', 'OC', 'BC', 'BCM', 'MBC', 'DNC', 'SC', 'SCA', 'ST'] },
                { label: 'Gender',     key: 'gender',      opts: ['', 'Male', 'Female', 'Transgender'] },
              ].map(({ label, key, opts }) => (
                <div key={key}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</label>
                  <select value={filters[key]} onChange={e => setFilter(key, e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
                    {opts.map(o => <option key={o} value={o}>{o || `All ${label}s`}</option>)}
                  </select>
                </div>
              ))}

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Research Center</label>
                <select value={filters.center_id} onChange={e => setFilter('center_id', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
                  <option value="">All Centers</option>
                  {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Supervisor</label>
                <select value={filters.supervisor_id} onChange={e => setFilter('supervisor_id', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
                  <option value="">All Supervisors</option>
                  {supervisors.map(s => <option key={s.id} value={s.id}>{s.supervisor_name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={() => setFilters({
                  session_id: 'active', workflow_status: '', community: '',
                  gender: '', district: '', category: '', center_id: '', supervisor_id: '', search: '',
                })} style={{
                  padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
                  background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', width: '100%',
                }}>
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: 12 }}>Loading applications…</p>
              </div>
            ) : apps.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                <AlertCircle size={32} style={{ marginBottom: 12 }} />
                <p>No permission form applications found</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: '#f1f5f9', borderBottom: '2px solid #e5e7eb' }}>
                  <tr>
                    {['App No', 'Candidate', 'Category', 'Subject', 'Mobile',
                      'Status', 'Allocated Center', 'Allocated Supervisor',
                      'Submitted', 'Actions'].map(h => (
                      <th key={h} style={{
                        padding: '12px 14px', textAlign: 'left', fontWeight: 700,
                        color: '#374151', whiteSpace: 'nowrap', fontSize: 12,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app, idx) => {
                    const allocatedCenter = app.pa_center_name || app.allotted_center_name || '—';
                    const allocatedSup    = app.pa_supervisor_name || app.allotted_supervisor_name || '—';
                    return (
                      <tr key={app.id} style={{
                        background: idx % 2 === 0 ? '#fff' : '#fafafa',
                        borderBottom: '1px solid #f3f4f6',
                      }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                          {app.app_no || `#${app.id}`}
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{app.full_name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{app.user_email}</div>
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{app.category || '—'}</td>
                        <td style={{ padding: '12px 14px' }}>{app.subject || '—'}</td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{app.mobile || '—'}</td>
                        <td style={{ padding: '12px 14px' }}><StatusBadge status={app.workflow_status} /></td>
                        <td style={{ padding: '12px 14px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {allocatedCenter}
                        </td>
                        <td style={{ padding: '12px 14px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {allocatedSup}
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontSize: 12, color: '#6b7280' }}>
                          {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <ActionMenu app={app}
                            onView={() => { setViewApp(app); loadDetail(app.id); }}
                            onVerifyDocs={() => verifyDocs(app.id)}
                            onAlloc={() => { setAllocApp(app); setAllocForm({ supervisor_id: app.allotted_supervisor_id ? String(app.allotted_supervisor_id) : '', allocation_date: '', remarks: '', academic_mark: app.academic_mark ?? '' }); }}
                            onForwardCenter={() => forwardCenter(app.id)}
                            onForwardSup={() => forwardSupervisor(app.id)}
                            onDecision={() => { setDecisionApp(app); setDecForm({ decision: '', remarks: '' }); }}
                            onHistory={() => loadHistory(app.id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* MODALS                                                       */}
      {/* ════════════════════════════════════════════════════════════ */}

      {/* View Application Modal */}
      {viewApp && viewDetail && (
        <Modal title={`Application — ${viewDetail.app_no || viewApp.full_name}`} onClose={() => { setViewApp(null); setViewDetail(null); }} width={1100}>
          <ApplicationView
            detail={viewDetail}
            adminUrl={ADMIN_URL}
            onVerify={async () => {
              const ok = await verifyDocs(viewDetail.id);
              if (ok) {
                loadDetail(viewDetail.id);
              }
            }}
          />
        </Modal>
      )}

      {/* Workflow History Modal */}
      {historyApp && (
        <Modal title="Workflow History" onClose={() => setHistoryApp(null)} width={620}>
          {historyData.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>No workflow events yet</p>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {historyData.map((item, i) => (
                <TimelineItem key={item.id} item={item} isLast={i === historyData.length - 1} />
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ── Single Allocation Modal ── */}
      {allocApp && (
        <Modal title={`Allocation — ${allocApp.full_name}`} onClose={() => setAllocApp(null)} width={760}>
          {/* Student context */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {[
              { label: 'Subject',   value: allocApp.subject },
              { label: 'Category',  value: allocApp.category },
              { label: 'Community', value: allocApp.community },
            ].map(({ label, value }) => value ? (
              <div key={label} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f' }}>{value}</div>
              </div>
            ) : null)}
          </div>

          {/* Supervisor preferences — click to select */}
          {(allocApp.supervisor_preferences?.length > 0 || allocApp.preferences?.length > 0) && (
            <div style={{ marginBottom: 20 }}>
              <SectionHead title="Supervisor Preferences — Click to Select" icon={UserCheck} />
              {(allocApp.supervisor_preferences || allocApp.preferences || []).map((p, i) => {
                const isSelected = String(allocForm.supervisor_id) === String(p.supervisor_id || p.id);
                return (
                  <div key={i} onClick={() => setAllocForm(f => ({ ...f, supervisor_id: String(p.supervisor_id || p.id) }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderRadius: 10, border: `2px solid ${isSelected ? '#7c3aed' : '#e5e7eb'}`,
                      background: isSelected ? '#f5f3ff' : '#f8fafc', marginBottom: 8,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    <span style={{
                      background: isSelected ? '#7c3aed' : '#dbeafe', color: isSelected ? '#fff' : '#1d4ed8',
                      borderRadius: '50%', width: 26, height: 26,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, flexShrink: 0,
                    }}>{p.preference_order}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{p.supervisor_name}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        {p.center_name || p.research_center_name} · {p.designation || p.department}
                      </div>
                    </div>
                    {isSelected && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '3px 10px', borderRadius: 20 }}>Selected</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Center preferences (read-only reference) */}
          {allocApp.center_preferences?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionHead title="Center Preferences (Reference)" icon={Building2} />
              {allocApp.center_preferences.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: '#f8fafc', border: '1px solid #e5e7eb',
                  borderRadius: 8, marginBottom: 6,
                }}>
                  <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{p.preference_order}</span>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.center_name}</div>
                </div>
              ))}
            </div>
          )}

          {/* Auto-mapped center preview */}
          {allocForm.supervisor_id && (() => {
            const sel = [...(allocApp.supervisor_preferences || []), ...(allocApp.preferences || [])].find(p => String(p.supervisor_id || p.id) === String(allocForm.supervisor_id));
            const centerLabel = sel?.center_name || sel?.research_center_name;
            return centerLabel ? (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>AUTO-MAPPED CENTER: </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f' }}>{centerLabel}</span>
              </div>
            ) : null;
          })()}

          {/* Academic mark + date + remarks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Academic Mark (max 50)</label>
              <input type="number" min="0" max="50" step="0.01"
                value={allocForm.academic_mark}
                onChange={e => setAllocForm(f => ({ ...f, academic_mark: e.target.value }))}
                placeholder="e.g. 42.5"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Allocation Date</label>
              <input type="date" value={allocForm.allocation_date}
                onChange={e => setAllocForm(f => ({ ...f, allocation_date: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Remarks</label>
          <textarea value={allocForm.remarks} onChange={e => setAllocForm(f => ({ ...f, remarks: e.target.value }))}
            rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 20, resize: 'vertical', boxSizing: 'border-box' }} />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setAllocApp(null)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button onClick={saveAlloc} disabled={saving || !allocForm.supervisor_id} style={{
              padding: '10px 24px', background: '#7c3aed', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              opacity: (saving || !allocForm.supervisor_id) ? 0.6 : 1,
            }}>{saving ? 'Saving…' : 'Confirm Allocation'}</button>
          </div>
        </Modal>
      )}

      {/* Final Decision Modal */}
      {decisionApp && (
        <Modal title={`Final Decision — ${decisionApp.full_name}`} onClose={() => setDecisionApp(null)} width={620}>
          {/* Mark breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Academic Mark', value: decisionApp.academic_mark, max: 50,  color: '#2563eb' },
              { label: 'Entrance Mark', value: decisionApp.entrance_mark, max: 70,  color: '#0891b2' },
              { label: 'Interview Mark', value: decisionApp.interview_mark, max: 30, color: '#7c3aed' },
              { label: 'Final Score',   value: decisionApp.final_score,    max: 100, color: '#15803d' },
            ].map(({ label, value, max, color }) => (
              <div key={label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color }}>
                  {value !== null && value !== undefined ? Number(value).toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>{label}</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>/ {max}</div>
              </div>
            ))}
          </div>
          {/* Recommendations */}
          {(decisionApp.center_evaluation?.recommendation || decisionApp.supervisor_evaluation?.recommendation) && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {decisionApp.center_evaluation?.recommendation && (
                <div style={{ flex: 1, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#15803d' }}>Center: </span>{decisionApp.center_evaluation.recommendation}
                </div>
              )}
              {decisionApp.supervisor_evaluation?.recommendation && (
                <div style={{ flex: 1, padding: '8px 12px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#7c3aed' }}>Supervisor: </span>{decisionApp.supervisor_evaluation.recommendation}
                </div>
              )}
            </div>
          )}

          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Decision *</label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            {['Approved', 'Waitlisted', 'Rejected'].map(d => {
              const colors = { Approved: ['#15803d', '#dcfce7'], Waitlisted: ['#b45309', '#fef3c7'], Rejected: ['#dc2626', '#fee2e2'] };
              const [c, bg] = colors[d];
              const selected = decisionForm.decision === d;
              return (
                <button key={d} onClick={() => setDecForm(f => ({ ...f, decision: d }))} style={{
                  flex: 1, padding: '12px 8px', border: `2px solid ${selected ? c : '#e5e7eb'}`,
                  borderRadius: 10, background: selected ? bg : '#f9fafb',
                  cursor: 'pointer', fontWeight: 700, fontSize: 13, color: selected ? c : '#6b7280',
                  transition: 'all 0.15s',
                }}>{d}</button>
              );
            })}
          </div>

          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Remarks</label>
          <textarea value={decisionForm.remarks} onChange={e => setDecForm(f => ({ ...f, remarks: e.target.value }))}
            rows={3} placeholder="Add remarks for this decision…"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 20, resize: 'vertical', boxSizing: 'border-box' }} />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setDecisionApp(null)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button onClick={saveDecision} disabled={saving} style={{
              padding: '10px 24px', background: '#1e3a5f', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Saving…' : 'Submit Decision'}</button>
          </div>
        </Modal>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Action menu per row ────────────────────────────────────────────────────────
function ActionMenu({ app, onView, onVerifyDocs, onAlloc,
  onForwardCenter, onForwardSup, onDecision, onHistory }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = React.useRef(null);
  const ws = app.workflow_status;

  const btns = [
    { label: 'View Application',    icon: Eye,         action: onView,          always: true },
    { label: 'Workflow History',    icon: History,     action: onHistory,       always: true },
    { label: 'Verify Documents',    icon: CheckSquare, action: onVerifyDocs,    show: ws === 'Submitted' },
    { label: 'Allocation',          icon: UserCheck,   action: onAlloc,         show: ['Documents_Verified','Allocated','Center_Allocated','Supervisor_Allocated'].includes(ws) },
    { label: 'Forward → Center',   icon: ArrowRight,  action: onForwardCenter, show: ['Allocated','Center_Allocated','Supervisor_Allocated'].includes(ws) },
    { label: 'Forward → Supervisor',icon: ArrowRight,  action: onForwardSup,    show: ['Center_Review_Completed','Center_Evaluated'].includes(ws) },
    { label: 'Final Decision',      icon: Award,       action: onDecision,      show: ['Supervisor_Interview_Completed','Supervisor_Evaluated','Final_Score_Calculated','Admin_Review'].includes(ws) },
  ].filter(b => b.always || b.show);

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = btns.length * 40; // Approx menu height (40px per item)
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let top = rect.bottom + 4;
      
      // If not enough space below, and there is more space above, open upward
      if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        top = rect.top - menuHeight - 4;
      }
      
      setCoords({
        top: top,
        left: Math.max(10, rect.right - 200)
      });
    }
    setOpen(o => !o);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button ref={buttonRef} onClick={handleToggle} style={{
        padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe',
        borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2563eb',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        Actions <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'fixed', top: coords.top, left: coords.left,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000, minWidth: 200, overflow: 'hidden',
          }}>
            {btns.map(({ label, icon: Icon, action }) => (
              <button key={label} onClick={() => { setOpen(false); action(); }} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 16px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <Icon size={14} color="#6b7280" /> {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Full Application View ──────────────────────────────────────────────────────
function ApplicationView({ detail, adminUrl, onVerify }) {
  const [tab, setTab] = useState('personal');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [verifiedDocs, setVerifiedDocs] = useState({});
  const [verifying, setVerifying] = useState(false);

  const getDocUrl = (filePath) => {
    if (!filePath) return '';
    let path = filePath.replace(/\\/g, '/');
    const idx = path.indexOf('uploads/');
    if (idx !== -1) {
      return `${adminUrl}/${path.substring(idx)}`;
    }
    return `${adminUrl}/${path}`;
  };

  const handleVerifyAll = async () => {
    setVerifying(true);
    try {
      if (onVerify) await onVerify();
    } finally {
      setVerifying(false);
    }
  };

  const tabs = [
    { id: 'personal',   label: 'Personal',    icon: User },
    { id: 'research',   label: 'Research',     icon: BookOpen },
    { id: 'education',  label: 'Education',    icon: Award },
    { id: 'documents',  label: 'Documents',    icon: FileText },
    { id: 'preferences',label: 'Preferences',  icon: Building2 },
    { id: 'evaluations',label: 'Evaluations',  icon: CheckCircle },
    { id: 'history',    label: 'History',      icon: History },
  ];

  const allVerified = detail.documents?.every(d => !d.file_path || verifiedDocs[d.id]);

  return (
    <div>
      {/* Document Preview Modal */}
      {previewDoc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          zIndex: 2000, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 20
        }} onClick={() => setPreviewDoc(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 20,
            maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column',
            position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 20 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e3a5f' }}>{previewDoc.label}</h4>
              <div style={{ display: 'flex', gap: 10 }}>
                <a href={previewDoc.url} download target="_blank" rel="noreferrer" style={{
                  padding: '6px 14px', background: '#2563eb', color: '#fff',
                  borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-block'
                }}>Open / Download</a>
                <button onClick={() => setPreviewDoc(null)} style={{
                  background: '#ef4444', border: 'none', color: '#fff',
                  borderRadius: 6, cursor: 'pointer', padding: '6px 14px', fontSize: 12, fontWeight: 600
                }}>Close</button>
              </div>
            </div>
            <div style={{ overflow: 'auto', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f1f5f9', borderRadius: 8, padding: 10, minWidth: 600, minHeight: 400 }}>
              {previewDoc.url.toLowerCase().endsWith('.pdf') ? (
                <iframe src={previewDoc.url} style={{ width: '800px', height: '550px', border: 'none' }} title="PDF Preview" />
              ) : (
                <img src={previewDoc.url} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} alt="Preview" />
              )}
            </div>
          </div>
        </div>
      )}
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: '#f8fafc', borderRadius: 10, marginBottom: 20,
        border: '1px solid #e5e7eb', flexWrap: 'wrap',
      }}>
        <StatusBadge status={detail.workflow_status} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>App No: <strong>{detail.app_no || '—'}</strong></span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Submitted: {detail.submitted_at ? new Date(detail.submitted_at).toLocaleDateString('en-IN') : '—'}</span>
        {detail.final_decision && (
          <span style={{ fontSize: 12, fontWeight: 700, color: detail.final_decision === 'Approved' ? '#15803d' : '#dc2626' }}>
            Final: {detail.final_decision}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb', marginBottom: 20, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? '#2563eb' : '#6b7280',
            borderBottom: tab === t.id ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2, whiteSpace: 'nowrap',
          }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Personal ── */}
      {tab === 'personal' && (() => {
        const photoDoc = detail.documents?.find(d => {
          const type = (d.doc_type || d.document_type || '').toLowerCase();
          return type === 'photo' || type === 'photograph';
        });
        const sigDoc = detail.documents?.find(d => {
          const type = (d.doc_type || d.document_type || '').toLowerCase();
          return type === 'signature' || type === 'sign';
        });
        const photoUrl = photoDoc ? getDocUrl(photoDoc.file_path) : null;
        const sigUrl   = sigDoc ? getDocUrl(sigDoc.file_path) : null;

        return (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap-reverse', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 650px' }}>
              <SectionHead title="Personal Details" icon={User} />
              <FieldGrid>
                <Field label="Full Name"          value={detail.full_name} />
                <Field label="Applicant Name"     value={detail.applicant_name} />
                <Field label="Tamil Name"         value={detail.applicant_name_tamil} />
                <Field label="Date of Birth"      value={detail.dob ? new Date(detail.dob).toLocaleDateString('en-IN') : null} />
                <Field label="Gender"             value={detail.gender} />
                <Field label="Nationality"        value={detail.nationality} />
                <Field label="Religion"           value={detail.religion} />
                <Field label="Community"          value={detail.community} />
                <Field label="Category"           value={detail.category} />
                <Field label="Father / Parent"    value={detail.parent_name} />
                <Field label="Mobile"             value={detail.mobile} />
                <Field label="Email"              value={detail.email || detail.user_email} />
                <Field label="Physically Challenged" value={detail.is_physically_challenged ? `Yes — ${detail.pc_percentage}% (${detail.pc_type})` : 'No'} />
              </FieldGrid>

              <SectionHead title="Communication Address" icon={MapPin} />
              <FieldGrid>
                <Field label="Address Line 1" value={detail.address_1} />
                <Field label="Address Line 2" value={detail.address_2} />
                <Field label="Address Line 3" value={detail.address_3} />
                <Field label="District"       value={detail.district} />
                <Field label="State"          value={detail.state} />
                <Field label="Pincode"        value={detail.pincode} />
              </FieldGrid>

              {detail.part_time_category && (
                <>
                  <SectionHead title="Working Place (Part Time)" icon={MapPin} />
                  <FieldGrid>
                    <Field label="Category"     value={detail.part_time_category} />
                    <Field label="Designation"  value={detail.part_time_designation} />
                    <Field label="Area"         value={detail.part_time_area} />
                  </FieldGrid>
                </>
              )}
            </div>

            {/* Photo & Signature Card */}
            <div style={{
              width: 240, flexShrink: 0, background: '#f8fafc', border: '1px solid #e5e7eb',
              borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)', alignSelf: 'flex-start'
            }}>
              {/* Photo Box */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Candidate Photo</span>
                <div style={{
                  width: 140, height: 170, border: '1px solid #cbd5e1', borderRadius: 8,
                  background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  {photoUrl ? (
                    <img src={photoUrl} alt="Candidate" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>No Photo</span>
                  )}
                </div>
              </div>

              {/* Divider line */}
              <div style={{ height: 1, background: '#e2e8f0', width: '100%' }} />

              {/* Signature Box */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Signature</span>
                <div style={{
                  width: 180, height: 75, border: '1px solid #cbd5e1', borderRadius: 8,
                  background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  {sigUrl ? (
                    <img src={sigUrl} alt="Signature" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>No Signature</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Research ── */}
      {tab === 'research' && (
        <div>
          <SectionHead title="Research Details" icon={BookOpen} />
          <FieldGrid>
            <Field label="Category"           value={detail.category} />
            <Field label="Subject"            value={detail.subject} />
            <Field label="Working District"   value={detail.working_district} />
          </FieldGrid>

          <SectionHead title="Allocation Status" icon={Building2} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>ALLOCATED CENTER</div>
              <div style={{ fontWeight: 600, color: '#111827' }}>{detail.pa_center_name || detail.allotted_center_name || '— Not Yet Allocated —'}</div>
              {detail.center_allocation_date && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  {new Date(detail.center_allocation_date).toLocaleDateString('en-IN')}
                </div>
              )}
            </div>
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>ALLOCATED SUPERVISOR</div>
              <div style={{ fontWeight: 600, color: '#111827' }}>{detail.pa_supervisor_name || detail.allotted_supervisor_name || '— Not Yet Allocated —'}</div>
              {detail.supervisor_allocation_date && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  {new Date(detail.supervisor_allocation_date).toLocaleDateString('en-IN')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Education ── */}
      {tab === 'education' && (
        <div>
          <SectionHead title="School Education" icon={Award} />
          <EduTable rows={detail.school_education} cols={[
            { key: 'level',           label: 'Level' },
            { key: 'institution_name',label: 'Institution' },
            { key: 'passing_year',    label: 'Year' },
            { key: 'percentage',      label: '%' },
          ]} />

          <div style={{ marginTop: 20 }}>
            <SectionHead title="Higher Education" icon={Award} />
            <EduTable rows={detail.higher_education} cols={[
              { key: 'level',            label: 'Level' },
              { key: 'degree_name',      label: 'Degree' },
              { key: 'institution_name', label: 'Institution' },
              { key: 'university_name',  label: 'University' },
              { key: 'passing_year',     label: 'Year' },
              { key: 'score_value',      label: 'Score' },
              { key: 'score_type',       label: 'Type' },
            ]} />
          </div>

          {detail.qualifications?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <SectionHead title="Qualifying Examination" icon={CheckCircle} />
              <EduTable rows={detail.qualifications} cols={[
                { key: 'exam_name',        label: 'Examination' },
                { key: 'registration_no',  label: 'Reg No' },
                { key: 'month_year',       label: 'Month/Year' },
                { key: 'score',            label: 'Score' },
              ]} />
            </div>
          )}

          {detail.experience?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <SectionHead title="Experience" icon={Award} />
              <EduTable rows={detail.experience} cols={[
                { key: 'designation',      label: 'Designation' },
                { key: 'organization_name',label: 'Organization' },
                { key: 'from_year',        label: 'From' },
                { key: 'to_year',          label: 'To' },
                { key: 'total_years',      label: 'Years' },
              ]} />
            </div>
          )}
        </div>
      )}

      {/* ── Documents ── */}
      {tab === 'documents' && (
        <div>
          <SectionHead title="Uploaded Documents" icon={FileText} />
          {!detail.documents?.length ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>No documents found</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
                {detail.documents.map((doc, i) => {
                  const docUrl = getDocUrl(doc.file_path);
                  const isChecked = !!verifiedDocs[doc.id];
                  const label = (doc.doc_type || doc.document_type || 'Document').replace(/_/g, ' ').toUpperCase();
                  
                  return (
                    <div key={doc.id || i} style={{
                      background: '#f8fafc', border: '1px solid #e5e7eb',
                      borderRadius: 10, padding: '14px 16px',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                        {doc.file_path ? (
                          <button
                            onClick={() => setPreviewDoc({ label, url: docUrl })}
                            style={{
                              background: 'none', border: 'none', padding: 0,
                              fontSize: 13, color: '#2563eb', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600
                            }}
                          >
                            <Eye size={13} /> Preview / Download
                          </button>
                        ) : <span style={{ fontSize: 12, color: '#9ca3af' }}>Not uploaded</span>}
                      </div>
                      
                      {doc.file_path && (
                        <label style={{
                          display: 'flex', alignItems: 'center', gap: 8, marginTop: 14,
                          borderTop: '1px solid #e2e8f0', paddingTop: 10, cursor: 'pointer',
                          fontSize: 12, fontWeight: 600, color: isChecked ? '#16a34a' : '#475569'
                        }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setVerifiedDocs(prev => ({ ...prev, [doc.id]: !prev[doc.id] }));
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                          {isChecked ? 'Verified' : 'Verify Document'}
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              {detail.workflow_status === 'Submitted' && (
                <div style={{
                  marginTop: 24, padding: '16px 20px', background: '#eff6ff',
                  border: '1px solid #bfdbfe', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 12
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f' }}>Documents Verification Action</div>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4b5563' }}>
                      Please preview and check all uploaded documents to enable the "Verify All Documents" button.
                    </p>
                  </div>
                  <button
                    disabled={!allVerified || verifying}
                    onClick={handleVerifyAll}
                    style={{
                      padding: '10px 24px', background: '#2563eb', color: '#fff',
                      border: 'none', borderRadius: 8, cursor: allVerified ? 'pointer' : 'not-allowed',
                      fontSize: 13, fontWeight: 700, opacity: allVerified && !verifying ? 1 : 0.6,
                      display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s'
                    }}
                  >
                    {verifying ? 'Verifying...' : 'Verify All Documents'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Preferences ── */}
      {tab === 'preferences' && (
        <div>
          {/* Supervisor preferences */}
          <SectionHead title="Supervisor Preferences" icon={UserCheck} />
          {!(detail.supervisor_preferences?.length || detail.preferences?.length) ? (
            <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 20 }}>No supervisor preferences submitted</p>
          ) : (detail.supervisor_preferences || detail.preferences || []).map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '12px 16px', background: i % 2 === 0 ? '#f8fafc' : '#fff',
              border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 8,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{p.preference_order}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{p.supervisor_name}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{p.center_name || p.research_center_name} · {p.designation || p.department}</div>
              </div>
            </div>
          ))}

          {/* Center preferences */}
          {detail.center_preferences?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <SectionHead title="Research Center Preferences" icon={Building2} />
              {detail.center_preferences.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', background: i % 2 === 0 ? '#f8fafc' : '#fff',
                  border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 8,
                }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{p.preference_order}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{p.center_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Evaluations ── */}
      {tab === 'evaluations' && (
        <div>
          {/* Final Score Summary */}
          {(detail.academic_mark !== null && detail.academic_mark !== undefined) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Academic Mark', value: detail.academic_mark, max: 50,  color: '#2563eb' },
                { label: 'Entrance Mark', value: detail.entrance_mark, max: 70,  color: '#0891b2' },
                { label: 'Interview Mark',value: detail.interview_mark, max: 30, color: '#7c3aed' },
                { label: 'Final Score',   value: detail.final_score,   max: 100, color: '#15803d' },
              ].map(({ label, value, max, color }) => (
                <div key={label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value != null ? Number(value).toFixed(1) : '—'}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>{label}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>/ {max}</div>
                </div>
              ))}
            </div>
          )}

          <SectionHead title="Research Center Evaluation" icon={Building2} />
          {!detail.center_evaluation ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>Not yet evaluated by center</p>
          ) : (
            <EvalCard eval={detail.center_evaluation} criteria={[
              { key: 'academic_record',       label: 'Academic Record',      max: 20 },
              { key: 'research_aptitude',     label: 'Research Aptitude',    max: 20 },
              { key: 'subject_relevance',     label: 'Subject Relevance',    max: 20 },
              { key: 'research_proposal',     label: 'Research Proposal',    max: 20 },
              { key: 'interview_performance', label: 'Interview Performance',max: 20 },
            ]} totalMax={100} />
          )}

          <div style={{ marginTop: 24 }}>
            <SectionHead title="Supervisor Interview Evaluation" icon={UserCheck} />
            {!detail.supervisor_evaluation ? (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>Not yet evaluated by supervisor</p>
            ) : (
              <SupervisorEvalCard ev={detail.supervisor_evaluation} />
            )}
          </div>
        </div>
      )}

      {/* ── History ── */}
      {tab === 'history' && (
        <div>
          <SectionHead title="Workflow History" icon={History} />
          {!detail.workflow_history?.length ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>No workflow events yet</p>
          ) : detail.workflow_history.map((item, i) => (
            <TimelineItem key={item.id} item={item} isLast={i === detail.workflow_history.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Supervisor Interview Eval Card (new format) ───────────────────────────────
function SupervisorEvalCard({ ev }) {
  const recColors = { Recommended: '#15803d', Waitlisted: '#b45309', Rejected: '#dc2626' };
  const color = recColors[ev.recommendation] || '#6b7280';
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ background: color + '20', color, padding: '4px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13 }}>
          {ev.recommendation || '—'}
        </span>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f' }}>
          {ev.interview_mark != null ? Number(ev.interview_mark).toFixed(1) : '—'}<span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280' }}> / 30</span>
        </span>
      </div>
      {ev.interview_remarks && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#374151' }}>
          <strong>Interview Remarks:</strong> {ev.interview_remarks}
        </div>
      )}
    </div>
  );
}

// ── Evaluation Score Card ──────────────────────────────────────────────────────
function EvalCard({ eval: ev, criteria, totalMax }) {
  const total = criteria.reduce((s, c) => s + (ev[c.key] || 0), 0);
  const recColors = {
    Recommended: '#15803d', Accept: '#15803d',
    Waitlisted: '#b45309',  Waitlist: '#b45309',
    Rejected: '#dc2626',    Reject: '#dc2626',
  };
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <span style={{
          background: (recColors[ev.recommendation] || '#6b7280') + '20',
          color: recColors[ev.recommendation] || '#6b7280',
          padding: '4px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13,
        }}>{ev.recommendation}</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f' }}>
          {total} <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280' }}>/ {totalMax}</span>
        </span>
      </div>
      {criteria.map(c => (
        <div key={c.key} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
            <span style={{ color: '#374151' }}>{c.label}</span>
            <span style={{ fontWeight: 700, color: '#111827' }}>{ev[c.key] || 0} / {c.max}</span>
          </div>
          <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4 }}>
            <div style={{
              height: '100%', background: '#2563eb', borderRadius: 4,
              width: `${((ev[c.key] || 0) / c.max) * 100}%`,
            }} />
          </div>
        </div>
      ))}
      {ev.remarks && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#374151' }}>
          <strong>Remarks:</strong> {ev.remarks}
        </div>
      )}
    </div>
  );
}
