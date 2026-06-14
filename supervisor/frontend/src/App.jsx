import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import ChatbotWidget from '../../../shared/components/ChatbotWidget';

const SUPERVISOR_API = import.meta.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002';
function SupervisorChatbot() {
  const { user, token } = useAuth();
  return <ChatbotWidget apiUrl={SUPERVISOR_API} portalKey="supervisor"
    userInfo={user ? { id: user.id, name: user.name, email: user.email } : null} token={token} />;
}
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import VerifyOtp from './pages/VerifyOtp';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ApplicationForm from './pages/ApplicationForm';
import PermissionAssignedApplications from './pages/PermissionAssignedApplications';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:18,color:'#6366f1' }}>Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <SupervisorChatbot />
        <Routes>
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
          <Route path="/verify-otp" element={<GuestRoute><VerifyOtp /></GuestRoute>} />
          <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="apply" element={<ApplicationForm />} />
            <Route path="permission-applications" element={<PermissionAssignedApplications />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}
