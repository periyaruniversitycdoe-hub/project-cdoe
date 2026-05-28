import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { invalidateDropdownCache } from '@admin/components/DynamicDropdown';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/masters';

function getToken() { return localStorage.getItem('adminToken') || ''; }
function authHeaders(json = false) {
    const h = { Authorization: `Bearer ${getToken()}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

const MASTER_TYPES = [
    { key: 'designations',         label: 'Designation',           icon: '🎓', hasAbbrev: false },
    { key: 'special_designations', label: 'Special Designation',   icon: '⭐', hasAbbrev: false },
    { key: 'departments',          label: 'Department',            icon: '🏛️', hasAbbrev: false },
    { key: 'institutes',           label: 'Institute',             icon: '🏫', hasAbbrev: true, isEnterprise: true },
    { key: 'districts',            label: 'District',              icon: '📍', hasAbbrev: false },
    { key: 'centre_types',         label: 'Centre Type',           icon: '🏢', hasAbbrev: false },
    { key: 'research_subjects',    label: 'Research Subject',      icon: '📚', hasAbbrev: false },
    { key: 'research_categories',  label: 'Research Category',     icon: '🗂️', hasAbbrev: false },
    { key: 'disciplines',          label: 'Discipline',            icon: '🔬', hasAbbrev: false },
    { key: 'capacity_config',      label: 'Supervisor Capacity',   icon: '📊', isCustom: true },
];

export default function SupervisorMasterManagement() {
    const [activeType, setActiveType] = useState(MASTER_TYPES[0].key);
    const navigate = useNavigate();
    const current = MASTER_TYPES.find(t => t.key === activeType);

    return (
        <div className="container-fluid py-4">
            <div className="mb-4">
                <h4 className="fw-bold mb-0">Master Management</h4>
                <small className="text-muted">Admin-controlled dropdown values for Supervisor & Centre modules</small>
            </div>

            <div className="row g-3">
                {/* Left nav */}
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-primary text-white fw-semibold">
                            Master Types
                        </div>
                        <div className="list-group list-group-flush">
                            {MASTER_TYPES.map(t => (
                                <button
                                    key={t.key}
                                    className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${activeType === t.key ? 'active' : ''}`}
                                    onClick={() => setActiveType(t.key)}
                                >
                                    <span>{t.icon}</span>
                                    <span className="small fw-semibold">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right panel */}
                <div className="col-md-9">
                    {current && current.isCustom ? (
                        <CapacityMasterPanel key={activeType} />
                    ) : current && current.isEnterprise ? (
                        <InstituteLaunchPanel onOpen={() => navigate('/institute-master')} />
                    ) : (
                        current && <MasterPanel key={activeType} type={activeType} meta={current} />
                    )}
                </div>
            </div>
        </div>
    );
}

