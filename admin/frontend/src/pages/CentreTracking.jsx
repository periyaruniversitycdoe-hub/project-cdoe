import { useState, useEffect, useCallback } from 'react';
import { Building2, UserCheck, UserX, ShieldOff, Clock, Eye, CheckCircle, XCircle, Pause, RefreshCw, History, Download } from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

function getToken() { return localStorage.getItem('adminToken') || ''; }
function authHeaders(json = false) {
    const h = { Authorization: `Bearer ${getToken()}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

const STATUS_META = {
    Pending:   { badge: 'bg-warning text-dark',   label: 'Pending Approval' },
    Approved:  { badge: 'bg-success text-white',   label: 'Approved' },
    Rejected:  { badge: 'bg-danger text-white',    label: 'Rejected' },
    Suspended: { badge: 'bg-dark text-white',      label: 'Suspended' },
    Inactive:  { badge: 'bg-secondary text-white', label: 'Inactive' },
    Draft:     { badge: 'bg-light text-dark border', label: 'Draft' },
};

const REJECTION_CATEGORIES = [
    'Recognition Issue',
    'Incomplete Documents',
    'Verification Failed',
    'Institution Mismatch',
    'Insufficient Information',
    'Duplicate Registration',
    'Other',
];

const SUSPENSION_CATEGORIES = [
    'Policy Violation',
    'Recognition Expired',
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
        { label: 'Total',     value: counters?.total     || 0, icon: Building2,  color: '#0891b2', bg: '#ecfeff' },
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

// ── Action Dialog ─────────────────────────────────────────────────────────────
function ActionDialog({ mode, onConfirm, onCancel, loading }) {
    const [reasonCategory, setReasonCategory] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [remarks, setRemarks] = useState('');
    const [allowResubmission, setAllowResubmission] = useState(true);
    const [error, setError] = useState('');

    const isReject = mode === 'reject';
    const categories = isReject ? REJECTION_CATEGORIES : SUSPENSION_CATEGORIES;
    const title = isReject ? 'Reject Research Centre' : 'Suspend Research Centre';
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
                            <select className="form-select" value={reasonCategory} onChange={e => setReasonCategory(e.target.value)}>
                                <option value="">— Select a reason category —</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="mb-3">
                            <label className="form-label fw-semibold small">Custom Reason</label>
                            <textarea className="form-control" rows={3} placeholder="Enter additional details..." value={customReason} onChange={e => setCustomReason(e.target.value)} />
                        </div>

                        <div className="mb-3">
                            <label className="form-label fw-semibold small">Internal Remarks</label>
                            <textarea className="form-control" rows={2} placeholder="Internal admin remarks (not shown to centre)..." value={remarks} onChange={e => setRemarks(e.target.value)} />
                        </div>

                        {isReject && (
                            <div className="form-check mb-1">
                                <input className="form-check-input" type="checkbox" id="allowResub" checked={allowResubmission} onChange={e => setAllowResubmission(e.target.checked)} />
                                <label className="form-check-label small fw-semibold" htmlFor="allowResub">
                                    Allow Resubmission
                                    <span className="text-muted fw-normal ms-1">(centre can edit and resubmit)</span>
                                </label>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer border-0 pt-0">
                        <button className="btn btn-outline-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
                        <button className="btn text-white fw-semibold" style={{ background: color }} onClick={handleConfirm} disabled={loading}>
                            {loading ? 'Processing...' : (isReject ? 'Confirm Reject' : 'Confirm Suspend')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Section heading helper ────────────────────────────────────────────────────
function SectionHeading({ title, color = '#0891b2' }) {
    return (
        <div className="col-12 mt-3 mb-1">
            <div className="fw-bold small text-uppercase" style={{ color, letterSpacing: 1, borderBottom: `2px solid ${color}22`, paddingBottom: 4 }}>
                {title}
            </div>
        </div>
    );
}

function InfoField({ label, value }) {
    return (
        <div className="col-md-6">
            <div className="small text-muted fw-semibold">{label}</div>
            <div className="fw-semibold text-dark" style={{ wordBreak: 'break-word' }}>{value || '—'}</div>
        </div>
    );
}

// ── View Detail Modal ─────────────────────────────────────────────────────────
// Shows the complete registration form data — all three steps — so the admin
// sees exactly what the centre submitted with no partial views.
function ViewModal({ centre, onClose }) {
    const c = centre;
    const statusMeta = STATUS_META[c?.status] || STATUS_META.Draft;
    const ADMIN_URL  = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001';

    return (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 9998 }}>
            <div className="modal-dialog modal-dialog-centered modal-xl">
                <div className="modal-content border-0 shadow-lg">
                    <div className="modal-header border-bottom">
                        <h5 className="modal-title fw-bold">Research Centre — Full Registration Details</h5>
                        <button className="btn-close" onClick={onClose} />
                    </div>
                    <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto' }}>

                        {/* ── Header band ── */}
                        <div className="d-flex align-items-start gap-3 mb-4 p-3 rounded-3 bg-light">
                            {c.logo ? (
                                <img src={`${ADMIN_URL}${c.logo}`} alt="Logo" className="rounded"
                                    style={{ width: 72, height: 72, objectFit: 'contain', border: '1px solid #e2e8f0', background: '#fff' }} />
                            ) : (
                                <div className="rounded bg-info d-flex align-items-center justify-content-center text-white fw-bold"
                                    style={{ width: 72, height: 72, fontSize: 26, flexShrink: 0 }}>
                                    {(c.centre_name || c.name || 'C').charAt(0)}
                                </div>
                            )}
                            <div>
                                <h5 className="fw-bold mb-1">{c.centre_name || c.name}</h5>
                                <div className="text-muted small mb-1">{c.centre_type_name}</div>
                                <span className={`badge ${statusMeta.badge}`}>{statusMeta.label}</span>
                                {c.centre_ref_no && (
                                    <span className="badge bg-light text-dark border ms-2">{c.centre_ref_no}</span>
                                )}
                            </div>
                        </div>

                        <div className="row g-3">
                            {/* ── Step 0: Centre Information ── */}
                            <SectionHeading title="Centre Information" color="#0891b2" />
                            <InfoField label="Centre ID"            value={`#${c.id}`} />
                            <InfoField label="Centre Type"          value={c.centre_type_name} />
                            <InfoField label="Recognition Ref. No." value={c.centre_ref_no} />
                            <InfoField label="Recognition Date"     value={fmt(c.recognition_date)} />
                            <InfoField label="Applied Date"         value={fmt(c.created_at)} />
                            <InfoField label="Approved / Action Date" value={fmt(c.approved_at)} />

                            {/* ── Step 1: Institute Details (from registration form) ── */}
                            <SectionHeading title="Institute Details  —  Source of Truth for Institute Master" color="#0369a1" />
                            <InfoField label="College Code"      value={c.college_code    || c.institute_code} />
                            <InfoField label="College Name"      value={c.college_name    || c.institute_name} />
                            <InfoField label="Principal / HOD"   value={c.principal_name  || c.institute_principal} />
                            <InfoField label="Principal Mobile"  value={c.principal_mobile|| c.institute_principal_mobile} />
                            <InfoField label="Principal Email"   value={c.hod_email       || c.institute_email} />
                            <InfoField label="College Phone"     value={c.college_phone   || c.institute_phone} />

                            {/* ── Step 2: Address & Contact ── */}
                            <SectionHeading title="Address &amp; Contact" color="#059669" />
                            <div className="col-12">
                                <div className="small text-muted fw-semibold">Address</div>
                                <div className="fw-semibold text-dark">
                                    {[c.address_1, c.address_2, c.address_3, c.district_name, c.pincode]
                                        .filter(Boolean).join(', ') || '—'}
                                </div>
                            </div>
                            <InfoField label="Centre Email"    value={c.email} />
                            <InfoField label="Contact Number"  value={c.contact_number} />
                        </div>

                        {c.rejection_reason && (
                            <div className="alert alert-danger mt-4 mb-0">
                                <strong>Rejection / Suspension Reason:</strong><br />{c.rejection_reason}
                            </div>
                        )}
                        {c.remark && (
                            <div className="alert alert-secondary mt-3 mb-0">
                                <strong>Admin Remark:</strong><br />{c.remark}
                            </div>
                        )}
                    </div>
                    <div className="modal-footer border-0">
                        <button className="btn btn-outline-secondary" onClick={onClose}>Close</button>
                        {c.recognition_certificate && (
                            <a className="btn btn-outline-primary"
                                href={`${ADMIN_URL}${c.recognition_certificate}`}
                                target="_blank" rel="noreferrer">
                                <Download size={14} className="me-1" /> Recognition Certificate
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── History Modal ─────────────────────────────────────────────────────────────
function HistoryModal({ history, centreName, onClose }) {
    const ACTION_COLOR = { Approved: 'success', Rejected: 'danger', Suspended: 'secondary', Reactivated: 'info', Created: 'primary' };
    return (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 9998 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content border-0 shadow-lg">
                    <div className="modal-header border-bottom">
                        <h5 className="modal-title fw-bold">Status History — {centreName}</h5>
                        <button className="btn-close" onClick={onClose} />
                    </div>
                    <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                        {history.length === 0 ? (
                            <div className="text-center text-muted py-4">No history recorded yet.</div>
                        ) : (
                            <div className="position-relative ps-4">
                                <div className="position-absolute top-0 start-0 ms-1 h-100" style={{ width: 2, background: '#e2e8f0', marginLeft: 6 }} />
                                {history.map(h => (
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
export default function CentreTracking() {
    const [counters, setCounters] = useState(null);
    const [data, setData] = useState({ rows: [], total: 0 });
    const [filterOptions, setFilterOptions] = useState({ institutes: [], centreTypes: [] });
    const [filters, setFilters] = useState({ status: '', search: '', institute_id: '', centre_type_id: '', date_from: '', date_to: '', page: 1, limit: 20 });
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const [viewCentre, setViewCentre] = useState(null);
    const [historyData, setHistoryData] = useState(null);
    const [historyName, setHistoryName] = useState('');
    const [dialogMode, setDialogMode] = useState(null);
    const [dialogTargetId, setDialogTargetId] = useState(null);

    const loadCounters = useCallback(async () => {
        try {
            const res = await fetch(`${API}/centre-tracking/counters`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setCounters(json.data);
        } catch { /* ignore */ }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))).toString();
            const res = await fetch(`${API}/centre-tracking?${q}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [filters]);

    useEffect(() => {
        fetch(`${API}/centre-tracking/filter-options`, { headers: authHeaders() })
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
        if (!window.confirm('Approve this research centre application?')) return;
        setActionLoading(true);
        try {
            await fetch(`${API}/centre-tracking/${id}/approve`, { method: 'PATCH', headers: authHeaders(true) });
            await Promise.all([load(), loadCounters()]);
        } finally { setActionLoading(false); }
    }

    async function submitDialog({ reason_category, custom_reason, remarks, allow_resubmission }) {
        setActionLoading(true);
        const endpoint = dialogMode === 'reject' ? 'reject' : 'suspend';
        try {
            const res = await fetch(`${API}/centre-tracking/${dialogTargetId}/${endpoint}`, {
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
        if (!window.confirm('Reactivate this research centre?')) return;
        setActionLoading(true);
        try {
            await fetch(`${API}/centre-tracking/${id}/reactivate`, { method: 'PATCH', headers: authHeaders(true), body: '{}' });
            await Promise.all([load(), loadCounters()]);
        } finally { setActionLoading(false); }
    }

    async function openView(id) {
        try {
            const res = await fetch(`${API}/centre-tracking/${id}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setViewCentre(json.data);
        } catch { /* ignore */ }
    }

    async function openHistory(id, name) {
        setHistoryName(name);
        try {
            const res = await fetch(`${API}/centre-tracking/${id}/history`, { headers: authHeaders() });
            const json = await res.json();
            setHistoryData(json.success ? json.data : []);
        } catch { setHistoryData([]); }
    }

    const totalPages = Math.ceil(data.total / filters.limit);

    return (
        <div className="container-fluid py-4">
            <div className="mb-4">
                <h4 className="fw-bold mb-0 text-info">Research Centre Tracking</h4>
                <small className="text-muted">Approval control center — manage research centre application lifecycle</small>
            </div>

            <CounterCards counters={counters} />

            {/* Filters */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body py-3">
                    <div className="row g-2">
                        <div className="col-md-3">
                            <input className="form-control form-control-sm" placeholder="Search name / ref no / email / ID..." value={filters.search} onChange={e => setFilter('search', e.target.value)} />
                        </div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
                                <option value="">All Statuses</option>
                                {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={filters.institute_id} onChange={e => setFilter('institute_id', e.target.value)}>
                                <option value="">All Institutes</option>
                                {filterOptions.institutes.map(i => <option key={i.id} value={i.id}>{i.college_code} — {i.name}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={filters.centre_type_id} onChange={e => setFilter('centre_type_id', e.target.value)}>
                                <option value="">All Centre Types</option>
                                {filterOptions.centreTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                            </select>
                        </div>
                        <div className="col-md-1">
                            <button className="btn btn-sm btn-outline-secondary w-100" onClick={() => setFilters({ status: '', search: '', institute_id: '', centre_type_id: '', date_from: '', date_to: '', page: 1, limit: 20 })}>Clear</button>
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
                        <div className="text-center py-5 text-muted">Loading research centres...</div>
                    ) : data.rows.length === 0 ? (
                        <div className="text-center py-5 text-muted">No records found for the selected filters.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                                <thead className="table-light">
                                    <tr>
                                        <th className="ps-3">#</th>
                                        <th>Centre ID</th>
                                        <th>Institute</th>
                                        <th>Centre Name</th>
                                        <th>Centre Type</th>
                                        <th>Email</th>
                                        <th>Applied</th>
                                        <th>Status</th>
                                        <th>Remarks</th>
                                        <th className="pe-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.rows.map((rc, idx) => {
                                        const meta = STATUS_META[rc.status] || STATUS_META.Draft;
                                        const rowNum = (filters.page - 1) * filters.limit + idx + 1;
                                        return (
                                            <tr key={rc.id}>
                                                <td className="ps-3 text-muted">{rowNum}</td>
                                                <td><span className="badge bg-light text-dark border">#{rc.id}</span></td>
                                                <td className="small">
                                                    {rc.institute_code && <span className="badge bg-light text-dark border me-1">{rc.institute_code}</span>}
                                                    <span className="text-muted">{rc.institute_name || '—'}</span>
                                                </td>
                                                <td>
                                                    <div className="fw-semibold">{rc.centre_name}</div>
                                                    {rc.centre_ref_no && <div className="text-muted small">{rc.centre_ref_no}</div>}
                                                </td>
                                                <td className="small">{rc.centre_type_name || '—'}</td>
                                                <td className="text-muted small">{rc.email || '—'}</td>
                                                <td className="small text-muted">{fmt(rc.created_at)}</td>
                                                <td>
                                                    <span className={`badge ${meta.badge}`}>{meta.label}</span>
                                                    {rc.rejection_reason && (
                                                        <div className="small text-danger mt-1" style={{ maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rc.rejection_reason}>
                                                            {rc.rejection_reason}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="small text-muted" style={{ maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rc.remark || '—'}</td>
                                                <td className="pe-3">
                                                    <div className="d-flex gap-1 flex-wrap">
                                                        <button className="btn btn-xs btn-outline-primary py-0 px-2" title="View Details" onClick={() => openView(rc.id)}><Eye size={13} /></button>
                                                        {(rc.status === 'Pending' || rc.status === 'Draft') && (
                                                            <button className="btn btn-xs btn-success py-0 px-2" title="Approve" disabled={actionLoading} onClick={() => doApprove(rc.id)}><CheckCircle size={13} /></button>
                                                        )}
                                                        {rc.status !== 'Rejected' && (
                                                            <button className="btn btn-xs btn-danger py-0 px-2" title="Reject" disabled={actionLoading} onClick={() => { setDialogTargetId(rc.id); setDialogMode('reject'); }}><XCircle size={13} /></button>
                                                        )}
                                                        {rc.status === 'Approved' && (
                                                            <button className="btn btn-xs btn-secondary py-0 px-2" title="Suspend" disabled={actionLoading} onClick={() => { setDialogTargetId(rc.id); setDialogMode('suspend'); }}><Pause size={13} /></button>
                                                        )}
                                                        {(rc.status === 'Suspended' || rc.status === 'Rejected' || rc.status === 'Inactive') && (
                                                            <button className="btn btn-xs btn-warning py-0 px-2" title="Reactivate" disabled={actionLoading} onClick={() => doReactivate(rc.id)}><RefreshCw size={13} /></button>
                                                        )}
                                                        <button className="btn btn-xs btn-outline-dark py-0 px-2" title="View History" onClick={() => openHistory(rc.id, rc.centre_name)}><History size={13} /></button>
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

            {dialogMode && (
                <ActionDialog
                    mode={dialogMode}
                    loading={actionLoading}
                    onConfirm={submitDialog}
                    onCancel={() => { setDialogMode(null); setDialogTargetId(null); }}
                />
            )}
            {viewCentre && <ViewModal centre={viewCentre} onClose={() => setViewCentre(null)} />}
            {historyData !== null && (
                <HistoryModal history={historyData} centreName={historyName} onClose={() => { setHistoryData(null); setHistoryName(''); }} />
            )}
        </div>
    );
}
