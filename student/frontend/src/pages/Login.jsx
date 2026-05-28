import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { authAPI } from '../api'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

const BG_IMAGES = [
  '/images/bg/1.png',
  '/images/bg/2.jpg',
  '/images/bg/3.jpg',
]

export default function LoginPage() {
  const navigate  = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuthStore()
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [bgIndex, setBgIndex] = useState(0)
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    const ac = new AbortController();
    fetch((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/settings', { signal: ac.signal })
      .then(r => r.json())
      .then(res => setSettings(res.success ? res.data : res))
      .catch(err => { if (err?.name !== 'AbortError') console.error(err); });
    return () => ac.abort();
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

  useEffect(() => {
    const id = setInterval(() => {
      setBgIndex(prev => (prev + 1) % BG_IMAGES.length)
    }, 4500)
    return () => clearInterval(id)
  }, [])

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const res = await authAPI.login(data)
      const { token, user } = res.data.data
      login(user, token)
      toast.success(`Welcome back!`)
      
      // Determine redirection target
      const redirectTarget = searchParams.get('redirect') || '/dashboard'
      navigate(redirectTarget)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials')
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
            <p className="text-muted small">{settings?.university_name_tamil || 'பெரியார் பல்கலைக்கழகம்'}</p>
          </div>
          
          <div className="login-title text-center mb-4 text-teal">Login to your account</div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group mb-3">
              <label className="form-label">Username / Email</label>
              <input
                type="text"
                className={`form-control ${errors.username ? 'is-invalid' : ''}`}
                placeholder="Enter username or email"
                {...register('username')}
              />
              {errors.username && <div className="form-error">{errors.username.message}</div>}
            </div>

            <div className="form-group mb-4 position-relative">
              <label className="form-label">Password</label>
              <input
                type={showPwd ? 'text' : 'password'}
                className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                placeholder="Enter password"
                {...register('password')}
              />
              <button
                type="button"
                className="position-absolute border-0 bg-transparent"
                style={{ right: '10px', top: '32px' }}
                onClick={() => setShowPwd(!showPwd)}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {errors.password && <div className="form-error">{errors.password.message}</div>}
            </div>

            <div className="d-flex justify-content-end mb-3">
              <Link to="/forgot-password" className="text-decoration-none small text-teal">
                Forgot your password?
              </Link>
            </div>

            <button 
              type="submit" 
              className="btn btn-dark w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              disabled={loading}
              style={{ background: '#364150' }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Logging in...</> : 'Login'}
            </button>
          </form>

        </div>
      </motion.div>

    </div>
  )
}
