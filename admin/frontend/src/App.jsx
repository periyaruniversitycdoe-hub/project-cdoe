
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { SessionProvider } from './contexts/SessionContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import Settings from './pages/Settings';
import Dropdowns from './pages/Dropdowns';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import VerifyOtp from './pages/VerifyOtp';
import ResetPassword from './pages/ResetPassword';
import ApplicationDetail from './pages/ApplicationDetail';
import Uploads from './pages/Uploads';
import HallTickets from './pages/HallTickets';
import HallTicketPrint from './pages/HallTicketPrint';
import AdminApplicationForm from './pages/AdminApplicationForm';
import AdminAddApplication from './pages/AdminAddApplication';
import SessionManagement from './pages/SessionManagement';
import LocationManagement from './pages/LocationManagement';
import CounsellingManagement from './pages/CounsellingManagement';
import CommunityFees from './pages/CommunityFees';
import PaymentManagement from './pages/PaymentManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import EntranceMarks from './pages/EntranceMarks';
import ResultsManagement from './pages/ResultsManagement';
import QualificationManagement from './pages/QualificationManagement';
import DirectPassRules from './pages/DirectPassRules';
import StudentTracking from './pages/StudentTracking';
import JoiningLetterPrint from './pages/JoiningLetterPrint';
import PartTimeConfigurations from './pages/PartTimeConfigurations';
import EligibilityManagement from './pages/EligibilityManagement';
import SupervisorManagement, {
  SupervisorAddPage,
  SupervisorEditPage,
} from '@supervisor/pages/SupervisorManagement';
import CentreManagement from '@center/pages/CentreManagement';
import SupervisorMasterManagement from '@supervisor/pages/SupervisorMasterManagement';
import InstituteMaster from './pages/InstituteMaster';
import EmailServicesPage from './modules/admin/email-services/pages/EmailServicesPage';
import EditEmailServicePage from './modules/admin/email-services/pages/EditEmailServicePage';
import EmailLogsPage from './modules/admin/email-services/pages/EmailLogsPage';
import EmailTemplateListPage from './modules/admin/email-builder/pages/EmailTemplateListPage';
import CredentialManagement from './pages/CredentialManagement';
import Reports from './pages/Reports';
import PortalHomeManagement from './pages/PortalHomeManagement';

// Global 401 interceptor — clears stale token and forces re-login
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginCall = error.config?.url?.includes('/auth/login');
      if (!isLoginCall) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('adminToken');
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

const ProtectedPrintRoute = ({ children }) => {
  const token = localStorage.getItem('adminToken');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <SessionProvider>
    <Router basename={import.meta.env.BASE_URL}>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
        <Route path="/applications/:id" element={<ProtectedRoute><ApplicationDetail /></ProtectedRoute>} />
        <Route path="/applications/new" element={<ProtectedRoute><AdminAddApplication /></ProtectedRoute>} />
        <Route path="/applications/edit/:id" element={<ProtectedRoute><AdminApplicationForm /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/dropdowns" element={<ProtectedRoute><Dropdowns /></ProtectedRoute>} />
        <Route path="/uploads" element={<ProtectedRoute><Uploads /></ProtectedRoute>} />
        <Route path="/hall-ticket" element={<ProtectedRoute><HallTickets /></ProtectedRoute>} />
        <Route path="/sessions" element={<ProtectedRoute><SessionManagement /></ProtectedRoute>} />
        <Route path="/locations" element={<ProtectedRoute><LocationManagement /></ProtectedRoute>} />
        <Route path="/counselling/joining-letter/:id" element={<ProtectedPrintRoute><JoiningLetterPrint /></ProtectedPrintRoute>} />
        <Route path="/counselling/*" element={<ProtectedRoute><CounsellingManagement /></ProtectedRoute>} />
        <Route path="/community-fees" element={<ProtectedRoute><CommunityFees /></ProtectedRoute>} />
        <Route path="/payment-management" element={<ProtectedRoute><PaymentManagement /></ProtectedRoute>} />
        <Route path="/attendance-management" element={<ProtectedRoute><AttendanceManagement /></ProtectedRoute>} />
        <Route path="/entrance-marks" element={<ProtectedRoute><EntranceMarks /></ProtectedRoute>} />
        <Route path="/results-management" element={<ProtectedRoute><ResultsManagement /></ProtectedRoute>} />
        <Route path="/qualification-rules" element={<ProtectedRoute><DirectPassRules /></ProtectedRoute>} />
        <Route path="/qualifications" element={<ProtectedRoute><QualificationManagement /></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute><StudentTracking /></ProtectedRoute>} />
        <Route path="/part-time-configurations" element={<ProtectedRoute><PartTimeConfigurations /></ProtectedRoute>} />
        <Route path="/eligibility" element={<ProtectedRoute><EligibilityManagement /></ProtectedRoute>} />
        <Route path="/supervisors"          element={<ProtectedRoute><SupervisorManagement /></ProtectedRoute>} />
        <Route path="/supervisors/new"      element={<ProtectedRoute><SupervisorAddPage  /></ProtectedRoute>} />
        <Route path="/supervisors/edit/:id" element={<ProtectedRoute><SupervisorEditPage /></ProtectedRoute>} />
        <Route path="/research-centres" element={<ProtectedRoute><CentreManagement /></ProtectedRoute>} />
        <Route path="/supervisor-masters" element={<ProtectedRoute><SupervisorMasterManagement /></ProtectedRoute>} />
        <Route path="/institute-master"   element={<ProtectedRoute><InstituteMaster /></ProtectedRoute>} />

        <Route path="/hall-ticket/print/:id" element={<ProtectedPrintRoute><HallTicketPrint /></ProtectedPrintRoute>} />
        
        {/* Email Service Management */}
        <Route path="/email-services" element={<ProtectedRoute><EmailServicesPage /></ProtectedRoute>} />
        <Route path="/email-services/add" element={<ProtectedRoute><EditEmailServicePage /></ProtectedRoute>} />
        <Route path="/email-services/edit/:id" element={<ProtectedRoute><EditEmailServicePage /></ProtectedRoute>} />
        <Route path="/email-logs" element={<ProtectedRoute><EmailLogsPage /></ProtectedRoute>} />

        {/* Email Categories Management */}
        <Route path="/email-templates" element={<ProtectedRoute><EmailTemplateListPage /></ProtectedRoute>} />

        {/* User Credential Management */}
        <Route path="/credential-management" element={<ProtectedRoute><CredentialManagement /></ProtectedRoute>} />

        {/* Enterprise Reports & Analytics Engine */}
        <Route path="/reports/*" element={<ProtectedRoute><Reports /></ProtectedRoute>} />

        {/* Portal Home Management */}
        <Route path="/portal-home" element={<ProtectedRoute><PortalHomeManagement /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </SessionProvider>
  );
}

export default App;
