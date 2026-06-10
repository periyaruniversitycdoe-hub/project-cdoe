'use strict';
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Settings, Zap, List, Upload, Download, History,
  Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp,
  RefreshCw, CheckCircle, Lock, Archive,
  AlertCircle, Info
} from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/roster';

function authHeaders() {
  const token = localStorage.getItem('adminToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const TABS = [
  { id: 'settings',  label: 'Roster Settings',  icon: Settings  },
  { id: 'generate',  label: 'Generate',          icon: Zap       },
  { id: 'rosters',   label: 'Generated Rosters', icon: List      },
  { id: 'import',    label: 'Import',            icon: Upload    },
  { id: 'export',    label: 'Export',            icon: Download  },
  { id: 'audit',     label: 'Audit Logs',        icon: History   },
];

const STATUS_COLORS = {
  Draft:    { bg: '#fef9c3', text: '#92400e', border: '#fde68a' },
  Approved: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  Locked:   { bg: '#ede9fe', text: '#4c1d95', border: '#c4b5fd' },
  Archived: { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
};

// ── Small reusable components ─────────────────────────────────────────────────
const Badge = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Draft;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{status}</span>
  );
};

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
    <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
    Loading…
  </div>
);

const SectionCard = ({ title, children, actions }) => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 20 }}>
    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{title}</span>
      {actions}
    </div>
    <div style={{ padding: 20 }}>{children}</div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 – ROSTER SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
