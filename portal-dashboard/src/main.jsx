import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Bypass localtunnel reminder page for all fetch-based API calls
const _nativeFetch = window.fetch;
window.fetch = (url, opts = {}) => {
  opts.headers = { 'bypass-tunnel-reminder': 'true', ...(opts.headers || {}) };
  return _nativeFetch(url, opts);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
