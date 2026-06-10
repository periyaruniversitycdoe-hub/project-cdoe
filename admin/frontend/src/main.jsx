import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './index.css'
import App from './App.jsx'

// Bypass localtunnel reminder page for all fetch-based API calls
const _nativeFetch = window.fetch;
window.fetch = (url, opts = {}) => {
  opts.headers = { 'bypass-tunnel-reminder': 'true', ...(opts.headers || {}) };
  return _nativeFetch(url, opts);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
