import React, { useEffect, useState, useCallback } from 'react';
import { fetchEmailLogs, sendTestEmail } from '../services/emailService.api';
import { History, Search, CheckCircle, XCircle, Clock, ArrowLeft, RefreshCw, Filter, Eye, ChevronRight, X, AlertTriangle, ShieldCheck, Mail, Send, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function EmailLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedLog, setSelectedLog] = useState(null);
    const [resendVariables, setResendVariables] = useState('{\n  "name": "Prof. Majeed Khan",\n  "student_name": "Majeed Khan",\n  "application_no": "PHD-2026-8942"\n}');
    const [resending, setResending] = useState(false);
    const navigate = useNavigate();

    // Stable reference — called by handleResend after a successful re-send
    // so the table refreshes without requiring a page reload.
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchEmailLogs();
            setLogs(res.data.data || []);
        } catch (err) {
            toast.error('Failed to load transmission logs');
        } finally {
            setLoading(false);
        }
    }, []);

    // Cancellation guard prevents stale state updates if StrictMode
    // unmounts the component before the initial fetch resolves.
    useEffect(() => {
        let cancelled = false;
        fetchEmailLogs()
            .then(res  => { if (!cancelled) setLogs(res.data.data || []); })
            .catch(()  => { if (!cancelled) toast.error('Failed to load transmission logs'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // Calculate metrics
    const totalCount = logs.length;
    const successCount = logs.filter(l => l.status === 'success').length;
    const failureCount = logs.filter(l => l.status === 'failed').length;
    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;

    const filtered = logs.filter(log => {
        const matchesSearch = (log.recipient_email || '').toLowerCase().includes(search.toLowerCase()) || 
                             (log.service_key || '').toLowerCase().includes(search.toLowerCase()) ||
                             (log.email_subject || '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleSelectLog = (log) => {
        setSelectedLog(log);
        // Pre-fill editable JSON variables depending on the service key to make it feel super smart
        const mockPayload = {
            name: 'Prof. Majeed Khan',
            student_name: 'Majeed Khan',
            application_no: 'PHD-2026-8942',
            supervisor_name: 'Dr. Sarah Connor',
            department: 'Computer Science & Engineering',
            otp: '482910'
        };
        setResendVariables(JSON.stringify(mockPayload, null, 2));
    };

    const handleResend = async () => {
        if (!selectedLog) return;
        
        let parsedVars = {};
        try {
            parsedVars = JSON.parse(resendVariables);
        } catch (e) {
            return toast.error('Invalid JSON payload variables. Please check brackets and quotes.');
        }

        setResending(true);
        try {
            await sendTestEmail({
                serviceKey: selectedLog.service_key,
                to: selectedLog.recipient_email,
                variables: parsedVars
            });
            toast.success('SMTP packet successfully re-routed and delivered!');
            setSelectedLog(null);
            loadData(); // refresh to show the new transmission
        } catch (err) {
            toast.error('Re-delivery failed: ' + (err.response?.data?.error || 'SMTP gateway rejected request'));
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="container-fluid py-4 animate-fade-in" style={{ maxWidth: '1300px', paddingBottom: '5rem', position: 'relative', overflow: 'hidden' }}>
            {/* Header section with gradient design */}
            <div 
                className="p-5 mb-5 rounded-4 shadow-sm text-white position-relative overflow-hidden" 
                style={{ 
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    border: '1px solid rgba(255,255,255,0.08)'
                }}
            >
                {/* Visual overlay glow */}
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '350px',
                    height: '350px',
                    borderRadius: '50%',
                    background: 'rgba(54, 193, 207, 0.08)',
                    filter: 'blur(80px)',
                    pointerEvents: 'none'
                }}></div>
                
                <div className="row align-items-center g-4 position-relative" style={{ zIndex: 2 }}>
                    <div className="col-lg-8">
                        <div className="d-flex align-items-center gap-3">
                            <button 
                                onClick={() => navigate('/email-services')} 
                                className="btn btn-outline-light p-2.5 rounded-3 d-flex align-items-center justify-content-center"
                                style={{ 
                                    backgroundColor: 'rgba(255,255,255,0.05)', 
                                    borderColor: 'rgba(255,255,255,0.15)',
                                    width: '40px',
                                    height: '40px'
                                }}
                                title="Back to Services"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div>
                                <h1 className="h3 fw-bold text-white mb-1 d-flex flex-wrap align-items-center gap-2">
                                    Transmission Audit Logs
                                    <span className="badge rounded-pill" style={{ fontSize: '10px', letterSpacing: '1px', backgroundColor: 'rgba(54, 193, 207, 0.2)', color: '#abe7ed', border: '1px solid rgba(54, 193, 207, 0.3)' }}>
                                        TELEMETRY PORTAL
                                    </span>
                                </h1>
                                <p className="text-muted mb-0" style={{ color: '#94a3b8 !important', fontSize: '14px' }}>
                                    Enterprise-level transmission tracking & SMTP delivery telemetry records.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-4 text-lg-end">
                        <button 
                            onClick={loadData} 
                            className="btn py-2.5 px-4 rounded-3 d-inline-flex align-items-center gap-2 fw-semibold shadow"
                            style={{ 
                                fontSize: '13px', 
                                backgroundColor: '#32c5d2', 
                                borderColor: '#32c5d2', 
                                color: '#fff' 
                            }}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Refresh Telemetry
                        </button>
                    </div>
                </div>
            </div>

            {/* Metrics cards - Progress rings and stats */}
            <div className="row g-4 mb-4">
                <div className="col-xl-3 col-md-6">
                    <div className="card border-0 rounded-4 shadow-sm h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <div className="card-body p-4 d-flex align-items-center justify-content-between">
                            <div>
                                <span className="text-muted text-uppercase fw-bold tracking-wider mb-2 d-block" style={{ fontSize: '10.5px', letterSpacing: '0.5px' }}>Delivery Success</span>
                                <div className="h2 fw-bold text-dark mb-1">{successRate}%</div>
                                <span className="text-muted fw-semibold" style={{ fontSize: '10px' }}>SMTP relay stability</span>
                            </div>
                            {/* Ring meter preview */}
                            <div className="position-relative d-flex align-items-center justify-content-center" style={{ width: '56px', height: '56px' }}>
                                <svg className="w-100 h-100" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                                    <path strokeWidth="3" stroke="#f1f5f9" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path strokeWidth="3.5" strokeDasharray={`${successRate}, 100`} strokeLinecap="round" stroke={successRate > 80 ? '#32c5d2' : '#f59e0b'} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <span className="position-absolute fw-bold text-dark" style={{ fontSize: '10px' }}>{successRate}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-xl-3 col-md-6">
                    <div className="card border-0 rounded-4 shadow-sm h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <div className="card-body p-4">
                            <span className="text-muted text-uppercase fw-bold tracking-wider mb-2 d-block" style={{ fontSize: '10.5px', letterSpacing: '0.5px' }}>Total Packets</span>
                            <div className="h2 fw-bold text-dark mb-1">{totalCount}</div>
                            <span className="text-muted fw-semibold" style={{ fontSize: '10px' }}>Total system inquiries logs</span>
                        </div>
                    </div>
                </div>

                <div className="col-xl-3 col-md-6">
                    <div className="card border-0 rounded-4 shadow-sm h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <div className="card-body p-4">
                            <span className="text-muted text-uppercase fw-bold tracking-wider mb-2 d-block" style={{ fontSize: '10.5px', letterSpacing: '0.5px' }}>Sent Successfully</span>
                            <div className="h2 fw-bold text-success mb-1">{successCount}</div>
                            <span className="text-success-emphasis fw-semibold" style={{ fontSize: '10px' }}>Relayed packets confirmed</span>
                        </div>
                    </div>
                </div>

                <div className="col-xl-3 col-md-6">
                    <div className="card border-0 rounded-4 shadow-sm h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <div className="card-body p-4">
                            <span className="text-muted text-uppercase fw-bold tracking-wider mb-2 d-block" style={{ fontSize: '10.5px', letterSpacing: '0.5px' }}>Relay Failures</span>
                            <div className="h2 fw-bold text-danger mb-1">{failureCount}</div>
                            <span className="text-danger-emphasis fw-semibold" style={{ fontSize: '10px' }}>Errors & SMTP rejections</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar with Glass Look */}
            <div className="card p-3 border-0 rounded-4 shadow-sm mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid rgba(226,232,240,0.8)' }}>
                <div className="row g-3 align-items-center">
                    <div className="col-md-8 position-relative">
                        <div className="position-absolute top-50 start-0 translate-middle-y ps-3" style={{ pointerEvents: 'none' }}>
                            <Search size={18} className="text-muted" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Filter logs by recipient mailbox, gateway key, or subject..." 
                            className="form-control rounded-3 py-2"
                            style={{ 
                                paddingLeft: '2.5rem',
                                fontSize: '14px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#f8fafc' 
                            }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="col-md-4 d-flex align-items-center gap-2">
                        <Filter size={16} className="text-muted d-none d-md-block" />
                        <select 
                            className="form-select rounded-3 py-2 fw-semibold text-muted"
                            style={{ 
                                fontSize: '13px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#f8fafc',
                                flex: 1
                            }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Transmissions</option>
                            <option value="success">Success [Sent]</option>
                            <option value="failed">Failures [SMTP Error]</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="card border-0 rounded-4 shadow-sm overflow-hidden mb-4" style={{ border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 text-left">
                        <thead className="table-light">
                            <tr style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <th className="px-4 py-3 fw-bold text-muted" style={{ width: '150px' }}>Transceiver Status</th>
                                <th className="px-4 py-3 fw-bold text-muted">Recipient Mailbox</th>
                                <th className="px-4 py-3 fw-bold text-muted" style={{ width: '180px' }}>Service Gateway Key</th>
                                <th className="px-4 py-3 fw-bold text-muted">Subject Blueprint</th>
                                <th className="px-4 py-3 fw-bold text-muted" style={{ width: '180px' }}>Sent Timestamp</th>
                                <th className="px-4 py-3 fw-bold text-muted text-end" style={{ width: '100px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-5">
                                        <div className="d-flex flex-column align-items-center gap-2">
                                            <div className="spinner-border text-info" role="status" style={{ width: '2rem', height: '2rem' }}>
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                            <div className="text-muted small">Fetching real-time transmission telemetry...</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-5">
                                        <div className="d-flex flex-column align-items-center gap-2 max-w-sm mx-auto text-muted">
                                            <div className="p-3 bg-light rounded-circle mb-2">
                                                <History size={32} />
                                            </div>
                                            <div className="fw-bold text-dark">No Telemetry Recorded</div>
                                            <div className="small">We couldn't find any email transmission logs matching your queries.</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map(log => (
                                <tr 
                                    key={log.id} 
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleSelectLog(log)}
                                >
                                    <td className="px-4 py-3">
                                        {log.status === 'success' ? (
                                            <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-3 py-1.5 fw-bold text-uppercase" style={{ fontSize: '9px', letterSpacing: '0.5px' }}>
                                                <span className="d-inline-block rounded-circle bg-success me-1.5" style={{ width: '6px', height: '6px' }}></span>
                                                Sent
                                            </span>
                                        ) : (
                                            <span className="badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle px-3 py-1.5 fw-bold text-uppercase" style={{ fontSize: '9px', letterSpacing: '0.5px' }}>
                                                <span className="d-inline-block rounded-circle bg-danger me-1.5 animate-ping" style={{ width: '6px', height: '6px' }}></span>
                                                Failed
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 fw-bold text-dark" style={{ fontSize: '13.5px' }}>{log.recipient_email}</td>
                                    <td className="px-4 py-3">
                                        <span className="badge font-monospace bg-info-subtle text-info border border-info-subtle px-2 py-1" style={{ fontSize: '10px' }}>
                                            {log.service_key}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="fw-semibold text-truncate text-secondary" style={{ maxWidth: '280px', fontSize: '13.5px' }}>{log.email_subject || 'No Subject'}</div>
                                    </td>
                                    <td className="px-4 py-3 text-secondary" style={{ fontSize: '12px' }}>
                                        <div className="d-flex align-items-center gap-1">
                                            <Clock size={12} className="text-muted" />
                                            {new Date(log.sent_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-end">
                                        <button 
                                            className="btn btn-sm btn-light text-info fw-bold d-inline-flex align-items-center gap-1 rounded-3 px-2.5 py-1.5"
                                            style={{ fontSize: '11px', border: '1px solid rgba(54, 193, 207, 0.1)', backgroundColor: 'rgba(54, 193, 207, 0.05)' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectLog(log);
                                            }}
                                        >
                                            Inspect <ChevronRight size={12} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Slide-Over Overlay Telemetry Inspector Drawer */}
            {selectedLog && (
                <div 
                    className="position-fixed top-0 start-0 w-100 h-100 animate-fade-in" 
                    style={{ zIndex: 1050, overflow: 'hidden' }}
                >
                    {/* Drawer Backdrop blur */}
                    <div 
                        className="position-absolute top-0 start-0 w-100 h-100"
                        style={{ 
                            backgroundColor: 'rgba(15, 23, 42, 0.6)', 
                            backdropFilter: 'blur(4px)', 
                            transition: 'opacity 0.3s ease-in-out' 
                        }}
                        onClick={() => setSelectedLog(null)}
                    />
                    
                    {/* Drawer body container */}
                    <div 
                        className="position-absolute top-0 end-0 h-100 bg-white border-start shadow-lg d-flex flex-col justify-content-between animate-slide-in-right"
                        style={{ 
                            width: '100%',
                            maxWidth: '440px',
                            borderLeft: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        {/* Drawer Header */}
                        <div className="p-4 bg-light border-bottom d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-2">
                                <Cpu className="text-info animate-pulse" size={20} />
                                <div>
                                    <h3 className="m-0 text-uppercase fw-bold text-dark" style={{ fontSize: '12px', letterSpacing: '1px' }}>Inspector Diagnostics</h3>
                                    <span className="font-monospace text-muted small" style={{ fontSize: '10px' }}>LOG-NODE #00{selectedLog.id}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedLog(null)}
                                className="btn btn-link p-1 text-muted hover-text-dark"
                                style={{ textDecoration: 'none' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Body Scrollable Content */}
                        <div className="flex-grow-1 overflow-y-auto p-4" style={{ height: 'calc(100vh - 150px)', overflowY: 'auto' }}>
                            {/* Telemetry Badge */}
                            <div className="mb-4">
                                <span className="text-muted text-uppercase fw-bold tracking-wider mb-2 d-block" style={{ fontSize: '10.5px' }}>Relay Node Status</span>
                                {selectedLog.status === 'success' ? (
                                    <div className="bg-success-subtle border border-success-subtle rounded-3 p-3 d-flex align-items-center gap-3 text-success">
                                        <div className="p-2 bg-success text-white rounded-3 d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div>
                                            <div className="text-xs fw-bold text-uppercase">Dispatched Successfully</div>
                                            <p className="mb-0 text-success" style={{ fontSize: '10px', opacity: 0.85 }}>Relayed packets resolved by remote SMTP server without errors.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-danger-subtle border border-danger-subtle rounded-3 p-3 d-flex align-items-center gap-3 text-danger animate-pulse">
                                        <div className="p-2 bg-danger text-white rounded-3 d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div>
                                            <div className="text-xs fw-bold text-uppercase">SMTP Transmission Failed</div>
                                            <p className="mb-0 text-danger" style={{ fontSize: '10px', opacity: 0.85 }}>Socket failed or remote relay server blocked payload packet.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Metadata Cards */}
                            <div className="mb-4">
                                <h4 className="text-muted text-uppercase fw-bold tracking-wider border-bottom pb-2 mb-3" style={{ fontSize: '10.5px' }}>Telemetry Parameters</h4>
                                
                                <div className="d-flex flex-column gap-3">
                                    <div className="p-3 bg-light rounded-3 border">
                                        <span className="text-muted text-uppercase fw-bold mb-1 d-block" style={{ fontSize: '9px' }}>RECIPIENT BOX</span>
                                        <div className="text-xs fw-bold text-dark d-flex align-items-center gap-2">
                                            <Mail size={12} className="text-muted" />
                                            {selectedLog.recipient_email}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-light rounded-3 border">
                                        <span className="text-muted text-uppercase fw-bold mb-1 d-block" style={{ fontSize: '9px' }}>SERVICE KEY ROUTE</span>
                                        <div className="text-xs font-monospace fw-bold text-info">
                                            {selectedLog.service_key}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-light rounded-3 border">
                                        <span className="text-muted text-uppercase fw-bold mb-1 d-block" style={{ fontSize: '9px' }}>SUBJECT ENVELOPE</span>
                                        <div className="text-xs fw-semibold text-dark leading-relaxed">
                                            {selectedLog.email_subject || 'No Subject Line'}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-light rounded-3 border">
                                        <span className="text-muted text-uppercase fw-bold mb-1 d-block" style={{ fontSize: '9px' }}>TELEMETRY TIMESTAMP</span>
                                        <div className="text-xs fw-semibold text-dark d-flex align-items-center gap-2">
                                            <Clock size={12} className="text-muted" />
                                            {new Date(selectedLog.sent_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Failure Stack / Diagnostics */}
                            {selectedLog.status === 'failed' && (
                                <div className="mb-4">
                                    <h4 className="text-danger text-uppercase fw-bold mb-2" style={{ fontSize: '10.5px' }}>Relay Terminal Failure Stack</h4>
                                    <div className="p-3 bg-dark rounded-3 text-danger font-monospace" style={{ fontSize: '11px', border: '1px solid rgba(220, 53, 69, 0.2)', minHeight: '100px', whiteSpace: 'pre-wrap' }}>
                                        <div className="text-danger-emphasis fw-bold text-uppercase mb-2" style={{ fontSize: '9px' }}>SYSTEM.SMTP_RELAY_ERROR_STACK:</div>
                                        {selectedLog.error_message || 'SMTP Socket reset unexpectedly.'}
                                    </div>
                                </div>
                            )}

                            {/* Interactive JSON Variables customizer */}
                            <div className="mb-4">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <h4 className="text-muted text-uppercase fw-bold m-0" style={{ fontSize: '10.5px' }}>Re-Delivery Variables (JSON)</h4>
                                    <span className="badge bg-info-subtle text-info text-uppercase font-monospace" style={{ fontSize: '8px' }}>Payload Editor</span>
                                </div>
                                <p className="text-muted mb-2" style={{ fontSize: '10.5px' }}>Modify the Handlebars injection values to patch recipient errors before executing resend.</p>
                                
                                <textarea 
                                    className="form-control font-monospace p-3 rounded-3 text-info"
                                    style={{ 
                                        height: '140px', 
                                        fontSize: '12px', 
                                        backgroundColor: '#0f172a', 
                                        borderColor: '#1e293b',
                                        color: '#32c5d2 !important'
                                    }}
                                    value={resendVariables}
                                    onChange={e => setResendVariables(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Drawer Footer Actions */}
                        <div className="p-4 bg-light border-top mt-auto">
                            <button
                                onClick={handleResend}
                                disabled={resending}
                                className="btn w-100 py-3 text-white fw-bold d-flex align-items-center justify-content-center gap-2 rounded-3 shadow"
                                style={{ 
                                    background: 'linear-gradient(135deg, #32c5d2 0%, #2563eb 100%)',
                                    border: 'none',
                                    fontSize: '13px'
                                }}
                            >
                                {resending ? (
                                    <>
                                        <RefreshCw size={15} className="animate-spin" />
                                        Re-Routing Transaction Payload...
                                    </>
                                ) : (
                                    <>
                                        <Send size={15} />
                                        Re-dispatch SMTP Packet
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
