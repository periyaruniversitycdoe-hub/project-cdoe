import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const VerifyOtp = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [settings, setSettings] = useState(null);
  
  // Expiry (300s = 5m), Cooldown (60s)
  const [timeLeft, setTimeLeft] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(60);

  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    axios.get(`${API_URL}/settings`)
      .then(res => {
        const data = res.data.success ? res.data.data : res.data;
        setSettings(data);
      })
      .catch(() => {});
  }, []);

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

        {/* Card */}
        <div className="card shadow-lg border-0" style={{ borderRadius: 4 }}>
          <div className="card-body p-5">
            <h5 className="text-center fw-bold mb-3" style={{ color: '#32c5d2', letterSpacing: 1 }}>VERIFY OTP</h5>
            <p className="text-muted text-center small mb-3">
              Enter the 4-digit code sent to <strong>{email}</strong>.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* OTP Grid */}
              <div className="d-flex justify-content-center gap-3 my-4" onPaste={handlePaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={inputRefs[idx]}
                    type="text"
                    maxLength="1"
                    className="form-control text-center fw-bold fs-4"
                    style={{
                      width: '50px',
                      height: '54px',
                      backgroundColor: '#dde3ec',
                      border: '1px solid #c5cdd9',
                      borderRadius: '4px',
                      color: '#0f4c81'
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
              <div className="text-center mb-4">
                {timeLeft > 0 ? (
                  <span className="text-muted small">
                    ⏱️ Code expires in: <strong className="text-danger">{formatTime(timeLeft)}</strong>
                  </span>
                ) : (
                  <span className="text-danger fw-semibold small">⚠️ OTP code expired. Request a new one.</span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || timeLeft <= 0}
                className="btn w-100 fw-bold text-uppercase py-2 mb-3"
                style={{ backgroundColor: '#32c5d2', borderColor: '#32c5d2', color: '#fff', letterSpacing: 1 }}
              >
                {loading ? (
                  <span>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Verifying...
                  </span>
                ) : (
                  <span className="d-flex align-items-center justify-content-center gap-2">
                    <ShieldCheck size={16} /> Verify OTP
                  </span>
                )}
              </button>

              {/* Resend Cooldown */}
              <div className="text-center mt-3 small">
                <span className="text-muted text-sm">Didn't receive email? </span>
                {resendCooldown > 0 ? (
                  <span className="font-monospace" style={{ color: '#32c5d2' }}>Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none fw-semibold small d-inline-flex align-items-center gap-1"
                    onClick={handleResend}
                    disabled={resending}
                    style={{ color: '#32c5d2' }}
                  >
                    <RefreshCw size={12} /> Resend OTP
                  </button>
                )}
              </div>

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

export default VerifyOtp;
