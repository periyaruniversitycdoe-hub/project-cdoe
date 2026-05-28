import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, XCircle, Building2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = `(import.meta.env.VITE_CENTER_API_URL || 'http://localhost:5003') + '/api`;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password criteria / strength
  const [strength, setStrength] = useState({ score: 0, label: 'Too Short', color: '#64748b' });
  const [checks, setChecks] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  // Real-time strength checks
  useEffect(() => {
    const length = password.length >= 8;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const number = /\d/.test(password);
    const special = /[@$!%*?&#]/.test(password);

    setChecks({ length, upper, lower, number, special });

    if (!password) {
      setStrength({ score: 0, label: 'Enter Password', color: '#64748b' });
      return;
    }

    let score = 0;
    if (length) score += 1;
    if (upper) score += 1;
    if (lower) score += 1;
    if (number) score += 1;
    if (special) score += 1;

    let label = 'Weak';
    let color = '#ef4444'; // red

    if (score <= 2) {
      label = 'Weak';
      color = '#ef4444';
    } else if (score === 3) {
      label = 'Fair';
      color = '#f59e0b'; // amber
    } else if (score === 4) {
      label = 'Strong';
      color = '#06b6d4'; // cyan
    } else if (score === 5) {
      label = 'Very Strong';
      color = '#10b981'; // emerald
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0891b2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: '1px solid rgba(255,255,255,0.2)' }}>
            <Building2 size={36} color="#fff" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Research Centre Portal</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>Periyar University — PhD Research Management</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0c4a6e', marginBottom: 6 }}>Reset Password</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28 }}>Choose a highly secure, strong password for your research centre account.</p>

          <form onSubmit={handleSubmit}>
            {/* Password */}
            <div style={{ marginBottom: 20, position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                <Lock size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 44px 12px 14px', border: '1.5px solid #bae6fd', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f0f9ff', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Strength:</span>
                  <span style={{ marginLeft: 'auto', fontWeight: '700', color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${(strength.score / 5) * 100}%`, 
                      height: '100%',
                      backgroundColor: strength.color,
                      transition: 'width 0.3s ease' 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Security checklist */}
            <div style={{ marginBottom: 20, background: '#f8fafc', padding: 14, border: '1px solid #bae6fd', borderRadius: 10, fontSize: 11, color: '#475569' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {checks.length ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#ef4444" />}
                  <span>8+ characters minimum</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {checks.upper ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#ef4444" />}
                    <span>Uppercase [A-Z]</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {checks.lower ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#ef4444" />}
                    <span>Lowercase [a-z]</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {checks.number ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#ef4444" />}
                    <span>Numeric [0-9]</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {checks.special ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#ef4444" />}
                    <span>Special character</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: 28, position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                <Lock size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 44px 12px 14px', border: '1.5px solid #bae6fd', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f0f9ff', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowConfirmPwd(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || strength.score < 5 || password !== confirmPassword}
              style={{ 
                width: '100%', 
                padding: 14, 
                background: (loading || strength.score < 5 || password !== confirmPassword) ? '#7dd3fc' : 'linear-gradient(135deg, #0891b2, #0e7490)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 12, 
                fontSize: 15, 
                fontWeight: 700, 
                cursor: (loading || strength.score < 5 || password !== confirmPassword) ? 'not-allowed' : 'pointer', 
                transition: 'all 0.2s', 
                boxShadow: '0 4px 14px rgba(8,145,178,0.35)', 
                marginBottom: 20 
              }}
            >
              {loading ? 'Saving Password...' : 'Reset Password'}
            </button>

            <Link 
              to="/login" 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#0891b2', fontWeight: 700, textDecoration: 'none', fontSize: 13 }}
            >
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 24 }}>
          © 2025 Periyar University · PhD ERP System
        </p>
      </div>
    </div>
  );
}
