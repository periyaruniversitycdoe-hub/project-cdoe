import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchServiceById, createEmailService, updateEmailService, sendTestEmail } from '../services/emailService.api';
import { ArrowLeft, Save, Code, FileText, Send, Info, Eye, Monitor, Smartphone, Sparkles, RefreshCw, FileCode } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function EditEmailServicePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;
    const textareaRef = useRef(null);

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [previewDevice, setPreviewDevice] = useState('desktop'); // desktop | mobile

    const [form, setForm] = useState({
        service_key: '',
        service_name: '',
        email_subject: '',
        email_template: '',
        is_active: true
    });

    useEffect(() => {
        if (isEdit) {
            fetchServiceById(id)
                .then(res => setForm(res.data.data))
                .catch(() => toast.error('Failed to load email service configuration'))
                .finally(() => setLoading(false));
        }
    }, [id, isEdit]);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            if (isEdit) await updateEmailService(id, form);
            else await createEmailService(form);
            toast.success(`Gateway configuration ${isEdit ? 'updated' : 'deployed'} successfully`);
            navigate('/email-services');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!testEmail) return toast.error('Please enter a valid recipient email address');
        setTesting(true);
        try {
            await sendTestEmail({
                serviceKey: form.service_key,
                to: testEmail,
                variables: { 
                    name: 'Prof. Majeed Khan', 
                    student_name: 'Test Candidate', 
                    application_no: 'PHD-2026-TEST-8942',
                    department: 'Computer Science',
                    supervisor_name: 'Dr. Sarah Connor',
                    otp: '739410'
                }
            });
            toast.success('Live test email dispatched successfully! Please check inbox.');
        } catch (err) {
            toast.error('Test dispatch failed: ' + (err.response?.data?.error || 'SMTP server error'));
        } finally {
            setTesting(false);
        }
    };

    const insertVariable = (variableName) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = form.email_template || '';
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);
        const insertValue = `{{${variableName}}}`;
        const newValue = before + insertValue + after;

        setForm({ ...form, email_template: newValue });

        // Restore focus & position cursor inside/after tag
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + insertValue.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 50);
    };

    // Live Handlebars Sandbox Compiler for the simulated preview client
    const compilePreview = () => {
        let bodyHtml = form.email_template || '';
        let compiledSubject = form.email_subject || '';

        const mockVars = {
            name: 'Prof. Majeed Khan',
            student_name: 'Majeed Khan',
            application_no: 'PHD-2026-8942',
            supervisor_name: 'Dr. Sarah Connor',
            department: 'Computer Science & Engineering',
            otp: '482910',
            status: 'Approved',
            interview_date: 'June 15, 2026',
            interview_time: '10:00 AM IST',
            venue: 'Seminar Hall, Periyar University campus',
            rejection_reason: 'None. Candidate met all academic requirements.'
        };

        // Standard regex variable substitution
        Object.keys(mockVars).forEach(key => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            bodyHtml = bodyHtml.replace(regex, mockVars[key]);
            compiledSubject = compiledSubject.replace(regex, mockVars[key]);
        });

        // Ensure default styles if template is naked
        if (!bodyHtml.includes('<body') && !bodyHtml.includes('<html')) {
            bodyHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                            line-height: 1.6;
                            color: #334155;
                            background-color: #f8fafc;
                            margin: 0;
                            padding: 20px;
                        }
                        .email-container {
                            max-width: 600px;
                            margin: 0 auto;
                            background-color: #ffffff;
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 25px;
                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                        }
                        a { color: #0284c7; text-decoration: none; font-weight: 500; }
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        ${bodyHtml || '<p style="color: #94a3b8; font-style: italic; font-size: 13px;">Your HTML template render output will display here in real-time...</p>'}
                    </div>
                </body>
                </html>
            `;
        }

        return { html: bodyHtml, subject: compiledSubject };
    };

    const compiled = compilePreview();

    const helperVariables = [
        { key: 'name', label: 'Sender/Staff Name' },
        { key: 'student_name', label: 'Student Name' },
        { key: 'application_no', label: 'Application ID' },
        { key: 'supervisor_name', label: 'Supervisor Name' },
        { key: 'department', label: 'Department Name' },
        { key: 'otp', label: 'Auth Token / OTP' },
        { key: 'interview_date', label: 'Interview Date' },
        { key: 'interview_time', label: 'Interview Time' },
        { key: 'venue', label: 'Venue Location' }
    ];

    if (loading) {
        return (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 min-vh-50 gap-3">
                <div className="spinner-border text-info" role="status" style={{ width: '2.5rem', height: '2.5rem' }}></div>
                <div className="text-muted font-bold small animate-pulse">Loading Studio Environment...</div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4 animate-fade-in" style={{ maxWidth: '1300px' }}>
            {/* Header / Nav */}
            <div className="card border-0 shadow-sm p-4 mb-4" style={{ borderRadius: '16px', border: '1px solid #eef2f5' }}>
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
                    <div className="d-flex align-items-center gap-3">
                        <button 
                            onClick={() => navigate('/email-services')} 
                            className="btn btn-light p-2.5 rounded-3 d-flex align-items-center justify-content-center border"
                            title="Back to Gateways"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 className="h4 fw-bold text-dark mb-1 tracking-tight">
                                {isEdit ? 'Template Blueprint Studio' : 'Build Communication Gateway'}
                            </h1>
                            <p className="text-muted mb-0" style={{ fontSize: '12px' }}>
                                {form.service_name ? `Editing: ${form.service_name}` : 'Setup high-fidelity transactional notification node.'}
                            </p>
                        </div>
                    </div>

                    <div>
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="btn py-2.5 px-4 rounded-3 d-flex align-items-center gap-2 fw-bold shadow-sm"
                            style={{ 
                                fontSize: '13px', 
                                backgroundColor: '#32c5d2', 
                                borderColor: '#32c5d2', 
                                color: '#fff',
                                transition: 'all 0.15s'
                            }}
                        >
                            <Save size={16} />
                            {saving ? 'Deploying Changes...' : 'Deploy Blueprint'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="row g-4">
                {/* Left Side: The Form and HTML Editor */}
                <div className="col-lg-7">
                    <div className="space-y-4">
                        
                        {/* Gateway Details Card */}
                        <div className="card border-0 shadow-sm p-4 mb-4" style={{ borderRadius: '20px', border: '1px solid #eef2f5' }}>
                            <h3 className="h6 fw-bold text-dark uppercase tracking-wider border-bottom pb-3 mb-4" style={{ letterSpacing: '0.5px' }}>Gateway Identifiers</h3>
                            
                            <div className="row g-3 mb-4">
                                <div className="col-md-6">
                                    <label className="form-label text-uppercase fw-bold text-secondary mb-2" style={{ fontSize: '10.5px', letterSpacing: '0.5px' }}>Service Gateway Title</label>
                                    <input 
                                        required
                                        type="text" 
                                        className="form-control py-2.5 px-3"
                                        style={{ borderRadius: '10px', fontSize: '13.5px', fontWeight: '500' }}
                                        placeholder="e.g. Application Fee Paid"
                                        value={form.service_name}
                                        onChange={e => setForm({...form, service_name: e.target.value})}
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-uppercase fw-bold text-secondary mb-2" style={{ fontSize: '10.5px', letterSpacing: '0.5px' }}>Unique Gateway System Key</label>
                                    <input 
                                        required
                                        disabled={isEdit}
                                        type="text" 
                                        className="form-control py-2.5 px-3 font-mono fw-bold"
                                        style={{ 
                                            borderRadius: '10px', 
                                            fontSize: '13.5px',
                                            backgroundColor: isEdit ? '#f8fafc' : '#fff'
                                        }}
                                        placeholder="e.g. application_fee_paid"
                                        value={form.service_key}
                                        onChange={e => setForm({...form, service_key: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                                    />
                                    <p className="text-muted mt-1 mb-0" style={{ fontSize: '10px' }}>Immutable route parameter in transactional dispatch controllers.</p>
                                </div>
                            </div>

                            <div className="mb-2">
                                <label className="form-label text-uppercase fw-bold text-secondary mb-2" style={{ fontSize: '10.5px', letterSpacing: '0.5px' }}>Email Subject Line Header</label>
                                <input 
                                    required
                                    type="text" 
                                    className="form-control py-2.5 px-3"
                                    style={{ borderRadius: '10px', fontSize: '13.5px', fontWeight: '500' }}
                                    placeholder="e.g. Dear {{student_name}}, your admission application is processed"
                                    value={form.email_subject}
                                    onChange={e => setForm({...form, email_subject: e.target.value})}
                                />
                            </div>
                        </div>

                        {/* Custom Styled IDE Editor Pane */}
                        <div className="card border-0 shadow-lg overflow-hidden mb-4" style={{ borderRadius: '20px', backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
                            {/* Editor Top Bar Mock Tabs */}
                            <div className="px-4 py-3 d-flex align-items-center justify-content-between border-bottom" style={{ backgroundColor: '#1e293b', borderColor: '#0f172a' }}>
                                <div className="d-flex align-items-center gap-3">
                                    {/* OS Window Dot buttons */}
                                    <div className="d-flex align-items-center gap-1.5">
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308' }}></div>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
                                    </div>
                                    <div className="vr bg-secondary my-1 mx-2" style={{ opacity: 0.3, width: '1px' }}></div>
                                    <div className="d-flex align-items-center gap-1.5 px-3 py-1 text-info rounded-3" style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <FileCode size={13} className="text-info" />
                                        email_template.html
                                        <span className="badge bg-secondary font-sans text-uppercase px-1.5 py-0.5 rounded" style={{ fontSize: '8px', color: '#cbd5e1' }}>HBS</span>
                                    </div>
                                </div>
                                <div className="text-secondary font-mono" style={{ fontSize: '10px', fontWeight: '700' }}>
                                    UTF-8 • Sandbox Editor
                                </div>
                            </div>

                            {/* Textarea IDE Editor Body */}
                            <div className="d-flex position-relative">
                                {/* Simulated Line Numbers gutter */}
                                <div 
                                    className="d-none d-md-block text-secondary px-3 py-4 text-end border-end select-none font-mono" 
                                    style={{ 
                                        fontSize: '11px', 
                                        backgroundColor: '#1e293b', 
                                        borderColor: '#0f172a',
                                        width: '45px',
                                        lineHeight: '24px'
                                    }}
                                >
                                    {Array.from({ length: 15 }).map((_, i) => (
                                        <div key={i}>{i + 1}</div>
                                    ))}
                                </div>
                                <textarea 
                                    id="template-textarea"
                                    ref={textareaRef}
                                    required
                                    className="form-control bg-transparent border-0 text-info font-mono py-4 px-4 shadow-none w-100"
                                    style={{ 
                                        height: '380px', 
                                        color: '#38bdf8', 
                                        fontSize: '13px', 
                                        lineHeight: '24px',
                                        resize: 'none',
                                        outline: 'none',
                                        caretColor: '#38bdf8'
                                    }}
                                    placeholder="<!-- Enter HTML Template Body -->&#10;<div class='header'>&#10;  <h1>Welcome {{student_name}}</h1>&#10;</div>&#10;<p>We are pleased to inform you that your application {{application_no}} is ready...</p>"
                                    value={form.email_template}
                                    onChange={e => setForm({...form, email_template: e.target.value})}
                                />
                            </div>

                            {/* Editor Status / Info Footer */}
                            <div className="px-4 py-2.5 d-flex align-items-center justify-content-between border-top text-secondary font-mono" style={{ fontSize: '10px', backgroundColor: '#1e293b', borderColor: '#0f172a' }}>
                                <div className="d-flex align-items-center gap-1.5">
                                    <Info size={12} className="text-info" />
                                    <span>Variables supported inside HTML tags</span>
                                </div>
                                <div>
                                    <span>Lines: {form.email_template ? form.email_template.split('\n').length : 0} • Size: {form.email_template ? new Blob([form.email_template]).size : 0} B</span>
                                </div>
                            </div>
                        </div>

                        {/* Interactive iOS status Toggle */}
                        <div className="card border-0 shadow-sm p-4" style={{ borderRadius: '20px', border: '1px solid #eef2f5' }}>
                            <div className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="p-2.5 rounded-3 text-info" style={{ backgroundColor: '#f0f7ff' }}>
                                        <Sparkles size={18} />
                                    </div>
                                    <div>
                                        <h4 className="h6 fw-bold text-dark mb-0">Deployment Gateway Status</h4>
                                        <p className="text-muted mb-0 small" style={{ fontSize: '11px' }}>Toggle status of SMTP delivery client</p>
                                    </div>
                                </div>
                                
                                <label className="d-flex align-items-center gap-3 cursor-pointer">
                                    <div 
                                        onClick={() => setForm({...form, is_active: !form.is_active})}
                                        style={{
                                            position: 'relative',
                                            width: '46px',
                                            height: '24px',
                                            backgroundColor: form.is_active ? '#32c5d2' : '#dee2e6',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease-in-out',
                                            display: 'inline-block'
                                        }}
                                    >
                                        <span 
                                            style={{
                                                position: 'absolute',
                                                top: '2px',
                                                left: form.is_active ? '24px' : '2px',
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                backgroundColor: '#ffffff',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                                transition: 'all 0.2s ease-in-out'
                                            }}
                                        />
                                    </div>
                                    <span className="fw-bold text-uppercase" style={{ fontSize: '10px', color: form.is_active ? '#1fa2b0' : '#8e9aa8', width: '50px' }}>
                                        {form.is_active ? 'Online' : 'Standby'}
                                    </span>
                                </label>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Right Side: Interactive Client Previewer Frame & Developer Sidebar */}
                <div className="col-lg-5">
                    <div className="space-y-4">
                        
                        {/* Device Switcher Header and Preview */}
                        <div className="card border-0 shadow-lg overflow-hidden mb-4" style={{ borderRadius: '20px', backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
                            <div className="p-3 d-flex align-items-center justify-content-between border-bottom" style={{ backgroundColor: '#1e293b', borderColor: '#0f172a' }}>
                                <h4 className="h6 fw-bold text-light uppercase mb-0 d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>
                                    <Eye size={14} className="text-info" />
                                    Real-Time Client Preview
                                </h4>
                                
                                <div className="d-flex align-items-center gap-1 p-1 rounded-3" style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewDevice('desktop')}
                                        className="btn btn-sm d-flex align-items-center gap-1 fw-bold text-uppercase rounded-2 border-0 px-3 py-1"
                                        style={{ 
                                            fontSize: '9.5px', 
                                            color: previewDevice === 'desktop' ? '#fff' : '#94a3b8',
                                            backgroundColor: previewDevice === 'desktop' ? '#32c5d2' : 'transparent',
                                            boxShadow: previewDevice === 'desktop' ? '0 2px 4px rgba(50, 197, 210, 0.15)' : 'none',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        <Monitor size={11} />
                                        Desktop
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewDevice('mobile')}
                                        className="btn btn-sm d-flex align-items-center gap-1 fw-bold text-uppercase rounded-2 border-0 px-3 py-1"
                                        style={{ 
                                            fontSize: '9.5px', 
                                            color: previewDevice === 'mobile' ? '#fff' : '#94a3b8',
                                            backgroundColor: previewDevice === 'mobile' ? '#32c5d2' : 'transparent',
                                            boxShadow: previewDevice === 'mobile' ? '0 2px 4px rgba(50, 197, 210, 0.15)' : 'none',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        <Smartphone size={11} />
                                        Mobile
                                    </button>
                                </div>
                            </div>

                            {/* Simulated Device Body Client Frames */}
                            <div className="p-4 d-flex align-items-center justify-content-center border-bottom" style={{ backgroundColor: '#020617', minHeight: '440px', borderColor: '#0f172a' }}>
                                {previewDevice === 'desktop' ? (
                                    /* simulated desktop mail application */
                                    <div className="w-100 bg-white rounded-4 shadow overflow-hidden border d-flex flex-column text-dark" style={{ border: '1px solid #dee2e6' }}>
                                        {/* Desktop Frame Header */}
                                        <div className="bg-light border-bottom px-4 py-3 select-none" style={{ fontSize: '11px', borderBottom: '1px solid #dee2e6' }}>
                                            <div className="d-flex align-items-center gap-2 text-muted fw-semibold mb-1">
                                                <span style={{ width: '60px' }}>Sender:</span>
                                                <span className="text-dark fw-bold bg-secondary bg-opacity-10 px-2 py-0.5 rounded">
                                                    Periyar University Admissions &lt;admissions@periyar.edu&gt;
                                                </span>
                                            </div>
                                            <div className="d-flex align-items-center gap-2 text-muted fw-semibold mb-1">
                                                <span style={{ width: '60px' }}>Recipient:</span>
                                                <span className="text-secondary">candidate@domain.com</span>
                                            </div>
                                            <div className="d-flex align-items-center gap-2 text-muted fw-semibold">
                                                <span style={{ width: '60px' }}>Subject:</span>
                                                <span className="text-primary fw-bold">
                                                    {compiled.subject || '(Subject line placeholder)'}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Isolated client frame sandbox iframe */}
                                        <iframe 
                                            title="Desktop Client Sandbox"
                                            srcDoc={compiled.html}
                                            style={{ width: '100%', height: '340px', border: 'none', backgroundColor: '#f8fafc' }}
                                            sandbox="allow-same-origin"
                                        />
                                    </div>
                                ) : (
                                    /* simulated elegant mobile smartphone viewport */
                                    <div 
                                        className="d-flex flex-column text-dark shadow" 
                                        style={{ 
                                            width: '260px', 
                                            height: '460px', 
                                            border: '10px solid #1e293b', 
                                            borderRadius: '35px', 
                                            overflow: 'hidden', 
                                            backgroundColor: '#fff',
                                            boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
                                        }}
                                    >
                                        {/* Phone Camera Notch */}
                                        <div className="bg-slate-800 flex items-center justify-center relative" style={{ height: '20px', backgroundColor: '#1e293b' }}>
                                            <div style={{ width: '70px', height: '12px', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', backgroundColor: '#0f172a', position: 'absolute', top: 0 }}></div>
                                        </div>
                                        {/* Mobile Header card */}
                                        <div className="bg-light border-bottom px-3 py-2 select-none" style={{ fontSize: '9px', borderBottom: '1px solid #dee2e6' }}>
                                            <div className="fw-bold text-muted">PU Admissions Portal</div>
                                            <div className="fw-extrabold text-dark" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {compiled.subject || 'Subject line...'}
                                            </div>
                                        </div>
                                        {/* Sandbox Mobile Render Frame */}
                                        <iframe 
                                            title="Mobile Client Sandbox"
                                            srcDoc={compiled.html}
                                            style={{ width: '100%', flexGrow: 1, border: 'none', backgroundColor: '#f8fafc' }}
                                            sandbox="allow-same-origin"
                                        />
                                        {/* Home Indicator Button bar */}
                                        <div className="bg-light d-flex align-items-center justify-content-center" style={{ height: '14px' }}>
                                            <div style={{ width: '70px', height: '3px', backgroundColor: '#cbd5e1', borderRadius: '1.5px' }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tech Badge Variable Injector */}
                        <div className="card border-0 shadow-sm p-4 mb-4" style={{ borderRadius: '20px', border: '1px solid #eef2f5' }}>
                            <h4 className="h6 fw-bold text-secondary uppercase tracking-wider mb-2" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                <Code size={14} className="text-info me-1" />
                                Dynamic Variable Hub
                            </h4>
                            <p className="text-muted small mb-3" style={{ fontSize: '11px' }}>
                                Click any badge to insert its Handlebars hook at your active cursor position.
                            </p>
                            
                            <div className="d-flex flex-wrap gap-2">
                                {helperVariables.map(v => (
                                    <button
                                        key={v.key}
                                        type="button"
                                        onClick={() => insertVariable(v.key)}
                                        className="btn btn-light py-1.5 px-2.5 rounded-3 d-flex align-items-center gap-1.5 border"
                                        style={{ 
                                            fontSize: '10px', 
                                            fontFamily: 'monospace', 
                                            fontWeight: '700',
                                            transition: 'all 0.15s'
                                        }}
                                        title={v.label}
                                    >
                                        <span className="text-info">{`{{${v.key}}}`}</span>
                                        <span className="text-muted font-sans fw-semibold" style={{ fontSize: '8.5px', opacity: 0.6 }}>+{v.key}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Instant SMTP Dispatch Testing */}
                        {isEdit && (
                            <div 
                                className="card border-0 p-4 shadow text-white" 
                                style={{ 
                                    borderRadius: '20px', 
                                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                    border: '1px solid rgba(255,255,255,0.08)'
                                }}
                            >
                                <h4 className="h6 fw-bold text-info uppercase tracking-wider mb-3 d-flex align-items-center gap-2">
                                    <Send size={14} />
                                    Instant Live SMTP Dispatch
                                </h4>
                                <p className="text-muted small mb-3" style={{ color: '#94a3b8 !important', fontSize: '11px' }}>
                                    Verify live Handlebars execution and email layout by routing a test packet directly to an active mailbox.
                                </p>
                                
                                <div className="d-grid gap-2">
                                    <input 
                                        type="email" 
                                        placeholder="Enter test recipient mailbox..." 
                                        className="form-control border-0 py-2 px-3 text-light"
                                        style={{ 
                                            fontSize: '12px', 
                                            fontWeight: '500',
                                            backgroundColor: '#0f172a',
                                            borderRadius: '10px',
                                            border: '1px solid #1e293b'
                                        }}
                                        value={testEmail}
                                        onChange={e => setTestEmail(e.target.value)}
                                    />
                                    <button 
                                        type="button"
                                        onClick={handleTest}
                                        disabled={testing}
                                        className="btn py-2.5 rounded-3 fw-bold text-light d-flex align-items-center justify-content-center gap-2 shadow"
                                        style={{ 
                                            fontSize: '12px', 
                                            background: 'linear-gradient(to right, #32c5d2, #3b82f6)',
                                            borderColor: '#32c5d2',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        {testing ? (
                                            <>
                                                <RefreshCw size={13} className="animate-spin" />
                                                Dispatching Test Mail...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={13} />
                                                Dispatch Live Packet
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
