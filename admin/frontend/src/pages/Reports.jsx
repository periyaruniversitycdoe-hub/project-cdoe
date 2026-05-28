import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart3, FileText, CreditCard, Ticket, UserCheck, BookOpen,
  Users, GraduationCap, Award, History, Download, Search,
  Filter, Printer, Loader2, Calendar, ShieldAlert
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const menuItems = [
  { id: 'analytics', label: 'Analytics Dashboard', icon: BarChart3 },
  { id: 'applications', label: 'Application Reports', icon: FileText },
  { id: 'payments', label: 'Payment Reports', icon: CreditCard },
  { id: 'hall_tickets', label: 'Hall Ticket Reports', icon: Ticket },
  { id: 'attendance', label: 'Attendance Reports', icon: UserCheck },
  { id: 'entrance_marks', label: 'Entrance Marks Reports', icon: BookOpen },
  { id: 'results', label: 'Results Reports', icon: Award },
  { id: 'student_tracking', label: 'Student Tracking Reports', icon: Users },
  { id: 'counselling', label: 'Counselling Reports', icon: GraduationCap },
  { id: 'qualifications', label: 'Qualification Reports', icon: Award },
  { id: 'audit', label: 'Audit Reports', icon: History },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  
  // Dynamic selections populated from DB
  const [sessions, setSessions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programmes, setProgrammes] = useState([]);

  // Filters State
  const [filters, setFilters] = useState({
    session_id: 'all',
    start_date: '',
    end_date: '',
    department_id: 'all',
    program_offered_id: 'all',
    community: 'all',
    status: 'all',
    payment_status: 'all',
    category: 'all',
    district: 'all',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  // Fetch standard filters dynamically on mount
  useEffect(() => {
    // 1. Sessions
    axios.get(`${API}/sessions`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
    }).then(res => {
      setSessions(res.data.data || []);
      // If there is an active session, default select it
      const active = (res.data.data || []).find(s => s.is_active === 1);
      if (active) {
        setFilters(prev => ({ ...prev, session_id: String(active.id) }));
      }
    }).catch(() => {});

    // 2. Departments
    axios.get(`${API}/eligibility/departments/all`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
    }).then(res => {
      setDepartments(res.data.data || []);
    }).catch(() => {});
  }, []);

  // Fetch Programmes when department changes
  useEffect(() => {
    if (filters.department_id !== 'all') {
      axios.get(`${API}/eligibility/programs/all?department_id=${filters.department_id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      }).then(res => {
        setProgrammes(res.data.data || []);
      }).catch(() => {});
    } else {
      setProgrammes([]);
      setFilters(prev => ({ ...prev, program_offered_id: 'all' }));
    }
  }, [filters.department_id]);

  // Load Main Report Data based on Active Tab & Filters
  const loadReport = async () => {
    setLoading(true);
    const token = localStorage.getItem('adminToken');
    try {
      // Build clean query string
      const qParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val && val !== 'all') qParams.append(key, val);
      });

      if (activeTab === 'analytics') {
        const res = await axios.get(`${API}/reports/analytics?${qParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAnalytics(res.data.data);
      } else {
        const endpoint = activeTab.replace(/_/g, '-');
        const res = await axios.get(`${API}/reports/${endpoint}?${qParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data.data || []);
        setCurrentPage(1);
      }
    } catch {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [activeTab, filters]);

  // Handle Dynamic Excel/CSV Download
  const handleExport = async (format) => {
    const token = localStorage.getItem('adminToken');
    const loadingToast = toast.loading(`Generating and downloading ${format.toUpperCase()} report...`);
    try {
      const res = await axios.post(`${API}/reports/export`, {
        report_type: activeTab,
        format,
        filters
      }, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });

      // Trigger standard browser download
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeTab}_report_${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`${format.toUpperCase()} export completed!`, { id: loadingToast });
    } catch (err) {
      toast.error('Export failed. Please check filters or console.', { id: loadingToast });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const resetFilters = () => {
    setFilters({
      session_id: 'all',
      start_date: '',
      end_date: '',
      department_id: 'all',
      program_offered_id: 'all',
      community: 'all',
      status: 'all',
      payment_status: 'all',
      category: 'all',
      district: 'all',
    });
    setSearchTerm('');
    toast.success('Filters reset to default');
  };

  // Helper to paginate tabular data
  const filteredRows = data.filter(row => {
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const indexOfLastRow = currentPage * itemsPerPage;
  const indexOfFirstRow = indexOfLastRow - itemsPerPage;
  const currentRows = filteredRows.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);

  // Table Configuration based on Active Tab
  const getTableConfig = () => {
    switch (activeTab) {
      case 'applications':
        return {
          headers: ['Application ID', 'Applicant Name', 'Subject', 'Community', 'Status', 'Payment'],
          renderRow: (r, idx) => (
            <tr key={r.application_id || idx}>
              <td><span className="fw-semibold text-teal">{r.application_id}</span></td>
              <td>{r.applicant_name}</td>
              <td>{r.subject || '—'}</td>
              <td><span className="badge bg-light text-dark border">{r.community || '—'}</span></td>
              <td>
                <span className={`badge ${
                  r.status === 'Approved' ? 'bg-success-subtle text-success' :
                  r.status === 'Rejected' ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning'
                }`}>
                  {r.status}
                </span>
              </td>
              <td>
                <span className={`badge ${r.payment_status === 'Paid' ? 'bg-success' : 'bg-secondary'}`}>
                  {r.payment_status}
                </span>
              </td>
            </tr>
          )
        };
      case 'payments':
        return {
          headers: ['ID', 'Application ID', 'Applicant Name', 'Amount', 'Gateway', 'Ref ID', 'Status', 'Date'],
          renderRow: (r, idx) => (
            <tr key={r.id || idx}>
              <td>{r.id}</td>
              <td><span className="fw-semibold text-teal">{r.application_id}</span></td>
              <td>{r.applicant_name}</td>
              <td className="fw-semibold">₹{parseFloat(r.amount).toLocaleString('en-IN')}</td>
              <td><span className="badge bg-info-subtle text-info">{r.gateway}</span></td>
              <td className="text-muted small">{r.transaction_id || '—'}</td>
              <td>
                <span className={`badge ${r.payment_status === 'Success' ? 'bg-success' : 'bg-danger'}`}>
                  {r.payment_status}
                </span>
              </td>
              <td>{r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '—'}</td>
            </tr>
          )
        };
      case 'hall_tickets':
        return {
          headers: ['HT Number', 'Application ID', 'Applicant', 'Exam Venue', 'Date & Time', 'Seat', 'Status'],
          renderRow: (r, idx) => (
            <tr key={r.id || idx}>
              <td><span className="fw-bold text-teal">{r.hall_ticket_number}</span></td>
              <td>{r.application_id}</td>
              <td>{r.applicant_name}</td>
              <td className="small">{r.exam_venue}</td>
              <td>
                <div className="small fw-semibold">{r.exam_date ? new Date(r.exam_date).toLocaleDateString() : '—'}</div>
                <div className="text-muted small">{r.exam_time}</div>
              </td>
              <td><span className="badge bg-secondary">{r.seat_number}</span></td>
              <td>
                <span className={`badge ${r.is_sent ? 'bg-success' : 'bg-warning'}`}>
                  {r.is_sent ? 'Sent' : 'Draft'}
                </span>
              </td>
            </tr>
          )
        };
      case 'attendance':
        return {
          headers: ['Application ID', 'Applicant Name', 'Subject', 'Exam Centre Preferred', 'HT Number', 'Seat', 'Attendance'],
          renderRow: (r, idx) => (
            <tr key={r.application_id || idx}>
              <td>{r.application_id}</td>
              <td>{r.applicant_name}</td>
              <td>{r.subject}</td>
              <td>{r.exam_center_1 || '—'}</td>
              <td className="small">{r.hall_ticket_number || '—'}</td>
              <td>{r.seat_number || '—'}</td>
              <td>
                <span className={`badge ${r.attendance_status === 'Present' ? 'bg-success' : 'bg-danger'}`}>
                  {r.attendance_status}
                </span>
              </td>
            </tr>
          )
        };
      case 'entrance_marks':
        return {
          headers: ['Application ID', 'Applicant Name', 'Subject', 'Community', 'Mark (CET)', 'Exam Status', 'Result Status'],
          renderRow: (r, idx) => (
            <tr key={r.application_id || idx}>
              <td>{r.application_id}</td>
              <td>{r.applicant_name}</td>
              <td>{r.subject}</td>
              <td>{r.community}</td>
              <td className="fw-bold">{r.entrance_mark !== null ? r.entrance_mark : '—'}</td>
              <td><span className="badge bg-light text-dark border">{r.entrance_exam_status}</span></td>
              <td>
                <span className={`badge ${
                  r.qualification_status === 'Qualified' || r.qualification_status === 'Direct Qualified' ? 'bg-success' :
                  r.qualification_status === 'Failed' ? 'bg-danger' : 'bg-secondary'
                }`}>
                  {r.qualification_status}
                </span>
              </td>
            </tr>
          )
        };
      case 'results':
        return {
          headers: ['Application ID', 'Applicant Name', 'Subject', 'Community', 'Mark', 'Exemption', 'Final Result'],
          renderRow: (r, idx) => (
            <tr key={r.application_id || idx}>
              <td>{r.application_id}</td>
              <td>{r.applicant_name}</td>
              <td>{r.subject}</td>
              <td>{r.community}</td>
              <td>{r.entrance_mark !== null ? r.entrance_mark : '—'}</td>
              <td>{r.entrance_exam_status}</td>
              <td>
                <span className={`badge ${r.final_result_status === 'PASS' ? 'bg-success' : r.final_result_status === 'FAIL' ? 'bg-danger' : 'bg-secondary'}`}>
                  {r.final_result_status}
                </span>
              </td>
            </tr>
          )
        };
      case 'student_tracking':
        return {
          headers: ['Application ID', 'Applicant Name', 'Subject', 'Status', 'Payment', 'Reg Date', 'Final Submitted'],
          renderRow: (r, idx) => (
            <tr key={r.application_id || idx}>
              <td><span className="fw-semibold text-teal">{r.application_id}</span></td>
              <td>{r.applicant_name}</td>
              <td>{r.subject}</td>
              <td><span className="badge bg-light text-dark border">{r.status}</span></td>
              <td><span className="badge bg-secondary-subtle text-secondary">{r.payment_status}</span></td>
              <td className="small">{new Date(r.created_at).toLocaleDateString()}</td>
              <td className="small">{r.final_submitted_at ? new Date(r.final_submitted_at).toLocaleString() : '—'}</td>
            </tr>
          )
        };
      case 'counselling':
        return {
          headers: ['Application ID', 'Applicant Name', 'Subject', 'Counselling Date', 'Time', 'Venue', 'Counselling Status', 'Allotment'],
          renderRow: (r, idx) => (
            <tr key={r.application_id || idx}>
              <td>{r.application_id}</td>
              <td>{r.applicant_name}</td>
              <td>{r.subject}</td>
              <td>{r.counselling_date ? new Date(r.counselling_date).toLocaleDateString() : '—'}</td>
              <td>{r.counselling_time || '—'}</td>
              <td className="small">{r.venue || '—'}</td>
              <td><span className="badge bg-info-subtle text-info">{r.counselling_status}</span></td>
              <td><span className="badge bg-light text-dark border">{r.allotment_status || 'Pending'}</span></td>
            </tr>
          )
        };
      case 'qualifications':
        return {
          headers: ['Application ID', 'Applicant Name', 'Subject', 'Qualified Exams', 'Exemption Mode'],
          renderRow: (r, idx) => {
            let exams = '—';
            try {
              if (r.qualified_exams) {
                const arr = typeof r.qualified_exams === 'string' ? JSON.parse(r.qualified_exams) : r.qualified_exams;
                if (Array.isArray(arr) && arr.length) exams = arr.join(', ');
              }
            } catch {}
            return (
              <tr key={r.application_id || idx}>
                <td>{r.application_id}</td>
                <td>{r.applicant_name}</td>
                <td>{r.subject}</td>
                <td className="fw-semibold small">{exams}</td>
                <td><span className="badge bg-light text-dark border">{r.entrance_exam_status}</span></td>
              </tr>
            );
          }
        };
      case 'audit':
        return {
          headers: ['Log ID', 'Action', 'Entity Type', 'Activity Details', 'Client IP', 'Timestamp'],
          renderRow: (r, idx) => (
            <tr key={r.id || idx}>
              <td>{r.id}</td>
              <td className="fw-bold text-teal">{r.action}</td>
              <td><span className="badge bg-secondary">{r.entity_type}</span></td>
              <td className="small text-truncate" style={{ maxWidth: 300 }} title={r.old_value}>{r.old_value || '—'}</td>
              <td><code>{r.ip_address}</code></td>
              <td className="small">{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          )
        };
      default:
        return { headers: [], renderRow: () => null };
    }
  };

  const config = getTableConfig();

  return (
    <div className="p-3">
      {/* ── Header Title & Watermark print configuration ── */}
      <div className="d-flex align-items-center justify-content-between mb-4 print-hide">
        <div>
          <h2 className="fw-bold text-teal mb-0" style={{ color: '#32c5d2' }}>Reports & Analytics Engine</h2>
          <p className="text-muted small mb-0">Centralized academic reports, collections ledger, and workflow stats</p>
        </div>
        <div className="d-flex gap-2">
          {activeTab !== 'analytics' && (
            <>
              <button onClick={() => handleExport('excel')} className="btn btn-sm btn-outline-success d-flex align-items-center gap-1">
                <Download size={14} /> Excel
              </button>
              <button onClick={() => handleExport('csv')} className="btn btn-sm btn-outline-info d-flex align-items-center gap-1">
                <Download size={14} /> CSV
              </button>
            </>
          )}
          <button onClick={handlePrint} className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* ── Print Header block (Visible during window.print() only) ── */}
      <div className="print-only mb-4 text-center">
        <h2 className="fw-bold mb-1" style={{ color: '#008080' }}>PERIYAR UNIVERSITY</h2>
        <h5 className="text-secondary mb-3">Ph.D Admission ERP System - Official Report</h5>
        <div className="p-2 border rounded bg-light text-start small mb-3">
          <div><strong>Report:</strong> {menuItems.find(t => t.id === activeTab)?.label}</div>
          <div><strong>Downloaded By:</strong> University Administrator</div>
          <div><strong>Generated At:</strong> {new Date().toLocaleString()}</div>
          <div><strong>Filters:</strong> {JSON.stringify(filters)}</div>
        </div>
      </div>

      {/* ── Global Filter Engine Panel ── */}
      <div className="card shadow-sm border-0 mb-4 print-hide" style={{ background: '#f8fafc' }}>
        <div className="card-body p-3">
          <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-2">
            <Filter size={16} className="text-teal" />
            <span className="fw-bold text-dark" style={{ fontSize: 13 }}>Global Filter Engine</span>
            <button onClick={resetFilters} className="btn btn-link text-danger p-0 ms-auto border-0 text-decoration-none small">
              Reset Filters
            </button>
          </div>

          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label small fw-bold">Academic Session</label>
              <select className="form-select form-select-sm" value={filters.session_id} onChange={e => setFilters(p => ({ ...p, session_id: e.target.value }))}>
                <option value="all">All Sessions</option>
                {sessions.map(s => <option key={s.id} value={String(s.id)}>{s.month} {s.year} {s.is_active ? '(Active)' : ''}</option>)}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label small fw-bold">Department</label>
              <select className="form-select form-select-sm" value={filters.department_id} onChange={e => setFilters(p => ({ ...p, department_id: e.target.value, program_offered_id: 'all' }))}>
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
            </div>

            {programmes.length > 0 && (
              <div className="col-md-3">
                <label className="form-label small fw-bold">Programme Offered</label>
                <select className="form-select form-select-sm" value={filters.program_offered_id} onChange={e => setFilters(p => ({ ...p, program_offered_id: e.target.value }))}>
                  <option value="all">All Programmes</option>
                  {programmes.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div className="col-md-3">
              <label className="form-label small fw-bold">Community Category</label>
              <select className="form-select form-select-sm" value={filters.community} onChange={e => setFilters(p => ({ ...p, community: e.target.value }))}>
                <option value="all">All Communities</option>
                {['OC', 'BC', 'MBC', 'SC', 'ST'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label small fw-bold">From Date</label>
              <input type="date" className="form-control form-control-sm" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))} />
            </div>

            <div className="col-md-2">
              <label className="form-label small fw-bold">To Date</label>
              <input type="date" className="form-control form-control-sm" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))} />
            </div>

            <div className="col-md-2">
              <label className="form-label small fw-bold">Application Status</label>
              <select className="form-select form-select-sm" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
                <option value="all">All Statuses</option>
                {['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label small fw-bold">Payment Status</label>
              <select className="form-select form-select-sm" value={filters.payment_status} onChange={e => setFilters(p => ({ ...p, payment_status: e.target.value }))}>
                <option value="all">All Payments</option>
                {['Paid', 'Unpaid', 'Pending', 'Failed'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            <div className="col-md-2">
              <label className="form-label small fw-bold">Registration Mode</label>
              <select className="form-select form-select-sm" value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}>
                <option value="all">All Categories</option>
                <option value="Full Time">Full Time</option>
                <option value="Part Time">Part Time</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Layout Workspace ── */}
      <div className="row g-3">
        {/* Left Side Navigation Panel */}
        <div className="col-lg-3 print-hide">
          <div className="list-group shadow-sm border-0 rounded-3">
            <div className="list-group-item bg-teal text-white fw-bold py-3" style={{ background: '#32c5d2' }}>
              Operational Reports Map
            </div>
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setData([]); }}
                className={`list-group-item list-group-item-action border-0 py-3 d-flex align-items-center gap-2 ${
                  activeTab === item.id ? 'active' : ''
                }`}
                style={activeTab === item.id ? { backgroundColor: '#32c5d2' } : {}}
              >
                <item.icon size={16} />
                <span className="small fw-semibold">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side Rendering Panel */}
        <div className="col-lg-9 col-12">
          {loading && (
            <div className="d-flex align-items-center justify-content-center p-5 card border-0 shadow-sm" style={{ minHeight: 300 }}>
              <Loader2 className="animate-spin text-teal" size={32} />
              <span className="ms-2 text-muted">Aggregating records and building metrics...</span>
            </div>
          )}

          {!loading && activeTab === 'analytics' && analytics && (
            /* ── Analytics Dashboard View ── */
            <div className="d-flex flex-column gap-3">
              {/* Stat Cards Row */}
              <div className="row g-3">
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm rounded-3 p-3 text-start" style={{ background: 'linear-gradient(135deg, #32c5d2 0%, #17a2b8 100%)', color: '#fff' }}>
                    <div className="text-white-50 small fw-bold text-uppercase">Total Applicants</div>
                    <div className="fs-2 fw-bold mt-1">{analytics.totalApplicants}</div>
                    <div className="small mt-2 text-white-50">Accumulated across selected filters</div>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="card border-0 shadow-sm rounded-3 p-3 text-start" style={{ background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)', color: '#fff' }}>
                    <div className="text-white-50 small fw-bold text-uppercase">Total Collections</div>
                    <div className="fs-2 fw-bold mt-1">₹{parseFloat(analytics.totalPayments).toLocaleString('en-IN')}</div>
                    <div className="small mt-2 text-white-50">Success transactions value</div>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="card border-0 shadow-sm rounded-3 p-3 text-start" style={{ background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)', color: '#fff' }}>
                    <div className="text-white-50 small fw-bold text-uppercase">Pending Verifications</div>
                    <div className="fs-2 fw-bold mt-1">{analytics.pendingVerification}</div>
                    <div className="small mt-2 text-white-50">Submitted applications queue</div>
                  </div>
                </div>
              </div>

              {/* Graphical aggregates card */}
              <div className="row g-3">
                {/* Funnel Widget */}
                <div className="col-md-6">
                  <div className="card border-0 shadow-sm rounded-3 p-3 h-100 text-start">
                    <h6 className="fw-bold border-bottom pb-2 text-dark">Admission Funnel Analytics</h6>
                    <div className="d-flex flex-column gap-3 mt-3">
                      {['draft', 'submitted', 'under_review', 'approved', 'rejected'].map(stage => {
                        const count = analytics.funnel[stage];
                        const pct = analytics.totalApplicants ? Math.round((count / analytics.totalApplicants) * 100) : 0;
                        const colors = {
                          draft: '#6c757d',
                          submitted: '#3498db',
                          under_review: '#f39c12',
                          approved: '#2ecc71',
                          rejected: '#e74c3c'
                        };
                        return (
                          <div key={stage} className="small">
                            <div className="d-flex justify-content-between mb-1">
                              <span className="fw-semibold text-uppercase text-muted" style={{ fontSize: 10 }}>{stage.replace('_', ' ')}</span>
                              <span className="fw-bold">{count} ({pct}%)</span>
                            </div>
                            <div className="progress" style={{ height: 6 }}>
                              <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: colors[stage] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Community Distribution SVG Pie representation */}
                <div className="col-md-6">
                  <div className="card border-0 shadow-sm rounded-3 p-3 h-100 text-start">
                    <h6 className="fw-bold border-bottom pb-2 text-dark">Community-wise Distribution</h6>
                    <div className="d-flex flex-column gap-2 mt-3" style={{ maxHeight: 220, overflowY: 'auto' }}>
                      {analytics.communityDistribution.map((item, idx) => {
                        const colors = ['#32c5d2', '#2ecc71', '#3498db', '#f1c40f', '#e74c3c', '#9b59b6'];
                        const pct = analytics.totalApplicants ? Math.round((item.count / analytics.totalApplicants) * 100) : 0;
                        return (
                          <div key={item.community} className="d-flex align-items-center justify-content-between p-2 rounded mb-1 bg-light" style={{ fontSize: 12 }}>
                            <div className="d-flex align-items-center gap-2">
                              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors[idx % colors.length] }} />
                              <span className="fw-semibold text-dark">{item.community}</span>
                            </div>
                            <span className="fw-bold">{item.count} ({pct}%)</span>
                          </div>
                        );
                      })}
                      {analytics.communityDistribution.length === 0 && (
                        <div className="text-muted small text-center p-3">No community metrics calculated</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Department distribution table */}
              <div className="card border-0 shadow-sm rounded-3 p-3 text-start">
                <h6 className="fw-bold border-bottom pb-2 text-dark">Top Subjects / Departments Allocation</h6>
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Subject Department</th>
                        <th>Applicants Allocated</th>
                        <th>Distribution Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.departmentDistribution.map((item, idx) => {
                        const pct = analytics.totalApplicants ? Math.round((item.count / analytics.totalApplicants) * 100) : 0;
                        return (
                          <tr key={item.department}>
                            <td>{idx + 1}</td>
                            <td className="fw-bold text-dark">{item.department}</td>
                            <td>{item.count}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div className="progress flex-grow-1" style={{ height: 6, maxWidth: 100 }}>
                                  <div className="progress-bar bg-teal" style={{ width: `${pct}%`, backgroundColor: '#32c5d2' }} />
                                </div>
                                <span className="small text-muted">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {analytics.departmentDistribution.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center text-muted p-3">No department maps active</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Tabular Reports View ── */}
          {!loading && activeTab !== 'analytics' && (
            <div className="card border-0 shadow-sm rounded-3 p-0 text-start">
              {/* Table search & statistics panel */}
              <div className="card-header bg-white border-bottom py-3 px-3 d-flex flex-wrap align-items-center justify-content-between gap-3 print-hide">
                <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '350px' }}>
                  <Search size={16} className="text-muted" />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search in this report..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="text-muted small">
                  <strong>Total Records:</strong> {filteredRows.length} {filteredRows.length !== data.length ? `(filtered from ${data.length})` : ''}
                </div>
              </div>

              {/* Tabular records lists */}
              <div className="table-responsive">
                <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '12.5px' }}>
                  <thead className="bg-light">
                    <tr>
                      {config.headers.map(h => <th key={h} className="py-3 px-3 text-uppercase text-secondary font-bold" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row, idx) => config.renderRow(row, idx))}
                    {currentRows.length === 0 && (
                      <tr>
                        <td colSpan={config.headers.length || 1} className="text-center py-5 text-muted">
                          <ShieldAlert size={28} className="mx-auto mb-2 opacity-50 text-warning" />
                          <div>No records found matching filters or search queries.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              {totalPages > 1 && (
                <div className="card-footer bg-white border-top py-3 px-3 d-flex align-items-center justify-content-between print-hide">
                  <div className="text-muted small">
                    Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredRows.length)} of {filteredRows.length} rows
                  </div>
                  <div className="d-flex gap-1">
                    <button
                      className="btn btn-xs btn-outline-secondary px-2"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, idx) => (
                      <button
                        key={idx + 1}
                        className={`btn btn-xs ${currentPage === idx + 1 ? 'btn-teal text-white' : 'btn-outline-secondary'} px-2`}
                        style={currentPage === idx + 1 ? { backgroundColor: '#32c5d2', borderColor: '#32c5d2' } : {}}
                        onClick={() => setCurrentPage(idx + 1)}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      className="btn btn-xs btn-outline-secondary px-2"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* ── Print footer watermark block (Visible during window.print() only) ── */}
      <div className="print-only mt-5 text-center border-top pt-3 small text-muted">
        <div>Official Document | Periyar University Ph.D ERP Portal</div>
        <div>Watermarked Copy - Do not duplicate. Track ID: REPORT_EXPORT_{activeTab.toUpperCase()}_{Date.now()}</div>
      </div>
    </div>
  );
}
