import axios from 'axios'
import useAuthStore from '../store/authStore'

const API_URL = (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const { accessToken, token } = useAuthStore.getState()
  const t = accessToken || token
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

let isRefreshing = false
let refreshQueue = []

function processQueue(error, token = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  refreshQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const is401 = err.response?.status === 401
    const isAuthEndpoint = original?.url?.includes('/auth/')

    if (is401 && !original?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        }).then((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`
          return api(original)
        }).catch((e) => Promise.reject(e))
      }

      original._retry = true
      isRefreshing = true

      const { refreshToken, logout, setTokens } = useAuthStore.getState()
      if (!refreshToken) {
        logout()
        isRefreshing = false
        return Promise.reject(err)
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
        const newAccess = data.accessToken
        setTokens(newAccess, data.refreshToken)
        processQueue(null, newAccess)
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr)
        logout()
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(err)
  }
)

export const authAPI = {
  login:          (d) => api.post('/auth/login', d),
  register:       (d) => api.post('/auth/register', d),
  logout:         () => api.post('/auth/logout'),
  forgotPassword: (d) => api.post('/auth/forgot-password', d),
  resetPassword:  (d) => api.post('/auth/reset-password', d),
}

export default api
