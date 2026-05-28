import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useSession } from '../contexts/SessionContext';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const PAY_BADGE = {
  Unpaid: 'bg-secondary text-white',
  Pending: 'bg-warning text-dark',
  Processing: 'bg-info text-white',
  Success: 'bg-primary text-white',
  Paid:   'bg-success text-white',
  Verified: 'bg-info text-dark',
  Approved: 'bg-success text-white',
  Rejected: 'bg-danger text-white',
  Failed: 'bg-danger text-white',
};

const PaymentManagement = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [updating, setUpdating]         = useState(null);
  const [search, setSearch]             = useState('');
  const [sessionFilter, setSessionFilter] = useState('active');
  const [paymentFilter, setPaymentFilter] = useState('');
  const { sessions, sessionLabel } = useSession();

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('session_id', sessionFilter);
      if (search)        params.append('search', search);
      if (paymentFilter) params.append('payment_status', paymentFilter);
      params.append('sort_by', 'created_at');
      params.append('sort_dir', 'desc');
      const res = await axios.get(`${API_URL}/applications?${params}`, { headers });
      setApplications(res.data.data || []);
    } catch { toast.error('Failed to fetch'); }
    finally { setLoading(false); }
  }, [search, sessionFilter, paymentFilter]);

  useEffect(() => { const t = setTimeout(fetchData, 400); return () => clearTimeout(t); }, [fetchData]);

  const updatePayment = async (id, payment_status) => {
    setUpdating(id + payment_status);
    try {
      await axios.put(`${API_URL}/applications/${id}/payment-status`, { payment_status }, { headers });
      toast.success(`Payment marked as ${payment_status}`);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setUpdating(null); }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('report_type', 'payment');
      params.append('session_id', sessionFilter);
      if (search)        params.append('search', search);
      if (paymentFilter) params.append('payment_status', paymentFilter);
      const res = await axios.get(`${API_URL}/applications/export/excel?${params}`, {
        headers, responseType: 'blob'
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `payment_report_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };


  return (
    <div>
      <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>Payment Management</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 12 }}>
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
              <li className="breadcrumb-item active">Payment Management</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-sm btn-outline-success" style={{ fontSize: 11, fontWeight: 600 }} onClick={handleExport}>Export Excel</button>
          <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 11 }} onClick={fetchData}>Refresh</button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <input type="text" className="form-control form-control-sm"
                placeholder="Search by Name / App ID / Email..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-auto">
              <select className="form-select form-select-sm" value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
                <option value="active">Active Session</option>
                <option value="all">All Sessions</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
              </select>
            </div>
            <div className="col-auto">
              <select className="form-select form-select-sm" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
                <option value="">All Payments</option>
                <option value="Paid">Paid</option>
                <option value="Success">Success</option>
                <option value="Verified">Verified</option>
                <option value="Approved">Approved</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Failed">Failed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div className="mt-2 text-end">
            <small className="text-muted">Showing <strong>{applications.length}</strong> records</small>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
              <thead className="table-light">
                <tr>
                  <th className="ps-3 py-3" style={{ width: 40 }}>#</th>
                  <th className="py-3">Application ID</th>
                  <th className="py-3">Applicant Name</th>
                  <th className="py-3">Email</th>
                  <th className="py-3">Subject</th>
                  <th className="py-3">App Status</th>
                  <th className="py-3">Payment Status</th>
                  <th className="py-3 text-center" style={{ minWidth: 220 }}>Update Payment</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-5 text-muted">Loading...</td></tr>
                ) : applications.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-5 text-muted">No records found</td></tr>
                ) : applications.map((app, i) => (
                  <tr key={app.id}>
                    <td className="ps-3 text-muted">{i + 1}</td>
                    <td>
                      <div className="fw-bold text-primary" style={{ fontSize: 12 }}>{app.application_id}</div>
                      <div className="text-muted" style={{ fontSize: 10 }}>{app.session_name}</div>
                    </td>
                    <td className="fw-semibold">{app.full_name}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{app.email}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{app.subject || '—'}</td>
                    <td>
                      <span className={`badge rounded-pill px-3 py-1 ${
                        app.status === 'Approved' ? 'bg-success text-white' :
                        app.status === 'Submitted' ? 'bg-info text-white' :
                        app.status === 'Rejected' ? 'bg-danger text-white' : 'bg-secondary text-white'
                      }`} style={{ fontSize: 11 }}>{app.status || 'Draft'}</span>
                    </td>
                    <td>
                      <span className={`badge rounded-pill px-3 py-1 ${PAY_BADGE[app.payment_status] || 'bg-warning text-dark'}`} style={{ fontSize: 11 }}>
                        {app.payment_status || 'Unpaid'}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="d-flex gap-1 justify-content-center">
                        {['Success'].includes(app.payment_status) && (
                          <>
                            <button className="btn btn-sm btn-outline-success" style={{ fontSize: 11, fontWeight: 600 }} disabled={updating === app.id + 'Verified'} onClick={() => updatePayment(app.id, 'Verified')}>
                              Verify
                            </button>
                            <button className="btn btn-sm btn-danger" style={{ fontSize: 11, fontWeight: 600 }} disabled={updating === app.id + 'Rejected'} onClick={() => updatePayment(app.id, 'Rejected')}>
                              Reject
                            </button>
                          </>
                        )}
                        {['Verified'].includes(app.payment_status) && (
                          <button className="btn btn-sm btn-primary" style={{ fontSize: 11, fontWeight: 600 }} disabled={updating === app.id + 'Approved'} onClick={() => updatePayment(app.id, 'Approved')}>
                            Approve
                          </button>
                        )}
                        {!['Success', 'Verified'].includes(app.payment_status) && (
                           <span className="text-muted" style={{ fontSize: 11 }}>--</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentManagement;
