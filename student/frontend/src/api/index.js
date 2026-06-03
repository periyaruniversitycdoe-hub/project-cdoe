import axios from 'axios'
import useAuthStore from '../store/authStore'

const API_URL = (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  headers: { 'bypass-tunnel-reminder': 'true' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const authAPI = {
  login:          (d) => api.post('/auth/login', d),
  register:       (d) => api.post('/auth/register', d),
  logout:         () => api.post('/auth/logout'),
  forgotPassword: (d) => api.post('/auth/forgot-password', d),
  resetPassword:  (d) => api.post('/auth/reset-password', d),
}

export default api
