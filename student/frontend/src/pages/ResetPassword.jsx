import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Lock, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState(null)
  
  // Real-time password criteria state
  const [strength, setStrength] = useState({ score: 0, label: 'Too Short', color: 'bg-danger' })
  const [checks, setChecks] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  })

  // Fetch settings
  useEffect(() => {
    const ac = new AbortController();
    fetch((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/settings', { signal: ac.signal })
      .then(r => r.json())
      .then(res => setSettings(res.success ? res.data : res))
      .catch(err => { if (err?.name !== 'AbortError') console.error(err); });
    return () => ac.abort();
  }, []);

  // Update password strength checks in real time
  useEffect(() => {
    const length = password.length >= 8
    const upper = /[A-Z]/.test(password)
    const lower = /[a-z]/.test(password)
    const number = /\d/.test(password)
    const special = /[@$!%*?&#]/.test(password)

    setChecks({ length, upper, lower, number, special })

    // Calculate score
    if (!password) {
      setStrength({ score: 0, label: 'Enter Password', color: 'bg-secondary' })
      return
    }

    let score = 0
    if (length) score += 1
    if (upper) score += 1
    if (lower) score += 1
    if (number) score += 1
    if (special) score += 1

    let label = 'Weak'
    let color = 'bg-danger'

    if (score <= 2) {
      label = 'Weak'
      color = 'bg-danger'
    } else if (score === 3) {
      label = 'Fair'
      color = 'bg-warning'
    } else if (score === 4) {
      label = 'Strong'
      color = 'bg-info'
    } else if (score === 5) {
      label = 'Very Strong'
      color = 'bg-success'
    }

    setStrength({ score, label, color })
  }, [password])

  // Submit Password Reset
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!password || !confirmPassword) {
      toast.error('Please fill in all password fields.')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    if (strength.score < 5) {
      toast.error('Please meet all security requirements for your password.')
      return
    }

    setLoading(true)
    try {
      const res = await axios.post((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/auth/reset-password', {
        email,
        password,
        confirmPassword
      })

      if (res.data.success) {
        toast.success(res.data.message || 'Password reset successfully!')
        navigate('/login')
      } else {
        toast.error(res.data.message || 'Reset failed.')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'OTP session expired or invalid. Restart process.')
    } finally {
      setLoading(false)
    }
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
        <div className="login-box" style={{ maxWidth: '460px' }}>
          <div className="login-logo text-center">
            <img 
              src={settings?.logo?.startsWith('/uploads') ? `((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '')${settings.logo}` : settings?.logo || "/images/pu_logo.png"} 
              alt="Logo" 
              style={{ height: '80px', marginBottom: '10px', objectFit: 'contain' }} 
            />
            <h3 className="fw-bold text-primary">{settings?.university_name_english || 'PERIYAR UNIVERSITY'}</h3>
            <p className="text-muted small">{settings?.university_name_tamil || 'பெரியார் பல்கலைக்கழகம்'}</p>
          </div>
          
          <div className="login-title text-center mb-4 text-teal">New Password</div>
          
          <form onSubmit={handleSubmit} noValidate>
            {/* New Password */}
            <div className="form-group mb-3 position-relative">
              <label className="form-label d-flex align-items-center gap-2">
                <Lock size={16} className="text-teal" /> New Password
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="position-absolute border-0 bg-transparent"
                style={{ right: '12px', top: '34px', cursor: 'pointer', color: '#94a3b8' }}
                onClick={() => setShowPwd(!showPwd)}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password Strength Indicator Bar */}
            {password && (
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="small text-muted">Password Strength:</span>
                  <span className={`small fw-bold ${strength.color.replace('bg-', 'text-')}`}>
                    {strength.label}
                  </span>
                </div>
                <div className="progress" style={{ height: '6px' }}>
                  <div 
                    className={`progress-bar ${strength.color}`} 
                    role="progressbar" 
                    style={{ width: `${(strength.score / 5) * 100}%`, transition: 'width 0.3s ease' }}
                    aria-valuenow={strength.score}
                    aria-valuemin="0"
                    aria-valuemax="5"
                  />
                </div>
              </div>
            )}

            {/* Real-time Checklist */}
            <div className="mb-4 bg-light p-3 border rounded shadow-sm">
              <div className="row g-2">
                <div className="col-12 small d-flex align-items-center gap-2">
                  {checks.length ? <CheckCircle2 size={14} className="text-success" /> : <XCircle size={14} className="text-danger" />}
                  <span>8+ characters minimum</span>
                </div>
                <div className="col-6 small d-flex align-items-center gap-2">
                  {checks.upper ? <CheckCircle2 size={14} className="text-success" /> : <XCircle size={14} className="text-danger" />}
                  <span>Uppercase [A-Z]</span>
                </div>
                <div className="col-6 small d-flex align-items-center gap-2">
                  {checks.lower ? <CheckCircle2 size={14} className="text-success" /> : <XCircle size={14} className="text-danger" />}
                  <span>Lowercase [a-z]</span>
                </div>
                <div className="col-6 small d-flex align-items-center gap-2">
                  {checks.number ? <CheckCircle2 size={14} className="text-success" /> : <XCircle size={14} className="text-danger" />}
                  <span>Numeric [0-9]</span>
                </div>
                <div className="col-6 small d-flex align-items-center gap-2">
                  {checks.special ? <CheckCircle2 size={14} className="text-success" /> : <XCircle size={14} className="text-danger" />}
                  <span>Special character</span>
                </div>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="form-group mb-4 position-relative">
              <label className="form-label d-flex align-items-center gap-2">
                <Lock size={16} className="text-teal" /> Confirm Password
              </label>
              <input
                type={showConfirmPwd ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="position-absolute border-0 bg-transparent"
                style={{ right: '12px', top: '34px', cursor: 'pointer', color: '#94a3b8' }}
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
              >
                {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button 
              type="submit" 
              className="btn btn-dark w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              disabled={loading || strength.score < 5 || password !== confirmPassword}
              style={{ background: '#364150' }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving Password...
                </>
              ) : (
                'Reset My Password'
              )}
            </button>

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
