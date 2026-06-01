import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Plus, Search, Filter, RefreshCw, Edit2, Trash2, Eye, EyeOff,
  Archive, RotateCcw, Copy, ChevronDown, ChevronUp, X, Upload,
  Paperclip, Calendar, AlertTriangle, CheckCircle, Clock, Tag,
  Megaphone, List, Grid, ChevronLeft, ChevronRight, ExternalLink,
  History, Settings2
} from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/announcements';

const getToken = () => localStorage.getItem('adminToken');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// ── Constants ──────────────────────────────────────────────────────────────────
const DISPLAY_MODES = [
  { value: 'ticker',  label: 'Scrolling News Ticker' },
  { value: 'static',  label: 'Static Announcement Bar' },
  { value: 'popup',   label: 'Popup Announcement' },
  { value: 'card',    label: 'Announcement Card' },
  { value: 'alert',   label: 'Highlight Alert' },
];

const POSITIONS = [
  { value: 'top-header',   label: 'Top Header Area' },
  { value: 'below-header', label: 'Below Header' },
  { value: 'above-portals',label: 'Above Portal Cards' },
  { value: 'below-portals',label: 'Below Portal Cards' },
  { value: 'footer',       label: 'Dashboard Footer Area' },
];

const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: '#dc2626' },
  { value: 'high',     label: 'High',     color: '#ea580c' },
  { value: 'medium',   label: 'Medium',   color: '#d97706' },
  { value: 'normal',   label: 'Normal',   color: '#2563eb' },
  { value: 'low',      label: 'Low',      color: '#6b7280' },
];

const STATUSES = [
  { value: 'draft',     label: 'Draft',     color: '#6b7280', bg: '#f3f4f6' },
  { value: 'scheduled', label: 'Scheduled', color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'published', label: 'Published', color: '#059669', bg: '#ecfdf5' },
  { value: 'expired',   label: 'Expired',   color: '#9ca3af', bg: '#f9fafb' },
  { value: 'archived',  label: 'Archived',  color: '#78350f', bg: '#fffbeb' },
  { value: 'inactive',  label: 'Inactive',  color: '#b91c1c', bg: '#fef2f2' },
];

const PER_PAGE_OPTIONS = [10, 20, 50, 100, 200];

const BLANK_FORM = {
  title: '', content: '', category_id: '',
  display_mode: 'static', ticker_direction: 'right', ticker_speed: 50,
  position: 'below-header', priority: 'normal',
  bg_color: '#1e3a5f', text_color: '#ffffff',
  border_color: '#2a52b4', highlight_color: '#f59e0b',
  status: 'draft',
  start_at: '', end_at: '',
  popup_reappear: false, popup_delay_mins: 60,
  attachment: null, remove_attachment: false,
};

// ── Small Helpers ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = STATUSES.find(x => x.value === status) || STATUSES[0];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      color: s.color, background: s.bg, border: `1px solid ${s.color}33`,
    }}>
      {status === 'published' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />}
      {s.label}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const p = PRIORITIES.find(x => x.value === priority) || PRIORITIES[3];
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
      color: '#fff', background: p.color,
    }}>
      {p.label}
    </span>
  );
};

const ModeBadge = ({ mode }) => {
  const m = DISPLAY_MODES.find(x => x.value === mode);
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 10, fontSize: 11,
      background: '#e0f2fe', color: '#0369a1',
    }}>
      {m?.label || mode}
    </span>
  );
};

