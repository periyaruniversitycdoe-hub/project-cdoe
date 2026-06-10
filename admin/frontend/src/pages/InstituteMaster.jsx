import { useState, useEffect, useCallback, useRef } from 'react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

function getToken() { return localStorage.getItem('adminToken') || ''; }
function authHeaders(json = true) {
    const h = { Authorization: `Bearer ${getToken()}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

const INSTITUTE_TYPES = [
    'University Department',
    'Affiliated College',
    'Autonomous College',
    'Research Institute',
    'National Institute',
    'Government Institute',
    'Deemed University',
    'Centre of Excellence',
    'Other',
];

const EMPTY_FORM = {
    institute_name: '', institute_type: '', institute_code: '',
    address_line_1: '', address_line_2: '', address_line_3: '',
    district: '', state: '', pincode: '',
    mobile_no: '', phone_no: '', email: '', website: '',
    remarks: '', status: 'Active',
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InstituteMaster() {
    const [view, setView]       = useState('list'); // 'list' | 'form' | 'import'
    const [editRow, setEditRow] = useState(null);

    if (view === 'form') {
        return (
            <InstituteForm
                initial={editRow}
                onDone={() => { setView('list'); setEditRow(null); }}
            />
        );
    }
    if (view === 'import') {
        return <InstituteImport onDone={() => setView('list')} />;
    }
    return (
        <InstituteList
            onAdd={()    => { setEditRow(null); setView('form'); }}
            onEdit={row  => { setEditRow(row);  setView('form'); }}
            onImport={() => setView('import')}
        />
    );
}

// ─── List View ────────────────────────────────────────────────────────────────
function InstituteList({ onAdd, onEdit, onImport }) {
    const [rows, setRows]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage]       = useState(1);
    const limit = 20;
    const [filters, setFilters] = useState({ search: '', status: '', institute_type: '' });
    const [sortCol, setSortCol] = useState('id');
    const [sortDir, setSortDir] = useState('ASC');
    const [stats, setStats]     = useState({ total: 0, active: 0, inactive: 0 });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const q = new URLSearchParams({
                page, limit, sort: sortCol, order: sortDir,
                search: filters.search, status: filters.status,
                institute_type: filters.institute_type,
            }).toString();
            const res  = await fetch(`${API}/university-institutes?${q}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) { setRows(json.data); setTotal(json.pagination.total); }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [page, limit, sortCol, sortDir, filters]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        Promise.all([
            fetch(`${API}/university-institutes?limit=1`,               { headers: authHeaders() }),
            fetch(`${API}/university-institutes?limit=1&status=Active`,  { headers: authHeaders() }),
            fetch(`${API}/university-institutes?limit=1&status=Inactive`,{ headers: authHeaders() }),
        ]).then(async ([a, b, c]) => {
            const [ra, rb, rc] = await Promise.all([a.json(), b.json(), c.json()]);
            setStats({ total: ra.pagination?.total || 0, active: rb.pagination?.total || 0, inactive: rc.pagination?.total || 0 });
        }).catch(() => {});
    }, [rows]);

    function toggleSort(col) {
        if (sortCol === col) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
        else { setSortCol(col); setSortDir('ASC'); }
    }

    async function toggleStatus(id, currentStatus) {
        const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
        const res  = await fetch(`${API}/university-institutes/${id}/toggle`, {
            method: 'PATCH', headers: authHeaders(),
            body: JSON.stringify({ status: newStatus }),
        });
        const json = await res.json();
        if (!json.success) { alert(json.message || 'Failed'); return; }
        load();
    }

    async function deleteRow(id, name) {
        if (!window.confirm(`Delete institute "${name}"? This cannot be undone.`)) return;
        const res  = await fetch(`${API}/university-institutes/${id}`, { method: 'DELETE', headers: authHeaders() });
        const json = await res.json();
        if (!json.success) { alert(json.message); return; }
        load();
    }

    function handleExport() {
        const q = new URLSearchParams({ search: filters.search, status: filters.status, institute_type: filters.institute_type }).toString();
        const a = document.createElement('a');
        a.href = `${API}/university-institutes/export?${q}&token=${getToken()}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }

    function handleTemplate() {
        const a = document.createElement('a');
        a.href = `${API}/university-institutes/template?token=${getToken()}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
                <div>
                    <h4 className="mb-0 fw-bold text-primary">Institute Master</h4>
                    <small className="text-muted">University → Institute → Research Center → Supervisor</small>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-sm btn-outline-secondary" onClick={handleTemplate}>📥 Template</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={onImport}>📤 Import Excel</button>
                    <button className="btn btn-sm btn-outline-success" onClick={handleExport}>📊 Export</button>
                    <button className="btn btn-primary" onClick={onAdd}>+ Add Institute</button>
                </div>
            </div>

            {/* Stats */}
            <div className="row g-3 mb-4">
                {[
                    { label: 'Total Institutes',   value: stats.total,    color: 'primary' },
                    { label: 'Active Institutes',  value: stats.active,   color: 'success' },
                    { label: 'Inactive Institutes',value: stats.inactive, color: 'secondary' },
                ].map(c => (
                    <div key={c.label} className="col-6 col-md-3">
                        <div className={`card border-0 shadow-sm border-start border-4 border-${c.color}`}>
                            <div className="card-body py-3">
                                <div className={`fw-bold fs-4 text-${c.color}`}>{c.value}</div>
                                <div className="small text-muted">{c.label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body py-2">
                    <div className="row g-2 align-items-end">
                        <div className="col-md-4">
                            <input className="form-control form-control-sm"
                                placeholder="Search name, code, district, email..."
                                value={filters.search}
                                onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }} />
                        </div>
                        <div className="col-md-3">
                            <select className="form-select form-select-sm"
                                value={filters.status}
                                onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}>
                                <option value="">All Status</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        <div className="col-md-3">
                            <select className="form-select form-select-sm"
                                value={filters.institute_type}
                                onChange={e => { setFilters(f => ({ ...f, institute_type: e.target.value })); setPage(1); }}>
                                <option value="">All Types</option>
                                {INSTITUTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-sm btn-outline-secondary w-100"
                                onClick={() => { setFilters({ search: '', status: '', institute_type: '' }); setPage(1); }}>
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading institutes...</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th>#</th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('institute_code')}>
                                            Code {sortCol === 'institute_code' ? (sortDir === 'ASC' ? '↑' : '↓') : ''}
                                        </th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('institute_name')}>
                                            Institute Name {sortCol === 'institute_name' ? (sortDir === 'ASC' ? '↑' : '↓') : ''}
                                        </th>
                                        <th>Type</th>
                                        <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('district')}>
                                            District {sortCol === 'district' ? (sortDir === 'ASC' ? '↑' : '↓') : ''}
                                        </th>
                                        <th>State</th>
                                        <th>Contact</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center py-5 text-muted">
                                            No institutes found.{' '}
                                            <button className="btn btn-link btn-sm p-0" onClick={onAdd}>Add the first one</button>
                                        </td></tr>
                                    ) : rows.map(r => (
                                        <tr key={r.id}>
                                            <td className="text-muted small">{r.serial_no}</td>
                                            <td><span className="badge bg-light text-dark border fw-semibold">{r.institute_code}</span></td>
                                            <td>
                                                <div className="fw-semibold text-primary">{r.institute_name}</div>
                                                {r.website && <div className="small text-muted">{r.website}</div>}
                                            </td>
                                            <td><span className="badge bg-info bg-opacity-10 text-info">{r.institute_type}</span></td>
                                            <td className="small">{r.district || '—'}</td>
                                            <td className="small">{r.state || '—'}</td>
                                            <td>
                                                {r.email    && <div className="small">{r.email}</div>}
                                                {r.mobile_no && <div className="small text-muted">{r.mobile_no}</div>}
                                            </td>
                                            <td>
                                                <span className={`badge bg-${r.status === 'Active' ? 'success' : 'secondary'}`}>{r.status}</span>
                                            </td>
                                            <td>
                                                <div className="d-flex gap-1 flex-wrap">
                                                    <button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(r)}>Edit</button>
                                                    <button
                                                        className={`btn btn-sm ${r.status === 'Active' ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                                        onClick={() => toggleStatus(r.id, r.status)}>
                                                        {r.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteRow(r.id, r.institute_name)}>Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                {totalPages > 1 && (
                    <div className="card-footer d-flex justify-content-between align-items-center">
                        <span className="text-muted small">Total: {total} institutes</span>
                        <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                            <span className="btn btn-sm btn-light disabled">Page {page} / {totalPages}</span>
                            <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Add / Edit Form ──────────────────────────────────────────────────────────
function InstituteForm({ initial, onDone }) {
    const isEdit = !!initial;
    const [form, setForm]       = useState(initial ? {
        institute_name: initial.institute_name || '',
        institute_type: initial.institute_type || '',
        institute_code: initial.institute_code || '',
        address_line_1: initial.address_line_1 || '',
        address_line_2: initial.address_line_2 || '',
        address_line_3: initial.address_line_3 || '',
        district:       initial.district       || '',
        state:          initial.state          || '',
        pincode:        initial.pincode        || '',
        mobile_no:      initial.mobile_no      || '',
        phone_no:       initial.phone_no       || '',
        email:          initial.email          || '',
        website:        initial.website        || '',
        remarks:        initial.remarks        || '',
        status:         initial.status         || 'Active',
    } : { ...EMPTY_FORM });
    const [errors, setErrors]       = useState({});
    const [saving, setSaving]       = useState(false);
    const [serverErr, setServerErr] = useState('');

    const set = key => e => {
        setForm(f => ({ ...f, [key]: e.target.value }));
        setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    };

    function validate() {
        const errs = {};
        if (!form.institute_name.trim()) errs.institute_name = 'Institute Name is required';
        if (!form.institute_type.trim()) errs.institute_type = 'Institute Type is required';
        if (!form.institute_code.trim()) errs.institute_code = 'Institute Code is required';
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            errs.email = 'Invalid email format';
        if (form.mobile_no && !/^\d{8,15}$/.test(form.mobile_no.replace(/\D/g, '')))
            errs.mobile_no = 'Mobile must be 8–15 digits';
        if (form.pincode && !/^\d{6}$/.test(form.pincode))
            errs.pincode = 'Pincode must be 6 digits';
        return errs;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setSaving(true); setServerErr('');
        try {
            const url    = isEdit ? `${API}/university-institutes/${initial.id}` : `${API}/university-institutes`;
            const method = isEdit ? 'PUT' : 'POST';
            const res    = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(form) });
            const json   = await res.json();
            if (!json.success) { setServerErr(json.message || 'Save failed'); return; }
            onDone();
        } catch { setServerErr('Network error. Please try again.'); }
        finally { setSaving(false); }
    }

    const Field = ({ label, name, required, type = 'text', placeholder, hint, wide }) => (
        <div className={wide ? 'col-12' : 'col-md-6'}>
            <label className="form-label fw-semibold small">
                {label}{required && <span className="text-danger ms-1">*</span>}
            </label>
            <input
                className={`form-control form-control-sm ${errors[name] ? 'is-invalid' : ''}`}
                type={type} name={name} value={form[name]} onChange={set(name)}
                placeholder={placeholder}
            />
            {errors[name] && <div className="invalid-feedback">{errors[name]}</div>}
            {hint && <div className="form-text" style={{ fontSize: 11 }}>{hint}</div>}
        </div>
    );

    return (
        <div className="container-fluid py-4">
            <div className="d-flex align-items-center gap-2 mb-4">
                <button className="btn btn-sm btn-outline-secondary" onClick={onDone}>← Back</button>
                <div>
                    <h4 className="fw-bold mb-0">{isEdit ? 'Edit Institute' : 'Add New Institute'}</h4>
                    <small className="text-muted">University Institute Master</small>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                {serverErr && <div className="alert alert-danger py-2 small mb-3">{serverErr}</div>}

                {/* Basic Info */}
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-light fw-semibold">Basic Information</div>
                    <div className="card-body">
                        <div className="row g-3">
                            <Field label="Institute Name" name="institute_name" required placeholder="e.g. Institute of Engineering" wide />
                            <div className="col-md-6">
                                <label className="form-label fw-semibold small">Institute Type <span className="text-danger">*</span></label>
                                <select className={`form-select form-select-sm ${errors.institute_type ? 'is-invalid' : ''}`}
                                    value={form.institute_type} onChange={set('institute_type')}>
                                    <option value="">— Select Type —</option>
                                    {INSTITUTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                {errors.institute_type && <div className="invalid-feedback">{errors.institute_type}</div>}
                            </div>
                            <Field label="Institute Code" name="institute_code" required placeholder="e.g. IE001" hint="Must be unique" />
                            <div className="col-md-6">
                                <label className="form-label fw-semibold small">Status</label>
                                <select className="form-select form-select-sm" value={form.status} onChange={set('status')}>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Address */}
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-light fw-semibold">Address</div>
                    <div className="card-body">
                        <div className="row g-3">
                            <Field label="Address Line 1" name="address_line_1" placeholder="Door No, Street" wide />
                            <Field label="Address Line 2" name="address_line_2" placeholder="Area / Locality" />
                            <Field label="Address Line 3" name="address_line_3" placeholder="Landmark" />
                            <Field label="District"       name="district"       placeholder="e.g. Salem" />
                            <Field label="State"          name="state"          placeholder="e.g. Tamil Nadu" />
                            <Field label="Pincode"        name="pincode"        placeholder="6 digits" hint="e.g. 636001" />
                        </div>
                    </div>
                </div>

                {/* Contact */}
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-light fw-semibold">Contact Information</div>
                    <div className="card-body">
                        <div className="row g-3">
                            <Field label="Mobile No" name="mobile_no" placeholder="10–15 digits" />
                            <Field label="Phone No"  name="phone_no"  placeholder="STD code + number" />
                            <Field label="E-mail"    name="email"     type="email" placeholder="institute@university.ac.in" />
                            <Field label="Website"   name="website"   placeholder="https://..." />
                        </div>
                    </div>
                </div>

                {/* Remarks */}
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-body">
                        <label className="form-label fw-semibold small">Remarks</label>
                        <textarea className="form-control form-control-sm" rows={3}
                            value={form.remarks} onChange={set('remarks')}
                            placeholder="Optional notes about this institute..." />
                    </div>
                </div>

                <div className="d-flex gap-2 justify-content-end">
                    <button type="button" className="btn btn-outline-secondary" onClick={onDone}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : (isEdit ? 'Update Institute' : 'Add Institute')}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ─── Excel Import Wizard ──────────────────────────────────────────────────────
function InstituteImport({ onDone }) {
    const [phase, setPhase]             = useState('upload');
    const [file, setFile]               = useState(null);
    const [loading, setLoading]         = useState(false);
    const [preview, setPreview]         = useState(null);
    const [detectedInfo, setDetectedInfo] = useState(null);
    const [columnMap, setColumnMap]     = useState({});
    const [results, setResults]         = useState(null);
    const [modifiedActions, setModifiedActions] = useState({});

    const DB_FIELDS = [
        { value: '',               label: '— Skip —' },
        { value: 'institute_name', label: 'Institute Name' },
        { value: 'institute_type', label: 'Institute Type' },
        { value: 'institute_code', label: 'Institute Code' },
        { value: 'address_line_1', label: 'Address Line 1' },
        { value: 'address_line_2', label: 'Address Line 2' },
        { value: 'address_line_3', label: 'Address Line 3' },
        { value: 'district',       label: 'District' },
        { value: 'state',          label: 'State' },
        { value: 'pincode',        label: 'Pincode' },
        { value: 'mobile_no',      label: 'Mobile No' },
        { value: 'phone_no',       label: 'Phone No' },
        { value: 'email',          label: 'E-mail' },
        { value: 'website',        label: 'Website' },
        { value: 'remarks',        label: 'Remarks' },
    ];

    async function handleUpload() {
        if (!file) return;
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            if (Object.keys(columnMap).length) fd.append('column_map', JSON.stringify(columnMap));
            const res  = await fetch(`${API}/university-institutes/import/preview`, {
                method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
            });
            const json = await res.json();
            if (!json.success) { alert(json.message || 'Preview failed'); return; }
            setPreview(json.preview);
            setDetectedInfo(json.detected_info);
            const actions = {};
            (json.preview.modified || []).forEach(r => { actions[r.row_number] = 'skip'; });
            setModifiedActions(actions);
            const needsMapping = json.detected_info?.missing_required?.length > 0;
            setPhase(needsMapping ? 'mapping' : 'preview');
        } catch { alert('Upload failed. Please try again.'); }
        finally { setLoading(false); }
    }

    async function handleConfirm() {
        setLoading(true);
        try {
            const modified_rows = (preview.modified || []).map(r => ({
                ...r, action: modifiedActions[r.row_number] || 'skip',
            }));
            const res  = await fetch(`${API}/university-institutes/import/confirm`, {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({ new_rows: preview.new || [], modified_rows, filename: file.name }),
            });
            const json = await res.json();
            if (!json.success) { alert(json.message); return; }
            setResults(json.results);
            setPhase('done');
        } catch { alert('Confirm failed.'); }
        finally { setLoading(false); }
    }

    if (phase === 'done') {
        return (
            <div className="container-fluid py-4">
                <div className="card border-0 shadow-sm mx-auto" style={{ maxWidth: 500 }}>
                    <div className="card-body text-center py-5">
                        <div style={{ fontSize: 48 }}>✅</div>
                        <h5 className="fw-bold mt-3">Import Complete</h5>
                        <div className="row g-2 mt-3">
                            {[['Inserted', results?.inserted, 'success'], ['Updated', results?.updated, 'info'], ['Skipped', results?.skipped, 'secondary']].map(([l, v, c]) => (
                                <div key={l} className="col-4">
                                    <div className={`p-2 rounded bg-${c} bg-opacity-10 text-${c} fw-bold fs-5`}>{v ?? 0}</div>
                                    <small>{l}</small>
                                </div>
                            ))}
                        </div>
                        {results?.warnings?.length > 0 && (
                            <div className="alert alert-warning text-start small mt-3 py-2">
                                {results.warnings.slice(0, 5).map((w, i) => <div key={i}>⚠ {w.row}: {w.note}</div>)}
                            </div>
                        )}
                        <button className="btn btn-primary mt-3" onClick={onDone}>Back to Institute Master</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4">
            <div className="d-flex align-items-center gap-2 mb-4">
                <button className="btn btn-sm btn-outline-secondary" onClick={onDone}>← Back</button>
                <div>
                    <h4 className="fw-bold mb-0">Import Institutes</h4>
                    <small className="text-muted">Upload Excel file with institute data</small>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-light fw-semibold">Select Excel File</div>
                <div className="card-body">
                    <input type="file" accept=".xlsx,.xls" className="form-control mb-2"
                        onChange={e => { setFile(e.target.files[0]); setPhase('upload'); setPreview(null); }} />
                    {file && <div className="text-muted small">Selected: {file.name}</div>}
                </div>
            </div>

            {phase === 'mapping' && detectedInfo && (
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-warning fw-semibold">Column Mapping Required</div>
                    <div className="card-body">
                        <div className="alert alert-info small py-2 mb-3">
                            Map your Excel columns to database fields. Required: Institute Name, Type, Code.
                        </div>
                        <div className="table-responsive">
                            <table className="table table-sm">
                                <thead><tr><th>Excel Column</th><th>→</th><th>Database Field</th></tr></thead>
                                <tbody>
                                    {detectedInfo.excel_headers.map(h => (
                                        <tr key={h.col}>
                                            <td className="small fw-semibold">{h.raw}</td>
                                            <td>→</td>
                                            <td>
                                                <select className="form-select form-select-sm"
                                                    value={columnMap[h.key] || ''}
                                                    onChange={e => setColumnMap(m => ({ ...m, [h.key]: e.target.value }))}>
                                                    {DB_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {phase !== 'preview' && (
                <button className="btn btn-primary mb-4" onClick={handleUpload} disabled={!file || loading}>
                    {loading ? 'Processing...' : (phase === 'mapping' ? 'Apply Mapping & Preview' : 'Preview Import')}
                </button>
            )}

            {phase === 'preview' && preview && (
                <>
                    <div className="alert alert-info small py-2 mb-3">
                        <strong>Preview:</strong> {preview.new?.length || 0} new &nbsp;|&nbsp;
                        {preview.modified?.length || 0} modified &nbsp;|&nbsp;
                        {preview.duplicate?.length || 0} duplicates
                    </div>

                    {preview.new?.length > 0 && (
                        <div className="card border-0 shadow-sm mb-3">
                            <div className="card-header bg-success text-white fw-semibold">New Records ({preview.new.length})</div>
                            <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                    <thead className="table-light"><tr><th>#</th><th>Code</th><th>Name</th><th>Type</th><th>District</th></tr></thead>
                                    <tbody>
                                        {preview.new.slice(0, 50).map((r, i) => (
                                            <tr key={i}>
                                                <td className="small text-muted">{r.row_number}</td>
                                                <td className="small">{r.institute_code}</td>
                                                <td className="small">{r.institute_name}</td>
                                                <td className="small">{r.institute_type}</td>
                                                <td className="small">{r.district}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {preview.modified?.length > 0 && (
                        <div className="card border-0 shadow-sm mb-3">
                            <div className="card-header bg-warning fw-semibold">Modified Records ({preview.modified.length})</div>
                            <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                    <thead className="table-light"><tr><th>Code</th><th>Name</th><th>Changes</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {preview.modified.map(r => (
                                            <tr key={r.row_number}>
                                                <td className="small">{r.institute_code}</td>
                                                <td className="small">{r.institute_name}</td>
                                                <td className="small">{r.changes?.map(c => c.field).join(', ')}</td>
                                                <td>
                                                    <select className="form-select form-select-sm"
                                                        value={modifiedActions[r.row_number] || 'skip'}
                                                        onChange={e => setModifiedActions(a => ({ ...a, [r.row_number]: e.target.value }))}>
                                                        <option value="skip">Skip</option>
                                                        <option value="update">Update</option>
                                                        <option value="ignore">Ignore</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {preview.duplicate?.length > 0 && (
                        <div className="card border-0 shadow-sm mb-3">
                            <div className="card-header bg-secondary text-white fw-semibold">Duplicates / No Changes ({preview.duplicate.length})</div>
                            <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                    <thead className="table-light"><tr><th>Code</th><th>Name</th><th>Reason</th></tr></thead>
                                    <tbody>
                                        {preview.duplicate.slice(0, 20).map((r, i) => (
                                            <tr key={i}>
                                                <td className="small">{r.institute_code}</td>
                                                <td className="small">{r.institute_name}</td>
                                                <td className="small text-muted">{r.duplicate_reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="d-flex gap-2 mt-3">
                        <button className="btn btn-outline-secondary" onClick={() => { setPhase('upload'); setPreview(null); }}>← Re-upload</button>
                        <button className="btn btn-success" onClick={handleConfirm}
                            disabled={loading || (!preview.new?.length && !preview.modified?.length)}>
                            {loading ? 'Importing...' : `Confirm Import (${preview.new?.length || 0} new)`}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
