import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/settings`)
      .then(res => {
        const data = res.data.success ? res.data.data : res.data;
        setSettings(data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Email address is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
      if (res.data.success) {
        toast.success(res.data.message || 'OTP sent successfully!');
        navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
      } else {
        toast.error(res.data.message || 'Failed to send OTP.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email not registered or server error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#364150', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '20px' }}>
        
        {/* Logo / Title */}
        <div className="text-center mb-4">
          <div style={{ display: 'inline-flex', gap: '8px', marginBottom: 16 }}>
            <img 
              src={settings?.logo?.startsWith('/uploads') ? `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + ''${settings.logo}` : settings?.logo || '/images/pu_logo.png'} 
              alt="Logo" 
              style={{ height: '70px', width: 'auto', objectFit: 'contain' }} 
            />
          </div>
          <h2 className="text-white fw-bold mb-1" style={{ fontSize: '20px' }}>
            {settings?.university_name_english || 'PERIYAR UNIVERSITY'}
          </h2>
          <p style={{ color: '#b4bcc8', fontSize: '13px', marginBottom: 3 }}>
            {settings?.university_name_tamil || 'பெரியார் பல்கலைக்கழகம்'}
          </p>
          <span style={{ color: '#32c5d2', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ERP ADMIN PORTAL
          </span>
        </div>

        {/* Card */}
        <div className="card shadow-lg border-0" style={{ borderRadius: 4 }}>
          <div className="card-body p-5">
            <h5 className="text-center fw-bold mb-3" style={{ color: '#32c5d2', letterSpacing: 1 }}>FORGOT PASSWORD</h5>
            <p className="text-muted text-center small mb-4">
              Enter your registered admin email. We will send you a 4-digit OTP code to verify your identity.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-4">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Email Address</label>
                <div className="input-group">
                  <span className="input-group-text" style={{ backgroundColor: '#dde3ec', border: '1px solid #c5cdd9' }}>
                    <Mail size={16} className="text-muted" />
                  </span>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="admin@periyar.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ backgroundColor: '#dde3ec', border: '1px solid #c5cdd9', borderLeft: 'none' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn w-100 fw-bold text-uppercase py-2 mb-3"
                style={{ backgroundColor: '#32c5d2', borderColor: '#32c5d2', color: '#fff', letterSpacing: 1 }}
              >
                {loading ? (
                  <span>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Sending OTP...
                  </span>
                ) : 'Send OTP Code'}
              </button>

              <Link 
                to="/login" 
                className="d-flex align-items-center justify-content-center gap-2 text-decoration-none small mt-3"
                style={{ color: '#32c5d2', fontWeight: 'semibold' }}
              >
                <ArrowLeft size={16} /> Back to Login
              </Link>
            </form>
          </div>
        </div>

        <p className="text-center mt-4" style={{ color: '#b4bcc8', fontSize: '12px' }}>
          &copy; 2026 Periyar University. All Rights Reserved.
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