function SettingsTab() {
  const [meritPct,    setMeritPct]    = useState('');
  const [dist,        setDist]        = useState([]);
  const [rules,       setRules]       = useState([]);
  const [intakes,     setIntakes]     = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [newRule,     setNewRule]     = useState({ source_community: '', target_community: '', priority_order: 1 });
  const [newIntake,   setNewIntake]   = useState({ subject_name: '', intake_count: '' });
  const [editIntake,  setEditIntake]  = useState(null);
  const [savingIntake, setSavingIntake] = useState(false);

  const load = useCallback(async () => {
    const [s, d, r, i] = await Promise.all([
      axios.get(`${API}/settings`,               { headers: authHeaders() }),
      axios.get(`${API}/community-distribution`, { headers: authHeaders() }),
      axios.get(`${API}/conversion-rules`,       { headers: authHeaders() }),
      axios.get(`${API}/subject-intakes`,        { headers: authHeaders() }),
    ]);
    if (s.data.success) setMeritPct(String(s.data.data.merit_percentage ?? ''));
    if (d.data.success) setDist(d.data.data);
    if (r.data.success) setRules(r.data.data);
    if (i.data.success) setIntakes(i.data.data);
  }, []);

  useEffect(() => { load().catch(console.error); }, [load]);

  // ── Live calculation ──────────────────────────────────────────────────────
  const meritVal   = parseFloat(meritPct) || 0;
  const commTotal  = dist.filter(d => d.is_active).reduce((s, d) => s + (parseFloat(d.percentage) || 0), 0);
  const overall    = +(meritVal + commTotal).toFixed(4);
  const isExact100 = Math.abs(overall - 100) < 0.001;
  const isOver     = overall > 100;
  const remaining  = +(100 - overall).toFixed(4);

  // Status colour helpers
  const overallColor  = isExact100 ? '#166534' : isOver ? '#991b1b' : '#92400e';
  const overallBg     = isExact100 ? '#f0fdf4'  : isOver ? '#fef2f2'  : '#fffbeb';
  const overallBorder = isExact100 ? '#bbf7d0'  : isOver ? '#fecaca'  : '#fde68a';
  const overallMsg    = isExact100
    ? '✓ Valid Configuration'
    : isOver
    ? `⚠ Exceeds Maximum Limit (+${Math.abs(remaining).toFixed(2)}%)`
    : `Remaining: ${remaining.toFixed(2)}%`;

  // ── Save both merit + distribution together ───────────────────────────────
  const saveAll = async () => {
    if (!isExact100) return toast.error(`Total must be exactly 100%. Currently ${overall.toFixed(2)}%.`);
    setSaving(true);
    try {
      await axios.put(`${API}/community-distribution`,
        { distribution: dist, merit_percentage: meritVal },
        { headers: authHeaders() }
      );
      toast.success('Settings saved — total 100% confirmed');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  // ── Conversion rules ──────────────────────────────────────────────────────
  const addRule = async () => {
    if (!newRule.source_community || !newRule.target_community) return toast.error('Both communities required');
    try {
      await axios.post(`${API}/conversion-rules`, newRule, { headers: authHeaders() });
      toast.success('Rule added');
      setNewRule({ source_community: '', target_community: '', priority_order: 1 });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const deleteRule = async (id) => {
    if (!window.confirm('Delete this conversion rule?')) return;
    try {
      await axios.delete(`${API}/conversion-rules/${id}`, { headers: authHeaders() });
      toast.success('Rule deleted'); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  // ── Subject intakes ───────────────────────────────────────────────────────
  const saveIntake = async () => {
    if (!newIntake.subject_name.trim()) return toast.error('Subject name required');
    setSavingIntake(true);
    try {
      await axios.post(`${API}/subject-intakes`, newIntake, { headers: authHeaders() });
      toast.success('Intake saved');
      setNewIntake({ subject_name: '', intake_count: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    finally { setSavingIntake(false); }
  };

  const updateIntake = async (id) => {
    try {
      await axios.put(`${API}/subject-intakes/${id}`, editIntake, { headers: authHeaders() });
      toast.success('Intake updated'); setEditIntake(null); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const deleteIntake = async (id) => {
    if (!window.confirm('Delete this subject intake?')) return;
    try {
      await axios.delete(`${API}/subject-intakes/${id}`, { headers: authHeaders() });
      toast.success('Intake deleted'); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  return (
    <div>
      {/* ── Section 1: Merit Allocation ─────────────────────────────────── */}
      <SectionCard title="Merit Allocation">
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <label style={lbl}>Merit Percentage (%)</label>
            <input type="number" min="0" max="100" step="0.01" className="form-control"
              style={{ width: 140, fontSize: 22, fontWeight: 700, height: 52, textAlign: 'center' }}
              value={meritPct}
              placeholder="0.00"
              onChange={e => setMeritPct(e.target.value)} />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Seats allocated to open merit. Supports decimals (e.g. 20.5)</div>
          </div>
          {/* Auto-Calculation Panel */}
          <div style={{ flex: 1, minWidth: 240, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 10 }}>Auto Calculation Panel</div>
            {[
              ['Merit',           `${meritVal.toFixed(2)}%`,  '#1d4ed8'],
              ['Community Total', `${commTotal.toFixed(2)}%`, '#7c3aed'],
              ['Overall Total',   `${overall.toFixed(2)}%`,   overallColor],
            ].map(([k, v, color]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 13, color: '#374151' }}>{k}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Section 2: Community Reservation Configuration ───────────────── */}
      <SectionCard
        title="Community Reservation Configuration"
        actions={
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            Each % is share of <strong>total vacancy</strong>. Merit % + all community % = 100%
          </span>
        }
      >
        {/* Real-time validation banner */}
        <div style={{
          margin: '0 0 16px', padding: '12px 16px', borderRadius: 8,
          background: overallBg, border: `1px solid ${overallBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <div>
            <span style={{ fontWeight: 700, color: overallColor, fontSize: 14 }}>
              Total Configured: {overall.toFixed(2)}%
            </span>
            <span style={{ marginLeft: 12, fontSize: 13, color: overallColor }}>{overallMsg}</span>
          </div>
          <button className="btn btn-sm" onClick={saveAll} disabled={saving || !isExact100}
            style={{
              background: isExact100 ? '#16a34a' : '#d1d5db',
              color: isExact100 ? '#fff' : '#6b7280',
              border: 'none', fontWeight: 600,
              cursor: isExact100 ? 'pointer' : 'not-allowed',
            }}>
            <Save size={13} style={{ marginRight: 5 }} />
            {saving ? 'Saving…' : isExact100 ? 'Save Settings' : `Need ${remaining > 0 ? remaining.toFixed(2) + '% more' : Math.abs(remaining).toFixed(2) + '% less'}`}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead><tr style={{ background: '#f9fafb' }}>
              {['Order','Code','Display Name','% of Total Vacancy','Active'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {dist.map((d, i) => (
                <tr key={d.community_code || i}>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-xs" style={{ padding: '1px 4px', border: '1px solid #e5e7eb' }}
                        disabled={i === 0}
                        onClick={() => { const nd = [...dist]; [nd[i-1], nd[i]] = [nd[i], nd[i-1]]; nd.forEach((x,j) => x.display_order = j+1); setDist([...nd]); }}>
                        <ChevronUp size={11} />
                      </button>
                      <button className="btn btn-xs" style={{ padding: '1px 4px', border: '1px solid #e5e7eb' }}
                        disabled={i === dist.length - 1}
                        onClick={() => { const nd = [...dist]; [nd[i], nd[i+1]] = [nd[i+1], nd[i]]; nd.forEach((x,j) => x.display_order = j+1); setDist([...nd]); }}>
                        <ChevronDown size={11} />
                      </button>
                    </div>
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: '#1d4ed8' }}>{d.community_code}</td>
                  <td style={td}>
                    <input className="form-control form-control-sm" style={{ width: 130 }}
                      value={d.display_name}
                      onChange={e => { const nd = [...dist]; nd[i] = { ...nd[i], display_name: e.target.value }; setDist(nd); }} />
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" min="0" max="100" step="0.01" className="form-control form-control-sm"
                        style={{ width: 90, fontWeight: 600 }}
                        value={d.percentage}
                        onChange={e => { const nd = [...dist]; nd[i] = { ...nd[i], percentage: e.target.value }; setDist(nd); }} />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>%</span>
                    </div>
                  </td>
                  <td style={td}>
                    <input type="checkbox" checked={!!d.is_active}
                      onChange={e => { const nd = [...dist]; nd[i] = { ...nd[i], is_active: e.target.checked ? 1 : 0 }; setDist(nd); }} />
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
                <td style={td} colSpan={3}>
                  <span style={{ fontSize: 12 }}>Merit ({meritVal.toFixed(2)}%) + Community Total</span>
                </td>
                <td style={{ ...td, fontSize: 14, color: overallColor }}>
                  {overall.toFixed(2)}% {isExact100 ? '✓' : ''}
                </td>
                <td style={td} />
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Conversion Rules ────────────────────────────────────────────── */}
      <SectionCard title="Community Conversion Rules">
        <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Source Community</label>
            <input className="form-control form-control-sm" style={{ width: 130 }}
              value={newRule.source_community} placeholder="e.g. BCM"
              onChange={e => setNewRule(p => ({ ...p, source_community: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>→ Target Community</label>
            <input className="form-control form-control-sm" style={{ width: 130 }}
              value={newRule.target_community} placeholder="e.g. BC"
              onChange={e => setNewRule(p => ({ ...p, target_community: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Priority</label>
            <input type="number" min="1" className="form-control form-control-sm" style={{ width: 70 }}
              value={newRule.priority_order}
              onChange={e => setNewRule(p => ({ ...p, priority_order: parseInt(e.target.value) || 1 }))} />
          </div>
          <button className="btn btn-sm btn-success" onClick={addRule}>
            <Plus size={13} className="me-1" /> Add Rule
          </button>
        </div>
        <table style={tbl}>
          <thead><tr style={{ background: '#f9fafb' }}>
            {['Source','→ Target','Priority','Active','Actions'].map(h => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rules.map(r => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 600 }}>{r.source_community}</td>
                <td style={td}>{r.target_community}</td>
                <td style={td}>{r.priority_order}</td>
                <td style={td}><span style={{ color: r.is_active ? '#16a34a' : '#6b7280' }}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style={td}>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteRule(r.id)}><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {!rules.length && <tr><td colSpan={5} style={{ ...td, color: '#9ca3af', textAlign: 'center' }}>No rules configured</td></tr>}
          </tbody>
        </table>
      </SectionCard>

      {/* ── Subject Intakes ──────────────────────────────────────────────── */}
      <SectionCard title="Subject Intakes (Vacancy Configuration)">
        <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Subject Name</label>
            <input className="form-control form-control-sm" style={{ width: 220 }}
              placeholder="Exact subject name"
              value={newIntake.subject_name}
              onChange={e => setNewIntake(p => ({ ...p, subject_name: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Intake Count</label>
            <input type="number" min="0" className="form-control form-control-sm" style={{ width: 100 }}
              value={newIntake.intake_count}
              onChange={e => setNewIntake(p => ({ ...p, intake_count: e.target.value }))} />
          </div>
          <button className="btn btn-sm btn-success" onClick={saveIntake} disabled={savingIntake}>
            <Plus size={13} className="me-1" /> {savingIntake ? 'Saving…' : 'Add / Update'}
          </button>
        </div>
        <table style={tbl}>
          <thead><tr style={{ background: '#f9fafb' }}>
            {['Subject','Intake','Active','Actions'].map(h => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {intakes.map(it => (
              <tr key={it.id}>
                <td style={td}>{it.subject_name}</td>
                <td style={td}>
                  {editIntake?.id === it.id
                    ? <input type="number" className="form-control form-control-sm" style={{ width: 90 }}
                        value={editIntake.intake_count}
                        onChange={e => setEditIntake(p => ({ ...p, intake_count: e.target.value }))} />
                    : <strong>{it.intake_count}</strong>
                  }
                </td>
                <td style={td}>
                  {editIntake?.id === it.id
                    ? <input type="checkbox" checked={!!editIntake.is_active}
                        onChange={e => setEditIntake(p => ({ ...p, is_active: e.target.checked ? 1 : 0 }))} />
                    : <span style={{ color: it.is_active ? '#16a34a' : '#6b7280' }}>{it.is_active ? 'Active' : 'Inactive'}</span>
                  }
                </td>
                <td style={td}>
                  {editIntake?.id === it.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-success" onClick={() => updateIntake(it.id)}><Save size={12} /></button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditIntake(null)}><X size={12} /></button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-warning" onClick={() => setEditIntake({ ...it })}><Edit2 size={12} /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteIntake(it.id)}><Trash2 size={12} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!intakes.length && <tr><td colSpan={4} style={{ ...td, color: '#9ca3af', textAlign: 'center' }}>No subject intakes configured</td></tr>}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 – GENERATE
// ══════════════════════════════════════════════════════════════════════════════
function GenerateTab() {
  const [subjects,  setSubjects]  = useState([]);
  const [session,   setSession]   = useState(null);
  const [selected,  setSelected]  = useState('');
  const [vacancy,   setVacancy]   = useState(null);
  const [notes,     setNotes]     = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview,   setPreview]   = useState(null);

  useEffect(() => {
    axios.get(`${API}/subjects`,       { headers: authHeaders() }).then(r => r.data.success && setSubjects(r.data.data));
    axios.get(`${API}/active-session`, { headers: authHeaders() }).then(r => r.data.success && setSession(r.data.data));
  }, []);

  useEffect(() => {
    if (!selected) { setVacancy(null); return; }
    const subj = encodeURIComponent(selected);
    axios.get(`${API}/vacancy/${subj}`, { headers: authHeaders() })
      .then(r => r.data.success && setVacancy(r.data.data))
      .catch(() => setVacancy(null));
  }, [selected]);

  const generate = async () => {
    if (!selected) return toast.error('Select a subject first');
    if (!vacancy?.vacancy_count) return toast.error('No vacancy configured for this subject. Set intake in Settings → Subject Intakes.');
    setGenerating(true);
    try {
      const r = await axios.post(`${API}/generate`, { subject_name: selected, notes }, { headers: authHeaders() });
      if (r.data.success) {
        toast.success(r.data.message);
        setPreview(r.data.data);
      }
    } catch (e) { toast.error(e.response?.data?.message || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const catCounts = preview?.entries?.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {}) || {};

  return (
    <div>
      <SectionCard title="Generate Roster">
        {!session && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, marginBottom: 16, display: 'flex', gap: 8 }}>
            <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: '#991b1b', fontSize: 13 }}>No active session. Please activate a session in Session Management first.</span>
          </div>
        )}
        {session && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <CheckCircle size={15} color="#16a34a" />
            <span style={{ color: '#166534', fontSize: 13, fontWeight: 600 }}>Active Session: {session.label}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ flex: '1 1 280px' }}>
            <label style={lbl}>Subject *</label>
            <select className="form-control" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— Select Subject —</option>
              {subjects.map(s => (
                <option key={s.id} value={s.subject_name}>
                  {s.subject_name} {s.has_intake ? `(Intake: ${s.intake_count})` : '(no intake)'}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <label style={lbl}>Total Vacancy</label>
            <div style={{ padding: '8px 16px', background: vacancy?.vacancy_count ? '#f0fdf4' : '#f9fafb',
              border: `1px solid ${vacancy?.vacancy_count ? '#bbf7d0' : '#e5e7eb'}`,
              borderRadius: 6, minWidth: 90, textAlign: 'center', fontWeight: 700, fontSize: 18,
              color: vacancy?.vacancy_count ? '#166534' : '#9ca3af' }}>
              {vacancy ? vacancy.vacancy_count : '—'}
            </div>
          </div>
        </div>

        {vacancy && !vacancy.has_intake && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', gap: 8 }}>
            <Info size={15} color="#92400e" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: '#92400e', fontSize: 13 }}>No intake configured for this subject. Go to Settings → Subject Intakes to set it.</span>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Notes (optional)</label>
          <input className="form-control" placeholder="Optional generation notes" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <button className="btn btn-primary" onClick={generate}
          disabled={generating || !selected || !session || !vacancy?.vacancy_count}
          style={{ minWidth: 160 }}>
          <Zap size={15} className="me-1" />
          {generating ? 'Generating…' : 'Generate Roster'}
        </button>
      </SectionCard>

      {preview && (
        <SectionCard title={`Preview — ${preview.version_label}`} actions={
          <span style={{ fontSize: 12, color: '#6b7280' }}>Saved as Draft • {preview.entries?.length} positions</span>
        }>
          {/* Category summary */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {Object.entries(catCounts).map(([cat, cnt]) => (
              <div key={cat} style={{ padding: '6px 14px', background: cat === 'Merit' ? '#eff6ff' : '#f5f3ff',
                border: `1px solid ${cat === 'Merit' ? '#bfdbfe' : '#ddd6fe'}`,
                borderRadius: 20, fontSize: 13, fontWeight: 600,
                color: cat === 'Merit' ? '#1e40af' : '#5b21b6' }}>
                {cat}: {cnt}
              </div>
            ))}
          </div>

          {/* Roster sequence (first 30 rows) */}
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead><tr style={{ background: '#f9fafb' }}>
                <th style={th}>Position</th><th style={th}>Category</th>
              </tr></thead>
              <tbody>
                {(preview.entries || []).slice(0, 30).map(e => (
                  <tr key={e.position_no}>
                    <td style={{ ...td, color: '#6b7280' }}>{e.position_no}</td>
                    <td style={{ ...td, fontWeight: 600, color: e.category === 'Merit' ? '#1d4ed8' : '#374151' }}>{e.category}</td>
                  </tr>
                ))}
                {(preview.entries?.length || 0) > 30 && (
                  <tr><td colSpan={2} style={{ ...td, color: '#9ca3af', textAlign: 'center' }}>
                    … and {preview.entries.length - 30} more positions. View full roster in Generated Rosters tab.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 – GENERATED ROSTERS
// ══════════════════════════════════════════════════════════════════════════════
function RostersTab({ onExport }) {
  const [rosters,   setRosters]  = useState([]);
  const [loading,   setLoading]  = useState(false);
  const [detail,    setDetail]   = useState(null);
  const [entries,   setEntries]  = useState([]);
  const [filter,    setFilter]   = useState({ subject_name: '', status: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.subject_name) params.subject_name = filter.subject_name;
      if (filter.status)       params.status       = filter.status;
      const r = await axios.get(`${API}/rosters`, { headers: authHeaders(), params });
      if (r.data.success) setRosters(r.data.data);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const viewDetail = async (id) => {
    const r = await axios.get(`${API}/rosters/${id}`, { headers: authHeaders() });
    if (r.data.success) { setDetail(r.data.data.roster); setEntries(r.data.data.entries); }
  };

  const setStatus = async (id, status) => {
    const label = { Approved: 'approve', Locked: 'lock', Archived: 'archive' }[status] || status;
    if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} this roster?`)) return;
    try {
      await axios.patch(`${API}/rosters/${id}/status`, { status }, { headers: authHeaders() });
      toast.success(`Roster ${status}`);
      load();
      if (detail?.id === id) viewDetail(id);
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const delRoster = async (id) => {
    if (!window.confirm('Delete this draft roster?')) return;
    try {
      await axios.delete(`${API}/rosters/${id}`, { headers: authHeaders() });
      toast.success('Roster deleted');
      if (detail?.id === id) setDetail(null);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const catCounts = entries.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {});

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={lbl}>Filter by Subject</label>
          <input className="form-control form-control-sm" placeholder="Subject name…" style={{ width: 200 }}
            value={filter.subject_name} onChange={e => setFilter(p => ({ ...p, subject_name: e.target.value }))} />
        </div>
        <div>
          <label style={lbl}>Status</label>
          <select className="form-control form-control-sm" style={{ width: 130 }}
            value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
            <option value="">All</option>
            {['Draft','Approved','Locked','Archived'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={load}><RefreshCw size={13} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* List */}
        <div>
          {loading ? <Spinner /> : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ ...tbl, margin: 0 }}>
                <thead><tr style={{ background: '#f9fafb' }}>
                  {['Version','Subject','Vacancy','Session','Status','Actions'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rosters.map(r => (
                    <tr key={r.id} style={{ cursor: 'pointer', background: detail?.id === r.id ? '#eff6ff' : undefined }}
                      onClick={() => viewDetail(r.id)}>
                      <td style={td}><span style={{ fontSize: 11, fontWeight: 700 }}>{r.version_label || `V${r.version}`}</span></td>
                      <td style={td}>{r.subject_name}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{r.vacancy_count}</td>
                      <td style={td}>{r.session_label || '—'}</td>
                      <td style={td}><Badge status={r.status} /></td>
                      <td style={td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {r.status === 'Draft'    && <button className="btn btn-xs btn-success"  title="Approve" onClick={() => setStatus(r.id,'Approved')}><CheckCircle size={11} /></button>}
                          {r.status === 'Approved' && <button className="btn btn-xs btn-primary"  title="Lock"    onClick={() => setStatus(r.id,'Locked'  )}><Lock        size={11} /></button>}
                          {r.status !== 'Archived' && <button className="btn btn-xs btn-secondary" title="Archive" onClick={() => setStatus(r.id,'Archived')}><Archive     size={11} /></button>}
                          {r.status === 'Draft'    && <button className="btn btn-xs btn-danger"   title="Delete"  onClick={() => delRoster(r.id)           }><Trash2      size={11} /></button>}
                          <button className="btn btn-xs btn-info" title="Export" onClick={() => onExport(r)}><Download size={11} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rosters.length && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>No rosters found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail */}
        {detail && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{detail.version_label} — Detail</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-outline-primary" onClick={() => onExport(detail)}><Download size={12} className="me-1" /> Export</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setDetail(null)}><X size={12} /></button>
              </div>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                {[['Subject', detail.subject_name],['Session', detail.session_label],
                  ['Vacancy', detail.vacancy_count],['Merit', detail.merit_seats],
                  ['Community', detail.community_seats],['Status', <Badge status={detail.status} />]
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {Object.entries(catCounts).map(([cat, cnt]) => (
                  <span key={cat} style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: cat === 'Merit' ? '#eff6ff' : '#f5f3ff',
                    color: cat === 'Merit' ? '#1e40af' : '#5b21b6',
                    border: `1px solid ${cat === 'Merit' ? '#bfdbfe' : '#ddd6fe'}` }}>
                    {cat}: {cnt}
                  </span>
                ))}
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table style={{ ...tbl, margin: 0 }}>
                  <thead><tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                    <th style={th}>Pos</th><th style={th}>Category</th>
                  </tr></thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e.id}>
                        <td style={{ ...td, color: '#9ca3af', fontSize: 12 }}>{e.position_no}</td>
                        <td style={{ ...td, fontWeight: 600, color: e.category === 'Merit' ? '#1d4ed8' : '#374151', fontSize: 12 }}>{e.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 – IMPORT
// ══════════════════════════════════════════════════════════════════════════════
function ImportTab() {
  const [file,       setFile]     = useState(null);
  const [subject,    setSubject]  = useState('');
  const [subjects,   setSubjects] = useState([]);
  const [importing,  setImporting] = useState(false);
  const [result,     setResult]   = useState(null);
  const [logs,       setLogs]     = useState([]);
  const fileRef = useRef();

  useEffect(() => {
    axios.get(`${API}/subjects`, { headers: authHeaders() }).then(r => r.data.success && setSubjects(r.data.data));
    axios.get(`${API}/import-logs`, { headers: authHeaders() }).then(r => r.data.success && setLogs(r.data.data));
  }, []);

  const doImport = async () => {
    if (!file)    return toast.error('Select a file first');
    if (!subject) return toast.error('Select a subject first');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('subject_name', subject);
    setImporting(true);
    setResult(null);
    try {
      const r = await axios.post(`${API}/import`, fd, { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } });
      toast.success(r.data.message);
      setResult({ success: true, message: r.data.message, data: r.data.data });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      axios.get(`${API}/import-logs`, { headers: authHeaders() }).then(r => r.data.success && setLogs(r.data.data));
    } catch (e) {
      const err = e.response?.data;
      setResult({ success: false, message: err?.message || 'Import failed', errors: err?.errors || [] });
      toast.error(err?.message || 'Import failed');
    } finally { setImporting(false); }
  };

  return (
    <div>
      <SectionCard title="Import Roster from Excel / CSV">
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#0c4a6e' }}>
          <strong>Expected columns:</strong> <code>Position No</code>, <code>Category</code> (Merit/OC/BC/BCM/MBC/DNC/SC/SCA/ST), <code>Remarks</code> (optional).
          Positions must be consecutive starting from 1.
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <label style={lbl}>Subject *</label>
            <select className="form-control" style={{ width: 240 }} value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">— Select Subject —</option>
              {subjects.map(s => <option key={s.id} value={s.subject_name}>{s.subject_name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>File (.xlsx / .xls / .csv) *</label>
            <input ref={fileRef} type="file" className="form-control" accept=".xlsx,.xls,.csv"
              onChange={e => setFile(e.target.files[0])} />
          </div>
          <button className="btn btn-primary" onClick={doImport} disabled={importing || !file || !subject}>
            <Upload size={14} className="me-1" />{importing ? 'Importing…' : 'Import'}
          </button>
        </div>

        {result && (
          <div style={{ borderRadius: 8, padding: 14,
            background: result.success ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}` }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: result.success ? '#166534' : '#991b1b' }}>
              {result.success ? '✓ ' : '✗ '}{result.message}
            </div>
            {result.errors?.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#dc2626' }}>• {e}</div>)}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Import History">
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead><tr style={{ background: '#f9fafb' }}>
              {['Date','File','Subject','Status','Total','OK','Errors'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={td}>{new Date(l.imported_at).toLocaleString('en-IN')}</td>
                  <td style={td}>{l.file_name}</td>
                  <td style={td}>{l.subject_name || '—'}</td>
                  <td style={td}>
                    <span style={{ color: l.status === 'Success' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{l.status}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>{l.rows_total}</td>
                  <td style={{ ...td, textAlign: 'center', color: '#16a34a' }}>{l.rows_ok}</td>
                  <td style={{ ...td, textAlign: 'center', color: '#dc2626' }}>{l.rows_error}</td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>No imports yet</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 5 – EXPORT
// ══════════════════════════════════════════════════════════════════════════════
function ExportTab({ initialRoster }) {
  const [rosters,  setRosters]  = useState([]);
  const [selected, setSelected] = useState('');
  const [format,   setFormat]   = useState('excel');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    axios.get(`${API}/rosters`, { headers: authHeaders() })
      .then(r => r.data.success && setRosters(r.data.data.filter(r => r.status !== 'Archived')));
  }, []);

  // Auto-select when navigated from quick-export button in RostersTab
  useEffect(() => {
    if (initialRoster?.id) setSelected(String(initialRoster.id));
  }, [initialRoster]);

  const doExport = async () => {
    if (!selected) return toast.error('Select a roster first');
    setLoading(true);
    try {
      const resp = await axios.get(`${API}/rosters/${selected}/export`, {
        headers: authHeaders(),
        params: { format },
        responseType: 'blob',
      });
      const ext  = format === 'csv' ? 'csv' : 'xlsx';
      const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const url  = URL.createObjectURL(new Blob([resp.data], { type: mime }));
      const a    = document.createElement('a');
      a.href = url;
      a.download = `roster_${selected}_${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (e) { toast.error('Export failed'); }
    finally { setLoading(false); }
  };

  const r = rosters.find(r => String(r.id) === String(selected));

  return (
    <div>
      <SectionCard title="Export Roster">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
          <div style={{ flex: '1 1 280px' }}>
            <label style={lbl}>Select Roster</label>
            <select className="form-control" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— Select Roster —</option>
              {rosters.map(r => (
                <option key={r.id} value={r.id}>
                  {r.version_label || `V${r.version}`} — {r.subject_name} [{r.status}]
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Format</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['excel','Excel (.xlsx)'],['csv','CSV']].map(([val, lbText]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="fmt" value={val} checked={format === val} onChange={() => setFormat(val)} />
                  {lbText}
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={doExport} disabled={loading || !selected}>
            <Download size={14} className="me-1" />{loading ? 'Exporting…' : 'Export'}
          </button>
        </div>

        {r && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[['Subject', r.subject_name],['Session', r.session_label || '—'],
                ['Vacancy', r.vacancy_count],['Merit', r.merit_seats],
                ['Community', r.community_seats],['Status', <Badge status={r.status} />],
                ['Version', r.version_label || `V${r.version}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Export Notes">
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
          <div>• <strong>Excel:</strong> Downloads a 3-sheet workbook — Summary, Roster Sequence, Category Summary.</div>
          <div>• <strong>CSV:</strong> Downloads a single flat file with Position No, Category, Converted From, Remarks columns.</div>
          <div>• Only non-Archived rosters are listed here. To export archived rosters, change the status first.</div>
        </div>
      </SectionCard>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 6 – AUDIT LOGS
// ══════════════════════════════════════════════════════════════════════════════
function AuditTab() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState({ action: '', roster_id: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/audit-logs`, {
        headers: authHeaders(),
        params: { ...(filter.action && { action: filter.action }), ...(filter.roster_id && { roster_id: filter.roster_id }), limit: 200 }
      });
      if (r.data.success) setLogs(r.data.data);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const ACTION_COLORS = {
    ROSTER_GENERATED: '#16a34a', ROSTER_IMPORTED: '#2563eb',
    ROSTER_EXPORTED: '#7c3aed', STATUS_APPROVED: '#059669',
    STATUS_LOCKED: '#4f46e5', STATUS_ARCHIVED: '#6b7280',
    SETTINGS_UPDATED: '#b45309', COMMUNITY_DIST_UPDATED: '#b45309',
    CONVERSION_RULE_ADDED: '#0369a1', DEFAULT: '#374151',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={lbl}>Filter by Action</label>
          <input className="form-control form-control-sm" placeholder="e.g. GENERATED" style={{ width: 180 }}
            value={filter.action} onChange={e => setFilter(p => ({ ...p, action: e.target.value }))} />
        </div>
        <div>
          <label style={lbl}>Roster ID</label>
          <input type="number" className="form-control form-control-sm" placeholder="Roster ID" style={{ width: 100 }}
            value={filter.roster_id} onChange={e => setFilter(p => ({ ...p, roster_id: e.target.value }))} />
        </div>
        <button className="btn btn-sm btn-secondary" onClick={load}><RefreshCw size={13} /></button>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ ...tbl, margin: 0 }}>
            <thead><tr style={{ background: '#f9fafb' }}>
              {['Date','Action','User','Roster ID','Entity','Details'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ ...td, fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(l.created_at).toLocaleString('en-IN')}
                  </td>
                  <td style={td}>
                    <span style={{ fontWeight: 700, fontSize: 11,
                      color: ACTION_COLORS[l.action] || ACTION_COLORS.DEFAULT }}>
                      {l.action}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12 }}>{l.user_name || '—'}</td>
                  <td style={{ ...td, textAlign: 'center', fontSize: 12 }}>{l.roster_id || '—'}</td>
                  <td style={{ ...td, fontSize: 12 }}>{l.entity || '—'}</td>
                  <td style={{ ...td, fontSize: 11, color: '#6b7280', maxWidth: 220 }}>
                    {l.new_value ? (
                      <details>
                        <summary style={{ cursor: 'pointer' }}>View</summary>
                        <pre style={{ fontSize: 10, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {JSON.stringify(typeof l.new_value === 'string' ? JSON.parse(l.new_value) : l.new_value, null, 2)}
                        </pre>
                      </details>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>No audit entries</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
export default function RosterManagement() {
  const [tab,       setTab]       = useState('settings');
  const [exportTarget, setExportTarget] = useState(null);

  // Triggered from RostersTab quick-export button
  useEffect(() => {
    if (!exportTarget) return;
    setTab('export');
  }, [exportTarget]);

  const handleExport = (roster) => {
    setExportTarget(roster);
    setTab('export');
  };

  return (
    <div style={{ padding: '24px 28px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Roster Management</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
          Enterprise roster generation with merit & community seat sequencing, version control, and full audit trail.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb', marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? '#2563eb' : '#6b7280',
                borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: -2, borderRadius: '4px 4px 0 0',
                transition: 'all 0.15s',
              }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'generate' && <GenerateTab />}
      {tab === 'rosters'  && <RostersTab onExport={handleExport} />}
      {tab === 'import'   && <ImportTab />}
      {tab === 'export'   && <ExportTab key={exportTarget?.id} initialRoster={exportTarget} />}
      {tab === 'audit'    && <AuditTab />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// ── Shared style tokens ───────────────────────────────────────────────────────
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' };
const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th  = { padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: '1px solid #e5e7eb' };
const td  = { padding: '8px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' };
