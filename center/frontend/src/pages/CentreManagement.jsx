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

    if (view === 'form') {
        return (
            <ApplicationForm 
                isAdminMode={true} 
                centerId={editId} 
                onDone={() => { setView('list'); setEditId(null); }} 
            />
        );
    }
    return <CentreList onAdd={() => { setEditId(null); setView('form'); }} onEdit={id => { setEditId(id); setView('form'); }} />;
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
