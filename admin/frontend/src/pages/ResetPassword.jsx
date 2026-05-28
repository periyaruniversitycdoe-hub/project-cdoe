import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  // Password criteria / strength
  const [strength, setStrength] = useState({ score: 0, label: 'Too Short', color: '#6c757d' });
  const [checks, setChecks] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  useEffect(() => {
    axios.get(`${API_URL}/settings`)
      .then(res => {
        const data = res.data.success ? res.data.data : res.data;
        setSettings(data);
      })
      .catch(() => {});
  }, []);

  // Real-time strength checks
  useEffect(() => {
    const length = password.length >= 8;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const number = /\d/.test(password);
    const special = /[@$!%*?&#]/.test(password);

    setChecks({ length, upper, lower, number, special });

    if (!password) {
      setStrength({ score: 0, label: 'Enter Password', color: '#6c757d' });
      return;
    }

    let score = 0;
    if (length) score += 1;
    if (upper) score += 1;
    if (lower) score += 1;
    if (number) score += 1;
    if (special) score += 1;

    let label = 'Weak';
    let color = '#dc3545'; // red

    if (score <= 2) {
      label = 'Weak';
      color = '#dc3545';
    } else if (score === 3) {
      label = 'Fair';
      color = '#ffc107'; // orange/yellow
    } else if (score === 4) {
      label = 'Strong';
      color = '#0dcaf0'; // cyan
    } else if (score === 5) {
      label = 'Very Strong';
      color = '#198754'; // green
    }

    setStrength({ score, label, color });
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (strength.score < 5) {
      toast.error('Password does not meet the security requirements.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/reset-password`, {
        email,
        password,
        confirmPassword
      });

      if (res.data.success) {
        toast.success(res.data.message || 'Password updated successfully!');
        navigate('/login');
      } else {
        toast.error(res.data.message || 'Reset failed.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Access denied or session expired. Restart.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#364150', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '440px', padding: '20px' }}>
        
        {/* Logo / Title */}
        <div className="text-center mb-4">
          <div style={{ display: 'inline-flex', gap: '8px', marginBottom: 16 }}>
            <img 
              src={settings?.logo?.startsWith('/uploads') ? `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001')${settings.logo}` : settings?.logo || '/images/pu_logo.png'} 
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
            <h5 className="text-center fw-bold mb-3" style={{ color: '#32c5d2', letterSpacing: 1 }}>RESET PASSWORD</h5>
            
            <form onSubmit={handleSubmit} noValidate>
              
              {/* Password */}
              <div className="mb-3 position-relative">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>New Password</label>
                <div className="input-group">
                  <span className="input-group-text" style={{ backgroundColor: '#dde3ec', border: '1px solid #c5cdd9' }}>
                    <Lock size={16} className="text-muted" />
                  </span>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="form-control"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ backgroundColor: '#dde3ec', border: '1px solid #c5cdd9', borderLeft: 'none', paddingRight: '40px' }}
                  />
                </div>
                <button
                  type="button"
                  className="position-absolute border-0 bg-transparent"
                  style={{ right: '12px', top: '35px', cursor: 'pointer', color: '#94a3b8', zIndex: 10 }}
                  onClick={() => setShowPwd(!showPwd)}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small text-muted" style={{ fontSize: 12 }}>Strength:</span>
                    <span className="small fw-bold" style={{ color: strength.color, fontSize: 12 }}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="progress" style={{ height: '6px' }}>
                    <div 
                      className="progress-bar" 
                      role="progressbar" 
                      style={{ 
                        width: `${(strength.score / 5) * 100}%`, 
                        backgroundColor: strength.color,
                        transition: 'width 0.3s ease' 
                      }}
                      aria-valuenow={strength.score}
                      aria-valuemin="0"
                      aria-valuemax="5"
                    />
                  </div>
                </div>
              )}

              {/* Security checklist */}
              <div className="mb-3 bg-light p-3 border rounded shadow-sm" style={{ fontSize: 11 }}>
                <div className="row g-2">
                  <div className="col-12 d-flex align-items-center gap-2">
                    {checks.length ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-danger" />}
                    <span>8+ characters minimum</span>
                  </div>
                  <div className="col-6 d-flex align-items-center gap-2">
                    {checks.upper ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-danger" />}
                    <span>Uppercase [A-Z]</span>
                  </div>
                  <div className="col-6 d-flex align-items-center gap-2">
                    {checks.lower ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-danger" />}
                    <span>Lowercase [a-z]</span>
                  </div>
                  <div className="col-6 d-flex align-items-center gap-2">
                    {checks.number ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-danger" />}
                    <span>Numeric [0-9]</span>
                  </div>
                  <div className="col-6 d-flex align-items-center gap-2">
                    {checks.special ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-danger" />}
                    <span>Special character</span>
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="mb-4 position-relative">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Confirm Password</label>
                <div className="input-group">
                  <span className="input-group-text" style={{ backgroundColor: '#dde3ec', border: '1px solid #c5cdd9' }}>
                    <Lock size={16} className="text-muted" />
                  </span>
                  <input
                    type={showConfirmPwd ? 'text' : 'password'}
                    className="form-control"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ backgroundColor: '#dde3ec', border: '1px solid #c5cdd9', borderLeft: 'none', paddingRight: '40px' }}
                  />
                </div>
                <button
                  type="button"
                  className="position-absolute border-0 bg-transparent"
                  style={{ right: '12px', top: '35px', cursor: 'pointer', color: '#94a3b8', zIndex: 10 }}
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                >
                  {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || strength.score < 5 || password !== confirmPassword}
                className="btn w-100 fw-bold text-uppercase py-2"
                style={{ backgroundColor: '#32c5d2', borderColor: '#32c5d2', color: '#fff', letterSpacing: 1 }}
              >
                {loading ? (
                  <span>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving Password...
                  </span>
                ) : 'Reset Password'}
              </button>

              <Link 
                to="/login" 
                className="d-flex align-items-center justify-content-center gap-2 text-decoration-none small mt-4"
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

export default ResetPassword;
