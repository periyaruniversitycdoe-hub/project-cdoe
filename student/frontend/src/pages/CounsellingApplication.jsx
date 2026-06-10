import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import Header from '../components/Header';
import { GraduationCap, Plus, Trash2, Send, CheckCircle, Lock, Clock, Building2, User } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';
const MAX_PREFS = 5;

const CounsellingApplication = () => {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();

  const [settings, setSettings]         = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [centers, setCenters]           = useState([]);
  const [allSupervisors, setAllSupervisors] = useState([]);

  // 5 center prefs + 5 supervisor prefs (independent)
  const [centerPrefs, setCenterPrefs]   = useState(['']);      // array of center IDs (strings)
  const [supPrefs, setSupPrefs]         = useState(['']);      // array of supervisor IDs (strings)

  const [existingApp, setExistingApp]   = useState(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  const dateStatus = useCallback(() => {
    if (!settings) return 'loading';
    const today = new Date().toISOString().split('T')[0];
    if (today < settings.start_date) return 'not_started';
    if (today > settings.end_date)   return 'closed';
    return 'open';
  }, [settings]);

  const status = dateStatus();

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const er = await axios.get(`${API}/student/eligibility`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const eligibility = er.data.data || {};
        if (!eligibility.eligible_for_counselling) {
          if (eligibility.final_result_status === 'FAIL') {
            toast.error('Counselling Restricted: Your entrance result is Not Qualified (FAIL).');
          } else if (eligibility.payment_status !== 'Paid') {
            toast.error('Access Restricted: Application fee payment not verified.');
          } else if (!eligibility.result_published) {
            toast.error('Access Restricted: Entrance results have not been published yet.');
          } else if (!eligibility.counselling_window_active) {
            toast.error('Counselling Restricted: The counselling window is currently closed.');
          } else {
            toast.error('Counselling is currently not accessible for your application.');
          }
          navigate('/dashboard');
          return;
        }
      } catch {
        toast.error('Security Gate Error: Unable to verify eligibility.');
        navigate('/dashboard');
        return;
      }

      try {
        const sr = await axios.get(`${API}/counselling/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSettings(sr.data.data);
      } catch (err) {
        setSettingsError(err.response?.data?.message || 'Counselling is not available for your session.');
        setLoading(false);
        return;
      }

      // Load centers and all supervisors in parallel
      const [centersRes, supsRes] = await Promise.allSettled([
        axios.get(`${API}/counselling/research-centers`),
        axios.get(`${API}/counselling/research-supervisors`),
      ]);
      if (centersRes.status === 'fulfilled') setCenters(centersRes.value.data.data || []);
      if (supsRes.status === 'fulfilled') setAllSupervisors(supsRes.value.data.data || []);

      // Load existing application
      try {
        const ar = await axios.get(`${API}/counselling/my-application`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (ar.data.data) {
          const app = ar.data.data;
          setExistingApp(app);
          // Populate new separate preferences if available
          if (app.center_preferences?.length > 0) {
            setCenterPrefs(app.center_preferences.map(p => String(p.research_center_id)));
          } else if (app.choices?.length > 0) {
            // Backward compat: fill from legacy choices
            const seen = new Set();
            const cp = app.choices
              .map(c => String(c.centre_id || c.research_center_id || ''))
              .filter(id => id && !seen.has(id) && seen.add(id));
            if (cp.length > 0) setCenterPrefs(cp);
          }
          if (app.supervisor_preferences?.length > 0) {
            setSupPrefs(app.supervisor_preferences.map(p => String(p.supervisor_id)));
          } else if (app.choices?.length > 0) {
            const seen = new Set();
            const sp = app.choices
              .map(c => String(c.master_supervisor_id || c.supervisor_id || ''))
              .filter(id => id && !seen.has(id) && seen.add(id));
            if (sp.length > 0) setSupPrefs(sp);
          }
        }
      } catch {}

      setLoading(false);
    };
    init();
  }, [token]);

  const isSubmitted = existingApp?.status === 'Submitted';

  // ── Center preference handlers ──────────────────────────────────────────────
  const setCenterAt    = (idx, val) => setCenterPrefs(p => { const n = [...p]; n[idx] = val; return n; });
  const addCenter      = ()         => { if (centerPrefs.length < MAX_PREFS) setCenterPrefs(p => [...p, '']); };
  const removeCenter   = (idx)      => { if (centerPrefs.length > 1) setCenterPrefs(p => p.filter((_, i) => i !== idx)); };

  // ── Supervisor preference handlers ─────────────────────────────────────────
  const setSupAt       = (idx, val) => setSupPrefs(p => { const n = [...p]; n[idx] = val; return n; });
  const addSup         = ()         => { if (supPrefs.length < MAX_PREFS) setSupPrefs(p => [...p, '']); };
  const removeSup      = (idx)      => { if (supPrefs.length > 1) setSupPrefs(p => p.filter((_, i) => i !== idx)); };

  const validate = () => {
    const filledCenters = centerPrefs.filter(Boolean);
    const filledSups    = supPrefs.filter(Boolean);
    if (filledCenters.length === 0) { toast.error('Select at least one Research Center preference'); return false; }
    if (filledSups.length === 0)    { toast.error('Select at least one Supervisor preference'); return false; }
    if (new Set(filledCenters).size !== filledCenters.length) { toast.error('Duplicate center selections are not allowed'); return false; }
    if (new Set(filledSups).size !== filledSups.length)       { toast.error('Duplicate supervisor selections are not allowed'); return false; }
    return true;
  };

  const buildPayload = () => ({
    center_preferences:     centerPrefs.filter(Boolean).map(Number),
    supervisor_preferences: supPrefs.filter(Boolean).map(Number),
  });

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/counselling/save-preferences`, buildPayload(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Research preferences saved as draft');
      const ar = await axios.get(`${API}/counselling/my-application`, { headers: { Authorization: `Bearer ${token}` } });
      if (ar.data.data) setExistingApp(ar.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!window.confirm('Submit your counselling application? You cannot edit after submission.')) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/counselling/save-preferences`, buildPayload(), { headers: { Authorization: `Bearer ${token}` } });
      await axios.post(`${API}/counselling/submit`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Counselling application submitted!');
      const ar = await axios.get(`${API}/counselling/my-application`, { headers: { Authorization: `Bearer ${token}` } });
      if (ar.data.data) setExistingApp(ar.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="bg-light min-vh-100">
        <Header />
        <div className="container py-5 text-center">
          <div className="spinner-border text-primary" />
        </div>
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="bg-light min-vh-100">
        <Header />
        <div className="container py-5">
          <div className="card border-0 shadow-sm rounded-4 p-5 text-center">
            <Lock size={48} className="text-secondary mx-auto mb-3" />
            <h4 className="fw-bold text-secondary">Counselling Not Available</h4>
            <p className="text-muted">{settingsError}</p>
            <button className="btn btn-outline-secondary mt-2" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-light min-vh-100 pb-5">
      <Header />
      <div className="container mt-4" style={{ maxWidth: 900 }}>

        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="breadcrumb" style={{ fontSize: 13 }}>
            <li className="breadcrumb-item"><a href="/dashboard">Dashboard</a></li>
            <li className="breadcrumb-item active">Counselling Application</li>
          </ol>
        </nav>

        {/* Header card */}
        <div className="card border-0 shadow-sm rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, #32b5c0, #0d6efd)' }}>
          <div className="card-body p-4 text-white">
            <div className="d-flex align-items-center gap-3">
              <GraduationCap size={36} color="#fff" />
              <div>
                <h4 className="fw-bold mb-0">Counselling Application</h4>
                <p className="mb-0 opacity-75 small">
                  Select up to {MAX_PREFS} Research Center preferences and up to {MAX_PREFS} Supervisor preferences independently.
                  Window: {settings?.start_date} – {settings?.end_date}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status banners */}
        {status === 'not_started' && (
          <div className="alert alert-warning d-flex align-items-center gap-2 rounded-4">
            <Clock size={18} /> Counselling application has not started yet. Opens on {settings?.start_date}.
          </div>
        )}
        {status === 'closed' && (
          <div className="alert alert-danger d-flex align-items-center gap-2 rounded-4">
            <Lock size={18} /> Counselling application is closed. The deadline was {settings?.end_date}.
          </div>
        )}
        {isSubmitted && (
          <div className="alert alert-success d-flex align-items-center gap-2 rounded-4">
            <CheckCircle size={18} /> Your counselling application has been submitted successfully.
          </div>
        )}

        <div className="row g-4">
          {/* ── Research Center Preferences ── */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-header py-3 d-flex align-items-center gap-2" style={{ background: '#0d6efd', color: '#fff', borderRadius: '1rem 1rem 0 0' }}>
                <Building2 size={18} />
                <h6 className="mb-0 fw-bold">Research Center Preferences</h6>
                <span className="badge bg-white text-primary ms-auto">{centerPrefs.filter(Boolean).length} / {MAX_PREFS}</span>
              </div>
              <div className="card-body p-3">
                <p className="text-muted small mb-3">Rank your preferred Research Centers (1 = most preferred)</p>

                {centerPrefs.map((centerId, idx) => (
                  <div key={idx} className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge rounded-pill" style={{ background: '#0d6efd', minWidth: 26, fontSize: 12 }}>{idx + 1}</span>
                    <select
                      className="form-select form-select-sm flex-grow-1"
                      value={centerId}
                      onChange={e => setCenterAt(idx, e.target.value)}
                      disabled={isSubmitted || status !== 'open'}
                    >
                      <option value="">Select Center</option>
                      {centers.map(c => (
                        <option key={c.id} value={c.id}
                          disabled={centerPrefs.some((v, i) => i !== idx && v === String(c.id))}>
                          {c.center_name}
                        </option>
                      ))}
                    </select>
                    {!isSubmitted && status === 'open' && centerPrefs.length > 1 && (
                      <button className="btn btn-sm btn-outline-danger border-0 p-1" onClick={() => removeCenter(idx)} title="Remove">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {!isSubmitted && status === 'open' && centerPrefs.length < MAX_PREFS && (
                  <button className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 mt-1" onClick={addCenter}>
                    <Plus size={13} /> Add Center
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Supervisor Preferences ── */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-header py-3 d-flex align-items-center gap-2" style={{ background: '#7c3aed', color: '#fff', borderRadius: '1rem 1rem 0 0' }}>
                <User size={18} />
                <h6 className="mb-0 fw-bold">Supervisor Preferences</h6>
                <span className="badge bg-white text-purple ms-auto" style={{ color: '#7c3aed' }}>{supPrefs.filter(Boolean).length} / {MAX_PREFS}</span>
              </div>
              <div className="card-body p-3">
                <p className="text-muted small mb-3">Rank your preferred Supervisors (1 = most preferred)</p>

                {supPrefs.map((supId, idx) => (
                  <div key={idx} className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge rounded-pill" style={{ background: '#7c3aed', minWidth: 26, fontSize: 12 }}>{idx + 1}</span>
                    <select
                      className="form-select form-select-sm flex-grow-1"
                      value={supId}
                      onChange={e => setSupAt(idx, e.target.value)}
                      disabled={isSubmitted || status !== 'open'}
                    >
                      <option value="">Select Supervisor</option>
                      {allSupervisors.map(s => (
                        <option key={s.id} value={s.id}
                          disabled={supPrefs.some((v, i) => i !== idx && v === String(s.id))}>
                          {s.supervisor_name}{s.designation ? ` (${s.designation})` : ''}{s.center_name ? ` — ${s.center_name}` : ''}
                        </option>
                      ))}
                    </select>
                    {!isSubmitted && status === 'open' && supPrefs.length > 1 && (
                      <button className="btn btn-sm btn-outline-danger border-0 p-1" onClick={() => removeSup(idx)} title="Remove">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {!isSubmitted && status === 'open' && supPrefs.length < MAX_PREFS && (
                  <button className="btn btn-sm d-flex align-items-center gap-1 mt-1" style={{ color: '#7c3aed', border: '1px solid #7c3aed', background: 'transparent' }} onClick={addSup}>
                    <Plus size={13} /> Add Supervisor
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {!isSubmitted && status === 'open' && (
          <div className="d-flex gap-2 mt-4">
            <button
              className="btn btn-outline-secondary px-4"
              onClick={handleSave}
              disabled={saving || submitting}
            >
              {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Saving…</> : 'Save Draft'}
            </button>
            <button
              className="btn btn-success px-5 d-flex align-items-center gap-2"
              onClick={handleSubmit}
              disabled={saving || submitting}
            >
              {submitting
                ? <><span className="spinner-border spinner-border-sm" /> Submitting…</>
                : <><Send size={15} /> Submit Application</>
              }
            </button>
          </div>
        )}

        {/* Read-only submitted view */}
        {isSubmitted && (
          <div className="row g-4 mt-2">
            {existingApp?.center_preferences?.length > 0 && (
              <div className="col-md-6">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-header py-2 fw-semibold" style={{ fontSize: 13, background: '#eff6ff', color: '#1d4ed8' }}>
                    Submitted Center Preferences
                  </div>
                  <div className="card-body p-0">
                    <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                      <tbody>
                        {existingApp.center_preferences.map((p, i) => (
                          <tr key={i}>
                            <td className="ps-3 py-2" style={{ width: 40 }}>
                              <span className="badge bg-primary rounded-pill">#{p.preference_order}</span>
                            </td>
                            <td className="fw-semibold">{p.center_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {existingApp?.supervisor_preferences?.length > 0 && (
              <div className="col-md-6">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-header py-2 fw-semibold" style={{ fontSize: 13, background: '#f5f3ff', color: '#7c3aed' }}>
                    Submitted Supervisor Preferences
                  </div>
                  <div className="card-body p-0">
                    <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                      <tbody>
                        {existingApp.supervisor_preferences.map((p, i) => (
                          <tr key={i}>
                            <td className="ps-3 py-2" style={{ width: 40 }}>
                              <span className="badge rounded-pill" style={{ background: '#7c3aed' }}>#{p.preference_order}</span>
                            </td>
                            <td>
                              <div className="fw-semibold">{p.supervisor_name}</div>
                              {p.designation && <div className="text-muted" style={{ fontSize: 11 }}>{p.designation}</div>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default CounsellingApplication;
