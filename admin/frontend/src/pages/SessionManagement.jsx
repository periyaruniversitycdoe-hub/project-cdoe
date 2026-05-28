
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Calendar, Plus, RefreshCw, CheckCircle, XCircle,
  Edit3, Trash2, Power, Users, ToggleLeft, ToggleRight,
  AlertTriangle, Layers, FileCheck
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear + i);

const emptyForm = {
  year: currentYear,
  month: 'January',
  is_active: false,
  registration_open: false,
  application_open: false,
};

const SessionManagement = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const token = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/sessions`, { headers });
      setSessions(res.data.data || []);
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditMode(false);
    setEditId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditMode(false);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (session) => {
    setForm({
      year: session.year,
      month: session.month,
      is_active: !!session.is_active,
      registration_open: !!session.registration_open,
      application_open: !!session.application_open,
    });
    setEditMode(true);
    setEditId(session.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editMode) {
        await axios.put(`${API_URL}/sessions/${editId}`, form, { headers });
        toast.success('Session updated successfully.');
      } else {
        await axios.post(`${API_URL}/sessions`, form, { headers });
        toast.success('Session created successfully.');
      }
      resetForm();
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (id) => {
    if (!window.confirm('Activate this session? All other sessions will be automatically deactivated.')) return;
    setActionLoading(`activate-${id}`);
    try {
      await axios.put(`${API_URL}/sessions/${id}/activate`, {}, { headers });
      toast.success('Session activated. All others deactivated.');
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Activation failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRegistration = async (id) => {
    setActionLoading(`reg-${id}`);
    try {
      const res = await axios.put(`${API_URL}/sessions/${id}/toggle-registration`, {}, { headers });
      toast.success(res.data.message);
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Toggle failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleApplication = async (id) => {
    setActionLoading(`app-${id}`);
    try {
      const res = await axios.put(`${API_URL}/sessions/${id}/toggle-application`, {}, { headers });
      toast.success(res.data.message);
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Toggle failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleResult = async (id, currentVal) => {
    const action = currentVal ? 'unpublish' : 'publish';
    if (!window.confirm(
      currentVal
        ? 'Unpublish results? Students will lose access to counselling.'
        : 'Publish results? This will also close application submissions and allow qualified students to access counselling.'
    )) return;
    setActionLoading(`result-${id}`);
    try {
      const res = await axios.put(`${API_URL}/sessions/${id}/toggle-result`, {}, { headers });
      toast.success(res.data.message);
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} results.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id, label) => {
    if (!window.confirm(`Delete session "${label}"? This cannot be undone.`)) return;
    setActionLoading(`del-${id}`);
    try {
      await axios.delete(`${API_URL}/sessions/${id}`, { headers });
      toast.success('Session deleted.');
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const activeSession = sessions.find(s => s.is_active);

  return (
    <div>
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: '22px' }}>
            Session Management
          </h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: '12px' }}>
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
              <li className="breadcrumb-item active">Session Management</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={fetchSessions}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            onClick={showForm ? resetForm : openCreate}
          >
            {showForm ? <><XCircle size={14} /> Cancel</> : <><Plus size={16} /> Create Session</>}
          </button>
        </div>
      </div>

      {/* Active Session Banner */}
      {activeSession && (
        <div className="alert d-flex align-items-center gap-3 mb-3 py-2 px-3 rounded-3 border-0"
          style={{ background: 'linear-gradient(135deg, #d4edda, #c3f4e4)', color: '#155724' }}>
          <CheckCircle size={18} />
          <div>
            <strong>Active Session:</strong>{' '}
            {activeSession.month} {activeSession.year}
            {activeSession.registration_open
              ? <span className="ms-3 badge bg-success">Registration Open</span>
              : <span className="ms-3 badge bg-secondary">Registration Closed</span>}
            {activeSession.application_open
              ? <span className="ms-2 badge bg-primary">Applications Open</span>
              : <span className="ms-2 badge bg-secondary">Applications Closed</span>}
            <span className="ms-3 text-muted" style={{ fontSize: 12 }}>
              <Users size={12} className="me-1" />{activeSession.registered_users} registered students
            </span>
          </div>
        </div>
      )}

      {!activeSession && !loading && (
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-3 py-2 px-3 rounded-3 border-0">
          <AlertTriangle size={18} />
          <span>No active session. Student registrations are <strong>blocked</strong> until an active session with registration open is set.</span>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <div className="card mb-4 border-0 shadow-sm">
          <div className="card-header py-2 px-4 d-flex align-items-center gap-2"
            style={{ background: '#364150', color: '#fff', borderRadius: '8px 8px 0 0' }}>
            <Layers size={16} />
            <span className="fw-semibold" style={{ fontSize: '14px' }}>
              {editMode ? 'Edit Admission Session' : 'Create New Admission Session'}
            </span>
          </div>
          <div className="card-body px-4 py-4">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">

                {/* Year */}
                <div className="col-md-3">
                  <label className="form-label fw-semibold" style={{ fontSize: '13px' }}>Year <span className="text-danger">*</span></label>
                  <select
                    className="form-select form-select-sm"
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value, 10) }))}
                    required
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                {/* Month */}
                <div className="col-md-3">
                  <label className="form-label fw-semibold" style={{ fontSize: '13px' }}>Month <span className="text-danger">*</span></label>
                  <select
                    className="form-select form-select-sm"
                    value={form.month}
                    onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                    required
                  >
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* Toggles */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold d-block" style={{ fontSize: '13px' }}>Status Flags</label>
                  <div className="d-flex flex-wrap gap-3 align-items-center" style={{ marginTop: '6px' }}>
                    {[
                      { key: 'is_active', label: 'Active Session', color: '#28a745' },
                      { key: 'registration_open', label: 'Registration Open', color: '#17a2b8' },
                      { key: 'application_open', label: 'Applications Open', color: '#0d6efd' },
                    ].map(({ key, label, color }) => (
                      <label key={key} className="d-flex align-items-center gap-2" style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div
                          onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                          style={{
                            width: 40, height: 22, borderRadius: 11,
                            background: form[key] ? color : '#ced4da',
                            position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                            flexShrink: 0,
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: 3, left: form[key] ? 21 : 3,
                            width: 16, height: 16, borderRadius: '50%',
                            background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                          }} />
                        </div>
                        <span style={{ fontSize: '12px', color: form[key] ? color : '#888', fontWeight: 600 }}>{label}</span>
                      </label>
                    ))}
                  </div>
                  {form.is_active && (
                    <small className="text-warning d-block mt-1" style={{ fontSize: '11px' }}>
                      <AlertTriangle size={11} className="me-1" />
                      Enabling "Active Session" will deactivate all other sessions.
                    </small>
                  )}
                </div>

                {/* Submit */}
                <div className="col-12 d-flex gap-2 pt-1">
                  <button type="submit" className="btn btn-primary btn-sm px-4" disabled={submitting}>
                    {submitting
                      ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</>
                      : editMode ? 'Update Session' : 'Create Session'}
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm px-3" onClick={resetForm}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-header py-2 px-4 d-flex align-items-center justify-content-between"
          style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
          <span className="fw-semibold" style={{ fontSize: '14px', color: '#364150' }}>
            <Calendar size={15} className="me-2" />All Admission Sessions
          </span>
          <span className="badge bg-secondary">{sessions.length} total</span>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
              <thead style={{ background: '#f8f9fa' }}>
                <tr>
                  <th className="ps-4 py-3" style={{ width: 40 }}>#</th>
                  <th className="py-3">Year</th>
                  <th className="py-3">Month</th>
                  <th className="py-3 text-center">Active</th>
                  <th className="py-3 text-center">Registration</th>
                  <th className="py-3 text-center">Applications</th>
                  <th className="py-3 text-center">Result</th>
                  <th className="py-3 text-center">Students</th>
                  <th className="py-3">Created</th>
                  <th className="py-3">Updated</th>
                  <th className="py-3 text-center pe-3" style={{ minWidth: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="11" className="text-center py-5">
                      <div className="spinner-border spinner-border-sm text-secondary me-2" />
                      Loading sessions...
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center py-5 text-muted">
                      <Layers size={32} className="mb-2 d-block mx-auto opacity-25" />
                      No sessions created yet. Create your first admission session above.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s, i) => (
                    <tr key={s.id} style={{ background: s.is_active ? '#f0fff4' : undefined }}>
                      <td className="ps-4 text-muted">{i + 1}</td>
                      <td className="fw-bold">{s.year}</td>
                      <td>{s.month}</td>

                      {/* Active */}
                      <td className="text-center">
                        {s.is_active
                          ? <span className="badge bg-success px-2 py-1">Active</span>
                          : <span className="badge bg-secondary px-2 py-1">Inactive</span>}
                      </td>

                      {/* Registration */}
                      <td className="text-center">
                        <button
                          className={`btn btn-sm border-0 fw-bold d-inline-flex align-items-center gap-1 ${s.registration_open ? 'btn-success' : 'btn-outline-secondary'}`}
                          style={{ fontSize: '11px', padding: '3px 10px' }}
                          onClick={() => handleToggleRegistration(s.id)}
                          disabled={actionLoading === `reg-${s.id}`}
                          title={s.registration_open ? 'Click to close registration' : 'Click to open registration'}
                        >
                          {actionLoading === `reg-${s.id}`
                            ? <span className="spinner-border spinner-border-sm" />
                            : s.registration_open
                              ? <><ToggleRight size={13} /> Open</>
                              : <><ToggleLeft size={13} /> Closed</>}
                        </button>
                      </td>

                      {/* Applications */}
                      <td className="text-center">
                        <button
                          className={`btn btn-sm border-0 fw-bold d-inline-flex align-items-center gap-1 ${s.application_open ? 'btn-primary' : 'btn-outline-secondary'}`}
                          style={{ fontSize: '11px', padding: '3px 10px' }}
                          onClick={() => handleToggleApplication(s.id)}
                          disabled={actionLoading === `app-${s.id}`}
                          title={s.application_open ? 'Click to close applications' : 'Click to open applications'}
                        >
                          {actionLoading === `app-${s.id}`
                            ? <span className="spinner-border spinner-border-sm" />
                            : s.application_open
                              ? <><ToggleRight size={13} /> Open</>
                              : <><ToggleLeft size={13} /> Closed</>}
                        </button>
                      </td>

                      {/* Result Published */}
                      <td className="text-center">
                        <button
                          className={`btn btn-sm border-0 fw-bold d-inline-flex align-items-center gap-1 ${s.result_published ? 'btn-success' : 'btn-outline-secondary'}`}
                          style={{ fontSize: '11px', padding: '3px 10px' }}
                          onClick={() => handleToggleResult(s.id, s.result_published)}
                          disabled={actionLoading === `result-${s.id}`}
                          title={s.result_published ? 'Click to unpublish results' : 'Click to publish results'}
                        >
                          {actionLoading === `result-${s.id}`
                            ? <span className="spinner-border spinner-border-sm" />
                            : s.result_published
                              ? <><FileCheck size={13} /> Published</>
                              : <><FileCheck size={13} /> Unpublished</>}
                        </button>
                      </td>

                      {/* Students count */}
                      <td className="text-center">
                        <span className="badge rounded-pill bg-light text-dark border" style={{ fontSize: '12px' }}>
                          <Users size={11} className="me-1" />{s.registered_users}
                        </span>
                      </td>

                      {/* Dates */}
                      <td className="text-muted" style={{ fontSize: '12px' }}>
                        {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="text-muted" style={{ fontSize: '12px' }}>
                        {new Date(s.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Actions */}
                      <td className="text-center pe-3">
                        <div className="d-flex justify-content-center gap-1 flex-wrap">
                          {/* Activate */}
                          {!s.is_active && (
                            <button
                              className="btn btn-sm btn-outline-success border-0 fw-bold d-inline-flex align-items-center gap-1"
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                              onClick={() => handleActivate(s.id)}
                              disabled={actionLoading === `activate-${s.id}`}
                              title="Set as active session"
                            >
                              {actionLoading === `activate-${s.id}`
                                ? <span className="spinner-border spinner-border-sm" />
                                : <><Power size={12} /> Activate</>}
                            </button>
                          )}
                          {s.is_active && (
                            <span className="badge bg-success d-inline-flex align-items-center gap-1 px-2"
                              style={{ fontSize: '11px', fontWeight: 600 }}>
                              <Power size={11} /> Active
                            </span>
                          )}

                          {/* Edit */}
                          <button
                            className="btn btn-sm btn-outline-warning border-0 fw-bold d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={() => openEdit(s)}
                            title="Edit session"
                          >
                            <Edit3 size={12} /> Edit
                          </button>

                          {/* Delete */}
                          <button
                            className="btn btn-sm btn-outline-danger border-0 fw-bold d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={() => handleDelete(s.id, `${s.month} ${s.year}`)}
                            disabled={actionLoading === `del-${s.id}` || s.is_active}
                            title={s.is_active ? 'Cannot delete active session' : 'Delete session'}
                          >
                            {actionLoading === `del-${s.id}`
                              ? <span className="spinner-border spinner-border-sm" />
                              : <><Trash2 size={12} /> Delete</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="card border-0 mt-3" style={{ background: '#f8f9fa' }}>
        <div className="card-body py-3 px-4">
          <h6 className="fw-bold mb-2" style={{ fontSize: '13px', color: '#364150' }}>Session Management Rules</h6>
          <ul className="mb-0" style={{ fontSize: '12px', color: '#6c757d', paddingLeft: '18px' }}>
            <li>Only <strong>one session</strong> can be active at a time. Activating a session automatically deactivates all others.</li>
            <li>Student registrations are only allowed when a session is <strong>Active</strong> and <strong>Registration Open</strong>.</li>
            <li>Application submissions are blocked when <strong>Applications</strong> toggle is Closed.</li>
            <li><strong>Publishing Results</strong> automatically closes application submissions and unlocks counselling for Qualified / Direct Qualified students.</li>
            <li>Sessions with registered students <strong>cannot be deleted</strong> to preserve data integrity.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SessionManagement;
