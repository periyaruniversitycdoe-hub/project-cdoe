import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import Header from '../components/Header';
import { GraduationCap, Plus, Trash2, Send, CheckCircle, Lock, Clock, Building2, User } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';
const MAX_PREFS = 5;

const emptyPref = () => ({ center_id: '', supervisor_id: '', supervisors: [], loadingSups: false });

const CounsellingApplication = () => {
  const { token } = useAuthStore();
  const navigate = useNavigate();

  const [settings, setSettings]           = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [studentDept, setStudentDept]     = useState(null);
  const [centers, setCenters]             = useState([]);

  // Paired preferences: each row = { center_id, supervisor_id, supervisors[], loadingSups }
  const [prefs, setPrefs] = useState([emptyPref()]);

  const [existingApp, setExistingApp] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  const dateStatus = useCallback(() => {
    if (!settings) return 'loading';
    const today = new Date().toISOString().split('T')[0];
    if (today < settings.start_date) return 'not_started';
    if (today > settings.end_date)   return 'closed';
    return 'open';
  }, [settings]);

  const status = dateStatus();

  const fetchSupervisors = async (centerId, dept) => {
    if (!centerId) return [];
    try {
      const params = new URLSearchParams({ center_id: centerId });
      if (dept) params.set('department', dept);
      const res = await axios.get(`${API}/counselling/research-supervisors?${params}`);
      return res.data.data || [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // Eligibility gate
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

      // Counselling settings
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

      // Student's registered department
      let dept = null;
      try {
        const dr = await axios.get(`${API}/counselling/student-department`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        dept = dr.data.department || null;
        setStudentDept(dept);
      } catch {}

      // Department-filtered centres
      try {
        const url = dept
          ? `${API}/counselling/research-centers?department=${encodeURIComponent(dept)}`
          : `${API}/counselling/research-centers`;
        const cr = await axios.get(url);
        setCenters(cr.data.data || []);
      } catch {}

      // Existing application — populate paired preferences
      try {
        const ar = await axios.get(`${API}/counselling/my-application`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (ar.data.data) {
          const app = ar.data.data;
          setExistingApp(app);
          const cp = app.center_preferences || [];
          const sp = app.supervisor_preferences || [];
          if (cp.length > 0 || sp.length > 0) {
            const maxLen = Math.max(cp.length, sp.length);
            const loaded = [];
            for (let i = 0; i < maxLen; i++) {
              const centerId    = cp[i] ? String(cp[i].research_center_id) : '';
              const supervisorId = sp[i] ? String(sp[i].supervisor_id) : '';
              const sups = centerId ? await fetchSupervisors(centerId, dept) : [];
              loaded.push({ center_id: centerId, supervisor_id: supervisorId, supervisors: sups, loadingSups: false });
            }
            setPrefs(loaded);
          }
        }
      } catch {}

      setLoading(false);
    };
    init();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSubmitted = existingApp?.status === 'Submitted';

  const handleCenterChange = async (idx, centerId) => {
    setPrefs(p => {
      const n = [...p];
      n[idx] = { ...n[idx], center_id: centerId, supervisor_id: '', supervisors: [], loadingSups: !!centerId };
      return n;
    });
    if (!centerId) return;
    const sups = await fetchSupervisors(centerId, studentDept);
    setPrefs(p => {
      const n = [...p];
      n[idx] = { ...n[idx], supervisors: sups, loadingSups: false };
      return n;
    });
  };

  const setSupAt = (idx, val) => setPrefs(p => {
    const n = [...p];
    n[idx] = { ...n[idx], supervisor_id: val };
    return n;
  });

  const addPref = () => {
    if (prefs.length < MAX_PREFS) setPrefs(p => [...p, emptyPref()]);
  };

  const removePref = (idx) => {
    if (prefs.length > 1) setPrefs(p => p.filter((_, i) => i !== idx));
  };

  const completedPrefs = () => prefs.filter(p => p.center_id && p.supervisor_id);

  const validate = () => {
    const filled = completedPrefs();
    if (filled.length === 0) {
      toast.error('Select at least one complete preference (Research Centre + Supervisor)');
      return false;
    }
    const centerIds = filled.map(p => p.center_id);
    const supIds    = filled.map(p => p.supervisor_id);
    if (new Set(centerIds).size !== centerIds.length) {
      toast.error('Duplicate Research Centre selections are not allowed');
      return false;
    }
    if (new Set(supIds).size !== supIds.length) {
      toast.error('Duplicate Supervisor selections are not allowed');
      return false;
    }
    return true;
  };

  const buildPayload = () => {
    const filled = completedPrefs();
    return {
      center_preferences:     filled.map(p => Number(p.center_id)),
      supervisor_preferences: filled.map(p => Number(p.supervisor_id)),
    };
  };

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
        <div className="card border-0 shadow-sm rounded-4 mb-4"
          style={{ background: 'linear-gradient(135deg, #32b5c0, #0d6efd)' }}>
          <div className="card-body p-4 text-white">
            <div className="d-flex align-items-center gap-3">
              <GraduationCap size={36} color="#fff" />
              <div>
                <h4 className="fw-bold mb-0">Counselling Application</h4>
                <p className="mb-0 opacity-75 small">
                  {studentDept && <><strong>Department:</strong> {studentDept} &nbsp;&middot;&nbsp;</>}
                  Select up to {MAX_PREFS} Research Centre + Supervisor preferences.
                  &nbsp;Window: {settings?.start_date} – {settings?.end_date}
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

        {/* ── Preferences form (editable) ── */}
        {!isSubmitted && (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header py-3 d-flex align-items-center gap-2"
              style={{ background: '#0d6efd', color: '#fff', borderRadius: '1rem 1rem 0 0' }}>
              <GraduationCap size={18} />
              <h6 className="mb-0 fw-bold">Research Preferences</h6>
              <span className="badge bg-white text-primary ms-auto">
                {completedPrefs().length} / {MAX_PREFS} complete
              </span>
            </div>
            <div className="card-body p-3">
              {studentDept && (
                <div className="alert alert-info py-2 px-3 mb-3 d-flex align-items-center gap-2"
                  style={{ fontSize: 13 }}>
                  <Building2 size={14} />
                  Showing Research Centres and Supervisors for your department:&nbsp;
                  <strong>{studentDept}</strong>
                </div>
              )}
              <p className="text-muted small mb-3">
                For each preference, select a Research Centre first — then choose a Supervisor from that centre.
                Only complete rows (Centre + Supervisor) will be saved.
              </p>

              <div className="table-responsive">
                <table className="table align-middle mb-2" style={{ fontSize: 13 }}>
                  <thead>
                    <tr className="table-light">
                      <th style={{ width: 36 }}>#</th>
                      <th><Building2 size={13} className="me-1 text-primary" />Research Centre</th>
                      <th><User size={13} className="me-1" style={{ color: '#7c3aed' }} />Supervisor</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prefs.map((pref, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className="badge rounded-pill bg-primary" style={{ minWidth: 26 }}>{idx + 1}</span>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={pref.center_id}
                            onChange={e => handleCenterChange(idx, e.target.value)}
                            disabled={isSubmitted || status !== 'open'}
                          >
                            <option value="">— Select Centre —</option>
                            {centers.map(c => (
                              <option
                                key={c.id} value={c.id}
                                disabled={prefs.some((v, i) => i !== idx && v.center_id === String(c.id))}
                              >
                                {c.center_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {pref.loadingSups ? (
                            <span className="spinner-border spinner-border-sm text-primary" />
                          ) : (
                            <select
                              className="form-select form-select-sm"
                              value={pref.supervisor_id}
                              onChange={e => setSupAt(idx, e.target.value)}
                              disabled={!pref.center_id || isSubmitted || status !== 'open'}
                            >
                              <option value="">
                                {pref.center_id
                                  ? (pref.supervisors.length === 0
                                    ? '— No supervisors available —'
                                    : '— Select Supervisor —')
                                  : '— Select Centre first —'}
                              </option>
                              {pref.supervisors.map(s => (
                                <option
                                  key={s.id} value={s.id}
                                  disabled={prefs.some((v, i) => i !== idx && v.supervisor_id === String(s.id))}
                                >
                                  {s.supervisor_name}{s.designation ? ` (${s.designation})` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>
                          {!isSubmitted && status === 'open' && prefs.length > 1 && (
                            <button
                              className="btn btn-sm btn-outline-danger border-0 p-1"
                              onClick={() => removePref(idx)}
                              title="Remove preference"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isSubmitted && status === 'open' && prefs.length < MAX_PREFS && (
                <button
                  className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 mt-1"
                  onClick={addPref}
                >
                  <Plus size={13} /> Add Preference
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!isSubmitted && status === 'open' && (
          <div className="d-flex gap-2 mt-4">
            <button
              className="btn btn-outline-secondary px-4"
              onClick={handleSave}
              disabled={saving || submitting}
            >
              {saving
                ? <><span className="spinner-border spinner-border-sm me-1" />Saving…</>
                : 'Save Draft'}
            </button>
            <button
              className="btn btn-success px-5 d-flex align-items-center gap-2"
              onClick={handleSubmit}
              disabled={saving || submitting}
            >
              {submitting
                ? <><span className="spinner-border spinner-border-sm" />Submitting…</>
                : <><Send size={15} />Submit Application</>}
            </button>
          </div>
        )}

        {/* ── Submitted read-only view ── */}
        {isSubmitted && existingApp?.center_preferences?.length > 0 && (
          <div className="card border-0 shadow-sm rounded-4 mt-2">
            <div className="card-header py-2 fw-semibold"
              style={{ fontSize: 13, background: '#eff6ff', color: '#1d4ed8', borderRadius: '1rem 1rem 0 0' }}>
              Submitted Research Preferences
            </div>
            <div className="card-body p-0">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                <thead>
                  <tr className="table-light">
                    <th style={{ width: 40 }}>#</th>
                    <th><Building2 size={13} className="me-1" />Research Centre</th>
                    <th><User size={13} className="me-1" />Supervisor</th>
                  </tr>
                </thead>
                <tbody>
                  {existingApp.center_preferences.map((cp, i) => {
                    const sp = existingApp.supervisor_preferences?.[i];
                    return (
                      <tr key={i}>
                        <td className="ps-3 py-2">
                          <span className="badge bg-primary rounded-pill">#{cp.preference_order}</span>
                        </td>
                        <td className="fw-semibold">{cp.center_name}</td>
                        <td>
                          {sp ? (
                            <>
                              <span className="fw-semibold">{sp.supervisor_name}</span>
                              {sp.designation && (
                                <span className="text-muted ms-1" style={{ fontSize: 11 }}>({sp.designation})</span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CounsellingApplication;
