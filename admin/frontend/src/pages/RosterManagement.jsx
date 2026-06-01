import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  BarChart3, FileText, CreditCard, Ticket, UserCheck, BookOpen,
  Users, GraduationCap, Award, History, Download, Upload, Search,
  Filter, Printer, Loader2, Calendar, ShieldAlert, AlertTriangle,
  RefreshCw, CheckCircle, Plus, Settings, ChevronRight, UserMinus,
  Edit, Trash2, Power, UserPlus, CheckCircle2, ChevronDown
} from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

export default function RosterManagement() {
  const [activeTab, setActiveTab] = useState('roster'); // roster, waitlist, vacancy, audits
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Filter lists loaded from DB
  const [sessions, setSessions] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [allSupervisors, setAllSupervisors] = useState([]);
  const [communities, setCommunities] = useState([]);

  // Active Filters
  const [filters, setFilters] = useState({
    session_id: '',
    program_id: '',
    department_id: '',
    supervisor_id: 'all',
    community: 'all',
    status: 'all' // all, Selected, Waiting
  });

  // Roster Configuration state
  const [config, setConfig] = useState({
    pg_eligibility_pct: 70,
    integrated_eligibility_pct: 70,
    merit_percentage: 30
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Statistics Dashboard state
  const [stats, setStats] = useState(null);

  // Data lists
  const [rosterData, setRosterData] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [scholars, setScholars] = useState([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [showScholarForm, setShowScholarForm] = useState(false);
  const [scholarForm, setScholarForm] = useState({
    scholar_name: '',
    scholar_type: 'Full-Time',
    enrollment_no: '',
    admission_date: '',
    status: 'Admitted'
  });
  const [addingScholar, setAddingScholar] = useState(false);

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
  });

  // 1. Initial Load of dropdowns
  useEffect(() => {
    // Sessions
    axios.get(`${API}/sessions`, getHeaders())
      .then(res => {
        const data = res.data.data || [];
        setSessions(data);
        const active = data.find(s => s.is_active === 1);
        if (active) {
          setFilters(prev => ({ ...prev, session_id: String(active.id) }));
        } else if (data.length > 0) {
          setFilters(prev => ({ ...prev, session_id: String(data[0].id) }));
        }
      }).catch(() => toast.error('Failed to load sessions'));

    // Departments
    axios.get(`${API}/eligibility/departments/all`, getHeaders())
      .then(res => setDepartments(res.data.data || []))
      .catch(() => {});

    // Communities
    axios.get(`${API}/settings/community-fees`, getHeaders())
      .then(res => setCommunities(res.data.data || []))
      .catch(() => {});

    // All Supervisors
    axios.get(`${API}/supervisors`, getHeaders())
      .then(res => {
        setAllSupervisors(res.data.data?.rows || (Array.isArray(res.data.data) ? res.data.data : []));
      }).catch(() => {});
  }, []);

  // Cascading Filters Trigger:
  // When Session changes, check if there are programmes
  useEffect(() => {
    if (filters.session_id) {
      axios.get(`${API}/eligibility/programs/all`, getHeaders())
        .then(res => {
          const progs = res.data.data || [];
          setProgrammes(progs);
          if (progs.length > 0) {
            setFilters(prev => ({ ...prev, program_id: String(progs[0].id) }));
          }
        }).catch(() => {});

      // Load config for this session
      axios.get(`${API}/roster/config/${filters.session_id}`, getHeaders())
        .then(res => {
          if (res.data.success && res.data.data) {
            setConfig({
              pg_eligibility_pct: parseFloat(res.data.data.pg_eligibility_pct),
              integrated_eligibility_pct: parseFloat(res.data.data.integrated_eligibility_pct),
              merit_percentage: parseFloat(res.data.data.merit_percentage)
            });
          }
        }).catch(() => {});
    }
  }, [filters.session_id]);

  // When Program Offered is selected, cascade Department & Supervisors
  useEffect(() => {
    if (filters.program_id && programmes.length > 0) {
      const selectedProg = programmes.find(p => String(p.id) === String(filters.program_id));
      if (selectedProg) {
        // Automatically select the department associated with this program
        const deptId = String(selectedProg.department_id);
        setFilters(prev => ({ ...prev, department_id: deptId, supervisor_id: 'all' }));

        // Filter supervisors associated with this department
        const filteredSups = allSupervisors.filter(s => String(s.department_id) === deptId);
        setSupervisors(filteredSups);
      }
    }
  }, [filters.program_id, programmes, allSupervisors]);

  // Main data loader triggers on active filters or active tab changes
  const loadRosterData = useCallback(async () => {
    if (!filters.session_id || !filters.program_id || !filters.department_id) return;
    setLoading(true);

    try {
      const qParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val && val !== 'all') qParams.append(key, val);
      });

      // Load Roster selections grid
      const res = await axios.get(`${API}/roster/list?${qParams.toString()}`, getHeaders());
      setRosterData(res.data.data || []);

      // Load Dashboard Analytics
      const statsRes = await axios.get(`${API}/roster/analytics?${qParams.toString()}`, getHeaders());
      setStats(statsRes.data.data);

      if (activeTab === 'audits') {
        const auditRes = await axios.get(`${API}/roster/audit-logs`, getHeaders());
        setAuditLogs(auditRes.data.data || []);
      }

      if (selectedSupervisor) {
        loadScholars(selectedSupervisor.id);
      }
    } catch {
      toast.error('Failed to load roster selection lists.');
    } finally {
      setLoading(false);
    }
  }, [filters, activeTab, selectedSupervisor]);

  useEffect(() => {
    loadRosterData();
  }, [loadRosterData]);

  // Handle Roster Real-Time Recalculation
  const handleRecalculate = async () => {
    if (!filters.session_id || !filters.program_id || !filters.department_id) return;
    setRecalculating(true);
    const toastId = toast.loading('Calculating Roster Marks, Exclusions and Allocating Seats...');

    try {
      const res = await axios.post(`${API}/roster/recalculate`, {
        session_id: parseInt(filters.session_id),
        program_id: parseInt(filters.program_id),
        department_id: parseInt(filters.department_id)
      }, getHeaders());

      if (res.data.success) {
        toast.success('Roster allocations recalculated and updated in database.', { id: toastId });
        loadRosterData();
      } else {
        toast.error(res.data.message || 'Recalculation failed.', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Recalculation engine error.', { id: toastId });
    } finally {
      setRecalculating(false);
    }
  };

  // Handle Save Configuration
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await axios.post(`${API}/roster/config`, {
        session_id: parseInt(filters.session_id),
        pg_eligibility_pct: parseFloat(config.pg_eligibility_pct),
        integrated_eligibility_pct: parseFloat(config.integrated_eligibility_pct),
        merit_percentage: parseFloat(config.merit_percentage)
      }, getHeaders());

      toast.success('Roster thresholds and merit percentage updated.');
      handleRecalculate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Handle Selection Status Change (Reject / Withdraw) -> Triggers Auto Replacement
  const handleStatusChange = async (appId, newStatus) => {
    const toastId = toast.loading('Updating candidate status and running Auto-Replacement Engine...');
    try {
      const res = await axios.put(`${API}/roster/status/${appId}`, { roster_status: newStatus }, getHeaders());
      if (res.data.success) {
        if (res.data.promoted) {
          const promo = res.data.promoted;
          toast.success(
            `Status updated. Candidate ${promo.released_name} was replaced by ${promo.promoted_name} in ${promo.category} quota!`,
            { id: toastId, duration: 6000 }
          );
        } else {
          toast.success('Candidate status updated successfully.', { id: toastId });
        }
        loadRosterData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change status.', { id: toastId });
    }
  };

  // Handle Supervisor allocation update
  const handleSupervisorAllocation = async (appId, supId) => {
    try {
      const res = await axios.put(`${API}/roster/allocate-supervisor/${appId}`, { supervisor_id: supId ? parseInt(supId) : null }, getHeaders());
      if (res.data.success) {
        toast.success('Allotted supervisor updated successfully.');
        loadRosterData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to allot supervisor.');
    }
  };

  // Handle Export Excel
  const handleExportExcel = () => {
    const qParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val && val !== 'all') qParams.append(key, val);
    });

    const toastId = toast.loading('Generating Excel Roster Report...');
    axios.get(`${API}/roster/export?${qParams.toString()}`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
    }).then(res => {
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `roster_selections_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Roster exported successfully!', { id: toastId });
    }).catch(() => {
      toast.error('Failed to export roster.', { id: toastId });
    });
  };

  // Handle Excel Import
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('excel', file);
    formData.append('session_id', filters.session_id);
    formData.append('program_id', filters.program_id);
    formData.append('department_id', filters.department_id);

    const toastId = toast.loading('Uploading and validating modified Roster selections...');
    axios.post(`${API}/roster/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    }).then(res => {
      if (res.data.success) {
        const { total, updated, skipped, failed, errors } = res.data;
        if (failed > 0) {
          toast.error(
            `Import finished with warnings. Processed: ${total}, Updated: ${updated}, Failed: ${failed}. Download error logs below.`,
            { id: toastId, duration: 6000 }
          );
        } else {
          toast.success(`Import succeeded! Processed: ${total}, Updated: ${updated} rows in database.`, { id: toastId });
        }
        loadRosterData();
      }
    }).catch(err => {
      toast.error(err.response?.data?.message || 'Import failed.', { id: toastId });
    });
  };

  // Scholars list loader
  const loadScholars = (supId) => {
    axios.get(`${API}/roster/scholars?supervisor_id=${supId}`, getHeaders())
      .then(res => setScholars(res.data.data || []))
      .catch(() => toast.error('Failed to load active scholars list.'));
  };

  // Select supervisor for scholars management
  const handleSelectSupervisor = (sup) => {
    setSelectedSupervisor(sup);
    loadScholars(sup.id);
    setShowScholarForm(false);
  };

  // Scholar Add Submission
  const handleAddScholarSubmit = async (e) => {
    e.preventDefault();
    if (!scholarForm.scholar_name.trim()) return;

    setAddingScholar(true);
    try {
      const res = await axios.post(`${API}/roster/scholars`, {
        ...scholarForm,
        supervisor_id: selectedSupervisor.id,
        programme_id: parseInt(filters.program_id) || null,
        department_id: parseInt(filters.department_id) || null
      }, getHeaders());

      if (res.data.success) {
        toast.success('New active scholar successfully recorded.');
        setScholarForm({
          scholar_name: '',
          scholar_type: 'Full-Time',
          enrollment_no: '',
          admission_date: '',
          status: 'Admitted'
        });
        setShowScholarForm(false);
        loadScholars(selectedSupervisor.id);
        loadRosterData(); // Reload vacancies globally
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add scholar.');
    } finally {
      setAddingScholar(false);
    }
  };

  // Scholar status toggle (Withdrawn / Completed / Cancelled)
  const handleScholarStatusChange = async (scholarId, currentStatus, targetStatus) => {
    try {
      const res = await axios.put(`${API}/roster/scholars/${scholarId}`, { status: targetStatus }, getHeaders());
      if (res.data.success) {
        toast.success(`Scholar status changed to ${targetStatus}. Vacancies recalculated.`);
        loadScholars(selectedSupervisor.id);
        loadRosterData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.');
    }
  };

  // Scholar delete
  const handleScholarDelete = async (scholarId) => {
    if (!window.confirm('Are you sure you want to permanently delete this scholar? This will instantly release supervisor vacancy.')) return;
    try {
      const res = await axios.delete(`${API}/roster/scholars/${scholarId}`, getHeaders());
      if (res.data.success) {
        toast.success('Scholar removed successfully.');
        loadScholars(selectedSupervisor.id);
        loadRosterData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete scholar.');
    }
  };

  // Search filter inside Roster Grid
  const filteredRoster = rosterData.filter(row => {
    return Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const indexOfLastRow = currentPage * itemsPerPage;
  const indexOfFirstRow = indexOfLastRow - itemsPerPage;
  const currentRows = filteredRoster.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredRoster.length / itemsPerPage);

  const selectedProgrammeName = rosterData[0]?.programme_name || 'Selected Programme';
  const selectedDepartmentName = rosterData[0]?.department_name || 'Selected Department';

  return (
    <div className="p-3" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* ── Header Title & Recalculate ── */}
      <div className="d-flex align-items-center justify-content-between mb-3 print-hide">
        <div>
          <h2 className="fw-bold mb-0 text-start" style={{ color: '#32c5d2', fontSize: '22px' }}>
            Dynamic Roster Management Engine
          </h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: '12px' }}>
              <li className="breadcrumb-item"><a href="/" className="text-decoration-none text-teal">Home</a></li>
              <li className="breadcrumb-item active">Admission Management</li>
              <li className="breadcrumb-item active">Dynamic Roster Management</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex gap-2">
          <button
            onClick={handleRecalculate}
            disabled={recalculating || loading}
            className="btn btn-sm btn-teal text-white d-flex align-items-center gap-1 shadow-sm border-0"
            style={{ backgroundColor: '#32c5d2', fontWeight: 600 }}
          >
            {recalculating ? (
              <><Loader2 className="animate-spin" size={14} /> Recalculating...</>
            ) : (
              <><RefreshCw size={14} /> Run Roster Allocator</>
            )}
          </button>
          <button onClick={() => window.print()} className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 shadow-sm">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* ── Printable Header ── */}
      <div className="print-only mb-4 text-center">
        <h2 className="fw-bold mb-1" style={{ color: '#1e3a8a' }}>PERIYAR UNIVERSITY</h2>
        <h5 className="text-secondary mb-3">Ph.D Admission ERP System - Dynamic Roster Allocation Ledger</h5>
        <div className="p-2 border rounded bg-light text-start small mb-3">
          <div><strong>Academic Session:</strong> {sessions.find(s => String(s.id) === String(filters.session_id))?.month} {sessions.find(s => String(s.id) === String(filters.session_id))?.year}</div>
          <div><strong>Program & Department:</strong> {selectedProgrammeName} / {selectedDepartmentName}</div>
          <div><strong>Report Date:</strong> {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* ── 1. Global cascading Filter Panel ── */}
      <div className="card shadow-sm border-0 mb-4 print-hide" style={{ background: '#f8fafc', borderRadius: '10px' }}>
        <div className="card-body p-3">
          <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-2">
            <Filter size={16} className="text-teal" style={{ color: '#32c5d2' }} />
            <span className="fw-bold text-dark" style={{ fontSize: 13 }}>Roster Dropdown Filters</span>
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, supervisor_id: 'all', community: 'all', status: 'all' }));
                setSearchTerm('');
              }}
              className="btn btn-link text-danger p-0 ms-auto border-0 text-decoration-none small"
              style={{ fontSize: '11px', fontWeight: 600 }}
            >
              Reset Filters
            </button>
          </div>

          <div className="row g-2 text-start">
            {/* Session */}
            <div className="col-md-3">
              <label className="form-label small fw-bold">Academic Session</label>
              <select
                className="form-select form-select-sm rounded-3 shadow-none border"
                value={filters.session_id}
                onChange={e => setFilters(p => ({ ...p, session_id: e.target.value }))}
              >
                {sessions.map(s => (
                  <option key={s.id} value={String(s.id)}>
                    {s.month} {s.year} {s.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Ph.D Programme */}
            <div className="col-md-3">
              <label className="form-label small fw-bold">Ph.D Programme</label>
              <select
                className="form-select form-select-sm rounded-3 shadow-none border"
                value={filters.program_id}
                onChange={e => setFilters(p => ({ ...p, program_id: e.target.value }))}
              >
                {programmes.map(p => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="col-md-3">
              <label className="form-label small fw-bold">Department (Auto)</label>
              <select
                className="form-select form-select-sm rounded-3 bg-light border"
                value={filters.department_id}
                disabled
              >
                {departments.map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Supervisor */}
            <div className="col-md-3">
              <label className="form-label small fw-bold">Supervisor filter</label>
              <select
                className="form-select form-select-sm rounded-3 shadow-none border"
                value={filters.supervisor_id}
                onChange={e => setFilters(p => ({ ...p, supervisor_id: e.target.value }))}
              >
                <option value="all">All Supervisors</option>
                {supervisors.map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Community */}
            <div className="col-md-3">
              <label className="form-label small fw-bold">Community Category</label>
              <select
                className="form-select form-select-sm rounded-3 shadow-none border"
                value={filters.community}
                onChange={e => setFilters(p => ({ ...p, community: e.target.value }))}
              >
                <option value="all">All Communities</option>
                {['OC', 'BC', 'MBC', 'SC', 'ST'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="col-md-3">
              <label className="form-label small fw-bold">Selection Status</label>
              <select
                className="form-select form-select-sm rounded-3 shadow-none border"
                value={filters.status}
                onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
              >
                <option value="all">All Statuses</option>
                <option value="Selected">Selected</option>
                <option value="Waiting">Waiting</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Configuration & Statistics Grid ── */}
      <div className="row g-3 mb-4 print-hide">
        {/* Configurations Card */}
        <div className="col-lg-4 col-md-5">
          <div className="card shadow-sm border-0 h-100 rounded-3 text-start">
            <div className="card-header bg-dark text-white py-2 px-3 d-flex align-items-center gap-2" style={{ background: '#364150', borderRadius: '8px 8px 0 0' }}>
              <Settings size={15} />
              <span className="fw-semibold" style={{ fontSize: '13px' }}>Eligibility & Merit Thresholds</span>
            </div>
            <div className="card-body p-3">
              <form onSubmit={handleSaveConfig} className="d-flex flex-column gap-3">
                <div>
                  <label className="form-label small fw-bold mb-1">PG Min Eligibility (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-control form-control-sm rounded-3 border"
                    value={config.pg_eligibility_pct}
                    onChange={e => setConfig(c => ({ ...c, pg_eligibility_pct: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="form-label small fw-bold mb-1">Integrated Min Eligibility (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-control form-control-sm rounded-3 border"
                    value={config.integrated_eligibility_pct}
                    onChange={e => setConfig(c => ({ ...c, integrated_eligibility_pct: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="form-label small fw-bold mb-1">Merit Allocation Quota (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-control form-control-sm rounded-3 border"
                    value={config.merit_percentage}
                    onChange={e => setConfig(c => ({ ...c, merit_percentage: e.target.value }))}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingConfig || loading}
                  className="btn btn-sm btn-dark w-100 rounded-3 shadow-none mt-2"
                  style={{ background: '#364150', fontWeight: 600 }}
                >
                  {savingConfig ? 'Saving...' : 'Apply & Recalculate'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Dashboard Analytics Card */}
        <div className="col-lg-8 col-md-7">
          <div className="card shadow-sm border-0 h-100 rounded-3 text-start">
            <div className="card-header bg-light py-2 px-3 d-flex align-items-center justify-content-between" style={{ borderBottom: '1px solid #dee2e6' }}>
              <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                <BarChart3 size={15} className="me-1 text-teal" style={{ color: '#32c5d2' }} /> Roster Analytics Dashboard
              </span>
              {stats && (
                <span className="badge bg-secondary-subtle text-secondary px-2 rounded-pill small" style={{ fontSize: 10 }}>
                  Processed {stats.totalApplicants} applicants
                </span>
              )}
            </div>
            <div className="card-body p-3">
              {stats ? (
                <div className="row g-2 text-center">
                  {[
                    { label: 'Total Approved', val: stats.totalApplicants, color: '#32c5d2', subtitle: 'Passed Entrance' },
                    { label: 'Roster Eligible', val: stats.eligibleApplicants, color: '#2ecc71', subtitle: 'Met degree cutoffs' },
                    { label: 'Total Vacancies', val: stats.totalVacancies, color: '#f39c12', subtitle: 'Under supervisor' },
                    { label: 'Merit Allocation', val: stats.meritSeats, color: '#3498db', subtitle: `Top ${config.merit_percentage}% ranked` },
                    { label: 'Reservation Seats', val: stats.reservationSeats, color: '#9b59b6', subtitle: 'Community quotas' },
                    { label: 'Selected Candidates', val: stats.selectedCandidates, color: '#27ae60', subtitle: 'Roster allotted' },
                    { label: 'Waiting Candidates', val: stats.waitingCandidates, color: '#7f8c8d', subtitle: 'Eligible Waitlist' },
                    { label: 'Ineligible Excluded', val: stats.ineligibleApplicants, color: '#e74c3c', subtitle: 'Below degree cutoff' }
                  ].map((card, index) => (
                    <div key={index} className="col-sm-3 col-6">
                      <div className="p-2 border rounded bg-light d-flex flex-column align-items-center h-100 justify-content-center">
                        <span className="text-muted small fw-semibold text-truncate w-100" style={{ fontSize: '10.5px' }}>{card.label}</span>
                        <span className="fs-3 fw-bold my-1" style={{ color: card.color }}>{card.val}</span>
                        <span className="text-muted text-truncate w-100" style={{ fontSize: '9px' }}>{card.subtitle}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="d-flex align-items-center justify-content-center p-5 text-muted small">
                  Select filters above and click 'Run Roster Allocator' to generate statistics.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Main Operational Tab Map ── */}
      <div className="card border-0 shadow-sm rounded-3 print-hide mb-4">
        <div className="card-header bg-white border-bottom p-0">
          <ul className="nav nav-tabs border-0 px-3">
            {[
              { id: 'roster', label: 'Selection & Roster Ledger', icon: FileText },
              { id: 'waitlist', label: 'Auto waiting Lists', icon: Users },
              { id: 'vacancy', label: 'Dynamic Vacancy & Scholar Manager', icon: GraduationCap },
              { id: 'audits', label: 'Roster Audits Ledger', icon: History }
            ].map(tab => (
              <li key={tab.id} className="nav-item">
                <button
                  onClick={() => { setActiveTab(tab.id); setSearchTerm(''); setCurrentPage(1); }}
                  className={`nav-link border-0 py-3 px-3 d-flex align-items-center gap-2 ${
                    activeTab === tab.id ? 'active fw-bold text-teal border-bottom-teal' : 'text-muted'
                  }`}
                  style={activeTab === tab.id ? { color: '#32c5d2', borderBottom: '2.5px solid #32c5d2' } : {}}
                >
                  <tab.icon size={15} />
                  <span className="small">{tab.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Tab Panel */}
        <div className="card-body p-0">
          {loading && (
            <div className="d-flex align-items-center justify-content-center p-5 text-muted small" style={{ minHeight: 300 }}>
              <Loader2 className="animate-spin text-teal me-2" size={24} style={{ color: '#32c5d2' }} />
              Syncing roster ledger database records...
            </div>
          )}

          {!loading && activeTab === 'roster' && (
            /* ── Tab 1: Selection & Roster Ledger ── */
            <div className="text-start">
              {/* Toolbar */}
              <div className="d-flex flex-wrap align-items-center justify-content-between p-3 border-bottom gap-3 bg-light">
                <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '350px' }}>
                  <Search size={15} className="text-muted" />
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-3 shadow-none border"
                    placeholder="Search applicants..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="d-flex gap-2 align-items-center">
                  <span className="text-muted small me-2">Filtered count: <strong>{filteredRoster.length}</strong></span>
                  <button onClick={handleExportExcel} className="btn btn-sm btn-outline-success d-flex align-items-center gap-1 shadow-sm rounded-3">
                    <Download size={13} /> Export Excel
                  </button>
                  <label className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 shadow-sm rounded-3 mb-0 cursor-pointer">
                    <Upload size={13} /> Import Excel
                    <input type="file" accept=".xlsx,.xls" className="d-none" onChange={handleExcelImport} />
                  </label>
                </div>
              </div>

              {/* Roster Table */}
              <div className="table-responsive">
                <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th className="py-2 px-3">Applicant ID</th>
                      <th className="py-2">Applicant Name</th>
                      <th className="py-2">Degree Category</th>
                      <th className="py-2 text-center">Qualifying %</th>
                      <th className="py-2 text-center">Academic Wt.</th>
                      <th className="py-2 text-center">Entrance Mark</th>
                      <th className="py-2 text-center">Final Score</th>
                      <th className="py-2 text-center">Rank</th>
                      <th className="py-2 text-center">Selection Quota</th>
                      <th className="py-2 text-center">Allotted Supervisor</th>
                      <th className="py-2 text-center">Selection Status</th>
                      <th className="py-2 text-center">Administrative Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((r, idx) => (
                      <tr key={r.application_id || idx} style={{ background: r.is_excluded ? 'rgba(231,76,60,0.06)' : undefined }}>
                        <td className="ps-3"><span className="fw-semibold text-teal">{r.application_id}</span></td>
                        <td className="fw-semibold text-dark">{r.applicant_name}</td>
                        <td>{r.degree_type || 'PG'}</td>
                        <td className="text-center">{parseFloat(r.degree_percentage || 0).toFixed(2)}%</td>
                        <td className="text-center fw-bold">{parseFloat(r.academic_weightage || 0).toFixed(2)}</td>
                        <td className="text-center">{r.entrance_mark !== null ? parseFloat(r.entrance_mark).toFixed(2) : '—'}</td>
                        <td className="text-center fw-bold text-dark">{parseFloat(r.final_score || 0).toFixed(2)} / 90</td>
                        <td className="text-center">
                          {r.selection_status === 'Selected' ? (
                            r.allotted_seat_type === 'Merit' ? (
                              <span className="badge bg-primary-subtle text-primary border px-2 py-1">Merit #{r.merit_rank}</span>
                            ) : (
                              <span className="badge bg-purple-subtle text-purple border px-2 py-1" style={{ backgroundColor: 'rgba(155,89,182,0.1)', color: '#9b59b6', border: '1px solid rgba(155,89,182,0.3)' }}>
                                {r.allotted_category} #{r.reservation_rank}
                              </span>
                            )
                          ) : r.selection_status === 'Waiting' ? (
                            <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">Waitlist #{r.merit_rank}</span>
                          ) : '—'}
                        </td>
                        <td className="text-center">
                          <span className={`badge px-2 py-1 border ${r.allotted_seat_type === 'Merit' ? 'bg-primary-subtle text-primary' : (r.allotted_seat_type === 'Reservation' ? 'bg-info-subtle text-info' : 'bg-light text-muted')}`}>
                            {r.allotted_seat_type ? `${r.allotted_seat_type} (${r.allotted_category})` : 'Unallotted'}
                          </span>
                        </td>
                        <td className="text-center">
                          {r.selection_status === 'Selected' ? (
                            <select
                              className="form-select form-select-xs py-1"
                              style={{ fontSize: '11px', width: '170px' }}
                              value={r.allotted_supervisor_id || ''}
                              onChange={e => handleSupervisorAllocation(r.application_id, e.target.value)}
                            >
                              <option value="">— Choose Supervisor —</option>
                              {supervisors.map(s => (
                                <option key={s.id} value={s.id}>{s.name} (Vac: {s.current_vacancy})</option>
                              ))}
                            </select>
                          ) : '—'}
                        </td>
                        <td className="text-center">
                          {r.is_excluded ? (
                            <span className="badge bg-danger px-2 py-1 border text-uppercase" style={{ fontSize: 9 }} title={r.exclusion_reason}>Excluded Cutoff</span>
                          ) : (
                            <span className={`badge px-2 py-1 border text-uppercase ${r.selection_status === 'Selected' ? 'bg-success text-white' : (r.selection_status === 'Waiting' ? 'bg-warning text-dark' : 'bg-light text-muted')}`} style={{ fontSize: 9 }}>
                              {r.selection_status}
                            </span>
                          )}
                        </td>
                        <td className="text-center pe-3">
                          {r.is_excluded ? (
                            <small className="text-danger" style={{ fontSize: 10 }} title={r.exclusion_reason}>Below cutoff threshold</small>
                          ) : (
                            <select
                              className="form-select form-select-xs py-1"
                              style={{ fontSize: '11.5px', width: '130px', fontWeight: 'bold' }}
                              value={r.roster_status || 'Selected'}
                              onChange={e => handleStatusChange(r.application_id, e.target.value)}
                            >
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
                        <td colSpan="12" className="text-center py-5 text-muted">
                          <ShieldAlert size={28} className="mx-auto mb-2 opacity-50 text-warning" />
                          No roster allocations matching search or filters. Click 'Run Roster Allocator' if ledger is empty.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              {totalPages > 1 && (
                <div className="card-footer bg-white border-top py-3 px-3 d-flex align-items-center justify-content-between">
                  <div className="text-muted small">
                    Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredRoster.length)} of {filteredRoster.length} rows
                  </div>
                  <div className="d-flex gap-1">
                    <button
                      className="btn btn-xs btn-outline-secondary px-2"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, idx) => (
                      <button
                        key={idx + 1}
                        className={`btn btn-xs ${currentPage === idx + 1 ? 'btn-teal text-white' : 'btn-outline-secondary'} px-2`}
                        style={currentPage === idx + 1 ? { backgroundColor: '#32c5d2', borderColor: '#32c5d2' } : {}}
                        onClick={() => setCurrentPage(idx + 1)}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      className="btn btn-xs btn-outline-secondary px-2"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === 'waitlist' && (
            /* ── Tab 2: Auto waiting Lists ── */
            <div className="text-start p-3">
              <div className="row g-3">
                {/* Merit Waitlist */}
                <div className="col-md-6">
                  <div className="card border h-100 rounded-3">
                    <div className="card-header bg-light fw-bold text-dark py-2 px-3 small border-bottom" style={{ fontSize: '13px' }}>
                      Overall Merit Waitlist (Ranks 1 to 50)
                    </div>
                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '12px' }}>
                          <thead>
                            <tr>
                              <th className="ps-3 py-2">Rank</th>
                              <th>Applicant ID</th>
                              <th>Applicant Name</th>
                              <th>Community</th>
                              <th className="text-center">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rosterData.filter(r => r.selection_status === 'Waiting').slice(0, 50).map((r, idx) => (
                              <tr key={r.application_id || idx}>
                                <td className="ps-3 fw-bold text-teal">#{idx + 1}</td>
                                <td><span className="fw-semibold text-teal">{r.application_id}</span></td>
                                <td>{r.applicant_name}</td>
                                <td><span className="badge bg-light text-dark border">{r.community}</span></td>
                                <td className="text-center fw-bold">{parseFloat(r.final_score || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                            {rosterData.filter(r => r.selection_status === 'Waiting').length === 0 && (
                              <tr><td colSpan="5" className="text-center py-4 text-muted small">No candidates in Merit waiting list.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Community Waitlists */}
                <div className="col-md-6">
                  <div className="card border h-100 rounded-3">
                    <div className="card-header bg-light fw-bold text-dark py-2 px-3 small border-bottom" style={{ fontSize: '13px' }}>
                      Community Reservation Waitlists
                    </div>
                    <div className="card-body p-3" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                      {['OC', 'BC', 'MBC', 'SC', 'ST'].map(comm => {
                        const list = rosterData.filter(r => r.selection_status === 'Waiting' && r.community === comm);
                        return (
                          <div key={comm} className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-2 border-bottom pb-1">
                              <span className="fw-bold text-dark">{comm} Waiting List</span>
                              <span className="badge bg-secondary-subtle text-secondary small">{list.length} waiting</span>
                            </div>
                            {list.length > 0 ? (
                              <div className="table-responsive">
                                <table className="table table-sm table-hover mb-0" style={{ fontSize: '11.5px' }}>
                                  <tbody>
                                    {list.slice(0, 5).map((cand, index) => (
                                      <tr key={cand.application_id}>
                                        <td className="fw-bold" style={{ width: '40px' }}>#{index + 1}</td>
                                        <td className="fw-semibold text-teal">{cand.application_id}</td>
                                        <td>{cand.applicant_name}</td>
                                        <td className="text-end fw-bold">{parseFloat(cand.final_score).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                    {list.length > 5 && (
                                      <tr><td colSpan="4" className="text-center text-muted small" style={{ fontSize: 10 }}>And {list.length - 5} more waiting...</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-muted small py-1" style={{ fontSize: 11 }}>No candidates waiting for this community.</div>
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

          {!loading && activeTab === 'vacancy' && (
            /* ── Tab 3: Dynamic Vacancy & Scholar Manager ── */
            <div className="text-start p-3">
              <div className="row g-3">
                {/* Supervisor Vacancy Grid */}
                <div className={selectedSupervisor ? 'col-lg-6 col-12' : 'col-12'}>
                  <div className="card border rounded-3">
                    <div className="card-header bg-light fw-bold text-dark py-2 px-3 small border-bottom" style={{ fontSize: '13px' }}>
                      Supervisors Capacity & Vacancy Calculations
                    </div>
                    <div className="card-body p-0">
                      <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: '#f8f9fa' }}>
                              <th className="ps-3 py-2">Supervisor</th>
                              <th className="text-center">Intake Capacity</th>
                              <th className="text-center">Active Scholars</th>
                              <th className="text-center">Roster Allocations</th>
                              <th className="text-center">Available Vacancy</th>
                              <th className="text-center pe-3" style={{ width: '130px' }}>Scholars Directory</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supervisors.map((s, idx) => {
                              const activeAllocations = rosterData.filter(r => r.allotted_supervisor_id === s.id && r.selection_status === 'Selected').length;
                              return (
                                <tr key={s.id} style={{ background: selectedSupervisor?.id === s.id ? 'rgba(50,197,210,0.08)' : undefined }}>
                                  <td className="ps-3">
                                    <div className="fw-bold text-dark">{s.name}</div>
                                    <div className="text-muted small" style={{ fontSize: 9.5 }}>Supervisor No: {s.supervisor_no || 'N/A'}</div>
                                  </td>
                                  <td className="text-center fw-semibold text-primary">{s.max_candidates}</td>
                                  <td className="text-center text-dark">{s.current_scholars_count || 0}</td>
                                  <td className="text-center text-muted">{activeAllocations}</td>
                                  <td className="text-center">
                                    <span className={`badge px-2 py-1 ${s.current_vacancy > 0 ? 'bg-success' : 'bg-danger'}`}>
                                      {s.current_vacancy} vacancies
                                    </span>
                                  </td>
                                  <td className="text-center pe-3">
                                    <button
                                      onClick={() => handleSelectSupervisor(s)}
                                      className="btn btn-xs btn-outline-teal d-inline-flex align-items-center gap-1 py-1 px-2 border"
                                      style={{ color: '#32c5d2', borderColor: '#32c5d2', fontSize: '10.5px' }}
                                    >
                                      Manage scholars <ChevronRight size={10} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            {supervisors.length === 0 && (
                              <tr><td colSpan="6" className="text-center py-5 text-muted">No supervisors registered for this department.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scholars directory list */}
                {selectedSupervisor && (
                  <div className="col-lg-6 col-12" style={{ animation: 'slideIn 0.3s ease-out' }}>
                    <div className="card border rounded-3 text-start">
                      <div className="card-header bg-dark text-white py-2 px-3 d-flex align-items-center justify-content-between" style={{ background: '#364150' }}>
                        <span className="fw-semibold" style={{ fontSize: '13px' }}>
                          Scholars under: <strong>{selectedSupervisor.name}</strong>
                        </span>
                        <button
                          onClick={() => setShowScholarForm(!showScholarForm)}
                          className="btn btn-xs btn-teal text-white d-flex align-items-center gap-1 border-0"
                          style={{ backgroundColor: '#32c5d2', fontSize: '11px', fontWeight: 600 }}
                        >
                          {showScholarForm ? 'Cancel' : <><UserPlus size={11} /> Record Scholar</>}
                        </button>
                      </div>

                      <div className="card-body p-3">
                        {/* Record Scholar Form */}
                        {showScholarForm && (
                          <div className="p-3 border rounded bg-light mb-3" style={{ animation: 'slideDown 0.25s ease-out' }}>
                            <h6 className="fw-bold mb-2 small text-dark border-bottom pb-1">Record New Active Scholar</h6>
                            <form onSubmit={handleAddScholarSubmit} className="row g-2">
                              <div className="col-md-6">
                                <label className="form-label mb-0 small fw-bold">Scholar Name *</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm rounded-3 border"
                                  value={scholarForm.scholar_name}
                                  onChange={e => setScholarForm(s => ({ ...s, scholar_name: e.target.value }))}
                                  required
                                />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label mb-0 small fw-bold">Scholar Type</label>
                                <select
                                  className="form-select form-select-sm rounded-3 border"
                                  value={scholarForm.scholar_type}
                                  onChange={e => setScholarForm(s => ({ ...s, scholar_type: e.target.value }))}
                                >
                                  <option value="Full-Time">Full-Time</option>
                                  <option value="Part-Time">Part-Time</option>
                                </select>
                              </div>
                              <div className="col-md-6">
                                <label className="form-label mb-0 small fw-bold">Enrollment / Reg No</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm rounded-3 border"
                                  value={scholarForm.enrollment_no}
                                  onChange={e => setScholarForm(s => ({ ...s, enrollment_no: e.target.value }))}
                                  placeholder="e.g. PU/PHD/123"
                                />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label mb-0 small fw-bold">Admission Date</label>
                                <input
                                  type="date"
                                  className="form-control form-control-sm rounded-3 border"
                                  value={scholarForm.admission_date}
                                  onChange={e => setScholarForm(s => ({ ...s, admission_date: e.target.value }))}
                                />
                              </div>
                              <div className="col-12 pt-2 d-flex justify-content-end gap-1">
                                <button type="button" className="btn btn-outline-secondary btn-xs px-2" onClick={() => setShowScholarForm(false)}>Cancel</button>
                                <button type="submit" disabled={addingScholar} className="btn btn-teal btn-xs text-white px-3 border-0" style={{ backgroundColor: '#32c5d2', fontWeight: 600 }}>
                                  {addingScholar ? 'Recording...' : 'Add Scholar'}
                                </button>
                              </div>
                            </form>
                          </div>
                        )}

                        {/* Scholars list */}
                        <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                          <table className="table table-hover align-middle mb-0" style={{ fontSize: '11.5px' }}>
                            <thead>
                              <tr>
                                <th>Scholar Details</th>
                                <th>Type</th>
                                <th className="text-center">Status</th>
                                <th className="text-center pe-3" style={{ width: '130px' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scholars.map((sc, i) => (
                                <tr key={sc.id || i}>
                                  <td>
                                    <div className="fw-bold text-dark">{sc.scholar_name}</div>
                                    <div className="text-muted" style={{ fontSize: 9.5 }}>Enrollment: {sc.enrollment_no || '—'}</div>
                                    {sc.admission_date && <div className="text-muted" style={{ fontSize: 9 }}>Admitted: {new Date(sc.admission_date).toLocaleDateString()}</div>}
                                  </td>
                                  <td>
                                    <span className={`badge ${sc.scholar_type === 'Full-Time' ? 'bg-primary-subtle text-primary' : 'bg-info-subtle text-info'} border`}>
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
                                          className="form-select form-select-xs py-0"
                                          style={{ fontSize: '10.5px', width: '90px' }}
                                          value={sc.status}
                                          onChange={e => handleScholarStatusChange(sc.id, sc.status, e.target.value)}
                                        >
                                          <option value="Admitted">Admitted</option>
                                          <option value="Withdrawn">Withdrawn</option>
                                          <option value="Completed">Completed</option>
                                          <option value="Cancelled">Cancelled</option>
                                          <option value="Transferred">Transferred</option>
                                        </select>
                                      ) : (
                                        <button
                                          onClick={() => handleScholarStatusChange(sc.id, sc.status, 'Admitted')}
                                          className="btn btn-xs btn-outline-success py-0 px-1"
                                          style={{ fontSize: 10 }}
                                        >
                                          Re-admit
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleScholarDelete(sc.id)}
                                        className="btn btn-xs btn-outline-danger border-0 p-1"
                                        title="Delete scholar permanently"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {scholars.length === 0 && (
                                <tr><td colSpan="4" className="text-center py-4 text-muted small">No scholars catalogued under this supervisor.</td></tr>
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

          {!loading && activeTab === 'audits' && (
            /* ── Tab 4: Roster Audits Ledger ── */
            <div className="text-start">
              {/* Toolbar */}
              <div className="p-3 border-bottom bg-light">
                <div className="d-flex align-items-center gap-2" style={{ maxWidth: '350px' }}>
                  <Search size={15} className="text-muted" />
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-3 shadow-none border"
                    placeholder="Search logs by email, action, details..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Audits Table */}
              <div className="table-responsive">
                <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th className="ps-3 py-2">Timestamp</th>
                      <th>Admin Email</th>
                      <th>Action</th>
                      <th>Module</th>
                      <th>Activity Details / Changes</th>
                      <th className="pe-3 text-center">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs
                      .filter(row => {
                        return Object.values(row).some(val =>
                          String(val).toLowerCase().includes(searchTerm.toLowerCase())
                        );
                      })
                      .map((log, idx) => (
                        <tr key={log.id || idx}>
                          <td className="ps-3 small text-muted">
                            {new Date(log.created_at).toLocaleString('en-IN')}
                          </td>
                          <td className="fw-semibold text-dark">{log.admin_email}</td>
                          <td><span className="badge bg-teal-subtle text-teal border px-2 py-1" style={{ backgroundColor: 'rgba(50,197,210,0.1)', color: '#32c5d2', border: '1px solid rgba(50,197,210,0.3)' }}>{log.action}</span></td>
                          <td>{log.module}</td>
                          <td className="small" style={{ wordBreak: 'break-word', maxWidth: '350px' }}>
                            <div className="text-muted"><strong>Old:</strong> {log.old_value || '—'}</div>
                            <div className="text-dark"><strong>New:</strong> {log.new_value || '—'}</div>
                          </td>
                          <td className="pe-3 text-center"><code>{log.ip_address}</code></td>
                        </tr>
                      ))}
                    {auditLogs.length === 0 && (
                      <tr><td colSpan="6" className="text-center py-5 text-muted">No Roster audit logs registered in database.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Dynamic Roster Info Banner ── */}
      <div className="card border-0 mt-3 print-hide" style={{ background: '#f8f9fa', borderRadius: '10px' }}>
        <div className="card-body py-3 px-4 text-start">
          <h6 className="fw-bold mb-2" style={{ fontSize: '13px', color: '#364150' }}>Roster Processing Instructions</h6>
          <ul className="mb-0 text-muted" style={{ fontSize: '11.5px', paddingLeft: '18px', lineHeight: '1.6' }}>
            <li>Select an academic session and programme, then click the **Run Roster Allocator** button to automatically filter cutoff cut-out criteria, compute Academic Weightage, Final Scores, and allocate selected/waitlisted seat ledgers in database.</li>
            <li>Eligibility Engine: Candidate degrees PG/Integrated are resolved automatically. Cutoff settings PG ({config.pg_eligibility_pct}%) and Integrated ({config.integrated_eligibility_pct}%) automatically exclude applicants below guidelines from selection.</li>
            <li>Seat Quotas: Merit Seats are computed as **{config.merit_percentage}%** of vacancies. Reservation Quotas are calculated dynamically for the remaining seats using configured percentages from the portal settings.</li>
            <li>Auto-Replacement Engine: When you change a selected candidate's status to **Withdrawn**, **Rejected**, **No Show**, **Fails Verification** or **Cancelled**, the engine instantly identifies the category and promotes the next eligible waitlisted candidate automatically.</li>
            <li>Two-Way synchronization: Modifications can be made in bulk. Export the selection ledger to Excel, perform corrections on Entrance Marks, degree percentage, or Supervisor allotments, and upload the updated spreadsheet back to commit modifications instantly!</li>
          </ul>
        </div>
      </div>

      {/* ── Print Watermark ── */}
      <div className="print-only mt-5 text-center border-top pt-3 small text-muted">
        <div>Official ERP Output Document | Periyar University ERP Admins Panel</div>
        <div>Dynamic Roster selections are fully authenticated and sealed. IP: <code>localhost</code></div>
      </div>
    </div>
  );
}
