import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DynamicDropdown from '@admin/components/DynamicDropdown';
import FileUploadField from '@admin/components/FileUploadField';
import DisciplineRepeater from '../components/DisciplineRepeater';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

function getToken() { return localStorage.getItem('adminToken') || ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

const STATUS_BADGE = {
    Approved: 'success', Rejected: 'danger', Pending: 'warning',
    Active: 'success', Inactive: 'secondary', Draft: 'light'
};

// ─── Main Page (list) ─────────────────────────────────────────────────────────
export default function SupervisorManagement() {
    const navigate = useNavigate();
    return (
        <SupervisorList
            onAdd={()         => navigate('/supervisors/new')}
            onEdit={id        => navigate(`/supervisors/edit/${id}`)}
        />
    );
}

// ─── Add Page (no id) ─────────────────────────────────────────────────────────
export function SupervisorAddPage() {
    const navigate = useNavigate();
    return <SupervisorForm id={null} onDone={() => navigate('/supervisors')} />;
}

// ─── Edit Page (with id) ──────────────────────────────────────────────────────
export function SupervisorEditPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    return <SupervisorForm id={parseInt(id)} onDone={() => navigate('/supervisors')} />;
}

// ─── List View ────────────────────────────────────────────────────────────────
function SupervisorList({ onAdd, onEdit }) {
    const [data, setData] = useState({ rows: [], total: 0 });
    const [filters, setFilters] = useState({ status: '', search: '', page: 1, limit: 20 });
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const q = new URLSearchParams({ ...filters }).toString();
            const res = await fetch(`${API}/supervisors?${q}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [filters]);

    useEffect(() => { load(); }, [load]);

    async function deleteRow(id, name) {
        if (!window.confirm(`Delete supervisor "${name}"? This cannot be undone.`)) return;
        await fetch(`${API}/supervisors/${id}`, { method: 'DELETE', headers: authHeaders() });
        load();
    }

    async function updateStatus(id, status, reason = '') {
        const payload = { status };
        if (reason) payload.rejection_reason = reason;

        await fetch(`${API}/supervisors/${id}/status`, {
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

    const totalPages = Math.ceil(data.total / filters.limit);

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className="mb-0 fw-bold">Supervisor Management</h4>
                    <small className="text-muted">PhD Research Supervisors / Guides</small>
                </div>
                <button className="btn btn-primary" onClick={onAdd}>+ Register Supervisor</button>
            </div>

            {/* Filters */}
            <div className="card mb-3 border-0 shadow-sm">
                <div className="card-body py-3">
                    <div className="row g-2">
                        <div className="col-md-6">
                            <input
                                className="form-control"
                                placeholder="Search by name, email, mobile, ID..."
                                value={filters.search}
                                onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                            />
                        </div>
                        <div className="col-md-3">
                            <select
                                className="form-select"
                                value={filters.status}
                                onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
                            >
                                <option value="">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select
                                className="form-select"
                                value={filters.limit}
                                onChange={e => setFilters(f => ({ ...f, limit: parseInt(e.target.value), page: 1 }))}
                            >
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
                        <div className="text-center py-5 text-muted">Loading supervisors...</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>#</th>
                                        <th>Name</th>
                                        <th>Designation</th>
                                        <th>Department</th>
                                        <th>Institute</th>
                                        <th>Mobile</th>
                                        <th>Vacancy</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.rows.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center py-4 text-muted">No supervisors found</td></tr>
                                    ) : data.rows.map((s, i) => (
                                        <tr key={s.id}>
                                            <td className="text-muted small">{(filters.page - 1) * filters.limit + i + 1}</td>
                                            <td>
                                                <div className="fw-semibold">{s.name}</div>
                                                {s.supervisor_no && <div className="text-muted" style={{ fontSize: 11 }}>{s.supervisor_no}</div>}
                                            </td>
                                            <td className="small">{s.designation_name || '—'}</td>
                                            <td className="small">{s.department_name || '—'}</td>
                                            <td className="small">{s.serving_institute_name || '—'}</td>
                                            <td className="small">{s.mobile || '—'}</td>
                                            <td className="text-center">
                                                <span className="badge bg-info text-dark">{s.current_vacancy ?? 0}/{s.max_candidates ?? 0}</span>
                                            </td>
                                            <td>
                                                <span className={`badge bg-${STATUS_BADGE[s.status] || 'secondary'}`}>{s.status}</span>
                                            </td>
                                            <td>
                                                <div className="d-flex gap-1 flex-wrap">
                                                    <button className="btn btn-xs btn-outline-primary btn-sm" onClick={() => onEdit(s.id)}>Edit</button>
                                                    
                                                    {/* Document Quick View */}
                                                    <div className="dropdown d-inline-block">
                                                        <button className="btn btn-xs btn-outline-info btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                                            Docs
                                                        </button>
                                                        <ul className="dropdown-menu shadow">
                                                            {s.profile_image && (
                                                                <li><a className="dropdown-item" href={`(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001')${s.profile_image}`} target="_blank" rel="noreferrer">Photo</a></li>
                                                            )}
                                                            {s.dob_evidence && (
                                                                <li><a className="dropdown-item" href={`(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001')${s.dob_evidence}`} target="_blank" rel="noreferrer">DOB Evidence</a></li>
                                                            )}
                                                            {s.recognition_certificate && (
                                                                <li><a className="dropdown-item" href={`(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001')${s.recognition_certificate}`} target="_blank" rel="noreferrer">Recognition Cert</a></li>
                                                            )}
                                                            {!s.profile_image && !s.dob_evidence && !s.recognition_certificate && (
                                                                <li><span className="dropdown-item disabled">No docs uploaded</span></li>
                                                            )}
                                                        </ul>
                                                    </div>

                                                    {s.status === 'Pending' && (
                                                        <>
                                                            <button className="btn btn-xs btn-success btn-sm" onClick={() => updateStatus(s.id, 'Approved')}>Approve</button>
                                                            <button className="btn btn-xs btn-danger btn-sm" onClick={() => handleReject(s.id)}>Reject</button>
                                                        </>
                                                    )}
                                                    {s.status === 'Rejected' && (
                                                        <button className="btn btn-xs btn-outline-success btn-sm" onClick={() => updateStatus(s.id, 'Approved')}>Re-Approve</button>
                                                    )}
                                                    {s.status === 'Approved' && (
                                                        <button className="btn btn-xs btn-outline-warning btn-sm" onClick={() => updateStatus(s.id, 'Pending')}>Set to Pending</button>
                                                    )}
                                                    <button className="btn btn-xs btn-outline-danger btn-sm" onClick={() => deleteRow(s.id, s.name)}>Delete</button>
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
                        <span className="text-muted small">Total: {data.total} supervisors</span>
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

// ─── Supervisor Form ──────────────────────────────────────────────────────────
const INIT = {
    name: '', designation_id: '', special_designation_id: '', recognition_ref_no: '',
    department_id: '', gender: 'Male', serving_institute_id: '', area_of_specialization: '',
    address_1: '', address_2: '', address_3: '', district_id: '', pincode: '',
    aadhaar_no: '', mobile: '', email: '',
    dob: '', date_of_joining: '', date_of_superannuation: '',
    max_candidates: 0, current_vacancy: 0, max_part_time: 0, max_full_time: 0,
    full_time_available: 0, part_time_available: 0,
    remarks: '', status: 'Pending',
};

function SupervisorForm({ id, onDone }) {
    const isEdit = !!id;
    const [form, setForm] = useState(INIT);
    const [disciplines, setDisciplines] = useState([]);
    const [centres, setCentres] = useState([]);
    const [existing, setExisting] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (!form.designation_id) return;

        // Fetch designation capacity from engine (includes FT/PT breakdown)
        fetch(`${API}/supervisors/capacity/${form.designation_id}`, { headers: authHeaders() })
            .then(r => r.json())
            .then(j => {
                if (j.success && j.data) {
                    const {
                        max_candidates   = 0,
                        current_vacancy  = 0,
                        max_full_time    = 0,
                        max_part_time    = 0,
                        full_time_available = 0,
                        part_time_available = 0,
                    } = j.data;
                    setForm(f => ({
                        ...f,
                        max_candidates,
                        current_vacancy,
                        max_full_time,
                        max_part_time,
                        full_time_available,
                        part_time_available,
                    }));
                }
            })
            .catch(() => {});
    }, [form.designation_id]);

    useEffect(() => {
        fetch(`${API}/supervisors/active-centres`, { headers: authHeaders() })
            .then(r => r.json())
            .then(j => { if (j.success) setCentres(j.data); })
            .catch(() => {});

        if (isEdit) {
            fetch(`${API}/supervisors/${id}`, { headers: authHeaders() })
                .then(r => r.json())
                .then(j => {
                    if (j.success && j.data) {
                        const d = j.data;
                        setExisting(d);
                        setForm({
                            name: d.name || '',
                            designation_id: d.designation_id || '',
                            special_designation_id: d.special_designation_id || '',
                            recognition_ref_no: d.recognition_ref_no || '',
                            department_id: d.department_id || '',
                            gender: d.gender || 'Male',
                            serving_institute_id: d.serving_institute_id || '',
                            area_of_specialization: d.area_of_specialization || '',
                            address_1: d.address_1 || '',
                            address_2: d.address_2 || '',
                            address_3: d.address_3 || '',
                            district_id: d.district_id || '',
                            pincode: d.pincode || '',
                            aadhaar_no: d.aadhaar_no || '',
                            mobile: d.mobile || '',
                            email: d.email || '',
                            dob: d.dob ? d.dob.substring(0, 10) : '',
                            date_of_joining: d.date_of_joining ? d.date_of_joining.substring(0, 10) : '',
                            date_of_superannuation: d.date_of_superannuation ? d.date_of_superannuation.substring(0, 10) : '',
                            max_candidates: d.max_candidates ?? '',
                            current_vacancy: d.current_vacancy ?? '',
                            max_part_time: d.max_part_time ?? '',
                            max_full_time: d.max_full_time ?? '',
                            remarks: d.remarks || '',
                            status: d.status || 'Pending',
                        });
                        if (d.disciplines?.length) setDisciplines(d.disciplines);
                    }
                })
                .catch(() => {});
        }
    }, [id, isEdit]);

    function handleChange(e) {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        const fd = new FormData(e.target);
        fd.set('disciplines', JSON.stringify(disciplines));

        try {
            const url = isEdit ? `${API}/supervisors/${id}` : `${API}/supervisors`;
            const method = isEdit ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: authHeaders(), body: fd });
            const json = await res.json();
            if (json.success) {
                setSuccess(isEdit ? 'Supervisor updated successfully!' : 'Supervisor registered successfully!');
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
                    <h4 className="mb-0 fw-bold">{isEdit ? 'Edit Supervisor' : 'Register New Supervisor'}</h4>
                    <small className="text-muted">PhD Research Guide Registration</small>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form onSubmit={handleSubmit} encType="multipart/form-data">

                {/* ── Section 1: Basic Info ── */}
                <FormSection title="Basic Information">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">Supervisor Name <span className="text-danger">*</span></label>
                            <input name="name" className="form-control" value={form.name} onChange={handleChange} required />
                        </div>
                        <div className="col-md-3">
                            <DynamicDropdown type="designations" name="designation_id" label="Designation"
                                value={form.designation_id} onChange={handleChange} />
                        </div>
                        <div className="col-md-3">
                            <DynamicDropdown type="special_designations" name="special_designation_id" label="Special Designation"
                                value={form.special_designation_id} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Recognition Ref No</label>
                            <input name="recognition_ref_no" className="form-control" value={form.recognition_ref_no} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <DynamicDropdown type="departments" name="department_id" label="Department"
                                value={form.department_id} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Gender <span className="text-danger">*</span></label>
                            <div className="d-flex gap-3 mt-1">
                                {['Male', 'Female', 'Other'].map(g => (
                                    <div key={g} className="form-check">
                                        <input type="radio" name="gender" value={g} id={`gender_${g}`}
                                            className="form-check-input" checked={form.gender === g} onChange={handleChange} />
                                        <label className="form-check-label" htmlFor={`gender_${g}`}>{g}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="col-md-6">
                            <DynamicDropdown type="institutes" name="serving_institute_id" label="Serving Institute"
                                value={form.serving_institute_id} onChange={handleChange} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">Area of Specialization</label>
                            <input name="area_of_specialization" className="form-control" value={form.area_of_specialization} onChange={handleChange} placeholder="e.g. Machine Learning, Power Systems" />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Status</label>
                            <select name="status" className="form-select" value={form.status} onChange={handleChange}>
                                <option value="Pending">Pending</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        <div className="col-md-12">
                            <FileUploadField name="profile_image" label="Profile Image"
                                accept="image/jpeg,image/png,image/jpg"
                                currentUrl={existing.profile_image}
                                hint="JPG/PNG, max 5 MB" />
                        </div>
                    </div>
                </FormSection>

                {/* ── Section 2: Address ── */}
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
                            <label className="form-label fw-semibold">Mobile Number</label>
                            <input name="mobile" className="form-control" value={form.mobile} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Email ID</label>
                            <input type="email" name="email" className="form-control" value={form.email} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Aadhaar Number</label>
                            <input name="aadhaar_no" className="form-control" maxLength={12} value={form.aadhaar_no} onChange={handleChange} />
                        </div>
                    </div>
                </FormSection>

                {/* ── Section 3: Dates & Documents ── */}
                <FormSection title="Dates & Documents">
                    <div className="row g-3">
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Date of Birth</label>
                            <input type="date" name="dob" className="form-control" value={form.dob} onChange={handleChange} />
                        </div>
                        <div className="col-md-4">
                            <FileUploadField name="dob_evidence" label="DOB Evidence"
                                accept="image/*,application/pdf"
                                currentUrl={existing.dob_evidence}
                                hint="Image or PDF, max 5 MB" />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Date of Joining</label>
                            <input type="date" name="date_of_joining" className="form-control" value={form.date_of_joining} onChange={handleChange} />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Date of Superannuation</label>
                            <input type="date" name="date_of_superannuation" className="form-control" value={form.date_of_superannuation} onChange={handleChange} />
                        </div>
                        <div className="col-md-6">
                            <FileUploadField name="recognition_certificate" label="Recognition Certificate"
                                accept="image/*,application/pdf"
                                currentUrl={existing.recognition_certificate}
                                hint="Image or PDF, max 5 MB" />
                        </div>
                    </div>
                </FormSection>

                {/* ── Section 4: Vacancy (System Managed) ── */}
                <FormSection title="Candidate Capacity (System Managed)">
                    <div className="alert alert-info py-2 mb-3" style={{ fontSize: 13 }}>
                        <strong>Note:</strong> Capacity is derived from the Designation config set in Supervisor Masters.
                        Select a designation above to auto-populate these fields.
                    </div>
                    <div className="row g-3">
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Max Allowed (Designation)</label>
                            <input type="number" min={0} name="max_candidates" className="form-control bg-light fw-bold"
                                value={form.max_candidates} readOnly />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Current Vacancy</label>
                            <input type="number" min={0} name="current_vacancy" className="form-control bg-light text-success fw-bold"
                                value={form.current_vacancy} readOnly />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Max Full-Time</label>
                            <input type="number" min={0} name="max_full_time" className="form-control bg-light"
                                value={form.max_full_time} readOnly />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Max Part-Time (½ of Max)</label>
                            <input type="number" min={0} name="max_part_time" className="form-control bg-light"
                                value={form.max_part_time} readOnly />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold text-success">FT Available</label>
                            <input type="number" name="full_time_available" className="form-control bg-light text-success"
                                value={form.full_time_available} readOnly />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-semibold text-primary">PT Available</label>
                            <input type="number" name="part_time_available" className="form-control bg-light text-primary"
                                value={form.part_time_available} readOnly />
                        </div>
                    </div>
                </FormSection>

                {/* ── Section 5: Disciplines ── */}
                <FormSection title="Discipline Registrations">
                    <DisciplineRepeater value={disciplines} onChange={setDisciplines} centres={centres} />
                </FormSection>

                {/* ── Section 6: Remarks ── */}
                <FormSection title="Remarks">
                    <textarea name="remarks" className="form-control" rows={3} value={form.remarks} onChange={handleChange} />
                </FormSection>

                <div className="d-flex gap-2 mt-3">
                    <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                        {saving ? 'Saving...' : isEdit ? 'Update Supervisor' : 'Register Supervisor'}
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
