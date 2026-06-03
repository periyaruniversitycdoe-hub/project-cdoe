import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import {
  GitFork, CheckCircle2, XCircle, AlertTriangle, RotateCcw,
  Search, Filter, RefreshCw, X, ChevronLeft, ChevronRight,
  Mail, Clock, Zap, TrendingUp, Eye
} from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/mail';

function authHeaders() {
  const token = localStorage.getItem('adminToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_META = {
  delivered_primary:  { label: 'Primary (Nodemailer)', color: '#10b981', bg: '#d1fae5', icon: CheckCircle2 },
  delivered_fallback: { label: 'Fallback (Brevo)',      color: '#f59e0b', bg: '#fef3c7', icon: AlertTriangle },
  failed_both:        { label: 'Failed Both',           color: '#ef4444', bg: '#fee2e2', icon: XCircle },
  in_progress:        { label: 'In Progress',           color: '#6366f1', bg: '#ede9fe', icon: RotateCcw },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: '#6b7280', bg: '#f3f4f6', icon: Mail };
  const Icon = m.icon;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px',
      borderRadius:20, fontSize:11, fontWeight:600, color:m.color, background:m.bg }}>
      <Icon size={11} /> {m.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div style={{ background:'#fff', borderRadius:10, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)',
      borderLeft:`4px solid ${color}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div>
        <div style={{ fontSize:26, fontWeight:700, color:'#1e293b' }}>{value ?? '—'}</div>
        <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:color, marginTop:2, fontWeight:600 }}>{sub}</div>}
      </div>
      <div style={{ background:`${color}18`, borderRadius:8, padding:10 }}>
        <Icon size={22} color={color} />
      </div>
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function DetailModal({ row, onClose }) {
  if (!row) return null;
  const m = STATUS_META[row.delivery_status] || {};
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:580,
        maxHeight:'90vh', overflowY:'auto', padding:28 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'#1e293b' }}>Delivery Detail</h2>
            <code style={{ fontSize:11, color:'#64748b' }}>{row.ref_id}</code>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', padding:4 }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        <StatusBadge status={row.delivery_status} />

        {[
          ['Recipient',      row.to_email],
          ['Subject',        row.subject],
          ['Template',       row.template_name || '—'],
          ['Primary',        row.primary_provider],
          ['Fallback',       row.fallback_provider],
          ['Delivered By',   row.delivered_by || 'None'],
          ['Fallback Used',  row.fallback_triggered ? '⚠️  Yes' : 'No'],
          ['Duration',       row.processing_duration_ms != null ? `${row.processing_duration_ms} ms` : '—'],
          ['Created',        row.created_at ? new Date(row.created_at).toLocaleString() : '—'],
          ['Sent At',        row.sent_at ? new Date(row.sent_at).toLocaleString() : '—'],
          ['Primary MsgId',  row.primary_message_id || '—'],
          ['Fallback MsgId', row.fallback_message_id || '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ display:'flex', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
            <div style={{ width:140, fontSize:12, color:'#64748b', flexShrink:0 }}>{k}</div>
            <div style={{ fontSize:12, color:'#1e293b', wordBreak:'break-all' }}>{v}</div>
          </div>
        ))}

        {row.primary_error && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#b45309', marginBottom:4 }}>Primary Error (Nodemailer)</div>
            <pre style={{ background:'#fef3c7', borderRadius:6, padding:10, fontSize:11,
              color:'#92400e', margin:0, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{row.primary_error}</pre>
          </div>
        )}
        {row.fallback_error && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#991b1b', marginBottom:4 }}>Fallback Error (Brevo)</div>
            <pre style={{ background:'#fee2e2', borderRadius:6, padding:10, fontSize:11,
              color:'#7f1d1d', margin:0, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{row.fallback_error}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EmailDeliveryLog() {
  const [stats,   setStats]   = useState(null);
  const [rows,    setRows]    = useState([]);
  const [pagination, setPagi] = useState({ total:0, page:1, pages:1, limit:50 });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const [filters, setFilters] = useState({
    status: '', provider: '', fallback_only: false,
    from_date: '', to_date: '', search: '',
    page: 1, limit: 50,
  });

  const fetchStats = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/delivery-stats`, { headers: authHeaders() });
      if (r.data.success) setStats(r.data.data);
    } catch { /* non-fatal */ }
  }, []);

  const fetchLog = useCallback(async (f = filters) => {
    setLoading(true);
    try {
      const params = {
        page:          f.page,
        limit:         f.limit,
        ...(f.status        && { status:        f.status }),
        ...(f.provider      && { provider:       f.provider }),
        ...(f.fallback_only && { fallback_only:  '1' }),
        ...(f.from_date     && { from_date:      f.from_date }),
        ...(f.to_date       && { to_date:        f.to_date }),
        ...(f.search        && { search:         f.search }),
      };
      const r = await axios.get(`${API}/delivery-log`, { headers: authHeaders(), params });
      if (r.data.success) {
        setRows(r.data.data.rows);
        setPagi(r.data.data.pagination);
      }
    } catch (err) {
      toast.error('Failed to load delivery log');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchStats();
    fetchLog();
  }, []);

  const apply = (patch) => {
    const next = { ...filters, ...patch, page: 1 };
    setFilters(next);
    fetchLog(next);
  };

  const goPage = (p) => {
    const next = { ...filters, page: p };
    setFilters(next);
    fetchLog(next);
  };

  const refresh = () => { fetchStats(); fetchLog(); };

  const o = stats?.overall || {};
  const t = stats?.today   || {};

  return (
    <div style={{ padding:'24px 28px', fontFamily:'Inter,sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      <Toaster position="top-right" />

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:8 }}>
            <GitFork size={22} color="#6366f1" /> Email Delivery Log
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'#64748b' }}>
            Provider failover audit — Primary: <strong>Nodemailer (SMTP)</strong> · Fallback: <strong>Brevo (HTTP API)</strong>
          </p>
        </div>
        <button onClick={refresh}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
            background:'#6366f1', color:'#fff', border:'none', borderRadius:8,
            cursor:'pointer', fontSize:13, fontWeight:600 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
        <StatCard label="Total Sent (All Time)" value={o.total}           color="#6366f1" icon={Mail} />
        <StatCard label="Via Nodemailer"         value={o.sent_via_nodemailer} color="#10b981" icon={CheckCircle2}
          sub={o.total > 0 ? `${Math.round((o.sent_via_nodemailer||0)*100/(o.total||1))}% success rate` : undefined} />
        <StatCard label="Via Brevo"              value={o.sent_via_brevo}  color="#f59e0b" icon={AlertTriangle} />
        <StatCard label="Fallback Events"        value={o.fallback_events} color="#f59e0b" icon={Zap}
          sub="Nodemailer failed → Brevo used" />
        <StatCard label="Failed Both"            value={o.failed_both}     color="#ef4444" icon={XCircle} />
        <StatCard label="Avg Delivery Time"      value={o.avg_duration_ms != null ? `${o.avg_duration_ms}ms` : '—'}
          color="#0ea5e9" icon={Clock} />
        <StatCard label="Today — Fallbacks"      value={t.fallback_events} color="#8b5cf6" icon={TrendingUp}
          sub={`${t.total||0} emails sent today`} />
      </div>

      {/* Filters */}
      <div style={{ background:'#fff', borderRadius:10, padding:'14px 18px', marginBottom:16,
        boxShadow:'0 1px 4px rgba(0,0,0,0.06)', display:'flex', flexWrap:'wrap', gap:10, alignItems:'flex-end' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f1f5f9',
          borderRadius:7, padding:'6px 10px', flex:1, minWidth:180 }}>
          <Search size={14} color="#94a3b8" />
          <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && apply({ search: filters.search })}
            placeholder="Search email / subject…"
            style={{ border:'none', background:'transparent', fontSize:13, outline:'none', width:'100%' }} />
        </div>

        <select value={filters.status} onChange={e => apply({ status: e.target.value })}
          style={{ padding:'7px 10px', borderRadius:7, border:'1px solid #e2e8f0', fontSize:12, cursor:'pointer' }}>
          <option value="">All Statuses</option>
          <option value="delivered_primary">Primary (Nodemailer)</option>
          <option value="delivered_fallback">Fallback (Brevo)</option>
          <option value="failed_both">Failed Both</option>
          <option value="in_progress">In Progress</option>
        </select>

        <select value={filters.provider} onChange={e => apply({ provider: e.target.value })}
          style={{ padding:'7px 10px', borderRadius:7, border:'1px solid #e2e8f0', fontSize:12, cursor:'pointer' }}>
          <option value="">All Providers</option>
          <option value="nodemailer">Nodemailer</option>
          <option value="brevo">Brevo</option>
        </select>

        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#374151', cursor:'pointer' }}>
          <input type="checkbox" checked={filters.fallback_only}
            onChange={e => apply({ fallback_only: e.target.checked })} />
          Fallback events only
        </label>

        <input type="date" value={filters.from_date} onChange={e => apply({ from_date: e.target.value })}
          style={{ padding:'7px 10px', borderRadius:7, border:'1px solid #e2e8f0', fontSize:12 }} />
        <input type="date" value={filters.to_date} onChange={e => apply({ to_date: e.target.value })}
          style={{ padding:'7px 10px', borderRadius:7, border:'1px solid #e2e8f0', fontSize:12 }} />

        <button onClick={() => { const reset = { status:'',provider:'',fallback_only:false,from_date:'',to_date:'',search:'',page:1,limit:50 }; setFilters(reset); fetchLog(reset); }}
          style={{ padding:'7px 12px', borderRadius:7, border:'1px solid #e2e8f0', background:'#f8fafc',
            fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5, color:'#374151' }}>
          <Filter size={12} /> Clear
        </button>
      </div>

      {/* Table */}
      <div style={{ background:'#fff', borderRadius:10, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
              {['Ref ID','Recipient','Subject','Status','Provider','Fallback','Duration','Sent At',''].map(h => (
                <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600,
                  color:'#374151', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>
                No delivery records found.
              </td></tr>
            )}
            {!loading && rows.map(row => (
              <tr key={row.id} style={{ borderBottom:'1px solid #f1f5f9' }}
                onMouseEnter={e => e.currentTarget.style.background='#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <td style={{ padding:'9px 12px' }}>
                  <code style={{ fontSize:10, color:'#6366f1' }}>{row.ref_id}</code>
                </td>
                <td style={{ padding:'9px 12px', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {row.to_email}
                </td>
                <td style={{ padding:'9px 12px', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#374151' }}>
                  {row.subject}
                </td>
                <td style={{ padding:'9px 12px', whiteSpace:'nowrap' }}>
                  <StatusBadge status={row.delivery_status} />
                </td>
                <td style={{ padding:'9px 12px' }}>
                  {row.delivered_by ? (
                    <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600,
                      background: row.delivered_by === 'nodemailer' ? '#d1fae5' : '#fef3c7',
                      color:      row.delivered_by === 'nodemailer' ? '#065f46' : '#92400e' }}>
                      {row.delivered_by}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding:'9px 12px', textAlign:'center' }}>
                  {row.fallback_triggered
                    ? <span style={{ color:'#f59e0b', fontWeight:700 }}>⚠ Yes</span>
                    : <span style={{ color:'#10b981' }}>—</span>}
                </td>
                <td style={{ padding:'9px 12px', color:'#64748b', whiteSpace:'nowrap' }}>
                  {row.processing_duration_ms != null ? `${row.processing_duration_ms}ms` : '—'}
                </td>
                <td style={{ padding:'9px 12px', color:'#64748b', whiteSpace:'nowrap' }}>
                  {row.sent_at ? new Date(row.sent_at).toLocaleString() : '—'}
                </td>
                <td style={{ padding:'9px 12px' }}>
                  <button onClick={() => setSelected(row)}
                    style={{ border:'none', background:'none', cursor:'pointer', padding:4,
                      color:'#6366f1', display:'flex', alignItems:'center', gap:3 }}>
                    <Eye size={14} /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'12px 16px', borderTop:'1px solid #f1f5f9' }}>
            <span style={{ fontSize:12, color:'#64748b' }}>
              {pagination.total} records · Page {pagination.page} of {pagination.pages}
            </span>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => goPage(pagination.page - 1)} disabled={pagination.page <= 1}
                style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #e2e8f0',
                  background:'#f8fafc', cursor:'pointer', display:'flex', alignItems:'center',
                  opacity: pagination.page <= 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => goPage(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #e2e8f0',
                  background:'#f8fafc', cursor:'pointer', display:'flex', alignItems:'center',
                  opacity: pagination.page >= pagination.pages ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && <DetailModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
