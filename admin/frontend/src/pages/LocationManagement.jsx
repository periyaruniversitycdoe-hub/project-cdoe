import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, MapPin, Map, RefreshCw, ChevronRight } from 'lucide-react';

const API_URL = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;

const LocationManagement = () => {
  const token = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  // States
  const [states, setStates] = useState([]);
  const [stateForm, setStateForm] = useState({ id: null, state_name: '' });
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [deletingState, setDeletingState] = useState(null);

  // Districts
  const [districts, setDistricts] = useState([]);
  const [selectedStateId, setSelectedStateId] = useState('');
  const [districtForm, setDistrictForm] = useState({ id: null, district_name: '', state_id: '' });
  const [districtModalOpen, setDistrictModalOpen] = useState(false);
  const [deletingDistrict, setDeletingDistrict] = useState(null);

  const fetchStates = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/locations/states`);
      setStates(res.data.data || []);
    } catch { toast.error('Failed to load states'); }
  }, []);

  const fetchDistricts = useCallback(async () => {
    try {
      const url = selectedStateId
        ? `${API_URL}/locations/districts?state_id=${selectedStateId}`
        : `${API_URL}/locations/districts`;
      const res = await axios.get(url);
      setDistricts(res.data.data || []);
    } catch { toast.error('Failed to load districts'); }
  }, [selectedStateId]);

  useEffect(() => { fetchStates(); }, [fetchStates]);
  useEffect(() => { fetchDistricts(); }, [fetchDistricts]);

  // ── State CRUD ──────────────────────────────────────────────────────────────
  const openStateModal = (state = null) => {
    setStateForm(state ? { id: state.id, state_name: state.state_name } : { id: null, state_name: '' });
    setStateModalOpen(true);
  };

  const saveState = async () => {
    if (!stateForm.state_name.trim()) return toast.error('State name is required');
    try {
      if (stateForm.id) {
        await axios.put(`${API_URL}/locations/states/${stateForm.id}`, { state_name: stateForm.state_name }, { headers });
        toast.success('State updated');
      } else {
        await axios.post(`${API_URL}/locations/states`, { state_name: stateForm.state_name }, { headers });
        toast.success('State added');
      }
      setStateModalOpen(false);
      fetchStates();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save state'); }
  };

  const deleteState = async (id, name) => {
    if (!window.confirm(`Delete state "${name}"? This will also delete all its districts.`)) return;
    setDeletingState(id);
    try {
      await axios.delete(`${API_URL}/locations/states/${id}`, { headers });
      toast.success('State deleted');
      fetchStates(); fetchDistricts();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    finally { setDeletingState(null); }
  };

  // ── District CRUD ───────────────────────────────────────────────────────────
  const openDistrictModal = (district = null) => {
    setDistrictForm(district
      ? { id: district.id, district_name: district.district_name, state_id: district.state_id }
      : { id: null, district_name: '', state_id: selectedStateId || '' }
    );
    setDistrictModalOpen(true);
  };

  const saveDistrict = async () => {
    if (!districtForm.district_name.trim() || !districtForm.state_id) {
      return toast.error('State and district name are required');
    }
    try {
      if (districtForm.id) {
        await axios.put(`${API_URL}/locations/districts/${districtForm.id}`,
          { district_name: districtForm.district_name, state_id: districtForm.state_id }, { headers });
        toast.success('District updated');
      } else {
        await axios.post(`${API_URL}/locations/districts`,
          { district_name: districtForm.district_name, state_id: districtForm.state_id }, { headers });
        toast.success('District added');
      }
      setDistrictModalOpen(false);
      fetchDistricts();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save district'); }
  };

  const deleteDistrict = async (id, name) => {
    if (!window.confirm(`Delete district "${name}"?`)) return;
    setDeletingDistrict(id);
    try {
      await axios.delete(`${API_URL}/locations/districts/${id}`, { headers });
      toast.success('District deleted');
      fetchDistricts();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    finally { setDeletingDistrict(null); }
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: '22px' }}>Location Management</h2>
          <nav aria-label="breadcrumb"><ol className="breadcrumb mb-0" style={{ fontSize: '12px' }}>
            <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
            <li className="breadcrumb-item active">Locations</li>
          </ol></nav>
        </div>
      </div>

      <div className="row g-3">
        {/* ── STATES PANEL ────────────────────────────────────────────────── */}
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center justify-content-between py-2">
              <span className="fw-bold d-flex align-items-center gap-2"><Map size={16} /> States / Union Territories</span>
              <div className="d-flex gap-1">
                <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={fetchStates}>
                  <RefreshCw size={13} />
                </button>
                <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" onClick={() => openStateModal()}>
                  <Plus size={14} /> Add State
                </button>
              </div>
            </div>
            <div className="card-body p-0" style={{ maxHeight: '520px', overflowY: 'auto' }}>
              <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: '13px' }}>
                <thead className="table-light sticky-top">
                  <tr>
                    <th className="ps-3">#</th>
                    <th>State Name</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {states.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-4 text-muted">No states found</td></tr>
                  ) : states.map((s, i) => (
                    <tr key={s.id} className={selectedStateId == s.id ? 'table-info' : ''}
                        style={{ cursor: 'pointer' }} onClick={() => setSelectedStateId(s.id == selectedStateId ? '' : s.id)}>
                      <td className="ps-3 text-muted">{i + 1}</td>
                      <td>
                        <span className="fw-semibold">{s.state_name}</span>
                        {selectedStateId == s.id && (
                          <small className="ms-2 badge bg-info text-dark">Selected</small>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="d-flex gap-1 justify-content-center" onClick={e => e.stopPropagation()}>
                          <button className="btn btn-xs btn-outline-warning btn-sm" style={{ fontSize: '11px', padding: '2px 7px' }}
                            onClick={() => openStateModal(s)}>
                            <Edit2 size={11} />
                          </button>
                          <button className="btn btn-xs btn-outline-danger btn-sm" style={{ fontSize: '11px', padding: '2px 7px' }}
                            disabled={deletingState === s.id}
                            onClick={() => deleteState(s.id, s.state_name)}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-footer text-muted py-2" style={{ fontSize: '11px' }}>
              {states.length} states/UTs &nbsp;|&nbsp; Click a row to filter districts
            </div>
          </div>
        </div>

        {/* ── DISTRICTS PANEL ─────────────────────────────────────────────── */}
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center justify-content-between py-2">
              <span className="fw-bold d-flex align-items-center gap-2">
                <MapPin size={16} /> Districts
                {selectedStateId && (
                  <small className="badge bg-info text-dark ms-1">
                    {states.find(s => s.id == selectedStateId)?.state_name}
                    <button className="btn-close btn-close-sm ms-1" style={{ fontSize: '7px' }}
                      onClick={() => setSelectedStateId('')} />
                  </small>
                )}
              </span>
              <div className="d-flex gap-1">
                <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={fetchDistricts}>
                  <RefreshCw size={13} />
                </button>
                <button className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                  onClick={() => openDistrictModal()} disabled={!selectedStateId}>
                  <Plus size={14} /> Add District
                </button>
              </div>
            </div>
            {!selectedStateId && (
              <div className="alert alert-info m-3 py-2 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                <ChevronRight size={16} /> Select a state on the left to add or manage its districts.
              </div>
            )}
            <div className="card-body p-0" style={{ maxHeight: '480px', overflowY: 'auto' }}>
              <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: '13px' }}>
                <thead className="table-light sticky-top">
                  <tr>
                    <th className="ps-3">#</th>
                    <th>District Name</th>
                    {!selectedStateId && <th>State</th>}
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {districts.length === 0 ? (
                    <tr><td colSpan={selectedStateId ? 3 : 4} className="text-center py-4 text-muted">
                      {selectedStateId ? 'No districts for this state' : 'No districts found'}
                    </td></tr>
                  ) : districts.map((d, i) => (
                    <tr key={d.id}>
                      <td className="ps-3 text-muted">{i + 1}</td>
                      <td className="fw-semibold">{d.district_name}</td>
                      {!selectedStateId && <td className="text-muted">{d.state_name}</td>}
                      <td className="text-center">
                        <div className="d-flex gap-1 justify-content-center">
                          <button className="btn btn-xs btn-outline-warning btn-sm" style={{ fontSize: '11px', padding: '2px 7px' }}
                            onClick={() => openDistrictModal(d)}>
                            <Edit2 size={11} />
                          </button>
                          <button className="btn btn-xs btn-outline-danger btn-sm" style={{ fontSize: '11px', padding: '2px 7px' }}
                            disabled={deletingDistrict === d.id}
                            onClick={() => deleteDistrict(d.id, d.district_name)}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-footer text-muted py-2" style={{ fontSize: '11px' }}>
              {districts.length} district(s) {selectedStateId ? 'in selected state' : 'total'}
            </div>
          </div>
        </div>
      </div>

      {/* ── State Modal ─────────────────────────────────────────────────────── */}
      {stateModalOpen && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title fw-bold">{stateForm.id ? 'Edit State' : 'Add New State'}</h6>
                <button className="btn-close btn-sm" onClick={() => setStateModalOpen(false)} />
              </div>
              <div className="modal-body">
                <label className="form-label fw-semibold">State / UT Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={stateForm.state_name}
                  onChange={e => setStateForm(p => ({ ...p, state_name: e.target.value }))}
                  placeholder="e.g. Tamil Nadu"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveState()}
                />
              </div>
              <div className="modal-footer py-2">
                <button className="btn btn-sm btn-secondary" onClick={() => setStateModalOpen(false)}>Cancel</button>
                <button className="btn btn-sm btn-primary" onClick={saveState}>
                  {stateForm.id ? 'Update' : 'Add'} State
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── District Modal ───────────────────────────────────────────────────── */}
      {districtModalOpen && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title fw-bold">{districtForm.id ? 'Edit District' : 'Add New District'}</h6>
                <button className="btn-close btn-sm" onClick={() => setDistrictModalOpen(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">State <span className="text-danger">*</span></label>
                  <select
                    className="form-select form-select-sm"
                    value={districtForm.state_id}
                    onChange={e => setDistrictForm(p => ({ ...p, state_id: e.target.value }))}
                  >
                    <option value="">Select State</option>
                    {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label fw-semibold">District Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={districtForm.district_name}
                    onChange={e => setDistrictForm(p => ({ ...p, district_name: e.target.value }))}
                    placeholder="e.g. Salem"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveDistrict()}
                  />
                </div>
              </div>
              <div className="modal-footer py-2">
                <button className="btn btn-sm btn-secondary" onClick={() => setDistrictModalOpen(false)}>Cancel</button>
                <button className="btn btn-sm btn-primary" onClick={saveDistrict}>
                  {districtForm.id ? 'Update' : 'Add'} District
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationManagement;
