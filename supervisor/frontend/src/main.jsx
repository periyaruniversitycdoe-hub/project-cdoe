import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { Toaster } from 'react-hot-toast'

// Bypass localtunnel reminder page for all fetch-based API calls
const _nativeFetch = window.fetch;
window.fetch = (url, opts = {}) => {
  opts.headers = { 'bypass-tunnel-reminder': 'true', ...(opts.headers || {}) };
  return _nativeFetch(url, opts);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, fontWeight: 500 },
        success: { style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' } },
        error: { style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } },
      }}
    />
  </React.StrictMode>
)
