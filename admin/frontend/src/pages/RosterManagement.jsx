import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  BarChart3, FileText, Users, Award, History, Download, Upload,
  RefreshCw, Settings, Search, ChevronLeft, ChevronRight, Filter,
  CheckCircle, Clock, XCircle, ArrowRightLeft, Loader2, AlertTriangle,
  TrendingUp, Trophy, ListOrdered, Eye,
} from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/roster';
const getHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
});

const CATEGORIES    = ['OC', 'BC', 'BCM', 'MBC/DNC', 'SC', 'SCA', 'ST'];
const STATUS_COLORS = { ALLOCATED: 'success', WAITING: 'warning', NOT_ALLOCATED: 'secondary' };
const STATUS_ICONS  = { ALLOCATED: CheckCircle, WAITING: Clock, NOT_ALLOCATED: XCircle };
const ACTION_LABELS = {
  MERIT_LIST_GENERATED:   'Merit List Generated',
  ROSTER_GENERATED:       'Roster Generated',
  MERIT_MANUAL_UPDATED:   'Merit Entry Updated',
  ROSTER_MANUAL_UPDATED:  'Roster Entry Updated',
  CATEGORY_CONFIG_UPDATED:'Category Config Updated',
  MERIT_CONFIG_UPDATED:   'Merit Config Updated',
  EXCEL_IMPORTED:         'Excel Imported',
  EXCEL_EXPORTED:         'Excel Exported',
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'primary', sub }) {
  return (
    <div className="col-md-3 col-sm-6 mb-3">
      <div className={`card border-0 shadow-sm h-100`}>
        <div className="card-body d-flex align-items-center gap-3">
          <div className={`rounded-circle bg-${color} bg-opacity-10 p-3`}>
            <Icon size={22} className={`text-${color}`} />
          </div>
          <div>
            <div className="fw-bold fs-4 lh-1">{value ?? '—'}</div>
            <div className="text-muted small">{label}</div>
            {sub && <div className="text-muted" style={{ fontSize: 11 }}>{sub}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, limit, total, onPage }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="d-flex align-items-center justify-content-between mt-2">
      <small className="text-muted">
        Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}
      </small>
      <div className="d-flex gap-1">
        <button className="btn btn-sm btn-outline-secondary" onClick={() => onPage(1)} disabled={page === 1}>«</button>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => onPage(page - 1)} disabled={page === 1}><ChevronLeft size={14} /></button>
        <span className="btn btn-sm btn-primary disabled">{page}/{totalPages}</span>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => onPage(page + 1)} disabled={page === totalPages}><ChevronRight size={14} /></button>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => onPage(totalPages)} disabled={page === totalPages}>»</button>
      </div>
    </div>
  );
}

