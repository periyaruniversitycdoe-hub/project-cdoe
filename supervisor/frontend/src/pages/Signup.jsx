import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg,#4338ca 0%,#7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { background: '#fff', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  logo: { textAlign: 'center', marginBottom: 28 },
  logoIcon: { width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#4338ca,#7c3aed)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 },
  title: { fontSize: 22, fontWeight: 700, color: '#1e293b', marginTop: 14 },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', background: '#f8fafc' },
  group: { marginBottom: 16 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  btn: { width: '100%', padding: '13px 0', background: 'linear-gradient(135deg,#4338ca,#7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 6 },
  err: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
  info: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 16 },
  foot: { textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' },
  lnk: { color: '#4338ca', fontWeight: 600 },
};

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password, form.mobile);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoIcon}>🎓</div>
          <div style={S.title}>Create Supervisor Account</div>
          <div style={S.subtitle}>PhD ERP System — Periyar University</div>
        </div>
        <div style={S.info}>
          If your email matches an existing supervisor record, your account will be automatically linked.
        </div>
        {error && <div style={S.err}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={S.group}>
            <label style={S.label}>Full Name</label>
            <input style={S.input} placeholder="Dr. John Doe" value={form.name} onChange={set('name')} required />
          </div>
          <div style={S.group}>
            <label style={S.label}>Email Address</label>
            <input style={S.input} type="email" placeholder="supervisor@university.edu" value={form.email} onChange={set('email')} required />
          </div>
          <div style={S.group}>
            <label style={S.label}>Mobile Number</label>
            <input style={S.input} placeholder="9XXXXXXXXX" value={form.mobile} onChange={set('mobile')} />
          </div>
          <div style={S.row}>
            <div style={S.group}>
              <label style={S.label}>Password</label>
              <input style={S.input} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            </div>
            <div style={S.group}>
              <label style={S.label}>Confirm Password</label>
              <input style={S.input} type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} required />
            </div>
          </div>
          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <div style={S.foot}>
          Already have an account? <Link to="/login" style={S.lnk}>Sign In</Link>
        </div>
      </div>
    </div>
  );
}
