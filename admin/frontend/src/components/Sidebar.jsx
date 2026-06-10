
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Settings, ListTree, UploadCloud, LogOut,
  ChevronRight, Ticket, CalendarRange, MapPin, GraduationCap,
  IndianRupee, CreditCard, UserCheck, BookOpen, X, Award, Users,
  BarChart3, ShieldCheck, UserSquare2, Building2, Database, History, Layers, KeyRound,
  Home, ClipboardList, MessageCircle, GitFork
} from 'lucide-react';
import { useSession } from '../contexts/SessionContext';

const menuStructure = [
  {
    group: '',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',             path: '/' },
    ]
  },
  {
    group: 'ENTRANCE EXAM FLOW',
    items: [
      { icon: FileText,        label: 'Applications',          path: '/applications' },
      { icon: CreditCard,      label: 'Payment Management',    path: '/payment-management' },
      { icon: Ticket,          label: 'Hall Ticket Generation',path: '/hall-ticket' },
      { icon: UserCheck,       label: 'Attendance Management', path: '/attendance-management' },
      { icon: BookOpen,        label: 'Entrance Marks',        path: '/entrance-marks' },
      { icon: BarChart3,       label: 'Results Management',    path: '/results-management' },
    ]
  },
  {
    group: 'MANAGEMENT',
    items: [
      { icon: BarChart3,       label: 'Reports & Analytics',   path: '/reports' },
      { icon: Users,           label: 'Student Tracking',      path: '/students' },
      { icon: GraduationCap,   label: 'Counselling Mgmt',      path: '/counselling' },
      { icon: ClipboardList,   label: 'Permission Review',      path: '/permission-review' },
      { icon: ListTree,        label: 'Roster',                    path: '/roster' },
      { icon: ShieldCheck,     label: 'Direct Pass Rules',     path: '/qualification-rules' },
      { icon: Award,           label: 'Qualifications',         path: '/qualifications' },
      { icon: CalendarRange,   label: 'Session Management',    path: '/sessions' },
      { icon: MapPin,          label: 'Location Management',   path: '/locations' },
      { icon: IndianRupee,     label: 'Community Fees',        path: '/community-fees' },
      { icon: ListTree,        label: 'Part-Time Configs',     path: '/part-time-configurations' },
      { icon: ListTree,        label: 'Dropdown Management',   path: '/dropdowns' },
      { icon: GraduationCap,  label: 'Eligibility Mgmt',      path: '/eligibility' },
      { icon: Settings,        label: 'University Settings',   path: '/settings' },
      { icon: UploadCloud,     label: 'Upload Settings',       path: '/uploads' },
    ]
  },
  {
    group: 'SUPERVISOR & CENTRES',
    items: [
      { icon: Layers,          label: 'Institute Master',      path: '/institute-master' },
      { icon: UserSquare2,     label: 'Supervisors',           path: '/supervisors' },
      { icon: ClipboardList,   label: 'Supervisor Tracking',   path: '/supervisor-tracking' },
      { icon: Building2,       label: 'Research Centres',      path: '/research-centres' },
      { icon: ClipboardList,   label: 'Centre Tracking',       path: '/centre-tracking' },
      { icon: Database,        label: 'Supervisor Masters',    path: '/supervisor-masters' },
    ]
  },
  {
    group: 'COMMUNICATION',
    items: [
      { icon: MessageCircle,   label: 'Chatbot & Knowledge Base', path: '/chatbot-management' },
      { icon: BookOpen,        label: 'News & Announcements',  path: '/news-announcements' },
      { icon: Layers,          label: 'Email Categories',       path: '/email-templates' },
      { icon: Database,        label: 'Email Services',        path: '/email-services' },
      { icon: History,         label: 'Email Logs',            path: '/email-logs' },
      { icon: GitFork,         label: 'Email Delivery Log',    path: '/email-delivery-log' },
    ]
  },
  {
    group: 'USER MANAGEMENT',
    items: [
      { icon: KeyRound,        label: 'Credential Monitor',    path: '/credential-management' },
    ]
  },
  {
    group: 'STUDENT PORTAL',
    items: [
      { icon: Home,            label: 'Portal Home Manager',   path: '/portal-home' },
    ]
  }
];

