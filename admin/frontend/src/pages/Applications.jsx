
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useSession } from '../contexts/SessionContext';
import { AlertTriangle, XCircle, Eye } from 'lucide-react';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const QUAL_BADGE = {
  'Pending':          'bg-secondary text-white',
  'Qualified':        'bg-success text-white',
  'Direct Qualified': 'bg-primary text-white',
  'Failed':           'bg-danger text-white',
  'Absent':           'bg-dark text-white',
};

const Applications = () => {
  const navigate = useNavigate();
  const [applications, setApplications]     = useState([]);
  const [loading, setLoading]               = useState(true);
  const [deleting, setDeleting]             = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [selectedRejectionApp, setSelectedRejectionApp] = useState(null);

  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('All');
  const [yearFilter, setYearFilter]       = useState('');
  const [monthFilter, setMonthFilter]     = useState('');
  const [courseFilter, setCourseFilter]   = useState('');
  const [qualFilter, setQualFilter]       = useState('');
  const [admFilter, setAdmFilter]         = useState('');
  const [sortBy, setSortBy]               = useState('created_at');
  const [sortDir, setSortDir]             = useState('desc');

  // Pagination
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Dynamic filter lists
  const [years, setYears] = useState([]);
  const [months, setMonths] = useState([]);
  const [courses, setCourses] = useState([]);

  // Sessions come from the shared context (no extra fetch needed)
  const { sessions, activeSession } = useSession();
  const activeSessionId = activeSession ? activeSession.id : null;

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch initial filters on mount
  useEffect(() => {
    const fetchInitialFilters = async () => {
      try {
        const res = await axios.get(`${API_URL}/applications/filters`, { headers });
        if (res.data.success) {
          setYears(res.data.data.years || []);
          setMonths(res.data.data.months || []);
          setCourses(res.data.data.courses || []);
        }
      } catch (err) {
        console.error('Failed to fetch initial filters', err);
      }
    };
    fetchInitialFilters();
  }, []);

  // Fetch dynamic cascading filters
  useEffect(() => {
    const fetchCascadedFilters = async () => {
      try {
        const params = new URLSearchParams();
        if (yearFilter) params.append('year', yearFilter);
        if (monthFilter) params.append('month', monthFilter);

        const res = await axios.get(`${API_URL}/applications/filters?${params}`, { headers });
        if (res.data.success) {
          if (!yearFilter && !monthFilter) {
            setMonths(res.data.data.months || []);
            setCourses(res.data.data.courses || []);
          } else {
            if (yearFilter) {
              setMonths(res.data.data.months || []);
            }
            setCourses(res.data.data.courses || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch cascaded filters', err);
      }
    };

    if (yearFilter || monthFilter) {
      fetchCascadedFilters();
    } else {
      const fetchAll = async () => {
        try {
          const res = await axios.get(`${API_URL}/applications/filters`, { headers });
          if (res.data.success) {
            setMonths(res.data.data.months || []);
            setCourses(res.data.data.courses || []);
          }
        } catch {}
      };
      fetchAll();
    }
  }, [yearFilter, monthFilter]);

  // `page` is intentionally excluded from the useCallback deps — it is passed
  // as an explicit argument so the function reference only changes when filters
  // change, not on every page increment. This eliminates the double-fetch that
  // occurred when a filter change triggered both a setPage(1) reset AND a new
  // fetchApplications reference in the same render cycle.
  const fetchApplications = useCallback(async (targetPage, signal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)                 params.append('search', search);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (yearFilter)             params.append('year', yearFilter);
      if (monthFilter)            params.append('month', monthFilter);
      if (courseFilter)           params.append('course', courseFilter);
      if (qualFilter)             params.append('qualification_status', qualFilter);
      if (admFilter !== '')       params.append('admission_approved', admFilter);
      params.append('sort_by', sortBy);
      params.append('sort_dir', sortDir);
      params.append('page',  targetPage);
      params.append('limit', limit);

      const res = await axios.get(`${API_URL}/applications?${params}`, { headers, signal });
      setApplications(res.data.data || []);
      setTotalCount(res.data.total  || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') toast.error('Failed to fetch applications');
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, yearFilter, monthFilter, courseFilter, qualFilter, admFilter, sortBy, sortDir, limit]);

  // Reset to page 1 when any filter changes.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, yearFilter, monthFilter, courseFilter, qualFilter, admFilter, sortBy, sortDir, limit]);

  // Debounced fetch — AbortController cancels the previous in-flight request
  // before the new one fires, preventing out-of-order response races.
  useEffect(() => {
    const ac = new AbortController();
    const t = setTimeout(() => fetchApplications(page, ac.signal), 400);
    return () => { clearTimeout(t); ac.abort(); };
  }, [fetchApplications, page]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete application for "${name}"? This will also remove the student account.`)) return;
    setDeleting(id);
    try {
      await axios.delete(`${API_URL}/applications/${id}`, { headers });
      toast.success('Application deleted');
      fetchApplications();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    finally { setDeleting(null); }
  };

  const handleStatusChange = async (id, status) => {
    setStatusUpdating(id);
    try {
      await axios.put(`${API_URL}/applications/${id}/status`, { status }, { headers });
      toast.success(`Status updated to "${status}"`);
      fetchApplications();
    } catch { toast.error('Status update failed'); }
    finally { setStatusUpdating(null); }
  };

  const handleAdmission = async (id, approved) => {
    try {
      await axios.put(`${API_URL}/applications/${id}/admission`, { approved }, { headers });
      toast.success(approved ? 'Admission approved' : 'Admission rejected');
      fetchApplications();
    } catch { toast.error('Admission update failed'); }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('report_type', 'applications');
      if (yearFilter)             params.append('year', yearFilter);
      if (monthFilter)            params.append('month', monthFilter);
      if (courseFilter)           params.append('course', courseFilter);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (qualFilter)             params.append('qualification_status', qualFilter);
      if (admFilter !== '')       params.append('admission_approved', admFilter);
      const res = await axios.get(`${API_URL}/applications/export/excel?${params}`, {
        headers, responseType: 'blob'
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `applications_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  const handleAddNew = () => navigate('/applications/new');

  const sortToggle = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => (
    <span className="text-muted ms-1" style={{ fontSize: 10 }}>
      {sortBy === col ? (sortDir === 'asc' ? '(asc)' : '(desc)') : ''}
    </span>
  );

  const getStatusBadge = (status) => {
    const map = {
      'Approved':     'bg-success text-white',
      'Rejected':     'bg-danger text-white',
      'Submitted':    'bg-info text-white',
      'Under Review': 'bg-warning text-dark',
      'Draft':        'bg-secondary text-white',
    };
    return (
      <span className={`badge rounded-pill px-3 py-1 ${map[status] || 'bg-secondary text-white'}`} style={{ fontSize: 11 }}>
        {status || 'Draft'}
      </span>
    );
  };

  const { sessionLabel } = useSession();

  const btnSm = { fontSize: 11, padding: '3px 10px', fontWeight: 600 };

  return (
    <div>
      {/* Page Header */}
      <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>Application Management</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 12 }}>
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
              <li className="breadcrumb-item active">Applications</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-sm btn-outline-success" style={btnSm} onClick={handleExport}>Export Excel</button>
          <button className="btn btn-sm btn-outline-secondary" style={btnSm} onClick={fetchApplications}>Refresh</button>
          <button className="btn btn-sm btn-primary" style={btnSm} onClick={handleAddNew}>Add New</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <input type="text" className="form-control form-control-sm" placeholder="Search by Name / App ID / Email..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-auto" style={{ minWidth: 135 }}>
              <select className="form-select form-select-sm" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                <option value="">Select Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="col-auto" style={{ minWidth: 135 }}>
              <select className="form-select form-select-sm" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                <option value="">Select Month</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-auto" style={{ minWidth: 140 }}>
              <select className="form-select form-select-sm" value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                <option value="">Select Course</option>
                {courses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-auto">
              <select className="form-select form-select-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="All">All Status</option>
                {['Draft','Submitted','Under Review','Approved','Rejected'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-auto">
              <select className="form-select form-select-sm" value={qualFilter} onChange={e => setQualFilter(e.target.value)}>
                <option value="">All Qualification</option>
                <option value="Pending">Pending</option>
                <option value="Qualified">Qualified</option>
                <option value="Direct Qualified">Direct Qualified</option>
                <option value="Failed">Failed</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
            <div className="col-auto">
              <select className="form-select form-select-sm" value={admFilter} onChange={e => setAdmFilter(e.target.value)}>
                <option value="">All Admission</option>
                <option value="1">Approved</option>
                <option value="0">Not Approved</option>
              </select>
            </div>
            <div className="col-auto">
              <select className="form-select form-select-sm" value={limit} onChange={e => setLimit(e.target.value)}>
                <option value={10}>10 Per Page</option>
                <option value={20}>20 Per Page</option>
                <option value={50}>50 Per Page</option>
                <option value={100}>100 Per Page</option>
                <option value={200}>200 Per Page</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center mt-2">
            <div className="d-flex gap-1 flex-wrap">
              {yearFilter && (
                <span className="badge bg-secondary text-white" style={{ fontSize: 11 }}>
                  Year: {yearFilter}
                  <button className="btn-close btn-close-sm ms-1" style={{ fontSize: 8, filter: 'invert(1)' }} onClick={() => setYearFilter('')} />
                </span>
              )}
              {monthFilter && (
                <span className="badge bg-secondary text-white" style={{ fontSize: 11 }}>
                  Month: {monthFilter}
                  <button className="btn-close btn-close-sm ms-1" style={{ fontSize: 8, filter: 'invert(1)' }} onClick={() => setMonthFilter('')} />
                </span>
              )}
              {courseFilter && (
                <span className="badge bg-secondary text-white" style={{ fontSize: 11 }}>
                  Course: {courseFilter}
                  <button className="btn-close btn-close-sm ms-1" style={{ fontSize: 8, filter: 'invert(1)' }} onClick={() => setCourseFilter('')} />
                </span>
              )}
              {qualFilter && (
                <span className="badge bg-primary text-white" style={{ fontSize: 11 }}>
                  Qualification: {qualFilter}
                  <button className="btn-close btn-close-sm ms-1" style={{ fontSize: 8, filter: 'invert(1)' }} onClick={() => setQualFilter('')} />
                </span>
              )}
              {admFilter !== '' && (
                <span className="badge bg-dark text-white" style={{ fontSize: 11 }}>
                  Admission: {admFilter === '1' ? 'Approved' : 'Not Approved'}
                  <button className="btn-close btn-close-sm ms-1" style={{ fontSize: 8, filter: 'invert(1)' }} onClick={() => setAdmFilter('')} />
                </span>
              )}
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {limit === 'all' ? (
                <>Displaying <strong>1–{totalCount}</strong> of <strong>{totalCount}</strong> records</>
              ) : (
                <>Displaying <strong>{totalCount === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, totalCount)}</strong> of <strong>{totalCount}</strong> records</>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
              <thead className="table-light">
                <tr>
                  <th className="ps-3 py-3" style={{ width: 40 }}>#</th>
                  <th className="py-3" style={{ cursor: 'pointer' }} onClick={() => sortToggle('application_id')}>
                    Application ID <SortIcon col="application_id" />
                  </th>
                  <th className="py-3" style={{ cursor: 'pointer' }} onClick={() => sortToggle('full_name')}>
                    Applicant Name <SortIcon col="full_name" />
                  </th>
                  <th className="py-3">Subject</th>
                  <th className="py-3">Status</th>
                  <th className="py-3" style={{ cursor: 'pointer' }} onClick={() => sortToggle('qualification_status')}>
                    Qualification <SortIcon col="qualification_status" />
                  </th>
                  <th className="py-3" style={{ minWidth: 160, cursor: 'pointer' }} onClick={() => sortToggle('admission_approved')}>
                    Admission <SortIcon col="admission_approved" />
                  </th>
                  <th className="py-3 text-center" style={{ minWidth: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">Loading applications...</td>
                  </tr>
                ) : applications.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">No applications found</td>
                  </tr>
                ) : applications.map((app, i) => (
                  <tr key={app.id}>

                    {/* # */}
                    <td className="ps-3 text-muted">{(page - 1) * limit + i + 1}</td>

                    {/* Application ID */}
                    <td>
                      <div className="fw-bold text-primary" style={{ fontSize: 12 }}>{app.application_id}</div>
                      {app.session_name && (
                        <div className="text-muted" style={{ fontSize: 10 }}>{app.session_name}</div>
                      )}
                    </td>

                    {/* Applicant */}
                    <td>
                      <div className="fw-semibold">{app.full_name}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{app.email}</div>
                    </td>

                    {/* Subject */}
                    <td className="text-muted" style={{ fontSize: 11 }}>{app.subject || '—'}</td>

                    {/* Status */}
                    <td>{getStatusBadge(app.status)}</td>

                    {/* Qualification */}
                    <td>
                      <span className={`badge rounded-pill px-3 py-1 ${QUAL_BADGE[app.qualification_status] || 'bg-secondary text-white'}`} style={{ fontSize: 11 }}>
                        {app.qualification_status || 'Pending'}
                      </span>
                    </td>

                    {/* Admission */}
                    <td>
                      <div className="mb-1">
                        <span className={`badge rounded-pill px-3 py-1 ${app.admission_approved ? 'bg-success text-white' : app.admission_approved === 0 ? 'bg-danger text-white' : 'bg-secondary text-white'}`} style={{ fontSize: 11 }}>
                          {app.admission_approved ? 'Approved' : app.admission_approved === 0 ? 'Rejected' : 'Pending'}
                        </span>
                      </div>
                      <div className="d-flex gap-1">
                        <button
                          className={`btn btn-sm ${app.admission_approved ? 'btn-success' : 'btn-outline-success'}`}
                          style={{ fontSize: 10, padding: '2px 8px' }}
                          onClick={() => handleAdmission(app.id, true)}
                        >Approve</button>
                        <button
                          className={`btn btn-sm ${app.admission_approved === 0 && app.admission_approved !== null ? 'btn-danger' : 'btn-outline-danger'}`}
                          style={{ fontSize: 10, padding: '2px 8px' }}
                          onClick={() => handleAdmission(app.id, false)}
                        >Reject</button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="text-center">
                      <div className="d-flex gap-1 justify-content-center flex-wrap">
                        <Link
                          to={`/applications/${app.id}`}
                          className="btn btn-sm btn-outline-info fw-semibold"
                          style={{ fontSize: 11, padding: '3px 10px' }}
                        >View</Link>
                        {app.status === 'Rejected' && (
                          <button
                            className="btn btn-sm btn-outline-danger fw-semibold"
                            style={{ fontSize: 11, padding: '3px 10px' }}
                            onClick={() => setSelectedRejectionApp(app)}
                          >View Reason</button>
                        )}
                        <Link
                          to={`/applications/${app.id}?edit=1`}
                          className="btn btn-sm btn-outline-warning fw-semibold"
                          style={{ fontSize: 11, padding: '3px 10px' }}
                        >Edit</Link>
                        <button
                          className="btn btn-sm btn-outline-primary fw-semibold"
                          style={{ fontSize: 11, padding: '3px 10px' }}
                          onClick={() => handleStatusChange(app.id, 'Submitted')}
                          disabled={statusUpdating === app.id}
                        >{statusUpdating === app.id ? 'Submitting...' : 'Submit'}</button>
                        <button
                          className="btn btn-sm btn-outline-danger fw-semibold"
                          style={{ fontSize: 11, padding: '3px 10px' }}
                          disabled={deleting === app.id}
                          onClick={() => handleDelete(app.id, app.full_name)}
                        >{deleting === app.id ? 'Deleting...' : 'Delete'}</button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex align-items-center justify-content-between mt-3 px-1">
          <span className="text-muted" style={{ fontSize: 12 }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <div className="d-flex gap-1">
            <button
              className="btn btn-sm btn-outline-secondary"
              style={{ fontSize: 12 }}
              disabled={page === 1}
              onClick={() => setPage(1)}
            >«</button>
            <button
              className="btn btn-sm btn-outline-secondary"
              style={{ fontSize: 12 }}
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >‹ Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const pg = start + idx;
              return (
                <button
                  key={pg}
                  className={`btn btn-sm ${pg === page ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ fontSize: 12, minWidth: 34 }}
                  onClick={() => setPage(pg)}
                >{pg}</button>
              );
            })}
            <button
              className="btn btn-sm btn-outline-secondary"
              style={{ fontSize: 12 }}
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >Next ›</button>
            <button
              className="btn btn-sm btn-outline-secondary"
              style={{ fontSize: 12 }}
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
            >»</button>
          </div>
        </div>
      )}

      {selectedRejectionApp && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: 14,
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            width: '100%', maxWidth: 520,
            maxHeight: '90vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ background: '#fef2f2', borderRadius: '14px 14px 0 0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fca5a5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={22} color="#ef4444" />
                <span style={{ fontWeight: 700, fontSize: 17, color: '#991b1b' }}>Rejection Details</span>
              </div>
              <button onClick={() => setSelectedRejectionApp(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280', lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Application ID</div>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{selectedRejectionApp.application_id || '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Applicant Name</div>
                    <div style={{ fontWeight: 700 }}>{selectedRejectionApp.full_name || '—'}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reason Category</div>
                <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>{selectedRejectionApp.rejection_category || 'Other'}</div>
              </div>

              {selectedRejectionApp.rejection_reason && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Detailed Reason</div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>
                    {selectedRejectionApp.rejection_reason}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 12, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: 10, fontWeight: 600, marginBottom: 2 }}>REJECTED BY</div>
                  <div style={{ fontWeight: 600 }}>{selectedRejectionApp.rejected_by_name || 'Admin'}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', fontSize: 10, fontWeight: 600, marginBottom: 2 }}>REJECTED DATE</div>
                  <div style={{ fontWeight: 600 }}>
                    {selectedRejectionApp.rejection_datetime ? new Date(selectedRejectionApp.rejection_datetime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary px-4 btn-sm" onClick={() => setSelectedRejectionApp(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;
