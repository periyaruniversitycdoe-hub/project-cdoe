import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const API    = (import.meta.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002') + '/api';
const getHdr = (token) => ({ Authorization: `Bearer ${token}` });

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_META = {
  Forwarded_Supervisor:           { label: 'Pending Interview',    color: '#ea580c', bg: '#ffedd5' },
  Supervisor_Interview_Completed: { label: 'Interview Done',       color: '#059669', bg: '#d1fae5' },
  Supervisor_Evaluated:           { label: 'Evaluated',            color: '#059669', bg: '#d1fae5' },
  Final_Score_Calculated:         { label: 'Score Calculated',     color: '#0369a1', bg: '#e0f2fe' },
  Admin_Review:                   { label: 'Admin Review',         color: '#d97706', bg: '#fff7ed' },
  Approved:                       { label: 'Approved',             color: '#15803d', bg: '#bbf7d0' },
  Waitlisted:                     { label: 'Waitlisted',           color: '#b45309', bg: '#fde68a' },
  Rejected:                       { label: 'Rejected',             color: '#dc2626', bg: '#fee2e2' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{
      background: m.bg, color: m.color,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      border: `1px solid ${m.color}33`, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, marginTop: 2 }}>{value || '—'}</div>
    </div>
  );
}

function SectionHead({ title }) {
  return (
    <div style={{
      fontWeight: 700, fontSize: 13, color: '#312e81',
      padding: '10px 0 8px', borderBottom: '2px solid #e0e7ff',
      marginBottom: 14, marginTop: 8,
    }}>{title}</div>
  );
}

// ── Score preview helper ──────────────────────────────────────────────────────
function calcFinalScore(academicMark, entranceMark, interviewMark) {
  const a = parseFloat(academicMark) || 0;
  const e = parseFloat(entranceMark) || 0;
  const i = parseFloat(interviewMark) || 0;
  return a + (e + i) * 50 / 100;
}