const Sidebar = ({ isOpen, onClose }) => {
  const { activeSession } = useSession();
  const [settings, setSettings] = React.useState(null);

  React.useEffect(() => {
    const ac = new AbortController();
    fetch(
      (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/settings',
      { signal: ac.signal }
    )
      .then(r => r.json())
      .then(res => setSettings(res.success ? res.data : res))
      .catch(err => { if (err.name !== 'AbortError') { /* network error — logo stays null */ } });
    return () => ac.abort();
  }, []);

  const handleLogout = () => {
    if (window.confirm('Are you sure want to logout?')) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminRefreshToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/login';
    }
  };

  return (
    <div className={`admin-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-logo" style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src={settings?.logo?.startsWith('/uploads') ? `${import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001'}${settings.logo}` : settings?.logo || '/images/pu_logo.png'} 
            alt="University Logo" 
            style={{ width: 35, height: 35, objectFit: 'contain' }} 
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 16, marginBottom: 0, lineHeight: 1.2 }}>ERP ADMIN</h3>
            <span style={{ fontSize: 9, color: '#32c5d2', fontWeight: '700', letterSpacing: '0.5px' }}>
              {settings?.university_name_english || 'PERIYAR UNIVERSITY'}
            </span>
          </div>
        </div>
        <button className="btn d-lg-none ms-auto text-white p-0 border-0 bg-transparent" onClick={onClose} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>

      {/* Session Status Widget */}
      <div
        className="mx-2 mb-1 mt-2 p-2 rounded"
        style={{
          background: activeSession ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
          border: `1px solid ${activeSession ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          fontSize: 11,
        }}
      >
        <div className="d-flex align-items-center gap-1 mb-1">
          <span
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: activeSession ? '#10b981' : '#ef4444',
              display: 'inline-block', flexShrink: 0,
            }}
          />
          <span className="fw-bold text-truncate" style={{ color: activeSession ? '#ffffff' : '#fca5a5' }}>
            {activeSession ? `${activeSession.month} ${activeSession.year}` : 'No Active Session'}
          </span>
        </div>
        {activeSession && (
          <div className="d-flex gap-2" style={{ paddingLeft: 12 }}>
            <span style={{ color: activeSession.registration_open ? '#4ade80' : '#9ca3af', fontSize: 10 }}>
              {activeSession.registration_open ? '● Reg' : '○ Reg'}
            </span>
            <span style={{ color: activeSession.application_open ? '#4ade80' : '#9ca3af', fontSize: 10 }}>
              {activeSession.application_open ? '● App' : '○ App'}
            </span>
            <span style={{ color: activeSession.result_published ? '#4ade80' : '#9ca3af', fontSize: 10 }}>
              {activeSession.result_published ? '● Res' : '○ Res'}
            </span>
          </div>
        )}
      </div>

      <div className="sidebar-nav mt-1">
        {menuStructure.map((group, gIdx) => (
          <div key={gIdx} style={{ marginBottom: group.group ? '15px' : '5px' }}>
            {group.group && (
              <div 
                style={{ 
                  color: '#9ca3af', 
                  fontSize: '0.65rem', 
                  fontWeight: '700', 
                  letterSpacing: '0.8px', 
                  padding: '5px 20px', 
                  marginBottom: '2px',
                  textTransform: 'uppercase'
                }}
              >
                {group.group}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <item.icon size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                <ChevronRight size={14} className="chevron" />
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar-logout">
        <button
          onClick={handleLogout}
          className="nav-link border-0 bg-transparent w-100 text-start"
          style={{ color: '#e7505a' }}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
