import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useSession } from '../contexts/SessionContext';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const ATT_BADGE = {
  Present: 'bg-success text-white',
  Absent:  'bg-danger text-white',
};

const AttendanceManagement = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [attUpdating, setAttUpdating]   = useState(null);
  const [search, setSearch]             = useState('');
  const [sessionFilter, setSessionFilter] = useState('active');
  const [attFilter, setAttFilter]       = useState('');
  const [deptFilter, setDeptFilter]     = useState('');
  const [venueFilter, setVenueFilter]   = useState('');
  const [venues, setVenues]             = useState([]);
  const [uploading, setUploading]       = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadLogs, setUploadLogs]     = useState([]);
  const [venueStatus, setVenueStatus]   = useState(null);
  const fileInputRef = useRef(null);
  const { sessions, activeSession, sessionLabel } = useSession();

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('session_id', sessionFilter);
      if (search)    params.append('search', search);
      if (attFilter) params.append('attendance_status', attFilter);
      params.append('source', 'attendance');
      params.append('sort_by', 'created_at');
      params.append('sort_dir', 'desc');
      const res = await axios.get(`${API_URL}/applications?${params}`, { headers });
      setApplications(res.data.data || []);
    } catch { toast.error('Failed to fetch'); }
    finally { setLoading(false); }
  }, [search, sessionFilter, attFilter]);

  useEffect(() => {
    const t = setTimeout(fetchData, 400);
    return () => clearTimeout(t);
  }, [fetchData]);

  useEffect(() => {
    axios.get(`${API_URL}/venues?session_id=${sessionFilter}`, { headers })
      .then(res => setVenues(res.data.data || []))
      .catch(() => {});
  }, [sessionFilter]);

  const handleAttendance = async (id, attendance_status) => {
    setAttUpdating(id);
    try {
      const res = await axios.put(`${API_URL}/applications/${id}/attendance`, { attendance_status }, { headers });
      toast.success(`Marked ${attendance_status} — Qualification: ${res.data.qualification_status}`);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setAttUpdating(null); }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('report_type', 'attendance');
      params.append('session_id', sessionFilter);
      if (search)    params.append('search', search);
      if (attFilter) params.append('attendance_status', attFilter);
      params.append('source', 'attendance');
      const res = await axios.get(`${API_URL}/applications/export/excel?${params}`, {
        headers, responseType: 'blob'
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `attendance_report_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  const downloadTemplate = async () => {
    try {
      const params = new URLSearchParams({ session_id: sessionFilter });
      if (deptFilter)  params.set('department', deptFilter);
      if (venueFilter) params.set('venue_id', venueFilter);
      const res = await axios.get(`${API_URL}/attendance/template?${params}`, {
        headers, responseType: 'blob'
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `attendance_template_${venueFilter || 'all'}_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded — fill and upload back');
    } catch { toast.error('Template download failed'); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const sid = sessionFilter === 'active' ? (activeSession?.id || '') : sessionFilter;
      const fd  = new FormData();
      fd.append('file', file);
      fd.append('session_id', sid);
      if (venueFilter) fd.append('venue_id', venueFilter);
      const res = await axios.post(`${API_URL}/attendance/upload`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(res.data);
      toast.success(res.data.message);
      fetchData();
      fetchUploadLogs();
      fetchVenueStatus();
    } catch (err) {
      const msg = err.response?.data?.message || 'Upload failed';
      toast.error(msg);
      setUploadResult({ success: false, message: msg });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchUploadLogs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/attendance/upload-logs`, { headers });
      setUploadLogs((res.data.data || []).slice(0, 5));
    } catch { /* non-critical */ }
  }, []);

  const fetchVenueStatus = useCallback(async () => {
    try {
      const params = new URLSearchParams({ session_id: sessionFilter });
      const res = await axios.get(`${API_URL}/attendance/venue-status?${params}`, { headers });
      setVenueStatus(res.data.data || null);
    } catch { /* non-critical */ }
  }, [sessionFilter]);

  useEffect(() => { fetchUploadLogs(); fetchVenueStatus(); }, [fetchUploadLogs, fetchVenueStatus]);


  const presentCount = applications.filter(a => a.attendance_status === 'Present').length;
  const absentCount  = applications.filter(a => a.attendance_status === 'Absent').length;
  const notSetCount  = applications.filter(a => !a.attendance_status).length;

  const availableDepts = [...new Set(venues.map(v => v.department).filter(Boolean))].sort();
  const filteredVenues = deptFilter ? venues.filter(v => v.department === deptFilter) : venues;

  return (
    <div>
      <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>Attendance Management</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 12 }}>
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
              <li className="breadcrumb-item active">Attendance Management</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-sm btn-outline-success" style={{ fontSize: 11, fontWeight: 600 }} onClick={handleExport}>
            <Download size={13} className="me-1" />Export Report
          </button>
          <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 11 }} onClick={fetchData}>Refresh</button>
        </div>
      </div>

      {/* ── XLS Import/Export Panel ── */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderLeft: '4px solid #32c5d2' }}>
        <div className="card-header bg-white py-2">
          <h6 className="mb-0 fw-bold" style={{ color: '#32c5d2', fontSize: 13 }}>
            <FileSpreadsheet size={15} className="me-1" /> XLS Bulk Attendance Import
          </h6>
        </div>
        <div className="card-body py-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-semibold small mb-1">Step 1 — Dropdown Department</label>
              <select
                className="form-select form-select-sm"
                value={deptFilter}
                onChange={e => { setDeptFilter(e.target.value); setVenueFilter(''); }}
              >
                <option value="">All Departments</option>
                {availableDepts.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold small mb-1">Step 2 — Select Venue</label>
              <select
                className="form-select form-select-sm"
                value={venueFilter}
                onChange={e => setVenueFilter(e.target.value)}
              >
                <option value="">{deptFilter ? 'All Venues for Dept' : 'All Venues'}</option>
                {filteredVenues.map(v => (
                  <option key={v.id} value={v.id}>{v.hall_name} ({v.department})</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold small mb-1">Step 3 — Download Template</label>
              <div>
                <button className="btn btn-sm btn-outline-primary w-100" onClick={downloadTemplate}>
                  <Download size={13} className="me-1" /> Get XLS
                </button>
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold small mb-1">Step 4 — Upload Filled XLS</label>
              <div className="d-flex gap-2 align-items-center">
                <input
                  ref={fileInputRef} type="file" accept=".xlsx,.xls"
                  className="form-control form-control-sm"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                {uploading && <span className="spinner-border spinner-border-sm text-primary" />}
              </div>
              <div className="form-text">System auto-validates and bulk-updates attendance + marks</div>
            </div>
          </div>

          {/* Upload result */}
          {uploadResult && (
            <div className={`alert border-0 mt-3 mb-0 py-2 ${uploadResult.success ? 'alert-success' : 'alert-danger'}`} style={{ fontSize: 12 }}>
              {uploadResult.success
                ? <><CheckCircle size={13} className="me-1" />{uploadResult.message}</>
                : <><AlertTriangle size={13} className="me-1" />{uploadResult.message}</>}
              {uploadResult.errors?.length > 0 && (
                <ul className="mb-0 mt-1 ps-3" style={{ fontSize: 11 }}>
                  {uploadResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {uploadResult.errors.length > 5 && <li>…and {uploadResult.errors.length - 5} more</li>}
                </ul>
              )}
            </div>
          )}

          {/* Recent upload logs */}
          {uploadLogs.length > 0 && (
            <div className="mt-3">
              <div className="small fw-semibold text-muted mb-1">Recent Uploads</div>
              <div className="table-responsive">
                <table className="table table-sm mb-0" style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th>File</th><th>Uploaded By</th><th>Total</th>
                      <th>Success</th><th>Errors</th><th>Status</th><th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadLogs.map(log => (
                      <tr key={log.id}>
                        <td>{log.file_name}</td>
                        <td>{log.uploaded_by}</td>
                        <td>{log.total_rows}</td>
                        <td><span className="text-success fw-semibold">{log.success_rows}</span></td>
                        <td><span className={log.error_rows > 0 ? 'text-danger fw-semibold' : ''}>{log.error_rows}</span></td>
                        <td>
                          <span className={`badge ${log.status === 'Completed' ? 'bg-success' : log.status === 'Failed' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td>{new Date(log.created_at).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Venue Upload Status Panel ─────────────────────────── */}
      {venueStatus && (venueStatus.uploaded.length > 0 || venueStatus.pending.length > 0) && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
            <h6 className="mb-0 fw-bold" style={{ color: '#32c5d2', fontSize: 13 }}>
              <FileSpreadsheet size={15} className="me-1" /> Venue Upload Status
            </h6>
            <span className="small text-muted">
              {venueStatus.uploaded.length} uploaded &nbsp;·&nbsp; {venueStatus.pending.length} pending
            </span>
          </div>
          <div className="card-body py-3">
            <div className="row g-3">
              {/* Uploaded */}
              <div className="col-md-6">
                <div className="fw-semibold small text-success mb-2">
                  <CheckCircle size={13} className="me-1" /> Uploaded ({venueStatus.uploaded.length})
                </div>
                {venueStatus.uploaded.length === 0
                  ? <div className="text-muted small">None yet</div>
                  : venueStatus.uploaded.map(v => (
                    <div key={v.venue_id}
                      className="d-flex align-items-center justify-content-between px-3 py-2 mb-1 rounded"
                      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <div>
                        <span className="fw-semibold small">{v.hall_name}</span>
                        <span className="text-muted ms-2" style={{ fontSize: 11 }}>
                          {v.total_candidates} candidates · {v.rows_updated} updated
                        </span>
                      </div>
                      <span className="badge bg-success" style={{ fontSize: 10 }}>
                        <CheckCircle size={10} className="me-1" />
                        {v.last_uploaded_at ? new Date(v.last_uploaded_at).toLocaleDateString('en-IN') : '—'}
                      </span>
                    </div>
                  ))
                }
              </div>
              {/* Pending */}
              <div className="col-md-6">
                <div className="fw-semibold small text-danger mb-2">
                  <Clock size={13} className="me-1" /> Pending ({venueStatus.pending.length})
                </div>
                {venueStatus.pending.length === 0
                  ? <div className="text-success small fw-semibold">All venues uploaded ✓</div>
                  : venueStatus.pending.map(v => (
                    <div key={v.venue_id}
                      className="d-flex align-items-center justify-content-between px-3 py-2 mb-1 rounded"
                      style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}>
                      <div>
                        <span className="fw-semibold small">{v.hall_name}</span>
                        <span className="text-muted ms-2" style={{ fontSize: 11 }}>
                          {v.total_candidates} candidates
                        </span>
                      </div>
                      <span className="badge bg-danger" style={{ fontSize: 10 }}>Pending</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="row g-3 mb-3">
        {[
          { label: 'Total',    count: applications.length, cls: 'bg-light border',       text: '#333' },
          { label: 'Present',  count: presentCount,        cls: 'bg-success bg-opacity-10 border border-success', text: '#155724' },
          { label: 'Absent',   count: absentCount,         cls: 'bg-danger bg-opacity-10 border border-danger',   text: '#721c24' },
          { label: 'Not Set',  count: notSetCount,         cls: 'bg-warning bg-opacity-10 border border-warning', text: '#856404' },
        ].map(({ label, count, cls, text }) => (
          <div key={label} className="col-md-3">
            <div className={`card border-0 rounded-3 p-3 ${cls}`}>
              <div className="fw-bold" style={{ fontSize: 24, color: text }}>{count}</div>
              <div className="small fw-semibold" style={{ color: text }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <input type="text" className="form-control form-control-sm"
                placeholder="Search by Name / App ID / Email..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-auto">
              <select className="form-select form-select-sm" value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
                <option value="active">Active Session</option>
                <option value="all">All Sessions</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
              </select>
            </div>
            <div className="col-auto">
              <select className="form-select form-select-sm" value={attFilter} onChange={e => setAttFilter(e.target.value)}>
                <option value="">All Attendance</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
          </div>
          <div className="mt-2 text-end">
            <small className="text-muted">Showing <strong>{applications.length}</strong> records</small>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
              <thead className="table-light">
                <tr>
                  <th className="ps-3 py-3" style={{ width: 40 }}>#</th>
                  <th className="py-3">Application ID</th>
                  <th className="py-3">Applicant Name</th>
                  <th className="py-3">Email</th>
                  <th className="py-3">Subject</th>
                  <th className="py-3">Current Attendance</th>
                  <th className="py-3 text-center" style={{ minWidth: 180 }}>Mark Attendance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-5 text-muted">Loading...</td></tr>
                ) : applications.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-5 text-muted">No records found</td></tr>
                ) : applications.map((app, i) => (
                  <tr key={app.id}>
                    <td className="ps-3 text-muted">{i + 1}</td>
                    <td>
                      <div className="fw-bold text-primary" style={{ fontSize: 12 }}>{app.application_id}</div>
                      <div className="text-muted" style={{ fontSize: 10 }}>{app.session_name}</div>
                    </td>
                    <td className="fw-semibold">{app.full_name}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{app.email}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{app.subject || '—'}</td>
                    <td>
                      <span className={`badge rounded-pill px-3 py-1 ${ATT_BADGE[app.attendance_status] || 'bg-secondary text-white'}`} style={{ fontSize: 11 }}>
                        {app.attendance_status || 'Not Set'}
                      </span>
                    </td>
                    <td className="text-center">
                      {attUpdating === app.id ? (
                        <small className="text-muted">Updating...</small>
                      ) : (
                        <div className="d-flex gap-2 justify-content-center">
                          <button
                            className={`btn btn-sm ${app.attendance_status === 'Present' ? 'btn-success' : 'btn-outline-success'}`}
                            style={{ fontSize: 11, padding: '4px 14px', fontWeight: 600 }}
                            onClick={() => handleAttendance(app.id, 'Present')}
                          >Present</button>
                          <button
                            className={`btn btn-sm ${app.attendance_status === 'Absent' ? 'btn-danger' : 'btn-outline-danger'}`}
                            style={{ fontSize: 11, padding: '4px 14px', fontWeight: 600 }}
                            onClick={() => handleAttendance(app.id, 'Absent')}
                          >Absent</button>
                        </div>
                      )}
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

export default AttendanceManagement;
