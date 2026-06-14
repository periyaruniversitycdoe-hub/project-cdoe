import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, GraduationCap, Lock, Mail } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const uniName = settings.university_name_en || settings.university_name_english || 'Periyar University';
  const uploadsBase = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001';
  const logoSrc = settings.logo || settings.logo_url
    ? (settings.logo || settings.logo_url).startsWith('http')
      ? (settings.logo || settings.logo_url)
      : `${uploadsBase}${settings.logo || settings.logo_url}`
    : null;
  const copyrightText = settings.copyright_text || `© ${new Date().getFullYear()} ${uniName}`;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Please enter email and password.'); return; }
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid credentials. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: '1px solid rgba(255,255,255,0.2)' }}>
            {logoSrc
              ? <img src={logoSrc} alt="Logo" style={{ width: 52, height: 52, objectFit: 'contain' }} />
              : <GraduationCap size={36} color="#fff" />}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Supervisor Portal</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>{uniName} — PhD Research Management</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28 }}>Sign in to your supervisor account to continue.</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                <Mail size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Email Address
              </label>
              <input
                type="email" autoComplete="email" placeholder="your@email.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>
                  <Lock size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Password
                </label>
                <Link to="/forgot-password" style={{ color: '#4338ca', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  Forgot Password?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ width: '100%', padding: '12px 44px 12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 14, background: loading ? '#a5b4fc' : 'linear-gradient(135deg, #4338ca, #312e81)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(67,56,202,0.3)' }}>
              {loading ? 'Signing In...' : 'Sign In →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#64748b' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: '#4338ca', fontWeight: 700, textDecoration: 'none' }}>Create Account</Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 24 }}>
          {copyrightText}
        </p>
      </div>
    </div>
  );
}