const DEFAULT_EVAL = { interview_mark: '', interview_remarks: '', recommendation: '' };

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function PermissionAssignedApplications() {
  const { token } = useAuth();
  const [apps,    setApps]    = useState([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewApp,    setViewApp]    = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [detLoading, setDetLoading] = useState(false);

  // Evaluate state
  const [showEval, setShowEval] = useState(false);
  const [evalForm, setEvalForm] = useState({ ...DEFAULT_EVAL });
  const [saving,   setSaving]   = useState(false);

  // Filter
  const [statusFilter, setStatusFilter] = useState('');
  const [search,       setSearch]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('workflow_status', statusFilter);
      if (search)       params.set('search', search);
      const res = await axios.get(`${API}/permission-applications?${params}`, { headers: getHdr(token) });
      setApps(res.data.data || []);
    } catch { toast.error('Failed to load assigned applications'); }
    finally { setLoading(false); }
  }, [token, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id) => {
    setDetLoading(true);
    try {
      const res = await axios.get(`${API}/permission-applications/${id}`, { headers: getHdr(token) });
      const d = res.data.data;
      setDetail(d);
      if (d.sup_eval_id) {
        setEvalForm({
          interview_mark:    d.sup_eval_interview_mark ?? '',
          interview_remarks: d.sup_eval_remarks        ?? '',
          recommendation:    d.supervisor_recommendation ?? '',
        });
      } else {
        setEvalForm({ ...DEFAULT_EVAL });
      }
    } catch { toast.error('Failed to load application details'); }
    finally { setDetLoading(false); }
  };

  const handleView = (app) => {
    setViewApp(app);
    setShowEval(false);
    loadDetail(app.id);
  };

  const handleEvalChange = (k, v) => setEvalForm(f => ({ ...f, [k]: v }));

  const submitEval = async () => {
    const im = Number(evalForm.interview_mark);
    if (evalForm.interview_mark === '' || isNaN(im) || im < 0 || im > 30) {
      return toast.error('Interview Mark must be 0–30');
    }
    if (!evalForm.recommendation) return toast.error('Select a recommendation');

    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/permission-applications/${viewApp.id}/evaluate`,
        {
          interview_mark:    im,
          interview_remarks: evalForm.interview_remarks,
          recommendation:    evalForm.recommendation,
        },
        { headers: getHdr(token) }
      );
      toast.success(`Evaluation submitted. Final Score: ${res.data.final_score?.toFixed(2) ?? '—'}`);
      setViewApp(null);
      setDetail(null);
      setShowEval(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally { setSaving(false); }
  };

  // Derived: live final score preview
  const previewScore = detail
    ? calcFinalScore(detail.academic_mark, detail.entrance_mark, evalForm.interview_mark)
    : 0;
  const canEvaluate = viewApp &&
    ['Forwarded_Supervisor', 'Supervisor_Interview_Completed', 'Supervisor_Evaluated'].includes(viewApp.workflow_status);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#4338ca,#312e81)',
        padding: '20px 24px', borderRadius: 14, marginBottom: 24, color: '#fff',
      }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Assigned Permission Applications</h2>
        <p style={{ margin: '4px 0 0', opacity: 0.75, fontSize: 13 }}>
          Applications forwarded to you for interview evaluation
        </p>
      </div>

      {/* Filters */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
        padding: '14px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <input
          placeholder="Search by name or app no…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none' }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={load} style={{
          padding: '9px 18px', background: '#4338ca', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>Refresh</button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
        ) : apps.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            No applications assigned to you for interview evaluation yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#eef2ff', borderBottom: '2px solid #c7d2fe' }}>
                <tr>
                  {['App No', 'Candidate', 'Category', 'Subject', 'Forwarded On', 'Center Score', 'Final Score', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#312e81', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apps.map((app, i) => (
                  <tr key={app.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#4338ca' }}>{app.app_no || `#${app.id}`}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{app.full_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{app.user_email}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>{app.category || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>{app.subject || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {app.forwarded_supervisor_at ? new Date(app.forwarded_supervisor_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#059669' }}>
                      {app.center_total != null ? `${app.center_total} / 100` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#4338ca' }}>
                      {app.final_score != null ? Number(app.final_score).toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}><StatusBadge status={app.workflow_status} /></td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => handleView(app)} style={{
                        padding: '7px 16px', background: '#4338ca', color: '#fff',
                        border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      }}>
                        {app.workflow_status === 'Forwarded_Supervisor' ? 'Evaluate' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail / Evaluation panel ── */}
      {viewApp && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        }} onClick={e => { if (e.target === e.currentTarget) { setViewApp(null); setDetail(null); } }}>
          <div style={{
            width: '100%', maxWidth: 760, height: '100vh',
            background: '#fff', overflowY: 'auto', display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.2)',
          }}>
            {/* Panel header */}
            <div style={{
              padding: '18px 24px', background: 'linear-gradient(135deg,#4338ca,#312e81)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{viewApp.full_name}</h3>
                <p style={{ margin: '2px 0 0', opacity: 0.75, fontSize: 12 }}>{viewApp.app_no || `App #${viewApp.id}`}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {canEvaluate && (
                  <button onClick={() => setShowEval(e => !e)} style={{
                    padding: '8px 18px', background: showEval ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.4)', color: '#fff',
                    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  }}>
                    {showEval ? 'View Application' : 'Submit Evaluation'}
                  </button>
                )}
                <button onClick={() => { setViewApp(null); setDetail(null); setShowEval(false); }} style={{
                  background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                  borderRadius: 8, cursor: 'pointer', padding: '8px 12px', fontSize: 18,
                }}>✕</button>
              </div>
            </div>

            <div style={{ padding: 24, flex: 1 }}>
              {detLoading ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Loading details…</div>
              ) : showEval ? (
                /* ── Evaluation Form ── */
                <div>
                  {/* Read-only marks */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700, marginBottom: 4 }}>ACADEMIC MARK</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: '#1d4ed8' }}>
                        {detail?.academic_mark != null ? Number(detail.academic_mark).toFixed(1) : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>/ 50</div>
                    </div>
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700, marginBottom: 4 }}>ENTRANCE MARK</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: '#0369a1' }}>
                        {detail?.entrance_mark != null ? Number(detail.entrance_mark).toFixed(1) : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>/ 70</div>
                    </div>
                  </div>

                  {/* Interview mark input */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Interview Mark * <span style={{ fontWeight: 400, color: '#9ca3af' }}>(0 – 30)</span>
                    </label>
                    <input
                      type="number" min={0} max={30} step={0.5}
                      value={evalForm.interview_mark}
                      onChange={e => handleEvalChange('interview_mark', e.target.value)}
                      placeholder="Enter 0–30"
                      style={{
                        width: 120, padding: '10px 14px', border: '1px solid #d1d5db',
                        borderRadius: 8, fontSize: 16, fontWeight: 700, textAlign: 'center',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Live final score preview */}
                  <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#312e81', marginBottom: 4 }}>
                      Calculated Final Score Preview
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: '#4338ca' }}>
                      {previewScore.toFixed(2)}
                      <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}> / 100</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      = {detail?.academic_mark ?? 0} (Academic) + ({detail?.entrance_mark ?? 0} + {evalForm.interview_mark || 0}) × 50/100
                    </div>
                    <div style={{ height: 8, background: '#c7d2fe', borderRadius: 4, marginTop: 10 }}>
                      <div style={{ height: '100%', background: '#4338ca', borderRadius: 4, width: `${Math.min(100, previewScore)}%`, transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 8 }}>Recommendation *</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {['Recommended', 'Waitlisted', 'Rejected'].map(r => {
                        const colors = { Recommended: ['#15803d', '#dcfce7'], Waitlisted: ['#b45309', '#fef3c7'], Rejected: ['#dc2626', '#fee2e2'] };
                        const [c, bg] = colors[r];
                        const sel = evalForm.recommendation === r;
                        return (
                          <button key={r} onClick={() => handleEvalChange('recommendation', r)} style={{
                            flex: 1, padding: '10px 8px',
                            border: `2px solid ${sel ? c : '#e5e7eb'}`,
                            borderRadius: 10, background: sel ? bg : '#f9fafb',
                            cursor: 'pointer', fontWeight: 700, fontSize: 12,
                            color: sel ? c : '#6b7280',
                          }}>{r}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interview remarks */}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}>Interview Remarks</label>
                    <textarea
                      rows={3} value={evalForm.interview_remarks}
                      onChange={e => handleEvalChange('interview_remarks', e.target.value)}
                      placeholder="Optional interview observations…"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  <button onClick={submitEval} disabled={saving} style={{
                    width: '100%', padding: '14px', background: '#4338ca', color: '#fff',
                    border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 800,
                    opacity: saving ? 0.7 : 1,
                  }}>
                    {saving ? 'Submitting…' : 'Submit Interview Evaluation'}
                  </button>
                </div>
              ) : detail ? (
                /* ── Application Detail ── */
                <div>
                  {/* Score summary */}
                  {detail.academic_mark != null && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 10, marginBottom: 20 }}>
                      {[
                        { label: 'Academic',  value: detail.academic_mark,  max: 50,  color: '#1d4ed8' },
                        { label: 'Entrance',  value: detail.entrance_mark,  max: 70,  color: '#0369a1' },
                        { label: 'Interview', value: detail.interview_mark, max: 30,  color: '#7c3aed' },
                        { label: 'Final',     value: detail.final_score,    max: 100, color: '#15803d' },
                      ].map(({ label, value, max, color }) => (
                        <div key={label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color }}>{value != null ? Number(value).toFixed(1) : '—'}</div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{label} / {max}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Center eval summary */}
                  {detail.center_total != null && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
                      <div style={{ fontSize: 12, color: '#15803d', fontWeight: 700, marginBottom: 4 }}>RESEARCH CENTRE EVALUATION</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: '#15803d' }}>{detail.center_total} / 100</span>
                        <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>
                          {detail.center_recommendation}
                        </span>
                      </div>
                      {detail.center_remarks && (
                        <p style={{ fontSize: 12, color: '#374151', marginTop: 8, marginBottom: 0 }}>{detail.center_remarks}</p>
                      )}
                    </div>
                  )}

                  {/* Previous evaluation */}
                  {detail.sup_eval_id && (
                    <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                      <div style={{ fontSize: 12, color: '#4338ca', fontWeight: 700, marginBottom: 8 }}>YOUR PREVIOUS EVALUATION</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ padding: '4px 14px', borderRadius: 20, background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 13 }}>
                          {detail.supervisor_recommendation}
                        </span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: '#4338ca' }}>
                          Interview: {detail.sup_eval_interview_mark != null ? Number(detail.sup_eval_interview_mark).toFixed(1) : '—'} / 30
                        </span>
                      </div>
                      {detail.sup_eval_remarks && <p style={{ fontSize: 13, color: '#374151', margin: '8px 0 0' }}>{detail.sup_eval_remarks}</p>}
                    </div>
                  )}

                  <SectionHead title="Personal Details" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '0 20px' }}>
                    <Field label="Full Name"    value={detail.full_name} />
                    <Field label="DOB"          value={detail.dob ? new Date(detail.dob).toLocaleDateString('en-IN') : null} />
                    <Field label="Gender"       value={detail.gender} />
                    <Field label="Community"    value={detail.community} />
                    <Field label="Category"     value={detail.category} />
                    <Field label="Mobile"       value={detail.mobile} />
                    <Field label="Email"        value={detail.email || detail.user_email} />
                    <Field label="District"     value={detail.district} />
                  </div>

                  <SectionHead title="Research Details" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '0 20px' }}>
                    <Field label="Subject"  value={detail.subject} />
                    <Field label="Category" value={detail.category} />
                  </div>

                  {detail.preferences?.length > 0 && (
                    <>
                      <SectionHead title="Student Preferences" />
                      {detail.preferences.map((p, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', background: '#eef2ff',
                          border: '1px solid #c7d2fe', borderRadius: 8, marginBottom: 8,
                        }}>
                          <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#4338ca', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{p.preference_order}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{p.center_name}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{p.supervisor_name} — {p.designation}</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {detail.school_education?.length > 0 && (
                    <>
                      <SectionHead title="School Education" />
                      <EduTable rows={detail.school_education} cols={['level','institution_name','passing_year','percentage']} labels={['Level','Institution','Year','%']} />
                    </>
                  )}

                  {detail.higher_education?.length > 0 && (
                    <>
                      <SectionHead title="Higher Education" />
                      <EduTable rows={detail.higher_education} cols={['degree_name','institution_name','university_name','passing_year','score_value']} labels={['Degree','Institution','University','Year','Score']} />
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small table helper ─────────────────────────────────────────────────────────
function EduTable({ rows, cols, labels }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#eef2ff' }}>
            {labels.map((l, i) => (
              <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#312e81', borderBottom: '1px solid #c7d2fe' }}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {cols.map(c => {
                if (c === 'passing_year') {
                  const isUgPgInt = r.level === 'UG' || r.level === 'PG' || r.level === 'Integrated';
                  const hasStartEnd = r.start_year || r.completion_year;
                  return (
                    <td key={c} style={{ padding: '8px 10px', color: '#374151' }}>
                      {isUgPgInt ? (
                        <>
                          <div>{r.passing_month || '—'}</div>
                          {hasStartEnd && (
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                              {r.start_year ? `Start: ${r.start_year}` : ''} {r.completion_year ? `| End: ${r.completion_year}` : ''}
                            </div>
                          )}
                        </>
                      ) : (
                        <div>{r.passing_month ? `${r.passing_month} ` : ''}{r.passing_year ? `Pass: ${r.passing_year}` : '—'}</div>
                      )}
                    </td>
                  );
                }
                return (
                  <td key={c} style={{ padding: '8px 10px', color: '#374151' }}>{r[c] ?? '—'}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