function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toLocalDatetime(utcStr) {
  if (!utcStr) return '';
  const d = new Date(utcStr);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Audit Trail Modal ──────────────────────────────────────────────────────────
function AuditModal({ announcementId, title, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/${announcementId}/audit`, { headers: authHeaders() })
      .then(r => setLogs(r.data.data || []))
      .catch(() => toast.error('Failed to load audit log'))
      .finally(() => setLoading(false));
  }, [announcementId]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} />
            <span>Audit Trail — {title}</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px', maxHeight: 480, overflowY: 'auto' }}>
          {loading ? <div style={styles.centered}>Loading…</div> : logs.length === 0 ? (
            <div style={styles.centered}>No audit records found.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Action', 'By', 'IP', 'Date'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={styles.tr}>
                    <td style={styles.td}><span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{l.action}</span></td>
                    <td style={styles.td}>{l.actor_email || '—'}</td>
                    <td style={styles.td}>{l.ip_address || '—'}</td>
                    <td style={styles.td}>{fmtDate(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Category Manager Modal ─────────────────────────────────────────────────────
function CategoryModal({ onClose, onRefresh }) {
  const [cats, setCats] = useState([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/categories`, { headers: authHeaders() })
      .then(r => setCats(r.data.data || []))
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return toast.error('Enter a category name');
    try {
      await axios.post(`${API}/categories`, { name: newName.trim() }, { headers: authHeaders() });
      toast.success('Category added');
      setNewName('');
      load();
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error');
    }
  };

  const handleToggle = async (cat) => {
    try {
      await axios.put(`${API}/categories/${cat.id}`, { name: cat.name, is_active: !cat.is_active }, { headers: authHeaders() });
      load(); onRefresh();
    } catch (e) { toast.error('Error'); }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await axios.delete(`${API}/categories/${cat.id}`, { headers: authHeaders() });
      toast.success('Deleted'); load(); onRefresh();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={18} />Manage Categories</div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              style={{ ...styles.input, flex: 1 }}
              placeholder="New category name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button style={styles.btnPrimary} onClick={handleAdd}><Plus size={14} /> Add</button>
          </div>
          {loading ? <div style={styles.centered}>Loading…</div> : (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {cats.map(cat => (
                <div key={cat.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8, marginBottom: 6,
                  background: cat.is_active ? '#f0fdf4' : '#fafafa',
                  border: '1px solid #e5e7eb',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{cat.name}</span>
                    {cat.is_system ? <span style={{ fontSize: 10, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 8 }}>system</span> : null}
                    {!cat.is_active && <span style={{ fontSize: 10, color: '#ef4444' }}>inactive</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ ...styles.iconBtn, color: cat.is_active ? '#059669' : '#9ca3af' }} onClick={() => handleToggle(cat)} title="Toggle active">
                      {cat.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    {!cat.is_system && (
                      <button style={{ ...styles.iconBtn, color: '#ef4444' }} onClick={() => handleDelete(cat)} title="Delete"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Announcement Form Modal ────────────────────────────────────────────────────
function AnnouncementForm({ editData, categories, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    if (!editData) return { ...BLANK_FORM };
    return {
      ...BLANK_FORM,
      ...editData,
      start_at: toLocalDatetime(editData.start_at),
      end_at: toLocalDatetime(editData.end_at),
      attachment: null,
      remove_attachment: false,
    };
  });
  const [saving, setSaving] = useState(false);
  const [attachPreview, setAttachPreview] = useState(editData?.attachment_name || null);
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    set('attachment', file);
    set('remove_attachment', false);
    setAttachPreview(file.name);
  };

  const removeFile = () => {
    set('attachment', null);
    set('remove_attachment', true);
    setAttachPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())      return toast.error('Title is required');
    if (!form.content.trim())    return toast.error('Content is required');
    if (!form.category_id)       return toast.error('Category is required');
    if (!form.start_at)          return toast.error('Start date is required');
    if (!form.end_at)            return toast.error('End date is required');
    if (new Date(form.end_at) <= new Date(form.start_at)) return toast.error('End date must be after start date');

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'attachment') { if (v) fd.append('attachment', v); }
        else if (k === 'remove_attachment') fd.append('remove_attachment', v ? '1' : '0');
        else if (v !== null && v !== undefined) fd.append(k, v);
      });

      if (editData) {
        await axios.put(`${API}/${editData.id}`, fd, { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } });
        toast.success('Announcement updated');
      } else {
        await axios.post(API, fd, { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } });
        toast.success('Announcement created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!editData;

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, maxWidth: 820, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Megaphone size={18} />
            {isEdit ? 'Edit Announcement' : 'Create New Announcement'}
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {/* Title */}
          <div style={styles.formRow}>
            <label style={styles.label}>Announcement Title <span style={styles.req}>*</span></label>
            <input style={styles.input} value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Enter announcement title" maxLength={500} />
          </div>

          {/* Content */}
          <div style={styles.formRow}>
            <label style={styles.label}>Announcement Content <span style={styles.req}>*</span></label>
            <textarea style={{ ...styles.input, minHeight: 100, resize: 'vertical' }}
              value={form.content} onChange={e => set('content', e.target.value)}
              placeholder="Enter full announcement content" />
          </div>

          {/* Category + Display Mode */}
          <div style={styles.formGrid2}>
            <div style={styles.formRow}>
              <label style={styles.label}>Category <span style={styles.req}>*</span></label>
              <select style={styles.input} value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">— Select Category —</option>
                {categories.filter(c => c.is_active).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Display Mode <span style={styles.req}>*</span></label>
              <select style={styles.input} value={form.display_mode} onChange={e => set('display_mode', e.target.value)}>
                {DISPLAY_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {/* Ticker options */}
          {form.display_mode === 'ticker' && (
            <div style={styles.formGrid2}>
              <div style={styles.formRow}>
                <label style={styles.label}>Scroll Direction</label>
                <select style={styles.input} value={form.ticker_direction} onChange={e => set('ticker_direction', e.target.value)}>
                  <option value="right">Right → Left</option>
                  <option value="left">Left → Right</option>
                </select>
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Scroll Speed (px/s)</label>
                <input type="number" style={styles.input} value={form.ticker_speed} min={10} max={300}
                  onChange={e => set('ticker_speed', parseInt(e.target.value))} />
              </div>
            </div>
          )}

          {/* Popup options */}
          {form.display_mode === 'popup' && (
            <div style={{ ...styles.formGrid2, alignItems: 'flex-start' }}>
              <div style={styles.formRow}>
                <label style={styles.label}>Reappear After Close?</label>
                <select style={styles.input} value={form.popup_reappear ? '1' : '0'}
                  onChange={e => set('popup_reappear', e.target.value === '1')}>
                  <option value="0">No (show once per session)</option>
                  <option value="1">Yes (reappear after delay)</option>
                </select>
              </div>
              {form.popup_reappear && (
                <div style={styles.formRow}>
                  <label style={styles.label}>Reappear Delay (minutes)</label>
                  <input type="number" style={styles.input} value={form.popup_delay_mins} min={1}
                    onChange={e => set('popup_delay_mins', parseInt(e.target.value))} />
                </div>
              )}
            </div>
          )}

          {/* Position + Priority + Status */}
          <div style={styles.formGrid3}>
            <div style={styles.formRow}>
              <label style={styles.label}>Display Position <span style={styles.req}>*</span></label>
              <select style={styles.input} value={form.position} onChange={e => set('position', e.target.value)}>
                {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Priority <span style={styles.req}>*</span></label>
              <select style={styles.input} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div style={styles.formGrid2}>
            <div style={styles.formRow}>
              <label style={styles.label}>Start Date & Time <span style={styles.req}>*</span></label>
              <input type="datetime-local" style={styles.input} value={form.start_at}
                onChange={e => set('start_at', e.target.value)} />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>End Date & Time <span style={styles.req}>*</span></label>
              <input type="datetime-local" style={styles.input} value={form.end_at}
                onChange={e => set('end_at', e.target.value)} />
            </div>
          </div>

          {/* Colors */}
          <div style={{ ...styles.formGrid2, gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { key: 'bg_color',        label: 'Background Color' },
              { key: 'text_color',      label: 'Text Color' },
              { key: 'border_color',    label: 'Border Color' },
              { key: 'highlight_color', label: 'Highlight Color' },
            ].map(({ key, label }) => (
              <div key={key} style={styles.formRow}>
                <label style={styles.label}>{label}</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" style={{ width: 38, height: 34, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', padding: 2 }}
                    value={form[key]} onChange={e => set(key, e.target.value)} />
                  <input style={{ ...styles.input, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                    value={form[key]} onChange={e => set(key, e.target.value)} maxLength={20} />
                </div>
              </div>
            ))}
          </div>

          {/* Color Preview */}
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginBottom: 16,
            background: form.bg_color, color: form.text_color,
            border: `2px solid ${form.border_color}`,
            fontSize: 13, fontWeight: 500,
          }}>
            <span style={{ background: form.highlight_color, padding: '2px 8px', borderRadius: 4, marginRight: 8, color: form.text_color }}>Preview</span>
            {form.title || 'Announcement text will appear here…'}
          </div>

          {/* Attachment */}
          <div style={styles.formRow}>
            <label style={styles.label}>Attachment (Optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ ...styles.btnSecondary, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Upload size={14} />
                {attachPreview ? 'Replace File' : 'Upload File'}
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.jpg,.jpeg,.png,.webp" />
              </label>
              {attachPreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0f9ff', padding: '4px 12px', borderRadius: 6, fontSize: 12 }}>
                  <Paperclip size={12} style={{ color: '#0369a1' }} />
                  <span style={{ color: '#0369a1', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachPreview}</span>
                  <button type="button" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }} onClick={removeFile}>
                    <X size={12} />
                  </button>
                </div>
              )}
              {editData?.attachment_path && !form.remove_attachment && !form.attachment && (
                <a href={`${import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001'}${editData.attachment_path}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={12} /> View current
                </a>
              )}
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, ZIP, RAR, JPG, PNG, WEBP — Max 25 MB
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" style={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Update Announcement' : 'Create Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AnnouncementManagement() {
  const [announcements, setAnnouncements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [auditTarget, setAuditTarget] = useState(null);

  const totalPages = Math.ceil(total / limit);

  const loadCategories = useCallback(() => {
    axios.get(`${API}/categories`, { headers: authHeaders() })
      .then(r => setCategories(r.data.data || []))
      .catch(() => {});
  }, []);

  const loadAnnouncements = useCallback(() => {
    setLoading(true);
    const params = {
      page, limit, search,
      category: filterCat, status: filterStatus,
      display_mode: filterMode, priority: filterPriority,
      start_from: filterDateFrom, start_to: filterDateTo,
    };
    axios.get(API, { headers: authHeaders(), params })
      .then(r => {
        setAnnouncements(r.data.data || []);
        setTotal(r.data.total || 0);
      })
      .catch(() => toast.error('Failed to load announcements'))
      .finally(() => setLoading(false));
  }, [page, limit, search, filterCat, filterStatus, filterMode, filterPriority, filterDateFrom, filterDateTo]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadAnnouncements(); }, [loadAnnouncements]);

  const handleAction = async (action, id, label) => {
    if (['delete', 'archive'].includes(action)) {
      if (!window.confirm(`Are you sure you want to ${action} this announcement?`)) return;
    }
    try {
      if (action === 'delete')    await axios.delete(`${API}/${id}`, { headers: authHeaders() });
      if (action === 'publish')   await axios.patch(`${API}/${id}/publish`, {}, { headers: authHeaders() });
      if (action === 'unpublish') await axios.patch(`${API}/${id}/unpublish`, {}, { headers: authHeaders() });
      if (action === 'archive')   await axios.patch(`${API}/${id}/archive`, {}, { headers: authHeaders() });
      if (action === 'restore')   await axios.patch(`${API}/${id}/restore`, {}, { headers: authHeaders() });
      if (action === 'duplicate') await axios.post(`${API}/${id}/duplicate`, {}, { headers: authHeaders() });
      toast.success(label || `Done`);
      loadAnnouncements();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    }
  };

  const openEdit = async (id) => {
    try {
      const r = await axios.get(`${API}/${id}`, { headers: authHeaders() });
      setEditData(r.data.data);
      setShowForm(true);
    } catch { toast.error('Failed to load announcement'); }
  };

  const resetFilters = () => {
    setSearch(''); setFilterCat(''); setFilterStatus('');
    setFilterMode(''); setFilterPriority('');
    setFilterDateFrom(''); setFilterDateTo('');
    setPage(1);
  };

  const activeFilterCount = [filterCat, filterStatus, filterMode, filterPriority, filterDateFrom, filterDateTo]
    .filter(Boolean).length;

  return (
    <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif", background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #1e3a5f, #2a52b4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={18} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Announcement Management</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Centralized university-wide announcement system — publish notices visible on the main public dashboard.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={styles.btnSecondary} onClick={() => setShowCatModal(true)}>
            <Settings2 size={14} /> Categories
          </button>
          <button style={styles.btnSecondary} onClick={loadAnnouncements}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button style={styles.btnPrimary} onClick={() => { setEditData(null); setShowForm(true); }}>
            <Plus size={14} /> New Announcement
          </button>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUSES.map(s => {
          const count = announcements.filter(a => a.status === s.value).length;
          return (
            <div key={s.value} style={{
              padding: '8px 14px', borderRadius: 10, background: '#fff',
              border: `1px solid ${s.color}33`, cursor: 'pointer',
              boxShadow: filterStatus === s.value ? `0 0 0 2px ${s.color}` : '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'all 0.15s'
            }} onClick={() => { setFilterStatus(filterStatus === s.value ? '' : s.value); setPage(1); }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>
                {announcements.filter(a => a.status === s.value).length}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
            </div>
          );
          return null;
        })}
        <div style={{ padding: '8px 14px', borderRadius: 10, background: '#1e3a5f', color: '#fff', marginLeft: 'auto' }}>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{total}</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>Total</div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input style={{ ...styles.input, paddingLeft: 32, margin: 0 }}
              placeholder="Search announcements…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button style={{ ...styles.btnSecondary, position: 'relative' }} onClick={() => setShowFilters(v => !v)}>
            <Filter size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {activeFilterCount > 0 && (
            <button style={{ ...styles.btnSecondary, color: '#ef4444', borderColor: '#fecaca' }} onClick={resetFilters}>
              <X size={14} /> Clear
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Per page:</span>
            <select style={{ ...styles.input, padding: '5px 8px', margin: 0, width: 'auto' }}
              value={limit} onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }}>
              {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
            <div>
              <label style={styles.filterLabel}>Category</label>
              <select style={styles.filterInput} value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}>
                <option value="">All</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.filterLabel}>Status</label>
              <select style={styles.filterInput} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                <option value="">All</option>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.filterLabel}>Display Mode</label>
              <select style={styles.filterInput} value={filterMode} onChange={e => { setFilterMode(e.target.value); setPage(1); }}>
                <option value="">All</option>
                {DISPLAY_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.filterLabel}>Priority</label>
              <select style={styles.filterInput} value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1); }}>
                <option value="">All</option>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.filterLabel}>Start From</label>
              <input type="date" style={styles.filterInput} value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }} />
            </div>
            <div>
              <label style={styles.filterLabel}>Start To</label>
              <input type="date" style={styles.filterInput} value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1); }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                {['Title', 'Category', 'Mode', 'Priority', 'Status', 'Start Date', 'End Date', 'Attachment', 'Actions'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={styles.centered}>
                  <div style={{ padding: 40, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: '#6b7280' }}>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading announcements…
                  </div>
                </td></tr>
              ) : announcements.length === 0 ? (
                <tr><td colSpan={9}>
                  <div style={{ padding: 48, textAlign: 'center' }}>
                    <Megaphone size={40} style={{ color: '#d1d5db', marginBottom: 12 }} />
                    <div style={{ color: '#9ca3af', fontWeight: 500 }}>No announcements found</div>
                    <div style={{ color: '#d1d5db', fontSize: 12, marginTop: 4 }}>Click "New Announcement" to create one.</div>
                  </div>
                </td></tr>
              ) : announcements.map((a, idx) => (
                <tr key={a.id} style={{ ...styles.tr, background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...styles.td, maxWidth: 240 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.title}>{a.title}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>#{a.id} · by {a.created_by_email || '—'}</div>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 12, color: '#374151' }}>{a.category_name}</span>
                  </td>
                  <td style={styles.td}><ModeBadge mode={a.display_mode} /></td>
                  <td style={styles.td}><PriorityBadge priority={a.priority} /></td>
                  <td style={styles.td}><StatusBadge status={a.status} /></td>
                  <td style={styles.td}><span style={{ fontSize: 12 }}>{fmtDate(a.start_at)}</span></td>
                  <td style={styles.td}><span style={{ fontSize: 12 }}>{fmtDate(a.end_at)}</span></td>
                  <td style={styles.td}>
                    {a.attachment_path ? (
                      <a href={`${import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001'}${a.attachment_path}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', fontSize: 12 }} title={a.attachment_name}>
                        <Paperclip size={12} />
                        <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.attachment_name}
                        </span>
                      </a>
                    ) : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                      <button style={{ ...styles.iconBtn, color: '#2563eb' }} title="Edit" onClick={() => openEdit(a.id)}><Edit2 size={14} /></button>
                      {a.status !== 'published' && (
                        <button style={{ ...styles.iconBtn, color: '#059669' }} title="Publish" onClick={() => handleAction('publish', a.id, 'Published!')}><CheckCircle size={14} /></button>
                      )}
                      {a.status === 'published' && (
                        <button style={{ ...styles.iconBtn, color: '#d97706' }} title="Unpublish" onClick={() => handleAction('unpublish', a.id, 'Unpublished')}><EyeOff size={14} /></button>
                      )}
                      {!['archived', 'deleted'].includes(a.status) && (
                        <button style={{ ...styles.iconBtn, color: '#78350f' }} title="Archive" onClick={() => handleAction('archive', a.id, 'Archived')}><Archive size={14} /></button>
                      )}
                      {['archived', 'inactive', 'expired'].includes(a.status) && (
                        <button style={{ ...styles.iconBtn, color: '#7c3aed' }} title="Restore to Draft" onClick={() => handleAction('restore', a.id, 'Restored to draft')}><RotateCcw size={14} /></button>
                      )}
                      <button style={{ ...styles.iconBtn, color: '#0891b2' }} title="Duplicate" onClick={() => handleAction('duplicate', a.id, 'Duplicated!')}><Copy size={14} /></button>
                      <button style={{ ...styles.iconBtn, color: '#6b7280' }} title="Audit Trail" onClick={() => setAuditTarget(a)}><History size={14} /></button>
                      <button style={{ ...styles.iconBtn, color: '#ef4444' }} title="Delete" onClick={() => handleAction('delete', a.id, 'Deleted')}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <button key={p} style={{ ...styles.pageBtn, background: p === page ? '#1e3a5f' : '#fff', color: p === page ? '#fff' : '#374151' }}
                    onClick={() => setPage(p)}>{p}</button>
                );
              })}
              <button style={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showForm && (
        <AnnouncementForm
          editData={editData}
          categories={categories}
          onClose={() => { setShowForm(false); setEditData(null); }}
          onSaved={() => { setShowForm(false); setEditData(null); loadAnnouncements(); }}
        />
      )}
      {showCatModal && (
        <CategoryModal onClose={() => setShowCatModal(false)} onRefresh={loadCategories} />
      )}
      {auditTarget && (
        <AuditModal
          announcementId={auditTarget.id}
          title={auditTarget.title}
          onClose={() => setAuditTarget(null)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Inline styles ──────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 14, width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', borderBottom: '1px solid #e5e7eb',
    fontWeight: 700, fontSize: 16, color: '#1e293b',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#9ca3af',
    cursor: 'pointer', padding: 4, borderRadius: 6,
    display: 'flex', alignItems: 'center',
  },
  input: {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid #d1d5db', fontSize: 13, color: '#1e293b',
    outline: 'none', background: '#fff', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 },
  req: { color: '#ef4444' },
  formRow: { marginBottom: 14 },
  formGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' },
  formGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #1e3a5f, #2a52b4)', color: '#fff',
    fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8,
    border: '1px solid #d1d5db', background: '#fff', color: '#374151',
    fontWeight: 500, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '5px', borderRadius: 6, display: 'flex', alignItems: 'center',
    transition: 'background 0.1s',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.4px' },
  td: { padding: '10px 12px', fontSize: 13, color: '#374151', borderTop: '1px solid #f3f4f6', verticalAlign: 'middle' },
  tr: { transition: 'background 0.1s' },
  centered: { textAlign: 'center', color: '#9ca3af', padding: 24, fontSize: 13 },
  pageBtn: {
    minWidth: 32, height: 32, borderRadius: 6, border: '1px solid #e5e7eb',
    background: '#fff', color: '#374151', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  filterLabel: { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 },
  filterInput: {
    width: '100%', padding: '6px 10px', borderRadius: 7,
    border: '1px solid #d1d5db', fontSize: 12, color: '#374151', outline: 'none',
  },
};
