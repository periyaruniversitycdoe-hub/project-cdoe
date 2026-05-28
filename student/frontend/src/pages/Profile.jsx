import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import axios from 'axios';
import {
  LayoutDashboard, FileText, Ticket, GraduationCap,
  HelpCircle, LogOut, Bell, Search, Menu, User,
  Mail, Shield, ArrowLeft, Camera, Eye, EyeOff, X, KeyRound, CheckCircle
} from 'lucide-react';
import './Dashboard.css';
import './Profile.css';

const API = import.meta.env.VITE_API_URL || `(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api`;

const Profile = () => {
    const { user, logout, token } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const [univSettings, setUnivSettings]     = useState(null);
    const [sidebarOpen, setSidebarOpen]       = useState(false);
    const [showPassword, setShowPassword]     = useState(false);
    const [hallTicket, setHallTicket]         = useState(null);

    // Change-password form state
    const [pwForm, setPwForm]                 = useState({ current: '', next: '', confirm: '' });
    const [pwShow, setPwShow]                 = useState({ current: false, next: false, confirm: false });
    const [pwLoading, setPwLoading]           = useState(false);
    const [pwMsg, setPwMsg]                   = useState(null); // { type: 'success'|'error', text }

    useEffect(() => {
        const ac = new AbortController();
        const { signal } = ac;

        axios.get(`${API}/settings`, { signal })
            .then(res => setUnivSettings(res.data))
            .catch(() => {});

        if (token) {
            axios.get(`${API}/student/hall-ticket`, {
                headers: { Authorization: `Bearer ${token}` },
                signal,
            })
                .then(res => setHallTicket(res.data))
                .catch(err => { if (err?.code !== 'ERR_CANCELED') setHallTicket(null); });
        }

        return () => ac.abort();
    }, [token]);

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to logout?')) {
            logout();
            navigate('/login');
        }
    };

    const closeSidebar = () => setSidebarOpen(false);

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwMsg(null);
        if (pwForm.next !== pwForm.confirm)
            return setPwMsg({ type: 'error', text: 'New passwords do not match.' });
        if (pwForm.next.length < 8)
            return setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
        setPwLoading(true);
        try {
            await axios.put(`${API}/auth/change-password`,
                { currentPassword: pwForm.current, newPassword: pwForm.next },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPwMsg({ type: 'success', text: 'Password changed successfully.' });
            setPwForm({ current: '', next: '', confirm: '' });
        } catch (err) {
            setPwMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
        } finally {
            setPwLoading(false);
        }
    };

    return (
        <div className="row justify-content-center">
            <div className="col-lg-8">
                <div className="profile-card">
                    <div className="profile-header-bg"></div>
                    <div className="profile-body">
                        <div className="d-flex justify-content-between align-items-end">
                            <div className="profile-avatar-large">
                                {user?.full_name?.charAt(0) || 'U'}
                            </div>
                        </div>

                        <h2 className="fw-bold mb-1">{user?.full_name}</h2>
                        <p className="text-muted mb-4">Application ID: <span className="fw-bold text-primary">{user?.application_id}</span></p>

                        <div className="border-top pt-4">
                            <h4 className="profile-section-title">
                                <User size={22} className="text-primary" />
                                Account Information
                            </h4>
                            
                            <div className="row g-4">
                                <div className="col-md-6">
                                    <div className="info-group">
                                        <div className="info-label">Full Name</div>
                                        <div className="info-value-box">
                                            <span className="info-value">{user?.full_name}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="info-group">
                                        <div className="info-label">Email Address</div>
                                        <div className="info-value-box">
                                            <span className="info-value">{user?.email}</span>
                                            <Mail size={16} className="text-muted" />
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="info-group">
                                        <div className="info-label">Login Password</div>
                                        <div className="info-value-box">
                                            <span className="info-value">
                                                {showPassword ? '••••••••' : '••••••••'} 
                                                <small className="text-muted ms-2">(Encrypted)</small>
                                            </span>
                                            <button className="btn p-0 text-muted" onClick={() => setShowPassword(!showPassword)}>
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <small className="text-muted mt-1 d-block">Passwords are stored in a secure hashed format.</small>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="info-group">
                                        <div className="info-label">Account Role</div>
                                        <div className="info-value-box">
                                            <span className="info-value text-capitalize">{user?.role || 'Student'}</span>
                                            <Shield size={16} className="text-success" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Change Password Section */}
                        <div className="mt-4 pt-4 border-top">
                            <h4 className="profile-section-title">
                                <KeyRound size={22} className="text-primary" />
                                Change Password
                            </h4>
                            <form onSubmit={handleChangePassword} style={{ maxWidth: 420 }}>
                                {pwMsg && (
                                    <div className={`alert alert-${pwMsg.type === 'success' ? 'success' : 'danger'} d-flex align-items-center gap-2 py-2 mb-3`} style={{ fontSize: 13 }}>
                                        {pwMsg.type === 'success' ? <CheckCircle size={15} /> : <X size={15} />}
                                        {pwMsg.text}
                                    </div>
                                )}
                                {[
                                    { key: 'current', label: 'Current Password',  placeholder: 'Enter current password' },
                                    { key: 'next',    label: 'New Password',       placeholder: 'At least 8 characters' },
                                    { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
                                ].map(f => (
                                    <div className="mb-3" key={f.key}>
                                        <label className="form-label small fw-semibold text-muted mb-1">{f.label}</label>
                                        <div className="input-group input-group-sm">
                                            <input
                                                type={pwShow[f.key] ? 'text' : 'password'}
                                                className="form-control"
                                                placeholder={f.placeholder}
                                                value={pwForm[f.key]}
                                                onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                                                required
                                            />
                                            <button type="button" className="btn btn-outline-secondary" onClick={() => setPwShow(p => ({ ...p, [f.key]: !p[f.key] }))}>
                                                {pwShow[f.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button type="submit" className="btn btn-primary btn-sm px-4 rounded-pill" disabled={pwLoading}>
                                    {pwLoading ? <span className="spinner-border spinner-border-sm me-1" role="status" /> : null}
                                    {pwLoading ? 'Saving…' : 'Update Password'}
                                </button>
                            </form>
                        </div>

                        <div className="mt-4 pt-4 border-top">
                            <h4 className="profile-section-title">
                                <HelpCircle size={22} className="text-primary" />
                                Need to update your data?
                            </h4>
                            <p className="text-muted small">
                                Your personal and academic details are linked to your Ph.D. application.
                                To edit your profile information, please navigate to the <strong>My Application</strong> section.
                            </p>
                            <button className="btn btn-primary rounded-pill px-4" onClick={() => navigate('/apply')}>
                                Go to Application
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
