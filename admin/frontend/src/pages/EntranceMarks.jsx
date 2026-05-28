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

const EntranceMarks = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [markUpdating, setMarkUpdating] = useState(null);
  const [editingMark, setEditingMark]   = useState(null);
  const [search, setSearch]             = useState('');
  const [sessionFilter, setSessionFilter] = useState('active');
  const [attFilter, setAttFilter]       = useState('');
  const [qualFilter, setQualFilter]     = useState('');
  const [isPublished, setIsPublished]   = useState(false);
  const [passingMark, setPassingMark]   = useState(50);
  const [savingMark, setSavingMark]     = useState(false);
  const [toggling, setToggling]         = useState(false);
  const { sessions, sessionLabel } = useSession();
  const inputRef = useRef(null);

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

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

  const updatePassingMark = async () => {
    setSavingMark(true);
    try {
      await axios.put(
        `${API_URL}/settings/entrance-settings`,
        { passing_mark: passingMark, total_mark: 100 },
        { headers }
      );
      toast.success('Qualification Pass Mark updated successfully!');
      fetchData(); // re-fetch data so it can re-compute if the backend computed it (actually wait, they just recalculate in upload currently, but a bulk recalculate API would be better. For now update is fine).
    } catch {
      toast.error('Failed to update pass mark');
    } finally {
      setSavingMark(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('session_id', sessionFilter);
      if (search)     params.append('search', search);
      if (attFilter)  params.append('attendance_status', attFilter);
      if (qualFilter) params.append('qualification_status', qualFilter);
      params.append('sort_by', 'created_at');
      params.append('sort_dir', 'desc');
      params.append('source', 'entrance_marks');
      const res = await axios.get(`${API_URL}/applications?${params}`, { headers });
      setApplications(res.data.data || []);
    } catch { toast.error('Failed to fetch'); }
    finally { setLoading(false); }
  }, [search, sessionFilter, attFilter, qualFilter]);

  useEffect(() => { const t = setTimeout(fetchData, 400); return () => clearTimeout(t); }, [fetchData]);
  useEffect(() => { fetchSettings(); }, []);

  const openEdit = (app) => {
    setEditingMark({ id: app.id, value: app.entrance_mark ?? '' });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveMark = async (id) => {
    if (!editingMark || editingMark.id !== id) return;
    setMarkUpdating(id);
    try {
      const res = await axios.put(
        `${API_URL}/applications/${id}/entrance-mark`,
        { entrance_mark: editingMark.value },
        { headers }
      );
      toast.success(`Entrance mark saved — ${res.data.qualification_status}`);
      setEditingMark(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setMarkUpdating(null); }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('report_type', 'entrance');
      params.append('session_id', sessionFilter);
      if (search)     params.append('search', search);
      if (attFilter)  params.append('attendance_status', attFilter);
      if (qualFilter) params.append('qualification_status', qualFilter);
      params.append('source', 'entrance_marks');
      const res = await axios.get(`${API_URL}/applications/export/excel?${params}`, {
        headers, responseType: 'blob'
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `entrance_marks_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };


  const totalStudents  = applications.length;
  const passedStudents = applications.filter(a =>
    a.qualification_status === 'Qualified' || a.qualification_status === 'Direct Qualified'
  ).length;
  const failedStudents = applications.filter(a => a.qualification_status === 'Failed').length;
  const absentStudents = applications.filter(a => a.qualification_status === 'Absent').length;

  return (
    <div>
      <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>Entrance Mark Management</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 12 }}>
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
              <li className="breadcrumb-item active">Entrance Marks</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <div className="d-flex align-items-center me-3 border rounded px-2 bg-light">
            <label className="small fw-semibold me-2 mb-0 py-1" style={{ fontSize: 11 }}>Pass Mark =</label>
            <input 
              type="number" 
              className="form-control form-control-sm border-0 bg-transparent text-center px-0 fw-bold" 
              style={{ width: 45, outline: 'none', boxShadow: 'none' }}
              value={passingMark} 
              onChange={e => setPassingMark(e.target.value)} 
            />
            <button className="btn btn-sm text-primary p-0 ms-1 fw-semibold" style={{ fontSize: 11 }} onClick={updatePassingMark} disabled={savingMark}>
              {savingMark ? '...' : 'Save'}
            </button>
          </div>
          <button
            className={`btn btn-sm fw-semibold ${isPublished ? 'btn-success' : 'btn-outline-primary'}`}
            style={{ fontSize: 11 }}
            onClick={togglePublish}
            disabled={toggling}
          >
            {toggling ? '…' : isPublished ? 'Results Published ✓' : 'Publish Entrance Results'}
          </button>
          <button className="btn btn-sm btn-outline-success" style={{ fontSize: 11, fontWeight: 600 }} onClick={handleExport}>Export Excel</button>
          <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 11 }} onClick={fetchData}>Refresh</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="row g-3 mb-3">
        {[
          { label: 'Total Students', count: totalStudents,  cls: 'bg-light border',                                  text: '#333' },
          { label: 'Passed',         count: passedStudents, cls: 'bg-success bg-opacity-10 border border-success',   text: '#155724' },
          { label: 'Failed',         count: failedStudents, cls: 'bg-danger bg-opacity-10 border border-danger',     text: '#721c24' },
          { label: 'Absent',         count: absentStudents, cls: 'bg-dark bg-opacity-10 border border-dark',         text: '#333' },
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
                  <th className="py-3">Attendance</th>
                  <th className="py-3 text-center" style={{ minWidth: 200 }}>Entrance Mark</th>
                  <th className="py-3">Qualification Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-5 text-muted">Loading...</td></tr>
                ) : applications.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-5 text-muted">No records found</td></tr>
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
                        <span className={`badge rounded-pill px-3 py-1 ${
                          app.attendance_status === 'Present' ? 'bg-success text-white' :
                          app.attendance_status === 'Absent'  ? 'bg-danger text-white' : 'bg-secondary text-white'
                        }`} style={{ fontSize: 11 }}>{app.attendance_status || 'Not Set'}</span>
                      </td>
                      <td className="text-center">
                        {app.attendance_status === 'Absent' ? (
                          <span className="text-muted">—</span>
                        ) : isSaving ? (
                          <small className="text-muted">Saving...</small>
                        ) : isEditing ? (
                          <div className="d-flex align-items-center justify-content-center gap-2">
                            <input
                              ref={inputRef}
                              type="number" min={0} max={100} step={0.5}
                              className="form-control form-control-sm"
                              style={{ width: 90, textAlign: 'center' }}
                              value={editingMark.value}
                              onChange={e => setEditingMark(prev => ({ ...prev, value: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  saveMark(app.id);
                                if (e.key === 'Escape') setEditingMark(null);
                              }}
                            />
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
                          <button
                            className="btn btn-link p-0 text-decoration-none fw-bold"
                            style={{ fontSize: 13, color: app.entrance_mark != null ? '#198754' : '#adb5bd' }}
                            onClick={() => openEdit(app)}
                            title="Click to edit entrance mark"
                          >
                            {app.entrance_mark != null ? app.entrance_mark : 'Click to Enter'}
                          </button>
                        )}
                      </td>
                      <td>
                        <span className={`badge rounded-pill px-3 py-1 ${QUAL_BADGE[app.qualification_status] || 'bg-secondary text-white'}`} style={{ fontSize: 11 }}>
                          {app.qualification_status || 'Pending'}
                        </span>
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

export default EntranceMarks;
