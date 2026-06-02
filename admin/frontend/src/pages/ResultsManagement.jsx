import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  BarChart3, CheckCircle, XCircle, RefreshCw, Eye, EyeOff,
  Download, Calendar, Search, Award, ShieldCheck
} from 'lucide-react';
import { useSession } from '../contexts/SessionContext';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const QUAL_BADGE = {
  Pending:            'bg-secondary',
  Qualified:          'bg-success',
  'Direct Qualified': 'bg-primary',
  'Direct Pass':      'bg-primary',
  Failed:             'bg-danger',
  Absent:             'bg-dark',
};

const ResultsManagement = () => {
  const { sessions, activeSession, sessionLabel } = useSession();
  const [sessionFilter, setSessionFilter] = useState('active');
  const [publishStatus, setPublishStatus] = useState(null);
  const [results,       setResults]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [publishing,    setPublishing]    = useState(false);
  const [search,        setSearch]        = useState('');
  const [fromDate,      setFromDate]      = useState('');
  const [toDate,        setToDate]        = useState('');
  const [logs,          setLogs]          = useState([]);

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  // Each fetch accepts a signal so its effect can cancel it individually.
  const fetchPublishStatus = useCallback(async (signal) => {
    try {
      const res = await axios.get(
        `${API_URL}/results/publish-status?session_id=${sessionFilter}`,
        { headers, signal }
      );
      setPublishStatus(res.data.data);
    } catch (err) { if (err?.code !== 'ERR_CANCELED') setPublishStatus(null); }
  }, [sessionFilter]);

  const fetchResults = useCallback(async (signal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ session_id: sessionFilter });
      if (search)   params.set('search',    search);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate)   params.set('to_date',   toDate);
      const res = await axios.get(`${API_URL}/results/list?${params}`, { headers, signal });
      setResults(res.data.data || []);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') toast.error('Failed to load results');
    } finally { setLoading(false); }
  }, [sessionFilter, search, fromDate, toDate]);

  // fetchLogs has [] deps — runs once on mount, never on filter change.
  const fetchLogs = useCallback(async (signal) => {
    try {
      const res = await axios.get(`${API_URL}/results/publish-logs`, { headers, signal });
      setLogs(res.data.data || []);
    } catch { /* non-critical */ }
  }, []);

  // Three separate effects so each fetch only re-runs when its own deps change.
  // Previously one combined effect caused publish-status and logs to re-fetch
  // every time the search or date filters changed (fetchResults dep change).
  useEffect(() => {
    const ac = new AbortController();
    fetchPublishStatus(ac.signal);
    return () => ac.abort();
  }, [fetchPublishStatus]);

  useEffect(() => {
    const ac = new AbortController();
    fetchResults(ac.signal);
    return () => ac.abort();
  }, [fetchResults]);

  useEffect(() => {
    const ac = new AbortController();
    fetchLogs(ac.signal);
    return () => ac.abort();
  }, [fetchLogs]);

  const handlePublish = async () => {
    if (!window.confirm('Publish entrance results for selected session? Students will see their marks and PASS/FAIL status.')) return;
    setPublishing(true);
    try {
      const res = await axios.post(`${API_URL}/results/publish`, { session_id: sessionFilter }, { headers });
      toast.success(res.data.message);
      fetchPublishStatus();
      fetchResults();
      fetchLogs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Publish failed');
    } finally { setPublishing(false); }
  };

  const handleUnpublish = async () => {
    if (!window.confirm('Unpublish results? Students will no longer see their results.')) return;
    setPublishing(true);
    try {
      await axios.post(`${API_URL}/results/unpublish`, { session_id: sessionFilter }, { headers });
      toast.success('Results unpublished');
      fetchPublishStatus();
      fetchResults();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unpublish failed');
    } finally { setPublishing(false); }
  };

  const exportResults = async () => {
    try {
      const params = new URLSearchParams({
        session_id: sessionFilter, report_type: 'entrance',
        ...(search   ? { search }    : {}),
      });
      const res = await axios.get(`${API_URL}/applications/export/excel?${params}`, {
        headers, responseType: 'blob'
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `entrance_results_${sessionFilter}_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel generated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  const isPublished = publishStatus?.entrance_result_published;

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-4">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>
            <BarChart3 size={20} className="me-2" style={{ color: '#32c5d2' }} />
            Results Management
          </h2>
          <p className="text-muted small mb-0">Publish entrance results and manage student result visibility</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto', fontSize: 12 }}
            value={sessionFilter}
            onChange={e => setSessionFilter(e.target.value)}
          >
            <option value="active">Active Session {activeSession ? `(${sessionLabel(activeSession)})` : ''}</option>
            <option value="all">All Sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
          </select>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => { fetchPublishStatus(); fetchResults(); fetchLogs(); }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Publish Control Panel */}
      <div className="card border-0 shadow-sm mb-4" style={{
        borderLeft: `4px solid ${isPublished ? '#10b981' : '#f59e0b'}`
      }}>
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div className="d-flex align-items-center gap-3">
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: isPublished ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {isPublished
                  ? <CheckCircle size={24} style={{ color: '#10b981' }} />
                  : <EyeOff      size={24} style={{ color: '#f59e0b' }} />}
              </div>
              <div>
                <div className="fw-bold" style={{ fontSize: 15 }}>
                  {isPublished ? 'Results are Published' : 'Results are NOT Published'}
                </div>
                <div className="text-muted small">
                  {isPublished
                    ? `Published${publishStatus?.result_published_at ? ` on ${new Date(publishStatus.result_published_at).toLocaleDateString('en-IN')}` : ''}${publishStatus?.result_published_by ? ` by ${publishStatus.result_published_by}` : ''}`
                    : 'Students cannot see their marks and result status yet'}
                </div>
              </div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={exportResults}>
                <Download size={14} className="me-1" /> Export Excel
              </button>
              {isPublished ? (
                <button className="btn btn-sm btn-danger" onClick={handleUnpublish} disabled={publishing}>
                  {publishing ? <span className="spinner-border spinner-border-sm me-1" /> : <EyeOff size={14} className="me-1" />}
                  Unpublish Results
                </button>
              ) : (
                <button className="btn btn-sm btn-success" onClick={handlePublish} disabled={publishing}>
                  {publishing ? <span className="spinner-border spinner-border-sm me-1" /> : <Eye size={14} className="me-1" />}
                  Publish Results
                </button>
              )}
            </div>
          </div>

          {isPublished && (
            <div className="alert alert-success border-0 mt-3 mb-0 py-2" style={{ fontSize: 12 }}>
              <CheckCircle size={14} className="me-1" />
              Students can now view their marks, attendance, and PASS/FAIL status on their dashboard.
              PASS candidates are eligible to access the counselling form.
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="input-group input-group-sm" style={{ width: 250 }}>
              <span className="input-group-text bg-white"><Search size={13} /></span>
              <input
                className="form-control" placeholder="Search name or application ID…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
            <Calendar size={14} className="text-muted ms-2" />
            <span className="small text-muted">Published from:</span>
            <input type="date" className="form-control form-control-sm" style={{ width: 140 }}
              value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span className="small text-muted">to:</span>
            <input type="date" className="form-control form-control-sm" style={{ width: 140 }}
              value={toDate} onChange={e => setToDate(e.target.value)} />
            {(fromDate || toDate) && (
              <button className="btn btn-sm btn-link text-danger p-0"
                onClick={() => { setFromDate(''); setToDate(''); }}>Clear</button>
            )}
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3">
          <h6 className="mb-0 fw-bold" style={{ color: '#32c5d2' }}>
            Published Results ({results.length})
          </h6>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 text-muted">Loading results...</div>
          ) : results.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <BarChart3 size={32} className="mb-2 opacity-25" />
              <div>No published results found. Publish results to show them here.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                <thead className="table-light">
                  <tr>
                    <th className="ps-4 py-3">S.No</th>
                    <th className="py-3">Application ID</th>
                    <th className="py-3">Name</th>
                    <th className="py-3">Department</th>
                    <th className="py-3">Attendance</th>
                    <th className="py-3">Marks</th>
                    <th className="py-3">Qualification</th>
                    <th className="py-3">Result</th>
                    <th className="py-3 pe-4">Published On</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.application_id}>
                      <td className="ps-4">{i + 1}</td>
                      <td className="fw-bold text-primary" style={{ fontSize: 12 }}>{r.application_id}</td>
                      <td className="fw-semibold">{r.full_name}</td>
                      <td className="text-muted small">{r.subject || '—'}</td>
                      <td>
                        <span className={`badge ${r.attendance_status === 'Present' ? 'bg-success' : r.attendance_status === 'Absent' ? 'bg-dark' : 'bg-secondary'}`}>
                          {r.attendance_status || 'N/A'}
                        </span>
                      </td>
                      <td className="fw-semibold">
                        {r.direct_pass_status === 'DirectPass'
                          ? <span className="badge bg-primary"><ShieldCheck size={11} className="me-1" />Direct</span>
                          : r.entrance_mark != null ? r.entrance_mark : '—'}
                      </td>
                      <td>
                        <span className={`badge ${QUAL_BADGE[r.qualification_status] || 'bg-secondary'}`} style={{ fontSize: 11 }}>
                          {r.qualification_status || 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${r.final_result_status === 'PASS' ? 'bg-success' : r.final_result_status === 'FAIL' ? 'bg-danger' : 'bg-secondary'}`} style={{ fontSize: 11 }}>
                          {r.final_result_status === 'PASS'
                            ? <><CheckCircle size={11} className="me-1" />PASS</>
                            : r.final_result_status === 'FAIL'
                            ? <><XCircle    size={11} className="me-1" />FAIL</>
                            : 'Pending'}
                        </span>
                      </td>
                      <td className="text-muted small pe-4">
                        {r.result_published_at ? new Date(r.result_published_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Publish History */}
      {logs.length > 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white py-3">
            <h6 className="mb-0 fw-bold text-muted">Publish History</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0" style={{ fontSize: 12 }}>
                <thead className="table-light">
                  <tr>
                    <th className="ps-4 py-2">Session</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Published By</th>
                    <th className="py-2">Total</th>
                    <th className="py-2 pe-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td className="ps-4">{log.session_name || '—'}</td>
                      <td><span className="badge bg-secondary">{log.result_type}</span></td>
                      <td>{log.published_by}</td>
                      <td className="fw-semibold">{log.total_published}</td>
                      <td className="text-muted pe-4">{new Date(log.published_at).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsManagement;
