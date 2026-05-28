import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Plus, Trash2, Pencil, Check, X, ChevronRight,
  BookOpen, GraduationCap, ListChecks, Building2
} from 'lucide-react';

const API = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;

const token = () => localStorage.getItem('adminToken');
const authHeader = () => ({ Authorization: `Bearer ${token()}` });

// ── tiny inline-edit component ────────────────────────────────────────────────
function InlineEdit({ value, onSave, onCancel }) {
  const [v, setV] = useState(value);
  return (
    <div className="d-flex align-items-center gap-1 flex-grow-1">
      <input
        autoFocus
        className="form-control form-control-sm"
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(v); if (e.key === 'Escape') onCancel(); }}
      />
      <button className="btn btn-sm btn-success border-0 p-1" onClick={() => onSave(v)}><Check size={14}/></button>
      <button className="btn btn-sm btn-secondary border-0 p-1" onClick={onCancel}><X size={14}/></button>
    </div>
  );
}

// ── course-list panel (PG or MPhil) ──────────────────────────────────────────
function CoursePanel({ programId, type, label }) {
  const [courses, setCourses] = useState([]);
  const [newCourse, setNewCourse] = useState('');
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!programId) return;
    try {
      const r = await axios.get(`${API}/eligibility/programs/${programId}/${type}`);
      setCourses(r.data.data || []);
    } catch { toast.error(`Failed to load ${label} courses`); }
  }, [programId, type, label]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async () => {
    if (!newCourse.trim()) return;
    try {
      await axios.post(
        `${API}/eligibility/programs/${programId}/${type}`,
        { course_name: newCourse.trim() },
        { headers: authHeader() }
      );
      setNewCourse('');
      fetch();
      toast.success('Course added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add course');
    }
  };

  const remove = async (courseId) => {
    if (!window.confirm('Remove this course mapping?')) return;
    try {
      await axios.delete(`${API}/eligibility/programs/${programId}/${type}/${courseId}`, { headers: authHeader() });
      fetch();
      toast.success('Course removed');
    } catch { toast.error('Failed to remove course'); }
  };

  return (
    <div className="mb-3">
      <div className="d-flex align-items-center gap-2 mb-2">
        <ListChecks size={14} className="text-info" />
        <span className="fw-semibold text-dark" style={{ fontSize: 13 }}>
          {label} Eligible Courses
          <span className="badge bg-light text-secondary ms-1 border" style={{ fontSize: 10 }}>{courses.length}</span>
        </span>
      </div>
      <div className="d-flex gap-2 mb-2">
        <input
          className="form-control form-control-sm"
          placeholder={`Add ${label} course…`}
          value={newCourse}
          onChange={e => setNewCourse(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <button className="btn btn-sm btn-outline-primary px-3" onClick={add} disabled={!newCourse.trim()}>
          <Plus size={14} />
        </button>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {loading && <div className="text-muted small">Loading…</div>}
        {courses.length === 0 && !loading && (
          <div className="text-muted small fst-italic">No courses mapped yet.</div>
        )}
        {courses.map(c => (
          <div key={c.id}
            className="d-flex align-items-center justify-content-between px-2 py-1 rounded mb-1"
            style={{ background: '#f8fafc', border: '1px solid #e5e7eb', fontSize: 12 }}
          >
            <span>{c.course_name}</span>
            <button className="btn btn-sm btn-link text-danger p-0 border-0" onClick={() => remove(c.id)}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function EligibilityManagement() {
  const [departments, setDepartments]     = useState([]);
  const [programs,    setPrograms]        = useState([]);
  const [selDept,     setSelDept]         = useState(null);
  const [selProgram,  setSelProgram]      = useState(null);

  const [newDeptName, setNewDeptName]     = useState('');
  const [newProgName, setNewProgName]     = useState('');

  const [editingDept, setEditingDept]     = useState(null);
  const [editingProg, setEditingProg]     = useState(null);

  const [loadingDepts, setLoadingDepts]   = useState(false);
  const [loadingProgs, setLoadingProgs]   = useState(false);

  // fetch departments (all — includes inactive shown with dim style)
  const fetchDepts = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const r = await axios.get(`${API}/eligibility/departments/all`, { headers: authHeader() });
      setDepartments(r.data.data || []);
    } catch { toast.error('Failed to load departments'); }
    finally { setLoadingDepts(false); }
  }, []);

  // fetch programs for selected dept
  const fetchPrograms = useCallback(async (deptId) => {
    if (!deptId) { setPrograms([]); return; }
    setLoadingProgs(true);
    try {
      const r = await axios.get(`${API}/eligibility/programs/all?department_id=${deptId}`, { headers: authHeader() });
      setPrograms(r.data.data || []);
    } catch { toast.error('Failed to load programmes'); }
    finally { setLoadingProgs(false); }
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);
  useEffect(() => { fetchPrograms(selDept?.id); setSelProgram(null); }, [selDept, fetchPrograms]);

  // ── Department CRUD ──
  const addDept = async () => {
    if (!newDeptName.trim()) return;
    try {
      await axios.post(`${API}/eligibility/departments`, { name: newDeptName.trim() }, { headers: authHeader() });
      setNewDeptName('');
      fetchDepts();
      toast.success('Department added');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const saveDeptEdit = async (id, name) => {
    try {
      await axios.put(`${API}/eligibility/departments/${id}`, { name }, { headers: authHeader() });
      setEditingDept(null);
      fetchDepts();
      toast.success('Department updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const toggleDeptActive = async (dept) => {
    try {
      await axios.put(`${API}/eligibility/departments/${dept.id}`, { is_active: dept.is_active ? 0 : 1 }, { headers: authHeader() });
      fetchDepts();
    } catch { toast.error('Failed to update status'); }
  };

  const deleteDept = async (id) => {
    if (!window.confirm('Delete this department and ALL its programmes/eligibility mappings?')) return;
    try {
      await axios.delete(`${API}/eligibility/departments/${id}`, { headers: authHeader() });
      if (selDept?.id === id) { setSelDept(null); setSelProgram(null); }
      fetchDepts();
      toast.success('Department deleted');
    } catch { toast.error('Failed to delete department'); }
  };

  // ── Programme CRUD ──
  const addProgram = async () => {
    if (!newProgName.trim() || !selDept) return;
    try {
      await axios.post(`${API}/eligibility/programs`, { department_id: selDept.id, name: newProgName.trim() }, { headers: authHeader() });
      setNewProgName('');
      fetchPrograms(selDept.id);
      toast.success('Programme added');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const saveProgEdit = async (id, name) => {
    try {
      await axios.put(`${API}/eligibility/programs/${id}`, { name }, { headers: authHeader() });
      setEditingProg(null);
      fetchPrograms(selDept.id);
      toast.success('Programme updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const deleteProgram = async (id) => {
    if (!window.confirm('Delete this programme and its eligibility mappings?')) return;
    try {
      await axios.delete(`${API}/eligibility/programs/${id}`, { headers: authHeader() });
      if (selProgram?.id === id) setSelProgram(null);
      fetchPrograms(selDept.id);
      toast.success('Programme deleted');
    } catch { toast.error('Failed to delete programme'); }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>Eligibility Management</h2>
        <p className="text-muted mb-0" style={{ fontSize: 13 }}>
          Manage Departments → Programmes → PG &amp; M.Phil Eligibility Mappings
        </p>
      </div>

      <div className="row g-3">
        {/* ── Column 1: Departments ─────────────────────────────────────── */}
        <div className="col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-bottom py-2 px-3 d-flex align-items-center gap-2">
              <Building2 size={16} className="text-primary" />
              <span className="fw-bold" style={{ fontSize: 13 }}>Departments</span>
              <span className="ms-auto badge bg-primary rounded-pill" style={{ fontSize: 10 }}>{departments.length}</span>
            </div>
            <div className="card-body p-2">
              {/* add dept */}
              <div className="d-flex gap-1 mb-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="New department…"
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDept()}
                />
                <button className="btn btn-sm btn-primary px-2" onClick={addDept} disabled={!newDeptName.trim()}>
                  <Plus size={14} />
                </button>
              </div>
              {/* dept list */}
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {loadingDepts && <div className="text-center text-muted p-3" style={{ fontSize: 12 }}>Loading…</div>}
                {departments.map(dept => (
                  <div
                    key={dept.id}
                    onClick={() => { setSelDept(dept); setSelProgram(null); }}
                    className="rounded p-2 mb-1 cursor-pointer d-flex align-items-center gap-1"
                    style={{
                      background: selDept?.id === dept.id ? '#e0f7fa' : '#f9fafb',
                      border: `1px solid ${selDept?.id === dept.id ? '#32c5d2' : '#e5e7eb'}`,
                      cursor: 'pointer',
                      opacity: dept.is_active ? 1 : 0.5,
                    }}
                  >
                    {editingDept === dept.id ? (
                      <InlineEdit
                        value={dept.name}
                        onSave={v => saveDeptEdit(dept.id, v)}
                        onCancel={() => setEditingDept(null)}
                      />
                    ) : (
                      <>
                        <span className="flex-grow-1 text-dark fw-medium" style={{ fontSize: 12 }}>{dept.name}</span>
                        <button
                          className="btn btn-link p-0 border-0 text-secondary"
                          style={{ fontSize: 10 }}
                          title="Edit"
                          onClick={e => { e.stopPropagation(); setEditingDept(dept.id); }}
                        ><Pencil size={11}/></button>
                        <button
                          className={`btn btn-link p-0 border-0 ${dept.is_active ? 'text-warning' : 'text-success'}`}
                          style={{ fontSize: 10 }}
                          title={dept.is_active ? 'Deactivate' : 'Activate'}
                          onClick={e => { e.stopPropagation(); toggleDeptActive(dept); }}
                        >{dept.is_active ? '⊘' : '✓'}</button>
                        <button
                          className="btn btn-link p-0 border-0 text-danger"
                          title="Delete"
                          onClick={e => { e.stopPropagation(); deleteDept(dept.id); }}
                        ><Trash2 size={11}/></button>
                        {selDept?.id === dept.id && <ChevronRight size={11} className="text-info" />}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Programmes ─────────────────────────────────────── */}
        <div className="col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-bottom py-2 px-3 d-flex align-items-center gap-2">
              <BookOpen size={16} className="text-success" />
              <span className="fw-bold" style={{ fontSize: 13 }}>
                {selDept ? `${selDept.name} — Programmes` : 'Programmes'}
              </span>
              <span className="ms-auto badge bg-success rounded-pill" style={{ fontSize: 10 }}>{programs.length}</span>
            </div>
            <div className="card-body p-2">
              {!selDept ? (
                <div className="text-muted text-center p-4" style={{ fontSize: 12 }}>
                  Select a department to manage its programmes.
                </div>
              ) : (
                <>
                  <div className="d-flex gap-1 mb-2">
                    <input
                      className="form-control form-control-sm"
                      placeholder="New programme…"
                      value={newProgName}
                      onChange={e => setNewProgName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addProgram()}
                    />
                    <button className="btn btn-sm btn-success px-2" onClick={addProgram} disabled={!newProgName.trim()}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                    {loadingProgs && <div className="text-center text-muted p-3" style={{ fontSize: 12 }}>Loading…</div>}
                    {programs.map(prog => (
                      <div
                        key={prog.id}
                        onClick={() => setSelProgram(prog)}
                        className="rounded p-2 mb-1 d-flex align-items-center gap-1"
                        style={{
                          background: selProgram?.id === prog.id ? '#f0fdf4' : '#f9fafb',
                          border: `1px solid ${selProgram?.id === prog.id ? '#22c55e' : '#e5e7eb'}`,
                          cursor: 'pointer',
                          opacity: prog.is_active ? 1 : 0.5,
                        }}
                      >
                        {editingProg === prog.id ? (
                          <InlineEdit
                            value={prog.name}
                            onSave={v => saveProgEdit(prog.id, v)}
                            onCancel={() => setEditingProg(null)}
                          />
                        ) : (
                          <>
                            <span className="flex-grow-1 text-dark fw-medium" style={{ fontSize: 12 }}>{prog.name}</span>
                            <button
                              className="btn btn-link p-0 border-0 text-secondary"
                              title="Edit"
                              onClick={e => { e.stopPropagation(); setEditingProg(prog.id); }}
                            ><Pencil size={11}/></button>
                            <button
                              className="btn btn-link p-0 border-0 text-danger"
                              title="Delete"
                              onClick={e => { e.stopPropagation(); deleteProgram(prog.id); }}
                            ><Trash2 size={11}/></button>
                            {selProgram?.id === prog.id && <ChevronRight size={11} className="text-success" />}
                          </>
                        )}
                      </div>
                    ))}
                    {programs.length === 0 && !loadingProgs && (
                      <div className="text-muted text-center p-3" style={{ fontSize: 12 }}>No programmes yet. Add one above.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Column 3: Eligibility Mappings ───────────────────────────── */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-bottom py-2 px-3 d-flex align-items-center gap-2">
              <GraduationCap size={16} className="text-warning" />
              <span className="fw-bold" style={{ fontSize: 13 }}>
                {selProgram ? `Eligibility — ${selProgram.name}` : 'Eligibility Mappings'}
              </span>
            </div>
            <div className="card-body p-3">
              {!selProgram ? (
                <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted" style={{ minHeight: 300 }}>
                  <GraduationCap size={36} className="mb-2 opacity-25" />
                  <span style={{ fontSize: 13 }}>Select a programme to manage its eligibility.</span>
                </div>
              ) : (
                <div className="row g-3">
                  <div className="col-md-12">
                    <CoursePanel programId={selProgram.id} type="pg"    label="PG" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info footer */}
      <div className="mt-3 p-3 rounded" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: 12, color: '#0369a1' }}>
        <strong>How to use:</strong> Select a Department → select a Programme → add/remove PG eligible courses.
        These mappings are reflected instantly in the student registration form and enforced server-side during application submission.
      </div>
    </div>
  );
}
