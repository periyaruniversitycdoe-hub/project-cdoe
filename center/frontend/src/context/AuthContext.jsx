import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = `(import.meta.env.VITE_CENTER_API_URL || 'http://localhost:5003') + '/api`;
const AuthContext = createContext(null);

const _interceptorIds = { req: null, res: null };

function setupInterceptors(logoutFn) {
  if (_interceptorIds.req !== null) axios.interceptors.request.eject(_interceptorIds.req);
  if (_interceptorIds.res !== null) axios.interceptors.response.eject(_interceptorIds.res);

  _interceptorIds.req = axios.interceptors.request.use(config => config, err => Promise.reject(err));
  _interceptorIds.res = axios.interceptors.response.use(
    res => res,
    err => {
      const status = err.response?.status;
      const isAuthCall = err.config?.url?.includes('/auth/');
      if (status === 401 && !isAuthCall) {
        logoutFn();
        toast.error('Session expired. Please log in again.');
      } else if (status === 403) {
        toast.error('Access denied.');
      } else if (status === 500) {
        toast.error('Server error. Please try again later.');
      } else if (!err.response) {
        toast.error('Network error. Check your connection.');
      }
      return Promise.reject(err);
    }
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ct_token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('ct_token');
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
    localStorage.setItem('ct_token', data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setToken(data.token);
    setUser(data.user);
    toast.success(`Welcome back, ${data.user?.name?.split(' ')[0] || 'Admin'}!`);
    return data;
  }

  async function signup(name, email, password, mobile) {
    const { data } = await axios.post(`${API}/auth/signup`, { name, email, password, mobile });
    localStorage.setItem('ct_token', data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setToken(data.token);
    setUser(data.user);
    toast.success('Centre account created successfully!');
    return data;
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
