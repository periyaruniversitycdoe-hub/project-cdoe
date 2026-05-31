import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('adminToken')}` });

const CommunityFees = () => {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editFee, setEditFee] = useState(null);
  const [showAddFee, setShowAddFee] = useState(false);
  const [newFee, setNewFee] = useState({
    community_name: '',
    pg_min_mark: '',
    general_fee: '',
    differently_abled_fee: '',
    roster_percentage: '',
    status: 'active',
    sort_order: ''
  });

  useEffect(() => { fetchFees(); }, []);

  const fetchFees = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/settings/community-fees`);
      setFees(res.data.data || []);
    } catch { toast.error('Failed to load community fees'); }
    setLoading(false);
  };

  const saveFee = async () => {
    if (!editFee.community_name.trim()) { toast.error('Community name is required'); return; }
    try {
      await axios.put(`${API}/settings/community-fees/${editFee.id}`, editFee, { headers: authHeader() });
      setFees(fees.map(f => f.id === editFee.id ? editFee : f));
      setEditFee(null);
      toast.success('Fee updated successfully');
    } catch { toast.error('Failed to save fee'); }
  };

  const addFee = async () => {
    if (!newFee.community_name.trim()) { toast.error('Community name is required'); return; }
    try {
      const res = await axios.post(`${API}/settings/community-fees`, newFee, { headers: authHeader() });
      setFees([...fees, { ...newFee, id: res.data.id }]);
      setNewFee({
        community_name: '',
        pg_min_mark: '',
        general_fee: '',
        differently_abled_fee: '',
        roster_percentage: '',
        status: 'active',
        sort_order: ''
      });
      setShowAddFee(false);
      toast.success('Community added successfully');
    } catch { toast.error('Failed to add community'); }
  };

  const deleteFee = async (id) => {
    if (!window.confirm('Delete this community fee record?')) return;
    try {
      await axios.delete(`${API}/settings/community-fees/${id}`, { headers: authHeader() });
      setFees(fees.filter(f => f.id !== id));
      toast.success('Deleted successfully');
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <div className="p-5 text-center"><div className="spinner-border text-primary" /></div>;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#32c5d2' }}>Community Master &amp; Fees</h2>
          <p className="text-muted mb-0 small">Consolidated single source of truth for PG min marks, roster percentages, and application fees</p>
        </div>
        <button className="btn btn-success px-4" onClick={() => setShowAddFee(!showAddFee)}>
          + Add Community
        </button>
      </div>

      <div className="card shadow-sm border-0 rounded-3">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bordered table-hover mb-0 align-middle">
              <thead className="table-dark text-uppercase small" style={{ letterSpacing: '0.5px' }}>
                <tr>
                  <th style={{ width: 50 }} className="text-center">#</th>
                  <th>Community</th>
                  <th>PG Min Mark (%)</th>
                  <th>General Fee (₹)</th>
                  <th>Diff. Abled Fee (₹)</th>
                  <th>Roster Percentage (%)</th>
                  <th>Status</th>
                  <th style={{ width: 150 }} className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {showAddFee && (
                  <tr className="table-success">
                    <td className="text-muted text-center fw-semibold">New</td>
                    <td>
                      <input className="form-control form-control-sm fw-bold" value={newFee.community_name}
                        onChange={e => setNewFee({ ...newFee, community_name: e.target.value })} placeholder="e.g. BC" />
                    </td>
                    <td>
                      <input type="number" className="form-control form-control-sm" value={newFee.pg_min_mark}
                        onChange={e => setNewFee({ ...newFee, pg_min_mark: e.target.value })} placeholder="55" />
                    </td>
                    <td>
                      <input type="number" className="form-control form-control-sm" value={newFee.general_fee}
                        onChange={e => setNewFee({ ...newFee, general_fee: e.target.value })} placeholder="1000" />
                    </td>
                    <td>
                      <input type="number" className="form-control form-control-sm" value={newFee.differently_abled_fee}
                        onChange={e => setNewFee({ ...newFee, differently_abled_fee: e.target.value })} placeholder="500" />
                    </td>
                    <td>
                      <input type="number" step="0.01" className="form-control form-control-sm" value={newFee.roster_percentage}
                        onChange={e => setNewFee({ ...newFee, roster_percentage: e.target.value })} placeholder="26.5" />
                    </td>
                    <td>
                      <select className="form-select form-select-sm" value={newFee.status}
                        onChange={e => setNewFee({ ...newFee, status: e.target.value })}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="text-center">
                      <button className="btn btn-sm btn-primary me-1 px-3" onClick={addFee}>Save</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setShowAddFee(false)}>✕</button>
                    </td>
                  </tr>
                )}
                {fees.map((fee, i) => (
                  <tr key={fee.id} style={fee.status === 'inactive' ? { opacity: 0.6 } : {}}>
                    <td className="text-center text-muted fw-semibold">{i + 1}</td>
                    <td>
                      {editFee?.id === fee.id
                        ? <input className="form-control form-control-sm fw-bold" value={editFee.community_name}
                            onChange={e => setEditFee({ ...editFee, community_name: e.target.value })} />
                        : <strong className="text-dark">{fee.community_name}</strong>}
                    </td>
                    <td>
                      {editFee?.id === fee.id
                        ? <input type="number" className="form-control form-control-sm" value={editFee.pg_min_mark || ''}
                            onChange={e => setEditFee({ ...editFee, pg_min_mark: e.target.value })} />
                        : fee.pg_min_mark != null ? <span className="fw-semibold text-primary">{fee.pg_min_mark}%</span> : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {editFee?.id === fee.id
                        ? <input type="number" className="form-control form-control-sm" value={editFee.general_fee || ''}
                            onChange={e => setEditFee({ ...editFee, general_fee: e.target.value })} />
                        : fee.general_fee ? `₹${fee.general_fee}` : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {editFee?.id === fee.id
                        ? <input type="number" className="form-control form-control-sm" value={editFee.differently_abled_fee || ''}
                            onChange={e => setEditFee({ ...editFee, differently_abled_fee: e.target.value })} />
                        : fee.differently_abled_fee ? `₹${fee.differently_abled_fee}` : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {editFee?.id === fee.id
                        ? <input type="number" step="0.01" className="form-control form-control-sm" value={editFee.roster_percentage || ''}
                            onChange={e => setEditFee({ ...editFee, roster_percentage: e.target.value })} />
                        : fee.roster_percentage != null ? <span className="fw-bold text-success">{fee.roster_percentage}%</span> : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {editFee?.id === fee.id
                        ? <select className="form-select form-select-sm" value={editFee.status}
                            onChange={e => setEditFee({ ...editFee, status: e.target.value })}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        : <span className={`badge px-2.5 py-1.5 rounded-pill ${fee.status === 'active' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'}`} style={{ textTransform: 'capitalize', fontSize: '11px', fontWeight: '600' }}>
                            {fee.status || 'active'}
                          </span>}
                    </td>
                    <td className="text-center">
                      {editFee?.id === fee.id
                        ? <>
                            <button className="btn btn-sm btn-primary me-1 px-3" onClick={saveFee}>Save</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditFee(null)}>✕</button>
                          </>
                        : <>
                            <button className="btn btn-sm btn-outline-primary me-1 px-2.5" onClick={() => setEditFee({ ...fee })}>Edit</button>
                            <button className="btn btn-sm btn-outline-danger px-2.5" onClick={() => deleteFee(fee.id)}>Del</button>
                          </>
                      }
                    </td>
                  </tr>
                ))}
                {fees.length === 0 && !showAddFee && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">No community fees configured. Click "+ Add Community" to start.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityFees;