function MasterPanel({ type, meta }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editAbbrev, setEditAbbrev] = useState('');
    const [newName, setNewName] = useState('');
    const [newAbbrev, setNewAbbrev] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/${type}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setItems(json.data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [type]);

    useEffect(() => { load(); setEditingId(null); setNewName(''); setNewAbbrev(''); setError(''); }, [load]);

    async function add() {
        if (!newName.trim()) { setError('Name is required'); return; }
        setAdding(true); setError('');
        try {
            const res = await fetch(`${API}/${type}`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ name: newName.trim(), abbreviation: newAbbrev.trim() || undefined }),
            });
            const json = await res.json();
            if (json.success) { setNewName(''); setNewAbbrev(''); invalidateDropdownCache(type); load(); }
            else setError(json.message);
        } catch { setError('Network error'); }
        finally { setAdding(false); }
    }

    function startEdit(item) {
        setEditingId(item.id);
        setEditName(item.name);
        setEditAbbrev(item.abbreviation || '');
        setError('');
    }

    async function saveEdit(id) {
        if (!editName.trim()) { setError('Name is required'); return; }
        try {
            const res = await fetch(`${API}/${type}/${id}`, {
                method: 'PUT',
                headers: authHeaders(true),
                body: JSON.stringify({ name: editName.trim(), abbreviation: editAbbrev.trim() || undefined, is_active: items.find(i => i.id === id)?.is_active }),
            });
            const json = await res.json();
            if (json.success) { setEditingId(null); invalidateDropdownCache(type); load(); }
            else setError(json.message);
        } catch { setError('Network error'); }
    }

    async function toggleActive(item) {
        try {
            await fetch(`${API}/${type}/${item.id}/toggle`, {
                method: 'PATCH',
                headers: authHeaders(true),
                body: JSON.stringify({ is_active: !item.is_active }),
            });
            invalidateDropdownCache(type);
            load();
        } catch { /* ignore */ }
    }

    async function deleteItem(item) {
        if (!window.confirm(`Delete "${item.name}"?`)) return;
        try {
            const res = await fetch(`${API}/${type}/${item.id}`, { method: 'DELETE', headers: authHeaders() });
            const json = await res.json();
            if (json.success) { invalidateDropdownCache(type); load(); }
            else setError(json.message);
        } catch { setError('Network error'); }
    }

    const active = items.filter(i => i.is_active);
    const inactive = items.filter(i => !i.is_active);

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-primary">{meta.icon} {meta.label} Master</h6>
                <span className="badge bg-light text-dark border">{items.length} total · {active.length} active</span>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger py-2 small">{error}</div>}

                {/* Add New */}
                <div className="bg-light rounded p-3 mb-4">
                    <div className="fw-semibold small text-muted mb-2">Add New {meta.label}</div>
                    <div className="row g-2 align-items-end">
                        <div className={meta.hasAbbrev ? 'col-md-6' : 'col-md-9'}>
                            <input
                                className="form-control"
                                placeholder={`${meta.label} name *`}
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && add()}
                            />
                        </div>
                        {meta.hasAbbrev && (
                            <div className="col-md-3">
                                <input
                                    className="form-control"
                                    placeholder="College code"
                                    value={newAbbrev}
                                    onChange={e => setNewAbbrev(e.target.value.replace(/\D/g, ''))}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                />
                            </div>
                        )}
                        <div className="col-md-3">
                            <button className="btn btn-primary w-100" onClick={add} disabled={adding}>
                                {adding ? 'Adding...' : '+ Add'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="text-center text-muted py-4">Loading...</div>
                ) : items.length === 0 ? (
                    <div className="text-center text-muted py-4">No entries yet. Add the first one above.</div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    {meta.hasAbbrev && <th>College code</th>}
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={item.id} className={!item.is_active ? 'table-secondary text-muted' : ''}>
                                        <td className="text-muted small">{idx + 1}</td>
                                        <td>
                                            {editingId === item.id ? (
                                                <input
                                                    className="form-control form-control-sm"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className={!item.is_active ? 'text-decoration-line-through text-muted' : 'fw-semibold'}>
                                                    {item.name}
                                                </span>
                                            )}
                                        </td>
                                        {meta.hasAbbrev && (
                                            <td>
                                                {editingId === item.id ? (
                                                    <input
                                                        className="form-control form-control-sm"
                                                        value={editAbbrev}
                                                        onChange={e => setEditAbbrev(e.target.value.replace(/\D/g, ''))}
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                    />
                                                ) : (
                                                    <span className="text-muted small">{item.abbreviation || '—'}</span>
                                                )}
                                            </td>
                                        )}
                                        <td>
                                            <span className={`badge ${item.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                                {item.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            {editingId === item.id ? (
                                                <div className="d-flex gap-1">
                                                    <button className="btn btn-sm btn-success" onClick={() => saveEdit(item.id)}>Save</button>
                                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                                                </div>
                                            ) : (
                                                <div className="d-flex gap-1">
                                                    <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(item)}>Edit</button>
                                                    <button
                                                        className={`btn btn-sm ${item.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                                        onClick={() => toggleActive(item)}
                                                        title={item.is_active ? 'Disable' : 'Enable'}
                                                    >
                                                        {item.is_active ? 'Disable' : 'Enable'}
                                                    </button>
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteItem(item)}>Del</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {inactive.length > 0 && (
                    <div className="mt-2 text-muted small">
                        {inactive.length} inactive item(s) shown strikethrough — enable to make available in dropdowns.
                    </div>
                )}
            </div>
        </div>
    );
}

