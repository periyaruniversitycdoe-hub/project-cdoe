import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import ChatbotWidget from '../../shared/components/ChatbotWidget';
import AdminRedirect from './components/AdminRedirect';

function App() {
  return (
    <Router>
      <ChatbotWidget
        apiUrl={import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000'}
        portalKey="public"
      />
      <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f9' }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* Dev mode: /admin and /admin/* redirect to the Admin dev server.
              Production: Nginx intercepts these paths — this route is never hit. */}
          <Route path="/admin" element={<AdminRedirect />} />
          <Route path="/admin/*" element={<AdminRedirect />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
