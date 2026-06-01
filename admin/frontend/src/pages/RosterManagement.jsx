import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  BarChart3, FileText, Users, GraduationCap, History, Download, Upload,
  Search, Filter, Printer, Loader2, RefreshCw, Settings, ChevronRight,
  UserPlus, Trash2, AlertTriangle, CheckCircle2, XCircle, Info, X,
  TrendingUp, Award, BookOpen, ShieldAlert
} from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';
const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });

// ── Small helpers ─────────────────────────────────────────────────────────────
const fmt2 = v => parseFloat(v || 0).toFixed(2);

function StatCard({ label, value, sub, color }) {
  return (
    <div className="p-2 border rounded bg-white d-flex flex-column align-items-center justify-content-center h-100 text-center">
      <span className="text-muted fw-semibold" style={{ fontSize: 10.5 }}>{label}</span>
      <span className="fw-bold my-1" style={{ fontSize: 26, color }}>{value ?? 0}</span>
      {sub && <span className="text-muted" style={{ fontSize: 9 }}>{sub}</span>}
    </div>
  );
}

function ImportResultBanner({ result, onClose }) {
  if (!result) return null;
  const { total, updated, skipped, failed, errors } = result;
  return (
    <div className="alert alert-info border-0 shadow-sm mb-3 p-3 rounded-3 position-relative" style={{ fontSize: 12 }}>
      <button onClick={onClose} className="btn btn-xs btn-link position-absolute top-0 end-0 p-2 text-muted">
        <X size={14} />
      </button>
      <div className="fw-bold mb-2 d-flex align-items-center gap-2">
        <CheckCircle2 size={15} className="text-success" /> Excel Import Validation Report
      </div>
      <div className="row g-2 mb-2">
        {[
          { label: 'Total Processed', val: total,   color: '#1e3a8a' },
          { label: 'Updated',         val: updated,  color: '#16a34a' },
          { label: 'Skipped (No Change)', val: skipped, color: '#d97706' },
          { label: 'Failed',          val: failed,   color: '#dc2626' },
        ].map(c => (
          <div key={c.label} className="col-6 col-md-3">
            <div className="border rounded p-2 text-center">
              <div className="fw-bold" style={{ color: c.color, fontSize: 20 }}>{c.val}</div>
              <div className="text-muted" style={{ fontSize: 9.5 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>
      {errors && errors.length > 0 && (
        <details className="mt-1">
          <summary className="text-danger fw-semibold" style={{ cursor: 'pointer', fontSize: 11 }}>
            <XCircle size={12} className="me-1" /> {errors.length} error(s) — click to expand
          </summary>
          <div className="mt-2 p-2 bg-white rounded border" style={{ maxHeight: 160, overflowY: 'auto' }}>
            {errors.map((e, i) => (
              <div key={i} className="small text-danger border-bottom py-1" style={{ fontSize: 10.5 }}>
                Row {e.row} | <strong>{e.id}</strong>: {e.error}
              </div>
            ))}
          </div>
          <button
            className="btn btn-xs btn-outline-danger mt-2"
            style={{ fontSize: 10.5 }}
            onClick={() => {
              const csv = ['Row,Application ID,Error', ...errors.map(e => `${e.row},"${e.id}","${e.error}"`)].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement('a'); a.href = url;
              a.download = `roster_import_errors_${Date.now()}.csv`; a.click(); a.remove();
            }}
          >
            <Download size={10} className="me-1" /> Download Error Report (CSV)
          </button>
        </details>
      )}
    </div>
  );
}

// =============================================================================
export default function RosterManagement() {
  const [activeTab,     setActiveTab]     = useState('roster');
  const [loading,       setLoading]       = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [importing,     setImporting]     = useState(false);
  const fileInputRef = useRef(null);

  // ── Filter dropdowns ───────────────────────────────────────────────────────
  const [sessions,     setSessions]     = useState([]);
  const [programmes,   setProgrammes]   = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [supervisors,  setSupervisors]  = useState([]);
  const [allSupervisors, setAllSupervisors] = useState([]);
  const [communities,  setCommunities]  = useState([]);

  const [filters, setFilters] = useState({
    session_id:    '',
    program_id:    '',
    department_id: '',
    supervisor_id: 'all',
    community:     'all',
    status:        'all'
  });

  // ── Config ─────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState({
    pg_eligibility_pct:         70,
    integrated_eligibility_pct: 70,
    merit_percentage:           30
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [stats,        setStats]        = useState(null);
  const [rosterData,   setRosterData]   = useState([]);
  const [auditLogs,    setAuditLogs]    = useState([]);
  const [scholars,     setScholars]     = useState([]);
  const [importResult, setImportResult] = useState(null);

  // ── Vacancy panel ──────────────────────────────────────────────────────────
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [showScholarForm,    setShowScholarForm]    = useState(false);
  const [addingScholar,      setAddingScholar]      = useState(false);
  const [scholarForm, setScholarForm] = useState({
    scholar_name: '', scholar_type: 'Full-Time',
    enrollment_no: '', admission_date: '', status: 'Admitted'
  });

  // ── Audit filter ───────────────────────────────────────────────────────────
  const [auditSearch,    setAuditSearch]    = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate,   setAuditEndDate]   = useState('');

  // ── Search & Pagination ────────────────────────────────────────────────────
  const [searchTerm,   setSearchTerm]   = useState('');
  const [currentPage,  setCurrentPage]  = useState(1);
  const ROWS_PER_PAGE = 20;

  // ==========================================================================
  // BOOTSTRAP: load sessions, departments, supervisors, communities
  // ==========================================================================
  useEffect(() => {
    axios.get(`${API}/sessions`, authHeaders())
      .then(res => {
        const data = res.data.data || [];
        setSessions(data);
        const active = data.find(s => s.is_active === 1) || data[0];
        if (active) setFilters(p => ({ ...p, session_id: String(active.id) }));
      })
      .catch(() => toast.error('Failed to load sessions'));

    axios.get(`${API}/eligibility/departments/all`, authHeaders())
      .then(res => setDepartments(res.data.data || []))
      .catch(() => {});

    axios.get(`${API}/supervisors`, authHeaders())
      .then(res => {
        const rows = res.data.data?.rows || (Array.isArray(res.data.data) ? res.data.data : []);
        setAllSupervisors(rows);
      })
      .catch(() => {});

    axios.get(`${API}/settings/community-fees`, authHeaders())
      .then(res => setCommunities(res.data.data || []))
      .catch(() => {});
  }, []);

  // ==========================================================================
  // CASCADE: session → load programmes & roster config
  // ==========================================================================
  useEffect(() => {
    if (!filters.session_id) return;

    axios.get(`${API}/eligibility/programs/all`, authHeaders())
      .then(res => {
        const progs = res.data.data || [];
        setProgrammes(progs);
        if (progs.length > 0) {
          setFilters(p => ({ ...p, program_id: String(progs[0].id) }));
        }
      })
      .catch(() => {});

    axios.get(`${API}/roster/config/${filters.session_id}`, authHeaders())
      .then(res => {
        if (res.data.success && res.data.data) {
          const d = res.data.data;
          setConfig({
            pg_eligibility_pct:         parseFloat(d.pg_eligibility_pct),
            integrated_eligibility_pct: parseFloat(d.integrated_eligibility_pct),
            merit_percentage:           parseFloat(d.merit_percentage)
          });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.session_id]);

  // ==========================================================================
  // CASCADE: programme → auto-select department + filter supervisors
  // ==========================================================================
  useEffect(() => {
    if (!filters.program_id || programmes.length === 0) return;
    const prog = programmes.find(p => String(p.id) === String(filters.program_id));
    if (!prog) return;

    const deptId = String(prog.department_id);
    setFilters(p => ({ ...p, department_id: deptId, supervisor_id: 'all' }));

    const filteredSups = allSupervisors.filter(s => String(s.department_id) === deptId);
    setSupervisors(filteredSups);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.program_id, programmes, allSupervisors]);

  // ==========================================================================
  // MAIN DATA LOADER
  // ==========================================================================
  const loadRosterData = useCallback(async () => {
    if (!filters.session_id || !filters.program_id || !filters.department_id) return;
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') qp.set(k, v); });

      const [rosterRes, statsRes] = await Promise.all([
        axios.get(`${API}/roster/list?${qp}`, authHeaders()),
        axios.get(`${API}/roster/analytics?${qp}`, authHeaders())
      ]);

      setRosterData(rosterRes.data.data || []);
      setStats(statsRes.data.data || null);
    } catch {
      toast.error('Failed to load roster data.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadRosterData(); }, [loadRosterData]);

  const loadAuditLogs = useCallback(() => {
    const qp = new URLSearchParams();
    if (auditSearch)    qp.set('search',     auditSearch);
    if (auditStartDate) qp.set('start_date', auditStartDate);
    if (auditEndDate)   qp.set('end_date',   auditEndDate);
    axios.get(`${API}/roster/audit-logs?${qp}`, authHeaders())
      .then(res => setAuditLogs(res.data.data || []))
      .catch(() => toast.error('Failed to load audit logs'));
  }, [auditSearch, auditStartDate, auditEndDate]);

  useEffect(() => { if (activeTab === 'audits') loadAuditLogs(); }, [activeTab, loadAuditLogs]);

  const loadScholars = (supId) => {
    axios.get(`${API}/roster/scholars?supervisor_id=${supId}`, authHeaders())
      .then(res => setScholars(res.data.data || []))
      .catch(() => toast.error('Failed to load scholars.'));
  };

  // ==========================================================================
  // RECALCULATE
  // ==========================================================================
  const handleRecalculate = async () => {
    if (!filters.session_id || !filters.program_id || !filters.department_id) {
      return toast.error('Please select Session, Programme and Department first.');
    }
    setRecalculating(true);
    const tid = toast.loading('Running Roster Allocation Engine...');
    try {
      const res = await axios.post(`${API}/roster/recalculate`, {
        session_id:    parseInt(filters.session_id),
        program_id:    parseInt(filters.program_id),
        department_id: parseInt(filters.department_id)
      }, authHeaders());

      if (res.data.success) {
        const s = res.data.summary || {};
        toast.success(
          `Allocation complete — ${s.selected || 0} selected, ${s.waiting || 0} waiting, ${s.excluded || 0} excluded.`,
          { id: tid, duration: 5000 }
        );
        loadRosterData();
      } else {
        toast.error(res.data.message || 'Recalculation failed.', { id: tid });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Recalculation engine error.', { id: tid });
    } finally {
      setRecalculating(false);
    }
  };

  // ==========================================================================
  // SAVE CONFIG
  // ==========================================================================
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await axios.post(`${API}/roster/config`, {
        session_id:                  parseInt(filters.session_id),
        pg_eligibility_pct:         parseFloat(config.pg_eligibility_pct),
        integrated_eligibility_pct: parseFloat(config.integrated_eligibility_pct),
        merit_percentage:           parseFloat(config.merit_percentage)
      }, authHeaders());
      toast.success('Configuration saved. Running recalculation...');
      handleRecalculate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  // ==========================================================================
  // STATUS CHANGE + AUTO-REPLACEMENT
  // ==========================================================================
  const handleStatusChange = async (appId, newStatus) => {
    const tid = toast.loading('Updating status & running Auto-Replacement Engine...');
    try {
      const res = await axios.put(`${API}/roster/status/${appId}`, { roster_status: newStatus }, authHeaders());
      if (res.data.success) {
        if (res.data.promoted) {
          const p = res.data.promoted;
          toast.success(
            `Auto-Replacement: ${p.released_name} → ${p.promoted_name} promoted in [${p.category}] quota.`,
            { id: tid, duration: 6000 }
          );
        } else {
          toast.success('Status updated.', { id: tid });
        }
        loadRosterData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.', { id: tid });
    }
  };

  // ==========================================================================
  // SUPERVISOR ALLOCATION
  // ==========================================================================
  const handleSupervisorAllocation = async (appId, supId) => {
    try {
      await axios.put(`${API}/roster/allocate-supervisor/${appId}`,
        { supervisor_id: supId ? parseInt(supId) : null }, authHeaders());
      toast.success('Supervisor allocated.');
      loadRosterData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to allocate supervisor.');
    }
  };

  // ==========================================================================
  // EXCEL EXPORT
  // ==========================================================================
  const handleExport = () => {
    const qp = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') qp.set(k, v); });
    const tid = toast.loading('Generating Excel Roster Report...');
    axios.get(`${API}/roster/export?${qp}`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
    }).then(res => {
      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.download = `roster_export_${Date.now()}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('Roster exported successfully!', { id: tid });
    }).catch(() => toast.error('Export failed.', { id: tid }));
  };

  // ==========================================================================
  // EXCEL IMPORT
  // ==========================================================================
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!filters.session_id || !filters.program_id || !filters.department_id) {
      return toast.error('Please select Session, Programme and Department before importing.');
    }

    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append('excel', file);
    fd.append('session_id',    filters.session_id);
    fd.append('program_id',    filters.program_id);
    fd.append('department_id', filters.department_id);

    const tid = toast.loading('Uploading & validating Excel roster...');
    try {
      const res = await axios.post(`${API}/roster/import`, fd, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      if (res.data.success) {
        const { total, updated, skipped, failed } = res.data;
        toast[failed > 0 ? 'error' : 'success'](
          `Import done — ${total} processed, ${updated} updated, ${failed} failed.`,
          { id: tid, duration: 5000 }
        );
        setImportResult(res.data);
        loadRosterData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed.', { id: tid });
    } finally {
      setImporting(false);
    }
  };

  // ==========================================================================
  // SCHOLAR MANAGEMENT
  // ==========================================================================
  const handleSelectSupervisor = (sup) => {
    setSelectedSupervisor(sup);
    setShowScholarForm(false);
    loadScholars(sup.id);
  };

  const handleAddScholar = async (e) => {
    e.preventDefault();
    if (!scholarForm.scholar_name.trim()) return;
    setAddingScholar(true);
    try {
      const res = await axios.post(`${API}/roster/scholars`, {
        ...scholarForm,
        supervisor_id: selectedSupervisor.id,
        programme_id:  parseInt(filters.program_id)    || null,
        department_id: parseInt(filters.department_id) || null
      }, authHeaders());
      if (res.data.success) {
        toast.success('Scholar recorded.');
        setScholarForm({ scholar_name: '', scholar_type: 'Full-Time', enrollment_no: '', admission_date: '', status: 'Admitted' });
        setShowScholarForm(false);
        loadScholars(selectedSupervisor.id);
        loadRosterData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add scholar.');
    } finally {
      setAddingScholar(false); }
  };

  const handleScholarStatus = async (scholarId, targetStatus) => {
    try {
      await axios.put(`${API}/roster/scholars/${scholarId}`, { status: targetStatus }, authHeaders());
      toast.success(`Scholar status → ${targetStatus}. Vacancies updated.`);
      loadScholars(selectedSupervisor.id);
      loadRosterData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update scholar.');
    }
  };

  const handleScholarDelete = async (scholarId) => {
    if (!window.confirm('Permanently delete this scholar? This will release their supervisor vacancy immediately.')) return;
    try {
      await axios.delete(`${API}/roster/scholars/${scholarId}`, authHeaders());
      toast.success('Scholar removed.');
      loadScholars(selectedSupervisor.id);
      loadRosterData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete scholar.');
    }
  };

  // ==========================================================================
  // SEARCH + PAGINATION
  // ==========================================================================
  const filteredRoster = rosterData.filter(r =>
    Object.values(r).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const totalPages     = Math.ceil(filteredRoster.length / ROWS_PER_PAGE);
  const currentRows    = filteredRoster.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const sessionLabel = sessions.find(s => String(s.id) === String(filters.session_id));
  const progLabel    = rosterData[0]?.programme_name  || 'Programme';
  const deptLabel    = rosterData[0]?.department_name || 'Department';

  const communityNames = communities.length > 0
    ? communities.map(c => c.community_name || c.name).filter(Boolean)
    : ['OC', 'BC', 'MBC', 'SC', 'ST'];

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="p-3" style={{ animation: 'fadeIn 0.35s ease-out' }}>

      {/* ── Header ── */}
      <div className="d-flex align-items-center justify-content-between mb-3 print-hide flex-wrap gap-2">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 21 }}>
            Dynamic Roster Management Engine
          </h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 11.5 }}>
              <li className="breadcrumb-item"><a href="/" className="text-decoration-none" style={{ color: '#32c5d2' }}>Home</a></li>
              <li className="breadcrumb-item active">Admission Management</li>
              <li className="breadcrumb-item active">Dynamic Roster Management</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            onClick={handleRecalculate}
            disabled={recalculating || loading || !filters.department_id}
            className="btn btn-sm text-white d-flex align-items-center gap-1 shadow-sm border-0"
            style={{ backgroundColor: '#32c5d2', fontWeight: 600 }}
          >
            {recalculating ? <><Loader2 className="animate-spin" size={14} /> Recalculating...</> : <><RefreshCw size={14} /> Run Roster Allocator</>}
          </button>
          <button onClick={() => window.print()} className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 shadow-sm print-hide">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* ── Printable header ── */}
      <div className="print-only mb-4 text-center">
        <h2 className="fw-bold mb-1" style={{ color: '#1e3a8a' }}>PERIYAR UNIVERSITY</h2>
        <h5 className="text-secondary mb-3">Ph.D Admission ERP — Dynamic Roster Allocation Ledger</h5>
        <div className="p-2 border rounded bg-light text-start small mb-3">
          <div><strong>Session:</strong> {sessionLabel ? `${sessionLabel.month} ${sessionLabel.year}` : '—'}</div>
          <div><strong>Programme / Department:</strong> {progLabel} / {deptLabel}</div>
          <div><strong>Report Date:</strong> {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* ── Import result banner ── */}
      <ImportResultBanner result={importResult} onClose={() => setImportResult(null)} />

      {/* ── FILTER PANEL ── */}
      <div className="card shadow-sm border-0 mb-4 print-hide" style={{ background: '#f8fafc', borderRadius: 10 }}>
        <div className="card-body p-3">
          <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-2">
            <Filter size={15} style={{ color: '#32c5d2' }} />
            <span className="fw-bold text-dark" style={{ fontSize: 13 }}>Programme Filters</span>
            <button
              className="btn btn-link text-danger p-0 ms-auto border-0 text-decoration-none"
              style={{ fontSize: 11, fontWeight: 600 }}
              onClick={() => setFilters(p => ({ ...p, supervisor_id: 'all', community: 'all', status: 'all' }))}
            >
              Reset Filters
            </button>
          </div>
          <div className="row g-2 text-start">
            {/* Academic Session */}
            <div className="col-md-2">
              <label className="form-label small fw-bold mb-1">Academic Session</label>
              <select className="form-select form-select-sm border rounded-3 shadow-none"
                value={filters.session_id}
                onChange={e => setFilters(p => ({ ...p, session_id: e.target.value }))}>
                {sessions.map(s => (
                  <option key={s.id} value={String(s.id)}>
                    {s.month} {s.year}{s.is_active ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Ph.D Programme */}
            <div className="col-md-3">
              <label className="form-label small fw-bold mb-1">Ph.D Programme</label>
              <select className="form-select form-select-sm border rounded-3 shadow-none"
                value={filters.program_id}
                onChange={e => setFilters(p => ({ ...p, program_id: e.target.value }))}>
                <option value="">— Select Programme —</option>
                {programmes.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </select>
            </div>

            {/* Department (auto) */}
            <div className="col-md-2">
              <label className="form-label small fw-bold mb-1">Department (Auto)</label>
              <select className="form-select form-select-sm border rounded-3 bg-light" value={filters.department_id} disabled>
                {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
            </div>

            {/* Supervisor */}
            <div className="col-md-3">
              <label className="form-label small fw-bold mb-1">Supervisor</label>
              <select className="form-select form-select-sm border rounded-3 shadow-none"
                value={filters.supervisor_id}
                onChange={e => setFilters(p => ({ ...p, supervisor_id: e.target.value }))}>
                <option value="all">All Supervisors</option>
                {supervisors.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            </div>

            {/* Community */}
            <div className="col-md-1">
              <label className="form-label small fw-bold mb-1">Community</label>
              <select className="form-select form-select-sm border rounded-3 shadow-none"
                value={filters.community}
                onChange={e => setFilters(p => ({ ...p, community: e.target.value }))}>
                <option value="all">All</option>
                {communityNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Status */}
            <div className="col-md-1">
              <label className="form-label small fw-bold mb-1">Status</label>
              <select className="form-select form-select-sm border rounded-3 shadow-none"
                value={filters.status}
                onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
                <option value="all">All</option>
                <option value="Selected">Selected</option>
                <option value="Waiting">Waiting</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONFIG + ANALYTICS ROW ── */}
      <div className="row g-3 mb-4 print-hide">
        {/* Config card */}
        <div className="col-lg-3 col-md-4">
          <div className="card shadow-sm border-0 h-100 rounded-3 text-start">
            <div className="card-header py-2 px-3 d-flex align-items-center gap-2 text-white"
              style={{ background: '#364150', borderRadius: '8px 8px 0 0' }}>
              <Settings size={14} />
              <span className="fw-semibold" style={{ fontSize: 12.5 }}>Eligibility & Merit Thresholds</span>
            </div>
            <div className="card-body p-3">
              <form onSubmit={handleSaveConfig} className="d-flex flex-column gap-2">
                <div>
                  <label className="form-label small fw-bold mb-1">PG Min Eligibility (%)</label>
                  <input type="number" min="0" max="100" step="0.01"
                    className="form-control form-control-sm rounded-3 border"
                    value={config.pg_eligibility_pct}
                    onChange={e => setConfig(c => ({ ...c, pg_eligibility_pct: e.target.value }))}
                    required />
                  <div className="text-muted" style={{ fontSize: 9.5 }}>Default 70% — candidates below excluded</div>
                </div>
                <div>
                  <label className="form-label small fw-bold mb-1">Integrated Min Eligibility (%)</label>
                  <input type="number" min="0" max="100" step="0.01"
                    className="form-control form-control-sm rounded-3 border"
                    value={config.integrated_eligibility_pct}
                    onChange={e => setConfig(c => ({ ...c, integrated_eligibility_pct: e.target.value }))}
                    required />
                </div>
                <div>
                  <label className="form-label small fw-bold mb-1">Merit Allocation (%)</label>
                  <input type="number" min="0" max="100" step="0.01"
                    className="form-control form-control-sm rounded-3 border"
                    value={config.merit_percentage}
                    onChange={e => setConfig(c => ({ ...c, merit_percentage: e.target.value }))}
                    required />
                  <div className="text-muted" style={{ fontSize: 9.5 }}>Merit Seats = Vacancies × {config.merit_percentage}%</div>
                </div>
                <div className="p-2 rounded" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: 9.5 }}>
                  <strong>Scoring Formula:</strong><br />
                  Academic Weightage = (Qual% ÷ 100) × 20 [Max 20]<br />
                  Final Score = Entrance + Academic Wt. [Max 90]
                </div>
                <button type="submit" disabled={savingConfig || !filters.session_id}
                  className="btn btn-sm text-white rounded-3 border-0 mt-1"
                  style={{ background: '#364150', fontWeight: 600 }}>
                  {savingConfig ? 'Saving...' : 'Apply & Recalculate'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Analytics card */}
        <div className="col-lg-9 col-md-8">
          <div className="card shadow-sm border-0 h-100 rounded-3 text-start">
            <div className="card-header bg-light py-2 px-3 d-flex align-items-center justify-content-between"
              style={{ borderBottom: '1px solid #dee2e6' }}>
              <span className="fw-semibold text-dark" style={{ fontSize: 13 }}>
                <BarChart3 size={14} className="me-1" style={{ color: '#32c5d2' }} />
                Roster Analytics Dashboard
              </span>
              {stats && (
                <span className="badge bg-secondary-subtle text-secondary small" style={{ fontSize: 9.5 }}>
                  {stats.totalApplicants} approved applicants
                </span>
              )}
            </div>
            <div className="card-body p-3">
              {stats ? (
                <>
                  <div className="row g-2 text-center mb-3">
                    {[
                      { label: 'Total Approved',    value: stats.totalApplicants,      color: '#32c5d2', sub: 'Approved applicants' },
                      { label: 'Roster Eligible',   value: stats.eligibleApplicants,   color: '#16a34a', sub: 'Met degree cutoffs' },
                      { label: 'Ineligible',        value: stats.ineligibleApplicants, color: '#dc2626', sub: 'Below threshold' },
                      { label: 'Total Vacancies',   value: stats.totalVacancies,       color: '#f59e0b', sub: `of ${stats.totalCapacity} capacity` },
                      { label: 'Merit Seats',       value: stats.meritSeats,           color: '#3b82f6', sub: `Top ${config.merit_percentage}%` },
                      { label: 'Reservation Seats', value: stats.reservationSeats,     color: '#8b5cf6', sub: 'Community quotas' },
                      { label: 'Selected',          value: stats.selectedCandidates,   color: '#059669', sub: 'Roster allotted' },
                      { label: 'Waiting',           value: stats.waitingCandidates,    color: '#6b7280', sub: 'Eligible waitlist' },
                      { label: 'Joined',            value: stats.joinedCandidates,     color: '#0891b2', sub: 'Confirmed admission' },
                    ].map((c, i) => (
                      <div key={i} className="col-sm-4 col-6 col-xl-3">
                        <StatCard {...c} />
                      </div>
                    ))}
                  </div>

                  {/* Community distribution */}
                  {stats.communityDistribution?.length > 0 && (
                    <div>
                      <div className="fw-semibold mb-2" style={{ fontSize: 11.5, color: '#364150' }}>
                        Community-wise Selected Distribution
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        {stats.communityDistribution.map(c => (
                          <span key={c.community} className="badge border text-dark px-3 py-2"
                            style={{ background: '#f0f4f8', fontSize: 11 }}>
                            {c.community}: <strong>{c.count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="d-flex align-items-center justify-content-center p-5 text-muted small flex-column gap-2">
                  <Info size={28} className="opacity-40" />
                  Select filters then click <strong>Run Roster Allocator</strong> to generate analytics.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN TAB PANEL ── */}
      <div className="card border-0 shadow-sm rounded-3 mb-4">
        <div className="card-header bg-white border-bottom p-0 print-hide">
          <ul className="nav nav-tabs border-0 px-3">
            {[
              { id: 'roster',   label: 'Selection & Roster Ledger',          icon: FileText },
              { id: 'waitlist', label: 'Waiting Lists',                      icon: Users },
              { id: 'vacancy',  label: 'Vacancy & Scholar Manager',          icon: GraduationCap },
              { id: 'audits',   label: 'Audit Ledger',                       icon: History }
            ].map(tab => (
              <li key={tab.id} className="nav-item">
                <button
                  onClick={() => { setActiveTab(tab.id); setSearchTerm(''); setCurrentPage(1); }}
                  className={`nav-link border-0 py-3 px-3 d-flex align-items-center gap-2 ${activeTab === tab.id ? 'fw-bold' : 'text-muted'}`}
                  style={activeTab === tab.id ? { color: '#32c5d2', borderBottom: '2.5px solid #32c5d2' } : {}}
                >
                  <tab.icon size={14} />
                  <span style={{ fontSize: 12.5 }}>{tab.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card-body p-0">
          {loading && (
            <div className="d-flex align-items-center justify-content-center p-5 text-muted flex-column gap-3" style={{ minHeight: 280 }}>
              <Loader2 className="animate-spin" size={28} style={{ color: '#32c5d2' }} />
              <span className="small">Syncing roster database records...</span>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              TAB 1 — SELECTION & ROSTER LEDGER
          ════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'roster' && (
            <div className="text-start">
              {/* Toolbar */}
              <div className="d-flex flex-wrap align-items-center justify-content-between p-3 border-bottom gap-2 bg-light print-hide">
                <div className="d-flex align-items-center gap-2" style={{ maxWidth: 300 }}>
                  <Search size={14} className="text-muted flex-shrink-0" />
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-3 border shadow-none"
                    placeholder="Search applicants, ID, community..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className="d-flex gap-2 align-items-center flex-wrap">
                  <span className="text-muted small">
                    {filteredRoster.length} records
                    {rosterData.length !== filteredRoster.length && ` (filtered from ${rosterData.length})`}
                  </span>
                  <button onClick={handleExport}
                    className="btn btn-sm btn-outline-success d-flex align-items-center gap-1 rounded-3 shadow-sm">
                    <Download size={12} /> Export Excel
                  </button>
                  <label className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 rounded-3 shadow-sm mb-0"
                    style={{ cursor: importing ? 'not-allowed' : 'pointer' }}>
                    {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {importing ? 'Importing...' : 'Import Excel'}
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="d-none"
                      onChange={handleImport} disabled={importing} />
                  </label>
                </div>
              </div>

              {/* Print toolbar */}
              <div className="print-only px-3 py-2 border-bottom d-flex justify-content-between small">
                <span>Programme: <strong>{progLabel}</strong> | Department: <strong>{deptLabel}</strong></span>
                <span>Total: {rosterData.length} | Selected: {rosterData.filter(r => r.selection_status === 'Selected').length}</span>
              </div>

              {/* Roster Table */}
              <div className="table-responsive">
                <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th className="py-2 px-3" style={{ width: 40 }}>#</th>
                      <th>Application ID</th>
                      <th>Applicant Name</th>
                      <th className="text-center">Community</th>
                      <th className="text-center">Degree</th>
                      <th className="text-center">Qual %</th>
                      <th className="text-center">Acad. Wt.<br /><small className="text-muted fw-normal">/20</small></th>
                      <th className="text-center">Entrance<br /><small className="text-muted fw-normal">/70</small></th>
                      <th className="text-center">Final Score<br /><small className="text-muted fw-normal">/90</small></th>
                      <th className="text-center">Rank</th>
                      <th className="text-center print-hide">Allotted Supervisor</th>
                      <th className="text-center">Selection</th>
                      <th className="text-center print-hide">Admin Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((r, idx) => (
                      <tr key={r.application_id || idx}
                        style={{ background: r.is_excluded ? 'rgba(220,38,38,0.05)' : undefined }}>
                        <td className="px-3 text-muted small">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</td>
                        <td><span className="fw-semibold" style={{ color: '#32c5d2' }}>{r.application_id}</span></td>
                        <td className="fw-semibold text-dark" style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.applicant_name}
                        </td>
                        <td className="text-center">
                          <span className="badge bg-light text-dark border">{r.community}</span>
                        </td>
                        <td className="text-center">{r.degree_type || 'PG'}</td>
                        <td className="text-center">{fmt2(r.degree_percentage)}%</td>
                        <td className="text-center fw-bold">{fmt2(r.academic_weightage)}</td>
                        <td className="text-center">{r.entrance_mark !== null && r.entrance_mark !== undefined ? fmt2(r.entrance_mark) : '—'}</td>
                        <td className="text-center fw-bold text-dark">{fmt2(r.final_score)}</td>
                        <td className="text-center">
                          {r.selection_status === 'Selected' ? (
                            r.allotted_seat_type === 'Merit' ? (
                              <span className="badge bg-primary-subtle text-primary border px-2 py-1" style={{ fontSize: 10 }}>
                                Merit #{r.merit_rank}
                              </span>
                            ) : (
                              <span className="badge border px-2 py-1" style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed', fontSize: 10 }}>
                                {r.allotted_category} #{r.reservation_rank}
                              </span>
                            )
                          ) : r.selection_status === 'Waiting' ? (
                            <span className="badge bg-secondary-subtle text-secondary border px-2 py-1" style={{ fontSize: 10 }}>
                              Wait #{r.merit_rank}
                            </span>
                          ) : r.is_excluded ? (
                            <span className="badge bg-danger-subtle text-danger border px-2 py-1" style={{ fontSize: 10 }} title={r.exclusion_reason}>
                              Excluded
                            </span>
                          ) : '—'}
                        </td>

                        {/* Supervisor allocation (print-hide) */}
                        <td className="text-center print-hide">
                          {r.selection_status === 'Selected' && !r.is_excluded ? (
                            <select
                              className="form-select py-1"
                              style={{ fontSize: 10.5, width: 160, minWidth: 100 }}
                              value={r.allotted_supervisor_id || ''}
                              onChange={e => handleSupervisorAllocation(r.application_id, e.target.value)}>
                              <option value="">— Assign Supervisor —</option>
                              {supervisors.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name} (Vac: {s.current_vacancy ?? 0})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>

                        {/* Selection badge */}
                        <td className="text-center">
                          {r.is_excluded ? (
                            <span className="badge bg-danger" style={{ fontSize: 9 }}>Excluded</span>
                          ) : (
                            <span className={`badge ${r.selection_status === 'Selected' ? 'bg-success' : r.selection_status === 'Waiting' ? 'bg-warning text-dark' : 'bg-secondary'}`}
                              style={{ fontSize: 9 }}>
                              {r.selection_status}
                            </span>
                          )}
                        </td>

                        {/* Admin status dropdown (print-hide) */}
                        <td className="text-center pe-3 print-hide">
                          {r.is_excluded ? (
                            <small className="text-danger" style={{ fontSize: 9.5 }} title={r.exclusion_reason}>
                              <AlertTriangle size={10} className="me-1" />Below cutoff
                            </small>
                          ) : (
                            <select
                              className="form-select py-1"
                              style={{ fontSize: 11, width: 138, fontWeight: 600 }}
                              value={r.roster_status || 'Selected'}
                              onChange={e => handleStatusChange(r.application_id, e.target.value)}>
                              <option value="Selected">Selected</option>
                              <option value="Waiting">Waiting</option>
                              <option value="Joined">Joined</option>
                              <option value="Rejected">Rejected</option>
                              <option value="No Show">No Show</option>
                              <option value="Verification Failed">Fails Verification</option>
                              <option value="Withdrawn">Withdrawn</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                    {currentRows.length === 0 && (
                      <tr>
                        <td colSpan="13" className="text-center py-5 text-muted">
                          <ShieldAlert size={28} className="mb-2 opacity-50 text-warning" />
                          <div>No roster data. Click <strong>Run Roster Allocator</strong> to generate allocations.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="card-footer bg-white border-top py-2 px-3 d-flex align-items-center justify-content-between print-hide">
                  <span className="text-muted small">
                    Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredRoster.length)} of {filteredRoster.length}
                  </span>
                  <div className="d-flex gap-1 flex-wrap">
                    <button className="btn btn-xs btn-outline-secondary px-2"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}>‹ Prev</button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const pg = totalPages <= 7 ? i + 1
                        : currentPage <= 4 ? i + 1
                        : currentPage >= totalPages - 3 ? totalPages - 6 + i
                        : currentPage - 3 + i;
                      return (
                        <button key={pg}
                          className={`btn btn-xs px-2 ${currentPage === pg ? 'text-white' : 'btn-outline-secondary'}`}
                          style={currentPage === pg ? { backgroundColor: '#32c5d2', borderColor: '#32c5d2' } : {}}
                          onClick={() => setCurrentPage(pg)}>{pg}</button>
                      );
                    })}
                    <button className="btn btn-xs btn-outline-secondary px-2"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}>Next ›</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              TAB 2 — WAITING LISTS
          ════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'waitlist' && (
            <div className="p-3 text-start">
              <div className="row g-3">
                {/* Overall Merit Waiting List */}
                <div className="col-md-5">
                  <div className="card border rounded-3 h-100">
                    <div className="card-header bg-light fw-bold py-2 px-3 border-bottom d-flex justify-content-between" style={{ fontSize: 13 }}>
                      <span><TrendingUp size={14} className="me-1 text-primary" />Overall Merit Waiting List</span>
                      <span className="badge bg-secondary-subtle text-secondary">
                        {rosterData.filter(r => r.selection_status === 'Waiting').length} waiting
                      </span>
                    </div>
                    <div className="table-responsive" style={{ maxHeight: 460, overflowY: 'auto' }}>
                      <table className="table table-hover table-striped mb-0" style={{ fontSize: 11.5 }}>
                        <thead>
                          <tr>
                            <th className="ps-3 py-2" style={{ width: 40 }}>Rank</th>
                            <th>App ID</th>
                            <th>Name</th>
                            <th className="text-center">Comm.</th>
                            <th className="text-center">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rosterData.filter(r => r.selection_status === 'Waiting').map((r, i) => (
                            <tr key={r.application_id}>
                              <td className="ps-3 fw-bold" style={{ color: '#32c5d2' }}>#{i + 1}</td>
                              <td className="fw-semibold" style={{ color: '#32c5d2' }}>{r.application_id}</td>
                              <td style={{ maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.applicant_name}</td>
                              <td className="text-center"><span className="badge bg-light text-dark border">{r.community}</span></td>
                              <td className="text-center fw-bold">{fmt2(r.final_score)}</td>
                            </tr>
                          ))}
                          {rosterData.filter(r => r.selection_status === 'Waiting').length === 0 && (
                            <tr><td colSpan="5" className="text-center py-4 text-muted small">No candidates in waiting list.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Community-wise Waiting Lists */}
                <div className="col-md-7">
                  <div className="card border rounded-3 h-100">
                    <div className="card-header bg-light fw-bold py-2 px-3 border-bottom" style={{ fontSize: 13 }}>
                      <Award size={14} className="me-1 text-success" />Community Reservation Waiting Lists
                    </div>
                    <div className="card-body p-3" style={{ maxHeight: 460, overflowY: 'auto' }}>
                      {communityNames.map(comm => {
                        const list = rosterData.filter(r => r.selection_status === 'Waiting' && r.community === comm);
                        return (
                          <div key={comm} className="mb-4">
                            <div className="d-flex justify-content-between align-items-center border-bottom pb-1 mb-2">
                              <span className="fw-bold text-dark small">{comm} Waiting List</span>
                              <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: 9.5 }}>
                                {list.length} waiting
                              </span>
                            </div>
                            {list.length > 0 ? (
                              <div className="table-responsive">
                                <table className="table table-sm mb-0" style={{ fontSize: 11 }}>
                                  <tbody>
                                    {list.slice(0, 8).map((cand, i) => (
                                      <tr key={cand.application_id}>
                                        <td className="fw-bold text-muted" style={{ width: 32 }}>#{i + 1}</td>
                                        <td className="fw-semibold" style={{ color: '#32c5d2' }}>{cand.application_id}</td>
                                        <td style={{ maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cand.applicant_name}</td>
                                        <td className="text-end fw-bold">{fmt2(cand.final_score)}</td>
                                      </tr>
                                    ))}
                                    {list.length > 8 && (
                                      <tr><td colSpan="4" className="text-muted text-center" style={{ fontSize: 9.5 }}>
                                        +{list.length - 8} more candidates waiting…
                                      </td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-muted" style={{ fontSize: 11 }}>No candidates waiting for {comm} category.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              TAB 3 — VACANCY & SCHOLAR MANAGER
          ════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'vacancy' && (
            <div className="p-3 text-start">
              <div className="row g-3">
                {/* Supervisor Vacancy Grid */}
                <div className={selectedSupervisor ? 'col-lg-6 col-12' : 'col-12'}>
                  <div className="card border rounded-3">
                    <div className="card-header bg-light fw-bold py-2 px-3 border-bottom d-flex justify-content-between align-items-center" style={{ fontSize: 13 }}>
                      <span><BookOpen size={14} className="me-1 text-primary" />Supervisor Capacity &amp; Vacancy</span>
                      {stats && (
                        <span className="small text-muted fw-normal">
                          Total Vacancies: <strong style={{ color: '#32c5d2' }}>{stats.totalVacancies}</strong> / {stats.totalCapacity}
                        </span>
                      )}
                    </div>
                    <div className="table-responsive" style={{ maxHeight: 520, overflowY: 'auto' }}>
                      <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f8f9fa' }}>
                            <th className="ps-3 py-2">Supervisor</th>
                            <th className="text-center">Capacity</th>
                            <th className="text-center">Active Scholars</th>
                            <th className="text-center">Roster Allocations</th>
                            <th className="text-center">Available Vacancy</th>
                            <th className="text-center pe-3">Manage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supervisors.map(s => {
                            const rosterAlloc = rosterData.filter(r => r.allotted_supervisor_id === s.id && r.selection_status === 'Selected').length;
                            return (
                              <tr key={s.id}
                                style={{ background: selectedSupervisor?.id === s.id ? 'rgba(50,197,210,0.07)' : undefined }}>
                                <td className="ps-3">
                                  <div className="fw-bold text-dark">{s.name}</div>
                                  <div className="text-muted" style={{ fontSize: 9.5 }}>No: {s.supervisor_no || 'N/A'}</div>
                                </td>
                                <td className="text-center fw-semibold text-primary">{s.max_candidates || 0}</td>
                                <td className="text-center">{s.current_scholars_count || 0}</td>
                                <td className="text-center text-muted">{rosterAlloc}</td>
                                <td className="text-center">
                                  <span className={`badge px-2 py-1 ${(s.current_vacancy || 0) > 0 ? 'bg-success' : 'bg-danger'}`}>
                                    {s.current_vacancy ?? 0} vacant
                                  </span>
                                </td>
                                <td className="text-center pe-3">
                                  <button
                                    onClick={() => handleSelectSupervisor(s)}
                                    className="btn btn-xs py-1 px-2 border d-inline-flex align-items-center gap-1"
                                    style={{ color: '#32c5d2', borderColor: '#32c5d2', fontSize: 10.5 }}>
                                    Scholars <ChevronRight size={10} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {supervisors.length === 0 && (
                            <tr><td colSpan="6" className="text-center py-5 text-muted small">
                              No supervisors found for this department.
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Scholar Directory */}
                {selectedSupervisor && (
                  <div className="col-lg-6 col-12">
                    <div className="card border rounded-3 text-start">
                      <div className="card-header text-white py-2 px-3 d-flex align-items-center justify-content-between"
                        style={{ background: '#364150', borderRadius: '8px 8px 0 0' }}>
                        <span className="fw-semibold" style={{ fontSize: 12.5 }}>
                          Scholars — <strong>{selectedSupervisor.name}</strong>
                        </span>
                        <div className="d-flex gap-2">
                          <button
                            onClick={() => setShowScholarForm(v => !v)}
                            className="btn btn-xs text-white border-0 d-flex align-items-center gap-1"
                            style={{ backgroundColor: '#32c5d2', fontSize: 11, fontWeight: 600 }}>
                            {showScholarForm ? <><X size={10} /> Cancel</> : <><UserPlus size={10} /> Add Scholar</>}
                          </button>
                          <button onClick={() => { setSelectedSupervisor(null); setShowScholarForm(false); }}
                            className="btn btn-xs btn-outline-light d-flex align-items-center" style={{ fontSize: 11 }}>
                            <X size={10} />
                          </button>
                        </div>
                      </div>
                      <div className="card-body p-3">

                        {/* Add Scholar Form */}
                        {showScholarForm && (
                          <div className="p-3 border rounded bg-light mb-3" style={{ animation: 'fadeIn 0.2s' }}>
                            <div className="fw-bold mb-2 small border-bottom pb-1">Record New Active Scholar</div>
                            <form onSubmit={handleAddScholar} className="row g-2">
                              <div className="col-md-6">
                                <label className="form-label mb-0 small fw-bold">Scholar Name *</label>
                                <input type="text" className="form-control form-control-sm border rounded-3"
                                  value={scholarForm.scholar_name}
                                  onChange={e => setScholarForm(s => ({ ...s, scholar_name: e.target.value }))}
                                  required />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label mb-0 small fw-bold">Type</label>
                                <select className="form-select form-select-sm border rounded-3"
                                  value={scholarForm.scholar_type}
                                  onChange={e => setScholarForm(s => ({ ...s, scholar_type: e.target.value }))}>
                                  <option value="Full-Time">Full-Time</option>
                                  <option value="Part-Time">Part-Time</option>
                                </select>
                              </div>
                              <div className="col-md-6">
                                <label className="form-label mb-0 small fw-bold">Enrollment No.</label>
                                <input type="text" className="form-control form-control-sm border rounded-3"
                                  value={scholarForm.enrollment_no}
                                  placeholder="e.g. PU/PHD/2024/001"
                                  onChange={e => setScholarForm(s => ({ ...s, enrollment_no: e.target.value }))} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label mb-0 small fw-bold">Admission Date</label>
                                <input type="date" className="form-control form-control-sm border rounded-3"
                                  value={scholarForm.admission_date}
                                  onChange={e => setScholarForm(s => ({ ...s, admission_date: e.target.value }))} />
                              </div>
                              <div className="col-12 d-flex justify-content-end gap-2 pt-1">
                                <button type="button" className="btn btn-xs btn-outline-secondary px-3"
                                  onClick={() => setShowScholarForm(false)}>Cancel</button>
                                <button type="submit" disabled={addingScholar}
                                  className="btn btn-xs text-white px-3 border-0"
                                  style={{ backgroundColor: '#32c5d2', fontWeight: 600 }}>
                                  {addingScholar ? 'Adding...' : 'Add Scholar'}
                                </button>
                              </div>
                            </form>
                          </div>
                        )}

                        {/* Scholars Table */}
                        <div className="table-responsive" style={{ maxHeight: 380, overflowY: 'auto' }}>
                          <table className="table table-hover align-middle mb-0" style={{ fontSize: 11.5 }}>
                            <thead>
                              <tr>
                                <th>Scholar Details</th>
                                <th>Type</th>
                                <th className="text-center">Status</th>
                                <th className="text-center pe-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scholars.map(sc => (
                                <tr key={sc.id}>
                                  <td>
                                    <div className="fw-bold text-dark">{sc.scholar_name}</div>
                                    <div className="text-muted" style={{ fontSize: 9.5 }}>
                                      {sc.enrollment_no || 'No enrollment no.'}
                                    </div>
                                    {sc.admission_date && (
                                      <div className="text-muted" style={{ fontSize: 9 }}>
                                        Admitted: {new Date(sc.admission_date).toLocaleDateString('en-IN')}
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`badge border ${sc.scholar_type === 'Full-Time' ? 'bg-primary-subtle text-primary' : 'bg-info-subtle text-info'}`}>
                                      {sc.scholar_type}
                                    </span>
                                  </td>
                                  <td className="text-center">
                                    <span className={`badge text-uppercase ${sc.status === 'Admitted' ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: 8.5 }}>
                                      {sc.status}
                                    </span>
                                  </td>
                                  <td className="text-center pe-3">
                                    <div className="d-flex gap-1 justify-content-center">
                                      {sc.status === 'Admitted' ? (
                                        <select
                                          className="form-select py-0"
                                          style={{ fontSize: 10.5, width: 96 }}
                                          value={sc.status}
                                          onChange={e => handleScholarStatus(sc.id, e.target.value)}>
                                          <option value="Admitted">Admitted</option>
                                          <option value="Withdrawn">Withdrawn</option>
                                          <option value="Completed">Completed</option>
                                          <option value="Cancelled">Cancelled</option>
                                          <option value="Transferred">Transferred</option>
                                        </select>
                                      ) : (
                                        <button onClick={() => handleScholarStatus(sc.id, 'Admitted')}
                                          className="btn btn-xs btn-outline-success py-0 px-2" style={{ fontSize: 10 }}>
                                          Re-admit
                                        </button>
                                      )}
                                      <button onClick={() => handleScholarDelete(sc.id)}
                                        className="btn btn-xs btn-outline-danger border-0 p-1"
                                        title="Delete scholar permanently">
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {scholars.length === 0 && (
                                <tr><td colSpan="4" className="text-center py-4 text-muted small">
                                  No scholars recorded under this supervisor.
                                </td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              TAB 4 — AUDIT LEDGER
          ════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'audits' && (
            <div className="text-start">
              {/* Audit Toolbar */}
              <div className="p-3 border-bottom bg-light d-flex flex-wrap gap-2 align-items-end">
                <div style={{ maxWidth: 260 }}>
                  <label className="form-label small fw-bold mb-1">Search Logs</label>
                  <div className="d-flex align-items-center gap-2">
                    <Search size={13} className="text-muted flex-shrink-0" />
                    <input type="text"
                      className="form-control form-control-sm border rounded-3 shadow-none"
                      placeholder="Email, action, details..."
                      value={auditSearch}
                      onChange={e => setAuditSearch(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="form-label small fw-bold mb-1">From Date</label>
                  <input type="date" className="form-control form-control-sm border rounded-3"
                    value={auditStartDate} onChange={e => setAuditStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="form-label small fw-bold mb-1">To Date</label>
                  <input type="date" className="form-control form-control-sm border rounded-3"
                    value={auditEndDate} onChange={e => setAuditEndDate(e.target.value)} />
                </div>
                <button onClick={loadAuditLogs}
                  className="btn btn-sm text-white border-0 d-flex align-items-center gap-1"
                  style={{ backgroundColor: '#32c5d2' }}>
                  <Search size={13} /> Search
                </button>
                <button onClick={() => { setAuditSearch(''); setAuditStartDate(''); setAuditEndDate(''); }}
                  className="btn btn-sm btn-outline-secondary">Clear</button>
                <span className="text-muted small ms-auto align-self-end">{auditLogs.length} records</span>
              </div>

              {/* Audit Table */}
              <div className="table-responsive" style={{ maxHeight: 520 }}>
                <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th className="ps-3 py-2">Timestamp</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Module</th>
                      <th>Changes</th>
                      <th className="pe-3 text-center">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, i) => (
                      <tr key={log.id || i}>
                        <td className="ps-3 text-muted small text-nowrap">
                          {new Date(log.created_at).toLocaleString('en-IN')}
                        </td>
                        <td className="fw-semibold text-dark">{log.admin_email}</td>
                        <td>
                          <span className="badge border px-2 py-1" style={{ background: 'rgba(50,197,210,0.1)', color: '#0891b2', fontSize: 9.5 }}>
                            {log.action}
                          </span>
                        </td>
                        <td className="text-muted small">{log.module}</td>
                        <td style={{ maxWidth: 320, wordBreak: 'break-word' }}>
                          {log.old_value && <div className="text-muted small"><strong>Old:</strong> {log.old_value.substring(0, 120)}{log.old_value.length > 120 ? '…' : ''}</div>}
                          {log.new_value && <div className="text-dark small"><strong>New:</strong> {log.new_value.substring(0, 120)}{log.new_value.length > 120 ? '…' : ''}</div>}
                        </td>
                        <td className="pe-3 text-center"><code style={{ fontSize: 10 }}>{log.ip_address || '—'}</code></td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr><td colSpan="6" className="text-center py-5 text-muted small">
                        No audit logs found. Try adjusting search filters.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="card border-0 mb-3 print-hide" style={{ background: '#f8fafc', borderRadius: 10 }}>
        <div className="card-body py-3 px-4 text-start">
          <h6 className="fw-bold mb-2" style={{ fontSize: 13, color: '#364150' }}>
            <Info size={14} className="me-1" />Roster Processing Guide
          </h6>
          <ul className="mb-0 text-muted" style={{ fontSize: 11.5, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Select a session and programme, then click <strong>Run Roster Allocator</strong> to compute scores, exclusions, merit &amp; reservation seats automatically.</li>
            <li><strong>Eligibility:</strong> Candidates below PG ({config.pg_eligibility_pct}%) or Integrated ({config.integrated_eligibility_pct}%) thresholds are automatically excluded.</li>
            <li><strong>Academic Weightage:</strong> (Qualifying % ÷ 100) × 20 — max 20 marks. <strong>Final Score:</strong> Entrance + Academic Wt — max 90 marks.</li>
            <li><strong>Merit Seats:</strong> Top {config.merit_percentage}% of vacancies allocated by merit rank. Remaining seats distributed by community reservation percentages from portal settings.</li>
            <li><strong>Auto-Replacement:</strong> When a selected candidate is marked Withdrawn / Rejected / No Show / Verification Failed / Cancelled, the engine instantly promotes the next eligible waiting candidate in the same quota category.</li>
            <li><strong>Excel Sync:</strong> Export the ledger, modify Entrance Marks, Degree %, Supervisor allocations or Admin Status, then import back — the engine recalculates everything automatically.</li>
          </ul>
        </div>
      </div>

      {/* Print footer */}
      <div className="print-only mt-5 border-top pt-3 text-center text-muted small">
        Official ERP Output | Periyar University — Dynamic Roster Management Engine
      </div>
    </div>
  );
}
