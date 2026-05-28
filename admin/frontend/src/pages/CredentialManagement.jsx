import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Users, GraduationCap, UserSquare2, Building2, Search, RefreshCw,
  Eye, EyeOff, Trash2, X, ChevronLeft, ChevronRight, CheckCircle, Mail, KeyRound
} from 'lucide-react';

const API    = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/credential-logs';
const authHdr = () => ({ Authorization: `Bearer ${localStorage.getItem('adminToken')}` });

const PORTAL_META = {
  Student:    { color: '#0d6efd', bg: '#e7f0ff', icon: GraduationCap, label: 'Student'    },
  Supervisor: { color: '#6f42c1', bg: '#f0ebff', icon: UserSquare2,   label: 'Supervisor' },
  Center:     { color: '#0dcaf0', bg: '#e0f9ff', icon: Building2,     label: 'Center'     },
  Admin:      { color: '#dc3545', bg: '#fff0f0', icon: Users,         label: 'Admin'      },
};

const Badge = ({ type }) => {
  const m = PORTAL_META[type] || { color: '#6c757d', bg: '#f8f9fa', label: type };
  return (
    <span style={{
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}40`,
      borderRadius: 4, padding: '2px 8px',
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3
    }}>
      {m.label}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, color, bg, active, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: active ? color : '#fff',
      border: `2px solid ${active ? color : '#e9ecef'}`,
      borderRadius: 10, padding: '16px 20px',
      cursor: 'pointer', transition: 'all 0.18s',
      boxShadow: active ? `0 4px 14px ${color}30` : '0 1px 4px rgba(0,0,0,0.06)',
      flex: 1, minWidth: 130
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 8,
        background: active ? 'rgba(255,255,255,0.25)' : bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={20} color={active ? '#fff' : color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: active ? '#fff' : '#1a202c', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.85)' : '#718096', fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  </div>
);

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const DetailModal = ({ log, onClose, onDelete }) => {
  const [showPass, setShowPass] = useState(false);
  if (!log) return null;
  const m = PORTAL_META[log.portal_type] || {};

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{ background: `linear-gradient(135deg, ${m.color || '#0d6efd'}, ${m.color || '#0d6efd'}cc)`, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{log.user_name}</div>
            <Badge type={log.portal_type} />
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#fff', lineHeight: 1 }}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px' }}>
          {[
            { label: 'Email / Username', value: log.email },
            { label: 'Portal', value: `${log.portal_type} Portal` },
            { label: 'Registered At', value: new Date(log.created_at).toLocaleString('en-IN') },
            { label: 'Account Status', value: log.account_status },
            { label: 'Email Sent', value: log.email_sent ? '✅ Yes' : '❌ No' },
            ...(log.password_changed ? [
              { label: 'Password Changed', value: '✅ Yes' },
              { label: 'Changed At', value: log.password_changed_at ? new Date(log.password_changed_at).toLocaleString('en-IN') : '—' },
              { label: 'Changed From IP', value: log.password_change_ip || '—' },
            ] : [
              { label: 'Password Changed', value: '— Never changed' },
            ]),
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', padding: '9px 0', alignItems: 'flex-start' }}>
              <div style={{ width: 145, fontSize: 12, color: '#718096', fontWeight: 600, flexShrink: 0 }}>{row.label}</div>
              <div style={{ fontSize: 13, color: '#2d3748', fontWeight: 500 }}>{row.value}</div>
            </div>
          ))}

          {/* Password row */}
          <div style={{ display: 'flex', padding: '9px 0', alignItems: 'center' }}>
            <div style={{ width: 145, fontSize: 12, color: '#718096', fontWeight: 600, flexShrink: 0 }}>Password</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <code style={{ fontSize: 14, color: m.color || '#0d6efd', fontWeight: 700, letterSpacing: 1, background: m.bg || '#e7f0ff', padding: '3px 10px', borderRadius: 5 }}>
                {showPass ? log.plain_password : '••••••••'}
              </code>
              <button onClick={() => setShowPass(p => !p)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#718096', padding: 2 }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {log.login_url && (
            <div style={{ marginTop: 16 }}>
              <a href={log.login_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: m.color, textDecoration: 'none', fontWeight: 600 }}>
                🔗 {log.login_url}
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '12px 24px', background: '#f8f9fa', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => { onDelete(log.id); onClose(); }}
            style={{ background: 'none', border: '1px solid #dc3545', color: '#dc3545', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Trash2 size={13} /> Delete
          </button>
          <button onClick={onClose} style={{ background: m.color || '#0d6efd', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CredentialManagement = () => {
  const [logs, setLogs]         = useState([]);
  const [summary, setSummary]   = useState({ total: 0, Student: 0, Supervisor: 0, Center: 0, Admin: 0 });
  const [meta, setMeta]         = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [portal, setPortal]     = useState('');
  const [page, setPage]         = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const [visiblePass, setVisiblePass] = useState({});

  const fetchLogs = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await axios.get(API, {
        headers: authHdr(),
        params: { page, limit: 20, search, portal, ...params }
      });
      if (res.data.success) {
        setLogs(res.data.data);
        setSummary(res.data.summary || {});
        setMeta(res.data.meta || {});
      }
    } catch {
      toast.error('Failed to load credential logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, portal]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handlePortalFilter = (p) => {
    setPortal(prev => prev === p ? '' : p);
    setPage(1);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this credential log? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/${id}`, { headers: authHdr() });
      setLogs(prev => prev.filter(l => l.id !== id));
      setSummary(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      toast.success('Credential log deleted');
    } catch {
      toast.error('Failed to delete log');
    }
  };

  const togglePassVisible = (id) => setVisiblePass(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="container-fluid py-4">
      {/* Page Title */}
      <div className="mb-4">
        <h2 className="fw-bold mb-1" style={{ color: '#32c5d2' }}>User Credential Management</h2>
        <p className="text-muted small mb-0">Monitor all newly registered accounts across every portal — credentials, portal type, registration time.</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="All Portals" value={summary.total || 0} icon={Users} color="#2d3748" bg="#f1f3f5" active={portal === ''} onClick={() => handlePortalFilter('')} />
        {Object.entries(PORTAL_META).map(([key, m]) => (
          <StatCard key={key} label={m.label} value={summary[key] || 0} icon={m.icon} color={m.color} bg={m.bg} active={portal === key} onClick={() => handlePortalFilter(key)} />
        ))}
      </div>

      {/* Toolbar */}
      <div className="card shadow-sm mb-0 border-0" style={{ borderRadius: 10, overflow: 'hidden' }}>
        <div className="card-header bg-white border-bottom py-3 px-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
            <Search size={16} className="text-muted" />
            <input
              type="text"
              className="form-control form-control-sm border-0 shadow-none"
              placeholder="Search by name or email…"
              value={search}
              onChange={handleSearch}
              style={{ maxWidth: 320 }}
            />
          </div>
          <div className="d-flex gap-2 align-items-center">
            <span className="text-muted small">{meta.total} record{meta.total !== 1 ? 's' : ''}</span>
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => fetchLogs()} style={{ fontSize: 12 }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
            <thead style={{ background: '#f8f9fa' }}>
              <tr>
                <th style={{ fontWeight: 700, color: '#4a5568', padding: '12px 16px', whiteSpace: 'nowrap' }}>#</th>
                <th style={{ fontWeight: 700, color: '#4a5568', padding: '12px 16px' }}>Name</th>
                <th style={{ fontWeight: 700, color: '#4a5568', padding: '12px 16px' }}>Email / Username</th>
                <th style={{ fontWeight: 700, color: '#4a5568', padding: '12px 16px' }}>Password</th>
                <th style={{ fontWeight: 700, color: '#4a5568', padding: '12px 16px' }}>Portal</th>
                <th style={{ fontWeight: 700, color: '#4a5568', padding: '12px 16px' }}>Status</th>
                <th style={{ fontWeight: 700, color: '#4a5568', padding: '12px 16px', whiteSpace: 'nowrap' }}>Email Sent</th>
                <th style={{ fontWeight: 700, color: '#4a5568', padding: '12px 16px', whiteSpace: 'nowrap' }}>Pwd Changed</th>
                <th style={{ fontWeight: 700, color: '#4a5568', padding: '12px 16px', whiteSpace: 'nowrap' }}>Registered At</th>
                <th style={{ fontWeight: 700, color: '#4a5568', padding: '12px 16px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-5 text-muted">
                  <div className="spinner-border spinner-border-sm me-2" role="status" />
                  Loading credentials…
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-5 text-muted">
                  <Users size={32} className="mb-2 d-block mx-auto opacity-25" />
                  No credential logs found.
                </td></tr>
              ) : logs.map((log, idx) => {
                const m    = PORTAL_META[log.portal_type] || {};
                const show = visiblePass[log.id];
                return (
                  <tr key={log.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLog(log)}>
                    <td style={{ padding: '11px 16px', color: '#a0aec0', fontWeight: 600 }}>
                      {(page - 1) * 20 + idx + 1}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <div className="fw-semibold text-dark">{log.user_name}</div>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#4a5568' }}>{log.email}</td>
                    <td style={{ padding: '11px 16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <code style={{
                          fontSize: 13, color: m.color || '#0d6efd', fontWeight: 700,
                          background: m.bg || '#e7f0ff', padding: '2px 8px', borderRadius: 4,
                          letterSpacing: show ? 1 : 2
                        }}>
                          {show ? log.plain_password : '••••••••'}
                        </code>
                        <button
                          onClick={() => togglePassVisible(log.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718096', padding: 2 }}
                          title={show ? 'Hide' : 'Show'}
                        >
                          {show ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px' }}><Badge type={log.portal_type} /></td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{
                        background: log.account_status === 'Active' ? '#d1fae5' : '#fee2e2',
                        color:      log.account_status === 'Active' ? '#065f46' : '#991b1b',
                        borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700
                      }}>
                        {log.account_status}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      {log.email_sent
                        ? <CheckCircle size={15} color="#16a34a" />
                        : <Mail size={15} color="#9ca3af" />}
                    </td>
                    <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                      {log.password_changed ? (
                        <div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
                            <KeyRound size={11} /> Changed
                          </span>
                          {log.password_changed_at && (
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                              {new Date(log.password_changed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#718096', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '11px 16px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-xs btn-outline-primary"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => setSelectedLog(log)}
                          title="View Details"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          className="btn btn-xs btn-outline-danger"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => handleDelete(log.id)}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.pages > 1 && (
          <div className="card-footer bg-white border-top d-flex align-items-center justify-content-between px-4 py-2">
            <span className="text-muted small">Page {meta.page} of {meta.pages}</span>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                style={{ fontSize: 12 }}
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                disabled={page >= meta.pages}
                onClick={() => setPage(p => p + 1)}
                style={{ fontSize: 12 }}
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <DetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default CredentialManagement;
