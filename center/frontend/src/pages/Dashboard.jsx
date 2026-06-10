import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Building, Users, ShieldCheck, Clock, ChevronRight,
  PlusCircle, Eye, Mail, XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NewsAnnouncementsBoard from '../../../../shared/components/NewsAnnouncementsBoard';

const API = (import.meta.env.VITE_CENTER_API_URL || 'http://localhost:5003') + '/api';

const card = (bg, color = '#fff') => ({
  background: bg, borderRadius: 16, padding: '24px 28px', color,
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center'
});

const S = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24, marginBottom: 28 },
  statLabel: { fontSize: 13, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 },
  statVal: { fontSize: 32, fontWeight: 800, marginTop: 4 },
  statSub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
  section: { background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 24, border: '1px solid #f1f5f9' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' },
  th: { textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' },
  td: { padding: '16px', background: '#f8fafc', borderTop: '1.5px solid #e2e8f0', borderBottom: '1.5px solid #e2e8f0', fontSize: 14 },
  tdFirst: { borderLeft: '1.5px solid #e2e8f0', borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  tdLast: { borderRight: '1.5px solid #e2e8f0', borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  badge: (s) => ({ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: s === 'Active' || s === 'Approved' ? '#dcfce7' : (s === 'Pending' ? '#eff6ff' : '#fef9c3'), color: s === 'Active' || s === 'Approved' ? '#16a34a' : (s === 'Pending' ? '#2563eb' : '#854d0e') }),
  infoRow: { display: 'flex', gap: 12, marginBottom: 12, fontSize: 14, alignItems: 'center' },
  infoKey: { color: '#64748b', minWidth: 160, fontWeight: 500 },
  infoVal: { color: '#1e293b', fontWeight: 600 },
  noLink: { textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14, background: '#f8fafc', borderRadius: 12, border: '1.5px dashed #e2e8f0' },
  banner: { 
    background: 'linear-gradient(135deg, #0891b2, #164e63)', borderRadius: 16, padding: '24px 32px', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 20,
    boxShadow: '0 10px 25px rgba(8, 145, 178, 0.15)'
  },
  bannerBtn: { 
    background: '#fff', color: '#0891b2', border: 'none', padding: '12px 24px', borderRadius: 12, 
    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
    flexShrink: 0
  }
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [supervisors, setSupervisors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback((signal) => {
    const cfg = { signal };
    Promise.all([
      axios.get(`${API}/portal/dashboard`, cfg),
      axios.get(`${API}/portal/me`,        cfg),
      axios.get(`${API}/notifications`,    cfg),
    ]).then(([d, m, notif]) => {
      if (d.data && d.data.stats) setStats(d.data.stats);
      if (d.data) setSupervisors(d.data.recentSupervisors || []);
      if (m.data) setProfile(m.data);
      if (notif.data.success) setNotifications(notif.data.data);
    }).catch(err => {
      if (err?.code === 'ERR_CANCELED') return;   // AbortController fired — not an error
      console.error('Center Dashboard Load Error:', err);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    loadDashboard(ac.signal);
    return () => ac.abort();
  }, [loadDashboard]);

  if (loading) return <div style={{ textAlign: 'center', padding: 100, color: '#0891b2', fontWeight: 600 }}>Loading Dashboard...</div>;
  if (!profile) return <div style={{ textAlign: 'center', padding: 100, color: '#ef4444' }}>Error loading profile. Please try logging in again.</div>;

  const appStatus = profile?.centre_status || 'Draft';

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Application Banner */}
      {(!profile?.center_id || appStatus === 'Draft') ? (
        <div style={S.banner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 14 }}>
               <PlusCircle size={32} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Register Research Centre</h3>
              <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>Submit your centre details for PhD program recognition.</p>
            </div>
          </div>
          <button style={S.bannerBtn} onClick={() => navigate('/apply')}>
            Start Registration <ChevronRight size={18} />
          </button>
        </div>
      ) : appStatus === 'Pending' ? (
        <div style={{ ...S.banner, background: 'linear-gradient(135deg, #0e7490, #155e75)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 14 }}>
               <Clock size={32} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Registration Under Review</h3>
              <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>Your centre registration is being verified by the university administration.</p>
            </div>
          </div>
           <button style={S.bannerBtn} onClick={() => navigate('/apply')}>
             View / Edit <Eye size={18} />
           </button>
        </div>
      ) : null}

      {profile?.centre_status === 'Rejected' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '2px solid #fca5a5', padding: '24px 28px', marginBottom: 20, boxShadow: '0 4px 12px rgba(239,68,68,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ background: '#fef2f2', padding: 14, borderRadius: 12, flexShrink: 0 }}>
              <XCircle size={28} color="#ef4444" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#991b1b', marginBottom: 6 }}>Application Status: REJECTED</div>
              <div style={{ fontSize: 14, color: '#7f1d1d', marginBottom: 8 }}>
                <strong>Rejection Reason:</strong> {profile?.rejection_reason || 'Please contact the research cell for details.'}
              </div>
              {profile?.approved_at && (
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  Rejected on: {new Date(profile.approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              )}
              <button style={{ marginTop: 12, background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/apply')}>
                Edit &amp; Resubmit <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {profile?.centre_status === 'Suspended' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '2px solid #d1d5db', padding: '24px 28px', marginBottom: 20, boxShadow: '0 4px 12px rgba(107,114,128,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ background: '#f9fafb', padding: 14, borderRadius: 12, flexShrink: 0 }}>
              <ShieldCheck size={28} color="#6b7280" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#374151', marginBottom: 6 }}>Application Status: SUSPENDED</div>
              <div style={{ fontSize: 14, color: '#4b5563', marginBottom: 8 }}>
                <strong>Reason:</strong> {profile?.rejection_reason || 'Your centre account has been suspended. Please contact the university administration for further details.'}
              </div>
              {profile?.approved_at && (
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  Suspended on: {new Date(profile.approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              )}
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7280' }}>
                <Mail size={14} /> Please contact the research cell or university administration for assistance.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD CONTENT GATING */}
      {appStatus !== 'Approved' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
           <div style={S.section}>
              <div style={S.sectionTitle}>
                <Clock size={20} color="#0891b2" />
                Registration Progress
              </div>
              <div style={{ padding: '20px 0' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Current Status</span>
                    <span style={S.badge(appStatus)}>{appStatus}</span>
                 </div>
                 <div style={{ height: 10, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ width: appStatus === 'Pending' ? '66%' : '33%', height: '100%', background: '#0891b2', transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                 </div>
                 <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 12 }}>
                   {appStatus === 'Pending' 
                     ? 'Verification in progress. You will unlock supervisor management once the university approves your center.'
                     : 'Please submit your centre registration form for verification.'}
                 </p>
              </div>
           </div>
        </div>
      ) : (
        <>
          <div style={S.grid}>
            <div style={card('linear-gradient(135deg, #0891b2, #06b6d4)')}>
              <div style={S.statLabel}>Total Supervisors</div>
              <div style={S.statVal}>{stats?.totalSupervisors ?? '—'}</div>
              <div style={S.statSub}>Affiliated with this centre</div>
            </div>
            <div style={card('linear-gradient(135deg, #10b981, #059669)')}>
              <div style={S.statLabel}>Active Supervisors</div>
              <div style={S.statVal}>{stats?.activeSupervisors ?? '—'}</div>
              <div style={S.statSub}>Currently active</div>
            </div>
            <div style={card('linear-gradient(135deg, #6366f1, #4338ca)')}>
              <div style={S.statLabel}>Recognition Status</div>
              <div style={{ ...S.statVal, fontSize: 22 }}>{appStatus}</div>
              <div style={S.statSub}>University status</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
            {/* Centre Info */}
            <div style={S.section}>
              <div style={S.sectionTitle}>
                 <Building size={20} color="#0891b2" />
                 Centre Information
              </div>
              {profile?.center_id ? (
                <>
                  <div style={S.infoRow}><span style={S.infoKey}>Centre Name</span><span style={S.infoVal}>{profile.centre_name}</span></div>
                  <div style={S.infoRow}><span style={S.infoKey}>College code</span><span style={S.infoVal}>{profile.abbreviation || '—'}</span></div>
                  <div style={S.infoRow}><span style={S.infoKey}>Centre Ref No.</span><span style={S.infoVal}>{profile.centre_ref_no || '—'}</span></div>
                  <div style={S.infoRow}><span style={S.infoKey}>Centre Type</span><span style={S.infoVal}>{profile.centre_type_name || '—'}</span></div>
                  <div style={S.infoRow}><span style={S.infoKey}>Recognition Date</span><span style={S.infoVal}>{profile.recognition_date ? new Date(profile.recognition_date).toLocaleDateString('en-IN') : '—'}</span></div>
                  <div style={{ marginTop: 24 }}>
                     <button style={{ ...S.bannerBtn, background: '#f1f5f9', color: '#1e293b', fontSize: 13, padding: '8px 16px' }} onClick={() => navigate('/apply')}>
                        Edit Centre Details
                     </button>
                  </div>
                </>
              ) : (
                <div style={S.noLink}>No centre profile linked yet.</div>
              )}
            </div>

            {/* Account Info */}
            <div style={S.section}>
              <div style={S.sectionTitle}>
                <ShieldCheck size={20} color="#0891b2" />
                Account Details
              </div>
              <div style={S.infoRow}><span style={S.infoKey}>Admin Name</span><span style={S.infoVal}>{profile?.name}</span></div>
              <div style={S.infoRow}><span style={S.infoKey}>Email Address</span><span style={S.infoVal}>{profile?.email}</span></div>
              <div style={S.infoRow}><span style={S.infoKey}>Mobile Number</span><span style={S.infoVal}>{profile?.mobile || '—'}</span></div>
              <div style={S.infoRow}><span style={S.infoKey}>Member Since</span><span style={S.infoVal}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN') : '—'}</span></div>
            </div>
          </div>

          {/* Notifications Feed */}
          {notifications.length > 0 && (
            <div style={S.section}>
              <div style={{ ...S.sectionTitle, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={20} color="#0891b2" />
                  Centre Communications
                </div>
                {notifications.some(n => !n.is_read) && (
                   <span style={{ fontSize: 11, background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 12 }}>New Alert</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {notifications.slice(0, 3).map(n => (
                  <div key={n.id} style={{ 
                    padding: 18, background: n.is_read ? '#f8fafc' : '#f0f9ff', 
                    borderRadius: 12, border: `1px solid ${n.is_read ? '#f1f5f9' : '#0891b233'}`,
                    display: 'flex', gap: 14, alignItems: 'start'
                  }}>
                    <div style={{ background: n.is_read ? '#e2e8f0' : '#0891b2', color: '#fff', padding: 10, borderRadius: 12 }}>
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

          {/* ── News & Announcements Board ── */}
          <div style={{ marginBottom: 24 }}>
            <NewsAnnouncementsBoard
              apiBase={(import.meta.env.VITE_CENTER_API_URL || 'http://localhost:5003') + '/api'}
              accentColor="#0891b2"
            />
          </div>

          {/* Supervisors Table */}
          {supervisors.length > 0 && (
            <div style={S.section}>
              <div style={S.sectionTitle}>
                 <Users size={20} color="#0891b2" />
                 Supervisors Under This Centre
              </div>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Name</th>
                    <th style={S.th}>Supervisor No.</th>
                    <th style={S.th}>Designation</th>
                    <th style={S.th}>Vacancy</th>
                    <th style={S.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisors.map(sv => (
                    <tr key={sv.id}>
                      <td style={{ ...S.td, ...S.tdFirst, fontWeight: 700 }}>{sv.name}</td>
                      <td style={S.td}>{sv.supervisor_no || '—'}</td>
                      <td style={S.td}>{sv.designation_name || '—'}</td>
                      <td style={S.td}>{sv.current_vacancy} / {sv.max_candidates}</td>
                      <td style={{ ...S.td, ...S.tdLast }}><span style={S.badge(sv.status)}>{sv.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
