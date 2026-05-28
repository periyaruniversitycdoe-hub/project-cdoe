import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Building2, Lock, Mail } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0891b2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: '1px solid rgba(255,255,255,0.2)' }}>
            <Building2 size={36} color="#fff" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Research Centre Portal</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>Periyar University — PhD Research Management</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0c4a6e', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28 }}>Sign in to your research centre account.</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                <Mail size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Email Address
              </label>
              <input
                type="email" autoComplete="email" placeholder="centre@university.edu"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #bae6fd', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f0f9ff', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>
                  <Lock size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Password
                </label>
                <Link to="/forgot-password" style={{ color: '#0891b2', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  Forgot Password?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ width: '100%', padding: '12px 44px 12px 14px', border: '1.5px solid #bae6fd', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f0f9ff', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 14, background: loading ? '#7dd3fc' : 'linear-gradient(135deg, #0891b2, #0e7490)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(8,145,178,0.35)' }}>
              {loading ? 'Signing In...' : 'Sign In →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#64748b' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: '#0891b2', fontWeight: 700, textDecoration: 'none' }}>Create Account</Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 24 }}>
          © 2025 Periyar University · PhD ERP System
        </p>
      </div>
    </div>
  );
}
