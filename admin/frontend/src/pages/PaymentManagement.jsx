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
  const [yearFilter, setYearFilter]       = useState('');
  const [monthFilter, setMonthFilter]     = useState('');
  const [courseFilter, setCourseFilter]   = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  // Pagination
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Dynamic filter lists
  const [years, setYears] = useState([]);
  const [months, setMonths] = useState([]);
  const [courses, setCourses] = useState([]);

  const { sessions, sessionLabel } = useSession();

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch initial filters on mount
  useEffect(() => {
    const fetchInitialFilters = async () => {
      try {
        const res = await axios.get(`${API_URL}/applications/filters`, { headers });
        if (res.data.success) {
          setYears(res.data.data.years || []);
          setMonths(res.data.data.months || []);
          setCourses(res.data.data.courses || []);
        }
      } catch (err) {
        console.error('Failed to fetch initial filters', err);
      }
    };
    fetchInitialFilters();
  }, []);

  // Fetch dynamic cascading filters
  useEffect(() => {
    const fetchCascadedFilters = async () => {
      try {
        const params = new URLSearchParams();
        if (yearFilter) params.append('year', yearFilter);
        if (monthFilter) params.append('month', monthFilter);

        const res = await axios.get(`${API_URL}/applications/filters?${params}`, { headers });
        if (res.data.success) {
          if (!yearFilter && !monthFilter) {
            setMonths(res.data.data.months || []);
            setCourses(res.data.data.courses || []);
          } else {
            if (yearFilter) {
              setMonths(res.data.data.months || []);
            }
            setCourses(res.data.data.courses || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch cascaded filters', err);
      }
    };

    if (yearFilter || monthFilter) {
      fetchCascadedFilters();
    } else {
      const fetchAll = async () => {
        try {
          const res = await axios.get(`${API_URL}/applications/filters`, { headers });
          if (res.data.success) {
            setMonths(res.data.data.months || []);
            setCourses(res.data.data.courses || []);
          }
        } catch {}
      };
      fetchAll();
    }
  }, [yearFilter, monthFilter]);

  const fetchData = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (yearFilter)    params.append('year', yearFilter);
      if (monthFilter)   params.append('month', monthFilter);
      if (courseFilter)  params.append('course', courseFilter);
      if (search)        params.append('search', search);
      if (paymentFilter) params.append('payment_status', paymentFilter);
      params.append('sort_by', 'created_at');
      params.append('sort_dir', 'desc');
      params.append('page', targetPage);
      params.append('limit', limit);
      const res = await axios.get(`${API_URL}/applications?${params}`, { headers });
      setApplications(res.data.data || []);
      setTotalCount(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch { toast.error('Failed to fetch'); }
    finally { setLoading(false); }
  }, [search, yearFilter, monthFilter, courseFilter, paymentFilter, page, limit]);

  useEffect(() => { setPage(1); }, [search, yearFilter, monthFilter, courseFilter, paymentFilter, limit]);

  useEffect(() => {
    const t = setTimeout(() => fetchData(page), 400);
    return () => clearTimeout(t);
  }, [fetchData, page]);

  const updatePayment = async (id, payment_status) => {
    setUpdating(id + payment_status);
    try {
      await axios.put(`${API_URL}/applications/${id}/payment-status`, { payment_status }, { headers });
      toast.success(`Payment marked as ${payment_status}`);
      fetchData(page);
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setUpdating(null); }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('report_type', 'payment');
      if (yearFilter)    params.append('year', yearFilter);
      if (monthFilter)   params.append('month', monthFilter);
      if (courseFilter)  params.append('course', courseFilter);
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
            <div className="col-md-3">
              <input type="text" className="form-control form-control-sm"
                placeholder="Search by Name / App ID / Email..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-auto" style={{ minWidth: 135 }}>
              <select className="form-select form-select-sm" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                <option value="">Select Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="col-auto" style={{ minWidth: 135 }}>
              <select className="form-select form-select-sm" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                <option value="">Select Month</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-auto" style={{ minWidth: 140 }}>
              <select className="form-select form-select-sm" value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                <option value="">Select Course</option>
                {courses.map(c => <option key={c} value={c}>{c}</option>)}
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
            <div className="col-auto">
              <select className="form-select form-select-sm" value={limit} onChange={e => setLimit(e.target.value)}>
                <option value={10}>10 Per Page</option>
                <option value={20}>20 Per Page</option>
                <option value={50}>50 Per Page</option>
                <option value={100}>100 Per Page</option>
                <option value={200}>200 Per Page</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          
          <div className="d-flex justify-content-between align-items-center mt-2">
            <div className="d-flex gap-1 flex-wrap">
              {yearFilter && (
                <span className="badge bg-secondary text-white" style={{ fontSize: 11 }}>
                  Year: {yearFilter}
                  <button className="btn-close btn-close-sm ms-1" style={{ fontSize: 8, filter: 'invert(1)' }} onClick={() => setYearFilter('')} />
                </span>
              )}
              {monthFilter && (
                <span className="badge bg-secondary text-white" style={{ fontSize: 11 }}>
                  Month: {monthFilter}
                  <button className="btn-close btn-close-sm ms-1" style={{ fontSize: 8, filter: 'invert(1)' }} onClick={() => setMonthFilter('')} />
                </span>
              )}
              {courseFilter && (
                <span className="badge bg-secondary text-white" style={{ fontSize: 11 }}>
                  Course: {courseFilter}
                  <button className="btn-close btn-close-sm ms-1" style={{ fontSize: 8, filter: 'invert(1)' }} onClick={() => setCourseFilter('')} />
                </span>
              )}
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {limit === 'all' ? (
                <>Displaying <strong>1–{totalCount}</strong> of <strong>{totalCount}</strong> records</>
              ) : (
                <>Displaying <strong>{totalCount === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, totalCount)}</strong> of <strong>{totalCount}</strong> records</>
              )}
            </span>
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
                    <td className="ps-3 text-muted">{limit === 'all' ? i + 1 : (page - 1) * limit + i + 1}</td>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex align-items-center justify-content-between mt-3 px-1">
          <span className="text-muted" style={{ fontSize: 12 }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <div className="d-flex gap-1">
            <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 12 }} disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 12 }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const pg = start + idx;
              return (
                <button key={pg} className={`btn btn-sm ${pg === page ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ fontSize: 12, minWidth: 34 }} onClick={() => setPage(pg)}>{pg}</button>
              );
            })}
            <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 12 }} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
            <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 12 }} disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentManagement;
