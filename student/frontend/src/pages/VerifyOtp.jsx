import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function VerifyOtp() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''

  const [otp, setOtp] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [settings, setSettings] = useState(null)
  
  // Timers: 5-minute (300s) OTP expiry, 60-second resend cooldown
  const [timeLeft, setTimeLeft] = useState(300)
  const [resendCooldown, setResendCooldown] = useState(60)

  const inputRefs = [useRef(), useRef(), useRef(), useRef()]

  // Fetch settings
  useEffect(() => {
    const ac = new AbortController();
    fetch((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/settings', { signal: ac.signal })
      .then(r => r.json())
      .then(res => setSettings(res.success ? res.data : res))
      .catch(err => { if (err?.name !== 'AbortError') console.error(err); });
    return () => ac.abort();
  }, []);

  // Expiry Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    return () => clearTimeout(timer)
  }, [timeLeft])

  // Resend Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Handle OTP digit changes
  const handleChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Focus next input if a digit is entered
    if (value && index < 3) {
      inputRefs[index + 1].current.focus()
    }
  }

  // Handle backspace navigation
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus()
    }
  }

  // Handle paste operation
  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').trim()
    if (!/^\d{4}$/.test(pastedData)) return

    const digits = pastedData.split('')
    setOtp(digits)
    inputRefs[3].current.focus()
  }

  // Submit OTP Verification
  const handleSubmit = async (e) => {
    e.preventDefault()
    const otpCode = otp.join('')

    if (otpCode.length !== 4) {
      toast.error('Please enter the full 4-digit OTP.')
      return
    }

    if (timeLeft <= 0) {
      toast.error('This OTP has expired. Please request a new code.')
      return
    }

    setLoading(true)
    try {
      const res = await axios.post((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/auth/verify-otp', {
        email,
        otp: otpCode
      })

      if (res.data.success) {
        toast.success(res.data.message || 'OTP verified successfully!')
        navigate(`/reset-password?email=${encodeURIComponent(email)}`)
      } else {
        toast.error(res.data.message || 'Verification failed.')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResend = async () => {
    if (resendCooldown > 0) return

    setResending(true)
    try {
      const res = await axios.post((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/auth/resend-otp', { email })
      if (res.data.success) {
        toast.success(res.data.message || 'New OTP has been sent!')
        setOtp(['', '', '', ''])
        setTimeLeft(300) // Reset 5-min timer
        setResendCooldown(60) // Reset 60s cooldown
        inputRefs[0].current.focus()
      } else {
        toast.error(res.data.message || 'Failed to resend OTP.')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred. Please try again.')
    } finally {
      setResending(false)
    }
  }

  // Format expiry time as mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="login-page">
      <div
        className="login-bg-slide"
        style={{
          backgroundImage: `url('/images/bg/1.jpg')`,
          opacity: 1,
        }}
      />
      <div className="login-overlay" />
      
      <motion.div
        className="login-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="login-box">
          <div className="login-logo text-center">
            <img 
              src={settings?.logo?.startsWith('/uploads') ? (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + settings.logo : settings?.logo || "/images/pu_logo.png"} 
              alt="Logo" 
              style={{ height: '80px', marginBottom: '10px', objectFit: 'contain' }} 
            />
            <h3 className="fw-bold text-primary">{settings?.university_name_english || 'PERIYAR UNIVERSITY'}</h3>
            <p className="text-muted small">{settings?.university_name_tamil || 'பெரியார் பல்கலைக்கழகம்'}</p>
          </div>
          
          <div className="login-title text-center mb-4 text-teal">Verify OTP</div>
          
          <p className="text-muted text-center small mb-3">
            Enter the 4-digit code sent to <strong className="text-dark">{email}</strong>.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* OTP Inputs Grid */}
            <div className="d-flex justify-content-center gap-3 my-4" onPaste={handlePaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  maxLength="1"
                  className="form-control text-center fw-bold fs-4 shadow-sm"
                  style={{
                    width: '54px',
                    height: '58px',
                    backgroundColor: '#f8fafc',
                    border: '1.5px solid #ced4da',
                    borderRadius: '10px',
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

            {/* OTP Expiry Countdown */}
            <div className="text-center mb-4">
              {timeLeft > 0 ? (
                <span className="text-muted small d-flex align-items-center justify-content-center gap-1">
                  ⏱️ Code expires in: <strong className="text-danger">{formatTime(timeLeft)}</strong>
                </span>
              ) : (
                <span className="text-danger fw-semibold small">⚠️ OTP has expired. Please request a new one.</span>
              )}
            </div>

            <button 
              type="submit" 
              className="btn btn-dark w-100 py-2 mb-3 d-flex align-items-center justify-content-center gap-2"
              disabled={loading || timeLeft <= 0}
              style={{ background: '#364150' }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Verifying...
                </>
              ) : (
                <><ShieldCheck size={16} /> Verify Code</>
              )}
            </button>

            {/* Resend Cooldown Handler */}
            <div className="text-center mt-3 small">
              <span className="text-muted">Didn't receive the email? </span>
              {resendCooldown > 0 ? (
                <span className="text-teal font-monospace">Resend in {resendCooldown}s</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-link p-0 text-teal text-decoration-none fw-semibold small d-inline-flex align-items-center gap-1"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Resend OTP
                </button>
              )}
            </div>

            <Link 
              to="/login" 
              className="d-flex align-items-center justify-content-center gap-2 text-teal text-decoration-none small mt-4"
            >
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
