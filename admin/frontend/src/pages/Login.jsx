
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Mail, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSession } from '../contexts/SessionContext';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [settings, setSettings] = useState(null);

  // Already logged in → redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) navigate('/', { replace: true });

    axios.get(`${API_URL}/settings`)
      .then(res => {
        const data = res.data.success ? res.data.data : res.data;
        setSettings(data);
      })
      .catch(() => {});
  }, []);

  const { refreshSessions } = useSession();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      localStorage.setItem('adminToken', res.data.token);
      localStorage.setItem('adminUser', JSON.stringify(res.data.user));
      if (refreshSessions) {
        await refreshSessions();
      }
      toast.success('Login successful');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check credentials.');
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
              src={settings?.logo?.startsWith('/uploads') ? (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + settings.logo : settings?.logo || '/images/pu_logo.png'} 
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

        {/* Login Card */}
        <div className="card shadow-lg border-0" style={{ borderRadius: 4 }}>
          <div className="card-body p-5">
            <h5 className="text-center fw-bold mb-4" style={{ color: '#32c5d2', letterSpacing: 1 }}>SIGN IN</h5>

            <form onSubmit={handleLogin} noValidate>
              {/* Email */}
              <div className="mb-3">
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
                    autoComplete="email"
                    style={{ backgroundColor: '#dde3ec', border: '1px solid #c5cdd9', borderLeft: 'none' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label fw-semibold mb-0" style={{ fontSize: 13 }}>Password</label>
                  <Link to="/forgot-password" style={{ color: '#32c5d2', fontSize: 12, textDecoration: 'none', fontWeight: '500' }}>Forgot Password?</Link>
                </div>
                <div className="input-group">
                  <span className="input-group-text" style={{ backgroundColor: '#dde3ec', border: '1px solid #c5cdd9' }}>
                    <Lock size={16} className="text-muted" />
                  </span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ backgroundColor: '#dde3ec', border: '1px solid #c5cdd9', borderLeft: 'none' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn w-100 fw-bold text-uppercase py-2"
                style={{ backgroundColor: '#32c5d2', borderColor: '#32c5d2', color: '#fff', letterSpacing: 1 }}
              >
                {loading ? (
                  <span>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Authenticating...
                  </span>
                ) : 'Login'}
              </button>
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

export default Login;
