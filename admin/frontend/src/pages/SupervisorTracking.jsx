import { useState, useEffect, useCallback } from 'react';
import { Users, UserCheck, UserX, ShieldOff, Clock, Eye, CheckCircle, XCircle, Pause, RefreshCw, History, Download } from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

function getToken() { return localStorage.getItem('adminToken') || ''; }
function authHeaders(json = false) {
    const h = { Authorization: `Bearer ${getToken()}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

const STATUS_META = {
    Pending:   { badge: 'bg-warning text-dark',  label: 'Pending Approval' },
    Approved:  { badge: 'bg-success text-white',  label: 'Approved' },
    Rejected:  { badge: 'bg-danger text-white',   label: 'Rejected' },
    Suspended: { badge: 'bg-dark text-white',     label: 'Suspended' },
    Inactive:  { badge: 'bg-secondary text-white',label: 'Inactive' },
    Draft:     { badge: 'bg-light text-dark border', label: 'Draft' },
    Active:    { badge: 'bg-success text-white',  label: 'Active' },
};

const REJECTION_CATEGORIES = [
    'Incomplete Documents',
    'Invalid Qualification',
    'Invalid Registration Number',
    'Insufficient Information',
    'Duplicate Registration',
    'Institution Verification Failed',
    'Other',
];

const SUSPENSION_CATEGORIES = [
    'Policy Violation',
    'Document Expired',
    'Administrative Hold',
    'Under Investigation',
    'Other',
];

function fmt(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtFull(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Dashboard Counters ────────────────────────────────────────────────────────
function CounterCards({ counters }) {
    const cards = [
        { label: 'Pending',   value: counters?.pending   || 0, icon: Clock,      color: '#f59e0b', bg: '#fffbeb' },
        { label: 'Approved',  value: counters?.approved  || 0, icon: UserCheck,  color: '#10b981', bg: '#f0fdf4' },
        { label: 'Rejected',  value: counters?.rejected  || 0, icon: UserX,      color: '#ef4444', bg: '#fef2f2' },
        { label: 'Suspended', value: counters?.suspended || 0, icon: ShieldOff,  color: '#6b7280', bg: '#f9fafb' },
        { label: 'Total',     value: counters?.total     || 0, icon: Users,      color: '#6366f1', bg: '#eef2ff' },
    ];
    return (
        <div className="row g-3 mb-4">
            {cards.map(c => (
                <div className="col-6 col-sm-4 col-xl-auto flex-xl-fill" key={c.label}>
                    <div className="card border-0 h-100" style={{ background: c.bg, borderLeft: `4px solid ${c.color}` }}>
                        <div className="card-body py-3 px-3">
                            <div className="d-flex align-items-center gap-2">
                                <c.icon size={20} style={{ color: c.color }} />
                                <div>
                                    <div className="fw-bold" style={{ fontSize: 22, color: c.color, lineHeight: 1 }}>{c.value}</div>
                                    <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Action Dialog (Reject / Suspend) ─────────────────────────────────────────
function ActionDialog({ mode, onConfirm, onCancel, loading }) {
    const [reasonCategory, setReasonCategory] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [remarks, setRemarks] = useState('');
    const [allowResubmission, setAllowResubmission] = useState(true);
    const [error, setError] = useState('');

    const isReject = mode === 'reject';
    const categories = isReject ? REJECTION_CATEGORIES : SUSPENSION_CATEGORIES;
    const title = isReject ? 'Reject Application' : 'Suspend Account';
    const color = isReject ? '#ef4444' : '#6b7280';

    function handleConfirm() {
        if (!reasonCategory && !customReason.trim()) {
            setError('Please select a reason category or enter a custom reason.');
            return;
        }
        setError('');
        onConfirm({ reason_category: reasonCategory, custom_reason: customReason.trim(), remarks: remarks.trim(), allow_resubmission: allowResubmission });
    }

    return (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
                <div className="modal-content border-0 shadow-lg">
                    <div className="modal-header border-0 pb-0" style={{ background: color + '10' }}>
                        <h5 className="modal-title fw-bold" style={{ color }}>
                            {isReject ? <XCircle size={20} className="me-2" style={{ color }} /> : <Pause size={20} className="me-2" style={{ color }} />}
                            {title}
                        </h5>
                        <button className="btn-close" onClick={onCancel} />
                    </div>
                    <div className="modal-body pt-3">
                        {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

                        <div className="mb-3">
                            <label className="form-label fw-semibold small">
                                Reason Category <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={reasonCategory}
                                onChange={e => setReasonCategory(e.target.value)}
                            >
                                <option value="">— Select a reason category —</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="mb-3">
                            <label className="form-label fw-semibold small">Custom Reason</label>
                            <textarea
                                className="form-control"
                                rows={3}
                                placeholder="Enter additional details about the rejection reason..."
                                value={customReason}
                                onChange={e => setCustomReason(e.target.value)}
                            />
                        </div>

                        <div className="mb-3">
                            <label className="form-label fw-semibold small">Internal Remarks</label>
                            <textarea
                                className="form-control"
                                rows={2}
                                placeholder="Internal admin remarks (not shown to supervisor)..."
                                value={remarks}
                                onChange={e => setRemarks(e.target.value)}
                            />
                        </div>

                        {isReject && (
                            <div className="form-check mb-1">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="allowResub"
                                    checked={allowResubmission}
                                    onChange={e => setAllowResubmission(e.target.checked)}
                                />
                                <label className="form-check-label small fw-semibold" htmlFor="allowResub">
                                    Allow Resubmission
                                    <span className="text-muted fw-normal ms-1">(supervisor can edit and resubmit)</span>
                                </label>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer border-0 pt-0">
                        <button className="btn btn-outline-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
                        <button
                            className="btn text-white fw-semibold"
                            style={{ background: color }}
                            onClick={handleConfirm}
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : (isReject ? 'Confirm Reject' : 'Confirm Suspend')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── View Detail Modal ─────────────────────────────────────────────────────────
function ViewModal({ supervisor, onClose }) {
    const s = supervisor;
    const statusMeta = STATUS_META[s?.status] || STATUS_META.Draft;
    return (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 9998 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content border-0 shadow-lg">
                    <div className="modal-header border-bottom">
                        <h5 className="modal-title fw-bold">Supervisor Details</h5>
                        <button className="btn-close" onClick={onClose} />
                    </div>
                    <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        <div className="d-flex align-items-start gap-3 mb-4">
                            {s.profile_image ? (
                                <img src={`${import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001'}${s.profile_image}`} alt="Profile" className="rounded" style={{ width: 72, height: 72, objectFit: 'cover', border: '2px solid #e2e8f0' }} />
                            ) : (
                                <div className="rounded bg-primary d-flex align-items-center justify-content-center text-white fw-bold" style={{ width: 72, height: 72, fontSize: 26 }}>
                                    {(s.name || 'S').charAt(0)}
                                </div>
                            )}
                            <div>
                                <h5 className="fw-bold mb-1">{s.name}</h5>
                                <div className="text-muted small">{s.designation_name} · {s.department_name}</div>
                                <span className={`badge mt-1 ${statusMeta.badge}`}>{statusMeta.label}</span>
                            </div>
                        </div>

                        <div className="row g-3">
                            {[
                                ['Application ID', `#${s.id}`],
                                ['Supervisor No', s.supervisor_no || '—'],
                                ['Registration No', s.recognition_ref_no || '—'],
                                ['Email', s.email || '—'],
                                ['Mobile', s.mobile || '—'],
                                ['University Institute', s.university_institute_name || '—'],
                                ['Research Center', s.research_center_name || '—'],
                                ['Department', s.department_name || '—'],
                                ['Designation', s.designation_name || '—'],
                                ['Applied Date', fmt(s.created_at)],
                                ['Approved / Action Date', fmt(s.approved_at)],
                            ].map(([k, v]) => (
                                <div className="col-md-6" key={k}>
                                    <div className="small text-muted fw-semibold">{k}</div>
                                    <div className="fw-semibold text-dark">{v}</div>
                                </div>
                            ))}
                        </div>

                        {s.rejection_reason && (
                            <div className="alert alert-danger mt-4 mb-0">
                                <strong>Rejection / Suspension Reason:</strong><br />
                                {s.rejection_reason}
                            </div>
                        )}

                        {s.disciplines?.length > 0 && (
                            <div className="mt-4">
                                <div className="fw-bold small text-muted mb-2 text-uppercase">Disciplines</div>
                                <div className="table-responsive">
                                    <table className="table table-sm table-bordered mb-0">
                                        <thead className="table-light">
                                            <tr><th>Type</th><th>Discipline</th><th>Centre</th><th>Recognition Date</th></tr>
                                        </thead>
                                        <tbody>
                                            {s.disciplines.map((d, i) => (
                                                <tr key={i}>
                                                    <td><span className={`badge ${d.type === 'Primary' ? 'bg-primary' : 'bg-info text-dark'}`}>{d.type}</span></td>
                                                    <td>{d.discipline_name || '—'}</td>
                                                    <td>{d.centre_name || '—'}</td>
                                                    <td>{fmt(d.recognition_date)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer border-0">
                        <button className="btn btn-outline-secondary" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── History Modal ─────────────────────────────────────────────────────────────
function HistoryModal({ history, supervisorName, onClose }) {
    const ACTION_COLOR = { Approved: 'success', Rejected: 'danger', Suspended: 'secondary', Reactivated: 'info', Created: 'primary' };
    return (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 9998 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content border-0 shadow-lg">
                    <div className="modal-header border-bottom">
                        <h5 className="modal-title fw-bold">Status History — {supervisorName}</h5>
                        <button className="btn-close" onClick={onClose} />
                    </div>
                    <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                        {history.length === 0 ? (
                            <div className="text-center text-muted py-4">No history recorded yet.</div>
                        ) : (
                            <div className="position-relative ps-4">
                                <div className="position-absolute top-0 start-0 ms-1 h-100" style={{ width: 2, background: '#e2e8f0', marginLeft: 6 }} />
                                {history.map((h, i) => (
                                    <div key={h.id} className="mb-4 position-relative">
                                        <div className="position-absolute" style={{ left: -22, top: 4, width: 14, height: 14, borderRadius: '50%', background: `var(--bs-${ACTION_COLOR[h.action] || 'secondary'})`, border: '2px solid #fff', boxShadow: '0 0 0 2px #e2e8f0' }} />
                                        <div className="card border-0 shadow-sm">
                                            <div className="card-body py-2 px-3">
                                                <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                                                    <div>
                                                        <span className={`badge bg-${ACTION_COLOR[h.action] || 'secondary'} me-2`}>{h.action}</span>
                                                        {h.previous_status && <small className="text-muted">{h.previous_status} → {h.new_status}</small>}
                                                    </div>
                                                    <small className="text-muted">{fmtFull(h.created_at)}</small>
                                                </div>
                                                {h.reason_category && <div className="small mt-1"><strong>Category:</strong> {h.reason_category}</div>}
                                                {h.custom_reason && <div className="small"><strong>Reason:</strong> {h.custom_reason}</div>}
                                                {h.remarks && <div className="small text-muted"><strong>Remarks:</strong> {h.remarks}</div>}
                                                <div className="small text-muted mt-1">By: {h.performed_by_name || 'System'}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="modal-footer border-0">
                        <button className="btn btn-outline-secondary" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SupervisorTracking() {
    const [counters, setCounters] = useState(null);
    const [data, setData] = useState({ rows: [], total: 0 });
    const [filterOptions, setFilterOptions] = useState({ institutes: [], universityInstitutes: [], departments: [], designations: [] });
    const [filters, setFilters] = useState({ status: '', search: '', institute_id: '', university_institute_id: '', department_id: '', designation_id: '', date_from: '', date_to: '', page: 1, limit: 20 });
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // modals
    const [viewSupervisor, setViewSupervisor] = useState(null);
    const [historyData, setHistoryData] = useState(null);
    const [historyName, setHistoryName] = useState('');
    const [dialogMode, setDialogMode] = useState(null); // 'reject' | 'suspend'
    const [dialogTargetId, setDialogTargetId] = useState(null);

    const loadCounters = useCallback(async () => {
        try {
            const res = await fetch(`${API}/supervisor-tracking/counters`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setCounters(json.data);
        } catch { /* ignore */ }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))).toString();
            const res = await fetch(`${API}/supervisor-tracking?${q}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [filters]);

    useEffect(() => {
        fetch(`${API}/supervisor-tracking/filter-options`, { headers: authHeaders() })
            .then(r => r.json())
            .then(j => { if (j.success) setFilterOptions(j.data); })
            .catch(() => {});
    }, []);

    useEffect(() => { loadCounters(); }, [loadCounters]);
    useEffect(() => { load(); }, [load]);

    function setFilter(key, val) {
        setFilters(f => ({ ...f, [key]: val, page: 1 }));
    }

    async function doApprove(id) {
        if (!window.confirm('Approve this supervisor application?')) return;
        setActionLoading(true);
        try {
            await fetch(`${API}/supervisor-tracking/${id}/approve`, { method: 'PATCH', headers: authHeaders(true) });
            await Promise.all([load(), loadCounters()]);
        } finally { setActionLoading(false); }
    }

    async function doAction(id, mode) {
        setDialogTargetId(id);
        setDialogMode(mode);
    }

    async function submitDialog({ reason_category, custom_reason, remarks, allow_resubmission }) {
        setActionLoading(true);
        const endpoint = dialogMode === 'reject' ? 'reject' : 'suspend';
        try {
            const res = await fetch(`${API}/supervisor-tracking/${dialogTargetId}/${endpoint}`, {
                method: 'PATCH',
                headers: authHeaders(true),
                body: JSON.stringify({ reason_category, custom_reason, remarks, allow_resubmission }),
            });
            const json = await res.json();
            if (!json.success) { alert(json.message || 'Action failed'); return; }
            setDialogMode(null);
            setDialogTargetId(null);
            await Promise.all([load(), loadCounters()]);
        } finally { setActionLoading(false); }
    }

    async function doReactivate(id) {
        if (!window.confirm('Reactivate this supervisor account?')) return;
        setActionLoading(true);
        try {
            await fetch(`${API}/supervisor-tracking/${id}/reactivate`, { method: 'PATCH', headers: authHeaders(true), body: '{}' });
            await Promise.all([load(), loadCounters()]);
        } finally { setActionLoading(false); }
    }

    async function openView(id) {
        try {
            const res = await fetch(`${API}/supervisor-tracking/${id}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setViewSupervisor(json.data);
        } catch { /* ignore */ }
    }

    async function openHistory(id, name) {
        setHistoryName(name);
        try {
            const res = await fetch(`${API}/supervisor-tracking/${id}/history`, { headers: authHeaders() });
            const json = await res.json();
            setHistoryData(json.success ? json.data : []);
        } catch { setHistoryData([]); }
    }

    const totalPages = Math.ceil(data.total / filters.limit);

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="mb-4">
                <h4 className="fw-bold mb-0 text-primary">Supervisor Tracking</h4>
                <small className="text-muted">Approval control center — manage supervisor application lifecycle</small>
            </div>

            {/* Counters */}
            <CounterCards counters={counters} />

            {/* Filters */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body py-3">
                    <div className="row g-2">
                        <div className="col-md-3">
                            <input className="form-control form-control-sm" placeholder="Search name / email / mobile / ID..." value={filters.search} onChange={e => setFilter('search', e.target.value)} />
                        </div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
                                <option value="">All Statuses</option>
                                {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={filters.university_institute_id} onChange={e => setFilter('university_institute_id', e.target.value)}>
                                <option value="">All Univ. Institutes</option>
                                {(filterOptions.universityInstitutes || []).map(i => <option key={i.id} value={i.id}>{i.institute_code ? `${i.institute_code} — ` : ''}{i.name}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={filters.designation_id} onChange={e => setFilter('designation_id', e.target.value)}>
                                <option value="">All Designations</option>
                                {filterOptions.designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={filters.department_id} onChange={e => setFilter('department_id', e.target.value)}>
                                <option value="">All Departments</option>
                                {filterOptions.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="col-md-1">
                            <button className="btn btn-sm btn-outline-secondary w-100" onClick={() => setFilters({ status: '', search: '', institute_id: '', university_institute_id: '', department_id: '', designation_id: '', date_from: '', date_to: '', page: 1, limit: 20 })}>
                                Clear
                            </button>
                        </div>
                    </div>
                    <div className="row g-2 mt-1">
                        <div className="col-md-2">
                            <label className="form-label form-label-sm mb-1 small text-muted">Applied From</label>
                            <input type="date" className="form-control form-control-sm" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label form-label-sm mb-1 small text-muted">Applied To</label>
                            <input type="date" className="form-control form-control-sm" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} />
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                            <small className="text-muted">{data.total} record(s) found</small>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading supervisors...</div>
                    ) : data.rows.length === 0 ? (
                        <div className="text-center py-5 text-muted">No records found for the selected filters.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                                <thead className="table-light">
                                    <tr>
                                        <th className="ps-3">#</th>
                                        <th>App ID</th>
                                        <th>Supervisor</th>
                                        <th>Reg No</th>
                                        <th>Contact</th>
                                        <th>Designation</th>
                                        <th>Institute / RC</th>
                                        <th>Applied</th>
                                        <th>Status</th>
                                        <th>Remarks</th>
                                        <th className="pe-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.rows.map((sv, idx) => {
                                        const meta = STATUS_META[sv.status] || STATUS_META.Draft;
                                        const rowNum = (filters.page - 1) * filters.limit + idx + 1;
                                        return (
                                            <tr key={sv.id}>
                                                <td className="ps-3 text-muted">{rowNum}</td>
                                                <td><span className="badge bg-light text-dark border">#{sv.id}</span></td>
                                                <td>
                                                    <div className="fw-semibold">{sv.name}</div>
                                                    <div className="text-muted small">{sv.email}</div>
                                                </td>
                                                <td className="text-muted small">{sv.supervisor_no || '—'}</td>
                                                <td className="text-muted small">{sv.mobile || '—'}</td>
                                                <td className="small">{sv.designation_name || '—'}</td>
                                                <td className="small">
                                                    {sv.university_institute_name ? (
                                                        <>
                                                            {sv.university_institute_code && <span className="badge bg-light text-dark border me-1">{sv.university_institute_code}</span>}
                                                            <span className="text-muted d-block">{sv.university_institute_name}</span>
                                                            {sv.research_center_name && <span className="text-info d-block" style={{ fontSize: 11 }}>↳ {sv.research_center_name}</span>}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {sv.institute_code && <span className="badge bg-light text-dark border me-1">{sv.institute_code}</span>}
                                                            <span className="text-muted">{sv.institute_name || '—'}</span>
                                                        </>
                                                    )}
                                                </td>
                                                <td className="small text-muted">{fmt(sv.created_at)}</td>
                                                <td>
                                                    <span className={`badge ${meta.badge}`}>{meta.label}</span>
                                                    {sv.rejection_reason && (
                                                        <div className="small text-danger mt-1" style={{ maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sv.rejection_reason}>
                                                            {sv.rejection_reason}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="small text-muted" style={{ maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sv.remarks || '—'}</td>
                                                <td className="pe-3">
                                                    <div className="d-flex gap-1 flex-wrap">
                                                        <button className="btn btn-xs btn-outline-primary py-0 px-2" title="View Details" onClick={() => openView(sv.id)}>
                                                            <Eye size={13} />
                                                        </button>
                                                        {(sv.status === 'Pending' || sv.status === 'Draft') && (
                                                            <button className="btn btn-xs btn-success py-0 px-2" title="Approve" disabled={actionLoading} onClick={() => doApprove(sv.id)}>
                                                                <CheckCircle size={13} />
                                                            </button>
                                                        )}
                                                        {sv.status !== 'Rejected' && (
                                                            <button className="btn btn-xs btn-danger py-0 px-2" title="Reject" disabled={actionLoading} onClick={() => doAction(sv.id, 'reject')}>
                                                                <XCircle size={13} />
                                                            </button>
                                                        )}
                                                        {sv.status === 'Approved' && (
                                                            <button className="btn btn-xs btn-secondary py-0 px-2" title="Suspend" disabled={actionLoading} onClick={() => doAction(sv.id, 'suspend')}>
                                                                <Pause size={13} />
                                                            </button>
                                                        )}
                                                        {(sv.status === 'Suspended' || sv.status === 'Rejected' || sv.status === 'Inactive') && (
                                                            <button className="btn btn-xs btn-warning py-0 px-2" title="Reactivate" disabled={actionLoading} onClick={() => doReactivate(sv.id)}>
                                                                <RefreshCw size={13} />
                                                            </button>
                                                        )}
                                                        {sv.profile_image && (
                                                            <a className="btn btn-xs btn-outline-secondary py-0 px-2" title="Download Documents" href={`${import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001'}${sv.profile_image}`} target="_blank" rel="noreferrer">
                                                                <Download size={13} />
                                                            </a>
                                                        )}
                                                        <button className="btn btn-xs btn-outline-dark py-0 px-2" title="View History" onClick={() => openHistory(sv.id, sv.name)}>
                                                            <History size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="card-footer bg-white border-top d-flex justify-content-between align-items-center py-2 px-3">
                        <small className="text-muted">Page {filters.page} of {totalPages} · {data.total} total</small>
                        <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-outline-secondary" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>‹ Prev</button>
                            <button className="btn btn-sm btn-outline-secondary" disabled={filters.page >= totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next ›</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {dialogMode && (
                <ActionDialog
                    mode={dialogMode}
                    loading={actionLoading}
                    onConfirm={submitDialog}
                    onCancel={() => { setDialogMode(null); setDialogTargetId(null); }}
                />
            )}
            {viewSupervisor && (
                <ViewModal supervisor={viewSupervisor} onClose={() => setViewSupervisor(null)} />
            )}
            {historyData !== null && (
                <HistoryModal history={historyData} supervisorName={historyName} onClose={() => { setHistoryData(null); setHistoryName(''); }} />
            )}
        </div>
    );
}
