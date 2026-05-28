import React, { useEffect, useState } from 'react';
import { fetchServices, deleteEmailService, toggleService } from '../services/emailService.api';
import { Mail, History, Search, ShieldCheck, ShieldAlert, Sparkles, Server, RotateCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function EmailServicesPage() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');


    const loadData = async () => {
        try {
            const res = await fetchServices();
            setServices(res.data.data || []);
        } catch (err) {
            toast.error('Failed to load email services');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        try {
            const res = await fetchServices();
            setServices(res.data.data || []);
            toast.success('Service gateways updated successfully');
        } catch (err) {
            toast.error('Failed to refresh email services');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this service configuration?')) return;
        try {
            await deleteEmailService(id);
            setServices(services.filter(s => s.id !== id));
            toast.success('Service configuration deleted successfully');
        } catch (err) {
            toast.error('Failed to delete service configuration');
        }
    };

    const handleToggle = async (id, currentStatus) => {
        try {
            await toggleService(id, !currentStatus);
            setServices(services.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s));
            toast.success(`Service successfully ${!currentStatus ? 'enabled' : 'disabled'}`);
        } catch (err) {
            toast.error('Failed to update service status');
        }
    };

    const filtered = services.filter(s => 
        (s.service_name || '').toLowerCase().includes(search.toLowerCase()) || 
        (s.service_key || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="container-fluid py-4 animate-fade-in" style={{ maxWidth: '1300px' }}>
            <style>{`
                @keyframes spin-custom {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .animate-spin-custom {
                    animation: spin-custom 0.8s linear infinite;
                }
                .btn-delete-service {
                    background-color: rgba(220, 53, 69, 0.05);
                    border-color: rgba(220, 53, 69, 0.2);
                    color: #dc3545;
                    transition: all 0.2s ease-in-out;
                }
                .btn-delete-service:hover {
                    background-color: #dc3545 !important;
                    border-color: #dc3545 !important;
                    color: #ffffff !important;
                    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.35);
                }
            `}</style>

            {/* Premium Dark Banner Header */}
            <div
                className="p-5 mb-5 rounded-4 shadow-sm text-white position-relative overflow-hidden text-start"
                style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    border: '1px solid rgba(255,255,255,0.08)'
                }}
            >
                {/* Glowing orb */}
                <div style={{
                    position: 'absolute', top: '-50px', right: '-50px', width: '300px', height: '300px',
                    borderRadius: '50%', background: 'rgba(50, 197, 210, 0.08)', filter: 'blur(70px)', pointerEvents: 'none'
                }}></div>

                <div className="row align-items-center g-4 position-relative" style={{ zIndex: 2 }}>
                    <div className="col-md-8">
                        <div className="d-flex align-items-center gap-3">
                            <div className="p-3 rounded-3 flex-shrink-0" style={{ backgroundColor: 'rgba(50, 197, 210, 0.1)', border: '1px solid rgba(50, 197, 210, 0.2)', color: '#32c5d2' }}>
                                <Mail size={28} />
                            </div>
                            <div>
                                <h1 className="h3 fw-bold text-white mb-1 d-flex flex-wrap align-items-center gap-2">
                                    Email Service Gateways
                                    <span className="badge rounded-pill bg-info-subtle text-info border border-info-subtle" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>
                                        ENTERPRISE GRADE
                                    </span>
                                </h1>
                                <p className="mb-0" style={{ color: '#94a3b8', fontSize: '14px' }}>
                                    High-throughput SMTP communication nodes &amp; responsive university templates.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-4 d-flex flex-wrap justify-content-md-end gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="btn py-2 px-4 rounded-3 d-flex align-items-center gap-2 fw-bold text-white shadow-sm"
                            style={{
                                fontSize: '13px',
                                background: 'linear-gradient(135deg, #32c5d2 0%, #1da8b5 100%)',
                                border: 'none',
                                letterSpacing: '0.3px',
                                transition: 'all 0.2s ease-in-out',
                                opacity: loading ? 0.8 : 1
                            }}
                        >
                            <RotateCw size={14} className={loading ? 'animate-spin-custom' : ''} />
                            Refresh Gateways
                        </button>
                        <Link
                            to="/email-logs"
                            className="btn py-2 px-3.5 rounded-3 d-flex align-items-center gap-2 fw-semibold"
                            style={{
                                fontSize: '13px',
                                backgroundColor: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: '#cbd5e1'
                            }}
                        >
                            <History size={15} />
                            Audit Logs
                        </Link>
                    </div>
                </div>
            </div>


            {/* Metrics cards - Premium, Glassmorphic cards with responsive gauges */}
            <div className="row g-4 mb-5">
                <div className="col-md-4">
                    <div 
                        className="card h-100 border-0 p-4" 
                        style={{
                            backgroundColor: '#fff', 
                            borderRadius: '20px', 
                            boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                            border: '1px solid #eef2f5'
                        }}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="text-uppercase fw-bold text-muted mb-0" style={{ fontSize: '11px', letterSpacing: '1px' }}>Total Active Nodes</h5>
                            <div className="p-2 rounded-3 text-primary" style={{ backgroundColor: '#f0f7ff' }}>
                                <Server size={18} />
                            </div>
                        </div>
                        <div className="d-flex align-items-baseline gap-2 mb-2">
                            <div className="display-6 fw-bold text-dark">{services.length}</div>
                            <span className="text-muted small">SMTP profiles</span>
                        </div>
                        <div className="pt-3 border-top d-flex align-items-center gap-1.5 text-muted small" style={{ borderColor: '#f8fafc' }}>
                            <Sparkles size={13} className="text-primary" />
                            Dynamic handlebars templates active
                        </div>
                    </div>
                </div>

                <div className="col-md-4">
                    <div 
                        className="card h-100 border-0 p-4" 
                        style={{
                            backgroundColor: '#fff', 
                            borderRadius: '20px', 
                            boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                            border: '1px solid #eef2f5'
                        }}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="text-uppercase fw-bold text-muted mb-0" style={{ fontSize: '11px', letterSpacing: '1px' }}>Online / Running</h5>
                            <div className="p-2 rounded-3 text-success" style={{ backgroundColor: '#ecfdf5' }}>
                                <ShieldCheck size={18} />
                            </div>
                        </div>
                        <div className="d-flex align-items-baseline gap-2 mb-2">
                            <div className="display-6 fw-bold text-success">{services.filter(s => s.is_active).length}</div>
                            <span className="text-success small fw-semibold">Nodes operational</span>
                        </div>
                        {/* Custom Progress bar */}
                        <div className="pt-3 border-top d-flex align-items-center gap-3" style={{ borderColor: '#f8fafc' }}>
                            <div className="progress flex-grow-1" style={{ height: '6px', borderRadius: '3px' }}>
                                <div 
                                    className="progress-bar bg-success" 
                                    role="progressbar" 
                                    style={{ 
                                        width: services.length ? `${(services.filter(s => s.is_active).length / services.length) * 100}%` : '0%',
                                        borderRadius: '3px'
                                    }}
                                ></div>
                            </div>
                            <span className="small fw-bold text-muted" style={{ fontSize: '11px' }}>
                                {services.length ? Math.round((services.filter(s => s.is_active).length / services.length) * 100) : 0}%
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-md-4">
                    <div 
                        className="card h-100 border-0 p-4" 
                        style={{
                            backgroundColor: '#fff', 
                            borderRadius: '20px', 
                            boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                            border: '1px solid #eef2f5'
                        }}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="text-uppercase fw-bold text-muted mb-0" style={{ fontSize: '11px', letterSpacing: '1px' }}>Offline / Paused</h5>
                            <div className="p-2 rounded-3 text-warning" style={{ backgroundColor: '#fffbeb' }}>
                                <ShieldAlert size={18} />
                            </div>
                        </div>
                        <div className="d-flex align-items-baseline gap-2 mb-2">
                            <div className="display-6 fw-bold text-muted">{services.filter(s => !s.is_active).length}</div>
                            <span className="text-muted small">Nodes standby</span>
                        </div>
                        <div className="pt-3 border-top d-flex align-items-center gap-1.5 text-muted small" style={{ borderColor: '#f8fafc' }}>
                            <span className="d-inline-block rounded-circle bg-warning animate-pulse" style={{ width: '8px', height: '8px' }}></span>
                            Status transitions are non-destructive
                        </div>
                    </div>
                </div>
            </div>

            {/* Inventory Container */}
            <div className="card border-0 shadow-sm overflow-hidden" style={{ borderRadius: '20px', border: '1px solid #eef2f5' }}>
                {/* Search Bar section */}
                <div className="card-header bg-white p-4 border-0 d-flex flex-col flex-sm-row justify-content-between align-items-sm-center gap-3" style={{ backgroundColor: '#fafbfd' }}>
                    <div className="position-relative w-100" style={{ maxWidth: '450px' }}>
                        <Search className="position-absolute text-muted" size={18} style={{ left: '14px', top: '50%', transform: 'translateY(-50%)', zIndex: 5 }} />
                        <input 
                            type="text" 
                            placeholder="Filter by gateway name or unique key..." 
                            className="form-control"
                            style={{ 
                                paddingLeft: '42px', 
                                paddingRight: '15px', 
                                py: '10px',
                                borderRadius: '12px', 
                                backgroundColor: '#fff', 
                                border: '1px solid #dee2e6',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="badge border py-2 px-3 bg-white text-muted d-flex align-items-center gap-2 rounded-3" style={{ fontSize: '11px', fontWeight: '600' }}>
                        <span className="d-inline-block rounded-circle bg-info animate-ping" style={{ width: '6px', height: '6px' }}></span>
                        Showing {filtered.length} of {services.length} records
                    </div>
                </div>

                {/* Configurations Table */}
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr className="bg-light text-muted uppercase border-bottom" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                <th className="px-4 py-3 fw-bold text-secondary">Service Gateway Name / Key</th>
                                <th className="px-4 py-3 fw-bold text-secondary">Subject Blueprint</th>
                                <th className="px-4 py-3 fw-bold text-secondary text-center" style={{ width: '180px' }}>API Gateway Relay Status</th>
                                <th className="px-4 py-3 fw-bold text-secondary text-end" style={{ width: '220px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="text-center py-5">
                                        <div className="d-flex flex-column align-items-center justify-content-center gap-2">
                                            <div className="spinner-border text-info" role="status" style={{ width: '2rem', height: '2rem' }}></div>
                                            <div className="text-muted small fw-semibold">Fetching communication channels...</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="text-center py-5">
                                        <div className="d-flex flex-column align-items-center justify-content-center gap-2 py-4 text-muted">
                                            <Mail size={32} className="mb-2 text-muted" />
                                            <div className="fw-bold text-dark">No Matching Gateways</div>
                                            <div className="small text-muted">We couldn't find any email config keys matching "{search}".</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map(service => (
                                <tr key={service.id}>
                                    <td className="px-4 py-4">
                                        <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>{service.service_name}</div>
                                        <div className="mt-1">
                                            <span className="font-mono text-uppercase px-2.5 py-1 rounded fw-bold" style={{ fontSize: '9.5px', backgroundColor: 'rgba(50, 197, 210, 0.08)', color: '#1fa2b0', border: '1px solid rgba(50, 197, 210, 0.15)' }}>
                                                {service.service_key}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="fw-semibold text-secondary" style={{ fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '280px' }}>{service.email_subject}</div>
                                        <div className="small text-muted mt-1" style={{ fontSize: '11px' }}>
                                            Updated {new Date(service.updated_at).toLocaleDateString()} at {new Date(service.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="d-flex flex-column align-items-center justify-content-center gap-1">
                                            {/* iOS Sliding Custom Toggle Switch */}
                                            <div 
                                                onClick={() => handleToggle(service.id, service.is_active)}
                                                style={{
                                                    position: 'relative',
                                                    width: '44px',
                                                    height: '22px',
                                                    backgroundColor: service.is_active ? '#32c5d2' : '#dee2e6',
                                                    borderRadius: '11px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease-in-out',
                                                    display: 'inline-block'
                                                }}
                                            >
                                                <span 
                                                    style={{
                                                        position: 'absolute',
                                                        top: '2px',
                                                        left: service.is_active ? '24px' : '2px',
                                                        width: '18px',
                                                        height: '18px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#ffffff',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                                        transition: 'all 0.2s ease-in-out',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: service.is_active ? '#32c5d2' : '#adb5bd' }}></span>
                                                </span>
                                            </div>
                                            <span className="fw-bold text-uppercase" style={{ fontSize: '9px', letterSpacing: '0.5px', color: service.is_active ? '#1fa2b0' : '#8e9aa8' }}>
                                                {service.is_active ? 'Active' : 'Standby'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-end">
                                        <button 
                                            onClick={() => handleDelete(service.id)}
                                            className="btn btn-sm fw-bold border rounded-3 px-3 py-1.5 shadow-sm btn-delete-service"
                                            style={{ 
                                                fontSize: '11px',
                                                letterSpacing: '0.5px'
                                            }}
                                        >
                                            DELETE
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
