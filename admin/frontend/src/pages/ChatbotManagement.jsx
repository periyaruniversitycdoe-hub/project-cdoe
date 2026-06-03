import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  MessageCircle, Settings, BookOpen, HelpCircle, BarChart3,
  Plus, Search, Edit2, Trash2, Eye, EyeOff, RefreshCw,
  ChevronLeft, ChevronRight, Filter, X, CheckCircle, Clock,
  AlertCircle, Archive, Send, User, Globe, Lock, Users,
  ToggleLeft, ToggleRight, Tag, FileText, ExternalLink,
  Mail, Bell, Inbox, ChevronDown, ChevronUp, Save, Loader,
} from 'lucide-react';

const API   = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/chatbot';
const token = () => localStorage.getItem('adminToken');
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  primary:  '#1e3a5f', accent: '#32c5d2', success: '#10b981',
  warning:  '#f59e0b', danger: '#ef4444',  info: '#3b82f6',
  bg:       '#f4f6f9', card: '#fff',       border: '#e5e7eb',
  text:     '#1f2937', muted: '#6b7280',
};

const STATUS_MAP = {
  new:            { label: 'New',            color: '#3b82f6', bg: '#dbeafe' },
  pending_review: { label: 'Pending Review', color: '#f59e0b', bg: '#fef3c7' },
  in_progress:    { label: 'In Progress',    color: '#8b5cf6', bg: '#ede9fe' },
  answered:       { label: 'Answered',       color: '#10b981', bg: '#d1fae5' },
  published:      { label: 'Published',      color: '#059669', bg: '#d1fae5' },
  closed:         { label: 'Closed',         color: '#6b7280', bg: '#f3f4f6' },
};

const PRIORITY_MAP = {
  low:    { label: 'Low',    color: '#6b7280', bg: '#f3f4f6' },
  medium: { label: 'Medium', color: '#3b82f6', bg: '#dbeafe' },
  high:   { label: 'High',   color: '#f59e0b', bg: '#fef3c7' },
  urgent: { label: 'Urgent', color: '#ef4444', bg: '#fee2e2' },
};

const PORTAL_MAP = {
  public:     { label: 'Public Portal',   icon: '🌐' },
  student:    { label: 'Student Portal',  icon: '🎓' },
  supervisor: { label: 'Supervisor',      icon: '👨‍🏫' },
  center:     { label: 'Research Center', icon: '🏛️' },
};

