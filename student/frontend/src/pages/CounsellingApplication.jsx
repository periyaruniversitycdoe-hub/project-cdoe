import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import Header from '../components/Header';
import { GraduationCap, Plus, Trash2, Send, CheckCircle, Lock, Clock } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const CounsellingApplication = () => {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();

  const [settings, setSettings]           = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [centers, setCenters]             = useState([]);
  const [supervisorsMap, setSupervisorsMap] = useState({});
  const [loadingSups, setLoadingSups]     = useState({});
  const [choices, setChoices]             = useState([{ research_center_id: '', supervisor_id: '' }]);
  const [existingApp, setExistingApp]     = useState(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  // Check date window validity
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

      // ── CounsellingAccessEngine: Unified Enterprise Gate ───────────────────
      try {
        const er = await axios.get(`${API}/student/eligibility`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const eligibility = er.data.data || {};

        // Master check from centralized backend engine
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
      } catch (err) {
        toast.error('Security Gate Error: Unable to verify eligibility.');
        navigate('/dashboard');
        return;
      }

      try {
        // Load counselling settings for this user's session
        const sr = await axios.get(`${API}/counselling/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSettings(sr.data.data);
      } catch (err) {
        setSettingsError(err.response?.data?.message || 'Counselling is not available for your session.');
        setLoading(false);
        return;
      }

      // Load centers
      try {
        const cr = await axios.get(`${API}/counselling/research-centers`);
        setCenters(cr.data.data || []);
      } catch {}

      // Load existing application
      try {
        const ar = await axios.get(`${API}/counselling/my-application`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (ar.data.data) {
          setExistingApp(ar.data.data);
          if (ar.data.data.choices && ar.data.data.choices.length > 0) {
            setChoices(ar.data.data.choices.map(c => ({
              research_center_id: String(c.research_center_id),
              supervisor_id:      String(c.supervisor_id),
            })));
          }
        }
      } catch {}

      setLoading(false);
    };
    init();
  }, [token]);

  // Load supervisors for a given center
  const loadSupervisors = async (centerId) => {
    if (!centerId || supervisorsMap[centerId]) return;
    setLoadingSups(p => ({ ...p, [centerId]: true }));
    try {
      const res = await axios.get(`${API}/counselling/research-supervisors?center_id=${centerId}`);
      setSupervisorsMap(p => ({ ...p, [centerId]: res.data.data || [] }));
    } catch {}
    finally { setLoadingSups(p => ({ ...p, [centerId]: false })); }
  };

  const handleCenterChange = (idx, centerId) => {
    const updated = [...choices];
    updated[idx] = { research_center_id: centerId, supervisor_id: '' };
    setChoices(updated);
    if (centerId) loadSupervisors(centerId);
  };

  const handleSupervisorChange = (idx, supervisorId) => {
    const updated = [...choices];
    updated[idx] = { ...updated[idx], supervisor_id: supervisorId };
    setChoices(updated);
  };

  const addChoice = () => {
    if (!settings) return;
    if (choices.length >= settings.max_research_choices) {
      toast.error(`Maximum ${settings.max_research_choices} research preferences allowed`);
      return;
    }
    setChoices(p => [...p, { research_center_id: '', supervisor_id: '' }]);
  };

  const removeChoice = (idx) => {
    if (choices.length <= 1) { toast.error('At least one preference is required'); return; }
    setChoices(p => p.filter((_, i) => i !== idx));
  };

  const validate = () => {
    for (let i = 0; i < choices.length; i++) {
      if (!choices[i].research_center_id) { toast.error(`Select a Research Center for Preference ${i + 1}`); return false; }
      if (!choices[i].supervisor_id)      { toast.error(`Select a Supervisor for Preference ${i + 1}`); return false; }
    }
    const supIds = choices.map(c => c.supervisor_id);
    if (new Set(supIds).size !== supIds.length) { toast.error('Duplicate supervisor selections are not allowed'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/counselling/save`, { choices }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Research preferences saved as draft');
      // Reload
      const ar = await axios.get(`${API}/counselling/my-application`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      // Save first, then submit
      await axios.post(`${API}/counselling/save`, { choices }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await axios.post(`${API}/counselling/submit`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Counselling application submitted!');
      // Reload
      const ar = await axios.get(`${API}/counselling/my-application`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (ar.data.data) setExistingApp(ar.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const isSubmitted = existingApp?.status === 'Submitted';

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
      <div className="container mt-4" style={{ maxWidth: 860 }}>

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
                  Select your research preferences. Dates: {settings?.start_date} to {settings?.end_date}.
                  Maximum choices: {settings?.max_research_choices}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Date status banners */}
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

        {/* Research Preferences Form */}
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff', borderRadius: '1rem 1rem 0 0' }}>
            <h5 className="mb-0 fw-bold">Research Preferences</h5>
          </div>
          <div className="card-body p-4">

            {choices.map((choice, idx) => {
              const centerSups = supervisorsMap[choice.research_center_id] || [];
              const isLoading  = loadingSups[choice.research_center_id];
              return (
                <div key={idx} className="card border rounded-3 mb-3 p-3 bg-light">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span className="fw-bold text-primary" style={{ fontSize: 14 }}>
                      Preference {idx + 1}
                    </span>
                    {!isSubmitted && choices.length > 1 && (
                      <button className="btn btn-sm btn-outline-danger border-0" onClick={() => removeChoice(idx)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold" style={{ fontSize: 13 }}>
                        Research Center <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={choice.research_center_id}
                        onChange={e => handleCenterChange(idx, e.target.value)}
                        disabled={isSubmitted || status !== 'open'}
                      >
                        <option value="">Select Research Center</option>
                        {centers.map(c => (
                          <option key={c.id} value={c.id}>{c.center_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold" style={{ fontSize: 13 }}>
                        Research Supervisor <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={choice.supervisor_id}
                        onChange={e => handleSupervisorChange(idx, e.target.value)}
                        disabled={isSubmitted || status !== 'open' || !choice.research_center_id}
                      >
                        <option value="">
                          {isLoading ? 'Loading…' : choice.research_center_id ? 'Select Supervisor' : 'Select center first'}
                        </option>
                        {centerSups.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.supervisor_name}{s.designation ? ` (${s.designation})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add preference */}
            {!isSubmitted && status === 'open' && choices.length < (settings?.max_research_choices || 3) && (
              <button
                className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 mb-3"
                onClick={addChoice}
              >
                <Plus size={14} /> Add Research Preference
              </button>
            )}

            {/* Max reached hint */}
            {!isSubmitted && status === 'open' && choices.length >= (settings?.max_research_choices || 3) && (
              <p className="text-muted small mb-3">
                Maximum {settings?.max_research_choices} preferences reached.
              </p>
            )}

            {/* Action buttons */}
            {!isSubmitted && status === 'open' && (
              <div className="d-flex gap-2 mt-2">
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

          </div>
        </div>

        {/* Submitted view — show submitted choices read-only */}
        {isSubmitted && existingApp?.choices?.length > 0 && (
          <div className="card border-0 shadow-sm rounded-4 mt-4">
            <div className="card-header py-2 fw-semibold" style={{ fontSize: 13, background: '#f8f9fa' }}>
              Submitted Preferences
            </div>
            <div className="card-body p-0">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th className="ps-3 py-2">Preference</th>
                    <th className="py-2">Research Center</th>
                    <th className="py-2">Supervisor</th>
                  </tr>
                </thead>
                <tbody>
                  {existingApp.choices.map(c => (
                    <tr key={c.id}>
                      <td className="ps-3">
                        <span className="badge bg-primary">#{c.preference_order}</span>
                      </td>
                      <td className="fw-semibold">{c.center_name}</td>
                      <td>{c.supervisor_name}{c.designation ? ` — ${c.designation}` : ''}</td>
                    </tr>
                  ))}
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
