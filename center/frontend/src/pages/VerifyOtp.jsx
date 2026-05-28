import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, ArrowLeft, RefreshCw, Building2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = `(import.meta.env.VITE_CENTER_API_URL || 'http://localhost:5003') + '/api`;

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  // Expiry (300s = 5m), Cooldown (60s)
  const [timeLeft, setTimeLeft] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(60);

  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  // Timers
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 3) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (!/^\d{4}$/.test(pastedData)) return;

    const digits = pastedData.split('');
    setOtp(digits);
    inputRefs[3].current.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');

    if (otpCode.length !== 4) {
      toast.error('Please enter the 4-digit OTP.');
      return;
    }

    if (timeLeft <= 0) {
      toast.error('OTP code expired. Please request a new one.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/verify-otp`, { email, otp: otpCode });
      if (res.data.success) {
        toast.success(res.data.message || 'OTP verified successfully!');
        navigate(`/reset-password?email=${encodeURIComponent(email)}`);
      } else {
        toast.error(res.data.message || 'Verification failed.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect OTP code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    try {
      const res = await axios.post(`${API_URL}/auth/resend-otp`, { email });
      if (res.data.success) {
        toast.success(res.data.message || 'New OTP sent!');
        setOtp(['', '', '', '']);
        setTimeLeft(300);
        setResendCooldown(60);
        inputRefs[0].current.focus();
      } else {
        toast.error(res.data.message || 'Failed to resend OTP.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend. Try again.');
    } finally {
      setResending(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0c4a6e', marginBottom: 6 }}>Verify OTP</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
            Enter the 4-digit code sent to <strong style={{ color: '#0c4a6e' }}>{email}</strong>.
          </p>

          <form onSubmit={handleSubmit}>
            {/* OTP Grid */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '24px 0' }} onPaste={handlePaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  maxLength="1"
                  style={{
                    width: '56px',
                    height: '56px',
                    textAlign: 'center',
                    fontWeight: '700',
                    fontSize: '22px',
                    border: '1.5px solid #bae6fd',
                    borderRadius: '12px',
                    outline: 'none',
                    background: '#f0f9ff',
                    color: '#0c4a6e',
                    boxSizing: 'border-box'
                  }}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  autoFocus={idx === 0}
                  required
                />
              ))}
            </div>

            {/* Expiry Timer */}
            <div style={{ textAlign: 'center', marginBottom: 24, fontSize: 13 }}>
              {timeLeft > 0 ? (
                <span style={{ color: '#64748b' }}>
                  ⏱️ Code expires in: <strong style={{ color: '#ef4444' }}>{formatTime(timeLeft)}</strong>
                </span>
              ) : (
                <span style={{ color: '#ef4444', fontWeight: '600' }}>⚠️ OTP code expired. Request a new one.</span>
              )}
            </div>

            <button type="submit" disabled={loading || timeLeft <= 0}
              style={{ width: '100%', padding: 14, background: (loading || timeLeft <= 0) ? '#7dd3fc' : 'linear-gradient(135deg, #0891b2, #0e7490)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: (loading || timeLeft <= 0) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(8,145,178,0.35)', marginBottom: 20 }}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            {/* Resend Cooldown */}
            <div style={{ textAlign: 'center', marginBottom: 24, fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>Didn't receive email? </span>
              {resendCooldown > 0 ? (
                <span style={{ color: '#0891b2', fontWeight: '600', fontFamily: 'monospace' }}>Resend in {resendCooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{ background: 'none', border: 'none', color: '#0891b2', fontWeight: '700', cursor: 'pointer', padding: 0, fontSize: 13 }}
                >
                  <RefreshCw size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} /> Resend OTP
                </button>
              )}
            </div>

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
