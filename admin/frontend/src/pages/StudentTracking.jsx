
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useSession } from '../contexts/SessionContext';
import { Users, UserCheck, UserX, GraduationCap } from 'lucide-react';

const API_URL = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;

const APP_STATUS_BADGE = {
  Draft:          'bg-secondary text-white',
  Submitted:      'bg-info text-white',
  'Under Review': 'bg-warning text-dark',
  Approved:       'bg-success text-white',
  Rejected:       'bg-danger text-white',
};



const fmt = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};
const fmtDate = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const StudentTracking = () => {
  const [students, setStudents]         = useState([]);
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [sessionFilter, setSessionFilter] = useState('active');
  const [approving, setApproving]       = useState(null);

  const [page, setPage]         = useState(1);
  const [limit]                 = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const { sessions, sessionLabel } = useSession();
  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/students/stats`, { headers });
      if (res.data.success) setStats(res.data.data);
    } catch { /* non-critical */ }
  }, []);

  const fetchStudents = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('session_id', sessionFilter);
      if (search.trim()) params.append('search', search.trim());
      params.append('page',  targetPage);
      params.append('limit', limit);

      const res = await axios.get(`${API_URL}/students?${params}`, { headers });
      setStudents(res.data.data || []);
      setTotalCount(res.data.total     || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch { toast.error('Failed to load student data'); }
    finally { setLoading(false); }
  }, [search, sessionFilter, page, limit]);

  useEffect(() => { setPage(1); }, [search, sessionFilter]);
  useEffect(() => {
    const t = setTimeout(() => fetchStudents(page), 400);
    return () => clearTimeout(t);
  }, [fetchStudents, page]);
  useEffect(() => { fetchStats(); }, [fetchStats]);



  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>Student Tracking</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 12 }}>
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
              <li className="breadcrumb-item active">Student Tracking</li>
            </ol>
          </nav>
        </div>
        <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 11 }} onClick={() => fetchStudents(page)}>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="row g-3 mb-3">
          {[
            { label: 'Total Students',       value: stats.total,                icon: <Users size={20} />,         bg: '#eff6ff', color: '#3b82f6' },
            { label: 'Ever Logged In',        value: stats.logged_in,            icon: <UserCheck size={20} />,     bg: '#f0fdf4', color: '#22c55e' },
            { label: 'Counselling Approved',  value: stats.counselling_approved, icon: <UserCheck size={20} />,     bg: '#ecfdf5', color: '#059669' },
          ].map(({ label, value, icon, bg, color }) => (
            <div key={label} className="col-6 col-md-3">
              <div className="card border-0 shadow-sm rounded-3 p-3" style={{ background: bg }}>
                <div className="d-flex align-items-center gap-2 mb-1" style={{ color }}>{icon}</div>
                <div className="fw-bold" style={{ fontSize: 24, color }}>{value ?? '—'}</div>
                <div className="small fw-semibold text-muted">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search Name / App ID / Email / Mobile..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <select className="form-select form-select-sm" value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
                <option value="active">Active Session</option>
                <option value="all">All Sessions</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-2 text-end">
            <small className="text-muted">
              Showing <strong>{(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)}</strong> of <strong>{totalCount}</strong> students
            </small>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
              <thead className="table-light">
                <tr>
                  <th className="ps-3 py-3" style={{ width: 36 }}>#</th>
                  <th className="py-3">Student</th>
                  <th className="py-3">Application</th>
                  <th className="py-3">Subject</th>
                  <th className="py-3">Session</th>
                  <th className="py-3">Qualifications</th>
                  <th className="py-3">Registration</th>
                  <th className="py-3">First Login</th>
                  <th className="py-3 text-center">App Status</th>
                  <th className="py-3 text-center">Entrance</th>
                  <th className="py-3" style={{ minWidth: 200 }}>Counselling Approval</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="text-center py-5 text-muted">Loading...</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-5 text-muted">No students found</td></tr>
                ) : students.map((s, i) => {
                  const isApproving = approving === s.app_id;
                  return (
                    <tr key={s.id}>
                      <td className="ps-3 text-muted">{(page - 1) * limit + i + 1}</td>

                      {/* Student */}
                      <td>
                        <div className="fw-semibold">{s.full_name}</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>{s.email}</div>
                        {s.mobile && <div className="text-muted" style={{ fontSize: 10 }}>{s.mobile}</div>}
                      </td>

                      {/* Application */}
                      <td>
                        <div className="fw-bold text-primary" style={{ fontSize: 11 }}>{s.application_id}</div>
                        {s.login_count != null && (
                          <div className="text-muted" style={{ fontSize: 10 }}>
                            {s.login_count > 0 ? `${s.login_count} login${s.login_count > 1 ? 's' : ''}` : 'Never logged in'}
                          </div>
                        )}
                      </td>

                      {/* Subject */}
                      <td className="text-muted">{s.subject || '—'}</td>

                      {/* Session */}
                      <td className="text-muted" style={{ fontSize: 11 }}>{s.session_name || '—'}</td>

                      {/* Qualifications */}
                      <td>
                        {s.qual_names ? (
                          <span className="badge bg-primary bg-opacity-10 text-primary px-2 py-1 rounded" style={{ fontSize: 10 }}>
                            {s.qual_names}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        {s.entrance_exam_status === 'Exempted' && (
                          <div className="mt-1">
                            <span className="badge bg-info bg-opacity-10 text-info px-2 py-1 rounded" style={{ fontSize: 9 }}>
                              Entrance Exempted
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Registration */}
                      <td className="text-muted" style={{ fontSize: 11 }}>{fmtDate(s.registered_at)}</td>

                      {/* First Login */}
                      <td style={{ fontSize: 11 }}>
                        {s.first_login_at ? (
                          <>
                            <div>{fmtDate(s.first_login_at)}</div>
                            {s.last_login_at && s.last_login_at !== s.first_login_at && (
                              <div className="text-muted" style={{ fontSize: 10 }}>Last: {fmtDate(s.last_login_at)}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted fst-italic">Not yet</span>
                        )}
                      </td>

                      {/* App Status */}
                      <td>
                        <span className={`badge rounded-pill px-2 py-1 ${APP_STATUS_BADGE[s.app_status] || 'bg-secondary text-white'}`} style={{ fontSize: 10 }}>
                          {s.app_status || 'Draft'}
                        </span>
                        {s.final_submitted ? (
                          <div className="mt-1"><span className="badge bg-dark text-white px-2" style={{ fontSize: 9 }}>Final Submitted</span></div>
                        ) : null}
                      </td>

                      {/* Entrance */}
                      <td>
                        {s.entrance_exam_status === 'Exempted' ? (
                          <span className="badge bg-info bg-opacity-10 text-info border border-info px-2 py-1 rounded" style={{ fontSize: 10 }}>Exempted</span>
                        ) : (
                          <>
                            <span className={`badge rounded-pill px-2 py-1 ${
                              s.qualification_status === 'Qualified' || s.qualification_status === 'Direct Qualified'
                                ? 'bg-success text-white'
                                : s.qualification_status === 'Failed'
                                ? 'bg-danger text-white'
                                : s.qualification_status === 'Absent'
                                ? 'bg-dark text-white'
                                : 'bg-secondary text-white'
                            }`} style={{ fontSize: 10 }}>
                              {s.qualification_status || 'Pending'}
                            </span>
                            {s.entrance_mark != null && (
                              <div className="text-muted mt-1" style={{ fontSize: 10 }}>Mark: {s.entrance_mark}</div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Counselling Status (Automated) */}
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className={`badge rounded-pill px-3 py-1 ${
                            s.qualification_status === 'Qualified' || s.qualification_status === 'Direct Qualified'
                              ? 'bg-success text-white'
                              : 'bg-secondary text-white'
                          }`} style={{ fontSize: 10 }}>
                             {s.qualification_status === 'Qualified' || s.qualification_status === 'Direct Qualified' ? 'Eligible' : 'Not Eligible'}
                          </span>
                          {s.counselling_submitted === 1 && (
                            <span className="badge bg-primary px-2 py-1 rounded" style={{ fontSize: 9 }}>Form Submitted</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

export default StudentTracking;
