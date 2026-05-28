import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Award, Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  Shield, ShieldOff, RefreshCw, Users, AlertCircle, Check
} from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const getToken = () => localStorage.getItem('adminToken');

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${getToken()}` }
});

const EMPTY_FORM = {
  qualification_name: '',
  is_exemption: false,
  is_active: true,
  display_order: 0,
};

const QualificationManagement = () => {
  const [qualifications, setQualifications] = useState([]);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [showModal, setShowModal]           = useState(false);
  const [editTarget, setEditTarget]         = useState(null); // null = create mode
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm]   = useState(null); // id to confirm delete

  const fetchQualifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/qualifications`, authHeaders());
      setQualifications(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load qualifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQualifications(); }, [fetchQualifications]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (qual) => {
    setEditTarget(qual.id);
    setForm({
      qualification_name: qual.qualification_name,
      is_exemption:       !!qual.is_exemption,
      is_active:          !!qual.is_active,
      display_order:      qual.display_order || 0,
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditTarget(null); setForm(EMPTY_FORM); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.qualification_name.trim()) {
      toast.error('Qualification name is required');
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        await axios.put(`${API}/qualifications/${editTarget}`, form, authHeaders());
        toast.success('Qualification updated successfully');
      } else {
        await axios.post(`${API}/qualifications`, form, authHeaders());
        toast.success('Qualification created successfully');
      }
      closeModal();
      fetchQualifications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (qual) => {
    try {
      await axios.put(`${API}/qualifications/${qual.id}/toggle`, {}, authHeaders());
      toast.success(`${qual.qualification_name} ${qual.is_active ? 'disabled' : 'enabled'}`);
      fetchQualifications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Toggle failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/qualifications/${id}`, authHeaders());
      toast.success('Qualification deleted');
      setDeleteConfirm(null);
      fetchQualifications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
      setDeleteConfirm(null);
    }
  };

  const exemptionCount = qualifications.filter(q => q.is_exemption && q.is_active).length;
  const activeCount    = qualifications.filter(q => q.is_active).length;
  const totalStudents  = qualifications.reduce((s, q) => s + (q.student_count || 0), 0);

  return (
    <div className="container-fluid py-4">
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
        <div>
          <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <Award size={22} className="text-primary" />
            Qualification Management
          </h4>
          <p className="text-muted mb-0 small">
            Manage dynamic qualification types. Exemption qualifications bypass the entrance exam.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={fetchQualifications}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3" onClick={openCreate}>
            <Plus size={16} /> Add Qualification
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-4">
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-body py-3 d-flex align-items-center gap-3">
              <div className="rounded-2 p-2" style={{ background: '#eff6ff' }}>
                <Award size={22} style={{ color: '#3b82f6' }} />
              </div>
              <div>
                <div className="fw-bold fs-5">{qualifications.length}</div>
                <div className="text-muted small">Total Types</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-body py-3 d-flex align-items-center gap-3">
              <div className="rounded-2 p-2" style={{ background: '#fef3c7' }}>
                <Shield size={22} style={{ color: '#d97706' }} />
              </div>
              <div>
                <div className="fw-bold fs-5">{exemptionCount}</div>
                <div className="text-muted small">Exemption Types Active</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-body py-3 d-flex align-items-center gap-3">
              <div className="rounded-2 p-2" style={{ background: '#ecfdf5' }}>
                <Users size={22} style={{ color: '#059669' }} />
              </div>
              <div>
                <div className="fw-bold fs-5">{totalStudents}</div>
                <div className="text-muted small">Students with Qualifications</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exemption Info Banner */}
      <div className="alert alert-warning d-flex align-items-start gap-2 mb-4" style={{ fontSize: 13 }}>
        <AlertCircle size={16} className="mt-1 flex-shrink-0" />
        <div>
          <strong>Exemption Logic:</strong> Students who select a qualification marked as "Exemption"
          (e.g. NET, SET, JRF, SLET) will have their <code>entrance_exam_status</code> automatically set to
          <strong> Exempted</strong>. They bypass the entrance exam and proceed directly to the interview stage.
          Non-exemption qualifications (GATE, M.Phil, Other) are tracked but do not change the exam flow.
        </div>
      </div>

      {/* Qualification Table */}
      <div className="card border-0 shadow-sm rounded-3">
        <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
          <span className="fw-semibold">
            Qualification Types
            <span className="badge bg-primary ms-2" style={{ fontSize: 11 }}>{activeCount} Active</span>
          </span>
          <small className="text-muted">Changes apply immediately to the student form</small>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" />
              <div className="mt-2 text-muted small">Loading…</div>
            </div>
          ) : qualifications.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <Award size={40} className="mb-3 opacity-25" />
              <p>No qualifications configured yet.</p>
              <button className="btn btn-primary btn-sm" onClick={openCreate}>Add First Qualification</button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 50 }}>Order</th>
                    <th>Qualification Name</th>
                    <th style={{ width: 160 }}>Type</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ width: 110 }}>Students</th>
                    <th style={{ width: 160 }} className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {qualifications.map(qual => (
                    <tr key={qual.id} style={{ opacity: qual.is_active ? 1 : 0.55 }}>
                      <td className="text-center text-muted">{qual.display_order}</td>
                      <td>
                        <span className="fw-semibold">{qual.qualification_name}</span>
                      </td>
                      <td>
                        {qual.is_exemption ? (
                          <span className="badge d-inline-flex align-items-center gap-1" style={{ background: '#fef3c7', color: '#92400e', fontSize: 11 }}>
                            <Shield size={11} /> Exemption
                          </span>
                        ) : (
                          <span className="badge d-inline-flex align-items-center gap-1" style={{ background: '#f3f4f6', color: '#374151', fontSize: 11 }}>
                            <ShieldOff size={11} /> Non-Exemption
                          </span>
                        )}
                      </td>
                      <td>
                        {qual.is_active ? (
                          <span className="badge bg-success" style={{ fontSize: 11 }}>Active</span>
                        ) : (
                          <span className="badge bg-secondary" style={{ fontSize: 11 }}>Disabled</span>
                        )}
                      </td>
                      <td>
                        <span className="d-flex align-items-center gap-1">
                          <Users size={13} className="text-muted" />
                          {qual.student_count || 0}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-1 justify-content-end flex-wrap">
                          {/* Toggle Active/Inactive */}
                          <button
                            className={`btn btn-sm ${qual.is_active ? 'btn-outline-warning' : 'btn-outline-success'} d-flex align-items-center gap-1`}
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => handleToggle(qual)}
                            title={qual.is_active ? 'Disable' : 'Enable'}
                          >
                            {qual.is_active ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                            {qual.is_active ? 'Disable' : 'Enable'}
                          </button>
                          {/* Edit */}
                          <button
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => openEdit(qual)}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          {/* Delete */}
                          {deleteConfirm === qual.id ? (
                            <div className="d-flex gap-1">
                              <button
                                className="btn btn-sm btn-danger d-flex align-items-center gap-1"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => handleDelete(qual.id)}
                              >
                                <Check size={12} /> Confirm
                              </button>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => setDeleteConfirm(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => setDeleteConfirm(qual.id)}
                              title={qual.student_count > 0 ? 'Cannot delete — students have selected this' : 'Delete'}
                              disabled={qual.student_count > 0}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={closeModal}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <Award size={18} className="text-primary" />
                  {editTarget ? 'Edit Qualification' : 'Add New Qualification'}
                </h5>
                <button className="btn-close" onClick={closeModal} />
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Qualification Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. NET, SET, JRF, GATE, M.Phil"
                      value={form.qualification_name}
                      onChange={e => setForm(f => ({ ...f, qualification_name: e.target.value }))}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Display Order</label>
                    <input
                      type="number"
                      className="form-control"
                      style={{ width: 120 }}
                      min={0}
                      value={form.display_order}
                      onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                    />
                    <small className="text-muted">Lower number appears first in student form</small>
                  </div>

                  <div className="mb-3 border rounded-3 p-3">
                    <div className="form-check form-switch mb-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="is_exemption"
                        checked={form.is_exemption}
                        onChange={e => setForm(f => ({ ...f, is_exemption: e.target.checked }))}
                        style={{ width: 36, height: 20 }}
                      />
                      <label className="form-check-label fw-semibold ms-2" htmlFor="is_exemption">
                        Exemption Qualification
                      </label>
                    </div>
                    {form.is_exemption && (
                      <div className="alert alert-warning py-2 mb-0" style={{ fontSize: 12 }}>
                        <Shield size={13} className="me-1" />
                        Students selecting this will bypass the entrance exam and go directly to the interview stage.
                        Their <strong>entrance_exam_status</strong> will be set to <strong>Exempted</strong>.
                      </div>
                    )}
                  </div>

                  <div className="form-check form-switch">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="is_active"
                      checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      style={{ width: 36, height: 20 }}
                    />
                    <label className="form-check-label fw-semibold ms-2" htmlFor="is_active">
                      Active (visible to students)
                    </label>
                  </div>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-outline-secondary" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                    {saving
                      ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</>
                      : editTarget ? 'Update Qualification' : 'Create Qualification'
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualificationManagement;
