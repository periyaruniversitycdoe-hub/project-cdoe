import { useState, useEffect, useCallback } from 'react';
import DynamicDropdown from '@admin/components/DynamicDropdown';
import FileUploadField from '@admin/components/FileUploadField';

const API = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;

function getToken() { return localStorage.getItem('adminToken') || ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

const STATUS_BADGE = { Approved: 'success', Rejected: 'danger', Pending: 'warning', Active: 'success', Inactive: 'secondary' };

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CentreManagement() {
    const [view, setView] = useState('list');
    const [editId, setEditId] = useState(null);

    if (view === 'form') return <CentreForm id={editId} onDone={() => { setView('list'); setEditId(null); }} />;
    return <CentreList onAdd={() => { setEditId(null); setView('form'); }} onEdit={id => { setEditId(id); setView('form'); }} />;
}

// ─── List View ────────────────────────────────────────────────────────────────
function CentreList({ onAdd, onEdit }) {
    const [data, setData] = useState({ rows: [], total: 0 });
    const [filters, setFilters] = useState({ status: '', search: '', page: 1, limit: 20 });
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const q = new URLSearchParams({ ...filters }).toString();
            const res = await fetch(`${API}/centres?${q}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [filters]);

    useEffect(() => { load(); }, [load]);

    async function updateStatus(id, status, reason = '') {
        const payload = { status };
        if (reason) payload.rejection_reason = reason;

        await fetch(`${API}/centres/${id}/status`, {
            method: 'PATCH',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        load();
    }

    function handleReject(id) {
        const reason = window.prompt('Enter rejection reason:');
        if (reason === null) return;
        updateStatus(id, 'Rejected', reason);
    }

    async function deleteRow(id, name) {
        if (!window.confirm(`Delete research centre "${name}"? This cannot be undone.`)) return;
        await fetch(`${API}/centres/${id}`, { method: 'DELETE', headers: authHeaders() });
        load();
    }

    const totalPages = Math.ceil(data.total / filters.limit);

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className="mb-0 fw-bold">Research Centre Management</h4>
                    <small className="text-muted">PhD Research Centres & Affiliated Institutes</small>
                </div>
                <button className="btn btn-primary" onClick={onAdd}>+ Register Centre</button>
            </div>

            {/* Filters */}
            <div className="card mb-3 border-0 shadow-sm">
                <div className="card-body py-3">
                    <div className="row g-2">
                        <div className="col-md-6">
                            <input className="form-control" placeholder="Search by name, ref no, email..."
                                value={filters.search}
                                onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))} />
                        </div>
                        <div className="col-md-3">
                            <select className="form-select" value={filters.status}
                                onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}>
                                <option value="">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select className="form-select" value={filters.limit}
                                onChange={e => setFilters(f => ({ ...f, limit: parseInt(e.target.value), page: 1 }))}>
                                <option value={10}>10 / page</option>
                                <option value={20}>20 / page</option>
                                <option value={50}>50 / page</option>
                            </select>
                        </div>
                        <div className="col-md-1">
                            <button className="btn btn-outline-secondary w-100" onClick={load}>Refresh</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading centres...</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>#</th>
                                        <th>Centre Name</th>
                                        <th>Ref No</th>
                                        <th>Type</th>
                                        <th>Category</th>
                                        <th>District</th>
                                        <th>Email</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.rows.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center py-4 text-muted">No research centres found</td></tr>
                                    ) : data.rows.map((c, i) => (
                                        <tr key={c.id}>
                                            <td className="text-muted small">{(filters.page - 1) * filters.limit + i + 1}</td>
                                            <td>
                                                <div className="fw-semibold">{c.name}</div>
                                                {c.abbreviation && <div className="text-muted" style={{ fontSize: 11 }}>{c.abbreviation}</div>}
                                            </td>
                                            <td className="small text-muted">{c.centre_ref_no || '—'}</td>
                                            <td className="small">{c.centre_type_name || '—'}</td>
                                            <td className="small">{c.category_name || '—'}</td>
                                            <td className="small">{c.district_name || '—'}</td>
                                            <td className="small">{c.email || '—'}</td>
                                            <td>
                                                <span className={`badge bg-${STATUS_BADGE[c.status] || 'secondary'}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex gap-1 flex-wrap">
                                                    <button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(c.id)}>Edit</button>
                                                    
                                                    {/* Document Quick View */}
                                                    <div className="dropdown d-inline-block">
                                                        <button className="btn btn-sm btn-outline-info dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                                            Docs
                                                        </button>
                                                        <ul className="dropdown-menu shadow">
                                                            {c.recognition_certificate && (
                                                                <li><a className="dropdown-item" href={`(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + ''${c.recognition_certificate}`} target="_blank" rel="noreferrer">Recognition Cert</a></li>
                                                            )}
                                                            {c.logo && (
                                                                <li><a className="dropdown-item" href={`(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + ''${c.logo}`} target="_blank" rel="noreferrer">Logo</a></li>
                                                            )}
                                                            {!c.recognition_certificate && !c.logo && (
                                                                <li><span className="dropdown-item disabled">No docs uploaded</span></li>
                                                            )}
                                                        </ul>
                                                    </div>

                                                    {c.status === 'Pending' && (
                                                        <>
                                                            <button className="btn btn-sm btn-success" onClick={() => updateStatus(c.id, 'Approved')}>Approve</button>
                                                            <button className="btn btn-sm btn-danger" onClick={() => handleReject(c.id)}>Reject</button>
                                                        </>
                                                    )}
                                                    {c.status === 'Rejected' && (
                                                        <button className="btn btn-sm btn-outline-success" onClick={() => updateStatus(c.id, 'Approved')}>Re-Approve</button>
                                                    )}
                                                    {c.status === 'Approved' && (
                                                        <button className="btn btn-sm btn-outline-warning" onClick={() => updateStatus(c.id, 'Pending')}>Set to Pending</button>
                                                    )}
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteRow(c.id, c.name)}>Delete</button>
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
                        <span className="text-muted small">Total: {data.total} centres</span>
                        <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-outline-secondary" disabled={filters.page === 1}
                                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>Previous</button>
                            <span className="btn btn-sm btn-light disabled">Page {filters.page} / {totalPages}</span>
                            <button className="btn btn-sm btn-outline-secondary" disabled={filters.page === totalPages}
                                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Centre Form ──────────────────────────────────────────────────────────────
const INIT = {
    centre_ref_no: '', centre_type_id: '', subject_id: '', name: '', abbreviation: '', category_id: '',
    institute_id: '', institute_name_override: '', institute_abbreviation: '',
    address_1: '', address_2: '', address_3: '', district_id: '', pincode: '',
    contact_number: '', email: '', recognition_date: '', hod_email: '',
    remark: '', is_active: true,
};

function CentreForm({ id, onDone }) {
    const isEdit = !!id;
    const [form, setForm] = useState(INIT);
    const [existing, setExisting] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (!isEdit) return;
        fetch(`${API}/centres/${id}`, { headers: authHeaders() })
            .then(r => r.json())
            .then(j => {
                if (j.success && j.data) {
                    const d = j.data;
                    setExisting(d);
                    setForm({
                        centre_ref_no: d.centre_ref_no || '',
                        centre_type_id: d.centre_type_id || '',
                        subject_id: d.subject_id || '',
                        name: d.name || '',
                        abbreviation: d.abbreviation || '',
                        category_id: d.category_id || '',
                        institute_id: d.institute_id || '',
                        institute_name_override: d.institute_name_override || '',
                        institute_abbreviation: d.institute_abbreviation || '',
                        address_1: d.address_1 || '',
                        address_2: d.address_2 || '',
                        address_3: d.address_3 || '',
                        district_id: d.district_id || '',
                        pincode: d.pincode || '',
                        contact_number: d.contact_number || '',
                        email: d.email || '',
                        recognition_date: d.recognition_date ? d.recognition_date.substring(0, 10) : '',
                        hod_email: d.hod_email || '',
                        remark: d.remark || '',
                        is_active: d.is_active !== undefined ? Boolean(d.is_active) : true,
                    });
                }
            })
            .catch(() => {});
    }, [id, isEdit]);

    function handleChange(e) {
        const { name, value, type, checked } = e.target;
        setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        const fd = new FormData(e.target);
        fd.set('is_active', form.is_active ? 'true' : 'false');

        try {
            const url = isEdit ? `${API}/centres/${id}` : `${API}/centres`;
            const method = isEdit ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: authHeaders(), body: fd });
            const json = await res.json();
            if (json.success) {
                setSuccess(isEdit ? 'Centre updated successfully!' : 'Centre registered successfully!');
                setTimeout(onDone, 1200);
            } else {
                setError(json.message || 'Save failed');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="container-fluid py-4" style={{ maxWidth: 900 }}>
            <div className="d-flex align-items-center gap-3 mb-4">
                <button className="btn btn-outline-secondary btn-sm" onClick={onDone}>&larr; Back</button>
                <div>
                    <h4 className="mb-0 fw-bold">{isEdit ? 'Edit Research Centre' : 'Register Research Centre'}</h4>
                    <small className="text-muted">PhD Research Centre Registration</small>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form onSubmit={handleSubmit} encType="multipart/form-data">

                {/* ── Section 1: Centre Classification ── */}
                <FormSection title="Centre Classification">
                    <div className="row g-3">
                        <div className="col-md-4">
                            <DynamicDropdown type="centre_types" name="centre_type_id" label="Centre Type"
                                value={form.centre_type_id} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <DynamicDropdown type="research_subjects" name="subject_id" label="Subject"
                                value={form.subject_id} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Centre Reference Number</label>
                            <input name="centre_ref_no" className="form-control" value={form.centre_ref_no} onChange={handleChange} />
                        </div>
                        <div className="col-md-5">
                            <label className="form-label fw-semibold">Centre Name <span className="text-danger">*</span></label>
                            <input name="name" className="form-control" value={form.name} onChange={handleChange} required />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Centre Abbreviation</label>
                            <input name="abbreviation" className="form-control" value={form.abbreviation} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <DynamicDropdown type="research_categories" name="category_id" label="Category"
                                value={form.category_id} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <div className="form-check form-switch mt-4">
                                <input type="checkbox" name="is_active" className="form-check-input" id="is_active"
                                    checked={form.is_active} onChange={handleChange} />
                                <label className="form-check-label fw-semibold" htmlFor="is_active">Active Status</label>
                            </div>
                        </div>
                    </div>
                </FormSection>

                {/* ── Section 2: Institute Info ── */}
                <FormSection title="Institute Information">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <DynamicDropdown type="institutes" name="institute_id" label="Institute"
                                value={form.institute_id} onChange={handleChange} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">Institute Name (if not listed)</label>
                            <input name="institute_name_override" className="form-control" value={form.institute_name_override} onChange={handleChange} />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Institute Abbreviation</label>
                            <input name="institute_abbreviation" className="form-control" value={form.institute_abbreviation} onChange={handleChange} />
                        </div>
                    </div>
                </FormSection>

                {/* ── Section 3: Address & Contact ── */}
                <FormSection title="Address & Contact">
                    <div className="row g-3">
                        <div className="col-md-12">
                            <label className="form-label fw-semibold">Address Line 1</label>
                            <input name="address_1" className="form-control" value={form.address_1} onChange={handleChange} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">Address Line 2</label>
                            <input name="address_2" className="form-control" value={form.address_2} onChange={handleChange} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">Address Line 3</label>
                            <input name="address_3" className="form-control" value={form.address_3} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <DynamicDropdown type="districts" name="district_id" label="District"
                                value={form.district_id} onChange={handleChange} />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label fw-semibold">Pincode</label>
                            <input name="pincode" className="form-control" maxLength={6} value={form.pincode} onChange={handleChange} />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Contact Number</label>
                            <input name="contact_number" className="form-control" value={form.contact_number} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Email ID</label>
                            <input type="email" name="email" className="form-control" value={form.email} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">HOD Email ID</label>
                            <input type="email" name="hod_email" className="form-control" value={form.hod_email} onChange={handleChange} />
                        </div>
                    </div>
                </FormSection>

                {/* ── Section 4: Recognition & Documents ── */}
                <FormSection title="Recognition & Documents">
                    <div className="row g-3">
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Recognition Date</label>
                            <input type="date" name="recognition_date" className="form-control" value={form.recognition_date} onChange={handleChange} />
                        </div>
                        <div className="col-md-5">
                            <FileUploadField name="recognition_certificate" label="Recognition Certificate"
                                accept="image/*,application/pdf" currentUrl={existing.recognition_certificate}
                                hint="Image or PDF, max 5 MB" />
                        </div>
                        <div className="col-md-4">
                            <FileUploadField name="logo" label="Centre / Institute Logo"
                                accept="image/jpeg,image/png,image/jpg" currentUrl={existing.logo}
                                hint="JPG/PNG, max 5 MB" />
                        </div>
                        <div className="col-md-12">
                            <label className="form-label fw-semibold">Remark</label>
                            <textarea name="remark" className="form-control" rows={3} value={form.remark} onChange={handleChange} />
                        </div>
                    </div>
                </FormSection>

                <div className="d-flex gap-2 mt-3">
                    <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                        {saving ? 'Saving...' : isEdit ? 'Update Centre' : 'Register Centre'}
                    </button>
                    <button type="button" className="btn btn-outline-secondary" onClick={onDone}>Cancel</button>
                </div>
            </form>
        </div>
    );
}

function FormSection({ title, children }) {
    return (
        <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-bottom">
                <h6 className="mb-0 fw-bold text-primary">{title}</h6>
            </div>
            <div className="card-body">{children}</div>
        </div>
    );
}
