import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, ArrowLeft, Loader2 } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    const ac = new AbortController();
    fetch((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/settings', { signal: ac.signal })
      .then(r => r.json())
      .then(res => setSettings(res.success ? res.data : res))
      .catch(err => { if (err?.name !== 'AbortError') console.error(err); });
    return () => ac.abort();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) {
      toast.error('Please enter your email address.')
      return
    }

    setLoading(true)
    try {
      const res = await axios.post((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/auth/forgot-password', { email })
      if (res.data.success) {
        toast.success(res.data.message || 'OTP sent successfully!')
        // Redirect to verify-otp with email in query parameter
        navigate(`/verify-otp?email=${encodeURIComponent(email)}`)
      } else {
        toast.error(res.data.message || 'Failed to send OTP.')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email address not registered or server error.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Background slide */}
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
              src={settings?.logo?.startsWith('/uploads') ? `((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '')${settings.logo}` : settings?.logo || "/images/pu_logo.png"} 
              alt="Logo" 
              style={{ height: '80px', marginBottom: '10px', objectFit: 'contain' }} 
            />
            <h3 className="fw-bold text-primary">{settings?.university_name_english || 'PERIYAR UNIVERSITY'}</h3>
            <p className="text-muted small">{settings?.university_name_tamil || 'பெரியார் பல்கலைக்கழகம்'}</p>
          </div>
          
          <div className="login-title text-center mb-4 text-teal">Forgot Password</div>
          
          <p className="text-muted text-center small mb-4">
            Enter your registered email address below. We'll send you a 4-digit One-Time Password (OTP) to verify your identity.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group mb-4">
              <label className="form-label d-flex align-items-center gap-2">
                <Mail size={16} className="text-teal" /> Email Address
              </label>
              <input
                type="email"
                className="form-control"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-dark w-100 py-2 mb-3 d-flex align-items-center justify-content-center gap-2"
              disabled={loading}
              style={{ background: '#364150' }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending OTP...
                </>
              ) : (
                'Send OTP Code'
              )}
            </button>

            <Link 
              to="/login" 
              className="d-flex align-items-center justify-content-center gap-2 text-teal text-decoration-none small mt-3"
            >
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
