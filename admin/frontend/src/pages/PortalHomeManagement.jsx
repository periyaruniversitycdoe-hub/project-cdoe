import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Home, Bell, Calendar, BookOpen, Upload, Trash2, Plus,
  Save, Eye, Edit2, ToggleLeft, ToggleRight, Download,
  RefreshCw, X, Check, FileText, ExternalLink, Settings, Volume2
} from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/portal-home';
const token = () => localStorage.getItem('adminToken');
const headers = () => ({ Authorization: `Bearer ${token()}` });

/* ── tiny helpers ─────────────────────────────────────────────────────── */
const TABS = [
  { id: 'settings',      label: 'Page Settings',       Icon: Settings },
  { id: 'announcements', label: 'Moving Announcements', Icon: Volume2  },
  { id: 'notifications', label: 'Notifications',        Icon: Bell     },
  { id: 'dates',         label: 'Important Dates',      Icon: Calendar },
  { id: 'guidelines',    label: 'Guidelines',           Icon: BookOpen },
];


const TYPE_MAP = {
  notifications: 'notification',
  dates:         'date',
  guidelines:    'guideline',
};

const emptyForm = (type) => ({
  title: '', content: '', type, priority: 0, is_active: 1,
  published_at: new Date().toISOString().slice(0, 16),
});

/* ── Modal ──────────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.45)',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ backgroundColor:'#fff',borderRadius:8,padding:28,width:'100%',maxWidth:520,maxHeight:'85vh',overflowY:'auto',boxShadow:'0 16px 48px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="fw-bold mb-0">{title}</h6>
          <button onClick={onClose} className="btn btn-sm btn-outline-secondary p-1"><X size={14}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Notification Row ────────────────────────────────────────────────────── */
