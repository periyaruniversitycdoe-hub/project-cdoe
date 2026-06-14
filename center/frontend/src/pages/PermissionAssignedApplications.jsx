import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const API    = (import.meta.env.VITE_CENTER_API_URL || 'http://localhost:5003') + '/api';
const getHdr = (token) => ({ Authorization: `Bearer ${token}` });

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_META = {
  Forwarded_Center:     { label: 'Pending Evaluation', color: '#d97706', bg: '#fef3c7' },
  Center_Evaluated:     { label: 'Evaluated',          color: '#059669', bg: '#d1fae5' },
  Forwarded_Supervisor: { label: 'At Supervisor',      color: '#7c3aed', bg: '#ede9fe' },
  Supervisor_Evaluated: { label: 'Sup. Evaluated',     color: '#0891b2', bg: '#e0f2fe' },
  Approved:             { label: 'Approved',            color: '#15803d', bg: '#bbf7d0' },
  Waitlisted:           { label: 'Waitlisted',          color: '#b45309', bg: '#fde68a' },
  Rejected:             { label: 'Rejected',            color: '#dc2626', bg: '#fee2e2' },
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

function ScoreBar({ value, max, color = '#0891b2' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
        <span style={{ color: '#374151' }}></span>
        <span style={{ fontWeight: 700, color: '#111827' }}>{value} / {max}</span>
      </div>
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4 }}>
        <div style={{ height: '100%', background: color, borderRadius: 4, width: `${pct}%`, transition: 'width 0.4s' }} />
      </div>
    </div>
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
      fontWeight: 700, fontSize: 13, color: '#0c4a6e',
      padding: '10px 0 8px', borderBottom: '2px solid #e0f2fe',
      marginBottom: 14, marginTop: 8,
    }}>{title}</div>
  );
}

// ── Evaluation form ───────────────────────────────────────────────────────────
const CRITERIA = [
  { key: 'academic_record',       label: 'Academic Record',       max: 20 },
  { key: 'research_aptitude',     label: 'Research Aptitude',     max: 20 },
  { key: 'subject_relevance',     label: 'Subject Relevance',     max: 20 },
  { key: 'research_proposal',     label: 'Research Proposal',     max: 20 },
  { key: 'interview_performance', label: 'Interview Performance', max: 20 },
];

