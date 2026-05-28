import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useSession } from '../contexts/SessionContext';

const API_URL = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;

const QUAL_BADGE = {
  Pending:            'bg-secondary text-white',
  Qualified:          'bg-success text-white',
  'Direct Qualified': 'bg-primary text-white',
  Failed:             'bg-danger text-white',
  Absent:             'bg-dark text-white',
};

const InterviewMarks = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [markUpdating, setMarkUpdating] = useState(null);
  const [editingMark, setEditingMark]   = useState(null);
  const [search, setSearch]             = useState('');
  const [sessionFilter, setSessionFilter] = useState('active');
  const [qualFilter, setQualFilter]     = useState('');
  const [isPublished, setIsPublished]   = useState(false);
  const [toggling, setToggling]         = useState(false);
  const { sessions, sessionLabel } = useSession();
  const inputRef = useRef(null);

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/settings`, { headers });
      if (res.data.success && res.data.data) {
        setIsPublished(!!res.data.data.interview_result_publish);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const togglePublish = async () => {
    setToggling(true);
    const newStatus = !isPublished;
    try {
      await axios.put(
        `${API_URL}/settings/update`,
        { interview_result_publish: newStatus ? 1 : 0 },
        { headers }
      );
      setIsPublished(newStatus);
      toast.success(newStatus ? 'Interview results published successfully!' : 'Interview results hidden successfully.');
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('session_id', sessionFilter);
      params.append('source', 'interview');
      if (search)     params.append('search', search);
      if (qualFilter) params.append('qualification_status', qualFilter);
      params.append('sort_by', 'created_at');
      params.append('sort_dir', 'desc');
      const res = await axios.get(`${API_URL}/applications?${params}`, { headers });
      setApplications(res.data.data || []);
    } catch { toast.error('Failed to fetch'); }
    finally { setLoading(false); }
  }, [search, sessionFilter, qualFilter]);

  useEffect(() => { const t = setTimeout(fetchData, 400); return () => clearTimeout(t); }, [fetchData]);

  const openEdit = (app) => {
    setEditingMark({ id: app.id, value: app.interview_mark ?? '', status: app.interview_status ?? '' });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveMark = async (id) => {
    if (!editingMark || editingMark.id !== id) return;
    if (!editingMark.status) {
      toast.error('Please select PASS or FAIL before saving');
      return;
    }
    setMarkUpdating(id);
    try {
      await axios.put(
        `${API_URL}/applications/${id}/interview-mark`,
        { 
          interview_mark: editingMark.value,
          interview_status: editingMark.status
        },
        { headers }
      );
      toast.success('Interview mark and status saved');
      setEditingMark(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setMarkUpdating(null); }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('report_type', 'interview');
      params.append('session_id', sessionFilter);
      if (search)     params.append('search', search);
      if (qualFilter) params.append('qualification_status', qualFilter);
      const res = await axios.get(`${API_URL}/applications/export/excel?${params}`, {
        headers, responseType: 'blob'
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `interview_marks_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };


  const totalCount     = applications.length;
  const markedCount    = applications.filter(a => a.interview_mark != null).length;
  const pendingCount   = applications.filter(a => a.interview_mark == null).length;
  const qualifiedCount = applications.filter(a =>
    a.qualification_status === 'Qualified' || a.qualification_status === 'Direct Qualified'
  ).length;

  return (
    <div>
      <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>Interview Mark Management</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 12 }}>
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
              <li className="breadcrumb-item active">Interview Marks</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-sm btn-outline-success" style={{ fontSize: 11, fontWeight: 600 }} onClick={handleExport}>Export Excel</button>
          <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 11 }} onClick={fetchData}>Refresh</button>
        </div>
      </div>

      {/* Global Publish Control Banner */}
      <div className="card border-0 shadow-sm rounded-4 mb-4" style={{ background: '#f8f9fa', borderLeft: `5px solid ${isPublished ? '#198754' : '#dc3545'}` }}>
        <div className="card-body py-3 d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <span className="rounded-circle d-inline-block animate-pulse" style={{ width: 12, height: 12, background: isPublished ? '#198754' : '#dc3545', boxShadow: isPublished ? '0 0 8px #198754' : '0 0 8px #dc3545' }} />
            <div>
              <div className="fw-bold" style={{ fontSize: 15, color: '#2c3e50' }}>Global Result Publish Status</div>
              <div className="text-muted small" style={{ fontSize: 12 }}>
                {isPublished 
                  ? 'Students can now view their interview marks, status badges, and access the counselling portal if they passed.' 
                  : 'All interview results and counselling options are hidden from the student portal.'}
              </div>
            </div>
          </div>
          <button 
            className={`btn btn-sm px-4 fw-bold text-white transition-all border-0 shadow-sm`} 
            style={{ background: isPublished ? '#dc3545' : '#198754', borderRadius: 20, fontSize: 12, padding: '8px 20px' }}
            onClick={togglePublish}
            disabled={toggling}
          >
            {toggling ? 'Updating...' : isPublished ? 'Hide Interview Results' : 'Publish Interview Results'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="row g-3 mb-3">
        {[
          { label: 'Total Students',       count: totalCount,     cls: 'bg-light border',                                  text: '#333' },
          { label: 'Interview Marked',     count: markedCount,    cls: 'bg-success bg-opacity-10 border border-success',   text: '#155724' },
          { label: 'Pending Interview',    count: pendingCount,   cls: 'bg-warning bg-opacity-10 border border-warning',   text: '#856404' },
          { label: 'Qualified (Entrance)', count: qualifiedCount, cls: 'bg-primary bg-opacity-10 border border-primary',   text: '#084298' },
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
              <select className="form-select form-select-sm" value={qualFilter} onChange={e => setQualFilter(e.target.value)}>
                <option value="">All Qualification</option>
                <option value="Pending">Pending</option>
                <option value="Qualified">Qualified</option>
                <option value="Direct Qualified">Direct Qualified</option>
                <option value="Failed">Failed</option>
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
                  <th className="py-3">Qualification Status</th>
                  <th className="py-3 text-center" style={{ minWidth: 200 }}>Interview Mark</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-5 text-muted">Loading...</td></tr>
                ) : applications.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-5 text-muted">No records found</td></tr>
                ) : applications.map((app, i) => {
                  const isEditing = editingMark?.id === app.id;
                  const isSaving  = markUpdating === app.id;
                  return (
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
                        <span className={`badge rounded-pill px-3 py-1 ${QUAL_BADGE[app.qualification_status] || 'bg-secondary text-white'}`} style={{ fontSize: 11 }}>
                          {app.qualification_status || 'Pending'}
                        </span>
                      </td>
                      <td className="text-center">
                        {isSaving ? (
                          <small className="text-muted">Saving...</small>
                        ) : isEditing ? (
                          <div className="d-flex align-items-center justify-content-center gap-2">
                            <input
                              ref={inputRef}
                              type="number" min={0} max={100} step={0.5}
                              className="form-control form-control-sm"
                              style={{ width: 80, textAlign: 'center' }}
                              value={editingMark.value}
                              placeholder="Marks"
                              onChange={e => setEditingMark(prev => ({ ...prev, value: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  saveMark(app.id);
                                if (e.key === 'Escape') setEditingMark(null);
                              }}
                            />
                            <select
                              className={`form-select form-select-sm ${!editingMark.status ? 'border-danger' : ''}`}
                              style={{ width: 90 }}
                              value={editingMark.status}
                              onChange={e => setEditingMark(prev => ({ ...prev, status: e.target.value }))}
                            >
                              <option value="">— Select —</option>
                              <option value="PASS">PASS</option>
                              <option value="FAIL">FAIL</option>
                            </select>
                            <button
                              className="btn btn-sm btn-success fw-semibold"
                              style={{ fontSize: 11, padding: '3px 12px' }}
                              onClick={() => saveMark(app.id)}
                            >Enter</button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => setEditingMark(null)}
                            >✕</button>
                          </div>
                        ) : (
                          <div className="d-flex align-items-center justify-content-center gap-2">
                            <button
                              className="btn btn-link p-0 text-decoration-none fw-bold"
                              style={{ fontSize: 13, color: app.interview_mark != null ? '#198754' : '#adb5bd' }}
                              onClick={() => openEdit(app)}
                              title="Click to edit interview mark and status"
                            >
                              {app.interview_mark != null ? app.interview_mark : 'Click to Enter'}
                            </button>
                            {app.interview_mark != null && (
                              <span 
                                className={`badge ${app.interview_status === 'PASS' ? 'bg-success bg-opacity-10 text-success border border-success' : 'bg-danger bg-opacity-10 text-danger border border-danger'} px-2 py-1 rounded`}
                                style={{ fontSize: 10, fontWeight: 700 }}
                              >
                                {app.interview_status || '—'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewMarks;