function Badge({ status, map }) {
  const s = (map || STATUS_MAP)[status] || { label: status, color: C.muted, bg: '#f3f4f6' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{value ?? 0}</div>
        <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function ChatbotManagement() {
  const [tab, setTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard',  label: 'Dashboard',       icon: BarChart3 },
    { id: 'queries',    label: 'Query Management', icon: Inbox },
    { id: 'faqs',       label: 'FAQ Management',   icon: HelpCircle },
    { id: 'kb',         label: 'Knowledge Base',   icon: BookOpen },
    { id: 'settings',   label: 'Settings',         icon: Settings },
  ];

  return (
    <div style={{ padding: '20px 24px', background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.primary, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageCircle size={24} color={C.accent} /> Chatbot & Knowledge Base Management
        </h2>
        <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>
          Centralized Q&amp;A management, FAQ library, knowledge base, and portal chatbot configuration
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: C.card, borderRadius: 10,
        padding: 4, border: `1px solid ${C.border}`, marginBottom: 20, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: tab === t.id ? C.primary : 'transparent',
              color: tab === t.id ? '#fff' : C.muted, whiteSpace: 'nowrap', transition: 'all .15s' }}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard'  && <DashboardTab />}
      {tab === 'queries'    && <QueriesTab />}
      {tab === 'faqs'       && <FaqsTab />}
      {tab === 'kb'         && <KbTab />}
      {tab === 'settings'   && <SettingsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTab() {
  const [stats, setStats]   = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/queries/stats`, auth()),
      axios.get(`${API}/queries?page=1&limit=5`, auth()),
    ]).then(([s, r]) => {
      setStats(s.data.data);
      setRecent(r.data.data || []);
    }).catch(() => toast.error('Failed to load stats')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
    <Loader size={28} style={{ animation: 'spin 1s linear infinite' }} />
  </div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Stat icon={Inbox}        label="Total Queries"    value={stats?.total}         color={C.primary} />
        <Stat icon={AlertCircle}  label="New Queries"      value={stats?.new_count}     color={C.info} />
        <Stat icon={Clock}        label="Pending Review"   value={stats?.pending_count} color={C.warning} />
        <Stat icon={CheckCircle}  label="Answered"         value={(stats?.answered_count||0) + (stats?.published_count||0)} color={C.success} />
        <Stat icon={HelpCircle}   label="Active FAQs"      value={stats?.faq_count}     color={C.accent} />
        <Stat icon={BookOpen}     label="KB Articles"      value={stats?.kb_count}      color='#8b5cf6' />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.primary, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Inbox size={16} /> Recent Queries
        </h3>
        {recent.length === 0 ? (
          <p style={{ color: C.muted, textAlign: 'center', padding: 24 }}>No queries yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Ref', 'User', 'Portal', 'Question', 'Status', 'Date'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map(q => (
                <tr key={q.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px', color: C.accent, fontWeight: 600 }}>{q.query_ref}</td>
                  <td style={{ padding: '8px 12px' }}>{q.user_name || q.user_email || 'Guest'}</td>
                  <td style={{ padding: '8px 12px' }}>{PORTAL_MAP[q.portal_source]?.icon} {PORTAL_MAP[q.portal_source]?.label || q.portal_source}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 260 }}>
                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.question}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}><Badge status={q.status} /></td>
                  <td style={{ padding: '8px 12px', color: C.muted }}>{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function QueriesTab() {
  const [queries, setQueries] = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [answerModal, setAnswerModal] = useState(null);
  const [filters, setFilters] = useState({ status: '', priority: '', portal_source: '', search: '' });
  const [categories, setCategories] = useState([]);
  const LIMIT = 15;

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: pg, limit: LIMIT, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) });
      const { data } = await axios.get(`${API}/queries?${q}`, auth());
      setQueries(data.data || []);
      setTotal(data.total || 0);
      setPage(pg);
    } catch { toast.error('Failed to load queries'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(1); }, []);
  useEffect(() => {
    axios.get(`${API}/categories`, auth()).then(r => setCategories(r.data.data || [])).catch(() => {});
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/queries/${id}/status`, { status }, auth());
      toast.success('Status updated');
      load(page);
    } catch { toast.error('Update failed'); }
  };

  const deleteQuery = async (id) => {
    if (!window.confirm('Delete this query?')) return;
    try {
      await axios.delete(`${API}/queries/${id}`, auth());
      toast.success('Deleted'); load(page);
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Search</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
            <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Search queries, ref, user..."
              style={{ width: '100%', padding: '7px 8px 7px 28px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
        {[
          { key: 'status', opts: [['', 'All Status'], ...Object.entries(STATUS_MAP).map(([v, s]) => [v, s.label])] },
          { key: 'priority', opts: [['', 'All Priority'], ...Object.entries(PRIORITY_MAP).map(([v, s]) => [v, s.label])] },
          { key: 'portal_source', opts: [['', 'All Portals'], ...Object.entries(PORTAL_MAP).map(([v, s]) => [v, s.label])] },
        ].map(({ key, opts }) => (
          <div key={key} style={{ flex: '0 0 140px' }}>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>{key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
            <select value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
              style={{ width: '100%', padding: '7px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        <button onClick={() => load(1)} style={{ padding: '8px 16px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Search size={14} style={{ marginRight: 4 }} />Search
        </button>
        <button onClick={() => { setFilters({ status: '', priority: '', portal_source: '', search: '' }); setTimeout(() => load(1), 0); }}
          style={{ padding: '8px 12px', background: '#f3f4f6', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: C.primary }}>{total} Queries</span>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Loading...</div>
        ) : queries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>No queries found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Ref', 'User / Portal', 'Question', 'Status', 'Priority', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queries.map(q => (
                  <tr key={q.id} style={{ borderBottom: `1px solid ${C.border}`, transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                    <td style={{ padding: '10px 12px', color: C.accent, fontWeight: 600, whiteSpace: 'nowrap' }}>{q.query_ref}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: C.text }}>{q.user_name || 'Guest'}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{PORTAL_MAP[q.portal_source]?.icon} {PORTAL_MAP[q.portal_source]?.label}</div>
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 280 }}>
                      <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.question}</div>
                      {q.answer && <div style={{ fontSize: 11, color: C.success, marginTop: 3 }}>✓ Answered</div>}
                    </td>
                    <td style={{ padding: '10px 12px' }}><Badge status={q.status} /></td>
                    <td style={{ padding: '10px 12px' }}><Badge status={q.priority} map={PRIORITY_MAP} /></td>
                    <td style={{ padding: '10px 12px', color: C.muted, whiteSpace: 'nowrap' }}>{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setAnswerModal(q)} title="Answer"
                          style={{ padding: '5px 10px', background: C.accent, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          <Send size={12} style={{ marginRight: 3 }} />{q.answer ? 'Edit' : 'Answer'}
                        </button>
                        <button onClick={() => updateStatus(q.id, q.status === 'closed' ? 'pending_review' : 'closed')} title="Toggle Close"
                          style={{ padding: '5px 8px', background: '#f3f4f6', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer' }}>
                          {q.status === 'closed' ? <CheckCircle size={13} /> : <Archive size={13} />}
                        </button>
                        <button onClick={() => deleteQuery(q.id)} title="Delete"
                          style={{ padding: '5px 8px', background: '#fee2e2', color: C.danger, border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {total > LIMIT && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center', gap: 8 }}>
            <button onClick={() => load(page - 1)} disabled={page <= 1}
              style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 5, cursor: page > 1 ? 'pointer' : 'not-allowed', background: '#fff', color: page > 1 ? C.primary : C.muted }}>
              <ChevronLeft size={15} />
            </button>
            <span style={{ padding: '6px 12px', fontSize: 13, color: C.muted }}>Page {page} of {Math.ceil(total / LIMIT)}</span>
            <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / LIMIT)}
              style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 5, cursor: page < Math.ceil(total / LIMIT) ? 'pointer' : 'not-allowed', background: '#fff', color: page < Math.ceil(total / LIMIT) ? C.primary : C.muted }}>
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Answer Modal */}
      {answerModal && (
        <AnswerModal query={answerModal} categories={categories}
          onClose={() => setAnswerModal(null)}
          onDone={() => { setAnswerModal(null); load(page); }} />
      )}
    </div>
  );
}

function AnswerModal({ query, categories, onClose, onDone }) {
  const [answer, setAnswer]     = useState(query.answer || '');
  const [visibility, setVis]    = useState(query.visibility || 'private');
  const [publishKb, setPublishKb] = useState(false);
  const [priority, setPriority] = useState(query.priority || 'medium');
  const [catId, setCatId]       = useState(query.category_id || '');
  const [saving, setSaving]     = useState(false);

  const submit = async () => {
    if (!answer.trim()) return toast.error('Answer is required');
    setSaving(true);
    try {
      await axios.patch(`${API}/queries/${query.id}/status`, { priority, category_id: catId || null }, auth());
      await axios.post(`${API}/queries/${query.id}/answer`, { answer, visibility, publish_to_kb: publishKb }, auth());
      toast.success('Answer submitted successfully');
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit answer');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.primary }}>Answer Query — {query.query_ref}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={20} /></button>
        </div>
        <div style={{ padding: 20 }}>
          {/* Question display */}
          <div style={{ background: '#f0f9ff', borderLeft: `4px solid ${C.accent}`, padding: 14, borderRadius: 6, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
              {PORTAL_MAP[query.portal_source]?.icon} {query.user_name || 'Guest'} · {PORTAL_MAP[query.portal_source]?.label} · {new Date(query.created_at).toLocaleString('en-IN')}
            </div>
            <div style={{ fontWeight: 600, color: C.text }}>{query.question}</div>
          </div>

          {/* Meta controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                style={{ width: '100%', padding: '8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                {Object.entries(PRIORITY_MAP).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Category</label>
              <select value={catId} onChange={e => setCatId(e.target.value)}
                style={{ width: '100%', padding: '8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                <option value=''>— No Category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Answer <span style={{ color: C.danger }}>*</span></label>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={7}
              placeholder="Type your answer here..."
              style={{ width: '100%', padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          {/* Visibility */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 8 }}>Answer Visibility</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { v: 'private', icon: Lock,  label: 'Private',       desc: 'Only question owner & admin' },
                { v: 'group',   icon: Users, label: 'Group',         desc: 'All users of same portal' },
                { v: 'public',  icon: Globe, label: 'Public',        desc: 'Visible to all portals' },
              ].map(({ v, icon: Icon, label, desc }) => (
                <div key={v} onClick={() => setVis(v)}
                  style={{ flex: 1, padding: 10, border: `2px solid ${visibility === v ? C.accent : C.border}`,
                    borderRadius: 8, cursor: 'pointer', background: visibility === v ? '#f0fdff' : '#fff', transition: 'all .15s' }}>
                  <Icon size={16} color={visibility === v ? C.accent : C.muted} />
                  <div style={{ fontWeight: 600, fontSize: 12, color: visibility === v ? C.accent : C.text, marginTop: 4 }}>{label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {visibility === 'public' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14, fontSize: 13, color: C.text }}>
              <input type="checkbox" checked={publishKb} onChange={e => setPublishKb(e.target.checked)} />
              Also publish as a Knowledge Base article
            </label>
          )}
        </div>
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: '#f3f4f6', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '8px 20px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? .7 : 1 }}>
            {saving ? 'Submitting...' : 'Submit Answer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAQs TAB
// ═══════════════════════════════════════════════════════════════════════════════
function FaqsTab() {
  const [faqs, setFaqs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [modal, setModal]     = useState(null);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', category_id: '' });
  const LIMIT = 15;

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: pg, limit: LIMIT, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) });
      const { data } = await axios.get(`${API}/faqs?${q}`, auth());
      setFaqs(data.data || []); setTotal(data.total || 0); setPage(pg);
    } catch { toast.error('Failed to load FAQs'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(1); }, []);
  useEffect(() => { axios.get(`${API}/categories`).then(r => setCategories(r.data.data || [])).catch(() => {}); }, []);

  const toggle = async (id) => {
    try { await axios.patch(`${API}/faqs/${id}/toggle`, {}, auth()); load(page); }
    catch { toast.error('Failed'); }
  };
  const deleteFaq = async (id) => {
    if (!window.confirm('Delete this FAQ?')) return;
    try { await axios.delete(`${API}/faqs/${id}`, auth()); toast.success('Deleted'); load(page); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 180px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Search FAQs..." onKeyDown={e => e.key === 'Enter' && load(1)}
            style={{ width: '100%', padding: '8px 8px 8px 28px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <select value={filters.category_id} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}
          style={{ padding: '8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
          <option value=''>All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          style={{ padding: '8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
          <option value=''>All Status</option>
          <option value='active'>Active</option>
          <option value='inactive'>Inactive</option>
        </select>
        <button onClick={() => load(1)} style={{ padding: '8px 14px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Search size={14} />
        </button>
        <button onClick={() => setModal({})} style={{ padding: '8px 16px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Add FAQ
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Loading...</div> :
         faqs.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>No FAQs found. Click "Add FAQ" to create one.</div> : (
          faqs.map((f, i) => (
            <FaqRow key={f.id} faq={f} even={i%2===0}
              onEdit={() => setModal(f)} onToggle={() => toggle(f.id)} onDelete={() => deleteFaq(f.id)} />
          ))
        )}
        {total > LIMIT && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center', gap: 8 }}>
            <button onClick={() => load(page-1)} disabled={page<=1} style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 5, cursor: page>1?'pointer':'not-allowed', background: '#fff' }}><ChevronLeft size={15} /></button>
            <span style={{ padding: '6px 12px', fontSize: 13, color: C.muted }}>Page {page} of {Math.ceil(total/LIMIT)}</span>
            <button onClick={() => load(page+1)} disabled={page>=Math.ceil(total/LIMIT)} style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 5, cursor: page<Math.ceil(total/LIMIT)?'pointer':'not-allowed', background: '#fff' }}><ChevronRight size={15} /></button>
          </div>
        )}
      </div>

      {modal !== null && (
        <FaqModal faq={modal} categories={categories}
          onClose={() => setModal(null)} onDone={() => { setModal(null); load(page); }} />
      )}
    </div>
  );
}

function FaqRow({ faq, even, onEdit, onToggle, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, background: even ? '#fff' : '#f9fafb' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{faq.question}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
            {faq.category_name && <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>{faq.category_name}</span>}
            <span style={{ fontSize: 11, background: faq.status==='active'?'#d1fae5':'#f3f4f6', color: faq.status==='active'?'#059669':'#6b7280', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>{faq.status}</span>
            <span style={{ fontSize: 11, color: C.muted }}>👍 {faq.helpful_count} helpful</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ padding: '5px 10px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Edit</button>
          <button onClick={e => { e.stopPropagation(); onToggle(); }} style={{ padding: '5px 8px', background: faq.status==='active'?'#fef3c7':'#d1fae5', color: faq.status==='active'?'#d97706':'#059669', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
            {faq.status === 'active' ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ padding: '5px 8px', background: '#fee2e2', color: C.danger, border: 'none', borderRadius: 5, cursor: 'pointer' }}>
            <Trash2 size={13} />
          </button>
          {open ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 16px 14px', background: '#f0fdf4', borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, padding: '10px 0' }}>{faq.answer}</div>
        </div>
      )}
    </div>
  );
}

function FaqModal({ faq, categories, onClose, onDone }) {
  const [form, setForm] = useState({
    question: faq.question || '', answer: faq.answer || '',
    category_id: faq.category_id || '', status: faq.status || 'active',
    visibility: faq.visibility || 'public', sort_order: faq.sort_order || 0,
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!faq.id;
  const set = k => v => setForm(f => ({ ...f, [k]: v && v.target ? v.target.value : v }));

  const submit = async () => {
    if (!form.question.trim() || !form.answer.trim()) return toast.error('Question and answer are required');
    setSaving(true);
    try {
      if (isEdit) await axios.put(`${API}/faqs/${faq.id}`, form, auth());
      else        await axios.post(`${API}/faqs`, form, auth());
      toast.success(`FAQ ${isEdit ? 'updated' : 'created'}`);
      onDone();
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.primary }}>{isEdit ? 'Edit FAQ' : 'Add New FAQ'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={20} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Question *</label>
            <textarea value={form.question} onChange={set('question')} rows={3} placeholder="Enter the question..."
              style={{ width: '100%', padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Answer *</label>
            <textarea value={form.answer} onChange={set('answer')} rows={6} placeholder="Enter the answer..."
              style={{ width: '100%', padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Category</label>
              <select value={form.category_id} onChange={set('category_id')}
                style={{ width: '100%', padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                <option value=''>None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Status</label>
              <select value={form.status} onChange={set('status')}
                style={{ width: '100%', padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                <option value='active'>Active</option>
                <option value='inactive'>Inactive</option>
                <option value='archived'>Archived</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Visibility</label>
              <select value={form.visibility} onChange={set('visibility')}
                style={{ width: '100%', padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                <option value='public'>Public</option>
                <option value='group'>Group</option>
                <option value='private'>Private</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: '#f3f4f6', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '8px 20px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: saving?'not-allowed':'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : isEdit ? 'Update FAQ' : 'Create FAQ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function KbTab() {
  const [articles, setArticles] = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [modal, setModal]       = useState(null);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters]   = useState({ search: '', status: '', category_id: '' });
  const LIMIT = 12;

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: pg, limit: LIMIT, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) });
      const { data } = await axios.get(`${API}/knowledge-base?${q}`, auth());
      setArticles(data.data || []); setTotal(data.total || 0); setPage(pg);
    } catch { toast.error('Failed to load articles'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(1); }, []);
  useEffect(() => { axios.get(`${API}/categories`).then(r => setCategories(r.data.data || [])).catch(() => {}); }, []);

  const deleteArt = async (id) => {
    if (!window.confirm('Delete this article?')) return;
    try { await axios.delete(`${API}/knowledge-base/${id}`, auth()); toast.success('Deleted'); load(page); }
    catch { toast.error('Delete failed'); }
  };

  const statusColor = { draft: '#f59e0b', published: '#10b981', archived: '#6b7280' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} onKeyDown={e => e.key==='Enter'&&load(1)}
            placeholder="Search knowledge base..." style={{ width: '100%', padding: '8px 8px 8px 28px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          style={{ padding: '8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
          <option value=''>All Status</option>
          <option value='draft'>Draft</option>
          <option value='published'>Published</option>
          <option value='archived'>Archived</option>
        </select>
        <select value={filters.category_id} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}
          style={{ padding: '8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
          <option value=''>All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => load(1)} style={{ padding: '8px 14px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          <Search size={14} />
        </button>
        <button onClick={() => setModal({})} style={{ padding: '8px 16px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> New Article
        </button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>Loading...</div> :
       articles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted, background: C.card, borderRadius: 10, border: `1px solid ${C.border}` }}>
          No articles yet. Click "New Article" to create your first KB entry.
        </div>
       ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {articles.map(a => (
            <div key={a.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, background: `${statusColor[a.status] || '#6b7280'}18`, color: statusColor[a.status] || '#6b7280', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>
                  {a.status}
                </span>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => setModal(a)} style={{ padding: '4px 8px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Edit</button>
                  <button onClick={() => deleteArt(a.id)} style={{ padding: '4px 6px', background: '#fee2e2', color: C.danger, border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>{a.title}</h4>
              {a.short_description && <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.short_description}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                {a.category_name && <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: 6, fontWeight: 600 }}>{a.category_name}</span>}
                <span style={{ fontSize: 11, color: C.muted }}>👁 {a.view_count}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{new Date(a.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => load(page-1)} disabled={page<=1} style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 5, cursor: page>1?'pointer':'not-allowed', background: '#fff' }}><ChevronLeft size={15} /></button>
          <span style={{ padding: '6px 12px', fontSize: 13, color: C.muted }}>Page {page} of {Math.ceil(total/LIMIT)}</span>
          <button onClick={() => load(page+1)} disabled={page>=Math.ceil(total/LIMIT)} style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', background: '#fff' }}><ChevronRight size={15} /></button>
        </div>
      )}

      {modal !== null && (
        <KbModal article={modal} categories={categories}
          onClose={() => setModal(null)} onDone={() => { setModal(null); load(page); }} />
      )}
    </div>
  );
}

function KbModal({ article, categories, onClose, onDone }) {
  const [form, setForm] = useState({
    title: article.title || '', short_description: article.short_description || '',
    content: article.content || '', category_id: article.category_id || '',
    status: article.status || 'draft', visibility: article.visibility || 'public',
    publish_date: article.publish_date ? article.publish_date.substring(0, 16) : '',
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!article.id;
  const set = k => v => setForm(f => ({ ...f, [k]: v.target ? v.target.value : v }));

  const submit = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      if (isEdit) await axios.put(`${API}/knowledge-base/${article.id}`, form, auth());
      else        await axios.post(`${API}/knowledge-base`, form, auth());
      toast.success(`Article ${isEdit ? 'updated' : 'created'}`);
      onDone();
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.primary }}>{isEdit ? 'Edit Article' : 'New KB Article'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={20} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Title *</label>
            <input value={form.title} onChange={set('title')} placeholder="Article title..."
              style={{ width: '100%', padding: '9px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Short Description</label>
            <textarea value={form.short_description} onChange={set('short_description')} rows={2} placeholder="Brief summary..."
              style={{ width: '100%', padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Content</label>
            <textarea value={form.content} onChange={set('content')} rows={8} placeholder="Full article content..."
              style={{ width: '100%', padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Category</label>
              <select value={form.category_id} onChange={set('category_id')}
                style={{ width: '100%', padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                <option value=''>None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Status</label>
              <select value={form.status} onChange={set('status')}
                style={{ width: '100%', padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                <option value='draft'>Draft</option>
                <option value='published'>Published</option>
                <option value='archived'>Archived</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Visibility</label>
              <select value={form.visibility} onChange={set('visibility')}
                style={{ width: '100%', padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}>
                <option value='public'>Public</option>
                <option value='group'>Group</option>
                <option value='private'>Private</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Publish Date</label>
            <input type="datetime-local" value={form.publish_date} onChange={set('publish_date')}
              style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }} />
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: '#f3f4f6', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '8px 20px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: saving?'not-allowed':'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : isEdit ? 'Update Article' : 'Create Article'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState({});

  useEffect(() => {
    axios.get(`${API}/settings`, auth()).then(r => setSettings(r.data.data || [])).catch(() => toast.error('Failed to load settings')).finally(() => setLoading(false));
  }, []);

  const update = async (pkey, field, value) => {
    setSettings(prev => prev.map(s => s.portal_key === pkey ? { ...s, [field]: value } : s));
  };

  const save = async (pkey) => {
    const s = settings.find(x => x.portal_key === pkey);
    if (!s) return;
    setSaving(prev => ({ ...prev, [pkey]: true }));
    try {
      await axios.put(`${API}/settings/${pkey}`, s, auth());
      toast.success(`${pkey} settings saved`);
    } catch { toast.error('Save failed'); }
    finally { setSaving(prev => ({ ...prev, [pkey]: false })); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>Loading...</div>;

  const portalInfo = { global: { label: 'Global (All Portals)', icon: '🌍', color: C.primary },
    public: { label: 'Public Portal', icon: '🌐', color: '#0369a1' },
    student: { label: 'Student Portal', icon: '🎓', color: '#7c3aed' },
    supervisor: { label: 'Supervisor Portal', icon: '👨‍🏫', color: '#0f766e' },
    center: { label: 'Research Center', icon: '🏛️', color: '#b45309' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fffbeb', border: '1px solid #f59e0b30', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
        <strong>Note:</strong> The Global setting acts as a master switch. If Global is disabled, all portals will be disabled regardless of individual settings.
      </div>
      {settings.map(s => {
        const info = portalInfo[s.portal_key] || { label: s.portal_key, icon: '⚙️', color: C.primary };
        return (
          <div key={s.portal_key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{info.icon}</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: info.color }}>{info.label}</h4>
                  <span style={{ fontSize: 12, color: C.muted }}>portal_key: {s.portal_key}</span>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.is_enabled ? C.success : C.muted }}>
                  {s.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
                <div onClick={() => update(s.portal_key, 'is_enabled', s.is_enabled ? 0 : 1)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: s.is_enabled ? C.success : '#d1d5db',
                    position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3, left: s.is_enabled ? 23 : 3, transition: 'left .2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </div>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Welcome Message</label>
                <textarea value={s.welcome_message || ''} onChange={e => update(s.portal_key, 'welcome_message', e.target.value)} rows={2}
                  style={{ width: '100%', padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Offline Message</label>
                <textarea value={s.offline_message || ''} onChange={e => update(s.portal_key, 'offline_message', e.target.value)} rows={2}
                  style={{ width: '100%', padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Placeholder Text</label>
                <input value={s.placeholder_text || ''} onChange={e => update(s.portal_key, 'placeholder_text', e.target.value)}
                  style={{ width: 300, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }} />
              </div>
              <button onClick={() => save(s.portal_key)} disabled={saving[s.portal_key]}
                style={{ padding: '8px 20px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, opacity: saving[s.portal_key]?.7:1 }}>
                <Save size={14} />{saving[s.portal_key] ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
