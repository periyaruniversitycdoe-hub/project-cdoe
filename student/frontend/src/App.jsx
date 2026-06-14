import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

// Global 401 interceptor — expired/invalid token → clear session and redirect to login
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginCall = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
      if (!isLoginCall) {
        localStorage.removeItem('rsm-auth');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
import { SettingsProvider } from './context/SettingsContext';
import Register from './pages/Register';
import Login from './pages/Login';
import StudentHome from './pages/StudentHome';
import ForgotPassword from './pages/ForgotPassword';
import VerifyOtp from './pages/VerifyOtp';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import ApplicationForm from './pages/ApplicationForm';
import useAuthStore from './store/authStore';

import HallTicket from './pages/HallTicket';
import CounsellingApplication from './pages/CounsellingApplication';
import Profile from './pages/Profile';
import FinalReview from './pages/FinalReview';
import Payment from './pages/Payment';
import PaymentCallback from './pages/PaymentCallback';
import VerifyReceipt from './pages/VerifyReceipt';
import ReceiptView from './pages/ReceiptView';
import Layout from './components/layout/Layout';
import ChatbotWidget from '../../../shared/components/ChatbotWidget';

const STUDENT_API = import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000';

function StudentChatbot() {
  const { user } = useAuthStore();
  const token = localStorage.getItem('rsm-auth');
  return (
    <ChatbotWidget
      apiUrl={STUDENT_API}
      portalKey="student"
      userInfo={user ? { id: user.id, name: user.full_name || user.name, email: user.email } : null}
      token={token}
    />
  );
}

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuthStore();
    const location = useLocation();
    return isAuthenticated ? children : <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
};

function App() {
  return (
    <SettingsProvider>
    <Router basename={import.meta.env.BASE_URL}>
      <Toaster position="top-right" />
      <StudentChatbot />
      <div className="bg-light" style={{ minHeight: '100vh' }}>
        <Routes>
          <Route path="/home" element={<StudentHome />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-receipt" element={<VerifyReceipt />} />
          
          <Route path="/payment/receipt/:orderId" element={<ProtectedRoute><ReceiptView /></ProtectedRoute>} />
          <Route path="/payment/receipt-by-app/*" element={<ProtectedRoute><ReceiptView /></ProtectedRoute>} />
          
          {/* Protected Routes sharing the same Layout */}
          <Route element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/apply" element={<ApplicationForm />} />
            <Route path="/hall-ticket" element={<HallTicket />} />
            <Route path="/counselling" element={<CounsellingApplication />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/review" element={<FinalReview />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/payment/callback" element={<PaymentCallback />} />
          </Route>

          <Route path="/" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
    </Router>
    </SettingsProvider>
  );
}

export default App;
