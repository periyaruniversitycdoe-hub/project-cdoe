
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Edit2, Check, X, Download, RefreshCw, Search, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';
const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('adminToken')}` });

// ─── Shared helpers ────────────────────────────────────────────────────────────

function Badge({ active }) {
  return (
    <span className={`badge ${active ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: 10 }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings]   = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState({ session_id: '', start_date: '', end_date: '', max_research_choices: 3, is_active: true });
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, sess] = await Promise.all([
        axios.get(`${API}/counselling/settings`, { headers: getHeaders() }),
        axios.get(`${API}/sessions`, { headers: getHeaders() }),
      ]);
      setSettings(sr.data.data || []);
      setSessions(sess.data.data || []);
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.session_id || !form.start_date || !form.end_date) {
      return toast.error('Session, start date, and end date are required');
    }
    setSaving(true);
    try {
      if (editId) {
        await axios.put(`${API}/counselling/settings/${editId}`, form, { headers: getHeaders() });
        toast.success('Settings updated');
      } else {
        await axios.post(`${API}/counselling/settings`, form, { headers: getHeaders() });
        toast.success('Settings created');
      }
      setForm({ session_id: '', start_date: '', end_date: '', max_research_choices: 3, is_active: true });
      setEditId(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleEdit = (s) => {
    setEditId(s.id);
    setForm({
      session_id: s.session_id,
      start_date: s.start_date?.split('T')[0] || '',
      end_date:   s.end_date?.split('T')[0] || '',
      max_research_choices: s.max_research_choices,
      is_active:  !!s.is_active,
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this counselling setting?')) return;
    try {
      await axios.delete(`${API}/counselling/settings/${id}`, { headers: getHeaders() });
      toast.success('Deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div>
      <h5 className="fw-bold mb-3">Counselling Application Settings</h5>

      <div className="card mb-4">
        <div className="card-header py-2 fw-semibold" style={{ fontSize: 13 }}>
          {editId ? 'Edit Setting' : 'Add New Setting'}
        </div>
        <div className="card-body">
          <form onSubmit={handleSave}>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label" style={{ fontSize: 12 }}>Session *</label>
                <select className="form-select form-select-sm" value={form.session_id}
                  onChange={e => setForm(p => ({ ...p, session_id: e.target.value }))}>
                  <option value="">Select Session</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.month} {s.year}{s.is_active ? ' (Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label" style={{ fontSize: 12 }}>Start Date *</label>
                <input type="date" className="form-control form-control-sm" value={form.start_date}
                  onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label" style={{ fontSize: 12 }}>End Date *</label>
                <input type="date" className="form-control form-control-sm" value={form.end_date}
                  onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label" style={{ fontSize: 12 }}>Max Choices</label>
                <input type="number" min={1} max={10} className="form-control form-control-sm"
                  value={form.max_research_choices}
                  onChange={e => setForm(p => ({ ...p, max_research_choices: parseInt(e.target.value) || 3 }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label" style={{ fontSize: 12 }}>Active?</label>
                <select className="form-select form-select-sm" value={form.is_active ? '1' : '0'}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.value === '1' }))}>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
              <div className="col-md-1 d-flex align-items-end gap-1">
                <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                  {saving ? '…' : editId ? 'Update' : 'Add'}
                </button>
                {editId && (
                  <button type="button" className="btn btn-sm btn-outline-secondary"
                    onClick={() => { setEditId(null); setForm({ session_id: '', start_date: '', end_date: '', max_research_choices: 3, is_active: true }); }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th className="ps-3 py-2">Session</th>
                <th className="py-2">Start Date</th>
                <th className="py-2">End Date</th>
                <th className="py-2">Max Choices</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-4">Loading…</td></tr>
              ) : settings.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-muted">No settings configured</td></tr>
              ) : settings.map(s => (
                <tr key={s.id}>
                  <td className="ps-3 fw-semibold">{s.session_name}</td>
                  <td>{s.start_date?.split('T')[0]}</td>
                  <td>{s.end_date?.split('T')[0]}</td>
                  <td>{s.max_research_choices}</td>
                  <td><Badge active={s.is_active} /></td>
                  <td className="text-center">
                    <button className="btn btn-sm btn-outline-warning border-0 me-1" onClick={() => handleEdit(s)} title="Edit"><Edit2 size={13} /></button>
                    <button className="btn btn-sm btn-outline-danger border-0" onClick={() => handleDelete(s.id)} title="Delete"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Research Centers Tab ──────────────────────────────────────────────────────

function CentersTab() {
  const [centers, setCenters]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [name, setName]         = useState('');
  const [editId, setEditId]     = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/counselling/research-centers`, { headers: getHeaders() });
      setCenters(res.data.data || []);
    } catch { toast.error('Failed to load centers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Center name is required');
    setSaving(true);
    try {
      await axios.post(`${API}/counselling/research-centers`, { center_name: name.trim() }, { headers: getHeaders() });
      toast.success('Center added'); setName(''); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return toast.error('Name is required');
    try {
      const c = centers.find(x => x.id === id);
      await axios.put(`${API}/counselling/research-centers/${id}`, { center_name: editName.trim(), is_active: c.is_active }, { headers: getHeaders() });
      toast.success('Updated'); setEditId(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleToggle = async (c) => {
    try {
      await axios.put(`${API}/counselling/research-centers/${c.id}`, { center_name: c.center_name, is_active: !c.is_active }, { headers: getHeaders() });
      load();
    } catch { toast.error('Toggle failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this research center?')) return;
    try {
      await axios.delete(`${API}/counselling/research-centers/${id}`, { headers: getHeaders() });
      toast.success('Deleted'); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div>
      <h5 className="fw-bold mb-3">Research Centers</h5>
      <form onSubmit={handleAdd} className="d-flex gap-2 mb-4">
        <input className="form-control form-control-sm" style={{ maxWidth: 300 }}
          placeholder="Center name" value={name} onChange={e => setName(e.target.value)} />
        <button type="submit" className="btn btn-sm btn-primary d-flex align-items-center gap-1" disabled={saving}>
          <Plus size={14} /> Add
        </button>
      </form>

      <div className="card">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th className="ps-3 py-2">#</th>
                <th className="py-2">Center Name</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-4">Loading…</td></tr>
              ) : centers.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-4 text-muted">No centers found</td></tr>
              ) : centers.map((c, i) => (
                <tr key={c.id}>
                  <td className="ps-3 text-muted">{i + 1}</td>
                  <td>
                    {editId === c.id ? (
                      <div className="d-flex gap-1">
                        <input className="form-control form-control-sm" style={{ maxWidth: 250 }}
                          value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                        <button className="btn btn-sm btn-success border-0" onClick={() => handleUpdate(c.id)}><Check size={13} /></button>
                        <button className="btn btn-sm btn-outline-secondary border-0" onClick={() => setEditId(null)}><X size={13} /></button>
                      </div>
                    ) : (
                      <span className="fw-semibold">{c.center_name}</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${c.is_active ? 'bg-success' : 'bg-secondary'} cursor-pointer`}
                      style={{ fontSize: 10, cursor: 'pointer' }} onClick={() => handleToggle(c)}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-center">
                    <button className="btn btn-sm btn-outline-warning border-0 me-1"
                      onClick={() => { setEditId(c.id); setEditName(c.center_name); }} title="Edit"><Edit2 size={13} /></button>
                    <button className="btn btn-sm btn-outline-danger border-0"
                      onClick={() => handleDelete(c.id)} title="Delete"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Research Supervisors Tab ──────────────────────────────────────────────────

function SupervisorsTab() {
  const [centers, setCenters]           = useState([]);
  const [supervisors, setSupervisors]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterCenter, setFilterCenter] = useState('');
  const [form, setForm]                 = useState({ research_center_id: '', supervisor_name: '', designation: '', department: '' });
  const [editId, setEditId]             = useState(null);
  const [saving, setSaving]             = useState(false);

  const loadCenters = useCallback(async () => {
    const res = await axios.get(`${API}/counselling/research-centers`, { headers: getHeaders() });
    setCenters(res.data.data || []);
  }, []);

  const loadSupervisors = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterCenter ? `?center_id=${filterCenter}` : '';
      const res = await axios.get(`${API}/counselling/research-supervisors${params}`, { headers: getHeaders() });
      setSupervisors(res.data.data || []);
    } catch { toast.error('Failed to load supervisors'); }
    finally { setLoading(false); }
  }, [filterCenter]);

  useEffect(() => { loadCenters(); }, [loadCenters]);
  useEffect(() => { loadSupervisors(); }, [loadSupervisors]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.research_center_id || !form.supervisor_name.trim()) {
      return toast.error('Research center and supervisor name are required');
    }
    setSaving(true);
    try {
      if (editId) {
        await axios.put(`${API}/counselling/research-supervisors/${editId}`, { ...form, is_active: true }, { headers: getHeaders() });
        toast.success('Updated');
      } else {
        await axios.post(`${API}/counselling/research-supervisors`, form, { headers: getHeaders() });
        toast.success('Supervisor added');
      }
      setForm({ research_center_id: form.research_center_id, supervisor_name: '', designation: '', department: '' });
      setEditId(null);
      loadSupervisors();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (s) => {
    try {
      await axios.put(`${API}/counselling/research-supervisors/${s.id}`, { ...s, is_active: !s.is_active }, { headers: getHeaders() });
      loadSupervisors();
    } catch { toast.error('Toggle failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supervisor?')) return;
    try {
      await axios.delete(`${API}/counselling/research-supervisors/${id}`, { headers: getHeaders() });
      toast.success('Deleted'); loadSupervisors();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div>
      <h5 className="fw-bold mb-3">Research Supervisors</h5>

      <div className="card mb-4">
        <div className="card-header py-2 fw-semibold" style={{ fontSize: 13 }}>
          {editId ? 'Edit Supervisor' : 'Add Supervisor'}
        </div>
        <div className="card-body">
          <form onSubmit={handleSave}>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label" style={{ fontSize: 12 }}>Research Center *</label>
                <select className="form-select form-select-sm" value={form.research_center_id}
                  onChange={e => setForm(p => ({ ...p, research_center_id: e.target.value }))}>
                  <option value="">Select Center</option>
                  {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label" style={{ fontSize: 12 }}>Supervisor Name *</label>
                <input className="form-control form-control-sm" placeholder="Dr. Name"
                  value={form.supervisor_name}
                  onChange={e => setForm(p => ({ ...p, supervisor_name: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label" style={{ fontSize: 12 }}>Designation</label>
                <input className="form-control form-control-sm" placeholder="Professor"
                  value={form.designation}
                  onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label" style={{ fontSize: 12 }}>Department</label>
                <input className="form-control form-control-sm" placeholder="Computer Science"
                  value={form.department}
                  onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
              </div>
              <div className="col-md-2 d-flex align-items-end gap-1">
                <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                  {saving ? '…' : editId ? 'Update' : 'Add'}
                </button>
                {editId && (
                  <button type="button" className="btn btn-sm btn-outline-secondary"
                    onClick={() => { setEditId(null); setForm({ research_center_id: form.research_center_id, supervisor_name: '', designation: '', department: '' }); }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="d-flex gap-2 mb-3 align-items-center">
        <label className="text-muted" style={{ fontSize: 12 }}>Filter by center:</label>
        <select className="form-select form-select-sm" style={{ maxWidth: 250 }}
          value={filterCenter} onChange={e => setFilterCenter(e.target.value)}>
          <option value="">All Centers</option>
          {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th className="ps-3 py-2">#</th>
                <th className="py-2">Supervisor</th>
                <th className="py-2">Designation</th>
                <th className="py-2">Department</th>
                <th className="py-2">Center</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-4">Loading…</td></tr>
              ) : supervisors.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-muted">No supervisors found</td></tr>
              ) : supervisors.map((s, i) => (
                <tr key={s.id}>
                  <td className="ps-3 text-muted">{i + 1}</td>
                  <td className="fw-semibold">{s.supervisor_name}</td>
                  <td>{s.designation || '—'}</td>
                  <td>{s.department || '—'}</td>
                  <td><span className="badge bg-light text-dark border">{s.center_name}</span></td>
                  <td>
                    <span className={`badge ${s.is_active ? 'bg-success' : 'bg-secondary'}`}
                      style={{ fontSize: 10, cursor: 'pointer' }} onClick={() => handleToggle(s)}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-center">
                    <button className="btn btn-sm btn-outline-warning border-0 me-1"
                      onClick={() => { setEditId(s.id); setForm({ research_center_id: s.research_center_id, supervisor_name: s.supervisor_name, designation: s.designation || '', department: s.department || '' }); }} title="Edit">
                      <Edit2 size={13} />
                    </button>
                    <button className="btn btn-sm btn-outline-danger border-0"
                      onClick={() => handleDelete(s.id)} title="Delete"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Applications Tab ──────────────────────────────────────────────────────────

function ApplicationsTab() {
  const [apps, setApps]               = useState([]);
  const [sessions, setSessions]       = useState([]);
  const [centers, setCenters]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [sessionFilter, setSessionFilter] = useState('active');
  const [statusFilter, setStatusFilter]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ session_id: sessionFilter });
      if (statusFilter) params.append('status', statusFilter);
      const res = await axios.get(`${API}/counselling/applications?${params}`, { headers: getHeaders() });
      setApps(res.data.data || []);
    } catch { toast.error('Failed to load counselling applications'); }
    finally { setLoading(false); }
  }, [sessionFilter, statusFilter]);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/sessions`, { headers: getHeaders() }),
      axios.get(`${API}/counselling/research-centers`, { headers: getHeaders() }),
    ]).then(([s, c]) => { setSessions(s.data.data || []); setCenters(c.data.data || []); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    const params = new URLSearchParams({ session_id: sessionFilter });
    window.open(`${API}/counselling/applications/export/excel?${params}&token=${localStorage.getItem('adminToken')}`, '_blank');
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">Counselling Applications</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-success d-flex align-items-center gap-1" onClick={handleExport}>
            <Download size={13} /> Export Excel
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}><RefreshCw size={13} /></button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <select className="form-select form-select-sm" style={{ maxWidth: 200 }}
              value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
              <option value="active">Active Session</option>
              <option value="all">All Sessions</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.month} {s.year}{s.is_active ? ' ✓' : ''}</option>
              ))}
            </select>
            <select className="form-select form-select-sm" style={{ maxWidth: 150 }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
            </select>
            <span className="text-muted ms-auto" style={{ fontSize: 12 }}>{apps.length} records</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th className="ps-3 py-2">#</th>
                <th className="py-2">App ID</th>
                <th className="py-2">Applicant</th>
                <th className="py-2">Session</th>
                <th className="py-2">Status</th>
                <th className="py-2">Submitted</th>
                <th className="py-2">Research Preferences</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-4">Loading…</td></tr>
              ) : apps.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-muted">No counselling applications</td></tr>
              ) : apps.map((a, i) => (
                <tr key={a.id}>
                  <td className="ps-3 text-muted">{i + 1}</td>
                  <td className="fw-bold text-primary" style={{ fontSize: 11 }}>{a.user_app_id}</td>
                  <td>
                    <div className="fw-semibold">{a.full_name}</div>
                    <small className="text-muted">{a.email}</small>
                  </td>
                  <td>{a.session_name || '—'}</td>
                  <td>
                    <span className={`badge ${a.status === 'Submitted' ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: 10 }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td>
                    <div className="d-flex flex-column gap-1">
                      {(a.choices || []).map(c => (
                        <div key={c.id} style={{ fontSize: 11 }}>
                          <span className="badge bg-light text-dark border me-1">Pref {c.preference_order}</span>
                          <strong>{c.center_name}</strong> — {c.supervisor_name}
                        </div>
                      ))}
                      {(!a.choices || a.choices.length === 0) && <span className="text-muted">No preferences</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Allotments Tab ────────────────────────────────────────────────────────────

function AllotmentsTab() {
  const [apps, setApps]                   = useState([]);
  const [sessions, setSessions]           = useState([]);
  const [centers, setCenters]             = useState([]);
  const [supervisors, setSupervisors]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [sessionFilter, setSessionFilter] = useState('active');
  const [allotFilter, setAllotFilter]     = useState('');
  const [allotting, setAllotting]         = useState(null);
  const [form, setForm]                   = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ session_id: sessionFilter });
      if (allotFilter) params.append('allotment_status', allotFilter);
      const res = await axios.get(`${API}/counselling/allotments?${params}`, { headers: getHeaders() });
      setApps(res.data.data || []);
    } catch { toast.error('Failed to load allotments'); }
    finally { setLoading(false); }
  }, [sessionFilter, allotFilter]);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/sessions`, { headers: getHeaders() }),
      axios.get(`${API}/counselling/research-centers`, { headers: getHeaders() }),
      axios.get(`${API}/counselling/research-supervisors`, { headers: getHeaders() }),
    ]).then(([s, c, sv]) => {
      setSessions(s.data.data || []);
      setCenters(c.data.data || []);
      setSupervisors(sv.data.data || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAllot = (a) => {
    setAllotting(a.id);
    setForm({
      allotment_status: a.allotment_status || 'Pending',
      allotted_center_id: a.allotted_center_id || '',
      allotted_supervisor_id: a.allotted_supervisor_id || '',
      allotment_remarks: a.allotment_remarks || '',
    });
  };

  const saveAllotment = async (id) => {
    try {
      await axios.put(`${API}/counselling/allot/${id}`, form, { headers: getHeaders() });
      toast.success('Allotment saved');
      setAllotting(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
  };

  const filteredSupervisors = form.allotted_center_id
    ? supervisors.filter(s => String(s.research_center_id) === String(form.allotted_center_id))
    : supervisors;

  const statusBadge = (s) => {
    if (s === 'Allotted')     return 'bg-success';
    if (s === 'Not Allotted') return 'bg-danger';
    return 'bg-secondary';
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">Seat Allotments</h5>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}><RefreshCw size={13} /></button>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <select className="form-select form-select-sm" style={{ maxWidth: 200 }}
              value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
              <option value="active">Active Session</option>
              <option value="all">All Sessions</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.month} {s.year}{s.is_active ? ' ✓' : ''}</option>
              ))}
            </select>
            <select className="form-select form-select-sm" style={{ maxWidth: 170 }}
              value={allotFilter} onChange={e => setAllotFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Allotted">Allotted</option>
              <option value="Not Allotted">Not Allotted</option>
            </select>
            <span className="text-muted ms-auto" style={{ fontSize: 12 }}>{apps.length} records</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th className="ps-3 py-2">#</th>
                <th className="py-2">App ID</th>
                <th className="py-2">Applicant</th>
                <th className="py-2">Preferences</th>
                <th className="py-2">Allotment Status</th>
                <th className="py-2">Allotted To</th>
                <th className="py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-4">Loading…</td></tr>
              ) : apps.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-muted">No submitted counselling applications</td></tr>
              ) : apps.map((a, i) => (
                <React.Fragment key={a.id}>
                  <tr>
                    <td className="ps-3 text-muted">{i + 1}</td>
                    <td className="fw-bold text-primary" style={{ fontSize: 11 }}>{a.user_app_id}</td>
                    <td>
                      <div className="fw-semibold">{a.full_name}</div>
                      <small className="text-muted">{a.email}</small>
                    </td>
                    <td>
                      {a.allotted_center_id ? (
                        <span className="badge bg-light text-dark border" style={{ fontSize: 10 }}>
                          {a.allotted_center_name}
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(a.allotment_status)}`} style={{ fontSize: 10 }}>
                        {a.allotment_status || 'Pending'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {a.allotment_status === 'Allotted' ? (
                        <div>
                          <div className="fw-semibold">{a.allotted_center_name}</div>
                          <div className="text-muted">{a.allotted_supervisor_name}</div>
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-center">
                      <div className="d-flex gap-1 justify-content-center">
                        <button className="btn btn-sm btn-outline-primary border-0" style={{ fontSize: 11 }}
                          onClick={() => openAllot(a)}>Allot</button>
                        {a.allotment_status === 'Allotted' && (
                          <a href={`${API}/counselling/joining-letter/${a.id}?print=1&token=${localStorage.getItem('adminToken')}`}
                            className="btn btn-sm btn-outline-success border-0" style={{ fontSize: 11 }}
                            target="_blank" rel="noreferrer">Letter</a>
                        )}
                      </div>
                    </td>
                  </tr>
                  {allotting === a.id && (
                    <tr className="table-light">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="row g-2 align-items-end">
                          <div className="col-auto">
                            <label className="form-label mb-1" style={{ fontSize: 11 }}>Status</label>
                            <select className="form-select form-select-sm" style={{ minWidth: 150 }}
                              value={form.allotment_status}
                              onChange={e => setForm(p => ({ ...p, allotment_status: e.target.value, allotted_center_id: '', allotted_supervisor_id: '' }))}>
                              <option value="Pending">Pending</option>
                              <option value="Allotted">Allotted</option>
                              <option value="Not Allotted">Not Allotted</option>
                            </select>
                          </div>
                          {form.allotment_status === 'Allotted' && (
                            <>
                              <div className="col-auto">
                                <label className="form-label mb-1" style={{ fontSize: 11 }}>Research Center *</label>
                                <select className="form-select form-select-sm" style={{ minWidth: 200 }}
                                  value={form.allotted_center_id}
                                  onChange={e => setForm(p => ({ ...p, allotted_center_id: e.target.value, allotted_supervisor_id: '' }))}>
                                  <option value="">Select Center</option>
                                  {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
                                </select>
                              </div>
                              <div className="col-auto">
                                <label className="form-label mb-1" style={{ fontSize: 11 }}>Supervisor *</label>
                                <select className="form-select form-select-sm" style={{ minWidth: 200 }}
                                  value={form.allotted_supervisor_id}
                                  onChange={e => setForm(p => ({ ...p, allotted_supervisor_id: e.target.value }))}>
                                  <option value="">Select Supervisor</option>
                                  {filteredSupervisors.map(s => (
                                    <option key={s.id} value={s.id}>{s.supervisor_name}{s.designation ? ` (${s.designation})` : ''}</option>
                                  ))}
                                </select>
                              </div>
                            </>
                          )}
                          <div className="col-auto">
                            <label className="form-label mb-1" style={{ fontSize: 11 }}>Remarks</label>
                            <input className="form-control form-control-sm" style={{ minWidth: 180 }}
                              placeholder="Optional remarks"
                              value={form.allotment_remarks}
                              onChange={e => setForm(p => ({ ...p, allotment_remarks: e.target.value }))} />
                          </div>
                          <div className="col-auto d-flex gap-1">
                            <button className="btn btn-sm btn-primary" onClick={() => saveAllotment(a.id)}>Save</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => setAllotting(null)}><X size={13} /></button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Applications Tab ───────────────────────────────────────────────────

function PreferenceRow({ pref, index, department, onCenterChange, onSupervisorChange, onRemove, removable }) {
  const [centers, setCenters]       = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loadingC, setLoadingC]     = useState(false);
  const [loadingSv, setLoadingSv]   = useState(false);

  useEffect(() => {
    if (!department) return;
    setLoadingC(true);
    axios.get(`${API}/counselling/research-centers?active=1&department=${encodeURIComponent(department)}`, { headers: getHeaders() })
      .then(r => setCenters(r.data.data || []))
      .catch(() => toast.error('Failed to load centres'))
      .finally(() => setLoadingC(false));
  }, [department]);

  useEffect(() => {
    if (!pref.center_id || !department) { setSupervisors([]); return; }
    setLoadingSv(true);
    axios.get(
      `${API}/counselling/research-supervisors?active=1&center_id=${pref.center_id}&department=${encodeURIComponent(department)}`,
      { headers: getHeaders() }
    )
      .then(r => setSupervisors(r.data.data || []))
      .catch(() => toast.error('Failed to load supervisors'))
      .finally(() => setLoadingSv(false));
  }, [pref.center_id, department]);

  return (
    <div className="border rounded p-3 mb-2 bg-light position-relative">
      <div className="d-flex align-items-center gap-2 mb-2">
        <span className="badge bg-primary" style={{ fontSize: 11 }}>Preference {index + 1}</span>
        {removable && (
          <button type="button" className="btn btn-sm btn-outline-danger border-0 ms-auto p-1"
            onClick={() => onRemove(index)} title="Remove preference">
            <X size={13} />
          </button>
        )}
      </div>
      <div className="row g-2">
        <div className="col-md-6">
          <label className="form-label mb-1" style={{ fontSize: 11 }}>Research Centre *</label>
          <select className="form-select form-select-sm" value={pref.center_id}
            onChange={e => onCenterChange(index, e.target.value)} disabled={loadingC}>
            <option value="">{loadingC ? 'Loading…' : centers.length === 0 ? 'No centres for this department' : 'Select Centre'}</option>
            {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label mb-1" style={{ fontSize: 11 }}>Supervisor *</label>
          <select className="form-select form-select-sm" value={pref.supervisor_id}
            onChange={e => onSupervisorChange(index, e.target.value)}
            disabled={!pref.center_id || loadingSv}>
            <option value="">
              {!pref.center_id ? 'Select centre first' : loadingSv ? 'Loading…' : supervisors.length === 0 ? 'No supervisors for dept/centre' : 'Select Supervisor'}
            </option>
            {supervisors.map(s => (
              <option key={s.id} value={s.id}>
                {s.supervisor_name}{s.designation ? ` — ${s.designation}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function AdminApplicationModal({ show, editApp, onHide, onSaved }) {
  const [step, setStep]               = useState(editApp ? 2 : 1);
  const [appNumber, setAppNumber]     = useState('');
  const [validating, setValidating]   = useState(false);
  const [studentInfo, setStudentInfo] = useState(editApp ? {
    user_id: editApp.user_id, application_number: editApp.user_app_id, full_name: editApp.full_name,
    email: editApp.email, department: editApp.department_filter, session_id: editApp.session_id,
    max_choices: 10,
  } : null);
  const [validError, setValidError]   = useState('');
  const [preferences, setPreferences] = useState(
    editApp?.choices?.length
      ? editApp.choices.map(c => ({ center_id: String(c.research_center_id || ''), supervisor_id: String(c.supervisor_id || '') }))
      : [{ center_id: '', supervisor_id: '' }]
  );
  const [adminNotes, setAdminNotes]   = useState(editApp?.admin_notes || '');
  const [saving, setSaving]           = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (show && step === 1 && inputRef.current) inputRef.current.focus();
  }, [show, step]);

  const validate = async () => {
    const num = appNumber.trim().toUpperCase();
    if (!num) return toast.error('Enter an application number');
    setValidating(true);
    setValidError('');
    try {
      const res = await axios.get(`${API}/counselling/admin-applications/validate/${num}`, { headers: getHeaders() });
      setStudentInfo(res.data.data);
      setStep(2);
    } catch (err) {
      const msg = err.response?.data?.message || 'Validation failed';
      setValidError(msg);
    } finally {
      setValidating(false);
    }
  };

  const addPreference = () => {
    if (!studentInfo) return;
    if (preferences.length >= (studentInfo.max_choices || 10)) {
      return toast.error(`Maximum ${studentInfo.max_choices} preferences allowed`);
    }
    setPreferences(p => [...p, { center_id: '', supervisor_id: '' }]);
  };

  const removePreference = (idx) => {
    setPreferences(p => p.filter((_, i) => i !== idx));
  };

  const handleCenterChange = (idx, centerId) => {
    setPreferences(p => p.map((pref, i) => i === idx ? { center_id: centerId, supervisor_id: '' } : pref));
  };

  const handleSupervisorChange = (idx, supervisorId) => {
    setPreferences(p => p.map((pref, i) => i === idx ? { ...pref, supervisor_id: supervisorId } : pref));
  };

  const handleSubmit = async () => {
    if (!studentInfo) return;

    // Validate completeness
    for (let i = 0; i < preferences.length; i++) {
      if (!preferences[i].center_id || !preferences[i].supervisor_id) {
        return toast.error(`Preference ${i + 1}: please select both centre and supervisor`);
      }
    }

    // Validate no duplicates
    const cIds  = preferences.map(p => p.center_id);
    const svIds = preferences.map(p => p.supervisor_id);
    if (new Set(cIds).size !== cIds.length)  return toast.error('Duplicate centre selected in preferences');
    if (new Set(svIds).size !== svIds.length) return toast.error('Duplicate supervisor selected in preferences');

    setSaving(true);
    try {
      if (editApp) {
        await axios.put(`${API}/counselling/admin-applications/${editApp.id}`,
          { preferences, admin_notes: adminNotes }, { headers: getHeaders() });
        toast.success('Application updated');
      } else {
        await axios.post(`${API}/counselling/admin-applications`, {
          user_id:            studentInfo.user_id,
          session_id:         studentInfo.session_id,
          application_number: studentInfo.application_number,
          department:         studentInfo.department,
          preferences,
          admin_notes:        adminNotes,
        }, { headers: getHeaders() });
        toast.success('Counselling application created');
      }
      onSaved();
      onHide();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header py-3" style={{ background: '#1e3a5f' }}>
            <h5 className="modal-title text-white mb-0" style={{ fontSize: 15 }}>
              <UserPlus size={16} className="me-2" />
              {editApp ? 'Edit Counselling Application' : 'Add Counselling Application'}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onHide} />
          </div>

          <div className="modal-body">
            {/* ── Step 1: Application Number Validation ── */}
            {step === 1 && (
              <div>
                <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                  Enter the student's application number to validate eligibility and auto-populate their details.
                </p>
                <div className="input-group mb-3">
                  <span className="input-group-text bg-light" style={{ fontSize: 13 }}>
                    <Search size={14} />
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    className="form-control"
                    placeholder="e.g. APP202600123"
                    value={appNumber}
                    onChange={e => { setAppNumber(e.target.value.toUpperCase()); setValidError(''); }}
                    onKeyDown={e => e.key === 'Enter' && validate()}
                    style={{ fontSize: 14, letterSpacing: 1 }}
                  />
                  <button className="btn btn-primary" onClick={validate} disabled={validating || !appNumber.trim()}>
                    {validating ? <span className="spinner-border spinner-border-sm me-1" /> : <Search size={14} className="me-1" />}
                    {validating ? 'Validating…' : 'Validate Application'}
                  </button>
                </div>
                {validError && (
                  <div className="alert alert-danger py-2 px-3" style={{ fontSize: 13 }}>
                    {validError}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Student Info + Preferences ── */}
            {step === 2 && studentInfo && (
              <div>
                {/* Student Info Card */}
                <div className="card mb-4 border-success">
                  <div className="card-header bg-success text-white py-2 d-flex align-items-center gap-2" style={{ fontSize: 12 }}>
                    <Check size={14} /> Student Validated
                  </div>
                  <div className="card-body py-2">
                    <div className="row g-2" style={{ fontSize: 13 }}>
                      <div className="col-md-4">
                        <span className="text-muted">Application No.</span><br />
                        <strong className="text-primary">{studentInfo.application_number}</strong>
                      </div>
                      <div className="col-md-4">
                        <span className="text-muted">Applicant Name</span><br />
                        <strong>{studentInfo.full_name}</strong>
                      </div>
                      <div className="col-md-4">
                        <span className="text-muted">Email</span><br />
                        <span>{studentInfo.email}</span>
                      </div>
                      <div className="col-md-4">
                        <span className="text-muted">Department / Subject</span><br />
                        <strong className="text-info">{studentInfo.department || '—'}</strong>
                      </div>
                      <div className="col-md-4">
                        <span className="text-muted">Community</span><br />
                        <span>{studentInfo.community || '—'}</span>
                      </div>
                      <div className="col-md-4">
                        <span className="text-muted">Category</span><br />
                        <span>{studentInfo.category || '—'}</span>
                      </div>
                    </div>
                    {!editApp && (
                      <div className="mt-2 pt-2 border-top">
                        <small className="text-muted">
                          Centres and supervisors are filtered to match the student's department:&nbsp;
                          <strong>{studentInfo.department}</strong>.
                          Max preferences: <strong>{studentInfo.max_choices}</strong>.
                        </small>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preferences */}
                <div className="mb-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <h6 className="fw-bold mb-0" style={{ fontSize: 14 }}>Research Preferences</h6>
                    <span className="badge bg-secondary" style={{ fontSize: 10 }}>{preferences.length} / {studentInfo.max_choices}</span>
                  </div>
                  <small className="text-muted d-block mb-3" style={{ fontSize: 12 }}>
                    Centres shown are those with supervisors in <strong>{studentInfo.department}</strong>. Supervisors are further filtered by selected centre.
                  </small>

                  {preferences.map((pref, idx) => (
                    <PreferenceRow
                      key={idx}
                      pref={pref}
                      index={idx}
                      department={studentInfo.department}
                      onCenterChange={handleCenterChange}
                      onSupervisorChange={handleSupervisorChange}
                      onRemove={removePreference}
                      removable={preferences.length > 1}
                    />
                  ))}

                  {preferences.length < (studentInfo.max_choices || 10) && (
                    <button type="button" className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                      onClick={addPreference}>
                      <Plus size={13} /> Add Preference
                    </button>
                  )}
                </div>

                {/* Admin Notes */}
                <div className="mb-2">
                  <label className="form-label" style={{ fontSize: 12 }}>Admin Notes (optional)</label>
                  <textarea className="form-control form-control-sm" rows={2} placeholder="Internal notes…"
                    value={adminNotes} onChange={e => setAdminNotes(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer py-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onHide}>Cancel</button>
            {step === 2 && (
              <button type="button" className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                onClick={handleSubmit} disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm" />}
                {editApp ? 'Save Changes' : 'Create Counselling Application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminApplicationsTab() {
  const [apps, setApps]               = useState([]);
  const [sessions, setSessions]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [sessionFilter, setSessionFilter] = useState('active');
  const [statusFilter, setStatusFilter]   = useState('');
  const [search, setSearch]           = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [editApp, setEditApp]         = useState(null);
  const [expanded, setExpanded]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ session_id: sessionFilter });
      if (statusFilter) params.append('status', statusFilter);
      if (search)       params.append('search', search);
      const res = await axios.get(`${API}/counselling/admin-applications?${params}`, { headers: getHeaders() });
      setApps(res.data.data || []);
    } catch { toast.error('Failed to load admin applications'); }
    finally { setLoading(false); }
  }, [sessionFilter, statusFilter, search]);

  useEffect(() => {
    axios.get(`${API}/sessions`, { headers: getHeaders() })
      .then(r => setSessions(r.data.data || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this counselling application? This action cannot be undone.')) return;
    try {
      await axios.delete(`${API}/counselling/admin-applications/${id}`, { headers: getHeaders() });
      toast.success('Application cancelled');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Cancel failed'); }
  };

  const openEdit = (app) => { setEditApp(app); setShowModal(true); };

  const statusBadge = (s) => {
    if (s === 'Submitted') return 'bg-success';
    if (s === 'Cancelled') return 'bg-danger';
    return 'bg-secondary';
  };

  return (
    <div>
      {showModal && (
        <AdminApplicationModal
          show={showModal}
          editApp={editApp}
          onHide={() => { setShowModal(false); setEditApp(null); }}
          onSaved={load}
        />
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">Admin-Created Counselling Applications</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-primary d-flex align-items-center gap-1"
            onClick={() => { setEditApp(null); setShowModal(true); }}>
            <UserPlus size={14} /> Add Counselling Application
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={load}><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <select className="form-select form-select-sm" style={{ maxWidth: 200 }}
              value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
              <option value="active">Active Session</option>
              <option value="all">All Sessions</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.month} {s.year}{s.is_active ? ' ✓' : ''}</option>
              ))}
            </select>
            <select className="form-select form-select-sm" style={{ maxWidth: 160 }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <div className="input-group input-group-sm" style={{ maxWidth: 240 }}>
              <span className="input-group-text"><Search size={12} /></span>
              <input className="form-control" placeholder="Search by name or app no."
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && load()} />
            </div>
            <span className="text-muted ms-auto" style={{ fontSize: 12 }}>{apps.length} records</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body p-0">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th className="ps-3 py-2">#</th>
                <th className="py-2">App ID</th>
                <th className="py-2">Applicant</th>
                <th className="py-2">Department</th>
                <th className="py-2">Session</th>
                <th className="py-2">Status</th>
                <th className="py-2">Preferences</th>
                <th className="py-2">Created</th>
                <th className="py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-4">Loading…</td></tr>
              ) : apps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-5 text-muted">
                    <UserPlus size={32} className="d-block mx-auto mb-2 opacity-25" />
                    No admin-created counselling applications found.
                    <br />
                    <button className="btn btn-sm btn-primary mt-2"
                      onClick={() => { setEditApp(null); setShowModal(true); }}>
                      <Plus size={13} className="me-1" /> Add First Application
                    </button>
                  </td>
                </tr>
              ) : apps.map((a, i) => (
                <React.Fragment key={a.id}>
                  <tr className={a.status === 'Cancelled' ? 'table-secondary' : ''}>
                    <td className="ps-3 text-muted">{i + 1}</td>
                    <td className="fw-bold text-primary" style={{ fontSize: 11 }}>{a.user_app_id}</td>
                    <td>
                      <div className="fw-semibold">{a.full_name}</div>
                      <small className="text-muted">{a.email}</small>
                    </td>
                    <td>
                      <span className="badge bg-info text-dark" style={{ fontSize: 10 }}>
                        {a.department_filter || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11 }}>{a.session_name || '—'}</td>
                    <td>
                      <span className={`badge ${statusBadge(a.status)}`} style={{ fontSize: 10 }}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-link p-0 text-decoration-none d-flex align-items-center gap-1"
                        style={{ fontSize: 11 }}
                        onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                        {a.choices?.length || 0} preference{a.choices?.length !== 1 ? 's' : ''}
                        {expanded === a.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="text-center">
                      <div className="d-flex gap-1 justify-content-center">
                        {a.status !== 'Cancelled' && (
                          <>
                            <button className="btn btn-sm btn-outline-warning border-0"
                              onClick={() => openEdit(a)} title="Edit"><Edit2 size={13} /></button>
                            <button className="btn btn-sm btn-outline-danger border-0"
                              onClick={() => handleCancel(a.id)} title="Cancel"><X size={13} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === a.id && (
                    <tr className="table-light">
                      <td colSpan={9} className="px-4 py-2">
                        {a.choices?.length === 0
                          ? <span className="text-muted" style={{ fontSize: 12 }}>No preferences recorded.</span>
                          : (
                            <div className="d-flex flex-column gap-1">
                              {a.choices.map(c => (
                                <div key={c.id} className="d-flex align-items-center gap-2" style={{ fontSize: 12 }}>
                                  <span className="badge bg-primary" style={{ fontSize: 10, minWidth: 75 }}>
                                    Preference {c.preference_order}
                                  </span>
                                  <strong>{c.center_name}</strong>
                                  <span className="text-muted">—</span>
                                  <span>{c.supervisor_name}</span>
                                  {c.designation && <span className="text-muted">({c.designation})</span>}
                                </div>
                              ))}
                            </div>
                          )
                        }
                        {a.admin_notes && (
                          <div className="mt-2 pt-2 border-top text-muted" style={{ fontSize: 11 }}>
                            <strong>Notes:</strong> {a.admin_notes}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Counselling Management ──────────────────────────────────────────────

const TABS = [
  { key: 'settings',          label: 'Settings' },
  { key: 'centers',           label: 'Research Centers' },
  { key: 'supervisors',       label: 'Supervisors' },
  { key: 'applications',      label: 'Applications' },
  { key: 'allotments',        label: 'Allotments' },
  { key: 'admin-applications', label: 'Admin Applications' },
];

const CounsellingManagement = () => {
  const [activeTab, setActiveTab] = useState('settings');

  return (
    <div>
      <div className="mb-3">
        <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: '22px' }}>Counselling Management</h2>
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0" style={{ fontSize: '12px' }}>
            <li className="breadcrumb-item"><a href="/" className="text-decoration-none">Home</a></li>
            <li className="breadcrumb-item active">Counselling</li>
          </ol>
        </nav>
      </div>

      <ul className="nav nav-tabs mb-4" style={{ fontSize: 13 }}>
        {TABS.map(t => (
          <li className="nav-item" key={t.key}>
            <button
              className={`nav-link ${activeTab === t.key ? 'active fw-semibold' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'settings'           && <SettingsTab />}
      {activeTab === 'centers'            && <CentersTab />}
      {activeTab === 'supervisors'        && <SupervisorsTab />}
      {activeTab === 'applications'       && <ApplicationsTab />}
      {activeTab === 'allotments'         && <AllotmentsTab />}
      {activeTab === 'admin-applications' && <AdminApplicationsTab />}
    </div>
  );
};

export default CounsellingManagement;
