import React, { useState, useEffect } from 'react';
import { Mail, Plus, Loader2, AlertCircle, Search, RefreshCw, Layers, ShieldCheck, Check, Info, Trash2 } from 'lucide-react';
import { getTemplates, deleteTemplate, updateTemplate, addCustomCategory } from '../services/emailTemplate.api';
import { toast } from 'react-hot-toast';

const PLACEHOLDERS_MAP = {
    'welcome': ['studentName', 'applicationId', 'loginUrl', 'email'],
    'otp_verification': ['studentName', 'otp', 'expiresInMinutes'],
    'password_reset': ['studentName', 'resetUrl', 'expiresInHours'],
    'application_submitted': ['studentName', 'applicationId', 'department', 'submittedAt', 'portalUrl'],
    'application_approved': ['studentName', 'applicationId', 'department', 'message', 'actionUrl'],
    'application_rejected': ['studentName', 'applicationId', 'department', 'message', 'actionUrl'],
    'payment_confirmed': ['studentName', 'applicationId', 'transactionId', 'amount', 'actionUrl'],
    'hall_ticket': ['studentName', 'applicationId', 'department', 'actionUrl'],
    'interview_call': ['studentName', 'applicationId', 'department', 'actionUrl']
};

const EmailTemplateListPage = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Custom category input state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [addingCategory, setAddingCategory] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const res = await getTemplates();
            if (res.success) {
                setCategories(res.data);
            } else {
                toast.error('Failed to load categories');
            }
        } catch (err) {
            console.error('Fetch categories error:', err);
            toast.error(err.response?.data?.message || 'Failed to query communication database');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        const trimmed = newCategoryName.trim();
        if (!trimmed) {
            toast.error('Category name cannot be empty');
            return;
        }

        setAddingCategory(true);
        try {
            const res = await addCustomCategory(trimmed);
            if (res.success) {
                toast.success(`Category "${trimmed}" successfully added and automated!`);
                setNewCategoryName('');
                setShowAddForm(false);
                fetchCategories(); // Refresh list to fetch the newly created category template
            } else {
                toast.error(res.message || 'Failed to add category');
            }
        } catch (err) {
            console.error('Add category error:', err);
            toast.error(err.response?.data?.message || 'Failed to create new communication category');
        } finally {
            setAddingCategory(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete the category "${name}"? Dynamic student dispatches for this category will fall back to local static files.`)) {
            return;
        }

        try {
            const res = await deleteTemplate(id);
            if (res.success) {
                toast.success('Category deleted successfully.');
                setCategories(prev => prev.filter(c => c.id !== id));
            } else {
                toast.error(res.message || 'Delete failed');
            }
        } catch (err) {
            console.error('Delete error:', err);
            toast.error(err.response?.data?.message || 'Error occurred while deleting category');
        }
    };

    const handleToggleActive = async (id, currentStatus) => {
        const item = categories.find(c => c.id === id);
        if (!item) return;

        // Optimistic UI updates
        setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: currentStatus } : c));

        try {
            const payload = {
                template_name: item.template_name,
                template_type: item.template_type,
                is_active: currentStatus,
                template_config: item.template_config
            };

            const res = await updateTemplate(id, payload);
            if (res.success) {
                toast.success(`Category ${currentStatus ? 'activated' : 'deactivated'} successfully.`);
            } else {
                // Revert state
                setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
                toast.error('Toggle status update failed');
            }
        } catch (err) {
            console.error('Toggle status error:', err);
            // Revert state
            setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
            toast.error(err.response?.data?.message || 'Error toggling category state');
        }
    };

    // Filter categories based on search
    const filteredCategories = categories.filter(c => {
        const matchesSearch = c.template_type.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              c.template_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              c.template_name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    // Check if category is seeded default to prevent deletion of system-critical categories
    const isSystemCritical = (key) => {
        const criticalKeys = [
            'welcome', 'otp_verification', 'password_reset', 
            'application_submitted', 'application_approved', 
            'application_rejected', 'payment_confirmed', 'hall_ticket'
        ];
        return criticalKeys.includes(key);
    };

    return (
        <div className="container-fluid py-4 animate-fade-in" style={{ maxWidth: '1400px', paddingBottom: '6rem' }}>
            {/* Header Dashboard Banner */}
            <div 
                className="p-5 mb-5 rounded-4 shadow-sm text-white position-relative overflow-hidden text-start" 
                style={{ 
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    border: '1px solid rgba(255,255,255,0.08)'
                }}
            >
                <div style={{
                    position: 'absolute', top: '-50px', right: '-50px', width: '300px', height: '300px',
                    borderRadius: '50%', background: 'rgba(50, 197, 210, 0.08)', filter: 'blur(70px)', pointerEvents: 'none'
                }}></div>
                
                <div className="row align-items-center g-4 position-relative" style={{ zIndex: 2 }}>
                    <div className="col-md-8">
                        <div className="d-flex align-items-center gap-3">
                            <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(50, 197, 210, 0.1)', border: '1px solid rgba(50, 197, 210, 0.2)', color: '#32c5d2' }}>
                                <Layers size={28} />
                            </div>
                            <div>
                                <h1 className="h3 fw-bold text-white mb-1 d-flex flex-wrap align-items-center gap-2">
                                    Email Categories Management
                                    <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '10px' }}>
                                        FULLY AUTOMATED
                                    </span>
                                </h1>
                                <p className="text-muted mb-0" style={{ color: '#cbd5e1 !important', fontSize: '14px' }}>
                                    Manage active student communication categories. The system automatically creates, styles, and sends premium Periyar University branded notifications.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="col-md-4 text-md-end">
                        <button 
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="btn py-2.5 px-4 text-white fw-bold d-inline-flex align-items-center gap-2 rounded-3 shadow hover-scale"
                            style={{ 
                                background: 'linear-gradient(135deg, #32c5d2 0%, #2563eb 100%)',
                                border: 'none',
                                fontSize: '13px'
                            }}
                        >
                            <Plus size={15} />
                            {showAddForm ? 'Hide Creator' : 'Add Dynamic Category'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Inline Add Category Form */}
            {showAddForm && (
                <div className="card border-0 rounded-4 shadow-sm mb-4 text-start animate-fade-in" style={{ border: '1px solid rgba(50, 197, 210, 0.2)' }}>
                    <div className="card-body p-4">
                        <h4 className="h6 fw-extrabold text-dark mb-3 text-uppercase tracking-wider">Create New Dynamic Category</h4>
                        <form onSubmit={handleAddCategory} className="row g-3 align-items-center">
                            <div className="col-md-8">
                                <input 
                                    type="text" 
                                    className="form-control rounded-3 py-2.5"
                                    placeholder="e.g. Counselling Advisory, Supervisor Assigned, Results Published..."
                                    style={{ fontSize: '14px', border: '1px solid #ced4da', backgroundColor: '#f8fafc' }}
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="col-md-4 d-flex gap-2">
                                <button 
                                    type="submit" 
                                    disabled={addingCategory}
                                    className="btn btn-info text-white fw-bold py-2.5 px-4 rounded-3 w-100 d-flex justify-content-center align-items-center gap-2"
                                    style={{ background: 'linear-gradient(135deg, #32c5d2 0%, #2563eb 100%)', border: 'none', fontSize: '13px' }}
                                >
                                    {addingCategory ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Automating Setup...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            Register & Auto-Style
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                        <span className="text-muted mt-2 d-block" style={{ fontSize: '11px' }}>
                            💡 The system will automatically build a beautifully responsive HTML email template for this category featuring the standard Periyar University seal, signature headers, and secure button links.
                        </span>
                    </div>
                </div>
            )}

            {/* How it works info box */}
            <div 
                className="p-3.5 mb-4 rounded-4 text-start d-flex align-items-start gap-3" 
                style={{ 
                    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(50, 197, 210, 0.05) 100%)',
                    border: '1px solid rgba(50, 197, 210, 0.15)'
                }}
            >
                <Info size={18} className="text-info mt-0.5 flex-shrink-0" />
                <div style={{ fontSize: '12.5px', lineHeight: '1.4', color: '#475569' }}>
                    <strong>Admin Zero-Work Policy:</strong> Visual template layouts are fully handled by the system. As an administrator, you only need to manage the categories. Toggling a category switch to <strong>Active</strong> enables automated dispatches. Adding custom categories dynamically sets up ready-to-use branded templates instantly!
                </div>
            </div>

            {/* Main Categories Grid */}
            {loading ? (
                <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-3">
                    <Loader2 size={40} className="animate-spin text-info" />
                    <span className="text-secondary fw-semibold">Loading email categories...</span>
                </div>
            ) : filteredCategories.length === 0 ? (
                <div className="card border-0 rounded-4 shadow-sm py-5 text-center bg-light">
                    <div className="card-body d-flex flex-column align-items-center justify-content-center gap-3.5 max-w-sm mx-auto">
                        <div className="p-3 bg-white rounded-circle shadow-sm text-secondary">
                            <Mail size={32} className="text-muted" />
                        </div>
                        <div>
                            <h3 className="h6 fw-extrabold text-dark mb-1">No Categories Found</h3>
                            <p className="text-secondary mb-0" style={{ fontSize: '13px' }}>
                                No categories match your search parameters. Try adding a new category type!
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="row g-4 text-start">
                    {filteredCategories.map(c => {
                        const placeholders = PLACEHOLDERS_MAP[c.template_key] || ['studentName', 'applicationId', 'actionUrl'];
                        const critical = isSystemCritical(c.template_key);

                        return (
                            <div key={c.id} className="col-md-6 col-lg-4">
                                <div className="card border-0 rounded-4 shadow-sm h-100 overflow-hidden d-flex flex-column transition-all hover-scale" style={{ border: '1px solid rgba(226,232,240,0.8)' }}>
                                    
                                    {/* Card Header */}
                                    <div className="p-4 border-bottom bg-light d-flex justify-content-between align-items-start gap-2">
                                        <div>
                                            <span className="badge rounded-pill text-info bg-info-subtle border border-info-subtle font-monospace text-uppercase mb-1.5" style={{ fontSize: '9px', letterSpacing: '0.5px' }}>
                                                {c.template_key.replace(/_/g, ' ')}
                                            </span>
                                            <h3 className="h6 fw-bold text-dark mb-1" style={{ fontSize: '15px' }}>
                                                {c.template_type}
                                            </h3>
                                            <span className="text-muted" style={{ fontSize: '11px' }}>
                                                {c.template_name}
                                            </span>
                                        </div>

                                        {/* Status Switch */}
                                        <div 
                                            className="position-relative d-inline-block cursor-pointer transition-all flex-shrink-0"
                                            style={{ 
                                                width: '38px', 
                                                height: '20px', 
                                                borderRadius: '10px',
                                                backgroundColor: c.is_active ? '#10b981' : '#cbd5e1',
                                                border: '1px solid rgba(0,0,0,0.05)',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => handleToggleActive(c.id, !c.is_active)}
                                        >
                                            <span 
                                                className="position-absolute bg-white rounded-circle shadow-sm transition-all"
                                                style={{ 
                                                    width: '16px', 
                                                    height: '16px', 
                                                    top: '1px',
                                                    left: c.is_active ? '19px' : '1px',
                                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-4 flex-grow-1 d-flex flex-column gap-3.5">
                                        
                                        {/* Placeholder metadata tray */}
                                        <div>
                                            <span className="text-uppercase fw-bold text-muted d-block mb-1.5" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>
                                                Auto-Bound Placeholders
                                            </span>
                                            <div className="d-flex flex-wrap gap-1.5">
                                                {placeholders.map(p => (
                                                    <span key={p} className="badge bg-secondary-subtle text-secondary border border-secondary-subtle font-monospace" style={{ fontSize: '10px', fontWeight: '500' }}>
                                                        {`{{${p}}}`}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Footer signature line */}
                                        <div className="mt-auto pt-3 border-top d-flex align-items-center justify-content-between text-secondary" style={{ fontSize: '11px' }}>
                                            <span className="d-flex align-items-center gap-1">
                                                <ShieldCheck size={13} className="text-success" />
                                                University Certified
                                            </span>
                                            
                                            {/* Action tools */}
                                            <button 
                                                onClick={() => handleDelete(c.id, c.template_type)}
                                                className="btn btn-sm py-1.5 px-3 rounded-3 d-flex align-items-center gap-1.5 fw-bold text-danger border border-danger-subtle shadow-sm hover-scale"
                                                style={{ 
                                                    fontSize: '11px', 
                                                    backgroundColor: 'rgba(220, 53, 69, 0.05)', 
                                                    borderColor: 'rgba(220, 53, 69, 0.2)',
                                                    transition: 'all 0.2s ease-in-out'
                                                }}
                                            >
                                                <Trash2 size={12} />
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default EmailTemplateListPage;
