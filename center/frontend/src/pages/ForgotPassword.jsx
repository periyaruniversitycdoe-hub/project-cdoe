import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Mail, ArrowLeft, Building2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = `(import.meta.env.VITE_CENTER_API_URL || 'http://localhost:5003') + '/api`;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0891b2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
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
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0c4a6e', marginBottom: 6 }}>Forgot Password</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28 }}>Enter your registered research centre email address to receive a verification OTP.</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                <Mail size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Email Address
              </label>
              <input
                type="email"
                placeholder="centre@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #bae6fd', borderRadius: 10, fontSize: 14, outline: 'none', background: '#f0f9ff', boxSizing: 'border-box' }}
              />
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 14, background: loading ? '#7dd3fc' : 'linear-gradient(135deg, #0891b2, #0e7490)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(8,145,178,0.35)', marginBottom: 20 }}>
              {loading ? 'Sending OTP...' : 'Send OTP Code'}
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
