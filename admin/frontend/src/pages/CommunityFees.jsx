
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
  const [newFee, setNewFee] = useState({ community: '', pg_min_mark: '', fee_general: '', fee_diff_abled: '', sort_order: '' });

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
    try {
      await axios.put(`${API}/settings/community-fees/${editFee.id}`, editFee, { headers: authHeader() });
      setFees(fees.map(f => f.id === editFee.id ? editFee : f));
      setEditFee(null);
      toast.success('Fee updated');
    } catch { toast.error('Failed to save fee'); }
  };

  const addFee = async () => {
    if (!newFee.community.trim()) { toast.error('Community name is required'); return; }
    try {
      const res = await axios.post(`${API}/settings/community-fees`, newFee, { headers: authHeader() });
      setFees([...fees, { ...newFee, id: res.data.id }]);
      setNewFee({ community: '', pg_min_mark: '', fee_general: '', fee_diff_abled: '', sort_order: '' });
      setShowAddFee(false);
      toast.success('Community added');
    } catch { toast.error('Failed to add community'); }
  };

  const deleteFee = async (id) => {
    if (!window.confirm('Delete this community fee?')) return;
    try {
      await axios.delete(`${API}/settings/community-fees/${id}`, { headers: authHeader() });
      setFees(fees.filter(f => f.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <div className="p-5 text-center"><div className="spinner-border text-primary" /></div>;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#32c5d2' }}>Community-wise Fee Structure</h2>
          <p className="text-muted mb-0 small">Manage PG minimum marks and application fees by community category</p>
        </div>
        <button className="btn btn-success px-4" onClick={() => setShowAddFee(!showAddFee)}>
          + Add Community
        </button>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bordered table-hover mb-0">
              <thead className="table-dark">
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Community</th>
                  <th>PG Min Mark (%)</th>
                  <th>General Fee (₹)</th>
                  <th>Diff. Abled Fee (₹)</th>
                  <th style={{ width: 130 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {showAddFee && (
                  <tr className="table-success">
                    <td className="text-muted fw-semibold">New</td>
                    <td>
                      <input className="form-control form-control-sm" value={newFee.community}
                        onChange={e => setNewFee({ ...newFee, community: e.target.value })} placeholder="e.g. OC" />
                    </td>
                    <td>
                      <input type="number" className="form-control form-control-sm" value={newFee.pg_min_mark}
                        onChange={e => setNewFee({ ...newFee, pg_min_mark: e.target.value })} placeholder="55" />
                    </td>
                    <td>
                      <input type="number" className="form-control form-control-sm" value={newFee.fee_general}
                        onChange={e => setNewFee({ ...newFee, fee_general: e.target.value })} placeholder="1000" />
                    </td>
                    <td>
                      <input type="number" className="form-control form-control-sm" value={newFee.fee_diff_abled}
                        onChange={e => setNewFee({ ...newFee, fee_diff_abled: e.target.value })} placeholder="500" />
                    </td>
                    <td>
                      <button className="btn btn-sm btn-primary me-1" onClick={addFee}>Save</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setShowAddFee(false)}>✕</button>
                    </td>
                  </tr>
                )}
                {fees.map((fee, i) => (
                  <tr key={fee.id}>
                    <td>{i + 1}</td>
                    <td>
                      {editFee?.id === fee.id
                        ? <input className="form-control form-control-sm" value={editFee.community}
                            onChange={e => setEditFee({ ...editFee, community: e.target.value })} />
                        : <strong>{fee.community}</strong>}
                    </td>
                    <td>
                      {editFee?.id === fee.id
                        ? <input type="number" className="form-control form-control-sm" value={editFee.pg_min_mark || ''}
                            onChange={e => setEditFee({ ...editFee, pg_min_mark: e.target.value })} />
                        : fee.pg_min_mark != null ? fee.pg_min_mark : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {editFee?.id === fee.id
                        ? <input type="number" className="form-control form-control-sm" value={editFee.fee_general || ''}
                            onChange={e => setEditFee({ ...editFee, fee_general: e.target.value })} />
                        : fee.fee_general ? `₹${fee.fee_general}` : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {editFee?.id === fee.id
                        ? <input type="number" className="form-control form-control-sm" value={editFee.fee_diff_abled || ''}
                            onChange={e => setEditFee({ ...editFee, fee_diff_abled: e.target.value })} />
                        : fee.fee_diff_abled ? `₹${fee.fee_diff_abled}` : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {editFee?.id === fee.id
                        ? <>
                            <button className="btn btn-sm btn-primary me-1" onClick={saveFee}>Save</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditFee(null)}>✕</button>
                          </>
                        : <>
                            <button className="btn btn-sm btn-outline-primary me-1" onClick={() => setEditFee({ ...fee })}>Edit</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => deleteFee(fee.id)}>Del</button>
                          </>
                      }
                    </td>
                  </tr>
                ))}
                {fees.length === 0 && !showAddFee && (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No community fees configured. Click "+ Add Community" to start.</td></tr>
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
