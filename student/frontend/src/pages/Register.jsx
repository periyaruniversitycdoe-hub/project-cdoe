import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { authAPI } from '../api'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const schema = z.object({
  full_name: z.string().min(1, 'Full Name is required'),
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

const BG_IMAGES = [
  '/images/bg/1.png',
  '/images/bg/2.jpg',
  '/images/bg/3.jpg',
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [bgIndex, setBgIndex] = useState(0)
  const [settings, setSettings] = useState(null)
  const [sessionStatus, setSessionStatus] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/settings').then(r => r.json());
        setSettings(res.success ? res.data : res);
      } catch (err) { console.error(err); }
    };
    const fetchSession = async () => {
      try {
        const res = await fetch((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/active-session').then(r => r.json());
        setSessionStatus(res.success ? res.data : null);
      } catch { setSessionStatus(null); }
      setSessionLoading(false);
    };
    fetchSettings();
    fetchSession();
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  useEffect(() => {
    const id = setInterval(() => {
      setBgIndex(prev => (prev + 1) % BG_IMAGES.length)
    }, 4500)
    return () => clearInterval(id)
  }, [])

  const registrationOpen = !sessionLoading && !!sessionStatus && !!sessionStatus.registration_open

  const onSubmit = async (data) => {
    if (!registrationOpen) {
      toast.error('Registrations are currently closed.')
      return
    }
    setLoading(true)
    try {
      await authAPI.register({
        full_name: data.full_name,
        email: data.email,
        password: data.password
      })
      toast.success('Registration successful! Redirecting to login...')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {BG_IMAGES.map((src, idx) => (
        <div
          key={src}
          className="login-bg-slide"
          style={{
            backgroundImage: `url(${src})`,
            opacity: bgIndex === idx ? 1 : 0,
          }}
        />
      ))}
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
            <p className="text-muted small">Create a New Account</p>
          </div>

          {/* Registration closed banner */}
          {!sessionLoading && (!sessionStatus || !sessionStatus.registration_open) && (
            <div className="alert alert-danger text-center mb-3 py-2 px-3" style={{ fontSize: 13, borderRadius: 8 }}>
              <strong>🔒 Registrations are currently closed.</strong><br />
              <span className="text-muted" style={{ fontSize: 12 }}>
                {sessionStatus ? 'The current session is not accepting new registrations.' : 'No active admission session is open at this time.'}
                {' '}Please contact the university for more information.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group mb-3">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className={`form-control ${errors.full_name ? 'is-invalid' : ''}`}
                placeholder="Enter your full name"
                disabled={!registrationOpen}
                {...register('full_name')}
              />
              {errors.full_name && <div className="form-error">{errors.full_name.message}</div>}
            </div>

            <div className="form-group mb-3">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                placeholder="Enter your email"
                disabled={!registrationOpen}
                {...register('email')}
              />
              {errors.email && <div className="form-error">{errors.email.message}</div>}
            </div>

            <div className="form-group mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                placeholder="Create a password"
                disabled={!registrationOpen}
                {...register('password')}
              />
              {errors.password && <div className="form-error">{errors.password.message}</div>}
            </div>

            <div className="form-group mb-4">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                placeholder="Confirm your password"
                disabled={!registrationOpen}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && <div className="form-error">{errors.confirmPassword.message}</div>}
            </div>

            <button
              type="submit"
              className="btn btn-dark w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              disabled={loading || !registrationOpen}
              style={{ background: registrationOpen ? '#364150' : '#aaa' }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Registering...</> : 'Register'}
            </button>
          </form>

          <div className="text-center mt-4 small">
            Already have an account? <Link to="/login" className="text-teal text-decoration-none">Login</Link>
          </div>
        </div>
      </motion.div>

    </div>
  )
}