function NotifRow({ row, onEdit, onDelete, onToggle }) {
  return (
    <tr>
      <td style={{ maxWidth:200 }}>
        <div className="fw-semibold" style={{ fontSize:13 }}>{row.title}</div>
        {row.content && <div className="text-muted" style={{ fontSize:12 }}>{row.content.slice(0,60)}{row.content.length>60?'…':''}</div>}
      </td>
      <td style={{ fontSize:12 }}>{new Date(row.published_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
      <td><span className={`badge ${row.is_active?'bg-success':'bg-secondary'}`} style={{fontSize:11}}>{row.is_active?'Active':'Hidden'}</span></td>
      <td style={{ fontSize:12 }}>{row.priority}</td>
      <td>
        <div className="d-flex gap-1">
          <button onClick={() => onEdit(row)} className="btn btn-xs btn-outline-primary" style={{ padding:'2px 7px',fontSize:12 }}><Edit2 size={12}/></button>
          <button onClick={() => onToggle(row.id)} className="btn btn-xs btn-outline-warning" style={{ padding:'2px 7px',fontSize:12 }}>
            {row.is_active ? <ToggleRight size={12}/> : <ToggleLeft size={12}/>}
          </button>
          <button onClick={() => onDelete(row.id)} className="btn btn-xs btn-outline-danger" style={{ padding:'2px 7px',fontSize:12 }}><Trash2 size={12}/></button>
        </div>
      </td>
    </tr>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function PortalHomeManagement() {
  const [activeTab, setActiveTab]   = useState('settings');
  const [pageSettings, setPageSettings] = useState({ home_page_title:'', admission_status_text:'', show_prospectus_btn:0 });
  const [prospectusInfo, setProspectusInfo] = useState(null);
  const [uploading, setUploading]   = useState(false);
  const [savingSettings, setSaving] = useState(false);
  const fileRef = useRef();

  const [items, setItems]         = useState([]);
  const [loadingItems, setLoading] = useState(false);
  const [modalOpen, setModalOpen]  = useState(false);
  const [editRow, setEditRow]      = useState(null);
  const [form, setForm]            = useState(emptyForm('notification'));

  // ── Dynamic Announcements tab states ────────────────────────────────────
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [editAnnouncementRow, setEditAnnouncementRow] = useState(null);

  const emptyAnnouncementForm = () => ({
    announcement_text: '',
    session_text: '',
    text_color: '#ffffff',
    background_color: '#991b1b',
    animation_speed: 15,
    is_scrolling_enabled: 1,
    is_active: 1,
    display_order: 0,
  });

  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncementForm());

  const loadAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const { data } = await axios.get(`${API}/announcements`, { headers: headers() });
      setAnnouncements(data.success ? data.data : []);
    } catch {
      toast.error('Failed to load announcements');
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const handleToggleAnnouncement = async (id) => {
    try {
      await axios.patch(`${API}/announcements/${id}/toggle`, {}, { headers: headers() });
      toast.success('Visibility toggled!');
      loadAnnouncements();
    } catch {
      toast.error('Failed to toggle visibility');
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await axios.delete(`${API}/announcements/${id}`, { headers: headers() });
      toast.success('Announcement deleted');
      loadAnnouncements();
    } catch {
      toast.error('Failed to delete announcement');
    }
  };

  const handleMoveAnnouncement = async (index, direction) => {
    const newItems = [...announcements];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    // Swap display_order
    const temp = newItems[index].display_order;
    newItems[index].display_order = newItems[targetIndex].display_order;
    newItems[targetIndex].display_order = temp;

    // Avoid equal values causing static ordering issues
    if (newItems[index].display_order === newItems[targetIndex].display_order) {
      newItems.forEach((item, idx) => {
        item.display_order = idx * 10;
      });
    }

    setAnnouncements(newItems);

    try {
      const orders = newItems.map(item => ({ id: item.id, display_order: item.display_order }));
      await axios.put(`${API}/announcements/reorder`, { orders }, { headers: headers() });
      toast.success('Display priority updated!');
      loadAnnouncements();
    } catch {
      toast.error('Failed to update priority order');
    }
  };

  const openAddAnnouncement = () => {
    setEditAnnouncementRow(null);
    setAnnouncementForm(emptyAnnouncementForm());
    setAnnouncementModalOpen(true);
  };

  const openEditAnnouncement = (row) => {
    setEditAnnouncementRow(row);
    setAnnouncementForm({
      announcement_text: row.announcement_text,
      session_text: row.session_text || '',
      text_color: row.text_color || '#ffffff',
      background_color: row.background_color || '#991b1b',
      animation_speed: row.animation_speed || 15,
      is_scrolling_enabled: row.is_scrolling_enabled,
      is_active: row.is_active,
      display_order: row.display_order || 0,
    });
    setAnnouncementModalOpen(true);
  };

  const handleSaveAnnouncement = async () => {
    if (!announcementForm.announcement_text.trim()) {
      toast.error('Announcement text is required');
      return;
    }
    try {
      if (editAnnouncementRow) {
        await axios.put(`${API}/announcements/${editAnnouncementRow.id}`, announcementForm, { headers: headers() });
        toast.success('Announcement updated successfully!');
      } else {
        await axios.post(`${API}/announcements`, announcementForm, { headers: headers() });
        toast.success('Announcement created successfully!');
      }
      setAnnouncementModalOpen(false);
      loadAnnouncements();
    } catch {
      toast.error('Failed to save announcement');
    }
  };


  /* ── Load page settings ─────────────────────────────────── */
  const loadSettings = async () => {
    try {
      const { data } = await axios.get(`${API}/settings`, { headers: headers() });
      if (data.success) {
        const d = data.data;
        setPageSettings({
          home_page_title:       d.home_page_title       || '',
          admission_status_text: d.admission_status_text || '',
          show_prospectus_btn:   d.show_prospectus_btn   || 0,
        });
        if (d.prospectus_path) {
          setProspectusInfo({ path: d.prospectus_path, name: d.prospectus_file_name });
        } else {
          setProspectusInfo(null);
        }
      }
    } catch { /* silent */ }
  };

  /* ── Load notification list ─────────────────────────────── */
  const loadItems = async (tab) => {
    const type = TYPE_MAP[tab];
    if (!type) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/notifications?type=${type}`, { headers: headers() });
      setItems(data.success ? data.data : []);
    } catch { toast.error('Failed to load items'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => {
    if (activeTab === 'announcements') {
      loadAnnouncements();
    } else if (activeTab !== 'settings') {
      loadItems(activeTab);
    }
  }, [activeTab]);


  /* ── Save page settings ─────────────────────────────────── */
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, pageSettings, { headers: headers() });
      toast.success('Settings saved — student home page updated!');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  /* ── Prospectus upload ──────────────────────────────────── */
  const handleProspectusUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('prospectus', file);
    setUploading(true);
    try {
      const { data } = await axios.post(`${API}/prospectus`, fd, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        setProspectusInfo({ path: data.data.path, name: data.data.name });
        setPageSettings(p => ({ ...p, show_prospectus_btn: 1 }));
        toast.success('Prospectus uploaded — Download button is now live on student home!');
      }
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleDeleteProspectus = async () => {
    if (!window.confirm('Remove the prospectus? The download button will be hidden.')) return;
    try {
      await axios.delete(`${API}/prospectus`, { headers: headers() });
      setProspectusInfo(null);
      setPageSettings(p => ({ ...p, show_prospectus_btn: 0 }));
      toast.success('Prospectus removed');
    } catch { toast.error('Failed to remove'); }
  };

  /* ── Notification CRUD ──────────────────────────────────── */
  const openAdd = () => {
    setEditRow(null);
    setForm(emptyForm(TYPE_MAP[activeTab]));
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditRow(row);
    setForm({
      title:        row.title,
      content:      row.content || '',
      type:         row.type,
      priority:     row.priority,
      is_active:    row.is_active,
      published_at: row.published_at ? new Date(row.published_at).toISOString().slice(0,16) : new Date().toISOString().slice(0,16),
    });
    setModalOpen(true);
  };

  const handleSaveNotif = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    try {
      if (editRow) {
        await axios.put(`${API}/notifications/${editRow.id}`, form, { headers: headers() });
        toast.success('Updated — change visible on student home instantly!');
      } else {
        await axios.post(`${API}/notifications`, form, { headers: headers() });
        toast.success('Created — now live on student home page!');
      }
      setModalOpen(false);
      loadItems(activeTab);
    } catch { toast.error('Save failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await axios.delete(`${API}/notifications/${id}`, { headers: headers() });
      toast.success('Deleted');
      loadItems(activeTab);
    } catch { toast.error('Delete failed'); }
  };

  const handleToggle = async (id) => {
    try {
      await axios.patch(`${API}/notifications/${id}/toggle`, {}, { headers: headers() });
      loadItems(activeTab);
    } catch { toast.error('Toggle failed'); }
  };

  const tabLabel = { notifications:'Notification', dates:'Important Date', guidelines:'Guideline' };

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div style={{ padding:'24px', maxWidth:1100, margin:'0 auto' }}>

      {/* ── Page Header ── */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <Home size={22} style={{ color:'#1e3c72' }}/>
          <div>
            <h5 className="mb-0 fw-bold" style={{ color:'#1e3c72' }}>Portal Home Management</h5>
            <p className="mb-0 text-muted" style={{ fontSize:12 }}>
              All changes reflect on the student home page in real time (within 15 seconds).
            </p>
          </div>
        </div>
        <a href="http://localhost:5173/home" target="_blank" rel="noreferrer"
          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1">
          <ExternalLink size={14}/> Preview Student Home
        </a>
      </div>

      {/* ── Real-time badge ── */}
      <div className="alert d-flex align-items-center gap-2 py-2 mb-4"
        style={{ backgroundColor:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:8, fontSize:13 }}>
        <span style={{ width:8,height:8,borderRadius:'50%',backgroundColor:'#4caf50',display:'inline-block',animation:'blink 1.5s ease-in-out infinite' }}/>
        <strong>Live Sync Active</strong> — student home auto-refreshes every 15 s. Save any change below and it appears without any page reload on the student side.
      </div>

      {/* ── Tabs ── */}
      <div className="d-flex gap-1 mb-0 flex-wrap" style={{ borderBottom:'2px solid #dee2e6' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="btn btn-sm d-flex align-items-center gap-1 px-3"
            style={{
              borderRadius:'6px 6px 0 0', border:'none',
              borderBottom: activeTab===id ? '2px solid #1e3c72' : '2px solid transparent',
              backgroundColor: activeTab===id ? '#e8eeff' : 'transparent',
              color: activeTab===id ? '#1e3c72' : '#555',
              fontWeight: activeTab===id ? 700 : 400,
              marginBottom: -2, fontSize: 13,
            }}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      <div style={{ border:'1px solid #dee2e6', borderTop:'none', borderRadius:'0 0 8px 8px', padding:24, backgroundColor:'#fff' }}>

        {/* ══ TAB: Page Settings ══ */}
        {activeTab === 'settings' && (
          <div>
            <div className="row g-4">
              {/* Left: text settings */}
              <div className="col-12 col-lg-6">
                <h6 className="fw-bold mb-3" style={{ color:'#1e3c72' }}>Home Page Text</h6>

                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ fontSize:13 }}>Custom Heading Override</label>
                  <input type="text" className="form-control form-control-sm"
                    placeholder="e.g. Ph.D. ADMISSION ONLINE PORTAL (leave blank for default)"
                    value={pageSettings.home_page_title}
                    onChange={e => setPageSettings(p => ({ ...p, home_page_title: e.target.value }))}/>
                  <div className="form-text">Replaces the sub-heading on the student home header.</div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ fontSize:13 }}>Admission Status Text</label>
                  <input type="text" className="form-control form-control-sm"
                    placeholder="e.g. Ph.D. Admission 2026-27 – Admission Opened"
                    value={pageSettings.admission_status_text}
                    onChange={e => setPageSettings(p => ({ ...p, admission_status_text: e.target.value }))}/>
                  <div className="form-text">Green text shown below the buttons. Leave blank to use the auto-generated text.</div>
                </div>

                <button onClick={handleSaveSettings} disabled={savingSettings}
                  className="btn btn-primary btn-sm d-flex align-items-center gap-2">
                  {savingSettings ? <RefreshCw size={13} className="animate-spin"/> : <Save size={13}/>}
                  {savingSettings ? 'Saving…' : 'Save Text Settings'}
                </button>
              </div>

              {/* Right: prospectus */}
              <div className="col-12 col-lg-6">
                <h6 className="fw-bold mb-3" style={{ color:'#1e3c72' }}>Prospectus PDF</h6>

                {prospectusInfo ? (
                  <div className="p-3 rounded-3 mb-3" style={{ backgroundColor:'#e8f5e9', border:'1px solid #a5d6a7' }}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <FileText size={18} style={{ color:'#2e7d32' }}/>
                      <span className="fw-semibold" style={{ fontSize:13 }}>{prospectusInfo.name}</span>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                      <a href={`(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/portal-home/prospectus/download`}
                        target="_blank" rel="noreferrer"
                        className="btn btn-sm btn-success d-flex align-items-center gap-1">
                        <Download size={12}/> Download
                      </a>
                      <button onClick={() => fileRef.current?.click()}
                        className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1">
                        <Upload size={12}/> Replace
                      </button>
                      <button onClick={handleDeleteProspectus}
                        className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1">
                        <Trash2 size={12}/> Remove
                      </button>
                    </div>
                    <div className="mt-2" style={{ fontSize:12, color:'#555' }}>
                      <strong>Show Download Button on Student Home:</strong>{' '}
                      <span className={prospectusInfo ? 'text-success fw-bold' : 'text-muted'}>
                        {pageSettings.show_prospectus_btn ? '✓ Visible' : '✗ Hidden'}
                      </span>
                      {' '}&nbsp;
                      <button onClick={() => {
                        const next = { ...pageSettings, show_prospectus_btn: pageSettings.show_prospectus_btn ? 0 : 1 };
                        setPageSettings(next);
                        axios.put(`${API}/settings`, next, { headers: headers() })
                          .then(() => toast.success('Prospectus button visibility updated!'))
                          .catch(() => toast.error('Failed'));
                      }} className="btn btn-xs btn-outline-secondary" style={{ padding:'1px 8px', fontSize:11 }}>
                        Toggle
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-3 mb-3 text-center" style={{ backgroundColor:'#f9f9f9', border:'2px dashed #ccc' }}>
                    <FileText size={32} className="mb-2 text-muted opacity-50"/>
                    <p className="mb-1" style={{ fontSize:13 }}>No prospectus uploaded yet.</p>
                    <p className="text-muted" style={{ fontSize:12 }}>Upload a PDF to enable the "Download Prospectus" button on the student home page.</p>
                  </div>
                )}

                <input type="file" accept=".pdf" ref={fileRef} style={{ display:'none' }} onChange={handleProspectusUpload}/>
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="btn btn-warning btn-sm d-flex align-items-center gap-2">
                  {uploading ? <RefreshCw size={13} className="animate-spin"/> : <Upload size={13}/>}
                  {uploading ? 'Uploading…' : prospectusInfo ? 'Replace Prospectus PDF' : 'Upload Prospectus PDF'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: Moving Announcements ══ */}
        {activeTab === 'announcements' && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="fw-bold mb-0" style={{ color:'#1e3c72' }}>
                  Manage Moving Announcements
                </h6>
                <p className="text-muted mb-0" style={{ fontSize:12 }}>
                  Set dynamic announcements, colors, background badges, and speeds. Announcements loop continuously on the homepage.
                </p>
              </div>
              <button onClick={openAddAnnouncement}
                className="btn btn-primary btn-sm d-flex align-items-center gap-1">
                <Plus size={14}/> Add Announcement
              </button>
            </div>

            {loadingAnnouncements ? (
              <div className="text-center py-5 text-muted">
                <RefreshCw size={24} className="animate-spin mb-2"/>
                <p>Loading announcements…</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <Volume2 size={36} className="mb-2 opacity-25"/>
                <p>No moving announcements yet. Click "Add Announcement" to create one.</p>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="table table-sm table-hover align-middle" style={{ fontSize:13 }}>
                  <thead style={{ backgroundColor:'#f8f9fa' }}>
                    <tr>
                      <th>Display Priority</th>
                      <th>Text / Session</th>
                      <th>Custom Badge Styling</th>
                      <th>Scroll Speed</th>
                      <th>Scrolling</th>
                      <th>Status</th>
                      <th style={{ width:160 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {announcements.map((row, idx) => (
                      <tr key={row.id}>
                        <td>
                          <div className="d-flex align-items-center gap-1">
                            <span className="fw-semibold text-muted" style={{ width: 16 }}>{idx + 1}</span>
                            <div className="d-flex flex-column gap-0">
                              <button onClick={() => handleMoveAnnouncement(idx, 'up')}
                                disabled={idx === 0}
                                className="btn btn-link btn-xs p-0 lh-1" style={{ color: idx === 0 ? '#ccc' : '#1e3c72', border: 'none', background: 'none' }}>
                                ▲
                              </button>
                              <button onClick={() => handleMoveAnnouncement(idx, 'down')}
                                disabled={idx === announcements.length - 1}
                                className="btn btn-link btn-xs p-0 lh-1" style={{ color: idx === announcements.length - 1 ? '#ccc' : '#1e3c72', border: 'none', background: 'none' }}>
                                ▼
                              </button>
                            </div>
                          </div>
                        </td>
                        <td style={{ maxWidth:260 }}>
                          <div className="fw-semibold text-wrap">{row.announcement_text}</div>
                          {row.session_text && (
                            <span className="badge bg-light text-dark border mt-1" style={{ fontSize:11 }}>
                              {row.session_text}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span className="d-inline-block rounded border shadow-sm"
                              style={{ width:24, height:24, backgroundColor: row.background_color }}/>
                            <code style={{ fontSize:11, color:'#333' }}>{row.background_color}</code>
                            <span className="text-muted">/</span>
                            <span className="fw-semibold" style={{ color: row.text_color }}>Text</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-info text-dark fw-bold" style={{ fontSize:11 }}>
                            {row.animation_speed}s loop
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${row.is_scrolling_enabled ? 'bg-primary' : 'bg-secondary'}`} style={{ fontSize:11 }}>
                            {row.is_scrolling_enabled ? 'Scrolling' : 'Static'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${row.is_active ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize:11 }}>
                            {row.is_active ? 'Active' : 'Hidden'}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button onClick={() => openEditAnnouncement(row)} className="btn btn-xs btn-outline-primary" style={{ padding:'2px 7px', fontSize:12 }}>
                              <Edit2 size={12}/>
                            </button>
                            <button onClick={() => handleToggleAnnouncement(row.id)} className="btn btn-xs btn-outline-warning" style={{ padding:'2px 7px', fontSize:12 }}>
                              {row.is_active ? <ToggleRight size={12}/> : <ToggleLeft size={12}/>}
                            </button>
                            <button onClick={() => handleDeleteAnnouncement(row.id)} className="btn btn-xs btn-outline-danger" style={{ padding:'2px 7px', fontSize:12 }}>
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ TABS: Notifications / Dates / Guidelines ══ */}
        {activeTab !== 'settings' && activeTab !== 'announcements' && (

          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="fw-bold mb-0" style={{ color:'#1e3c72' }}>
                  Manage {tabLabel[activeTab]}s
                </h6>
                <p className="text-muted mb-0" style={{ fontSize:12 }}>
                  {activeTab === 'notifications' && 'Shown in the ticker and Admission Notifications panel on student home.'}
                  {activeTab === 'dates'         && 'Shown in the "Important Dates" sidebar panel on student home.'}
                  {activeTab === 'guidelines'    && 'Shown in the "Guidelines to fill the application" panel on student home.'}
                </p>
              </div>
              <button onClick={openAdd}
                className="btn btn-primary btn-sm d-flex align-items-center gap-1">
                <Plus size={14}/> Add New
              </button>
            </div>

            {loadingItems ? (
              <div className="text-center py-5 text-muted">
                <RefreshCw size={24} className="animate-spin mb-2"/>
                <p>Loading…</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <Bell size={36} className="mb-2 opacity-25"/>
                <p>No {tabLabel[activeTab].toLowerCase()}s yet. Click "Add New" to create one.</p>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="table table-sm table-hover align-middle" style={{ fontSize:13 }}>
                  <thead style={{ backgroundColor:'#f8f9fa' }}>
                    <tr>
                      <th>Title / Content</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th style={{ width:120 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(row => (
                      <NotifRow key={row.id} row={row}
                        onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle}/>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ Add / Edit Modal ══ */}
      {modalOpen && (
        <Modal
          title={`${editRow ? 'Edit' : 'Add'} ${tabLabel[activeTab]}`}
          onClose={() => setModalOpen(false)}>

          <div className="mb-3">
            <label className="form-label fw-semibold" style={{ fontSize:13 }}>Title <span className="text-danger">*</span></label>
            <input type="text" className="form-control form-control-sm"
              placeholder="Enter title…"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold" style={{ fontSize:13 }}>
              {activeTab === 'dates' ? 'Date / Deadline' : 'Content / Description'}
            </label>
            <textarea className="form-control form-control-sm" rows={3}
              placeholder={activeTab === 'dates' ? 'e.g. 30 June 2026' : 'Additional details…'}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}/>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold" style={{ fontSize:13 }}>Priority (higher = shown first)</label>
              <input type="number" className="form-control form-control-sm" min={0} max={100}
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value)||0 }))}/>
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold" style={{ fontSize:13 }}>Publish Date</label>
              <input type="datetime-local" className="form-control form-control-sm"
                value={form.published_at}
                onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}/>
            </div>
          </div>

          <div className="mb-4 d-flex align-items-center gap-2">
            <input type="checkbox" id="is_active" className="form-check-input"
              checked={!!form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}/>
            <label htmlFor="is_active" className="form-check-label" style={{ fontSize:13 }}>
              Active (visible on student home page immediately)
            </label>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button onClick={() => setModalOpen(false)} className="btn btn-sm btn-outline-secondary">Cancel</button>
            <button onClick={handleSaveNotif} className="btn btn-sm btn-primary d-flex align-items-center gap-1">
              <Check size={13}/> {editRow ? 'Update' : 'Create'} &amp; Go Live
            </button>
          </div>
        </Modal>
      )}

      {/* ══ Add / Edit Announcement Modal ══ */}
      {announcementModalOpen && (
        <Modal
          title={`${editAnnouncementRow ? 'Edit' : 'Add'} Moving Announcement`}
          onClose={() => setAnnouncementModalOpen(false)}>

          <div className="mb-3">
            <label className="form-label fw-semibold" style={{ fontSize:13 }}>Announcement Text <span className="text-danger">*</span></label>
            <textarea className="form-control form-control-sm" rows={2}
              placeholder="e.g. Admission for Ph.D. 2026-27 is now open!"
              maxLength={500}
              value={announcementForm.announcement_text}
              onChange={e => setAnnouncementForm(f => ({ ...f, announcement_text: e.target.value }))}/>
            <div className="form-text text-end" style={{ fontSize: 11 }}>
              {500 - announcementForm.announcement_text.length} characters left.
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold" style={{ fontSize:13 }}>Academic Session Year</label>
            <input type="text" className="form-control form-control-sm"
              placeholder="e.g. 2026 - 27 (optional)"
              value={announcementForm.session_text}
              onChange={e => setAnnouncementForm(f => ({ ...f, session_text: e.target.value }))}/>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold" style={{ fontSize:13 }}>Text Color</label>
              <div className="d-flex gap-1 align-items-center">
                <input type="color" className="form-control form-control-color form-control-sm border p-0"
                  style={{ width:34, height:28 }}
                  value={announcementForm.text_color}
                  onChange={e => setAnnouncementForm(f => ({ ...f, text_color: e.target.value }))}/>
                <input type="text" className="form-control form-control-sm" style={{ fontSize:12 }}
                  value={announcementForm.text_color}
                  onChange={e => setAnnouncementForm(f => ({ ...f, text_color: e.target.value }))}/>
              </div>
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold" style={{ fontSize:13 }}>Background Badge</label>
              <div className="d-flex gap-1 align-items-center">
                <input type="color" className="form-control form-control-color form-control-sm border p-0"
                  style={{ width:34, height:28 }}
                  value={announcementForm.background_color}
                  onChange={e => setAnnouncementForm(f => ({ ...f, background_color: e.target.value }))}/>
                <input type="text" className="form-control form-control-sm" style={{ fontSize:12 }}
                  value={announcementForm.background_color}
                  onChange={e => setAnnouncementForm(f => ({ ...f, background_color: e.target.value }))}/>
              </div>
            </div>
          </div>

          {/* Color Presets */}
          <div className="mb-3">
            <label className="form-label fw-semibold d-block mb-1" style={{ fontSize:12, color:'#666' }}>Standard Theme Presets</label>
            <div className="d-flex gap-1 flex-wrap">
              {[
                { name: 'Red', bg: '#991b1b', text: '#ffffff' },
                { name: 'Dark Blue', bg: '#00008B', text: '#ffffff' },
                { name: 'Teal', bg: '#009688', text: '#ffffff' },
                { name: 'Green', bg: '#2E7D32', text: '#ffffff' },
                { name: 'Purple', bg: '#6A1B9A', text: '#ffffff' },
                { name: 'Orange', bg: '#E65100', text: '#ffffff' },
              ].map(preset => (
                <button key={preset.name} type="button"
                  onClick={() => setAnnouncementForm(f => ({ ...f, background_color: preset.bg, text_color: preset.text }))}
                  className="btn btn-xs rounded-pill px-2 text-white border-0 shadow-sm"
                  style={{ backgroundColor: preset.bg, fontSize:11 }}>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold" style={{ fontSize:13 }}>
              Animation Speed: <span className="text-primary">{announcementForm.animation_speed}s loop</span>
            </label>
            <input type="range" className="form-range" min={5} max={40} step={1}
              value={announcementForm.animation_speed}
              onChange={e => setAnnouncementForm(f => ({ ...f, animation_speed: parseInt(e.target.value)||15 }))}/>
            <div className="d-flex justify-content-between text-muted" style={{ fontSize:11 }}>
              <span>Fast (5s)</span>
              <span>Slow (40s)</span>
            </div>
          </div>

          {/* Real-time Badge Preview */}
          <div className="p-3 mb-3 border rounded text-center" style={{ backgroundColor: '#f8f9fa' }}>
            <span className="form-label fw-semibold d-block mb-2 text-muted" style={{ fontSize:12 }}>Live Badge Preview</span>
            <div className="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill shadow-sm"
              style={{
                backgroundColor: announcementForm.background_color,
                color: announcementForm.text_color,
                fontWeight: 'bold',
                fontSize: '13px'
              }}>
              <span>{announcementForm.announcement_text || 'Announcement Preview Text'}</span>
              {announcementForm.session_text && (
                <span style={{
                  fontSize: '10px',
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>{announcementForm.session_text}</span>
              )}
            </div>
          </div>

          <div className="row g-2 mb-4">
            <div className="col-6">
              <div className="form-check">
                <input type="checkbox" id="ann_scrolling" className="form-check-input"
                  checked={!!announcementForm.is_scrolling_enabled}
                  onChange={e => setAnnouncementForm(f => ({ ...f, is_scrolling_enabled: e.target.checked ? 1 : 0 }))}/>
                <label htmlFor="ann_scrolling" className="form-check-label" style={{ fontSize:13 }}>
                  Enable Scrolling
                </label>
              </div>
            </div>
            <div className="col-6">
              <div className="form-check">
                <input type="checkbox" id="ann_active" className="form-check-input"
                  checked={!!announcementForm.is_active}
                  onChange={e => setAnnouncementForm(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}/>
                <label htmlFor="ann_active" className="form-check-label" style={{ fontSize:13 }}>
                  Active (Go Live)
                </label>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button onClick={() => setAnnouncementForm(emptyAnnouncementForm()) & setAnnouncementModalOpen(false)}
              className="btn btn-sm btn-outline-secondary">Cancel</button>
            <button onClick={handleSaveAnnouncement} className="btn btn-sm btn-primary d-flex align-items-center gap-1">
              <Check size={13}/> {editAnnouncementRow ? 'Update' : 'Create'} &amp; Publish
            </button>
          </div>
        </Modal>
      )}

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn-xs { font-size:11px!important; padding:2px 6px!important; }
      `}</style>
    </div>
  );
}