// ── Formula hint ─────────────────────────────────────────────────────────────
function FormulaHint() {
  return (
    <div className="alert alert-info py-2 mb-3 d-flex gap-3 flex-wrap" style={{ fontSize: 12 }}>
      <span><strong>Entrance:</strong> stored /70</span>
      <span>|</span>
      <span><strong>Qual. Score:</strong> (%) / 100 × 20 (max 20)</span>
      <span>|</span>
      <span><strong>Final Roster Score:</strong> Entrance + Qual. Score (max 90)</span>
      <span>|</span>
      <span><strong>Tie-break:</strong> Entrance → Qual% → Application Date → App. ID</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function RosterManagement() {
  const [activeTab,    setActiveTab]    = useState('dashboard');
  const [sessions,     setSessions]     = useState([]);
  const [sessionId,    setSessionId]    = useState('');
  const [loading,      setLoading]      = useState(false);

  // Dashboard
  const [dashData,     setDashData]     = useState(null);

  // Merit list
  const [meritRows,    setMeritRows]    = useState([]);
  const [meritTotal,   setMeritTotal]   = useState(0);
  const [meritPage,    setMeritPage]    = useState(1);
  const [meritSearch,  setMeritSearch]  = useState('');
  const [meritCat,     setMeritCat]     = useState('');
  const MERIT_LIMIT = 50;

  // Roster allocations
  const [rosterRows,   setRosterRows]   = useState([]);
  const [rosterTotal,  setRosterTotal]  = useState(0);
  const [rosterPage,   setRosterPage]   = useState(1);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterCat,    setRosterCat]    = useState('');
  const [rosterStatus, setRosterStatus] = useState('');
  const ROSTER_LIMIT = 50;

  // Category config
  const [catConfig,    setCatConfig]    = useState([]);
  const [catSaving,    setCatSaving]    = useState(false);

  // Merit / Reservation config
  const [meritConfig,  setMeritConfig]  = useState({ merit_percentage: 30, reservation_percentage: 70 });
  const [meritSaving,  setMeritSaving]  = useState(false);

  // Allocation generate
  const [totalSeats,   setTotalSeats]   = useState('');
  const [genLoading,   setGenLoading]   = useState(false);
  const [genResult,    setGenResult]    = useState(null);

  // Import
  const [importFile,   setImportFile]   = useState(null);
  const [previewData,  setPreviewData]  = useState(null);
  const [importLoading,setImportLoading]= useState(false);
  const fileRef = useRef();

  // Export
  const [exportType,   setExportType]   = useState('roster');
  const [exportFmt,    setExportFmt]    = useState('excel');
  const [exportCat,    setExportCat]    = useState('');

  // Audit
  const [auditRows,    setAuditRows]    = useState([]);
  const [auditTotal,   setAuditTotal]   = useState(0);
  const [auditPage,    setAuditPage]    = useState(1);
  const [auditSearch,  setAuditSearch]  = useState('');
  const [auditAction,  setAuditAction]  = useState('');
  const [auditStart,   setAuditStart]   = useState('');
  const [auditEnd,     setAuditEnd]     = useState('');
  const AUDIT_LIMIT = 50;

  // ── Load sessions on mount ─────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/sessions`, getHeaders())
      .then(r => {
        setSessions(r.data.data || []);
        const active = (r.data.data || []).find(s => s.is_active);
        if (active) setSessionId(String(active.id));
      })
      .catch(() => toast.error('Could not load sessions'));
  }, []);

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const loadDashboard = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    axios.get(`${API}/dashboard/${sessionId}`, getHeaders())
      .then(r => setDashData(r.data.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => { if (activeTab === 'dashboard') loadDashboard(); }, [activeTab, loadDashboard]);

  // ── Merit list ─────────────────────────────────────────────────────────────
  const loadMerit = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ session_id: sessionId, page: meritPage, limit: MERIT_LIMIT, search: meritSearch, community: meritCat });
    axios.get(`${API}/merit-list?${p}`, getHeaders())
      .then(r => { setMeritRows(r.data.data || []); setMeritTotal(r.data.total || 0); })
      .catch(() => toast.error('Failed to load merit list'))
      .finally(() => setLoading(false));
  }, [sessionId, meritPage, meritSearch, meritCat]);

  useEffect(() => { if (activeTab === 'merit') loadMerit(); }, [activeTab, loadMerit]);

  // ── Roster ─────────────────────────────────────────────────────────────────
  const loadRoster = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ session_id: sessionId, page: rosterPage, limit: ROSTER_LIMIT, search: rosterSearch, category: rosterCat, status: rosterStatus });
    axios.get(`${API}/allocations?${p}`, getHeaders())
      .then(r => { setRosterRows(r.data.data || []); setRosterTotal(r.data.total || 0); })
      .catch(() => toast.error('Failed to load roster'))
      .finally(() => setLoading(false));
  }, [sessionId, rosterPage, rosterSearch, rosterCat, rosterStatus]);

  useEffect(() => { if (activeTab === 'roster') loadRoster(); }, [activeTab, loadRoster]);

  // ── Category config ────────────────────────────────────────────────────────
  const loadCatConfig = useCallback(() => {
    const p = sessionId ? `?session_id=${sessionId}` : '';
    axios.get(`${API}/category-config${p}`, getHeaders())
      .then(r => setCatConfig(r.data.data || []))
      .catch(() => toast.error('Failed to load category config'));
  }, [sessionId]);

  useEffect(() => { if (activeTab === 'config') loadCatConfig(); }, [activeTab, loadCatConfig]);

  // ── Merit / Reservation config ─────────────────────────────────────────────
  const loadMeritConfig = useCallback(() => {
    const p = sessionId ? `?session_id=${sessionId}` : '';
    axios.get(`${API}/merit-config${p}`, getHeaders())
      .then(r => setMeritConfig(r.data.data || { merit_percentage: 30, reservation_percentage: 70 }))
      .catch(() => toast.error('Failed to load merit configuration'));
  }, [sessionId]);

  useEffect(() => { if (activeTab === 'merit-config') loadMeritConfig(); }, [activeTab, loadMeritConfig]);

  // ── Audit logs ─────────────────────────────────────────────────────────────
  const loadAudit = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ session_id: sessionId, page: auditPage, limit: AUDIT_LIMIT, search: auditSearch, action: auditAction, start_date: auditStart, end_date: auditEnd });
    axios.get(`${API}/audit-logs?${p}`, getHeaders())
      .then(r => { setAuditRows(r.data.data || []); setAuditTotal(r.data.total || 0); })
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, [sessionId, auditPage, auditSearch, auditAction, auditStart, auditEnd]);

  useEffect(() => { if (activeTab === 'audit') loadAudit(); }, [activeTab, loadAudit]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleGenerateMerit = async () => {
    if (!window.confirm('Generate/regenerate merit list for this session? Existing merit data will be replaced.')) return;
    setLoading(true);
    try {
      const r = await axios.post(`${API}/merit-list/generate`, { session_id: sessionId || null }, getHeaders());
      toast.success(r.data.message);
      loadMerit();
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Merit generation failed');
    } finally { setLoading(false); }
  };

  const handleGenerateRoster = async () => {
    if (!totalSeats || parseInt(totalSeats) < 1) return toast.error('Enter total seats > 0');
    if (!window.confirm(`Generate roster for ${totalSeats} total seats? Existing allocation will be replaced.`)) return;
    setGenLoading(true);
    setGenResult(null);
    try {
      const r = await axios.post(`${API}/allocations/generate`, { session_id: sessionId || null, total_seats: parseInt(totalSeats) }, getHeaders());
      toast.success(r.data.message);
      setGenResult(r.data.data);
      loadRoster();
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Roster generation failed');
    } finally { setGenLoading(false); }
  };

  const handleSaveCatConfig = async () => {
    const total = catConfig.reduce((s, c) => s + parseFloat(c.percentage || 0), 0);
    if (Math.abs(total - 100) > 0.5) return toast.error(`Percentages must sum to 100 (current: ${total.toFixed(2)}%)`);
    setCatSaving(true);
    try {
      await axios.put(`${API}/category-config`, { session_id: sessionId || null, categories: catConfig }, getHeaders());
      toast.success('Category configuration saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save config');
    } finally { setCatSaving(false); }
  };

  const handleCatPctChange = (idx, val) => {
    setCatConfig(prev => prev.map((c, i) => i === idx ? { ...c, percentage: val } : c));
  };

  const handleSaveMeritConfig = async () => {
    const mp = parseFloat(meritConfig.merit_percentage);
    const rp = parseFloat(meritConfig.reservation_percentage);
    if (isNaN(mp) || isNaN(rp)) return toast.error('Enter valid percentages');
    if (Math.abs(mp + rp - 100) > 0.5) return toast.error(`Merit % + Reservation % must equal 100 (current: ${(mp + rp).toFixed(2)}%)`);
    setMeritSaving(true);
    try {
      await axios.put(`${API}/merit-config`, { session_id: sessionId || null, merit_percentage: mp, reservation_percentage: rp }, getHeaders());
      toast.success('Merit configuration saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save merit configuration');
    } finally { setMeritSaving(false); }
  };

  const handleImportPreview = async () => {
    if (!importFile) return toast.error('Select a file first');
    setImportLoading(true);
    setPreviewData(null);
    const fd = new FormData();
    fd.append('file', importFile);
    try {
      const r = await axios.post(`${API}/import/preview`, fd, {
        ...getHeaders(),
        headers: { ...getHeaders().headers, 'Content-Type': 'multipart/form-data' },
      });
      setPreviewData(r.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to parse file');
    } finally { setImportLoading(false); }
  };

  const handleImportConfirm = async () => {
    if (!previewData?.rows?.length) return;
    const valid = previewData.rows.filter(r => !r.hasError);
    if (!valid.length) return toast.error('No valid rows to import');
    if (!window.confirm(`Import ${valid.length} valid rows into merit list?`)) return;
    setImportLoading(true);
    try {
      const r = await axios.post(`${API}/import/confirm`, { session_id: sessionId || null, rows: previewData.rows }, getHeaders());
      toast.success(r.data.message);
      setPreviewData(null);
      setImportFile(null);
      if (fileRef.current) fileRef.current.value = '';
      loadMerit();
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally { setImportLoading(false); }
  };

  const handleExport = async () => {
    const p = new URLSearchParams({ session_id: sessionId, type: exportType, format: exportFmt, category: exportCat });
    const url = `${API}/export?${p}`;
    const token = localStorage.getItem('adminToken');
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.message || 'Export failed');
      }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${exportType}_${Date.now()}.${exportFmt === 'csv' ? 'csv' : 'xlsx'}`;
      a.click();
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err.message || 'Export failed');
    }
  };

  // ── Tab nav ────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'dashboard',    label: 'Dashboard',      icon: BarChart3 },
    { id: 'merit',        label: 'Merit List',      icon: Trophy },
    { id: 'roster',       label: 'Roster',          icon: ListOrdered },
    { id: 'merit-config', label: 'Merit Config',    icon: Award },
    { id: 'config',       label: 'Category Config', icon: Settings },
    { id: 'import',       label: 'Import',          icon: Upload },
    { id: 'export',       label: 'Export',          icon: Download },
    { id: 'audit',        label: 'Audit Logs',      icon: History },
  ];

  const catTotal = catConfig.reduce((s, c) => s + parseFloat(c.percentage || 0), 0);

  return (
    <div className="container-fluid px-4 py-3">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="fw-bold mb-0">Roster Management</h4>
          <small className="text-muted">Merit-based PhD admission roster generation and allocation</small>
        </div>
        <select
          className="form-select form-select-sm w-auto"
          value={sessionId}
          onChange={e => { setSessionId(e.target.value); setMeritPage(1); setRosterPage(1); }}
        >
          <option value="">All Sessions</option>
          {sessions.map(s => (
            <option key={s.id} value={String(s.id)}>{s.session_name}</option>
          ))}
        </select>
      </div>

      {/* Tab bar */}
      <ul className="nav nav-tabs mb-3">
        {TABS.map(t => (
          <li key={t.id} className="nav-item">
            <button
              className={`nav-link d-flex align-items-center gap-1 ${activeTab === t.id ? 'active fw-semibold' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div>
          <FormulaHint />
          <div className="row">
            <StatCard icon={Users}      label="Total on Merit List" value={dashData?.meritTotal}    color="primary" />
            <StatCard icon={CheckCircle} label="Allocated"           value={dashData?.allocated}     color="success" />
            <StatCard icon={Clock}       label="Waiting List"        value={dashData?.waiting}       color="warning" />
            <StatCard icon={ArrowRightLeft} label="Conversions"      value={dashData?.totalConverted} color="info" />
          </div>
          {dashData?.scoreStats && (
            <div className="row mt-1">
              <StatCard icon={TrendingUp} label="Highest Merit Score" value={dashData.scoreStats.highest} color="success" sub="out of 90" />
              <StatCard icon={Award}      label="Lowest Merit Score"  value={dashData.scoreStats.lowest}  color="danger"  sub="out of 90" />
              <StatCard icon={BarChart3}  label="Average Merit Score" value={dashData.scoreStats.avg}     color="primary" sub="out of 90" />
              <StatCard icon={FileText}   label="Total Roster"        value={dashData?.totalRoster}       color="secondary" />
            </div>
          )}
          {dashData?.categoryBreakdown?.length > 0 && (
            <div className="card border-0 shadow-sm mt-3">
              <div className="card-header bg-white fw-semibold">Category-wise Allocation</div>
              <div className="card-body p-0">
                <table className="table table-sm table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Category</th>
                      <th className="text-end">Allocated Seats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashData.categoryBreakdown.map(r => (
                      <tr key={r.category}>
                        <td><span className="badge bg-primary bg-opacity-10 text-primary">{r.category || '—'}</span></td>
                        <td className="text-end fw-semibold">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!dashData && !loading && (
            <div className="text-center text-muted py-5">
              <BarChart3 size={40} className="mb-2 opacity-25" /><br />
              Select a session to view dashboard
            </div>
          )}
          {loading && <div className="text-center py-4"><Loader2 className="spin" size={24} /></div>}
          <button className="btn btn-sm btn-outline-primary mt-3" onClick={loadDashboard}>
            <RefreshCw size={13} className="me-1" /> Refresh
          </button>
        </div>
      )}

      {/* ── MERIT LIST ────────────────────────────────────────────────────── */}
      {activeTab === 'merit' && (
        <div>
          <FormulaHint />
          <div className="d-flex gap-2 mb-3 flex-wrap">
            <div className="input-group input-group-sm" style={{ width: 240 }}>
              <span className="input-group-text"><Search size={13} /></span>
              <input className="form-control" placeholder="Search name / app ID…" value={meritSearch}
                onChange={e => { setMeritSearch(e.target.value); setMeritPage(1); }} />
            </div>
            <select className="form-select form-select-sm w-auto" value={meritCat}
              onChange={e => { setMeritCat(e.target.value); setMeritPage(1); }}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-sm btn-outline-secondary" onClick={loadMerit}>
              <Filter size={13} className="me-1" /> Filter
            </button>
            <button className="btn btn-sm btn-primary ms-auto" onClick={handleGenerateMerit} disabled={loading}>
              {loading ? <Loader2 size={13} className="spin me-1" /> : <RefreshCw size={13} className="me-1" />}
              Generate Merit List
            </button>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th style={{ width: 60 }}>Rank</th>
                      <th>Application ID</th>
                      <th>Candidate Name</th>
                      <th style={{ width: 80 }}>Category</th>
                      <th className="text-center">Entrance (/70)</th>
                      <th className="text-center">Qual. Source</th>
                      <th className="text-center">Qual. %</th>
                      <th className="text-center">Qual. Score (/20)</th>
                      <th className="text-center fw-bold">Final Roster Score (/90)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meritRows.length === 0 && (
                      <tr><td colSpan={9} className="text-center text-muted py-4">
                        {loading ? <Loader2 className="spin" size={18} /> : 'No merit list generated yet. Click "Generate Merit List".'}
                      </td></tr>
                    )}
                    {meritRows.map(r => (
                      <tr key={r.id} className={r.merit_rank === 1 ? 'table-warning' : ''}>
                        <td><span className={`badge ${r.merit_rank <= 3 ? 'bg-warning text-dark' : 'bg-light text-dark'}`}>#{r.merit_rank}</span></td>
                        <td><code className="text-primary small">{r.application_id}</code></td>
                        <td className="fw-medium">{r.applicant_name || '—'}</td>
                        <td><span className="badge bg-secondary bg-opacity-15 text-dark">{r.community || '—'}</span></td>
                        <td className="text-center">{parseFloat(r.entrance_mark).toFixed(2)}</td>
                        <td className="text-center">
                          <span className={`badge ${r.qualification_source === 'INTEGRATED' ? 'bg-info' : 'bg-primary'} bg-opacity-15 text-dark small`}>
                            {r.qualification_source}
                          </span>
                        </td>
                        <td className="text-center">{parseFloat(r.qualification_percentage).toFixed(2)}%</td>
                        <td className="text-center">{parseFloat(r.qualification_score).toFixed(2)}</td>
                        <td className="text-center">
                          <span className="fw-bold text-success">{parseFloat(r.final_merit_score).toFixed(2)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <Pagination page={meritPage} limit={MERIT_LIMIT} total={meritTotal} onPage={setMeritPage} />
        </div>
      )}

      {/* ── ROSTER ALLOCATIONS ────────────────────────────────────────────── */}
      {activeTab === 'roster' && (
        <div>
          {/* Generate panel */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <div>
                  <label className="form-label fw-semibold mb-1 small">Total Available Seats</label>
                  <input
                    type="number" className="form-control form-control-sm" style={{ width: 140 }}
                    placeholder="e.g. 100" min="1" value={totalSeats}
                    onChange={e => setTotalSeats(e.target.value)}
                  />
                </div>
                <div className="mt-3">
                  <button className="btn btn-success btn-sm" onClick={handleGenerateRoster} disabled={genLoading}>
                    {genLoading ? <Loader2 size={13} className="spin me-1" /> : <RefreshCw size={13} className="me-1" />}
                    Generate Roster Allocation
                  </button>
                </div>
                {genResult && (
                  <div className="d-flex gap-3 mt-3 flex-wrap small">
                    <span className="badge bg-success fs-6">{genResult.allocated} Allocated</span>
                    {genResult.merit_allocated != null && (
                      <span className="badge bg-primary fs-6">{genResult.merit_allocated} Merit</span>
                    )}
                    {genResult.reserve_allocated != null && (
                      <span className="badge bg-secondary fs-6">{genResult.reserve_allocated} Reservation</span>
                    )}
                    <span className="badge bg-warning text-dark fs-6">{genResult.waiting} Waiting</span>
                    <span className="badge bg-info text-dark fs-6">{genResult.conversions} Conversions</span>
                  </div>
                )}
              </div>
              {genResult?.vacancies && (
                <div className="mt-2 d-flex gap-2 flex-wrap">
                  {Object.entries(genResult.vacancies).map(([cat, seats]) => (
                    <span key={cat} className="badge bg-light text-dark border small">
                      {cat}: {seats} seats
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="d-flex gap-2 mb-3 flex-wrap">
            <div className="input-group input-group-sm" style={{ width: 240 }}>
              <span className="input-group-text"><Search size={13} /></span>
              <input className="form-control" placeholder="Search name / app ID…" value={rosterSearch}
                onChange={e => { setRosterSearch(e.target.value); setRosterPage(1); }} />
            </div>
            <select className="form-select form-select-sm w-auto" value={rosterCat}
              onChange={e => { setRosterCat(e.target.value); setRosterPage(1); }}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="form-select form-select-sm w-auto" value={rosterStatus}
              onChange={e => { setRosterStatus(e.target.value); setRosterPage(1); }}>
              <option value="">All Status</option>
              <option value="ALLOCATED">Allocated</option>
              <option value="WAITING">Waiting</option>
              <option value="NOT_ALLOCATED">Not Allocated</option>
            </select>
            <button className="btn btn-sm btn-outline-secondary" onClick={loadRoster}>
              <Filter size={13} className="me-1" /> Filter
            </button>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th style={{ width: 70 }}>Roster #</th>
                      <th style={{ width: 70 }}>Merit #</th>
                      <th>Application ID</th>
                      <th>Candidate Name</th>
                      <th>Original Cat.</th>
                      <th>Allocated Cat.</th>
                      <th className="text-center">Entrance</th>
                      <th className="text-center">Qual. %</th>
                      <th className="text-center">Score</th>
                      <th className="text-center">Type</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Converted?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterRows.length === 0 && (
                      <tr><td colSpan={11} className="text-center text-muted py-4">
                        {loading ? <Loader2 className="spin" size={18} /> : 'No roster generated yet. Enter total seats and click "Generate Roster Allocation".'}
                      </td></tr>
                    )}
                    {rosterRows.map(r => {
                      const StatusIcon = STATUS_ICONS[r.allocation_status] || FileText;
                      return (
                        <tr key={r.id} className={r.is_converted ? 'table-warning' : r.allocation_status === 'WAITING' ? 'table-secondary' : ''}>
                          <td className="text-center">
                            {r.roster_number ? <span className="badge bg-primary">{r.roster_number}</span> : '—'}
                          </td>
                          <td className="text-center"><span className="badge bg-light text-dark border">#{r.merit_rank}</span></td>
                          <td><code className="text-primary small">{r.application_id}</code></td>
                          <td className="fw-medium">{r.applicant_name || '—'}</td>
                          <td><span className="badge bg-secondary bg-opacity-15 text-dark">{r.original_category || '—'}</span></td>
                          <td>
                            {r.allocated_category
                              ? <span className={`badge ${r.is_converted ? 'bg-warning text-dark' : 'bg-success bg-opacity-15 text-success'}`}>
                                  {r.allocated_category}
                                </span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td className="text-center small">{parseFloat(r.entrance_mark || 0).toFixed(2)}</td>
                          <td className="text-center small">{parseFloat(r.qualification_percentage || 0).toFixed(2)}%</td>
                          <td className="text-center">
                            <span className="fw-bold small">{parseFloat(r.final_merit_score || 0).toFixed(2)}</span>
                          </td>
                          <td className="text-center">
                            {r.allocation_type
                              ? <span className={`badge small ${r.allocation_type === 'MERIT' ? 'bg-primary' : 'bg-secondary'}`}>
                                  {r.allocation_type === 'MERIT' ? 'Merit' : 'Reservation'}
                                </span>
                              : <span className="text-muted small">—</span>}
                          </td>
                          <td className="text-center">
                            <span className={`badge bg-${STATUS_COLORS[r.allocation_status] || 'secondary'} d-flex align-items-center gap-1 justify-content-center`} style={{ width: 'max-content', margin: 'auto' }}>
                              <StatusIcon size={11} />
                              {r.allocation_status}
                            </span>
                          </td>
                          <td className="text-center">
                            {r.is_converted
                              ? <span className="badge bg-warning text-dark small">
                                  <ArrowRightLeft size={11} className="me-1" />{r.conversion_from}→{r.conversion_to}
                                </span>
                              : <span className="text-muted small">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <Pagination page={rosterPage} limit={ROSTER_LIMIT} total={rosterTotal} onPage={setRosterPage} />
        </div>
      )}

      {/* ── MERIT CONFIG ──────────────────────────────────────────────────── */}
      {activeTab === 'merit-config' && (
        <div className="row justify-content-center">
          <div className="col-md-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold d-flex align-items-center justify-content-between">
                <span>Merit &amp; Reservation Configuration</span>
                <small className="text-muted">Must sum to 100%</small>
              </div>
              <div className="card-body">
                <div className="alert alert-info py-2 small mb-4">
                  <strong>Merit seats</strong> go to the top-ranked candidates by Final Roster Score, regardless of community.
                  &nbsp;<strong>Reservation seats</strong> are distributed by community category using the percentages in Category Config.
                </div>

                {/* Merit % */}
                <div className="mb-4">
                  <label className="form-label fw-semibold">Merit Percentage</label>
                  <div className="d-flex align-items-center gap-3">
                    <div className="flex-grow-1">
                      <input
                        type="range" className="form-range" min="0" max="100" step="1"
                        value={parseFloat(meritConfig.merit_percentage) || 0}
                        onChange={e => setMeritConfig(prev => ({
                          ...prev,
                          merit_percentage: parseFloat(e.target.value),
                          reservation_percentage: Math.max(0, 100 - parseFloat(e.target.value)),
                        }))}
                      />
                    </div>
                    <div className="input-group input-group-sm" style={{ width: 110 }}>
                      <input
                        type="number" className="form-control text-end fw-bold" min="0" max="100" step="1"
                        value={meritConfig.merit_percentage}
                        onChange={e => setMeritConfig(prev => ({ ...prev, merit_percentage: e.target.value }))}
                      />
                      <span className="input-group-text">%</span>
                    </div>
                  </div>
                  <small className="text-muted">Top candidates allocated by merit score (any community)</small>
                </div>

                {/* Reservation % */}
                <div className="mb-4">
                  <label className="form-label fw-semibold">Reservation Percentage</label>
                  <div className="d-flex align-items-center gap-3">
                    <div className="flex-grow-1">
                      <input
                        type="range" className="form-range" min="0" max="100" step="1"
                        value={parseFloat(meritConfig.reservation_percentage) || 0}
                        onChange={e => setMeritConfig(prev => ({
                          ...prev,
                          reservation_percentage: parseFloat(e.target.value),
                          merit_percentage: Math.max(0, 100 - parseFloat(e.target.value)),
                        }))}
                      />
                    </div>
                    <div className="input-group input-group-sm" style={{ width: 110 }}>
                      <input
                        type="number" className="form-control text-end fw-bold" min="0" max="100" step="1"
                        value={meritConfig.reservation_percentage}
                        onChange={e => setMeritConfig(prev => ({ ...prev, reservation_percentage: e.target.value }))}
                      />
                      <span className="input-group-text">%</span>
                    </div>
                  </div>
                  <small className="text-muted">Remaining seats distributed by community reservation rules</small>
                </div>

                <hr />

                {/* Example preview */}
                <div className="bg-light rounded p-3 mb-3 small">
                  <div className="fw-semibold mb-2">Example (for 100 total seats):</div>
                  <div className="d-flex gap-4">
                    <span>
                      <span className="badge bg-primary me-1">Merit</span>
                      {Math.round(100 * (parseFloat(meritConfig.merit_percentage) || 0) / 100)} seats
                    </span>
                    <span>
                      <span className="badge bg-secondary me-1">Reservation</span>
                      {Math.round(100 * (parseFloat(meritConfig.reservation_percentage) || 0) / 100)} seats
                    </span>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <span className="fw-semibold">Total: </span>
                    <span className={`fw-bold fs-5 ${Math.abs((parseFloat(meritConfig.merit_percentage) || 0) + (parseFloat(meritConfig.reservation_percentage) || 0) - 100) > 0.5 ? 'text-danger' : 'text-success'}`}>
                      {((parseFloat(meritConfig.merit_percentage) || 0) + (parseFloat(meritConfig.reservation_percentage) || 0)).toFixed(0)}%
                    </span>
                    {Math.abs((parseFloat(meritConfig.merit_percentage) || 0) + (parseFloat(meritConfig.reservation_percentage) || 0) - 100) > 0.5 && (
                      <span className="text-danger small ms-2"><AlertTriangle size={13} /> Must equal 100%</span>
                    )}
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={loadMeritConfig}>
                      <RefreshCw size={13} className="me-1" /> Reset
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handleSaveMeritConfig}
                      disabled={meritSaving || Math.abs((parseFloat(meritConfig.merit_percentage) || 0) + (parseFloat(meritConfig.reservation_percentage) || 0) - 100) > 0.5}
                    >
                      {meritSaving ? <Loader2 size={13} className="spin me-1" /> : <CheckCircle size={13} className="me-1" />}
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CATEGORY CONFIG ───────────────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold d-flex align-items-center justify-content-between">
                <span>Reservation Category Percentages</span>
                <small className="text-muted">Must sum to 100%</small>
              </div>
              <div className="card-body">
                <div className="alert alert-info py-2 small mb-3">
                  <strong>Conversion rules:</strong>&nbsp;
                  BC → OC &nbsp;|&nbsp; BCM → BC &nbsp;|&nbsp; MBC/DNC → BC &nbsp;|&nbsp; SC → MBC/DNC &nbsp;|&nbsp; ST → SC
                </div>
                {catConfig.map((cat, idx) => (
                  <div key={cat.category_name} className="d-flex align-items-center gap-3 mb-3">
                    <span className="badge bg-primary bg-opacity-10 text-primary fw-semibold" style={{ width: 90, fontSize: 13 }}>
                      {cat.category_name}
                    </span>
                    <div className="flex-grow-1">
                      <input
                        type="range" className="form-range" min="0" max="100" step="0.5"
                        value={parseFloat(cat.percentage) || 0}
                        onChange={e => handleCatPctChange(idx, e.target.value)}
                      />
                    </div>
                    <div className="input-group input-group-sm" style={{ width: 100 }}>
                      <input
                        type="number" className="form-control text-end" min="0" max="100" step="0.5"
                        value={cat.percentage}
                        onChange={e => handleCatPctChange(idx, e.target.value)}
                      />
                      <span className="input-group-text">%</span>
                    </div>
                  </div>
                ))}
                <hr />
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <span className="fw-semibold">Total: </span>
                    <span className={`fw-bold fs-5 ${Math.abs(catTotal - 100) > 0.5 ? 'text-danger' : 'text-success'}`}>
                      {catTotal.toFixed(2)}%
                    </span>
                    {Math.abs(catTotal - 100) > 0.5 && (
                      <span className="text-danger small ms-2"><AlertTriangle size={13} /> Must equal 100%</span>
                    )}
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={loadCatConfig}>
                      <RefreshCw size={13} className="me-1" /> Reset
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={handleSaveCatConfig} disabled={catSaving || Math.abs(catTotal - 100) > 0.5}>
                      {catSaving ? <Loader2 size={13} className="spin me-1" /> : <CheckCircle size={13} className="me-1" />}
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT ────────────────────────────────────────────────────────── */}
      {activeTab === 'import' && (
        <div className="row justify-content-center">
          <div className="col-md-10">
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white fw-semibold">Import Merit Data from Excel</div>
              <div className="card-body">
                <div className="alert alert-secondary py-2 small mb-3">
                  <strong>Required columns:</strong> application_id, entrance_mark, qualification_percentage<br />
                  <strong>Optional columns:</strong> applicant_name, community/category, qualification_source (PG or INTEGRATED)<br />
                  <strong>Supported formats:</strong> .xlsx, .xls &nbsp;|&nbsp; <strong>Max size:</strong> 10 MB
                </div>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <input
                    type="file" className="form-control form-control-sm" style={{ width: 300 }}
                    accept=".xlsx,.xls" ref={fileRef}
                    onChange={e => { setImportFile(e.target.files[0] || null); setPreviewData(null); }}
                  />
                  <button className="btn btn-sm btn-outline-primary" onClick={handleImportPreview} disabled={!importFile || importLoading}>
                    {importLoading ? <Loader2 size={13} className="spin me-1" /> : <Eye size={13} className="me-1" />}
                    Preview
                  </button>
                </div>
              </div>
            </div>

            {previewData && (
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white">
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="fw-semibold">Preview — {previewData.total} rows</span>
                    <div className="d-flex gap-2">
                      <span className="badge bg-success">{previewData.valid} valid</span>
                      <span className="badge bg-danger">{previewData.errorCount} errors</span>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive" style={{ maxHeight: 400 }}>
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th>Row</th>
                          <th>Application ID</th>
                          <th>Name</th>
                          <th>Category</th>
                          <th className="text-center">Entrance</th>
                          <th className="text-center">Qual. Source</th>
                          <th className="text-center">Qual. %</th>
                          <th className="text-center">Qual. Score</th>
                          <th className="text-center">Merit Score</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.map(r => (
                          <tr key={r.rowNum} className={r.hasError ? 'table-danger' : ''}>
                            <td className="text-muted small">{r.rowNum}</td>
                            <td><code className="small">{r.application_id}</code></td>
                            <td className="small">{r.applicant_name || '—'}</td>
                            <td className="small">{r.community || '—'}</td>
                            <td className="text-center small">{r.entrance_mark ?? '—'}</td>
                            <td className="text-center">
                              <span className="badge bg-primary bg-opacity-10 text-primary small">{r.qualification_source}</span>
                            </td>
                            <td className="text-center small">{r.qualification_percentage != null ? `${r.qualification_percentage}%` : '—'}</td>
                            <td className="text-center small">{r.qualification_score != null ? r.qualification_score.toFixed(2) : '—'}</td>
                            <td className="text-center small fw-bold">{r.final_merit_score != null ? r.final_merit_score.toFixed(2) : '—'}</td>
                            <td>
                              {r.hasError
                                ? <span className="text-danger small"><AlertTriangle size={11} className="me-1" />{r.errors.join('; ')}</span>
                                : <span className="text-success small"><CheckCircle size={11} className="me-1" />OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer bg-white d-flex justify-content-end gap-2">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => { setPreviewData(null); setImportFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-sm btn-success" disabled={previewData.valid === 0 || importLoading}
                    onClick={handleImportConfirm}
                  >
                    {importLoading ? <Loader2 size={13} className="spin me-1" /> : <Upload size={13} className="me-1" />}
                    Confirm Import ({previewData.valid} rows)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EXPORT ────────────────────────────────────────────────────────── */}
      {activeTab === 'export' && (
        <div className="row justify-content-center">
          <div className="col-md-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Export Roster Data</div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label fw-medium small">Export Type</label>
                  <div className="d-flex gap-3">
                    {[
                      { v: 'merit',  label: 'Merit List'  },
                      { v: 'roster', label: 'Full Roster'  },
                    ].map(o => (
                      <div key={o.v} className="form-check">
                        <input className="form-check-input" type="radio" name="exportType" id={`et_${o.v}`}
                          value={o.v} checked={exportType === o.v} onChange={() => setExportType(o.v)} />
                        <label className="form-check-label" htmlFor={`et_${o.v}`}>{o.label}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-medium small">File Format</label>
                  <div className="d-flex gap-3">
                    {[
                      { v: 'excel', label: 'Excel (.xlsx)' },
                      { v: 'csv',   label: 'CSV (.csv)' },
                    ].map(o => (
                      <div key={o.v} className="form-check">
                        <input className="form-check-input" type="radio" name="exportFmt" id={`ef_${o.v}`}
                          value={o.v} checked={exportFmt === o.v} onChange={() => setExportFmt(o.v)} />
                        <label className="form-check-label" htmlFor={`ef_${o.v}`}>{o.label}</label>
                      </div>
                    ))}
                  </div>
                </div>

                {exportType === 'roster' && (
                  <div className="mb-3">
                    <label className="form-label fw-medium small">Filter by Category (optional)</label>
                    <select className="form-select form-select-sm w-auto" value={exportCat} onChange={e => setExportCat(e.target.value)}>
                      <option value="">All Categories</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                <button className="btn btn-primary" onClick={handleExport}>
                  <Download size={15} className="me-2" />
                  Download {exportType === 'merit' ? 'Merit List' : 'Roster'} ({exportFmt.toUpperCase()})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AUDIT LOGS ────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div>
          <div className="d-flex gap-2 mb-3 flex-wrap">
            <div className="input-group input-group-sm" style={{ width: 220 }}>
              <span className="input-group-text"><Search size={13} /></span>
              <input className="form-control" placeholder="Search email / action…" value={auditSearch}
                onChange={e => { setAuditSearch(e.target.value); setAuditPage(1); }} />
            </div>
            <select className="form-select form-select-sm w-auto" value={auditAction}
              onChange={e => { setAuditAction(e.target.value); setAuditPage(1); }}>
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="date" className="form-control form-control-sm w-auto" value={auditStart}
              onChange={e => { setAuditStart(e.target.value); setAuditPage(1); }} />
            <span className="align-self-center text-muted small">to</span>
            <input type="date" className="form-control form-control-sm w-auto" value={auditEnd}
              onChange={e => { setAuditEnd(e.target.value); setAuditPage(1); }} />
            <button className="btn btn-sm btn-outline-secondary" onClick={loadAudit}>
              <Filter size={13} className="me-1" /> Filter
            </button>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>User</th>
                      <th>IP Address</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted py-4">
                        {loading ? <Loader2 className="spin" size={18} /> : 'No audit logs found'}
                      </td></tr>
                    )}
                    {auditRows.map(r => (
                      <tr key={r.id}>
                        <td className="small text-muted text-nowrap">
                          {new Date(r.created_at).toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span className="badge bg-primary bg-opacity-10 text-primary small">
                            {ACTION_LABELS[r.action] || r.action}
                          </span>
                        </td>
                        <td className="small text-muted">{r.entity_type || '—'} {r.entity_id ? `#${r.entity_id}` : ''}</td>
                        <td className="small">{r.user_email || '—'}</td>
                        <td className="small text-muted">{r.ip_address || '—'}</td>
                        <td className="small">
                          {r.new_value && (() => {
                            try {
                              const v = typeof r.new_value === 'string' ? JSON.parse(r.new_value) : r.new_value;
                              return (
                                <div className="text-muted" style={{ maxWidth: 300, wordBreak: 'break-all' }}>
                                  {Object.entries(v).slice(0, 3).map(([k, val]) => (
                                    <span key={k} className="me-2">{k}: <strong>{String(val)}</strong></span>
                                  ))}
                                </div>
                              );
                            } catch { return <span className="text-muted">—</span>; }
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <Pagination page={auditPage} limit={AUDIT_LIMIT} total={auditTotal} onPage={setAuditPage} />
        </div>
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
