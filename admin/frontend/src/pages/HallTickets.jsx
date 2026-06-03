import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  Ticket, Calendar, Clock, MapPin, Plus, Trash2, Printer, Send,
  CheckCircle, Edit2, X, Users, Building2, Zap, Eye, RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useSession } from '../contexts/SessionContext';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const token   = () => localStorage.getItem('adminToken');
const headers = () => ({ Authorization: `Bearer ${token()}` });

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Venue master form: exam scheduling fields removed (they belong to generation now)
const BLANK_VENUE = { session_id: '', department: '', hall_name: '', capacity: '' };

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ icon, label, value, color }) {
  return (
    <div className={`d-flex align-items-center gap-2 rounded-3 px-3 py-2 border border-${color} bg-${color} bg-opacity-10`}>
      <span className={`text-${color}`}>{icon}</span>
      <div>
        <div className="fw-bold" style={{ fontSize: 18, color: `var(--bs-${color})` }}>{value}</div>
        <div className="text-muted" style={{ fontSize: 11 }}>{label}</div>
      </div>
    </div>
  );
}

function CapacityBar({ allocated, capacity }) {
  const pct = capacity ? Math.min(100, Math.round((allocated / capacity) * 100)) : 0;
  const col = pct >= 100 ? 'danger' : pct >= 75 ? 'warning' : 'success';
  return (
    <div style={{ minWidth: 90 }}>
      <div className="progress" style={{ height: 6, borderRadius: 4 }}>
        <div className={`progress-bar bg-${col}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-muted" style={{ fontSize: 10, marginTop: 2 }}>{allocated}/{capacity} ({pct}%)</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const HallTickets = () => {
  const { sessions, activeSession, sessionLabel } = useSession();

  const [tab, setTab] = useState('bulk');

  /* ── Bulk Generator state ── */
  const [genSession,  setGenSession]  = useState('active');
  const [genDept,     setGenDept]     = useState('');
  const [genVenue,    setGenVenue]    = useState('');
  const [genCount,    setGenCount]    = useState('');
  const [genExamDate, setGenExamDate] = useState('');
  const [genFromTime, setGenFromTime] = useState('');
  const [genToTime,   setGenToTime]   = useState('');
  const [deptCounts,  setDeptCounts]  = useState([]);
  const [venues,      setVenues]      = useState([]);
  const [departmentsMaster, setDepartmentsMaster] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [previewing,  setPreviewing]  = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [autoSend,    setAutoSend]    = useState(false);
  const [autoAllocating, setAutoAllocating] = useState(false);

  /* ── Issued Tickets state ── */
  const [issued,        setIssued]       = useState([]);
  const [issuedSession, setIssuedSession] = useState('active');
  const [issuedDept,    setIssuedDept]   = useState('');
  const [loadingIssued, setLoadingIssued] = useState(false);
  const [sendingAll,    setSendingAll]    = useState(false);

  /* ── Manual Generator state ── */
  const [manualForm,   setManualForm]   = useState({ application_id: '', exam_date: '', exam_time: '', exam_venue: 'Periyar University, Salem - 636 011' });
  const [manualSaving, setManualSaving] = useState(false);

  /* ── Venue management state ── */
  const [venueForm,      setVenueForm]      = useState(BLANK_VENUE);
  const [editingVenueId, setEditingVenueId] = useState(null);
  const [venueLoading,   setVenueLoading]   = useState(false);
  const [showVenueForm,  setShowVenueForm]  = useState(false);

  // ── resolved session id ──
  const resolvedGenSession = useCallback(() => {
    if (genSession === 'active') return activeSession?.id || null;
    if (genSession === 'all')   return null;
    return parseInt(genSession, 10) || null;
  }, [genSession, activeSession]);

  // ── fetch dept counts, venues and departments master ──
  const fetchGenData = useCallback(async () => {
    try {
      const sid  = resolvedGenSession();
      const qSid = sid || 'active';

      const [stuRes, venRes, deptRes] = await Promise.all([
        axios.get(
          `${API_URL}/hall-tickets/students?session_id=${qSid}${genDept ? `&department=${encodeURIComponent(genDept)}` : ''}`,
          { headers: headers() }
        ),
        axios.get(
          `${API_URL}/venues?session_id=${qSid}${genDept ? `&department=${encodeURIComponent(genDept)}` : ''}`,
          { headers: headers() }
        ),
        axios.get(`${API_URL}/settings/master-data/dropdown_departments`, { headers: headers() }),
      ]);
      setDeptCounts(stuRes.data.deptCounts || []);
      setVenues(venRes.data.data || []);
      setDepartmentsMaster(deptRes.data.data || []);
    } catch { /* silent */ }
  }, [resolvedGenSession, genDept]);

  useEffect(() => { fetchGenData(); }, [fetchGenData]);

  // ── fetch issued tickets ──
  const fetchIssued = useCallback(async () => {
    setLoadingIssued(true);
    try {
      const res = await axios.get(
        `${API_URL}/hall-tickets/issued?session_id=${issuedSession}${issuedDept ? `&department=${encodeURIComponent(issuedDept)}` : ''}`,
        { headers: headers() }
      );
      setIssued(res.data.data || []);
    } catch { toast.error('Failed to load issued tickets'); }
    finally { setLoadingIssued(false); }
  }, [issuedSession, issuedDept]);

  useEffect(() => { if (tab === 'issued') fetchIssued(); }, [tab, fetchIssued]);

  // ── Send All Tickets ──
  const handleSendAll = async () => {
    if (issued.length === 0) { toast.error('No hall tickets found to send.'); return; }
    if (!window.confirm(`Are you sure you want to send/re-send all ${issued.length} hall ticket(s) to students' dashboards and emails?`)) return;
    setSendingAll(true);
    try {
      const res = await axios.post(`${API_URL}/hall-tickets/send-all`, {}, { headers: headers() });
      toast.success(res.data.message);
      fetchIssued();
    } catch { toast.error('Failed to send all tickets'); }
    finally { setSendingAll(false); }
  };

  const selectedVenue  = venues.find(v => String(v.id) === String(genVenue));
  const selDeptStats   = deptCounts.find(d => d.department === genDept);
  const selVenueAllocated = selectedVenue ? parseInt(selectedVenue.allocated_count, 10) : 0;
  const selVenueRemaining = selectedVenue ? parseInt(selectedVenue.remaining_seats, 10)  : 0;

  // ── Preview ──
  const handlePreview = async () => {
    const sid = resolvedGenSession();
    if (!sid)        { toast.error('Select a session first'); return; }
    if (!genDept)    { toast.error('Select a department first'); return; }
    if (!genVenue)   { toast.error('Select a venue first'); return; }
    if (!genExamDate){ toast.error('Enter the exam date'); return; }
    if (!genFromTime){ toast.error('Enter the from time'); return; }
    if (!genToTime)  { toast.error('Enter the to time'); return; }
    if (genFromTime >= genToTime) { toast.error('"From Time" must be before "To Time"'); return; }

    setPreviewing(true);
    try {
      const res = await axios.post(
        `${API_URL}/hall-tickets/preview`,
        { venue_id: genVenue, session_id: sid, department: genDept, exam_date: genExamDate, from_time: genFromTime, to_time: genToTime, count: genCount || undefined },
        { headers: headers() }
      );
      setPreviewData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  // ── Confirm Generate ──
  const handleConfirmGenerate = async () => {
    const sid = resolvedGenSession();
    setGenerating(true);
    try {
      const res = await axios.post(
        `${API_URL}/hall-tickets/bulk-generate`,
        { venue_id: genVenue, session_id: sid, department: genDept, exam_date: genExamDate, from_time: genFromTime, to_time: genToTime, count: genCount || undefined, auto_send: autoSend },
        { headers: headers() }
      );
      toast.success(res.data.message);
      setPreviewData(null);
      setGenCount('');
      await fetchGenData();
      if (tab === 'issued') fetchIssued();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ── Auto Allocate All ──
  const handleAutoAllocate = async () => {
    const sid = resolvedGenSession();
    if (!sid)        { toast.error('Select a session first'); return; }
    if (!genExamDate){ toast.error('Enter the exam date before auto-allocating'); return; }
    if (!genFromTime){ toast.error('Enter the from time before auto-allocating'); return; }
    if (!genToTime)  { toast.error('Enter the to time before auto-allocating'); return; }
    if (genFromTime >= genToTime) { toast.error('"From Time" must be before "To Time"'); return; }
    if (!window.confirm('Auto-allocate all unallocated students across available venues for this session?')) return;

    setAutoAllocating(true);
    try {
      const res = await axios.post(
        `${API_URL}/hall-tickets/auto-allocate`,
        { session_id: sid, exam_date: genExamDate, from_time: genFromTime, to_time: genToTime },
        { headers: headers() }
      );
      toast.success(res.data.message);
      fetchGenData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Auto-allocation failed');
    } finally {
      setAutoAllocating(false);
    }
  };

  // ── Send / Revoke ──
  const handleSend = async (id) => {
    try {
      await axios.post(`${API_URL}/hall-tickets/send/${id}`, {}, { headers: headers() });
      toast.success('Sent to student dashboard');
      fetchIssued();
    } catch { toast.error('Failed to send'); }
  };

  const handleSendBulk = async (venue_id) => {
    try {
      const res = await axios.post(`${API_URL}/hall-tickets/send-bulk`, { venue_id }, { headers: headers() });
      toast.success(res.data.message);
      fetchIssued();
    } catch { toast.error('Bulk send failed'); }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke this hall ticket?')) return;
    try {
      await axios.delete(`${API_URL}/hall-tickets/${id}`, { headers: headers() });
      toast.success('Hall Ticket revoked');
      fetchIssued();
      fetchGenData();
    } catch { toast.error('Failed to revoke'); }
  };

  // ── Manual generate ──
  const handleManualGenerate = async (e) => {
    e.preventDefault();
    setManualSaving(true);
    try {
      await axios.post(`${API_URL}/hall-tickets/generate`, manualForm, { headers: headers() });
      toast.success('Hall Ticket Generated!');
      setManualForm({ ...manualForm, application_id: '', exam_date: '', exam_time: '' });
      fetchGenData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    } finally {
      setManualSaving(false);
    }
  };

  // ── Venue CRUD ──
  const openAddVenue = () => {
    setEditingVenueId(null);
    setVenueForm({ ...BLANK_VENUE, session_id: resolvedGenSession() || (activeSession?.id || '') });
    setShowVenueForm(true);
  };

  const openEditVenue = (v) => {
    setEditingVenueId(v.id);
    setVenueForm({
      session_id: v.session_id,
      department: v.department,
      hall_name:  v.hall_name,
      capacity:   v.capacity,
    });
    setShowVenueForm(true);
  };

  const handleVenueSave = async (e) => {
    e.preventDefault();
    setVenueLoading(true);
    try {
      if (editingVenueId) {
        await axios.put(`${API_URL}/venues/${editingVenueId}`, venueForm, { headers: headers() });
        toast.success('Venue updated');
      } else {
        await axios.post(`${API_URL}/venues`, venueForm, { headers: headers() });
        toast.success('Venue added');
      }
      setShowVenueForm(false);
      setEditingVenueId(null);
      setVenueForm(BLANK_VENUE);
      fetchGenData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setVenueLoading(false);
    }
  };

  // ── Master Department CRUD ──
  const handleAddMasterDept = async () => {
    const name = window.prompt('Enter new Department name:');
    if (!name || !name.trim()) return;
    try {
      await axios.post(`${API_URL}/settings/master-data/dropdown_departments`, { name: name.trim() }, { headers: headers() });
      toast.success('Department added');
      fetchGenData();
    } catch { toast.error('Failed to add department'); }
  };

  const handleEditMasterDept = async (deptName) => {
    if (!deptName) return;
    const deptObj = departmentsMaster.find(d => d.name === deptName);
    if (!deptObj) return;
    const newName = window.prompt('Edit Department name:', deptName);
    if (!newName || !newName.trim() || newName === deptName) return;
    try {
      await axios.put(`${API_URL}/settings/master-data/dropdown_departments/${deptObj.id}`, { name: newName.trim() }, { headers: headers() });
      toast.success('Department updated');
      setVenueForm(f => ({ ...f, department: newName.trim() }));
      fetchGenData();
    } catch { toast.error('Failed to update department'); }
  };

  const handleVenueDelete = async (id) => {
    if (!window.confirm('Delete this venue?')) return;
    try {
      await axios.delete(`${API_URL}/venues/${id}`, { headers: headers() });
      toast.success('Venue deleted');
      fetchGenData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const issuedDepts = [...new Set(issued.map(t => t.subject).filter(Boolean))];

  return (
    <div>
      {/* ── Page header ── */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>Hall Ticket Management</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 12 }}>
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
              <li className="breadcrumb-item active">Hall Tickets</li>
            </ol>
          </nav>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-header bg-white p-0">
          <ul className="nav nav-tabs border-0 mb-0">
            {[
              { key: 'bulk',   label: 'Bulk Generator',   icon: <Zap size={15} /> },
              { key: 'issued', label: 'Issued Tickets',   icon: <CheckCircle size={15} /> },
              { key: 'manual', label: 'Manual Generator', icon: <Plus size={15} /> },
            ].map(t => (
              <li key={t.key} className="nav-item">
                <button
                  className={`nav-link border-0 py-3 px-4 fw-semibold d-flex align-items-center gap-2 ${tab === t.key ? 'active text-primary border-bottom border-primary border-3' : 'text-muted'}`}
                  style={{ fontSize: 13 }}
                  onClick={() => setTab(t.key)}
                >
                  {t.icon} {t.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          TAB: BULK GENERATOR
      ══════════════════════════════════════════════ */}
      {tab === 'bulk' && (
        <div className="row g-3">

          {/* ── LEFT: Generator Panel ── */}
          <div className="col-lg-7">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between">
                <div className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: 14 }}>
                  <Ticket size={16} className="text-primary" /> Hall Ticket Generator
                </div>
                <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 11 }} onClick={fetchGenData} title="Refresh">
                  <RefreshCw size={13} />
                </button>
              </div>
              <div className="card-body">

                {/* Department */}
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">Department</label>
                  <select
                    className="form-select form-select-sm"
                    value={genDept}
                    onChange={e => { setGenDept(e.target.value); setGenVenue(''); }}
                  >
                    <option value="">— Select Department —</option>
                    {deptCounts.map(d => (
                      <option key={d.department} value={d.department}>
                        {d.department} ({d.unallocated} unallocated / {d.total} total)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dept summary pills */}
                {selDeptStats && (
                  <div className="d-flex gap-2 flex-wrap mb-3">
                    <StatPill icon={<Users size={14} />}       label="Total Students" value={selDeptStats.total}        color="secondary" />
                    <StatPill icon={<CheckCircle size={14} />} label="Allocated"      value={selDeptStats.allocated}   color="success" />
                    <StatPill icon={<AlertCircle size={14} />} label="Unallocated"    value={selDeptStats.unallocated} color="warning" />
                  </div>
                )}

                {/* Venue */}
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">Venue / Hall</label>
                  <select
                    className="form-select form-select-sm"
                    value={genVenue}
                    onChange={e => setGenVenue(e.target.value)}
                    disabled={!genDept}
                  >
                    <option value="">— Select Venue —</option>
                    {venues.map(v => (
                      <option key={v.id} value={v.id} disabled={parseInt(v.remaining_seats, 10) <= 0}>
                        {v.hall_name} — {v.allocated_count}/{v.capacity} filled
                        {parseInt(v.remaining_seats, 10) <= 0 ? ' [FULL]' : ` (${v.remaining_seats} seats left)`}
                      </option>
                    ))}
                  </select>
                  {venues.length === 0 && genDept && (
                    <div className="text-muted mt-1" style={{ fontSize: 11 }}>
                      No venues for this department. Add one in the Venue Management panel →
                    </div>
                  )}
                </div>

                {/* Venue capacity card (no exam date/time — those are entered below) */}
                {selectedVenue && (
                  <div className="rounded-3 border p-3 mb-3" style={{ background: '#f8fdfe', fontSize: 13 }}>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="fw-bold text-dark">{selectedVenue.hall_name}</div>
                      <span className={`badge ${selVenueRemaining <= 0 ? 'bg-danger' : 'bg-success'}`}>
                        {selVenueRemaining <= 0 ? 'FULL' : `${selVenueRemaining} seats left`}
                      </span>
                    </div>
                    <CapacityBar allocated={selVenueAllocated} capacity={selectedVenue.capacity} />
                  </div>
                )}

                {/* Exam Date */}
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">
                    Exam Date <span className="text-danger">*</span>
                  </label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-light"><Calendar size={14} /></span>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={genExamDate}
                      onChange={e => setGenExamDate(e.target.value)}
                      disabled={!genVenue}
                    />
                  </div>
                </div>

                {/* From Time / To Time */}
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small fw-bold mb-1">
                      From Time <span className="text-danger">*</span>
                    </label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light"><Clock size={14} /></span>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        value={genFromTime}
                        onChange={e => setGenFromTime(e.target.value)}
                        disabled={!genVenue}
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-bold mb-1">
                      To Time <span className="text-danger">*</span>
                    </label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light"><Clock size={14} /></span>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        value={genToTime}
                        onChange={e => setGenToTime(e.target.value)}
                        disabled={!genVenue}
                      />
                    </div>
                  </div>
                </div>

                {/* Number of students */}
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">
                    Number of Students
                    {selVenueRemaining > 0 && <span className="text-muted fw-normal ms-1">(max {selVenueRemaining})</span>}
                  </label>
                  <input
                    type="number" min="1" max={selVenueRemaining || 9999}
                    className="form-control form-control-sm"
                    placeholder={`Enter count (blank = fill remaining ${selVenueRemaining > 0 ? selVenueRemaining : ''} seats)`}
                    value={genCount}
                    onChange={e => setGenCount(e.target.value)}
                    disabled={!genVenue}
                  />
                </div>

                {/* Auto-send toggle */}
                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" id="autoSend" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="autoSend">
                    Auto-send tickets to students immediately after generation
                  </label>
                </div>

                {/* Action buttons */}
                <div className="d-flex gap-2 flex-wrap">
                  <button
                    className="btn btn-primary btn-sm fw-bold d-flex align-items-center gap-2"
                    onClick={handlePreview}
                    disabled={previewing || !genDept || !genVenue || selVenueRemaining <= 0}
                  >
                    {previewing ? <span className="spinner-border spinner-border-sm" /> : <Eye size={15} />}
                    Preview Allocation
                  </button>
                  <button
                    className="btn btn-outline-success btn-sm fw-bold d-flex align-items-center gap-2"
                    onClick={handleAutoAllocate}
                    disabled={autoAllocating}
                    title="Auto-fill all venues with remaining capacity for this session"
                  >
                    {autoAllocating ? <span className="spinner-border spinner-border-sm" /> : <Zap size={15} />}
                    Auto Allocate All
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* ── RIGHT: Venue Management Panel ── */}
          <div className="col-lg-5">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between">
                <div className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: 14 }}>
                  <Building2 size={16} className="text-success" /> Venue Management
                </div>
                <button className="btn btn-sm btn-success d-flex align-items-center gap-1" style={{ fontSize: 11 }} onClick={openAddVenue}>
                  <Plus size={13} /> Add Venue
                </button>
              </div>
              <div className="card-body p-0">

                {/* Venue Form */}
                {showVenueForm && (
                  <div className="p-3 border-bottom" style={{ background: '#f8fdfe' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-semibold small">{editingVenueId ? 'Edit Venue' : 'Add New Venue'}</span>
                      <button className="btn btn-sm btn-link text-muted p-0" onClick={() => { setShowVenueForm(false); setEditingVenueId(null); }}>
                        <X size={15} />
                      </button>
                    </div>
                    <form onSubmit={handleVenueSave}>
                      <div className="row g-2">
                        <div className="col-12">
                          <label className="form-label small fw-semibold mb-0">Session</label>
                          <select className="form-select form-select-sm" required value={venueForm.session_id} onChange={e => setVenueForm(f => ({ ...f, session_id: e.target.value }))}>
                            <option value="">— Select —</option>
                            {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
                          </select>
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-semibold mb-0">Department</label>
                          <div className="input-group input-group-sm">
                            <select className="form-select" required value={venueForm.department} onChange={e => setVenueForm(f => ({ ...f, department: e.target.value }))}>
                              <option value="">— Select Department —</option>
                              {departmentsMaster.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                              ))}
                            </select>
                            <button type="button" className="btn btn-outline-secondary" onClick={() => handleEditMasterDept(venueForm.department)} disabled={!venueForm.department} title="Edit selected department">
                              <Edit2 size={13} />
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleAddMasterDept} title="Add new department">
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-semibold mb-0">Hall / Venue Name</label>
                          <input className="form-control form-control-sm" required placeholder="e.g. Seminar Hall A" value={venueForm.hall_name} onChange={e => setVenueForm(f => ({ ...f, hall_name: e.target.value }))} />
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-semibold mb-0">Capacity (Maximum Students)</label>
                          <input type="number" min="1" className="form-control form-control-sm" required placeholder="e.g. 40" value={venueForm.capacity} onChange={e => setVenueForm(f => ({ ...f, capacity: e.target.value }))} />
                        </div>
                        <div className="col-12 d-flex gap-2">
                          <button type="submit" className="btn btn-sm btn-success fw-bold flex-fill" disabled={venueLoading}>
                            {venueLoading ? <span className="spinner-border spinner-border-sm" /> : (editingVenueId ? 'Update Venue' : 'Add Venue')}
                          </button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowVenueForm(false); setEditingVenueId(null); }}>Cancel</button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}

                {/* Venues list */}
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {venues.length === 0 ? (
                    <div className="text-center text-muted py-5" style={{ fontSize: 13 }}>
                      <Building2 size={30} className="mb-2 opacity-25" /><br />
                      No venues yet. Click "Add Venue" to create one.
                    </div>
                  ) : venues.map(v => {
                    const rem   = parseInt(v.remaining_seats, 10);
                    const alloc = parseInt(v.allocated_count, 10);
                    return (
                      <div key={v.id} className="px-3 py-2 border-bottom" style={{ fontSize: 12 }}>
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-fill me-2">
                            <div className="fw-bold" style={{ fontSize: 13 }}>{v.hall_name}</div>
                            <div className="text-muted">{v.department}</div>
                            <CapacityBar allocated={alloc} capacity={v.capacity} />
                          </div>
                          <div className="d-flex gap-1 flex-shrink-0">
                            <button className="btn btn-xs btn-outline-primary p-1" title="Edit" onClick={() => openEditVenue(v)} style={{ lineHeight: 1 }}>
                              <Edit2 size={12} />
                            </button>
                            <button className="btn btn-xs btn-outline-danger p-1" title="Delete" onClick={() => handleVenueDelete(v.id)} style={{ lineHeight: 1 }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1">
                          <span className={`badge ${rem <= 0 ? 'bg-danger' : rem <= 5 ? 'bg-warning text-dark' : 'bg-success'}`} style={{ fontSize: 10 }}>
                            {rem <= 0 ? 'Full' : `${rem} seats left`}
                          </span>
                          {rem > 0 && alloc > 0 && (
                            <button
                              className="btn btn-link p-0 ms-2 text-primary"
                              style={{ fontSize: 10 }}
                              onClick={() => handleSendBulk(v.id)}
                              title="Send all unsent tickets for this venue"
                            >
                              <Send size={10} className="me-1" />Send All
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: ISSUED TICKETS
      ══════════════════════════════════════════════ */}
      {tab === 'issued' && (
        <div>
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body py-3">
              <div className="row g-2 align-items-end">
                <div className="col-auto">
                  <select className="form-select form-select-sm" value={issuedDept} onChange={e => setIssuedDept(e.target.value)}>
                    <option value="">All Departments</option>
                    {issuedDepts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="col-auto">
                  <button className="btn btn-sm btn-outline-secondary" onClick={fetchIssued} title="Refresh">
                    <RefreshCw size={13} />
                  </button>
                </div>
                <div className="col-auto">
                  <button
                    className="btn btn-sm btn-primary fw-bold d-flex align-items-center gap-1"
                    onClick={handleSendAll}
                    disabled={sendingAll || issued.length === 0}
                  >
                    {sendingAll ? <span className="spinner-border spinner-border-sm" /> : <Send size={13} />}
                    Send All Tickets ({issued.length})
                  </button>
                </div>
                <div className="col text-end">
                  <small className="text-muted">Showing <strong>{issued.length}</strong> tickets</small>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3 py-3" style={{ width: 40 }}>#</th>
                      <th>HT Number</th>
                      <th>Candidate</th>
                      <th>Department</th>
                      <th>Venue / Seat</th>
                      <th>Exam Details</th>
                      <th>Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingIssued ? (
                      <tr><td colSpan={8} className="text-center py-5 text-muted">Loading...</td></tr>
                    ) : issued.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-5 text-muted">No tickets found</td></tr>
                    ) : issued.map((item, i) => (
                      <tr key={item.id}>
                        <td className="ps-3 text-muted">{i + 1}</td>
                        <td className="fw-bold text-primary" style={{ fontSize: 12 }}>{item.hall_ticket_number}</td>
                        <td>
                          <div className="fw-semibold">{item.full_name}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>{item.application_id}</div>
                        </td>
                        <td className="text-muted" style={{ fontSize: 12 }}>{item.subject || '—'}</td>
                        <td>
                          <div className="fw-semibold" style={{ fontSize: 12 }}>{item.venue_hall_name || item.exam_venue || '—'}</div>
                          {item.seat_number && (
                            <span className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: 10 }}>
                              Seat: {item.seat_number}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: 12 }}>{fmt(item.exam_date)}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>{item.exam_time}</div>
                        </td>
                        <td>
                          {item.is_sent
                            ? <span className="badge bg-success">Sent</span>
                            : <span className="badge bg-warning text-dark">Pending</span>
                          }
                        </td>
                        <td className="text-center">
                          <div className="d-flex gap-1 justify-content-center">
                            <button className="btn btn-sm btn-primary px-2" style={{ fontSize: 11 }} onClick={() => handleSend(item.id)} title="Send/Re-send to student">
                              <Send size={13} />
                            </button>
                            <button className="btn btn-sm btn-outline-info px-2" style={{ fontSize: 11 }} onClick={() => window.open(`/hall-ticket/print/${item.id}`, '_blank')} title="Print">
                              <Printer size={13} />
                            </button>
                            <button className="btn btn-sm btn-outline-danger px-2" style={{ fontSize: 11 }} onClick={() => handleRevoke(item.id)} title="Revoke">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: MANUAL GENERATOR (existing flow preserved)
      ══════════════════════════════════════════════ */}
      {tab === 'manual' && (
        <div className="col-lg-6 mx-auto">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-3 border-0 text-center">
              <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle bg-primary bg-opacity-10 mb-3 mt-2">
                <Ticket size={32} className="text-primary" />
              </div>
              <h5 className="fw-bold mb-1">Manual Hall Ticket</h5>
              <p className="text-muted small mb-0">Generate a hall ticket for a single approved applicant.</p>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleManualGenerate}>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Application ID <span className="text-danger">*</span></label>
                  <input
                    type="text" className="form-control form-control-lg bg-light" required
                    placeholder="e.g., APP2026-000001"
                    value={manualForm.application_id}
                    onChange={e => setManualForm(f => ({ ...f, application_id: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="row mb-3">
                  <div className="col-sm-6 mb-3 mb-sm-0">
                    <label className="form-label small fw-bold">Exam Date <span className="text-danger">*</span></label>
                    <div className="input-group input-group-lg">
                      <span className="input-group-text bg-light border-end-0"><Calendar size={20} /></span>
                      <input type="date" className="form-control border-start-0 bg-light" required value={manualForm.exam_date} onChange={e => setManualForm(f => ({ ...f, exam_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label small fw-bold">Exam Time <span className="text-danger">*</span></label>
                    <div className="input-group input-group-lg">
                      <span className="input-group-text bg-light border-end-0"><Clock size={20} /></span>
                      <input type="time" className="form-control border-start-0 bg-light" required value={manualForm.exam_time} onChange={e => setManualForm(f => ({ ...f, exam_time: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-bold">Exam Venue <span className="text-danger">*</span></label>
                  <div className="input-group input-group-lg">
                    <span className="input-group-text bg-light border-end-0"><MapPin size={20} /></span>
                    <textarea className="form-control border-start-0 bg-light" rows="2" required value={manualForm.exam_venue} onChange={e => setManualForm(f => ({ ...f, exam_venue: e.target.value }))} />
                  </div>
                </div>
                <button className="btn btn-primary btn-lg w-100 fw-bold d-flex align-items-center justify-content-center gap-2" disabled={manualSaving}>
                  {manualSaving ? <span className="spinner-border spinner-border-sm" /> : <Plus size={20} />}
                  Generate Official Ticket
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          PREVIEW MODAL
      ══════════════════════════════════════════════ */}
      {previewData && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1050 }} onClick={e => { if (e.target === e.currentTarget) setPreviewData(null); }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <Eye size={18} className="text-primary" /> Allocation Preview
                </h5>
                <button className="btn-close" onClick={() => setPreviewData(null)} />
              </div>
              <div className="modal-body">
                <div className="rounded-3 border p-3 mb-3" style={{ background: '#f8fdfe', fontSize: 13 }}>
                  <div className="row g-2">
                    <div className="col-sm-4">
                      <div className="text-muted small">Venue</div>
                      <div className="fw-bold">{previewData.venue?.hall_name}</div>
                    </div>
                    <div className="col-sm-4">
                      <div className="text-muted small">Date &amp; Time</div>
                      <div className="fw-semibold">{fmt(previewData.exam_date)}</div>
                      <div className="text-muted">{previewData.from_time_fmt} – {previewData.to_time_fmt}</div>
                    </div>
                    <div className="col-sm-4">
                      <div className="text-muted small">Allocation</div>
                      <div><span className="fw-bold text-primary">{previewData.count}</span> students will be allocated</div>
                      <div className="text-muted">{previewData.remaining} seats left after</div>
                    </div>
                  </div>
                </div>

                <div className="table-responsive" style={{ maxHeight: 320 }}>
                  <table className="table table-sm align-middle mb-0" style={{ fontSize: 12 }}>
                    <thead className="table-light sticky-top">
                      <tr>
                        <th style={{ width: 35 }}>#</th>
                        <th>Candidate Name</th>
                        <th>Application ID</th>
                        <th>HT Number</th>
                        <th className="text-center">Seat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.preview?.map((p, i) => (
                        <tr key={p.application_id}>
                          <td className="text-muted">{i + 1}</td>
                          <td className="fw-semibold">{p.full_name}</td>
                          <td className="text-muted">{p.application_id}</td>
                          <td className="fw-bold text-primary">{p.hall_ticket_number}</td>
                          <td className="text-center">
                            <span className="badge bg-primary bg-opacity-10 text-primary">{p.seat_number}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer border-top">
                <div className="me-auto small text-muted">{previewData.count} tickets will be created. This action cannot be undone.</div>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setPreviewData(null)}>Cancel</button>
                <button
                  className="btn btn-success btn-sm fw-bold d-flex align-items-center gap-2"
                  onClick={handleConfirmGenerate}
                  disabled={generating}
                >
                  {generating ? <span className="spinner-border spinner-border-sm" /> : <CheckCircle size={15} />}
                  Confirm &amp; Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HallTickets;
