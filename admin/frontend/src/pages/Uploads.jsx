import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, ShieldAlert, Save, RefreshCw, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const FILE_TYPE_ICONS = {
  'Photo':                 '🖼️',
  'Signature':             '✍️',
  'ID Proof':              '🪪',
  'Community Certificate': '📄',
  'PC Certificate':        '♿',
  'Mark Sheet':            '📝',
  '10th Standard Marksheet': '📝',
  '12th Standard Marksheet': '📝',
  'UG Degree Documents':   '🎓',
  'PG Degree Documents':   '🎓',
  '5-Year Integrated Course': '⚙️',
  'DOB Evidence':          '🎂',
  'Recognition Certificate': '📜',
};

const Uploads = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(null);

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/uploads/file-settings`);
      setSettings(res.data.data || []);
    } catch { toast.error('Failed to load upload settings'); }
    finally  { setLoading(false); }
  };

  const handleChange = (id, field, value) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const saveRow = async (row) => {
    setSaving(row.id);
    try {
      await axios.put(`${API_URL}/uploads/file-settings/${row.id}`, {
        max_size:           row.max_size,
        size_unit:          row.size_unit,
        allowed_extensions: row.allowed_extensions,
        is_active:          row.is_active !== undefined ? (row.is_active ? 1 : 0) : 1,
        is_integrated_course: row.is_integrated_course,
        consolidated_enabled: row.consolidated_enabled,
        semester_wise_enabled: row.semester_wise_enabled,
        max_semesters:      row.max_semesters,
        allowed_semester_doc_types: row.allowed_semester_doc_types,
        per_file_size_limit: row.per_file_size_limit,
        total_size_limit:   row.total_size_limit,
      }, { headers });
      toast.success(`"${row.file_type}" settings saved`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: 200 }}>
      <div className="spinner-border text-secondary" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: '22px' }}>Upload Settings</h2>
          <nav aria-label="breadcrumb"><ol className="breadcrumb mb-0" style={{ fontSize: '12px' }}>
            <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
            <li className="breadcrumb-item active">Upload Settings</li>
          </ol></nav>
        </div>
        <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={fetchSettings}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Info banner */}
      <div className="alert alert-warning border-0 d-flex align-items-start gap-3 mb-4" style={{ background: '#fff8e1', color: '#856404' }}>
        <ShieldAlert size={20} className="mt-1 flex-shrink-0" />
        <div style={{ fontSize: '13px' }}>
          <strong>Important:</strong> These limits are enforced on both the student-facing upload form and the server.
          Changes take effect immediately for new uploads. Existing uploaded files are not affected.
        </div>
      </div>

      {/* Settings table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '14px' }}>
            <thead className="table-light">
              <tr>
                <th className="ps-4 py-3" style={{ width: 40 }}>#</th>
                <th className="py-3">File Type</th>
                <th className="py-3" style={{ width: 150 }}>Max Size</th>
                <th className="py-3" style={{ width: 100 }}>Unit</th>
                <th className="py-3">Allowed Extensions</th>
                <th className="py-3 d-flex align-items-center gap-1">
                  <Info size={13} className="text-muted" /> Hint
                </th>
                <th className="py-3 text-center" style={{ width: 100 }}>Status</th>
                <th className="py-3 text-center pe-4" style={{ width: 100 }}>Save</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((row, i) => {
                const isAcademicDoc = [
                  '10th Standard Marksheet',
                  '12th Standard Marksheet',
                  'UG Degree Documents',
                  'PG Degree Documents',
                  '5-Year Integrated Course'
                ].includes(row.file_type);

                const isSupervisorDoc = [
                  'DOB Evidence',
                  'Recognition Certificate'
                ].includes(row.file_type);
                
                return (
                  <React.Fragment key={row.id}>
                    <tr>
                      <td className="ps-4 text-muted">{i + 1}</td>
                      <td>
                        <span className="me-2">{FILE_TYPE_ICONS[row.file_type] || '📎'}</span>
                        <span className="fw-semibold">{row.file_type}</span>
                        {isAcademicDoc && <span className="badge bg-info-subtle text-info ms-2" style={{ fontSize: '10px' }}>Academic Document</span>}
                        {isSupervisorDoc && <span className="badge bg-success-subtle text-success ms-2" style={{ fontSize: '10px' }}>Supervisor Portal</span>}
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={1}
                          value={row.max_size}
                          onChange={e => handleChange(row.id, 'max_size', e.target.value)}
                          style={{ width: 100 }}
                        />
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={row.size_unit}
                          onChange={e => handleChange(row.id, 'size_unit', e.target.value)}
                        >
                          <option value="KB">KB</option>
                          <option value="MB">MB</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={row.allowed_extensions}
                          onChange={e => handleChange(row.id, 'allowed_extensions', e.target.value)}
                          placeholder="jpg,jpeg,png,pdf"
                        />
                        <small className="text-muted" style={{ fontSize: '10px' }}>Comma-separated, no spaces</small>
                      </td>
                      <td>
                        <small className="text-muted" style={{ fontSize: '11px' }}>
                          Max: <strong>{row.max_size} {row.size_unit}</strong><br />
                          Types: <strong>{row.allowed_extensions}</strong>
                        </small>
                      </td>
                      <td className="text-center">
                        <div className="form-check form-switch d-inline-block">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={row.is_active === 1 || row.is_active === true}
                            onChange={e => handleChange(row.id, 'is_active', e.target.checked ? 1 : 0)}
                          />
                        </div>
                      </td>
                      <td className="text-center pe-4">
                        <button
                          className="btn btn-sm btn-primary d-flex align-items-center gap-1 mx-auto"
                          style={{ fontSize: '12px' }}
                          onClick={() => saveRow(row)}
                          disabled={saving === row.id}
                        >
                          {saving === row.id
                            ? <span className="spinner-border spinner-border-sm" />
                            : <Save size={13} />}
                          Save
                        </button>
                      </td>
                    </tr>
                    {isAcademicDoc && (
                      <tr>
                        <td colSpan={8} className="bg-light-subtle ps-5 py-3">
                          <div className="border rounded-3 p-3 bg-white shadow-sm">
                            <h6 className="fw-bold mb-3 text-secondary d-flex align-items-center gap-2" style={{ fontSize: '13.5px' }}>
                              <span>⚙️</span> Extended {row.file_type} Upload Configuration
                            </h6>
                            <div className="row g-3 text-start">
                              <div className="col-md-3">
                                <label className="form-label small fw-bold">Consolidated Marksheet</label>
                                <div className="form-check form-switch">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    checked={row.consolidated_enabled === 1 || row.consolidated_enabled === true}
                                    onChange={e => handleChange(row.id, 'consolidated_enabled', e.target.checked ? 1 : 0)}
                                  />
                                  <span className="small text-muted">Allow single-file uploads</span>
                                </div>
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small fw-bold">Semester-wise Marksheet</label>
                                <div className="form-check form-switch">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    checked={row.semester_wise_enabled === 1 || row.semester_wise_enabled === true}
                                    onChange={e => handleChange(row.id, 'semester_wise_enabled', e.target.checked ? 1 : 0)}
                                  />
                                  <span className="small text-muted">Allow individual sem rows</span>
                                </div>
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small fw-bold">Max Semesters Allowed</label>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  min={1}
                                  max={12}
                                  value={row.max_semesters || 10}
                                  onChange={e => handleChange(row.id, 'max_semesters', e.target.value)}
                                />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small fw-bold">Allowed Semester Doc Types</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={row.allowed_semester_doc_types || 'jpg,jpeg,png,pdf'}
                                  onChange={e => handleChange(row.id, 'allowed_semester_doc_types', e.target.value)}
                                  placeholder="jpg,jpeg,png,pdf"
                                />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small fw-bold">Per-file Size Limit (KB)</label>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  min={50}
                                  value={row.per_file_size_limit || 500}
                                  onChange={e => handleChange(row.id, 'per_file_size_limit', e.target.value)}
                                />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small fw-bold">Total Size Limit (KB)</label>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  min={500}
                                  value={row.total_size_limit || 5000}
                                  onChange={e => handleChange(row.id, 'total_size_limit', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info card */}
      <div className="card border-0 shadow-sm mt-4" style={{ background: '#f0fafc' }}>
        <div className="card-body py-3">
          <h6 className="fw-bold mb-2" style={{ color: '#32c5d2' }}>
            <UploadCloud size={16} className="me-1" /> How Upload Limits Work
          </h6>
          <ul className="mb-0 small text-muted" style={{ fontSize: '13px' }}>
            <li><strong>Photo</strong> — Applicant passport-size photo (images only)</li>
            <li><strong>Signature</strong> — Scanned applicant signature (images only)</li>
            <li><strong>ID Proof</strong> — Aadhaar / Voter ID / Passport scan</li>
            <li><strong>Community Certificate</strong> — Caste/community certificate document</li>
            <li><strong>PC Certificate</strong> — Physically challenged certificate</li>
            <li><strong>Mark Sheet</strong> — PG semester or consolidated mark sheets</li>
            <li><strong>DOB Evidence</strong> — 10th Standard marksheet for age proof (Supervisor)</li>
            <li><strong>Recognition Certificate</strong> — Supervisor guideship recognition letter (Supervisor)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Uploads;
