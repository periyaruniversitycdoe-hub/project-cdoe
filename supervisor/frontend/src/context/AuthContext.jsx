import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = (import.meta.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002') + '/api';
const AuthContext = createContext(null);

const _interceptorIds = { req: null, res: null };
let _isRefreshing = false;
let _refreshQueue = [];

function _processQueue(err, token) {
  _refreshQueue.forEach(({ resolve, reject }) => err ? reject(err) : resolve(token));
  _refreshQueue = [];
}

function setupInterceptors(logoutFn) {
  if (_interceptorIds.req !== null) axios.interceptors.request.eject(_interceptorIds.req);
  if (_interceptorIds.res !== null) axios.interceptors.response.eject(_interceptorIds.res);

  _interceptorIds.req = axios.interceptors.request.use(config => config, err => Promise.reject(err));

  _interceptorIds.res = axios.interceptors.response.use(
    res => res,
    async err => {
      const original = err.config;
      const status = err.response?.status;
      const isAuthEndpoint = original?.url?.includes('/auth/');

      if (status === 401 && !original?._retry && !isAuthEndpoint) {
        if (_isRefreshing) {
          return new Promise((resolve, reject) => {
            _refreshQueue.push({ resolve, reject });
          }).then(token => {
            original.headers['Authorization'] = `Bearer ${token}`;
            return axios(original);
          }).catch(e => Promise.reject(e));
        }

        original._retry = true;
        _isRefreshing = true;

        const refreshToken = localStorage.getItem('sv_refresh_token');
        if (!refreshToken) {
          logoutFn();
          _isRefreshing = false;
          toast.error('Session expired. Please log in again.');
          return Promise.reject(err);
        }

        try {
          const { data } = await axios.post(`${API}/auth/refresh`, { refreshToken });
          const newAccess = data.accessToken;
          localStorage.setItem('sv_token', newAccess);
          if (data.refreshToken) localStorage.setItem('sv_refresh_token', data.refreshToken);
          axios.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
          _processQueue(null, newAccess);
          original.headers['Authorization'] = `Bearer ${newAccess}`;
          return axios(original);
        } catch (refreshErr) {
          _processQueue(refreshErr, null);
          logoutFn();
          toast.error('Session expired. Please log in again.');
          return Promise.reject(refreshErr);
        } finally {
          _isRefreshing = false;
        }
      }

      if (status === 403) {
        toast.error('Access denied.');
      } else if (status === 500) {
        toast.error('Server error. Please try again later.');
      } else if (!err.response && !axios.isCancel(err)) {
        toast.error('Network error. Check your connection.');
      }

      return Promise.reject(err);
    }
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('sv_token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('sv_token');
    localStorage.removeItem('sv_refresh_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setupInterceptors(logout);
  }, [logout]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [token]);

  async function fetchMe() {
    try {
      const { data } = await axios.get(`${API}/portal/me`);
      setUser(data);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const { data } = await axios.post(`${API}/auth/login`, { email, password });
    const accessToken = data.accessToken || data.token;
    localStorage.setItem('sv_token', accessToken);
    if (data.refreshToken) localStorage.setItem('sv_refresh_token', data.refreshToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setToken(accessToken);
    setUser(data.user);
    toast.success(`Welcome back, ${data.user?.name?.split(' ')[0] || 'Supervisor'}!`);
    return data;
  }

  async function signup(name, email, password, mobile) {
    const { data } = await axios.post(`${API}/auth/signup`, { name, email, password, mobile });
    const accessToken = data.accessToken || data.token;
    localStorage.setItem('sv_token', accessToken);
    if (data.refreshToken) localStorage.setItem('sv_refresh_token', data.refreshToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setToken(accessToken);
    setUser(data.user);
    toast.success('Account created successfully!');
    return data;
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
