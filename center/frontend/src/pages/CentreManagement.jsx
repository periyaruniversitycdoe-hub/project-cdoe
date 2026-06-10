import { useState, useEffect, useCallback } from 'react';
import ApplicationForm from './ApplicationForm';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

function getToken() { return localStorage.getItem('adminToken') || ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

const STATUS_BADGE = { Approved: 'success', Rejected: 'danger', Pending: 'warning', Active: 'success', Inactive: 'secondary', Suspended: 'dark' };

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CentreManagement() {
    const [view, setView] = useState('list');
    const [editId, setEditId] = useState(null);

    const handleAdd = async () => {
        try {
            const res = await fetch(`${API}/settings`, { headers: authHeaders() });
            const json = await res.json();
            const configUrl = json.data?.research_centre_registration_url;
            if (configUrl && configUrl.trim()) {
                window.location.href = configUrl;
            } else {
                alert('Registration link has not been configured by Administrator.');
            }
        } catch (err) {
            alert('Failed to retrieve registration settings.');
        }
    };

    if (view === 'form' && editId !== null) {
        // Edit existing centre — keep using the full ApplicationForm
        return (
            <ApplicationForm
                isAdminMode={true}
                centerId={editId}
                onDone={() => { setView('list'); setEditId(null); }}
            />
        );
    }
    if (view === 'register') {
        // Register new centre — same form and service as Centre Portal Signup.jsx
        return (
            <CentreRegisterForm onDone={() => setView('list')} />
        );
    }
    return (
        <CentreList
            onAdd={handleAdd}
            onEdit={id => { setEditId(id); setView('form'); }}
        />
    );
}

// ─── Register Centre Form ──────────────────────────────────────────────────────
// Phase 1: Account creation (same as Centre Portal Signup.jsx)
// Phase 2: Full centre profile form — exact same ApplicationForm used by portal (SSoT)
function CentreRegisterForm({ onDone }) {
    const [form, setForm]     = useState({ name: '', email: '', mobile: '', password: '', confirm: '' });
    const [error, setError]   = useState('');
    const [phase, setPhase]   = useState('account'); // 'account' | 'profile'
    const [registered, setRegistered] = useState(null);
    const [loading, setLoading] = useState(false);

    const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (form.password !== form.confirm) return setError('Passwords do not match');
        if (form.password.length < 8)        return setError('Password must be at least 8 characters');
        if (!/[A-Z]/.test(form.password))    return setError('Password must contain at least one uppercase letter');
        if (!/[0-9]/.test(form.password))    return setError('Password must contain at least one number');
        if (!/[^A-Za-z0-9]/.test(form.password)) return setError('Password must contain at least one special character');
        setLoading(true);
        try {
            const res = await fetch(`${API}/admin/register-centre`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ name: form.name, email: form.email, password: form.password, mobile: form.mobile }),
            });
            const data = await res.json();
            if (!res.ok) return setError(data.message || 'Registration failed');
            setRegistered(data);
            setPhase('profile');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    // ── Phase 2: Full centre profile form — exact same ApplicationForm as Centre Portal (SSoT) ──
    if (phase === 'profile' && registered) {
        return (
            <div>
                <div className="alert alert-success d-flex align-items-center gap-2 m-4 mb-0 py-2">
                    <span style={{ fontSize: 20 }}>✓</span>
                    <span>
                        <strong>Account created.</strong> {registered.message}
                        {registered.autoLinked && <span className="ms-2 badge bg-success">Auto-linked to centre #{registered.centerId}</span>}
                        <span className="ms-2 text-muted small">Now fill the full centre profile below.</span>
                    </span>
                </div>
                <ApplicationForm
                    isAdminMode={true}
                    centerId={registered.centerId || null}
                    onDone={onDone}
                />
            </div>
        );
    }

    return (
        <div className="container-fluid px-4 py-4">
            <div className="row justify-content-center">
                <div className="col-md-6">
                    <div className="d-flex align-items-center gap-2 mb-4">
                        <button className="btn btn-sm btn-outline-secondary" onClick={onDone}>←</button>
                        <div>
                            <h4 className="fw-bold mb-0">Register Research Centre Account</h4>
                            <small className="text-muted">Same form and service as Centre Portal self-registration</small>
                        </div>
                    </div>

                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-white fw-semibold">Research Centre Registration Form</div>
                        <div className="card-body">
                            <div className="alert alert-info py-2 small mb-3">
                                This form is identical to the Research Centre Portal registration form.
                                If the email matches an existing approved centre record (centre email or HOD email), the account will be auto-linked.
                            </div>
                            {error && <div className="alert alert-danger py-2 small">{error}</div>}
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Full Name / Centre Director Name</label>
                                    <input className="form-control" placeholder="Dr. Jane Smith" value={form.name} onChange={set('name')} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Email Address</label>
                                    <input className="form-control" type="email" placeholder="centre@university.edu" value={form.email} onChange={set('email')} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Mobile Number</label>
                                    <input className="form-control" placeholder="9XXXXXXXXX" value={form.mobile} onChange={set('mobile')} />
                                </div>
                                <div className="row g-2 mb-4">
                                    <div className="col-6">
                                        <label className="form-label fw-semibold">Password</label>
                                        <input className="form-control" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label fw-semibold">Confirm Password</label>
                                        <input className="form-control" type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} required />
                                    </div>
                                    <div className="col-12">
                                        <small className="text-muted">Min 8 chars · 1 uppercase · 1 number · 1 special character</small>
                                    </div>
                                </div>
                                <div className="d-flex gap-2">
                                    <button type="button" className="btn btn-outline-secondary" onClick={onDone}>Cancel</button>
                                    <button type="submit" className="btn btn-primary flex-grow-1" disabled={loading}>
                                        {loading ? 'Creating Account...' : 'Create Centre Account'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── List View ────────────────────────────────────────────────────────────────
function CentreList({ onAdd, onEdit }) {
    const [data, setData] = useState({ rows: [], total: 0 });
    const [page, setPage] = useState(1);
    const limit = 20;
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const q = new URLSearchParams({ page, limit }).toString();
            const res = await fetch(`${API}/centres?${q}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [page]);

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

    async function toggleInstituteActive(id, currentActive) {
        const action = currentActive ? 'Deactivate' : 'Activate';
        if (!window.confirm(`${action} the institute linked to this research centre?`)) return;
        await fetch(`${API}/centres/${id}/toggle-institute`, {
            method: 'PATCH',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
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

    const totalPages = Math.ceil(data.total / limit);

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className="mb-0 fw-bold text-primary">Research Centre Management</h4>
                    <small className="text-muted">PhD Research Centres</small>
                </div>
                <button className="btn btn-primary" onClick={onAdd}>+ Register Centre</button>
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
                                        <th>Institute Details</th>
                                        <th>Principal Info</th>
                                        <th>College Contact</th>
                                        <th>Institute Status</th>
                                        <th>Centre Details</th>
                                        <th>Recognition Details</th>
                                        <th>Centre Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.rows.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center py-4 text-muted">No research centres found</td></tr>
                                    ) : data.rows.map((c, i) => (
                                        <tr key={c.id}>
                                            <td className="text-muted small">{(page - 1) * limit + i + 1}</td>
                                            
                                            {/* Institute Details */}
                                            <td>
                                                <div className="fw-semibold text-primary">{c.institute_code || '—'}</div>
                                                <div className="small text-muted">{c.institute_name || '—'}</div>
                                            </td>

                                            {/* Principal Info */}
                                            <td>
                                                <div className="fw-semibold text-dark">{c.institute_principal || '—'}</div>
                                                <div className="small text-muted">{c.institute_principal_mobile || '—'}</div>
                                            </td>

                                            {/* College Contact */}
                                            <td>
                                                <div className="small fw-semibold">{c.institute_email || '—'}</div>
                                                <div className="small text-muted">{c.institute_phone || '—'}</div>
                                            </td>

                                            {/* Institute Status */}
                                            <td>
                                                <span className={`badge bg-${c.institute_active ? 'success' : 'danger'}`}>
                                                    {c.institute_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>

                                            {/* Centre Details */}
                                            <td>
                                                <div className="fw-semibold">{c.name}</div>
                                                <div className="small text-muted">{c.centre_type_name || '—'}</div>
                                            </td>

                                            {/* Recognition Details */}
                                            <td>
                                                <div className="small fw-semibold">{c.centre_ref_no || '—'}</div>
                                                <div className="small text-muted">{c.recognition_date ? c.recognition_date.substring(0, 10) : '—'}</div>
                                            </td>

                                            {/* Centre Status */}
                                            <td>
                                                <span className={`badge bg-${STATUS_BADGE[c.status] || 'secondary'}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex gap-1 flex-wrap">
                                                    <button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(c.id)}>Edit</button>
                                                    <button
                                                        className={`btn btn-sm ${c.institute_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                                        onClick={() => toggleInstituteActive(c.id, c.institute_active)}
                                                        title={c.institute_active ? 'Deactivate Institute' : 'Activate Institute'}
                                                    >
                                                        {c.institute_active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                    
                                                    {/* Document Quick View */}
                                                    <div className="dropdown d-inline-block">
                                                        <button className="btn btn-sm btn-outline-info dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                                            Docs
                                                        </button>
                                                        <ul className="dropdown-menu shadow">
                                                            {c.recognition_certificate && (
                                                                <li><a className="dropdown-item" href={`${import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001'}${c.recognition_certificate}`} target="_blank" rel="noreferrer">Recognition Cert</a></li>
                                                            )}
                                                            {c.logo && (
                                                                <li><a className="dropdown-item" href={`${import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001'}${c.logo}`} target="_blank" rel="noreferrer">Logo</a></li>
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
                                                            <button className="btn btn-sm btn-warning text-white" onClick={() => updateStatus(c.id, 'Suspended')}>Suspend</button>
                                                        </>
                                                    )}
                                                    {c.status === 'Rejected' && (
                                                        <button className="btn btn-sm btn-outline-success" onClick={() => updateStatus(c.id, 'Approved')}>Re-Approve</button>
                                                    )}
                                                    {c.status === 'Approved' && (
                                                        <>
                                                            <button className="btn btn-sm btn-outline-warning" onClick={() => updateStatus(c.id, 'Pending')}>Set to Pending</button>
                                                            <button className="btn btn-sm btn-outline-danger" onClick={() => updateStatus(c.id, 'Suspended')}>Suspend</button>
                                                        </>
                                                    )}
                                                    {c.status === 'Suspended' && (
                                                        <button className="btn btn-sm btn-success" onClick={() => updateStatus(c.id, 'Approved')}>Activate</button>
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
                            <button className="btn btn-sm btn-outline-secondary" disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}>Previous</button>
                            <span className="btn btn-sm btn-light disabled">Page {page} / {totalPages}</span>
                            <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}>Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