function InstituteLaunchPanel({ onOpen }) {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetch((import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/institutes?limit=1', { headers: { Authorization: `Bearer ${getToken()}` } })
            .then(r => r.json())
            .then(j => { if (j.success) setStats(j.pagination); })
            .catch(() => {});
    }, []);

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-primary">🏫 Institute Master</h6>
                {stats && (
                    <span className="badge bg-light text-dark border">
                        {stats.total} total
                    </span>
                )}
            </div>
            <div className="card-body text-center py-5">
                <div className="fs-1 mb-3">🏫</div>
                <h5 className="fw-bold mb-2">Enterprise Institute Management</h5>
                <p className="text-muted small mb-4" style={{ maxWidth: 460, margin: '0 auto 1.5rem' }}>
                    The Institute Master has been upgraded to an enterprise-grade management system
                    with full CRUD, Excel import/export, smart duplicate detection, bulk update control,
                    and audit logging.
                </p>
                <div className="d-flex justify-content-center gap-3 flex-wrap mb-4">
                    <div className="px-3 py-2 rounded-3 bg-success-subtle text-success-emphasis small fw-semibold">
                        ✅ Add / Edit / Delete
                    </div>
                    <div className="px-3 py-2 rounded-3 bg-primary-subtle text-primary small fw-semibold">
                        📊 Excel Import &amp; Export
                    </div>
                    <div className="px-3 py-2 rounded-3 bg-warning-subtle text-warning-emphasis small fw-semibold">
                        🔍 Smart Duplicate Detection
                    </div>
                    <div className="px-3 py-2 rounded-3 bg-info-subtle text-info-emphasis small fw-semibold">
                        🔄 Bulk Update Control
                    </div>
                </div>
                <button className="btn btn-primary px-4" onClick={onOpen}>
                    Open Institute Management →
                </button>
            </div>
        </div>
    );
}

function CapacityMasterPanel() {
    const [configs, setConfigs] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [cRes, dRes] = await Promise.all([
                fetch((import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/supervisors/capacity/config', { headers: authHeaders() }),
                fetch((import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/masters/designations', { headers: authHeaders() })
            ]);
            
            const cJson = await cRes.json().catch(() => ({}));
            const dJson = await dRes.json().catch(() => ({}));

            if (!cRes.ok) throw new Error(cJson.message || `Capacity API Error (${cRes.status})`);
            if (!dRes.ok) throw new Error(dJson.message || `Designations API Error (${dRes.status})`);

            if (cJson.success) setConfigs(cJson.data);
            if (dJson.success) setDesignations(dJson.data);
        } catch (e) { 
            console.error('Capacity Load Error:', e);
            setError(e.message || 'ENGINE_LOAD_FAILURE'); 
        }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleSave(designationId, maxCapacity, status) {
        setSaving(true); setError(''); setSuccess('');
        try {
            const res = await fetch((import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/supervisors/capacity/config', {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ designation_id: designationId, max_capacity: maxCapacity, status }),
            });
            const json = await res.json();
            if (json.success) {
                setSuccess('Capacity updated successfully');
                load();
            } else {
                setError(json.message);
            }
        } catch { setError('Network error'); }
        finally { setSaving(false); }
    }

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-bottom">
                <h6 className="mb-0 fw-bold text-primary">📊 Supervisor Capacity Configuration</h6>
            </div>
            <div className="card-body">
                {error && <div className="alert alert-danger py-2 small">{error}</div>}
                {success && <div className="alert alert-success py-2 small">{success}</div>}

                <div className="table-responsive">
                    <table className="table table-hover align-middle">
                        <thead className="table-light">
                            <tr>
                                <th>#</th>
                                <th>Designation</th>
                                <th style={{ width: 150 }}>Max Capacity</th>
                                <th style={{ width: 150 }}>Status</th>
                                <th className="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {designations.map((d, i) => {
                                const config = configs.find(c => c.designation_id === d.id);
                                return (
                                    <CapacityRow 
                                        key={d.id} 
                                        index={i + 1}
                                        designation={d} 
                                        config={config} 
                                        onSave={handleSave}
                                        saving={saving}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function CapacityRow({ index, designation, config, onSave, saving }) {
    const [capacity, setCapacity] = useState(config?.max_capacity || 0);
    const [status, setStatus] = useState(config?.status || 'Active');

    useEffect(() => {
        if (config) {
            setCapacity(config.max_capacity);
            setStatus(config.status);
        }
    }, [config]);

    const hasChanged = capacity !== (config?.max_capacity || 0) || status !== (config?.status || 'Active');

    return (
        <tr>
            <td className="text-muted small">{index}</td>
            <td>
                <div className="fw-semibold">{designation.name}</div>
                {!config && <small className="text-danger">Not Configured</small>}
            </td>
            <td>
                <input 
                    type="number" 
                    className="form-control form-control-sm"
                    value={capacity}
                    onChange={e => setCapacity(parseInt(e.target.value) || 0)}
                    min={0}
                />
            </td>
            <td>
                <select 
                    className="form-select form-select-sm"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                </select>
            </td>
            <td className="text-end">
                <button 
                    className="btn btn-sm btn-primary"
                    disabled={!hasChanged || saving}
                    onClick={() => onSave(designation.id, capacity, status)}
                >
                    {saving ? '...' : 'Save'}
                </button>
            </td>
        </tr>
    );
}
