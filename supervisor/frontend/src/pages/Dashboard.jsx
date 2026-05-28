import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  Users, Award, ShieldCheck, Clock, ChevronRight, 
  PlusCircle, Eye, Mail
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = `(import.meta.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002') + '/api`;

const card = (bg, color) => ({
  background: bg, borderRadius: 12, padding: '20px 24px', color,
  boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', justifyContent: 'center'
});

const S = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20, marginBottom: 28 },
  statLabel: { fontSize: 13, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 },
  statVal: { fontSize: 32, fontWeight: 800, marginTop: 4 },
  statSub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
  section: { background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 20, border: '1px solid #f1f5f9' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 },
  badge: (c) => ({ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c === 'Active' || c === 'Approved' ? '#dcfce7' : (c === 'Pending' ? '#eff6ff' : '#fef9c3'), color: c === 'Active' || c === 'Approved' ? '#16a34a' : (c === 'Pending' ? '#2563eb' : '#854d0e') }),
  infoRow: { display: 'flex', gap: 12, marginBottom: 12, fontSize: 14, alignItems: 'center' },
  infoKey: { color: '#64748b', minWidth: 160, fontWeight: 500 },
  infoVal: { color: '#1e293b', fontWeight: 600 },
  noLink: { textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14, background: '#f8fafc', borderRadius: 12, border: '1.5px dashed #e2e8f0' },
  tag: { display: 'inline-block', background: '#ede9fe', color: '#5b21b6', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, margin: '4px 6px 4px 0' },
  banner: { 
    background: 'linear-gradient(135deg, #4338ca, #1e1b4b)', borderRadius: 16, padding: '24px 32px', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 20,
    boxShadow: '0 10px 25px rgba(67, 56, 202, 0.15)'
  },
  bannerBtn: { 
    background: '#fff', color: '#4338ca', border: 'none', padding: '12px 24px', borderRadius: 12, 
    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
    flexShrink: 0
  }
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [disciplines, setDisciplines] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/portal/dashboard`),
      axios.get(`${API}/portal/me`),
      axios.get(`${API}/portal/disciplines`),
      axios.get(`${API}/notifications`),
    ]).then(([d, m, disc, notif]) => {
      if (d.data && d.data.stats) setStats(d.data.stats);
      if (m.data) setProfile(m.data);
      if (disc.data) setDisciplines(disc.data);
      if (notif.data.success) setNotifications(notif.data.data);
    }).catch(err => {
      console.error('Dashboard Load Error:', err);
      // If unauthorized, logout might be handled by context, but we should at least not crash
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 100, color: '#4338ca', fontWeight: 600 }}>Loading Dashboard...</div>;
  if (!profile) return <div style={{ textAlign: 'center', padding: 100, color: '#ef4444' }}>Error loading profile. Please try logging in again.</div>;

  const appStatus = profile?.supervisor_status || 'Draft';

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Dynamic Banner based on status — Cloning Student Project Style */}
      {(!stats?.isLinked || appStatus === 'Draft') ? (
        <div style={S.banner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 14 }}>
               <PlusCircle size={32} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Apply for Recognition</h3>
              <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>Complete your supervisor profile to get recognized by the university.</p>
            </div>
          </div>
          <button style={S.bannerBtn} onClick={() => navigate('/apply')}>
            Start Application <ChevronRight size={18} />
          </button>
        </div>
      ) : appStatus === 'Pending' ? (
        <div style={{ ...S.banner, background: 'linear-gradient(135deg, #0f766e, #134e4a)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 14 }}>
               <Clock size={32} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Application Under Review</h3>
              <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>Your recognition application has been submitted and is currently being verified by the admin.</p>
            </div>
          </div>
           <button style={S.bannerBtn} onClick={() => navigate('/apply')}>
             View / Edit <Eye size={18} />
           </button>
        </div>
      ) : null}

      {appStatus === 'Rejected' && (
        <div style={{ ...S.banner, background: 'linear-gradient(135deg, #991b1b, #7f1d1d)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 14 }}>
               <Award size={32} color="#fff" strokeWidth={1.5} style={{ opacity: 0.5 }} />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Application Rejected</h3>
              <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>
                Reason: {profile?.rejection_reason || 'Please contact the research cell for details.'}
              </p>
            </div>
          </div>
           <button style={S.bannerBtn} onClick={() => navigate('/apply')}>
             Edit & Resubmit <ChevronRight size={18} />
           </button>
        </div>
      )}

      {/* DASHBOARD CONTENT GATING */}
      {appStatus !== 'Approved' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, marginTop: 20 }}>
           <div style={S.section}>
              <div style={S.sectionTitle}>
                <Clock size={20} color="#4338ca" />
                Application Progress
              </div>
              <div style={{ padding: '20px 0' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Current Status</span>
                    <span style={S.badge(appStatus)}>{appStatus}</span>
                 </div>
                 <div style={{ height: 8, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ width: appStatus === 'Pending' ? '66%' : '33%', height: '100%', background: '#4338ca', transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                 </div>
                 <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
                   {appStatus === 'Pending' 
                     ? 'Administrators are currently reviewing your documents. You will have full access once approved.'
                     : 'Please complete your application and submit it for verification.'}
                 </p>
              </div>
           </div>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div style={S.grid}>
            <div style={card('linear-gradient(135deg, #4338ca, #6366f1)', '#fff')}>
              <div style={S.statLabel}>Max Candidates</div>
              <div style={S.statVal}>{stats?.maxCandidates ?? '—'}</div>
              <div style={S.statSub}>Total: {stats?.maxFullTime} FT | {stats?.maxPartTime} PT</div>
            </div>
            <div style={card('linear-gradient(135deg, #10b981, #059669)', '#fff')}>
              <div style={S.statLabel}>Current Vacancy</div>
              <div style={S.statVal}>{stats?.currentVacancy ?? '—'}</div>
              <div style={S.statSub}>Open seats available</div>
            </div>
            <div style={card('linear-gradient(135deg, #f59e0b, #d97706)', '#fff')}>
              <div style={S.statLabel}>Disciplines</div>
              <div style={S.statVal}>{stats?.totalDisciplines ?? 0}</div>
              <div style={S.statSub}>Assigned research areas</div>
            </div>
            <div style={card('linear-gradient(135deg, #8b5cf6, #a78bfa)', '#fff')}>
              <div style={S.statLabel}>Superannuation</div>
              <div style={S.statVal}>{profile?.date_of_superannuation ? new Date(profile.date_of_superannuation).getFullYear() : '—'}</div>
              <div style={S.statSub}>Retirement year</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
            {/* Profile Summary */}
            <div style={S.section}>
              <div style={S.sectionTitle}>
                 <ShieldCheck size={20} color="#4338ca" />
                 Supervisor Profile
              </div>
              {profile?.supervisor_id ? (
                <>
                  <div style={S.infoRow}><span style={S.infoKey}>Recognition Ref</span><span style={S.infoVal}>{profile.recognition_ref_no || '—'}</span></div>
                  <div style={S.infoRow}><span style={S.infoKey}>Designation</span><span style={S.infoVal}>{profile.designation_name || '—'}</span></div>
                  <div style={S.infoRow}><span style={S.infoKey}>Department</span><span style={S.infoVal}>{profile.department_name || '—'}</span></div>
                  <div style={S.infoRow}><span style={S.infoKey}>Institute</span><span style={S.infoVal}>{profile.institute_name || '—'}</span></div>
                  <div style={S.infoRow}><span style={S.infoKey}>Account Status</span><span style={S.badge(profile.supervisor_status)}>{profile.supervisor_status}</span></div>
                  <div style={{ marginTop: 24 }}>
                     <button style={{ ...S.bannerBtn, background: '#f1f5f9', color: '#1e293b', fontSize: 13, padding: '8px 16px' }} onClick={() => navigate('/apply')}>
                        Edit Application Details
                     </button>
                  </div>
                </>
              ) : (
                <div style={S.noLink}>
                   <p style={{ margin: '0 0 16px' }}>No supervisor profile linked yet.</p>
                   <button style={{ ...S.bannerBtn, background: '#4338ca', color: '#fff', fontSize: 13, padding: '10px 20px', margin: '0 auto' }} onClick={() => navigate('/apply')}>
                      Submit Profile Now
                   </button>
                </div>
              )}
            </div>

            {/* Disciplines */}
            <div style={S.section}>
              <div style={S.sectionTitle}>
                <Award size={20} color="#4338ca" />
                Assigned Disciplines
              </div>
              {disciplines.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                   {disciplines.map(d => <span key={d.id} style={S.tag}>{d.discipline_name}</span>)}
                </div>
              ) : (
                <div style={S.noLink}>No disciplines assigned yet.</div>
              )}
            </div>
          </div>

          {/* Notifications Feed */}
          {notifications.length > 0 && (
            <div style={S.section}>
              <div style={{ ...S.sectionTitle, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={20} color="#4338ca" />
                  Recent Notifications
                </div>
                {notifications.some(n => !n.is_read) && (
                   <span style={{ fontSize: 11, background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 12 }}>New</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {notifications.slice(0, 3).map(n => (
                  <div key={n.id} style={{ 
                    padding: 16, background: n.is_read ? '#f8fafc' : '#eff6ff', 
                    borderRadius: 12, border: `1px solid ${n.is_read ? '#f1f5f9' : '#dbeafe'}`,
                    display: 'flex', gap: 14, alignItems: 'start'
                  }}>
                    <div style={{ background: n.is_read ? '#e2e8f0' : '#4338ca', color: '#fff', padding: 8, borderRadius: 10 }}>
                      <Mail size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                         <span style={{ fontWeight: 700, fontSize: 14, color: n.is_read ? '#475569' : '#1e293b' }}>{n.title}</span>
                         <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account Info */}
          <div style={S.section}>
            <div style={S.sectionTitle}>
              <Users size={20} color="#4338ca" />
              Account Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              <div style={S.infoRow}><span style={S.infoKey}>Full Name</span><span style={S.infoVal}>{profile?.name}</span></div>
              <div style={S.infoRow}><span style={S.infoKey}>Email Address</span><span style={S.infoVal}>{profile?.email}</span></div>
              <div style={S.infoRow}><span style={S.infoKey}>Mobile Number</span><span style={S.infoVal}>{profile?.mobile || '—'}</span></div>
              <div style={S.infoRow}><span style={S.infoKey}>Registration Date</span><span style={S.infoVal}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN') : '—'}</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
