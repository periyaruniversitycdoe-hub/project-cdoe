import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useSession } from '../contexts/SessionContext';
import { AlertTriangle } from 'lucide-react';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const QUAL_BADGE = {
  Pending:            'bg-secondary text-white',
  Qualified:          'bg-success text-white',
  'Direct Qualified': 'bg-primary text-white',
  Failed:             'bg-danger text-white',
  Absent:             'bg-dark text-white',
};

const EntranceMarks = () => {
  // --- Data states ---
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [markUpdating, setMarkUpdating] = useState(null);
  const [editingMark, setEditingMark]   = useState(null);
  const [attendanceFinished, setAttendanceFinished] = useState(true);

  // --- Search state ---
  const [search, setSearch]             = useState('');

  // --- Dynamic Cascade Filters states ---
  const [years, setYears]               = useState([]);
  const [months, setMonths]             = useState([]);
  const [departments, setDepartments]   = useState([]);
  const [courses, setCourses]           = useState([]);

  // --- Selected Filter states ---
  const [selectedYear, setSelectedYear]     = useState('');
  const [selectedMonth, setSelectedMonth]   = useState('');
  const [selectedDept, setSelectedDept]     = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedResultStatus, setSelectedResultStatus] = useState('All');

  // --- Pagination states ---
  const [page, setPage]                 = useState(1);
  const [limit, setLimit]               = useState(20);
  const [total, setTotal]               = useState(0);
  const [totalPages, setTotalPages]     = useState(1);

  // --- Settings states ---
  const [isPublished, setIsPublished]   = useState(false);
  const [passingMark, setPassingMark]   = useState(50);
  const [savingMark, setSavingMark]     = useState(false);
  const [toggling, setToggling]         = useState(false);

  // --- Summary Counts state ---
  const [summary, setSummary]           = useState({
    total: 0,
    passed: 0,
    failed: 0,
    absent: 0,
    pending: 0,
    qualified: 0,
    direct_qualified: 0
  });

  const { sessions, sessionLabel } = useSession();
  const inputRef = useRef(null);

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  // --- Fetch global entrance settings ---
  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/settings`, { headers });
      if (res.data.success && res.data.data) {
        setIsPublished(!!res.data.data.entrance_result_publish);
      }
      const res2 = await axios.get(`${API_URL}/settings/entrance-settings`, { headers });
      if (res2.data.success && res2.data.data) {
        setPassingMark(res2.data.data.passing_mark);
      }
    } catch (_) {}
  };

  // --- Publish results toggle ---
  const togglePublish = async () => {
    setToggling(true);
    const newStatus = !isPublished;
    try {
      await axios.put(
        `${API_URL}/settings/update`,
        { entrance_result_publish: newStatus ? 1 : 0 },
        { headers }
      );
      setIsPublished(newStatus);
      toast.success(newStatus ? 'Entrance results published to students!' : 'Entrance results hidden from students.');
    } catch {
      toast.error('Failed to update publish status');
    } finally {
      setToggling(false);
    }
  };

  // --- Update Passing Mark ---
  const updatePassingMark = async () => {
    setSavingMark(true);
    try {
      await axios.put(
        `${API_URL}/settings/entrance-settings`,
        { passing_mark: passingMark, total_mark: 100 },
        { headers }
      );
      toast.success('Qualification Pass Mark updated successfully!');
      fetchData();
    } catch {
      toast.error('Failed to update pass mark');
    } finally {
      setSavingMark(false);
    }
  };

  // --- Fetch cascading filter options dynamically ---
  const fetchFilterOptions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('source', 'entrance_marks');
      if (selectedYear) params.append('year', selectedYear);
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedDept) params.append('department', selectedDept);

      const res = await axios.get(`${API_URL}/applications/filters?${params}`, { headers });
      if (res.data.success && res.data.data) {
        const { years, months, departments, courses } = res.data.data;
        setYears(years || []);
        setMonths(months || []);
        setDepartments(departments || []);
        setCourses(courses || []);
      }
    } catch (_) {}
  }, [selectedYear, selectedMonth, selectedDept]);

  // --- Load filter choices on selections changes ---
  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // --- Reset child cascading filters ---
  const handleYearChange = (val) => {
    setSelectedYear(val);
    setSelectedMonth('');
    setSelectedDept('');
    setSelectedCourse('');
    setPage(1);
  };

  const handleMonthChange = (val) => {
    setSelectedMonth(val);
    setSelectedDept('');
    setSelectedCourse('');
    setPage(1);
  };

  const handleDeptChange = (val) => {
    setSelectedDept(val);
    setSelectedCourse('');
    setPage(1);
  };

  const handleCourseChange = (val) => {
    setSelectedCourse(val);
    setPage(1);
  };

  const handleResultStatusChange = (val) => {
    setSelectedResultStatus(val);
    setPage(1);
  };

  // --- Fetch application student list based on pagination + filters ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('source', 'entrance_marks');
      params.append('sort_by', 'created_at');
      params.append('sort_dir', 'desc');

      // Set pagination
      params.append('page', page);
      params.append('limit', limit);

      // Set active filters
      if (search)               params.append('search', search);
      if (selectedYear)         params.append('year', selectedYear);
      if (selectedMonth)        params.append('month', selectedMonth);
      if (selectedDept)         params.append('department', selectedDept);
      if (selectedCourse)       params.append('course', selectedCourse);
      if (selectedResultStatus) params.append('result_status', selectedResultStatus);

      const res = await axios.get(`${API_URL}/applications?${params}`, { headers });
      if (res.data.success) {
        setApplications(res.data.data || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
        setAttendanceFinished(res.data.attendanceFinished !== false);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch {
      toast.error('Failed to fetch applicant data');
    } finally {
      setLoading(false);
    }
  }, [search, selectedYear, selectedMonth, selectedDept, selectedCourse, selectedResultStatus, page, limit]);

  // --- Fetch applications with debounce for search ---
  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  // --- Mount settings ---
  useEffect(() => {
    fetchSettings();
  }, []);

  // --- Open inline edit ---
  const openEdit = (app) => {
    setEditingMark({ id: app.id, value: app.entrance_mark ?? '' });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // --- Save edited mark ---
  const saveMark = async (id) => {
    if (!editingMark || editingMark.id !== id) return;
    setMarkUpdating(id);
    try {
      const res = await axios.put(
        `${API_URL}/applications/${id}/entrance-mark`,
        { entrance_mark: editingMark.value },
        { headers }
      );
      toast.success(`Entrance mark saved successfully!`);
      setEditingMark(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setMarkUpdating(null);
    }
  };

  // --- Export Excel ---
  // mode = 'filtered' or 'all'
  const handleExport = async (mode) => {
    try {
      const params = new URLSearchParams();
      params.append('report_type', 'entrance');
      params.append('source', 'entrance_marks');

      if (mode === 'all') {
        params.append('ignore_filters', 'true');
      } else {
        if (search)               params.append('search', search);
        if (selectedYear)         params.append('year', selectedYear);
        if (selectedMonth)        params.append('month', selectedMonth);
        if (selectedDept)         params.append('department', selectedDept);
        if (selectedCourse)       params.append('course', selectedCourse);
        if (selectedResultStatus) params.append('result_status', selectedResultStatus);
      }

      const res = await axios.get(`${API_URL}/applications/export/excel?${params}`, {
        headers, responseType: 'blob'
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `entrance_marks_${mode === 'all' ? 'complete' : 'filtered'}_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel generated successfully!');
    } catch {
      toast.error('Export failed');
    }
  };

  // --- Helper to instantly recalculate result status in UI ---
  const getResultStatus = (app) => {
    if (app.attendance_status === 'Absent') return 'ABSENT';
    const mark = editingMark && editingMark.id === app.id ? editingMark.value : app.entrance_mark;
    if (mark === null || mark === undefined || mark === '') return 'PENDING';
    return parseFloat(mark) >= parseFloat(passingMark) ? 'PASS' : 'FAIL';
  };

  const getResultStatusBadge = (status) => {
    if (status === 'PASS') return 'bg-success bg-opacity-10 text-success border border-success border-opacity-25';
    if (status === 'FAIL') return 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25';
    if (status === 'ABSENT') return 'bg-dark bg-opacity-10 text-dark border border-dark border-opacity-25';
    return 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25';
  };

  return (
    <div className="container-fluid px-4 py-3" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Header section */}
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#1e293b', fontSize: 24, letterSpacing: '-0.5px' }}>
            Entrance Mark Management
          </h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 13 }}>
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none text-muted">Home</Link></li>
              <li className="breadcrumb-item active text-secondary" aria-current="page">Entrance Marks</li>
            </ol>
          </nav>
        </div>
        
        {/* Pass mark configuration & Actions */}
        <div className="d-flex gap-2 flex-wrap align-items-center bg-white p-2 rounded-3 shadow-sm border">
          <div className="d-flex align-items-center me-2 border rounded px-2 bg-light bg-opacity-50">
            <span className="small fw-bold text-secondary me-2 mb-0" style={{ fontSize: 11 }}>Pass Mark:</span>
            <input 
              type="number" 
              className="form-control form-control-sm border-0 bg-transparent text-center px-0 fw-bold text-dark" 
              style={{ width: 45, outline: 'none', boxShadow: 'none' }}
              value={passingMark} 
              onChange={e => setPassingMark(e.target.value)} 
            />
            <button className="btn btn-sm text-primary p-0 ms-1 fw-bold" style={{ fontSize: 11 }} onClick={updatePassingMark} disabled={savingMark}>
              {savingMark ? '...' : 'Save'}
            </button>
          </div>
          <button
            className={`btn btn-sm fw-semibold transition-all px-3 ${isPublished ? 'btn-success text-white' : 'btn-outline-primary'}`}
            style={{ fontSize: 12, borderRadius: '6px' }}
            onClick={togglePublish}
            disabled={toggling || !attendanceFinished}
          >
            {toggling ? '…' : isPublished ? '✓ Results Published' : 'Publish Entrance Results'}
          </button>
          <button 
            className="btn btn-sm btn-outline-secondary px-3" 
            style={{ fontSize: 12, borderRadius: '6px' }} 
            onClick={() => fetchData()}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary stats cards */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Total Students', count: summary.total,  cls: 'bg-white text-dark border shadow-sm' },
          { label: 'Passed (CET)',   count: summary.passed, cls: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25 shadow-sm' },
          { label: 'Failed (CET)',   count: summary.failed, cls: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 shadow-sm' },
          { label: 'Absent (CET)',   count: summary.absent, cls: 'bg-dark bg-opacity-10 text-secondary border border-secondary border-opacity-25 shadow-sm' },
          { label: 'Pending Marks',  count: summary.pending, cls: 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 shadow-sm' },
          { label: 'Qualified',      count: summary.qualified, cls: 'bg-info bg-opacity-10 text-info border border-info border-opacity-25 shadow-sm' },
          { label: 'Direct Qualified',count: summary.direct_qualified, cls: 'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 shadow-sm' },
        ].map(({ label, count, cls }) => (
          <div key={label} className="col-6 col-sm-4 col-md-3 col-lg">
            <div className={`card border-0 rounded-3 p-3 text-center h-100 ${cls}`} style={{ transition: 'transform 0.2s' }}>
              <div className="fw-extrabold mb-1" style={{ fontSize: 26, letterSpacing: '-1px', fontWeight: 800 }}>{count ?? 0}</div>
              <div className="text-uppercase tracking-wider fw-bold text-muted" style={{ fontSize: 10.5, fontWeight: 700 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {!attendanceFinished && (
        <div className="alert alert-warning border-0 shadow-sm rounded-3 py-3 px-4 mb-4 d-flex align-items-center gap-3 animate-fade-in" style={{ backgroundColor: '#fffbeb', borderLeft: '4px solid #f59e0b' }}>
          <div className="bg-warning bg-opacity-20 text-warning rounded-circle p-2.5 d-flex align-items-center justify-content-center" style={{ width: 42, height: 42, backgroundColor: '#fef3c7' }}>
            <AlertTriangle size={20} className="text-warning" />
          </div>
          <div>
            <h6 className="fw-bold mb-1" style={{ color: '#92400e', fontSize: '14px' }}>Attendance recording is in progress</h6>
            <span className="text-secondary small" style={{ color: '#b45309', fontSize: '12.5px' }}>
              You cannot enter entrance marks yet. Please complete marking attendance for all candidates in the{' '}
              <Link to="/attendance" className="fw-bold text-decoration-underline" style={{ color: '#b45309' }}>
                Attendance Management
              </Link>{' '}
              module first.
            </span>
          </div>
        </div>
      )}

      {/* Search & Cascading Dropdown Filters Panel */}
      <div className="card border-0 shadow-sm rounded-3 mb-4">
        <div className="card-body py-3 px-4">
          <div className="row g-3 align-items-center">
            
            {/* Search Input */}
            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-secondary mb-1">Search Candidate</label>
              <input 
                type="text" 
                className="form-control form-control-sm rounded-2"
                placeholder="Name / App ID / Email..."
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>

            {/* Dynamic Session Year filter */}
            <div className="col-6 col-md-2 col-lg">
              <label className="form-label small fw-bold text-secondary mb-1">Session Year</label>
              <select 
                className="form-select form-select-sm rounded-2 fw-semibold" 
                value={selectedYear} 
                onChange={e => handleYearChange(e.target.value)}
              >
                <option value="">All Years</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Dynamic Session Month filter */}
            <div className="col-6 col-md-2 col-lg">
              <label className="form-label small fw-bold text-secondary mb-1">Session Month</label>
              <select 
                className="form-select form-select-sm rounded-2 fw-semibold" 
                value={selectedMonth} 
                onChange={e => handleMonthChange(e.target.value)}
                disabled={!selectedYear && months.length === 0}
              >
                <option value="">All Months</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Dynamic Department filter */}
            <div className="col-12 col-md-3 col-lg">
              <label className="form-label small fw-bold text-secondary mb-1">Department</label>
              <select 
                className="form-select form-select-sm rounded-2 fw-semibold" 
                value={selectedDept} 
                onChange={e => handleDeptChange(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Dynamic Applied Course filter */}
            <div className="col-6 col-md-2 col-lg">
              <label className="form-label small fw-bold text-secondary mb-1">Applied Course</label>
              <select 
                className="form-select form-select-sm rounded-2 fw-semibold" 
                value={selectedCourse} 
                onChange={e => handleCourseChange(e.target.value)}
              >
                <option value="">All Courses</option>
                {courses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Result Status filter */}
            <div className="col-6 col-md-2 col-lg">
              <label className="form-label small fw-bold text-secondary mb-1">Result Status</label>
              <select 
                className="form-select form-select-sm rounded-2 fw-semibold" 
                value={selectedResultStatus} 
                onChange={e => handleResultStatusChange(e.target.value)}
              >
                <option value="All">All Results</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
                <option value="Pending">Pending</option>
                <option value="Absent">Absent</option>
                <option value="Qualified">Qualified</option>
                <option value="Not Qualified">Not Qualified</option>
                <option value="Direct Qualified">Direct Qualified</option>
              </select>
            </div>
          </div>

          {/* Export and filter stats buttons panel */}
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center border-top mt-3 pt-3 gap-2">
            <div className="text-secondary small">
              Filtered database records match count: <strong className="text-dark">{total}</strong>
            </div>
            
            {/* Dual export modes */}
            <div className="d-flex gap-2">
              <button 
                type="button" 
                className="btn btn-sm btn-outline-success fw-bold d-inline-flex align-items-center gap-1"
                style={{ fontSize: 12, borderRadius: '6px' }}
                onClick={() => handleExport('filtered')}
                disabled={total === 0 || !attendanceFinished}
              >
                <span>Export Filtered Data</span>
              </button>
              <button 
                type="button" 
                className="btn btn-sm btn-success fw-bold d-inline-flex align-items-center gap-1 text-white border-0 shadow-sm"
                style={{ fontSize: 12, borderRadius: '6px', backgroundColor: '#10b981' }}
                onClick={() => handleExport('all')}
                disabled={!attendanceFinished}
              >
                <span>Export Complete Dataset</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Student Data Table */}
      <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
        <div className="card-body p-0">
          <div className="table-responsive" style={{ maxHeight: '600px' }}>
            <table className="table table-hover align-middle mb-0" style={{ fontSize: 13.5 }}>
              <thead className="table-light text-secondary uppercase fw-bold border-bottom" style={{ fontSize: 12 }}>
                <tr>
                  <th className="ps-4 py-3" style={{ width: 50 }}>#</th>
                  <th className="py-3">Session</th>
                  <th className="py-3">Application ID</th>
                  <th className="py-3">Applicant Name</th>
                  <th className="py-3">Email</th>
                  <th className="py-3">Department</th>
                  <th className="py-3">Applied Course</th>
                  <th className="py-3 text-center">Attendance</th>
                  <th className="py-3 text-center" style={{ minWidth: 160 }}>Entrance Mark</th>
                  <th className="py-3 text-center">Result Status</th>
                  <th className="py-3 text-center">Qualification Status</th>
                  <th className="py-3 text-center pe-4" style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody className="border-0">
                {loading ? (
                  <tr><td colSpan={12} className="text-center py-5 text-secondary"><div className="spinner-border spinner-border-sm me-2 text-primary" role="status" />Loading applications...</td></tr>
                ) : applications.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-5 text-muted fw-semibold">
                      {!attendanceFinished 
                        ? 'Attendance recording is in progress for this session. Complete attendance marking first.' 
                        : 'No records match the current filters'}
                    </td>
                  </tr>
                ) : applications.map((app, i) => {
                  const isEditing    = editingMark?.id === app.id;
                  const isSaving     = markUpdating === app.id;
                  const resultStatus = getResultStatus(app);

                  return (
                    <tr key={app.id} className="transition-all hover-row">
                      <td className="ps-4 text-muted small">{((page - 1) * limit) + i + 1}</td>
                      <td>
                        <span className="fw-semibold text-dark">{app.session_name || '—'}</span>
                      </td>
                      <td>
                        <div className="fw-bold text-primary" style={{ fontSize: 12.5 }}>{app.application_id}</div>
                      </td>
                      <td className="fw-bold text-dark">{app.full_name}</td>
                      <td className="text-secondary small">{app.email}</td>
                      <td className="text-dark small fw-semibold">{app.subject || '—'}</td>
                      <td className="small">
                        <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-10 rounded-pill px-2.5 py-1">
                          {app.applied_course || '—'}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`badge rounded-pill px-3 py-1 ${
                          app.attendance_status === 'Present' ? 'bg-success text-white' :
                          app.attendance_status === 'Absent'  ? 'bg-danger text-white' : 'bg-secondary text-white'
                        }`} style={{ fontSize: 11, fontWeight: 600 }}>
                          {app.attendance_status || 'Not Set'}
                        </span>
                      </td>
                      <td className="text-center">
                        {app.attendance_status === 'Absent' ? (
                          <span className="text-secondary small">—</span>
                        ) : isSaving ? (
                          <div className="spinner-border spinner-border-xs text-secondary" role="status" />
                        ) : isEditing ? (
                          <div className="d-flex align-items-center justify-content-center gap-2 animate-fade-in">
                            <input
                              ref={inputRef}
                              type="number" min={0} max={100} step={0.5}
                              className="form-control form-control-sm text-center px-1 fw-bold"
                              style={{ width: 75, height: 28, borderRadius: '4px' }}
                              value={editingMark.value}
                              onChange={e => setEditingMark(prev => ({ ...prev, value: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  saveMark(app.id);
                                if (e.key === 'Escape') setEditingMark(null);
                              }}
                            />
                            <button
                              className="btn btn-sm btn-success py-0 px-2 fw-bold text-white shadow-sm"
                              style={{ fontSize: 11, height: 26 }}
                              onClick={() => saveMark(app.id)}
                            >Enter</button>
                            <button
                              className="btn btn-sm btn-outline-secondary py-0 px-1.5"
                              style={{ fontSize: 11, height: 26 }}
                              onClick={() => setEditingMark(null)}
                            >✕</button>
                          </div>
                        ) : (
                          <span className="fw-bold" style={{ color: app.entrance_mark != null ? '#16a34a' : '#94a3b8' }}>
                            {app.entrance_mark != null ? app.entrance_mark : '—'}
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <span className={`badge rounded-pill px-3 py-1 fw-extrabold ${getResultStatusBadge(resultStatus)}`} style={{ fontSize: 11 }}>
                          {resultStatus}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`badge rounded-pill px-3 py-1 fw-semibold ${QUAL_BADGE[app.qualification_status] || 'bg-secondary text-white'}`} style={{ fontSize: 11 }}>
                          {app.qualification_status || 'Pending'}
                        </span>
                      </td>
                      <td className="text-center pe-4">
                        {app.attendance_status === 'Absent' || app.entrance_exam_status === 'Exempted' ? (
                          <button className="btn btn-sm btn-light disabled text-muted rounded-2 border" style={{ fontSize: 11.5 }} disabled>Edit Mark</button>
                        ) : (
                          <button 
                            className="btn btn-sm btn-outline-primary fw-semibold rounded-2 py-1 px-2.5 transition-all shadow-sm" 
                            style={{ fontSize: 11.5, borderWidth: '1px' }}
                            onClick={() => openEdit(app)}
                          >
                            Edit Mark
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination controls footer */}
          {limit !== 'all' && totalPages > 1 && (
            <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between px-4 py-3 bg-light border-top gap-3">
              <div className="d-flex align-items-center gap-2">
                <span className="small text-secondary">Records per page:</span>
                <select 
                  className="form-select form-select-sm rounded-2 fw-semibold py-1 px-2"
                  style={{ width: 'fit-content' }}
                  value={limit}
                  onChange={e => {
                    const val = e.target.value;
                    setLimit(val === 'all' ? 'all' : parseInt(val, 10));
                    setPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
                <span className="small text-secondary text-muted ms-2">
                  Showing <strong>{((page - 1) * limit) + 1}</strong> to <strong>{Math.min(page * limit, total)}</strong> of <strong>{total}</strong> records
                </span>
              </div>

              {/* Navigation buttons */}
              <div className="d-flex align-items-center gap-1">
                <button 
                  className="btn btn-sm btn-outline-secondary rounded-2 py-1 px-2.5 fw-semibold border"
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                >
                  « First
                </button>
                <button 
                  className="btn btn-sm btn-outline-secondary rounded-2 py-1 px-2.5 fw-semibold border"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  ‹ Prev
                </button>
                
                {/* Pages array */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum = page - 2 + idx;
                  if (page === 1 || page === 2) pageNum = idx + 1;
                  else if (page === totalPages || page === totalPages - 1) pageNum = totalPages - 4 + idx;
                  
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      className={`btn btn-sm rounded-2 py-1 px-2.5 fw-bold border ${page === pageNum ? 'btn-primary text-white border-primary shadow-sm' : 'btn-outline-secondary'}`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button 
                  className="btn btn-sm btn-outline-secondary rounded-2 py-1 px-2.5 fw-semibold border"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next ›
                </button>
                <button 
                  className="btn btn-sm btn-outline-secondary rounded-2 py-1 px-2.5 fw-semibold border"
                  disabled={page === totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  Last »
                </button>
              </div>
            </div>
          )}

          {/* Simple footer for 'All' pagination or simple cases */}
          {(limit === 'all' || totalPages <= 1) && (
            <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between px-4 py-3 bg-light border-top gap-2">
              <div className="d-flex align-items-center gap-2">
                <span className="small text-secondary">Records per page:</span>
                <select 
                  className="form-select form-select-sm rounded-2 fw-semibold py-1 px-2"
                  style={{ width: 'fit-content' }}
                  value={limit}
                  onChange={e => {
                    const val = e.target.value;
                    setLimit(val === 'all' ? 'all' : parseInt(val, 10));
                    setPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="all">All</option>
                </select>
                <span className="small text-secondary text-muted ms-2">
                  Showing all <strong>{total}</strong> records
                </span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default EntranceMarks;
