import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, ShieldCheck, Play, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';

const API_URL = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;

const BLANK = {
  rule_name: '', qualification_type: '', department: '',
  direct_pass_enabled: true, requires_payment: true,
  valid_from: '', valid_to: '', notes: '', is_active: true
};

const COMMON_QUALS = ['NET', 'SET', 'JRF', 'SLET', 'GATE', 'M.Phil', 'Ph.D', 'Other'];

const DirectPassRules = () => {
  const [rules, setRules]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(BLANK);
  const [saving, setSaving]     = useState(false);
  const [running, setRunning]   = useState(false);
  const { sessions, activeSession, sessionLabel } = useSession();
  const [evalSession, setEvalSession] = useState('active');

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/qualification-rules`, { headers });
      setRules(res.data.data || []);
    } catch { toast.error('Failed to load rules'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openNew = () => { setEditing(null); setForm(BLANK); setShowForm(true); };

  const openEdit = (rule) => {
    setEditing(rule.id);
    setForm({
      rule_name:           rule.rule_name,
      qualification_type:  rule.qualification_type,
      department:          rule.department || '',
      direct_pass_enabled: !!rule.direct_pass_enabled,
      requires_payment:    !!rule.requires_payment,
      valid_from:          rule.valid_from ? rule.valid_from.slice(0, 10) : '',
      valid_to:            rule.valid_to   ? rule.valid_to.slice(0, 10)   : '',
      notes:               rule.notes || '',
      is_active:           !!rule.is_active,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.rule_name.trim() || !form.qualification_type.trim()) {
      toast.error('Rule Name and Qualification Type are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/qualification-rules/${editing}`, form, { headers });
        toast.success('Rule updated');
      } else {
        await axios.post(`${API_URL}/qualification-rules`, form, { headers });
        toast.success('Rule created');
      }
      setShowForm(false);
      fetchRules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete rule "${name}"?`)) return;
    try {
      await axios.delete(`${API_URL}/qualification-rules/${id}`, { headers });
      toast.success('Rule deleted');
      fetchRules();
    } catch { toast.error('Delete failed'); }
  };

  const handleToggleActive = async (rule) => {
    try {
      await axios.put(`${API_URL}/qualification-rules/${rule.id}`, { ...rule, is_active: !rule.is_active }, { headers });
      toast.success(rule.is_active ? 'Rule deactivated' : 'Rule activated');
      fetchRules();
    } catch { toast.error('Update failed'); }
  };

  const runBulkEvaluate = async () => {
    if (!window.confirm('Run direct-pass evaluation for all paid applications in selected session?')) return;
    setRunning(true);
    try {
      const sid = evalSession === 'active' ? activeSession?.id : evalSession;
      const res = await axios.post(`${API_URL}/qualification-rules/evaluate-session`,
        { session_id: sid }, { headers });
      toast.success(`Evaluated ${res.data.evaluated} applications — ${res.data.directPassGranted} direct pass granted`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Evaluation failed');
    } finally { setRunning(false); }
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>
            <ShieldCheck size={20} className="me-2" style={{ color: '#32c5d2' }} />
            Direct Pass Rules
          </h2>
          <p className="text-muted small mb-0">Configure which qualifications automatically grant direct pass status</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary" onClick={fetchRules}>
            <RefreshCw size={14} className="me-1" /> Refresh
          </button>
          <button className="btn btn-sm btn-primary" onClick={openNew}>
            <Plus size={14} className="me-1" /> New Rule
          </button>
        </div>
      </div>

      {/* Bulk Evaluate Panel */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderLeft: '4px solid #32c5d2' }}>
        <div className="card-body py-3">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <Play size={16} style={{ color: '#32c5d2' }} />
            <div className="fw-semibold" style={{ fontSize: 14 }}>Bulk Evaluate Session</div>
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto', fontSize: 12 }}
              value={evalSession}
              onChange={e => setEvalSession(e.target.value)}
            >
              <option value="active">Active Session {activeSession ? `(${sessionLabel(activeSession)})` : ''}</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
            </select>
            <button className="btn btn-sm btn-success" onClick={runBulkEvaluate} disabled={running}>
              {running ? <span className="spinner-border spinner-border-sm me-1" /> : <Play size={13} className="me-1" />}
              Run Evaluation
            </button>
            <span className="text-muted small">
              Checks all paid applications and grants direct pass where rules match
            </span>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3">
          <h6 className="mb-0 fw-bold" style={{ color: '#32c5d2' }}>
            Configured Rules ({rules.length})
          </h6>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 text-muted">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <ShieldCheck size={32} className="mb-2 opacity-25" />
              <div>No rules configured yet. Add a rule to enable direct pass logic.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                <thead className="table-light">
                  <tr>
                    <th className="ps-4 py-3">Rule Name</th>
                    <th className="py-3">Qualification</th>
                    <th className="py-3">Department</th>
                    <th className="py-3">Payment Req.</th>
                    <th className="py-3">Valid Period</th>
                    <th className="py-3">Status</th>
                    <th className="py-3 text-end pe-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => (
                    <tr key={rule.id}>
                      <td className="ps-4">
                        <div className="fw-semibold">{rule.rule_name}</div>
                        {rule.notes && <div className="text-muted" style={{ fontSize: 11 }}>{rule.notes}</div>}
                      </td>
                      <td>
                        <span className="badge bg-primary px-2 py-1">{rule.qualification_type}</span>
                      </td>
                      <td className="text-muted" style={{ fontSize: 12 }}>
                        {rule.department || <span className="text-success small">All Departments</span>}
                      </td>
                      <td>
                        {rule.requires_payment
                          ? <span className="badge bg-warning text-dark">Required</span>
                          : <span className="badge bg-secondary">Not Required</span>}
                      </td>
                      <td style={{ fontSize: 11 }} className="text-muted">
                        {rule.valid_from ? rule.valid_from.slice(0, 10) : '—'}
                        {rule.valid_to   ? ` → ${rule.valid_to.slice(0, 10)}` : ''}
                        {!rule.valid_from && !rule.valid_to && 'No expiry'}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm border-0 p-0"
                          title={rule.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleActive(rule)}
                        >
                          {rule.is_active
                            ? <ToggleRight size={22} style={{ color: '#10b981' }} />
                            : <ToggleLeft  size={22} style={{ color: '#9ca3af' }} />}
                        </button>
                        <span className="ms-1 small" style={{ color: rule.is_active ? '#10b981' : '#9ca3af' }}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <button className="btn btn-sm btn-outline-primary border-0 me-1" onClick={() => openEdit(rule)} title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-sm btn-outline-danger border-0" onClick={() => handleDelete(rule.id, rule.rule_name)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold" style={{ color: '#32c5d2' }}>
                  {editing ? 'Edit Rule' : 'New Direct Pass Rule'}
                </h5>
                <button className="btn-close" onClick={() => setShowForm(false)} />
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-8">
                      <label className="form-label fw-semibold small">Rule Name *</label>
                      <input
                        className="form-control form-control-sm" required
                        value={form.rule_name}
                        onChange={e => setForm(f => ({ ...f, rule_name: e.target.value }))}
                        placeholder="e.g. NET Holders - Science Departments"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Qualification Type *</label>
                      <select
                        className="form-select form-select-sm" required
                        value={form.qualification_type}
                        onChange={e => setForm(f => ({ ...f, qualification_type: e.target.value }))}
                      >
                        <option value="">Select…</option>
                        {COMMON_QUALS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold small">Department Filter</label>
                      <input
                        className="form-control form-control-sm"
                        value={form.department}
                        onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                        placeholder="Leave blank for ALL departments. Comma-separated for multiple: Mathematics, Physics"
                      />
                      <div className="form-text">Leave blank to apply to all departments</div>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold small">Valid From</label>
                      <input
                        type="date" className="form-control form-control-sm"
                        value={form.valid_from}
                        onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold small">Valid To</label>
                      <input
                        type="date" className="form-control form-control-sm"
                        value={form.valid_to}
                        onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-3 d-flex align-items-center pt-4">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input" type="checkbox" role="switch"
                          checked={form.requires_payment}
                          onChange={e => setForm(f => ({ ...f, requires_payment: e.target.checked }))}
                        />
                        <label className="form-check-label small fw-semibold">Payment Required</label>
                      </div>
                    </div>
                    <div className="col-md-3 d-flex align-items-center pt-4">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input" type="checkbox" role="switch"
                          checked={form.is_active}
                          onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                        />
                        <label className="form-check-label small fw-semibold">Active</label>
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold small">Notes</label>
                      <textarea
                        className="form-control form-control-sm" rows={2}
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Optional description or notes"
                      />
                    </div>
                  </div>

                  <div className="alert alert-info border-0 mt-3 py-2" style={{ fontSize: 12 }}>
                    <strong>How it works:</strong> When a student with matching qualification completes payment
                    and their application is approved, the system automatically sets their status to
                    <strong> Direct Pass</strong> — skipping the entrance exam, attendance, and marks workflow.
                    They immediately gain access to the counselling form.
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                    {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                    {editing ? 'Save Changes' : 'Create Rule'}
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

export default DirectPassRules;