const DEFAULT_EVAL = {
  academic_record: '', research_aptitude: '', subject_relevance: '',
  research_proposal: '', interview_performance: '', recommendation: '', remarks: '',
};

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function PermissionAssignedApplications() {
  const { token } = useAuth();
  const [apps,    setApps]    = useState([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewApp,  setViewApp]  = useState(null);   // list-row data
  const [detail,   setDetail]   = useState(null);   // full detail
  const [detLoading, setDetLoading] = useState(false);

  // Evaluate state
  const [showEval,  setShowEval]  = useState(false);
  const [evalForm,  setEvalForm]  = useState({ ...DEFAULT_EVAL });
  const [saving,    setSaving]    = useState(false);

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
      setDetail(res.data.data);
      // Pre-fill if already evaluated
      const ev = res.data.data;
      if (ev.sup_eval_id || ev.academic_record !== undefined) {
        setEvalForm({
          academic_record:       ev.academic_record       ?? '',
          research_aptitude:     ev.research_aptitude     ?? '',
          subject_relevance:     ev.subject_relevance     ?? '',
          research_proposal:     ev.research_proposal     ?? '',
          interview_performance: ev.interview_performance ?? '',
          recommendation:        ev.center_recommendation ?? '',
          remarks:               ev.center_remarks        ?? '',
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
    for (const c of CRITERIA) {
      const v = Number(evalForm[c.key]);
      if (evalForm[c.key] === '' || isNaN(v) || v < 0 || v > c.max) {
        return toast.error(`${c.label}: enter a value 0–${c.max}`);
      }
    }
    if (!evalForm.recommendation) return toast.error('Select a recommendation');

    setSaving(true);
    try {
      await axios.post(
        `${API}/permission-applications/${viewApp.id}/evaluate`,
        {
          academic_record:       Number(evalForm.academic_record),
          research_aptitude:     Number(evalForm.research_aptitude),
          subject_relevance:     Number(evalForm.subject_relevance),
          research_proposal:     Number(evalForm.research_proposal),
          interview_performance: Number(evalForm.interview_performance),
          recommendation:        evalForm.recommendation,
          remarks:               evalForm.remarks,
        },
        { headers: getHdr(token) }
      );
      toast.success('Evaluation submitted successfully');
      setViewApp(null);
      setDetail(null);
      setShowEval(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally { setSaving(false); }
  };

  const total = CRITERIA.reduce((s, c) => s + (Number(evalForm[c.key]) || 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#0e7490,#155e75)',
        padding: '20px 24px', borderRadius: 14, marginBottom: 24, color: '#fff',
      }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Assigned Permission Applications</h2>
        <p style={{ margin: '4px 0 0', opacity: 0.75, fontSize: 13 }}>
          Applications forwarded to your centre for evaluation
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
          padding: '9px 18px', background: '#0e7490', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>Refresh</button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
        ) : apps.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            No applications assigned to your centre yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f0f9ff', borderBottom: '2px solid #bae6fd' }}>
                <tr>
                  {['App No', 'Candidate', 'Category', 'Subject', 'Forwarded On', 'Status', 'Center Score', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#0c4a6e', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apps.map((app, i) => (
                  <tr key={app.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0891b2' }}>{app.app_no || `#${app.id}`}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{app.full_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{app.user_email}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>{app.category || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>{app.subject || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {app.forwarded_center_at ? new Date(app.forwarded_center_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}><StatusBadge status={app.workflow_status} /></td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0891b2' }}>
                      {app.center_total !== null && app.center_total !== undefined ? `${app.center_total} / 100` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => handleView(app)} style={{
                        padding: '7px 16px', background: '#0e7490', color: '#fff',
                        border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      }}>
                        {app.workflow_status === 'Forwarded_Center' ? 'Evaluate' : 'View / Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail / Evaluation drawer ── */}
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
              padding: '18px 24px', background: 'linear-gradient(135deg,#0e7490,#155e75)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{viewApp.full_name}</h3>
                <p style={{ margin: '2px 0 0', opacity: 0.75, fontSize: 12 }}>{viewApp.app_no || `App #${viewApp.id}`}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {viewApp.workflow_status === 'Forwarded_Center' && (
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
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0c4a6e', marginBottom: 4 }}>Total Score</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#0e7490' }}>{total} <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>/ 100</span></div>
                    <div style={{ height: 8, background: '#e0f2fe', borderRadius: 4, marginTop: 8 }}>
                      <div style={{ height: '100%', background: '#0e7490', borderRadius: 4, width: `${total}%`, transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  {CRITERIA.map(c => (
                    <div key={c.key} style={{ marginBottom: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>{c.label}</label>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Max {c.max}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="number" min={0} max={c.max}
                          value={evalForm[c.key]}
                          onChange={e => handleEvalChange(c.key, e.target.value)}
                          style={{
                            width: 80, padding: '8px 12px', border: '1px solid #d1d5db',
                            borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: 'center',
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4 }}>
                            <div style={{
                              height: '100%', background: '#0e7490', borderRadius: 4,
                              width: `${Math.min(100, (Number(evalForm[c.key]) / c.max) * 100)}%`,
                              transition: 'width 0.2s',
                            }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

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

                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}>Remarks</label>
                    <textarea
                      rows={3} value={evalForm.remarks}
                      onChange={e => handleEvalChange('remarks', e.target.value)}
                      placeholder="Optional remarks…"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  <button onClick={submitEval} disabled={saving} style={{
                    width: '100%', padding: '14px', background: '#0e7490', color: '#fff',
                    border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 800,
                    opacity: saving ? 0.7 : 1,
                  }}>
                    {saving ? 'Submitting…' : 'Submit Evaluation to Admin'}
                  </button>
                </div>
              ) : detail ? (
                /* ── Application Detail ── */
                <div>
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
                    <Field label="Subject"      value={detail.subject} />
                    <Field label="Category"     value={detail.category} />
                  </div>

                  {detail.preferences?.length > 0 && (
                    <>
                      <SectionHead title="Preferences Submitted by Student" />
                      {detail.preferences.map((p, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', background: '#f0f9ff',
                          border: '1px solid #bae6fd', borderRadius: 8, marginBottom: 8,
                        }}>
                          <span style={{
                            width: 26, height: 26, borderRadius: '50%',
                            background: '#0e7490', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 800, flexShrink: 0,
                          }}>{p.preference_order}</span>
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

                  {detail.workflow_status !== 'Forwarded_Center' && detail.center_recommendation && (
                    <>
                      <SectionHead title="Your Evaluation" />
                      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{
                            padding: '4px 14px', borderRadius: 20,
                            background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 13,
                          }}>{detail.center_recommendation}</span>
                          <span style={{ fontSize: 20, fontWeight: 800, color: '#0e7490' }}>{detail.center_total} / 100</span>
                        </div>
                        {detail.center_remarks && <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{detail.center_remarks}</p>}
                      </div>
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
          <tr style={{ background: '#e0f2fe' }}>
            {labels.map((l, i) => (
              <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#0c4a6e', borderBottom: '1px solid #bae6fd' }}>{l}</th>
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
