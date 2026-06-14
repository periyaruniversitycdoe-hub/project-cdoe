import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Trash2, CheckCircle, Globe, Settings as SettingsIcon, MapPin, CalendarDays } from 'lucide-react';
import PortalManagement from './PortalManagement';
const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';
const token = () => localStorage.getItem('adminToken');
const authHeader = () => ({ Authorization: `Bearer ${token()}` });

const Settings = () => {
  const [settings, setSettings] = useState({});
  const [activeTab, setActiveTab] = useState('admission');

  const [editingFields, setEditingFields] = useState({
    application_registration_url: false,
    supervisor_registration_url: false,
    research_centre_registration_url: false
  });

  // Exam Centre Config state
  const [examConfig, setExamConfig] = useState({ max_preferences: 2, status: 'active', description: '' });
  const [examConfigSaving, setExamConfigSaving] = useState(false);

  // Academic Timeline Rules state
  const DEFAULT_TRANSITIONS = [
    { id: 1, transition_key: 'sslc_hsc',  transition_label: '10th → +2',     min_gap_years: 2, max_gap_years: 5,  status: 'active' },
    { id: 2, transition_key: 'hsc_ug',    transition_label: '+2 → UG',        min_gap_years: 0, max_gap_years: 10, status: 'active' },
    { id: 3, transition_key: 'ug_pg',     transition_label: 'UG → PG',        min_gap_years: 0, max_gap_years: 10, status: 'active' },
    { id: 4, transition_key: 'pg_mphil',  transition_label: 'PG → M.Phil',    min_gap_years: 0, max_gap_years: 15, status: 'active' },
    { id: 5, transition_key: 'mphil_phd', transition_label: 'M.Phil → Ph.D',  min_gap_years: 0, max_gap_years: 15, status: 'active' },
  ];
  const DEFAULT_DURATIONS = [
    { id: 1, course_key: 'ug',         course_label: 'UG',         min_duration: 3, max_duration: 4, status: 'active' },
    { id: 2, course_key: 'pg',         course_label: 'PG',         min_duration: 2, max_duration: 2, status: 'active' },
    { id: 3, course_key: 'mphil',      course_label: 'M.Phil',     min_duration: 1, max_duration: 1, status: 'active' },
    { id: 4, course_key: 'integrated', course_label: 'Integrated', min_duration: 5, max_duration: 5, status: 'active' },
  ];
  const [timelineTransitions, setTimelineTransitions] = useState(DEFAULT_TRANSITIONS);
  const [timelineDurations, setTimelineDurations]     = useState(DEFAULT_DURATIONS);
  const [timelineSaving, setTimelineSaving]           = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
    fetchExamConfig();
    fetchTimelineRules();
  }, []);

  const fetchExamConfig = async () => {
    try {
      const res = await axios.get(`${API}/settings/exam-centre-config`);
      if (res.data.success) setExamConfig(res.data.data || { max_preferences: 2, status: 'active', description: '' });
    } catch { /* silent — use defaults */ }
  };

  const fetchTimelineRules = async () => {
    try {
      const res = await axios.get(`${API}/settings/timeline-rules`);
      if (res.data.success && res.data.data) {
        if (res.data.data.transitions?.length) setTimelineTransitions(res.data.data.transitions);
        if (res.data.data.durations?.length)   setTimelineDurations(res.data.data.durations);
      }
    } catch { /* silent — use defaults */ }
  };

  const handleSaveTimelineRules = async () => {
    for (const t of timelineTransitions) {
      const min = parseInt(t.min_gap_years), max = parseInt(t.max_gap_years);
      if (isNaN(min) || isNaN(max) || min < 0 || max < min) {
        toast.error(`Invalid gap for "${t.transition_label}": max must be ≥ min and both ≥ 0`);
        return;
      }
    }
    for (const d of timelineDurations) {
      const min = parseInt(d.min_duration), max = parseInt(d.max_duration);
      if (isNaN(min) || isNaN(max) || min < 1 || max < min) {
        toast.error(`Invalid duration for "${d.course_label}": max must be ≥ min and both ≥ 1`);
        return;
      }
    }
    setTimelineSaving(true);
    try {
      await axios.put(
        `${API}/settings/timeline-rules`,
        { transitions: timelineTransitions, durations: timelineDurations },
        { headers: authHeader() }
      );
      toast.success('Academic Timeline Rules saved!', { icon: <CheckCircle size={20} style={{ color: '#10b981' }} /> });
    } catch { toast.error('Failed to save Academic Timeline Rules'); }
    setTimelineSaving(false);
  };

  const setTransition = (id, field, value) =>
    setTimelineTransitions(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));

  const setDuration = (id, field, value) =>
    setTimelineDurations(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));

  const handleSaveExamConfig = async () => {
    const maxPref = parseInt(examConfig.max_preferences);
    if (isNaN(maxPref) || maxPref < 1 || maxPref > 10) {
      toast.error('Maximum Preferences must be between 1 and 10');
      return;
    }
    setExamConfigSaving(true);
    try {
      await axios.put(`${API}/settings/exam-centre-config`, examConfig, { headers: authHeader() });
      toast.success('Exam Centre settings saved!', { icon: <CheckCircle size={20} style={{ color: '#10b981' }} /> });
    } catch { toast.error('Failed to save Exam Centre settings'); }
    setExamConfigSaving(false);
  };

  const fetchAll = async () => {
    try {
      const res = await axios.get(`${API}/settings`);
      setSettings(res.data.data || {});
    } catch { toast.error('Failed to load settings'); }
    setLoading(false);
  };

  const set = (key, val) => setSettings(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!settings.university_name_english || !settings.university_name_english.toString().trim()) {
      toast.error('Header Line 1 (English University Name) is required and cannot be empty!');
      return;
    }
    if (!settings.university_name_tamil || !settings.university_name_tamil.toString().trim()) {
      toast.error('Header Line 2 (Tamil University Name) is required and cannot be empty!');
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/settings/update`, settings, { headers: authHeader() });
      toast.success('Settings saved successfully!', {
        icon: <CheckCircle size={20} style={{ color: '#10b981' }} />,
        duration: 3000
      });
      setEditingFields({
        application_registration_url: false,
        supervisor_registration_url: false,
        research_centre_registration_url: false
      });
    } catch { toast.error('Failed to save settings'); }
    setSaving(false);
  };

  const uploadFile = async (field, file, type = 'image') => {
    const fd = new FormData();
    if (type === 'image') { fd.append('image', file); fd.append('field', field); }
    else { fd.append('file', file); fd.append('field', field); }
    const endpoint = type === 'image' ? 'upload-image' : 'upload-file';
    try {
      const res = await axios.post(`${API}/settings/${endpoint}`, fd, { headers: authHeader() });
      set(field, res.data.path);
      toast.success('Uploaded successfully!', {
        icon: <CheckCircle size={20} style={{ color: '#10b981' }} />
      });
    } catch { toast.error('Upload failed'); }
  };
  const deleteFile = async (field) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    set(field, null);
    toast.success('File removed. Click Save All Changes to apply.', {
      icon: <CheckCircle size={20} style={{ color: '#10b981' }} />
    });
  };

  const FileUploadCell = ({ label, field, type = 'image' }) => {
    const ref = useRef();
    const getUrl = (path) => {
      if (!path) return '#';
      if (path.startsWith('/uploads')) return (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + path;
      return path; // Standard relative assets like /images/...
    };

    return (
      <div className="d-flex align-items-center gap-2">
        <input type="file" ref={ref} className="d-none" onChange={e => uploadFile(field, e.target.files[0], type)} />
        <div className="d-flex flex-column">
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-outline-primary" onClick={() => ref.current.click()}>
              {settings[field] ? 'Change' : 'Upload'} {label}
            </button>
            {settings[field] && (
              <div className="btn-group">
                <a href={getUrl(settings[field])} target="_blank" rel="noreferrer" className="btn btn-sm btn-success text-white">
                  View
                </a>
                <button 
                  className="btn btn-sm btn-danger text-white" 
                  onClick={() => deleteFile(field)}
                  title="Remove file"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
          {settings[field] && type === 'image' && (
            <img src={getUrl(settings[field])} alt={label} className="mt-2 rounded border" style={{ height: 40, objectFit: 'contain' }} />
          )}
        </div>
      </div>
    );
  };

  const Toggle = ({ field, label }) => (
    <div className="form-check form-switch d-flex align-items-center gap-2 mb-0">
      <input className="form-check-input" type="checkbox" style={{ width: 40, height: 22 }}
        checked={!!settings[field]} onChange={e => set(field, e.target.checked ? 1 : 0)} />
      <label className="form-check-label fw-semibold">{label}</label>
    </div>
  );

  const DateRange = ({ enableField, openField, closeField, label }) => (
    <tr>
      <td className="fw-semibold ps-3" style={{ width: 200 }}>{label}</td>
      <td><Toggle field={enableField} label="" /></td>
      <td><input type="date" className="form-control form-control-sm" value={settings[openField] ? settings[openField].slice(0,10) : ''} onChange={e => set(openField, e.target.value)} /></td>
      <td><input type="date" className="form-control form-control-sm" value={settings[closeField] ? settings[closeField].slice(0,10) : ''} onChange={e => set(closeField, e.target.value)} /></td>
    </tr>
  );

  const renderRegistrationUrlField = (label, field, example) => {
    const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
    const isSystemAdmin = adminUser.role === 'admin';
    const isEditing = editingFields[field];
    const urlValue = settings[field] || '';
    const hasValue = !!urlValue.trim();

    const handleTest = () => {
      if (!hasValue) {
        toast.error('Registration link has not been configured by Administrator.');
        return;
      }
      window.open(urlValue, '_blank');
    };

    const handleEdit = () => {
      setEditingFields(prev => ({ ...prev, [field]: true }));
    };

    const handleCancel = () => {
      fetchAll();
      setEditingFields(prev => ({ ...prev, [field]: false }));
    };

    const handleSaveField = async () => {
      setSaving(true);
      try {
        await axios.put(`${API}/settings/update`, { ...settings, [field]: urlValue }, { headers: authHeader() });
        toast.success(`${label} saved successfully!`);
        setEditingFields(prev => ({ ...prev, [field]: false }));
        fetchAll();
      } catch (err) {
        toast.error(`Failed to save ${label}`);
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="mb-4 pb-3 border-bottom" style={{ borderBottomStyle: 'dashed' }}>
        <label className="form-label small fw-semibold text-secondary d-block mb-1">{label}</label>
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder={example ? `Example: ${example}` : 'Enter URL...'}
            value={urlValue}
            onChange={e => set(field, e.target.value)}
            disabled={!isEditing || !isSystemAdmin}
            style={{ backgroundColor: (!isEditing || !isSystemAdmin) ? '#f8fafc' : '#ffffff' }}
          />
          {isSystemAdmin ? (
            <>
              {isEditing ? (
                <>
                  <button className="btn btn-success text-white fw-bold" onClick={handleSaveField} disabled={saving}>
                    Save URL
                  </button>
                  <button className="btn btn-outline-secondary" onClick={handleCancel} disabled={saving}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-outline-primary fw-bold" onClick={handleEdit}>
                    {hasValue ? 'Edit URL' : 'Add URL'}
                  </button>
                  <button className="btn btn-outline-info" onClick={handleTest} disabled={!hasValue}>
                    Test URL
                  </button>
                </>
              )}
            </>
          ) : (
            <button className="btn btn-outline-info" onClick={handleTest} disabled={!hasValue}>
              Test URL
            </button>
          )}
        </div>
        <div className="form-text text-muted small mt-1">
          {isEditing ? (
            <span className="text-warning fw-semibold">✏️ You have unsaved changes. Click 'Save URL' or 'Save All Changes' to apply.</span>
          ) : hasValue ? (
            <span className="text-success fw-semibold">● Configured: {urlValue}</span>
          ) : (
            <span className="text-danger fw-semibold">○ Registration link has not been configured by Administrator.</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-5 text-center"><div className="spinner-border text-primary" /></div>;

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#32c5d2' }}>Online Application Settings</h2>
          <p className="text-muted mb-0 small">Manage all admission portal configuration and community fees</p>
        </div>
        {(activeTab === 'admission') && (
          <button className="btn btn-primary px-4" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : '💾 Save All Changes'}
          </button>
        )}
        {activeTab === 'exam-centre' && (
          <button className="btn btn-primary px-4" onClick={handleSaveExamConfig} disabled={examConfigSaving}>
            {examConfigSaving ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : '💾 Save Exam Centre Settings'}
          </button>
        )}
        {activeTab === 'timeline' && (
          <button className="btn btn-primary px-4" onClick={handleSaveTimelineRules} disabled={timelineSaving}>
            {timelineSaving ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : '💾 Save Timeline Rules'}
          </button>
        )}
      </div>

      {/* Dynamic Tab Switcher */}
      <div className="d-flex gap-2 mb-4 border-bottom pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab('admission')}
          className="btn btn-sm d-flex align-items-center gap-1.5 px-3 py-2 rounded-3 border"
          style={{
            backgroundColor: activeTab === 'admission' ? '#32c5d2' : '#ffffff',
            color: activeTab === 'admission' ? '#ffffff' : '#475569',
            borderColor: activeTab === 'admission' ? '#32c5d2' : '#cbd5e1',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
        >
          <SettingsIcon size={16} /> Admission & Fees Settings
        </button>
        <button
          onClick={() => setActiveTab('portals')}
          className="btn btn-sm d-flex align-items-center gap-1.5 px-3 py-2 rounded-3 border"
          style={{
            backgroundColor: activeTab === 'portals' ? '#32c5d2' : '#ffffff',
            color: activeTab === 'portals' ? '#ffffff' : '#475569',
            borderColor: activeTab === 'portals' ? '#32c5d2' : '#cbd5e1',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
        >
          <Globe size={16} /> Portal Landing Management
        </button>
        <button
          onClick={() => setActiveTab('exam-centre')}
          className="btn btn-sm d-flex align-items-center gap-1.5 px-3 py-2 rounded-3 border"
          style={{
            backgroundColor: activeTab === 'exam-centre' ? '#32c5d2' : '#ffffff',
            color: activeTab === 'exam-centre' ? '#ffffff' : '#475569',
            borderColor: activeTab === 'exam-centre' ? '#32c5d2' : '#cbd5e1',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
        >
          <MapPin size={16} /> Exam Centre Settings
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className="btn btn-sm d-flex align-items-center gap-1.5 px-3 py-2 rounded-3 border"
          style={{
            backgroundColor: activeTab === 'timeline' ? '#32c5d2' : '#ffffff',
            color: activeTab === 'timeline' ? '#ffffff' : '#475569',
            borderColor: activeTab === 'timeline' ? '#32c5d2' : '#cbd5e1',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
        >
          <CalendarDays size={16} /> Academic Timeline
        </button>
      </div>

      {activeTab === 'portals' && <PortalManagement />}

      {/* ── Academic Timeline Configuration Tab ──────────────────────────── */}
      {activeTab === 'timeline' && (
        <div>
          <div className="alert alert-info py-2 small mb-4 d-flex align-items-start gap-2">
            <span style={{ fontSize: 16 }}>ℹ️</span>
            <div>
              <strong>How this works:</strong> Define the allowed year-gap between consecutive academic stages and the
              expected duration for each course. The student registration form will dynamically filter year dropdowns
              to only show valid options, and submissions that violate these rules will be rejected.
            </div>
          </div>

          {/* Transition Gap Rules */}
          <div className="card mb-4">
            <div className="card-header fw-bold text-uppercase d-flex align-items-center gap-2" style={{ fontSize: 12, letterSpacing: 1 }}>
              <CalendarDays size={14} /> Academic Stage Transition Rules
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-bordered mb-0" style={{ fontSize: 13 }}>
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '30%' }}>Transition</th>
                      <th style={{ width: '20%' }}>Min Gap (Years)</th>
                      <th style={{ width: '20%' }}>Max Gap (Years)</th>
                      <th style={{ width: '15%' }}>Status</th>
                      <th style={{ width: '15%' }}>Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineTransitions.map(t => (
                      <tr key={t.id}>
                        <td className="fw-semibold align-middle">{t.transition_label}</td>
                        <td>
                          <input
                            type="number" min="0" max="20"
                            className="form-control form-control-sm"
                            value={t.min_gap_years}
                            onChange={e => setTransition(t.id, 'min_gap_years', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min="0" max="50"
                            className="form-control form-control-sm"
                            value={t.max_gap_years}
                            onChange={e => setTransition(t.id, 'max_gap_years', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={t.status}
                            onChange={e => setTransition(t.id, 'status', e.target.value)}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                        <td className="text-muted small align-middle">
                          {t.min_gap_years}–{t.max_gap_years} yrs gap
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 bg-light border-top small text-muted">
                <strong>Min Gap</strong> = least number of years between completion of the previous stage and start of the next.
                &nbsp;<strong>Max Gap</strong> = most years allowed.
                Set <strong>Max = 0</strong> to disable the upper limit for a rule.
              </div>
            </div>
          </div>

          {/* Course Duration Rules */}
          <div className="card mb-4">
            <div className="card-header fw-bold text-uppercase d-flex align-items-center gap-2" style={{ fontSize: 12, letterSpacing: 1 }}>
              <CalendarDays size={14} /> Course Duration Rules (Start → Completion Year)
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-bordered mb-0" style={{ fontSize: 13 }}>
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '30%' }}>Course</th>
                      <th style={{ width: '20%' }}>Min Duration (Years)</th>
                      <th style={{ width: '20%' }}>Max Duration (Years)</th>
                      <th style={{ width: '15%' }}>Status</th>
                      <th style={{ width: '15%' }}>Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineDurations.map(d => (
                      <tr key={d.id}>
                        <td className="fw-semibold align-middle">{d.course_label}</td>
                        <td>
                          <input
                            type="number" min="1" max="10"
                            className="form-control form-control-sm"
                            value={d.min_duration}
                            onChange={e => setDuration(d.id, 'min_duration', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min="1" max="10"
                            className="form-control form-control-sm"
                            value={d.max_duration}
                            onChange={e => setDuration(d.id, 'max_duration', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={d.status}
                            onChange={e => setDuration(d.id, 'status', e.target.value)}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                        <td className="text-muted small align-middle">
                          {d.min_duration}–{d.max_duration} yr course
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 bg-light border-top small text-muted">
                <strong>Min Duration</strong> = minimum years from start to completion.&nbsp;
                <strong>Max Duration</strong> = maximum years allowed.
                Only applies to courses that capture both a start year and a completion year (UG, PG, M.Phil, Integrated).
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'exam-centre' && (
        <div>
          {/* ── Exam Centre Preference Configuration ─────────────────────── */}
          <div className="card mb-4">
            <div className="card-header fw-bold text-uppercase d-flex align-items-center gap-2" style={{ fontSize: 12, letterSpacing: 1 }}>
              <MapPin size={14} /> Exam Centre Preference Configuration
            </div>
            <div className="card-body">
              <div className="alert alert-info py-2 small mb-4 d-flex align-items-start gap-2">
                <span style={{ fontSize: 16 }}>ℹ️</span>
                <div>
                  <strong>How this works:</strong> Set the maximum number of exam centre preferences a student can submit during registration.
                  The student form will dynamically show exactly this many preference dropdowns.
                  Exam centre list is managed under <strong>Dropdown Management → Exam Centers</strong>.
                </div>
              </div>

              <div className="row g-4">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">
                    Maximum Exam Centre Preferences
                    <span className="text-danger ms-1">*</span>
                  </label>
                  <div className="input-group">
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      max={10}
                      value={examConfig.max_preferences}
                      onChange={e => setExamConfig(p => ({ ...p, max_preferences: parseInt(e.target.value) || 1 }))}
                    />
                    <span className="input-group-text text-muted small">1 – 10</span>
                  </div>
                  <div className="form-text text-muted">
                    Students will see exactly this many preference dropdowns (e.g., 2 = Preference 1 &amp; Preference 2).
                  </div>
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold">Status</label>
                  <select
                    className="form-select"
                    value={examConfig.status}
                    onChange={e => setExamConfig(p => ({ ...p, status: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <div className="form-text text-muted">
                    Inactive will fall back to 2 preferences (system default).
                  </div>
                </div>

                <div className="col-md-5">
                  <label className="form-label fw-semibold">Description / Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    maxLength={500}
                    value={examConfig.description || ''}
                    onChange={e => setExamConfig(p => ({ ...p, description: e.target.value }))}
                    placeholder="Optional: reason for this configuration..."
                  />
                </div>
              </div>

              {/* Live Preview */}
              <div className="mt-4 p-3 rounded-3" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                <div className="fw-semibold small text-secondary mb-2">Live Preview — Student Form Will Show:</div>
                <div className="row g-2">
                  {Array.from({ length: Math.min(Math.max(parseInt(examConfig.max_preferences) || 1, 1), 10) }, (_, i) => (
                    <div key={i} className="col-md-4">
                      <div className="border rounded p-2 bg-white" style={{ fontSize: 13 }}>
                        <span className="badge bg-primary-subtle text-primary me-2 fw-bold" style={{ fontSize: 11 }}>{i + 1}</span>
                        Exam Centre Preference {i + 1}
                        {i === 0 && <span className="text-danger ms-1">*</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {examConfig.updated_at && (
                <div className="mt-3 small text-muted">
                  Last updated: {new Date(examConfig.updated_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Exam Centre Master Hint */}
          <div className="card mb-4 border-info border-opacity-25">
            <div className="card-body d-flex align-items-start gap-3 py-3">
              <MapPin size={20} className="text-info mt-1 flex-shrink-0" />
              <div>
                <div className="fw-semibold text-info-emphasis mb-1">Exam Centre Master Management</div>
                <div className="small text-secondary">
                  To add, edit, disable, enable or reorder exam centres, go to{' '}
                  <a href="/dropdowns" className="fw-semibold text-info">Dropdown Management</a>{' '}
                  and select <strong>Exam Centers</strong>. All changes there are reflected instantly in the student registration form.
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end mb-5">
            <button className="btn btn-primary btn-lg px-5" onClick={handleSaveExamConfig} disabled={examConfigSaving}>
              {examConfigSaving ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : '💾 Save Exam Centre Settings'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'admission' && (
        <>
          {/* ── SECTION 1: HEADER ─────────────────────── */}
          <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>🏫 Header Information</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label small fw-semibold">Header Line 1 (English University Name)</label>
              <input className="form-control" value={settings.university_name_english || ''} onChange={e => set('university_name_english', e.target.value)} placeholder="PERIYAR UNIVERSITY" />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold">Header Line 2 (Tamil University Name)</label>
              <input className="form-control" value={settings.university_name_tamil || ''} onChange={e => set('university_name_tamil', e.target.value)} placeholder="பெரியார் பல்கலைக்கழகம்" />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold">Header Line 3 (Sub-title / NAAC Details)</label>
              <input className="form-control" value={settings.header_line2 || ''} onChange={e => set('header_line2', e.target.value)} placeholder="State University - NAAC 'A++' GRADE" />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold">Header Line 4 (Address)</label>
              <input className="form-control" value={settings.header_line3 || ''} onChange={e => set('header_line3', e.target.value)} placeholder="Salem - 636011, Tamil Nadu, INDIA" />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">University Logo</label>
              <FileUploadCell label="Logo" field="logo" type="image" />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Secondary Logo</label>
              <FileUploadCell label="Logo 2" field="logo2" type="image" />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: PORTAL HEADER NAVIGATION SETTINGS ───────────── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>🌐 Portal Header Navigation Settings</div>
        <div className="card-body">
          <div className="row g-4">
            
            {/* About Us Link Settings */}
            <div className="col-lg-4 col-md-12 border-end pe-md-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="fw-bold text-primary mb-0">ℹ️ About Us Link</h6>
                <Toggle field="about_us_enabled" label="Enabled" />
              </div>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">Button Title</label>
                  <input className="form-control form-control-sm" value={settings.about_us_title || ''} onChange={e => set('about_us_title', e.target.value)} placeholder="About Us" />
                </div>
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">URL / Link</label>
                  <input className="form-control form-control-sm" value={settings.about_us_link || ''} onChange={e => set('about_us_link', e.target.value)} placeholder="https://university.edu/about" />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Open Mode</label>
                  <select className="form-select form-select-sm" value={settings.about_us_open_mode || '_blank'} onChange={e => set('about_us_open_mode', e.target.value)}>
                    <option value="_blank">New Tab</option>
                    <option value="_self">Same Tab</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Order</label>
                  <input type="number" className="form-control form-control-sm" value={settings.about_us_order === undefined ? 1 : settings.about_us_order} onChange={e => set('about_us_order', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            {/* Policies Link Settings */}
            <div className="col-lg-4 col-md-12 border-end px-md-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="fw-bold text-success mb-0">🛡️ Policies Link</h6>
                <Toggle field="policies_enabled" label="Enabled" />
              </div>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">Button Title</label>
                  <input className="form-control form-control-sm" value={settings.policies_title || ''} onChange={e => set('policies_title', e.target.value)} placeholder="Policies" />
                </div>
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">URL / Link</label>
                  <input className="form-control form-control-sm" value={settings.policies_link || ''} onChange={e => set('policies_link', e.target.value)} placeholder="https://university.edu/policies.pdf" />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Open Mode</label>
                  <select className="form-select form-select-sm" value={settings.policies_open_mode || '_blank'} onChange={e => set('policies_open_mode', e.target.value)}>
                    <option value="_blank">New Tab</option>
                    <option value="_self">Same Tab</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Order</label>
                  <input type="number" className="form-control form-control-sm" value={settings.policies_order === undefined ? 2 : settings.policies_order} onChange={e => set('policies_order', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            {/* Contact Link Settings */}
            <div className="col-lg-4 col-md-12 ps-md-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="fw-bold text-info mb-0">📞 Contact Link</h6>
                <Toggle field="contact_enabled" label="Enabled" />
              </div>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">Button Title</label>
                  <input className="form-control form-control-sm" value={settings.contact_title || ''} onChange={e => set('contact_title', e.target.value)} placeholder="Contact" />
                </div>
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">URL / Link</label>
                  <input className="form-control form-control-sm" value={settings.contact_link || ''} onChange={e => set('contact_link', e.target.value)} placeholder="/contact" />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Open Mode</label>
                  <select className="form-select form-select-sm" value={settings.contact_open_mode || '_self'} onChange={e => set('contact_open_mode', e.target.value)}>
                    <option value="_blank">New Tab</option>
                    <option value="_self">Same Tab</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Order</label>
                  <input type="number" className="form-control form-control-sm" value={settings.contact_order === undefined ? 3 : settings.contact_order} onChange={e => set('contact_order', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── SECTION 3: FILES ───────────────────────── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>📎 Documents & Files</div>
        <div className="card-body">
          <div className="row g-3">
            {[
              { label: 'Prospectus', field: 'prospectus' },
              { label: 'Instructions', field: 'instruction_file' },
              { label: 'Syllabus', field: 'syllabus_file' },
            ].map(({ label, field }) => (
              <div className="col-md-4" key={field}>
                <label className="form-label small fw-semibold">{label}</label>
                <FileUploadCell label={label} field={field} type="file" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: PORTAL ENABLE SETTINGS ──────── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>🔐 Portal Access Control</div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bordered mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 200 }}>Module</th>
                  <th style={{ width: 100 }}>Enable</th>
                  <th>Open Date</th>
                  <th>Close Date</th>
                </tr>
              </thead>
              <tbody>
                <DateRange enableField="apply_now_enabled" openField="apply_now_open" closeField="apply_now_close" label="Apply Now (Registration)" />
                <DateRange enableField="applicant_login_enabled" openField="applicant_login_open" closeField="applicant_login_close" label="Applicant Login" />
                <DateRange enableField="hall_ticket_enabled" openField="hall_ticket_open" closeField="hall_ticket_close" label="Hall Ticket" />
                <DateRange enableField="payment_enabled" openField="payment_open" closeField="payment_close" label="Payment Window" />
                <DateRange enableField="result_publish_enabled" openField="result_publish_open" closeField="result_publish_close" label="Result Published" />
                <tr>
                  <td className="fw-semibold ps-3">Last Payment Date</td>
                  <td colSpan="2"><input type="date" className="form-control form-control-sm" value={settings.last_payment_date ? settings.last_payment_date.slice(0,10) : ''} onChange={e => set('last_payment_date', e.target.value)} /></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SECTION 4.5: REGISTRATION PORTAL SETTINGS ── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>
          🔗 REGISTRATION PORTAL SETTINGS
        </div>
        <div className="card-body">
          {renderRegistrationUrlField('Application Registration URL', 'application_registration_url', 'https://portal.university.edu/application-registration')}
          {renderRegistrationUrlField('Supervisor Registration URL', 'supervisor_registration_url', 'https://portal.university.edu/supervisor-registration')}
          {renderRegistrationUrlField('Research Centre Registration URL', 'research_centre_registration_url', 'https://portal.university.edu/research-centre-registration')}
        </div>
      </div>
      
      {/* Sticky Save */}
      <div className="d-flex justify-content-end mb-5">
        <button className="btn btn-primary btn-lg px-5" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : '💾 Save All Changes'}
        </button>
      </div>
        </>
      )}
    </div>
  );
};

export default Settings;
