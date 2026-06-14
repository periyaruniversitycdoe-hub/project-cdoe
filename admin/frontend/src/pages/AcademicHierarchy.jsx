import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, ChevronRight, ToggleLeft, ToggleRight, BookOpen, Layers, Tag, Search, X } from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/academic-hierarchy';
const hdrs = () => ({ Authorization: `Bearer ${localStorage.getItem('adminToken')}` });

// ── Small reusable badge ──────────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span className={`badge rounded-pill px-2 py-1 ${status === 'active' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`} style={{ fontSize: 10 }}>
    {status === 'active' ? 'Active' : 'Inactive'}
  </span>
);

// ── Inline form card ──────────────────────────────────────────────────────────
const FormCard = ({ title, onClose, children }) => (
  <div className="card border-primary shadow-sm mb-3">
    <div className="card-header bg-primary bg-opacity-10 d-flex justify-content-between align-items-center py-2">
      <span className="fw-semibold text-primary" style={{ fontSize: 13 }}>{title}</span>
      <button className="btn btn-sm btn-link text-muted p-0" onClick={onClose}><X size={15}/></button>
    </div>
    <div className="card-body py-3">{children}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
export default function AcademicHierarchy() {
  const [tab, setTab] = useState('faculty');

  // ── Faculty state ──
  const [faculties,      setFaculties]      = useState([]);
  const [facFilter,      setFacFilter]      = useState('');
  const [facForm,        setFacForm]        = useState({ faculty_name: '' });
  const [editingFacId,   setEditingFacId]   = useState(null);
  const [showFacForm,    setShowFacForm]    = useState(false);
  const [facLoading,     setFacLoading]     = useState(false);

  // ── Discipline state ──
  const [disciplines,    setDisciplines]    = useState([]);
  const [discFacFilter,  setDiscFacFilter]  = useState('');
  const [discFilter,     setDiscFilter]     = useState('');
  const [discForm,       setDiscForm]       = useState({ faculty_id: '', discipline_name: '' });
  const [editingDiscId,  setEditingDiscId]  = useState(null);
  const [showDiscForm,   setShowDiscForm]   = useState(false);
  const [discLoading,    setDiscLoading]    = useState(false);

  // ── Specialization state ──
  const [specializations, setSpecializations] = useState([]);
  const [specFacFilter,   setSpecFacFilter]   = useState('');
  const [specDiscFilter,  setSpecDiscFilter]  = useState('');
  const [specFilter,      setSpecFilter]      = useState('');
  const [specForm,        setSpecForm]        = useState({ discipline_id: '', specialization_name: '' });
  const [editingSpecId,   setEditingSpecId]   = useState(null);
  const [showSpecForm,    setShowSpecForm]    = useState(false);
  const [specLoading,     setSpecLoading]     = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadFaculties = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/faculties`, { headers: hdrs() });
      setFaculties(r.data.data || []);
    } catch { toast.error('Failed to load faculties'); }
  }, []);

  const loadDisciplines = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/disciplines`, { headers: hdrs() });
      setDisciplines(r.data.data || []);
    } catch { toast.error('Failed to load disciplines'); }
  }, []);

  const loadSpecializations = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/specializations`, { headers: hdrs() });
      setSpecializations(r.data.data || []);
    } catch { toast.error('Failed to load specializations'); }
  }, []);

  useEffect(() => {
    loadFaculties();
    loadDisciplines();
    loadSpecializations();
  }, [loadFaculties, loadDisciplines, loadSpecializations]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetFacForm = () => { setFacForm({ faculty_name: '' }); setEditingFacId(null); setShowFacForm(false); };
  const resetDiscForm = () => { setDiscForm({ faculty_id: '', discipline_name: '' }); setEditingDiscId(null); setShowDiscForm(false); };
  const resetSpecForm = () => { setSpecForm({ discipline_id: '', specialization_name: '' }); setEditingSpecId(null); setShowSpecForm(false); };

  // ── FACULTY handlers ──────────────────────────────────────────────────────
  const handleFacSubmit = async (e) => {
    e.preventDefault();
    if (!facForm.faculty_name.trim()) { toast.error('Faculty name is required'); return; }
    setFacLoading(true);
    try {
      if (editingFacId) {
        await axios.put(`${API}/faculties/${editingFacId}`, facForm, { headers: hdrs() });
        toast.success('Faculty updated');
      } else {
        await axios.post(`${API}/faculties`, facForm, { headers: hdrs() });
        toast.success('Faculty created');
      }
      resetFacForm();
      loadFaculties();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setFacLoading(false); }
  };

  const handleFacEdit = (fac) => {
    setFacForm({ faculty_name: fac.faculty_name });
    setEditingFacId(fac.id);
    setShowFacForm(true);
  };

  const handleFacToggle = async (fac) => {
    try {
      const r = await axios.patch(`${API}/faculties/${fac.id}/toggle`, {}, { headers: hdrs() });
      toast.success(r.data.message);
      loadFaculties();
    } catch (err) { toast.error(err.response?.data?.message || 'Toggle failed'); }
  };

  const handleFacDelete = async (fac) => {
    if (!window.confirm(`Delete faculty "${fac.faculty_name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/faculties/${fac.id}`, { headers: hdrs() });
      toast.success('Faculty deleted');
      loadFaculties();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  // ── DISCIPLINE handlers ───────────────────────────────────────────────────
  const handleDiscSubmit = async (e) => {
    e.preventDefault();
    if (!discForm.faculty_id) { toast.error('Select a faculty'); return; }
    if (!discForm.discipline_name.trim()) { toast.error('Discipline name is required'); return; }
    setDiscLoading(true);
    try {
      if (editingDiscId) {
        await axios.put(`${API}/disciplines/${editingDiscId}`, discForm, { headers: hdrs() });
        toast.success('Discipline updated');
      } else {
        await axios.post(`${API}/disciplines`, discForm, { headers: hdrs() });
        toast.success('Discipline created');
      }
      resetDiscForm();
      loadDisciplines();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setDiscLoading(false); }
  };

  const handleDiscEdit = (disc) => {
    setDiscForm({ faculty_id: disc.faculty_id, discipline_name: disc.discipline_name });
    setEditingDiscId(disc.id);
    setShowDiscForm(true);
  };

  const handleDiscToggle = async (disc) => {
    try {
      const r = await axios.patch(`${API}/disciplines/${disc.id}/toggle`, {}, { headers: hdrs() });
      toast.success(r.data.message);
      loadDisciplines();
    } catch (err) { toast.error(err.response?.data?.message || 'Toggle failed'); }
  };

  const handleDiscDelete = async (disc) => {
    if (!window.confirm(`Delete discipline "${disc.discipline_name}"?`)) return;
    try {
      await axios.delete(`${API}/disciplines/${disc.id}`, { headers: hdrs() });
      toast.success('Discipline deleted');
      loadDisciplines();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  // ── SPECIALIZATION handlers ───────────────────────────────────────────────
  const handleSpecSubmit = async (e) => {
    e.preventDefault();
    if (!specForm.discipline_id) { toast.error('Select a discipline'); return; }
    if (!specForm.specialization_name.trim()) { toast.error('Specialization name is required'); return; }
    setSpecLoading(true);
    try {
      if (editingSpecId) {
        await axios.put(`${API}/specializations/${editingSpecId}`, specForm, { headers: hdrs() });
        toast.success('Specialization updated');
      } else {
        await axios.post(`${API}/specializations`, specForm, { headers: hdrs() });
        toast.success('Specialization created');
      }
      resetSpecForm();
      loadSpecializations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSpecLoading(false); }
  };

  const handleSpecEdit = (spec) => {
    setSpecForm({ discipline_id: spec.discipline_id, specialization_name: spec.specialization_name });
    setEditingSpecId(spec.id);
    setShowSpecForm(true);
  };

  const handleSpecToggle = async (spec) => {
    try {
      const r = await axios.patch(`${API}/specializations/${spec.id}/toggle`, {}, { headers: hdrs() });
      toast.success(r.data.message);
      loadSpecializations();
    } catch (err) { toast.error(err.response?.data?.message || 'Toggle failed'); }
  };

  const handleSpecDelete = async (spec) => {
    if (!window.confirm(`Delete specialization "${spec.specialization_name}"?`)) return;
    try {
      await axios.delete(`${API}/specializations/${spec.id}`, { headers: hdrs() });
      toast.success('Specialization deleted');
      loadSpecializations();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const filteredFaculties = faculties.filter(f =>
    !facFilter || f.faculty_name.toLowerCase().includes(facFilter.toLowerCase())
  );

  const filteredDisciplines = disciplines.filter(d => {
    const matchFac  = !discFacFilter || String(d.faculty_id) === discFacFilter;
    const matchName = !discFilter || d.discipline_name.toLowerCase().includes(discFilter.toLowerCase());
    return matchFac && matchName;
  });

  // Disciplines filtered for the specialization section's faculty filter
  const discForSpecFac = discFacFilter
    ? disciplines.filter(d => String(d.faculty_id) === specFacFilter)
    : disciplines;

  const filteredSpecializations = specializations.filter(s => {
    const disc = disciplines.find(d => d.id === s.discipline_id);
    const matchFac  = !specFacFilter || (disc && String(disc.faculty_id) === specFacFilter);
    const matchDisc = !specDiscFilter || String(s.discipline_id) === specDiscFilter;
    const matchName = !specFilter || s.name.toLowerCase().includes(specFilter.toLowerCase());
    return matchFac && matchDisc && matchName;
  });

  const specDiscOptions = specFacFilter
    ? disciplines.filter(d => String(d.faculty_id) === specFacFilter)
    : disciplines;

  // ── Tab labels ────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'faculty',        label: 'Faculty Master',        icon: <BookOpen size={15}/>, count: faculties.length },
    { key: 'discipline',     label: 'Discipline Master',     icon: <Layers size={15}/>,   count: disciplines.length },
    { key: 'specialization', label: 'Specialization Master', icon: <Tag size={15}/>,      count: specializations.length },
  ];

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <div className="p-2 rounded-3 bg-primary bg-opacity-10">
          <Layers size={22} className="text-primary"/>
        </div>
        <div>
          <h4 className="fw-bold mb-0">Academic Hierarchy</h4>
          <p className="text-muted mb-0" style={{ fontSize: 12 }}>
            Manage Faculty → Discipline → Specialization hierarchy used in student registration forms
          </p>
        </div>
      </div>

      {/* Hierarchy diagram */}
      <div className="alert alert-info border-0 mb-4 d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: 13 }}>
        <BookOpen size={15}/> <strong>Faculty</strong>
        <ChevronRight size={14} className="text-muted"/>
        <Layers size={15}/> <strong>Discipline</strong>
        <ChevronRight size={14} className="text-muted"/>
        <Tag size={15}/> <strong>Specialization</strong>
        <span className="ms-2 text-muted">— Each level is mapped under its parent. Students select from dependent cascading dropdowns.</span>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4 border-bottom">
        {TABS.map(t => (
          <li key={t.key} className="nav-item">
            <button
              className={`nav-link d-flex align-items-center gap-2 ${tab === t.key ? 'active fw-semibold' : 'text-muted'}`}
              onClick={() => setTab(t.key)}
            >
              {t.icon} {t.label}
              <span className={`badge rounded-pill ${tab === t.key ? 'bg-primary' : 'bg-secondary'}`} style={{ fontSize: 10 }}>
                {t.count}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* ── FACULTY TAB ───────────────────────────────────────────────────── */}
      {tab === 'faculty' && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="input-group" style={{ maxWidth: 280 }}>
              <span className="input-group-text bg-white"><Search size={14}/></span>
              <input className="form-control form-control-sm" placeholder="Search faculties…" value={facFilter} onChange={e => setFacFilter(e.target.value)}/>
            </div>
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => { resetFacForm(); setShowFacForm(true); }}>
              <Plus size={14}/> Add Faculty
            </button>
          </div>

          {showFacForm && (
            <FormCard title={editingFacId ? 'Edit Faculty' : 'Add New Faculty'} onClose={resetFacForm}>
              <form onSubmit={handleFacSubmit} className="row g-2 align-items-end">
                <div className="col-md-8">
                  <label className="form-label small fw-semibold mb-1">Faculty Name <span className="text-danger">*</span></label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="e.g. Science, Arts, Commerce, Technology"
                    value={facForm.faculty_name}
                    onChange={e => setFacForm(f => ({ ...f, faculty_name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="col-md-4 d-flex gap-2">
                  <button type="submit" className="btn btn-success btn-sm flex-fill" disabled={facLoading}>
                    {facLoading ? <span className="spinner-border spinner-border-sm"/> : (editingFacId ? 'Update' : 'Create')}
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetFacForm}>Cancel</button>
                </div>
              </form>
            </FormCard>
          )}

          <div className="card shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Faculty Name</th>
                    <th className="text-center">Disciplines</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaculties.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-muted py-4">No faculties found. Click "Add Faculty" to create one.</td></tr>
                  ) : filteredFaculties.map((f, i) => (
                    <tr key={f.id}>
                      <td className="text-muted">{i + 1}</td>
                      <td>
                        <div className="fw-semibold">{f.faculty_name}</div>
                        <div className="text-muted" style={{ fontSize: 10 }}>ID: {f.id} · Added {new Date(f.created_at).toLocaleDateString('en-IN')}</div>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-info-subtle text-info rounded-pill">{f.discipline_count || 0}</span>
                      </td>
                      <td className="text-center"><StatusBadge status={f.status}/></td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-1">
                          <button className="btn btn-sm btn-outline-primary py-0 px-2" onClick={() => handleFacEdit(f)} title="Edit"><Edit2 size={12}/></button>
                          <button className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={() => handleFacToggle(f)} title={f.status === 'active' ? 'Disable' : 'Enable'}>
                            {f.status === 'active' ? <ToggleRight size={14} className="text-success"/> : <ToggleLeft size={14}/>}
                          </button>
                          <button className="btn btn-sm btn-outline-danger py-0 px-2" onClick={() => handleFacDelete(f)} title="Delete"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DISCIPLINE TAB ─────────────────────────────────────────────────── */}
      {tab === 'discipline' && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div className="d-flex gap-2 flex-wrap">
              <select className="form-select form-select-sm" style={{ width: 180 }} value={discFacFilter} onChange={e => setDiscFacFilter(e.target.value)}>
                <option value="">All Faculties</option>
                {faculties.map(f => <option key={f.id} value={f.id}>{f.faculty_name}</option>)}
              </select>
              <div className="input-group" style={{ maxWidth: 240 }}>
                <span className="input-group-text bg-white"><Search size={14}/></span>
                <input className="form-control form-control-sm" placeholder="Search disciplines…" value={discFilter} onChange={e => setDiscFilter(e.target.value)}/>
              </div>
            </div>
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => { resetDiscForm(); setShowDiscForm(true); }}>
              <Plus size={14}/> Add Discipline
            </button>
          </div>

          {showDiscForm && (
            <FormCard title={editingDiscId ? 'Edit Discipline' : 'Add New Discipline'} onClose={resetDiscForm}>
              <form onSubmit={handleDiscSubmit} className="row g-2 align-items-end">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold mb-1">Faculty <span className="text-danger">*</span></label>
                  <select
                    className="form-select form-select-sm"
                    value={discForm.faculty_id}
                    onChange={e => setDiscForm(f => ({ ...f, faculty_id: e.target.value }))}
                  >
                    <option value="">— Select Faculty —</option>
                    {faculties.map(f => <option key={f.id} value={f.id}>{f.faculty_name}</option>)}
                  </select>
                </div>
                <div className="col-md-5">
                  <label className="form-label small fw-semibold mb-1">Discipline Name <span className="text-danger">*</span></label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="e.g. Computer Science, Mathematics, Physics"
                    value={discForm.discipline_name}
                    onChange={e => setDiscForm(f => ({ ...f, discipline_name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="col-md-3 d-flex gap-2">
                  <button type="submit" className="btn btn-success btn-sm flex-fill" disabled={discLoading}>
                    {discLoading ? <span className="spinner-border spinner-border-sm"/> : (editingDiscId ? 'Update' : 'Create')}
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetDiscForm}>Cancel</button>
                </div>
              </form>
            </FormCard>
          )}

          <div className="card shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Faculty</th>
                    <th>Discipline Name</th>
                    <th className="text-center">Specializations</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDisciplines.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-muted py-4">No disciplines found. Click "Add Discipline" to create one.</td></tr>
                  ) : filteredDisciplines.map((d, i) => (
                    <tr key={d.id}>
                      <td className="text-muted">{i + 1}</td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary rounded-pill px-2">{d.faculty_name}</span>
                      </td>
                      <td>
                        <div className="fw-semibold">{d.discipline_name}</div>
                        <div className="text-muted" style={{ fontSize: 10 }}>ID: {d.id}</div>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-info-subtle text-info rounded-pill">{d.specialization_count || 0}</span>
                      </td>
                      <td className="text-center"><StatusBadge status={d.status}/></td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-1">
                          <button className="btn btn-sm btn-outline-primary py-0 px-2" onClick={() => handleDiscEdit(d)} title="Edit"><Edit2 size={12}/></button>
                          <button className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={() => handleDiscToggle(d)} title={d.status === 'active' ? 'Disable' : 'Enable'}>
                            {d.status === 'active' ? <ToggleRight size={14} className="text-success"/> : <ToggleLeft size={14}/>}
                          </button>
                          <button className="btn btn-sm btn-outline-danger py-0 px-2" onClick={() => handleDiscDelete(d)} title="Delete"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SPECIALIZATION TAB ─────────────────────────────────────────────── */}
      {tab === 'specialization' && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div className="d-flex gap-2 flex-wrap">
              <select className="form-select form-select-sm" style={{ width: 160 }} value={specFacFilter} onChange={e => { setSpecFacFilter(e.target.value); setSpecDiscFilter(''); }}>
                <option value="">All Faculties</option>
                {faculties.map(f => <option key={f.id} value={f.id}>{f.faculty_name}</option>)}
              </select>
              <select className="form-select form-select-sm" style={{ width: 200 }} value={specDiscFilter} onChange={e => setSpecDiscFilter(e.target.value)}>
                <option value="">All Disciplines</option>
                {specDiscOptions.map(d => <option key={d.id} value={d.id}>{d.name || d.discipline_name}</option>)}
              </select>
              <div className="input-group" style={{ maxWidth: 220 }}>
                <span className="input-group-text bg-white"><Search size={14}/></span>
                <input className="form-control form-control-sm" placeholder="Search…" value={specFilter} onChange={e => setSpecFilter(e.target.value)}/>
              </div>
            </div>
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => { resetSpecForm(); setShowSpecForm(true); }}>
              <Plus size={14}/> Add Specialization
            </button>
          </div>

          {showSpecForm && (
            <FormCard title={editingSpecId ? 'Edit Specialization' : 'Add New Specialization'} onClose={resetSpecForm}>
              <form onSubmit={handleSpecSubmit} className="row g-2 align-items-end">
                <div className="col-md-3">
                  <label className="form-label small fw-semibold mb-1">Faculty</label>
                  <select
                    className="form-select form-select-sm"
                    value={specForm._facultyId || ''}
                    onChange={e => setSpecForm(f => ({ ...f, _facultyId: e.target.value, discipline_id: '' }))}
                  >
                    <option value="">— Select Faculty —</option>
                    {faculties.map(f => <option key={f.id} value={f.id}>{f.faculty_name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold mb-1">Discipline <span className="text-danger">*</span></label>
                  <select
                    className="form-select form-select-sm"
                    value={specForm.discipline_id}
                    onChange={e => setSpecForm(f => ({ ...f, discipline_id: e.target.value }))}
                  >
                    <option value="">— Select Discipline —</option>
                    {(specForm._facultyId
                      ? disciplines.filter(d => String(d.faculty_id) === specForm._facultyId)
                      : disciplines
                    ).map(d => <option key={d.id} value={d.id}>{d.discipline_name || d.name}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold mb-1">Specialization Name <span className="text-danger">*</span></label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="e.g. Artificial Intelligence, Data Science"
                    value={specForm.specialization_name}
                    onChange={e => setSpecForm(f => ({ ...f, specialization_name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="col-md-2 d-flex gap-2">
                  <button type="submit" className="btn btn-success btn-sm flex-fill" disabled={specLoading}>
                    {specLoading ? <span className="spinner-border spinner-border-sm"/> : (editingSpecId ? 'Update' : 'Create')}
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetSpecForm}>Cancel</button>
                </div>
              </form>
            </FormCard>
          )}

          <div className="card shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Faculty</th>
                    <th>Discipline</th>
                    <th>Specialization Name</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSpecializations.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-muted py-4">No specializations found. Click "Add Specialization" to create one.</td></tr>
                  ) : filteredSpecializations.map((s, i) => {
                    const disc = disciplines.find(d => d.id === s.discipline_id);
                    const fac  = disc ? faculties.find(f => f.id === disc.faculty_id) : null;
                    return (
                      <tr key={s.id}>
                        <td className="text-muted">{i + 1}</td>
                        <td><span className="badge bg-primary-subtle text-primary rounded-pill px-2">{s.faculty_name || fac?.faculty_name || '—'}</span></td>
                        <td><span className="badge bg-secondary-subtle text-secondary rounded-pill px-2">{s.discipline_name || disc?.discipline_name || disc?.name || '—'}</span></td>
                        <td>
                          <div className="fw-semibold">{s.name || s.specialization_name}</div>
                          <div className="text-muted" style={{ fontSize: 10 }}>ID: {s.id}</div>
                        </td>
                        <td className="text-center"><StatusBadge status={s.status}/></td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-1">
                            <button className="btn btn-sm btn-outline-primary py-0 px-2" onClick={() => handleSpecEdit(s)} title="Edit"><Edit2 size={12}/></button>
                            <button className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={() => handleSpecToggle(s)} title={s.status === 'active' ? 'Disable' : 'Enable'}>
                              {s.status === 'active' ? <ToggleRight size={14} className="text-success"/> : <ToggleLeft size={14}/>}
                            </button>
                            <button className="btn btn-sm btn-outline-danger py-0 px-2" onClick={() => handleSpecDelete(s)} title="Delete"><Trash2 size={12}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
