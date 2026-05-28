import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/institutes';

function getToken() { return localStorage.getItem('adminToken') || ''; }
function authH(json = false) {
    const h = { Authorization: `Bearer ${getToken()}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

const EMPTY_FORM = {
    college_name: '', college_code: '', principal_name: '',
    principal_mobile: '', college_email: '', college_phone: '',
};

// ─── tiny helpers ────────────────────────────────────────────────────────────
function Badge({ variant, children }) {
    const map = {
        success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning text-dark',
        secondary: 'bg-secondary', info: 'bg-info text-dark', primary: 'bg-primary',
    };
    return <span className={`badge ${map[variant] || 'bg-secondary'}`}>{children}</span>;
}

function StatCard({ label, value, color }) {
    return (
        <div className="col">
            <div className={`card border-0 shadow-sm border-start border-4 border-${color}`}>
                <div className="card-body py-2 px-3">
                    <div className="text-muted small">{label}</div>
                    <div className={`fs-4 fw-bold text-${color}`}>{value}</div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InstituteMaster() {
    const navigate = useNavigate();

    // Table state
    const [rows, setRows]           = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
    const [loading, setLoading]     = useState(false);
    const [search, setSearch]       = useState('');
    const [statusFilter, setStatus] = useState('');
    const [sortCol, setSort]        = useState('id');
    const [sortDir, setDir]         = useState('ASC');

    // Modal state
    const [modalOpen, setModalOpen]   = useState(false);
    const [editRow, setEditRow]       = useState(null);  // null = add mode
    const [formData, setFormData]     = useState(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving]         = useState(false);
    const [formMsg, setFormMsg]       = useState('');

    // Import state
    const [importOpen, setImportOpen]         = useState(false);
    const [importStage, setImportStage]       = useState(0);
    //  Stage 0 = Upload file
    //  Stage 1 = Column Mapping (always shown; confirms auto-detected + allows overrides)
    //  Stage 2 = Review Changes (preview)
    //  Stage 3 = Import Complete (result)
    const [importPreview, setImportPreview]   = useState(null);
    const [importSummary, setImportSummary]   = useState(null);
    const [modifiedRows, setModifiedRows]     = useState([]);
    const [importing, setImporting]           = useState(false);
    const [importResult, setImportResult]     = useState(null);
    const fileRef = useRef(null);

    // Column mapping state ─────────────────────────────────────────────────────
    const [pendingFile, setPendingFile]     = useState(null);    // File object for re-submission
    const [detectedInfo, setDetectedInfo]   = useState(null);    // backend detected_info
    const [columnMapping, setColumnMapping] = useState({});      // { excel_key: db_field }

    // Builds initial columnMapping from backend detected_info (auto-mapped reversed)
    function buildInitialMapping(info) {
        const mapping = {};
        if (!info?.excel_headers) return mapping;
        // Build colIdx → dbField reverse map
        const colToField = {};
        for (const [field, colIdx] of Object.entries(info.auto_mapped || {})) {
            colToField[colIdx] = field;
        }
        for (const hdr of info.excel_headers) {
            mapping[hdr.key] = colToField[hdr.col] || '';
        }
        return mapping;
    }

    // ── Load ──────────────────────────────────────────────────────────────────
    const load = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page, limit: pagination.limit,
                search, status: statusFilter,
                sort: sortCol, order: sortDir,
            });
            const res  = await fetch(`${API}?${params}`, { headers: authH() });
            const json = await res.json();
            if (json.success) {
                setRows(json.data);
                setPagination(json.pagination);
            }
        } catch { /* network error */ }
        finally { setLoading(false); }
    }, [search, statusFilter, sortCol, sortDir, pagination.limit]);

    useEffect(() => { load(1); }, [search, statusFilter, sortCol, sortDir]); // eslint-disable-line

    // ── Sort toggle ───────────────────────────────────────────────────────────
    function handleSort(col) {
        if (sortCol === col) setDir(d => d === 'ASC' ? 'DESC' : 'ASC');
        else { setSort(col); setDir('ASC'); }
    }
    function SortIcon({ col }) {
        if (sortCol !== col) return <span className="text-muted ms-1">⇅</span>;
        return <span className="ms-1">{sortDir === 'ASC' ? '↑' : '↓'}</span>;
    }

    // ── CRUD Modal ────────────────────────────────────────────────────────────
    function openAdd() {
        setEditRow(null); setFormData(EMPTY_FORM);
        setFormErrors({}); setFormMsg(''); setModalOpen(true);
    }
    function openEdit(row) {
        setEditRow(row);
        setFormData({
            college_name:     row.name             || '',
            college_code:     row.college_code     || row.abbreviation || '',
            principal_name:   row.principal_name   || '',
            principal_mobile: row.principal_mobile || '',
            college_email:    row.college_email    || '',
            college_phone:    row.college_phone    || '',
        });
        setFormErrors({}); setFormMsg(''); setModalOpen(true);
    }

    function validate(d) {
        const e = {};
        if (!d.college_name.trim()) e.college_name = 'Required';
        if (!d.college_code.trim()) e.college_code = 'Required';
        if (d.college_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.college_email))
            e.college_email = 'Invalid email';
        if (d.principal_mobile) {
            const m = d.principal_mobile.replace(/\D/g, '');
            if (m.length < 10 || m.length > 15)
                e.principal_mobile = 'Must be 10–15 digits';
        }
        return e;
    }

    async function handleSave() {
        const errs = validate(formData);
        if (Object.keys(errs).length) { setFormErrors(errs); return; }
        setSaving(true); setFormMsg('');
        try {
            const url    = editRow ? `${API}/${editRow.id}` : API;
            const method = editRow ? 'PUT' : 'POST';
            const res    = await fetch(url, {
                method, headers: authH(true),
                body: JSON.stringify(formData),
            });
            const json = await res.json();
            if (json.success) {
                setModalOpen(false);
                load(pagination.page);
            } else {
                setFormMsg(json.message || 'Error saving');
            }
        } catch { setFormMsg('Network error'); }
        finally { setSaving(false); }
    }

    // ── Toggle active ─────────────────────────────────────────────────────────
    async function handleToggle(row) {
        try {
            await fetch(`${API}/${row.id}/toggle`, {
                method: 'PATCH', headers: authH(true),
                body: JSON.stringify({ is_active: !row.is_active }),
            });
            load(pagination.page);
        } catch { /* ignore */ }
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    async function handleDelete(row) {
        if (!window.confirm(`Delete "${row.name}"?\nThis cannot be undone.`)) return;
        try {
            const res  = await fetch(`${API}/${row.id}`, { method: 'DELETE', headers: authH() });
            const json = await res.json();
            if (json.success) load(pagination.page);
            else alert(json.message);
        } catch { alert('Network error'); }
    }

    // ── Export ────────────────────────────────────────────────────────────────
    async function handleExport() {
        const params = new URLSearchParams({ search, status: statusFilter });
        const url    = `${API}/export?${params}`;
        const a      = document.createElement('a');
        a.href       = url + `&token=${getToken()}`;
        a.download   = 'institutes.xlsx';
        a.click();
    }

    // ── Template Download ─────────────────────────────────────────────────────
    async function handleTemplate() {
        const a    = document.createElement('a');
        a.href     = `${API}/template?token=${getToken()}`;
        a.download = 'institute_import_template.xlsx';
        a.click();
    }

    // ── Import: upload file → column mapping stage ────────────────────────────
    async function handleFileUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setImporting(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res  = await fetch(`${API}/import/preview`, {
                method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
            });
            const json = await res.json();
            if (json.success) {
                const info = json.detected_info || null;
                setDetectedInfo(info);
                setColumnMapping(buildInitialMapping(info));
                // Store preview (may be null if needs_mapping)
                if (json.preview) {
                    setImportPreview(json.preview);
                    setImportSummary(json.summary);
                    setModifiedRows((json.preview.modified || []).map(r => ({ ...r, action: 'ignore' })));
                }
                // Always go to stage 1 (Column Mapping) so admin can verify detection
                setImportStage(1);
            } else {
                alert('Upload failed: ' + (json.message || 'Unknown error'));
                setPendingFile(null);
            }
        } catch { alert('Upload failed'); setPendingFile(null); }
        finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
    }

    // ── Apply action to single modified row ───────────────────────────────────
    function setRowAction(idx, action) {
        setModifiedRows(prev => prev.map((r, i) => i === idx ? { ...r, action } : r));
    }
    // ── Apply for All ─────────────────────────────────────────────────────────
    function applyForAll(action) {
        setModifiedRows(prev => prev.map(r => ({ ...r, action })));
    }

    // ── Column Mapping: confirm → re-submit if changed, else advance ──────────
    async function handleMappingConfirm() {
        if (!pendingFile) return;

        // Compare current mapping to auto-detected to see if anything changed
        const originalMapping = buildInitialMapping(detectedInfo);
        const overrides = {};
        for (const [key, dbField] of Object.entries(columnMapping)) {
            const orig = originalMapping[key] || '';
            if (dbField && dbField !== orig) overrides[key] = dbField;
        }

        const hasOverrides = Object.keys(overrides).length > 0;

        // If nothing changed AND we already have a valid preview → just advance
        if (!hasOverrides && importPreview) {
            setImportStage(2);
            return;
        }

        // Otherwise: re-submit file with new mapping (or re-run without overrides
        // to get preview if it was missing, e.g. needs_mapping case)
        setImporting(true);
        try {
            const fd = new FormData();
            fd.append('file', pendingFile);
            if (hasOverrides) fd.append('column_map', JSON.stringify(overrides));
            const res  = await fetch(`${API}/import/preview`, {
                method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
            });
            const json = await res.json();
            if (json.success && json.preview) {
                setDetectedInfo(json.detected_info || null);
                setColumnMapping(buildInitialMapping(json.detected_info));
                setImportPreview(json.preview);
                setImportSummary(json.summary);
                setModifiedRows((json.preview.modified || []).map(r => ({ ...r, action: 'ignore' })));
                setImportStage(2);
            } else {
                alert('Apply mapping failed: ' + (json.message || 'Unknown error'));
            }
        } catch { alert('Network error applying mapping'); }
        finally { setImporting(false); }
    }

    // ── Confirm import ────────────────────────────────────────────────────────
    async function handleImportConfirm() {
        setImporting(true);
        try {
            const res  = await fetch(`${API}/import/confirm`, {
                method: 'POST', headers: authH(true),
                body: JSON.stringify({
                    new_rows:      importPreview.new,
                    modified_rows: modifiedRows,
                    filename:      importSummary?.filename || '',
                }),
            });
            const json = await res.json();
            if (json.success) {
                setImportResult(json.results);
                setImportStage(3);   // ← stage 3 = result
                load(1);
            } else {
                alert('Import failed: ' + (json.message || 'Unknown'));
            }
        } catch { alert('Network error during import'); }
        finally { setImporting(false); }
    }

    function closeImport() {
        setImportOpen(false);
        setImportStage(0);
        setImportPreview(null);
        setImportSummary(null);
        setModifiedRows([]);
        setImportResult(null);
        setPendingFile(null);
        setDetectedInfo(null);
        setColumnMapping({});
    }

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalRows   = pagination.total;
    const activeCount = rows.filter(r => r.is_active).length;

    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div className="container-fluid py-4">
            {/* ── Page Header ── */}
            <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate('/supervisor-masters')}>
                        ← Masters
                    </button>
                    <div>
                        <h4 className="fw-bold mb-0">🏫 Institute Master</h4>
                        <small className="text-muted">Manage affiliated colleges · Periyar University ERP</small>
                    </div>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-outline-secondary btn-sm" onClick={handleTemplate} title="Download import template">
                        📥 Template
                    </button>
                    <button className="btn btn-outline-success btn-sm" onClick={handleExport}>
                        📤 Export Excel
                    </button>
                    <button className="btn btn-outline-primary btn-sm" onClick={() => { setImportStage(0); setImportOpen(true); }}>
                        📂 Import Excel
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={openAdd}>
                        + Add Institute
                    </button>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="row row-cols-2 row-cols-md-4 g-3 mb-3">
                <StatCard label="Total Institutes" value={totalRows}     color="primary"   />
                <StatCard label="Active"            value={rows.filter(r=>r.is_active).length}   color="success"   />
                <StatCard label="Inactive"          value={rows.filter(r=>!r.is_active).length}  color="secondary" />
                <StatCard label="This Page"         value={rows.length}  color="info"      />
            </div>

            {/* ── Filters ── */}
            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body py-2">
                    <div className="row g-2 align-items-center">
                        <div className="col-md-5">
                            <input
                                className="form-control form-control-sm"
                                placeholder="Search by name, code, principal, email…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="col-md-3">
                            <select className="form-select form-select-sm" value={statusFilter}
                                onChange={e => setStatus(e.target.value)}>
                                <option value="">All Status</option>
                                <option value="active">Active Only</option>
                                <option value="inactive">Inactive Only</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select className="form-select form-select-sm" value={pagination.limit}
                                onChange={e => setPagination(p => ({ ...p, limit: parseInt(e.target.value) }))}>
                                <option value={10}>10 / page</option>
                                <option value={20}>20 / page</option>
                                <option value={50}>50 / page</option>
                                <option value={100}>100 / page</option>
                            </select>
                        </div>
                        <div className="col-md-2 text-end">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSearch(''); setStatus(''); }}>
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center text-muted py-5">Loading institutes…</div>
                    ) : rows.length === 0 ? (
                        <div className="text-center text-muted py-5">
                            No institutes found.{' '}
                            {search || statusFilter ? (
                                <button className="btn btn-link btn-sm p-0" onClick={() => { setSearch(''); setStatus(''); }}>
                                    Clear filters
                                </button>
                            ) : (
                                <button className="btn btn-link btn-sm p-0" onClick={openAdd}>Add the first institute</button>
                            )}
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover table-sm align-middle mb-0">
                                <thead className="table-dark">
                                    <tr>
                                        <th style={{ width: 60 }} onClick={() => handleSort('id')} role="button">
                                            S.No<SortIcon col="id" />
                                        </th>
                                        <th style={{ width: 100 }} onClick={() => handleSort('college_code')} role="button">
                                            Code<SortIcon col="college_code" />
                                        </th>
                                        <th onClick={() => handleSort('name')} role="button">
                                            College Name<SortIcon col="name" />
                                        </th>
                                        <th onClick={() => handleSort('principal_name')} role="button">
                                            Principal<SortIcon col="principal_name" />
                                        </th>
                                        <th>Principal Mobile</th>
                                        <th>College Email</th>
                                        <th>College Phone</th>
                                        <th style={{ width: 90 }}>Status</th>
                                        <th style={{ width: 160 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(row => (
                                        <tr key={row.id} className={!row.is_active ? 'table-secondary' : ''}>
                                            <td className="text-muted small fw-semibold">{row.serial_no}</td>
                                            <td>
                                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle fw-semibold">
                                                    {row.college_code || row.abbreviation || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`fw-semibold ${!row.is_active ? 'text-muted text-decoration-line-through' : ''}`}>
                                                    {row.name}
                                                </span>
                                            </td>
                                            <td className="small">{row.principal_name || <span className="text-muted">—</span>}</td>
                                            <td className="small">{row.principal_mobile || <span className="text-muted">—</span>}</td>
                                            <td className="small text-break" style={{ maxWidth: 200 }}>
                                                {row.college_email ? (
                                                    <a href={`mailto:${row.college_email}`} className="text-decoration-none">
                                                        {row.college_email}
                                                    </a>
                                                ) : <span className="text-muted">—</span>}
                                            </td>
                                            <td className="small">{row.college_phone || <span className="text-muted">—</span>}</td>
                                            <td>
                                                <Badge variant={row.is_active ? 'success' : 'secondary'}>
                                                    {row.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td>
                                                <div className="d-flex gap-1 flex-wrap">
                                                    <button className="btn btn-xs btn-outline-primary"
                                                        style={{ fontSize: 11, padding: '2px 7px' }}
                                                        onClick={() => openEdit(row)} title="Edit">
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className={`btn btn-xs ${row.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                                        style={{ fontSize: 11, padding: '2px 7px' }}
                                                        onClick={() => handleToggle(row)}
                                                        title={row.is_active ? 'Disable' : 'Enable'}>
                                                        {row.is_active ? '🔴' : '🟢'}
                                                    </button>
                                                    <button className="btn btn-xs btn-outline-danger"
                                                        style={{ fontSize: 11, padding: '2px 7px' }}
                                                        onClick={() => handleDelete(row)} title="Delete">
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="card-footer bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <small className="text-muted">
                            Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} institutes
                        </small>
                        <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-outline-secondary"
                                disabled={pagination.page <= 1}
                                onClick={() => load(pagination.page - 1)}>‹ Prev</button>
                            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => {
                                const p = Math.max(1, pagination.page - 3) + i;
                                if (p > pagination.pages) return null;
                                return (
                                    <button key={p}
                                        className={`btn btn-sm ${p === pagination.page ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => load(p)}>{p}</button>
                                );
                            })}
                            <button className="btn btn-sm btn-outline-secondary"
                                disabled={pagination.page >= pagination.pages}
                                onClick={() => load(pagination.page + 1)}>Next ›</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ══════════ ADD / EDIT MODAL ══════════════════════════════════════ */}
            {modalOpen && (
                <div className="modal d-block" style={{ background: 'rgba(0,0,0,.45)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold">
                                    {editRow ? '✏️ Edit Institute' : '+ Add New Institute'}
                                </h5>
                                <button className="btn-close btn-close-white" onClick={() => setModalOpen(false)} />
                            </div>
                            <div className="modal-body">
                                {formMsg && (
                                    <div className="alert alert-danger py-2 small">{formMsg}</div>
                                )}
                                <div className="row g-3">
                                    <FormField label="College Code *" error={formErrors.college_code} col={4}>
                                        <input className={`form-control ${formErrors.college_code ? 'is-invalid' : ''}`}
                                            placeholder="e.g. 101"
                                            value={formData.college_code}
                                            onChange={e => setFormData(p => ({ ...p, college_code: e.target.value.toUpperCase() }))} />
                                    </FormField>
                                    <FormField label="College Name *" error={formErrors.college_name} col={8}>
                                        <input className={`form-control ${formErrors.college_name ? 'is-invalid' : ''}`}
                                            placeholder="Full name of the college"
                                            value={formData.college_name}
                                            onChange={e => setFormData(p => ({ ...p, college_name: e.target.value }))} />
                                    </FormField>
                                    <FormField label="Principal Name" col={6}>
                                        <input className="form-control"
                                            placeholder="Dr. Name"
                                            value={formData.principal_name}
                                            onChange={e => setFormData(p => ({ ...p, principal_name: e.target.value }))} />
                                    </FormField>
                                    <FormField label="Principal Mobile" error={formErrors.principal_mobile} col={6}>
                                        <input className={`form-control ${formErrors.principal_mobile ? 'is-invalid' : ''}`}
                                            placeholder="10-digit mobile"
                                            inputMode="numeric"
                                            value={formData.principal_mobile}
                                            onChange={e => setFormData(p => ({ ...p, principal_mobile: e.target.value.replace(/\D/g, '') }))} />
                                    </FormField>
                                    <FormField label="College Email" error={formErrors.college_email} col={6}>
                                        <input className={`form-control ${formErrors.college_email ? 'is-invalid' : ''}`}
                                            placeholder="principal@college.ac.in"
                                            type="email"
                                            value={formData.college_email}
                                            onChange={e => setFormData(p => ({ ...p, college_email: e.target.value }))} />
                                    </FormField>
                                    <FormField label="College Phone Number" col={6}>
                                        <input className="form-control"
                                            placeholder="0427-2XXXXXX"
                                            value={formData.college_phone}
                                            onChange={e => setFormData(p => ({ ...p, college_phone: e.target.value }))} />
                                    </FormField>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>
                                    Cancel
                                </button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Saving…' : editRow ? 'Update Institute' : 'Add Institute'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ IMPORT MODAL ══════════════════════════════════════════ */}
            {importOpen && (
                <div className="modal d-block" style={{ background: 'rgba(0,0,0,.5)' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-dark text-white">
                                <h5 className="modal-title fw-bold">📂 Import Institutes from Excel</h5>
                                <button className="btn-close btn-close-white" onClick={closeImport} />
                            </div>
                            <div className="modal-body p-0">

                                {/* ── Stage indicator (4 steps) ── */}
                                <div className="d-flex border-bottom px-4 py-2 bg-light gap-0 flex-wrap">
                                    {[
                                        'Upload File',
                                        'Column Mapping',
                                        'Review Changes',
                                        'Import Complete',
                                    ].map((s, i) => (
                                        <div key={i} className={`d-flex align-items-center gap-2 me-4 py-1
                                            ${importStage === i ? 'text-primary fw-bold' :
                                              importStage > i  ? 'text-success' : 'text-muted'}`}>
                                            <span className={`badge rounded-pill ${
                                                importStage === i ? 'bg-primary' :
                                                importStage > i   ? 'bg-success' : 'bg-secondary'}`}>
                                                {importStage > i ? '✓' : i + 1}
                                            </span>
                                            <span className="small">{s}</span>
                                            {i < 3 && <span className="text-muted small ms-1">›</span>}
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4">
                                    {/* ─ Stage 0: Upload ─ */}
                                    {importStage === 0 && (
                                        <div>
                                            <div className="alert alert-info small mb-3">
                                                <strong>Smart Import Engine:</strong> Upload any <code>.xlsx</code> or <code>.xls</code> file.
                                                The system automatically detects the header row (skipping Tamil/university banner rows),
                                                maps columns intelligently, and classifies rows before writing anything to the database.{' '}
                                                <button className="btn btn-link btn-sm p-0 align-baseline" onClick={handleTemplate}>
                                                    Download template
                                                </button>
                                            </div>
                                            <div className="border-2 border-dashed rounded-3 p-5 text-center"
                                                style={{ borderStyle: 'dashed', borderColor: '#adb5bd', background: '#f8f9fa' }}>
                                                <div className="fs-1 mb-2">📊</div>
                                                <div className="fw-semibold mb-1">Drop Excel file here or click to browse</div>
                                                <div className="text-muted small mb-3">
                                                    Supported: .xlsx, .xls — Max 10 MB<br />
                                                    <span className="text-success">✓ Works with official Periyar University college lists</span>
                                                </div>
                                                <input ref={fileRef} type="file" accept=".xlsx,.xls"
                                                    onChange={handleFileUpload}
                                                    className="d-none" id="importFile" />
                                                <label htmlFor="importFile"
                                                    className={`btn btn-primary ${importing ? 'disabled' : ''}`}>
                                                    {importing ? '🔍 Analysing file…' : '📂 Select File'}
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* ─ Stage 1: Column Mapping ─ */}
                                    {importStage === 1 && detectedInfo && (
                                        <ColumnMappingStage
                                            detectedInfo={detectedInfo}
                                            columnMapping={columnMapping}
                                            onMappingChange={(key, val) =>
                                                setColumnMapping(prev => ({ ...prev, [key]: val }))
                                            }
                                            filename={importSummary?.filename || pendingFile?.name || ''}
                                        />
                                    )}

                                    {/* ─ Stage 2: Preview ─ */}
                                    {importStage === 2 && importPreview && (
                                        <ImportPreview
                                            preview={importPreview}
                                            summary={importSummary}
                                            modifiedRows={modifiedRows}
                                            onRowAction={setRowAction}
                                            onApplyForAll={applyForAll}
                                            detectedInfo={detectedInfo}
                                        />
                                    )}

                                    {/* ─ Stage 3: Result ─ */}
                                    {importStage === 3 && importResult && (
                                        <div className="text-center py-4">
                                            <div className="fs-1 mb-2">✅</div>
                                            <h5 className="fw-bold text-success mb-3">Import Complete</h5>
                                            <div className="row row-cols-2 row-cols-md-4 g-3 justify-content-center mb-3">
                                                <StatCard label="Inserted" value={importResult.inserted} color="success" />
                                                <StatCard label="Updated"  value={importResult.updated}  color="info"    />
                                                <StatCard label="Ignored"  value={importResult.ignored || 0} color="warning" />
                                                <StatCard label="Skipped"  value={importResult.skipped}  color="secondary"/>
                                            </div>
                                            {importResult.warnings?.length > 0 && (
                                                <div className="alert alert-warning text-start small">
                                                    <strong>⚠️ {importResult.warnings.length} row(s) had issues and were handled automatically:</strong>
                                                    <ul className="mb-0 mt-1">
                                                        {importResult.warnings.map((w, i) => (
                                                            <li key={i}><code>{w.row}</code> — {w.note}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            <button className="btn btn-primary" onClick={closeImport}>Done</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal footer (stages 0, 1, 2 only) */}
                            {importStage < 3 && (
                                <div className="modal-footer">
                                    {importStage === 0 && (
                                        <button className="btn btn-outline-secondary" onClick={closeImport}>Cancel</button>
                                    )}
                                    {importStage === 1 && (
                                        <>
                                            <button className="btn btn-outline-secondary"
                                                onClick={() => { setImportStage(0); setPendingFile(null); setDetectedInfo(null); setColumnMapping({}); setImportPreview(null); setImportSummary(null); }}>
                                                ← Upload Different File
                                            </button>
                                            <div className="ms-auto">
                                                <button className="btn btn-primary" onClick={handleMappingConfirm} disabled={importing}>
                                                    {importing ? 'Applying…' : 'Confirm Mapping & Preview →'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                    {importStage === 2 && (
                                        <>
                                            <button className="btn btn-outline-secondary"
                                                onClick={() => setImportStage(1)}>← Back to Mapping</button>
                                            <div className="ms-auto d-flex gap-2 align-items-center">
                                                <span className="text-muted small">
                                                    {importPreview?.new?.length || 0} new ·{' '}
                                                    {modifiedRows.filter(r => r.action === 'update').length} to replace ·{' '}
                                                     {modifiedRows.filter(r => r.action === 'ignore').length} to ignore ·{' '}
                                                     {modifiedRows.filter(r => r.action === 'skip').length} to skip
                                                </span>
                                                <button className="btn btn-success" onClick={handleImportConfirm} disabled={importing}>
                                                    {importing ? 'Importing…' : '✓ Confirm Import'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Form Field helper ────────────────────────────────────────────────────────
function FormField({ label, error, col = 6, children }) {
    return (
        <div className={`col-md-${col}`}>
            <label className="form-label fw-semibold small mb-1">{label}</label>
            {children}
            {error && <div className="invalid-feedback d-block" style={{ fontSize: 11 }}>{error}</div>}
        </div>
    );
}

// ─── Column Mapping Stage ─────────────────────────────────────────────────────
// Shown as Stage 1 after file upload.  Displays every Excel column found in the
// detected header row with its auto-mapped DB field.  Admin can override any
// mapping via the dropdowns before proceeding to the preview.
const DB_FIELD_OPTIONS = [
    { value: '',                label: '— ignore this column —' },
    { value: 'college_code',    label: 'College Code *'         },
    { value: 'college_name',    label: 'College Name *'         },
    { value: 'principal_name',  label: 'Principal Name'         },
    { value: 'principal_mobile',label: 'Principal Mobile'       },
    { value: 'college_email',   label: 'College Email'          },
    { value: 'college_phone',   label: 'College Phone Number'   },
];

const SERIAL_KEYS_FE = new Set(['s_no','sno','serial_no','serial','s_no_','sl_no','sl_no_','no']);

function ColumnMappingStage({ detectedInfo, columnMapping, onMappingChange, filename }) {
    const { header_row, auto_mapped = {}, excel_headers = [], missing_required = [] } = detectedInfo || {};

    // Build colIdx → dbField reverse for display
    const colToField = {};
    for (const [field, colIdx] of Object.entries(auto_mapped)) colToField[colIdx] = field;

    const allMapped    = missing_required.length === 0;
    const hasWarnings  = excel_headers.some(h => !SERIAL_KEYS_FE.has(h.key) && !columnMapping[h.key]);

    return (
        <div>
            {/* ── Detection result banner ── */}
            <div className={`alert ${allMapped ? 'alert-success' : 'alert-warning'} small mb-3 d-flex gap-2`}>
                <div>
                    {allMapped
                        ? <><strong>✅ All columns auto-detected</strong> from row {header_row} of <em>{filename}</em>.<br />
                            Review the mapping below and click <strong>Confirm Mapping &amp; Preview</strong> to proceed.</>
                        : <><strong>⚠️ Partial column detection</strong> — header row {header_row} detected.<br />
                            Required columns missing: <code>{missing_required.join(', ')}</code>.
                            Please map them manually below.</>
                    }
                </div>
            </div>

            {/* ── Mapping table ── */}
            <div className="table-responsive">
                <table className="table table-sm table-bordered align-middle small mb-0">
                    <thead className="table-dark">
                        <tr>
                            <th style={{ width: 60 }}>Col</th>
                            <th>Excel Header (from file)</th>
                            <th style={{ width: 220 }}>Auto-Detected</th>
                            <th>Map to Database Field</th>
                        </tr>
                    </thead>
                    <tbody>
                        {excel_headers.map((hdr, i) => {
                            const isSerial    = SERIAL_KEYS_FE.has(hdr.key);
                            const autoField   = colToField[hdr.col] || '';
                            const currentVal  = columnMapping[hdr.key] ?? autoField;

                            return (
                                <tr key={i} className={
                                    isSerial ? 'table-secondary' :
                                    !currentVal ? 'table-warning' :
                                    currentVal === autoField && autoField ? 'table-success' : ''
                                }>
                                    <td className="text-muted fw-semibold text-center">
                                        {String.fromCharCode(64 + hdr.col)}
                                    </td>
                                    <td>
                                        <code className="text-dark">{hdr.raw}</code>
                                        {isSerial && (
                                            <span className="badge bg-secondary ms-2" style={{ fontSize: 10 }}>
                                                serial — ignored
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {isSerial ? (
                                            <span className="text-muted">—</span>
                                        ) : autoField ? (
                                            <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                ✓ {autoField}
                                            </span>
                                        ) : (
                                            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                                ⚠ unrecognised
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {isSerial ? (
                                            <span className="text-muted small fst-italic">Not imported</span>
                                        ) : (
                                            <select
                                                className={`form-select form-select-sm ${!currentVal ? 'border-warning' : ''}`}
                                                value={currentVal}
                                                onChange={e => onMappingChange(hdr.key, e.target.value)}
                                                style={{ maxWidth: 260 }}
                                            >
                                                {DB_FIELD_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Legend ── */}
            <div className="d-flex gap-3 mt-3 flex-wrap small text-muted">
                <span><span className="badge bg-success-subtle text-success border border-success-subtle me-1">✓</span>Auto-mapped</span>
                <span><span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle me-1">⚠</span>Needs mapping</span>
                <span><span className="badge bg-secondary me-1">serial</span>Ignored (S.No column)</span>
            </div>

            {/* ── Required fields check ── */}
            {missing_required.length > 0 && (
                <div className="alert alert-danger small mt-3 mb-0">
                    <strong>Action required:</strong> Map the highlighted columns above to{' '}
                    <code>{missing_required.map(f => `"${f}"`).join(' and ')}</code>{' '}
                    before proceeding.
                </div>
            )}
        </div>
    );
}

// ─── Import Preview Component ─────────────────────────────────────────────────
function ImportPreview({ preview, summary, modifiedRows, onRowAction, onApplyForAll, detectedInfo }) {
    const [tab, setTab] = useState('new');
    const [showMapping, setShowMapping] = useState(false);

    const warningRows = preview.new?.filter(r => r.warnings?.length) || [];
    const tabs = [
        { key: 'new',       label: 'New',       count: preview.new?.length       || 0, color: 'success'   },
        { key: 'modified',  label: 'Modified',  count: preview.modified?.length  || 0, color: 'warning'   },
        { key: 'duplicate', label: 'Duplicate', count: preview.duplicate?.length || 0, color: 'secondary' },
        { key: 'warnings',  label: 'Warnings',  count: warningRows.length,             color: 'warning'   },
    ];

    return (
        <div>
            {/* ── Detected mapping summary (collapsible) ── */}
            {detectedInfo && (
                <div className="mb-3">
                    <button
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
                        onClick={() => setShowMapping(v => !v)}
                        style={{ fontSize: 12 }}
                    >
                        🗂️ Column Mapping Used (row {detectedInfo.header_row})
                        {detectedInfo.missing_required?.length > 0
                            ? <span className="badge bg-danger ms-1">⚠ {detectedInfo.missing_required.length} missing</span>
                            : <span className="badge bg-success ms-1">✓ all mapped</span>}
                        <span>{showMapping ? '▲' : '▼'}</span>
                    </button>
                    {showMapping && (
                        <div className="mt-2 p-3 bg-light border rounded small">
                            <div className="d-flex flex-wrap gap-2">
                                {detectedInfo.excel_headers?.map((h, i) => {
                                    const field = Object.entries(detectedInfo.auto_mapped || {})
                                        .find(([, ci]) => ci === h.col)?.[0];
                                    const isSerial = ['s_no','sno','serial_no','serial','sl_no'].some(k => h.key.includes(k));
                                    return (
                                        <span key={i} className={`badge border ${
                                            isSerial ? 'bg-secondary-subtle text-secondary border-secondary-subtle' :
                                            field    ? 'bg-success-subtle text-success border-success-subtle' :
                                                       'bg-warning-subtle text-warning-emphasis border-warning-subtle'
                                        }`}>
                                            {h.raw} → {isSerial ? 'ignored' : field || 'unmapped'}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Summary bar */}
            <div className="alert alert-light border mb-3 py-2 px-3">
                <div className="d-flex flex-wrap gap-3 align-items-center">
                    <strong className="me-1">📄 {summary?.filename}</strong>
                    <span className="text-muted small">|</span>
                    <span><Badge variant="primary">{summary?.total || 0}</Badge>{' '}total rows</span>
                    {tabs.filter(t => t.count > 0).map(t => (
                        <span key={t.key}>
                            <Badge variant={t.color}>{t.count}</Badge>{' '}{t.label}
                        </span>
                    ))}
                    {(summary?.ignored > 0) && (
                        <span><Badge variant="secondary">{summary.ignored}</Badge>{' '}ignored (blank)</span>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <ul className="nav nav-tabs mb-3">
                {tabs.map(t => (
                    <li key={t.key} className="nav-item">
                        <button className={`nav-link ${tab === t.key ? 'active fw-semibold' : ''}`}
                            onClick={() => setTab(t.key)}>
                            {t.label}{' '}
                            <span className={`badge bg-${t.color} ms-1`}>{t.count}</span>
                        </button>
                    </li>
                ))}
            </ul>

            {/* NEW tab */}
            {tab === 'new' && (
                <div>
                    {preview.new?.length === 0 ? (
                        <p className="text-muted">No new records to insert.</p>
                    ) : (
                        <>
                            <p className="text-success small fw-semibold mb-2">
                                ✅ {preview.new.length} new institute(s) will be inserted.
                            </p>
                            <PreviewTable rows={preview.new} showErrors={false} />
                        </>
                    )}
                </div>
            )}

            {/* MODIFIED tab */}
            {tab === 'modified' && (
                <div>
                    {modifiedRows.length === 0 ? (
                        <p className="text-muted">No modified records.</p>
                    ) : (
                        <>
                            <div className="d-flex align-items-center gap-3 mb-3 p-2 bg-warning-subtle rounded flex-wrap">
                                <span className="small fw-semibold text-warning-emphasis">
                                    ⚠️ {modifiedRows.length} record(s) differ from existing data.
                                    Choose action for each row, or use Apply for All:
                                </span>
                                <div className="d-flex gap-2 ms-auto flex-wrap">
                                    <button className="btn btn-sm btn-success" onClick={() => onApplyForAll('update')}>
                                        Replace Existing for All
                                    </button>
                                    <button className="btn btn-sm btn-secondary" onClick={() => onApplyForAll('ignore')}>
                                        Ignore & Continue for All
                                    </button>
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => onApplyForAll('skip')}>
                                        Skip All Rows
                                    </button>
                                </div>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-sm table-bordered align-middle small">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Row</th>
                                            <th>Code</th>
                                            <th>College Name</th>
                                            <th>Changed Fields</th>
                                            <th style={{ width: 320 }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {modifiedRows.map((row, i) => (
                                            <tr key={i} className={
                                                row.action === 'update' ? 'table-warning' :
                                                row.action === 'ignore' ? 'table-light text-muted' : ''
                                            }>
                                                <td className="text-muted">{row.row_number}</td>
                                                <td><code>{row.college_code}</code></td>
                                                <td>{row.college_name}</td>
                                                <td>
                                                    {row.changes?.map((c, ci) => (
                                                        <div key={ci} className="mb-1">
                                                            <span className="fw-semibold text-capitalize">
                                                                {c.field.replace(/_/g, ' ')}:
                                                            </span>{' '}
                                                            <span className="text-danger text-decoration-line-through me-1">
                                                                {c.old_value || '(empty)'}
                                                            </span>
                                                            →{' '}
                                                            <span className="text-success fw-semibold">
                                                                {c.new_value || '(empty)'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </td>
                                                <td>
                                                    <div className="d-flex gap-1 flex-wrap">
                                                        <button
                                                            className={`btn btn-xs ${row.action === 'update' ? 'btn-success' : 'btn-outline-success'}`}
                                                            style={{ fontSize: 11, padding: '2px 8px' }}
                                                            onClick={() => onRowAction(i, 'update')}>
                                                            Replace Existing
                                                        </button>
                                                        <button
                                                            className={`btn btn-xs ${row.action === 'ignore' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                                            style={{ fontSize: 11, padding: '2px 8px' }}
                                                            onClick={() => onRowAction(i, 'ignore')}>
                                                            Ignore & Continue
                                                        </button>
                                                        <button
                                                            className={`btn btn-xs ${row.action === 'skip' ? 'btn-danger' : 'btn-outline-danger'}`}
                                                            style={{ fontSize: 11, padding: '2px 8px' }}
                                                            onClick={() => onRowAction(i, 'skip')}>
                                                            Skip Existing Row
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* DUPLICATE tab */}
            {tab === 'duplicate' && (
                <div>
                    {preview.duplicate?.length === 0 ? (
                        <p className="text-muted">No duplicates detected.</p>
                    ) : (
                        <>
                            <p className="text-muted small mb-2">
                                These rows will be <strong>skipped</strong> — they match existing records.
                            </p>
                            <PreviewTable rows={preview.duplicate} showErrors={false} showReason={true} />
                        </>
                    )}
                </div>
            )}

            {/* WARNINGS tab */}
            {tab === 'warnings' && (
                <div>
                    {warningRows.length === 0 ? (
                        <p className="text-success small">✅ No data warnings — all rows look clean.</p>
                    ) : (
                        <>
                            <div className="alert alert-warning small mb-3">
                                <strong>⚠️ {warningRows.length} row(s) have soft warnings</strong> — these rows
                                will still be imported. Warnings are informational only and <strong>do not block import</strong>.
                            </div>
                            <PreviewTable rows={warningRows} showWarnings={true} />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Preview Table (shared for new / duplicate / invalid) ─────────────────────
function PreviewTable({ rows, showErrors, showReason, showWarnings }) {
    return (
        <div className="table-responsive" style={{ maxHeight: 340, overflowY: 'auto' }}>
            <table className="table table-sm table-bordered small mb-0">
                <thead className="table-light sticky-top">
                    <tr>
                        <th>Row</th>
                        <th>Code</th>
                        <th>College Name</th>
                        <th>Principal</th>
                        <th>Mobile</th>
                        <th>Email</th>
                        <th>Phone</th>
                        {showReason    && <th>Reason</th>}
                        {showErrors    && <th>Errors</th>}
                        {showWarnings  && <th>Warnings</th>}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} className={showWarnings ? 'table-warning' : ''}>
                            <td className="text-muted">{r.row_number}</td>
                            <td><code>{r.college_code || '—'}</code></td>
                            <td>{r.college_name || '—'}</td>
                            <td>{r.principal_name || '—'}</td>
                            <td>{r.principal_mobile || '—'}</td>
                            <td>{r.college_email || '—'}</td>
                            <td>{r.college_phone || '—'}</td>
                            {showReason && (
                                <td className="text-warning-emphasis small">{r.duplicate_reason || '—'}</td>
                            )}
                            {showErrors && (
                                <td className="text-danger small">
                                    {r.errors?.map((e, ei) => <div key={ei}>• {e}</div>)}
                                </td>
                            )}
                            {showWarnings && (
                                <td className="text-warning-emphasis small">
                                    {r.warnings?.map((w, wi) => <div key={wi}>⚠ {w}</div>) || '—'}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
