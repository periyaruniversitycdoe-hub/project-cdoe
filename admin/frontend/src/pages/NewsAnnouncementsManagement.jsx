import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Plus, Search, Filter, RefreshCw, Edit2, Trash2, Eye,
  EyeOff, Archive, X, Upload, Paperclip, ChevronDown,
  ChevronLeft, ChevronRight, Pin, PinOff, Newspaper,
  Bell, BookOpen, AlertOctagon, Clock, Calendar, Users,
  CheckCircle, ExternalLink, ChevronUp
} from 'lucide-react';

const API   = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/news-announcements';
const FILES = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001');

const token = () => localStorage.getItem('adminToken');
const auth  = () => ({ Authorization: `Bearer ${token()}` });

// ── Constants ──────────────────────────────────────────────────────────────────
let CATEGORIES = [
  { value: 'news',         label: 'News',           icon: '📰', color: '#0369a1', bg: '#e0f2fe' },
  { value: 'announcement', label: 'Announcement',   icon: '📢', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'circular',     label: 'Circular',       icon: '📋', color: '#0f766e', bg: '#ccfbf1' },
  { value: 'alert',        label: 'Important Alert',icon: '🚨', color: '#dc2626', bg: '#fee2e2' },
  { value: 'deadline',     label: 'Deadline',       icon: '⏰', color: '#d97706', bg: '#fef3c7' },
  { value: 'event',        label: 'Event',          icon: '🎓', color: '#059669', bg: '#d1fae5' },
];

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', color: '#dc2626', bg: '#fee2e2', dot: '#ef4444' },
  { value: 'high',   label: 'High',   color: '#d97706', bg: '#fef3c7', dot: '#f59e0b' },
  { value: 'medium', label: 'Medium', color: '#2563eb', bg: '#dbeafe', dot: '#3b82f6' },
  { value: 'low',    label: 'Low',    color: '#059669', bg: '#d1fae5', dot: '#10b981' },
];

const AUDIENCES = [
  { value: 'all',        label: 'All Users',        icon: '👥' },
  { value: 'student',    label: 'Students',         icon: '🎓' },
  { value: 'supervisor', label: 'Supervisors',      icon: '👨‍🏫' },
  { value: 'centre',     label: 'Research Centres', icon: '🏛️' },
];

const STATUSES = [
  { value: 'draft',     label: 'Draft',     color: '#6b7280', bg: '#f3f4f6' },
  { value: 'published', label: 'Published', color: '#059669', bg: '#d1fae5' },
  { value: 'archived',  label: 'Archived',  color: '#78350f', bg: '#fef3c7' },
];

const BLANK = {
  title: '', description: '', category: 'announcement',
  priority: 'medium', audience: 'all',
  publish_date: '', expiry_date: '', status: 'draft', is_pinned: false,
  attachment: null, remove_attachment: false,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const catOf  = (v) => CATEGORIES.find(c => c.value === v) || CATEGORIES[1];
const priOf  = (v) => PRIORITIES.find(p => p.value === v) || PRIORITIES[2];
const audOf  = (v) => AUDIENCES.find(a => a.value === v) || AUDIENCES[0];
const statOf = (v) => STATUSES.find(s => s.value === v) || STATUSES[0];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toLocal(utc) {
  if (!utc) return '';
  const d = new Date(utc);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Badge Components ───────────────────────────────────────────────────────────
const CatBadge = ({ cat }) => {
  const c = catOf(cat);
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>
      {c.icon} {c.label}
    </span>
  );
};
const PriBadge = ({ pri }) => {
  const p = priOf(pri);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: p.bg, color: p.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, display: 'inline-block' }} />
      {p.label}
    </span>
  );
};
const StatBadge = ({ status }) => {
  const s = statOf(status);
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {status === 'published' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block', marginRight: 4 }} />}
      {s.label}
    </span>
  );
};

// ── View Detail Modal ──────────────────────────────────────────────────────────
function ViewModal({ item, onClose, onEdit }) {
  const cat = catOf(item.category);
  const pri = priOf(item.priority);
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}dd)`, padding: '20px 24px', borderRadius: '14px 14px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{cat.icon}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{cat.label}</div>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: '4px 0 0', lineHeight: 1.3 }}>{item.title}</h2>
            </div>
            <button style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }} onClick={onClose}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>
              ● {pri.label} Priority
            </span>
            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, padding: '3px 10px', borderRadius: 10 }}>
              {audOf(item.audience).icon} {audOf(item.audience).label}
            </span>
            {item.is_pinned ? <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, padding: '3px 10px', borderRadius: 10 }}>📌 Pinned</span> : null}
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>{item.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20, padding: 16, background: '#f8fafc', borderRadius: 10 }}>
            <div><span style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>Publish Date</span><span style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(item.publish_date)}</span></div>
            <div><span style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>Expiry Date</span><span style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(item.expiry_date)}</span></div>
          </div>
          {item.attachment_path && (
            <a href={`${FILES}${item.attachment_path}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 16px', background: '#1e3a5f', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <Paperclip size={14} /> Download Attachment
            </a>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <button style={S.btnSecondary} onClick={onClose}>Close</button>
            <button style={S.btnPrimary} onClick={() => { onClose(); onEdit(item); }}>Edit <Edit2 size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Form Modal ─────────────────────────────────────────────────────────────────
function FormModal({ editData, onClose, onSaved, fetchCategories }) {
  const [form, setForm] = useState(() => editData ? {
    ...BLANK, ...editData,
    publish_date: toLocal(editData.publish_date),
    expiry_date:  toLocal(editData.expiry_date),
    attachment: null, remove_attachment: false,
  } : { ...BLANK });
  const [saving, setSaving] = useState(false);
  const [attachName, setAttachName] = useState(editData?.attachment_name || null);
  const fileRef = useRef();

  const [showAddCat, setShowAddCat] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [catForm, setCatForm] = useState({ label: '', category_key: '', icon: '📢', color: '#7c3aed', bg: '#ede9fe' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = e => {
    const f = e.target.files[0]; if (!f) return;
    set('attachment', f); set('remove_attachment', false); setAttachName(f.name);
  };

  const removeFile = () => {
    set('attachment', null); set('remove_attachment', true); setAttachName(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleAddCatSubmit = async e => {
    e.preventDefault();
    if (!catForm.label.trim()) return toast.error('Category name is required');
    if (!catForm.category_key.trim()) return toast.error('Category unique key is required');

    setCatSaving(true);
    try {
      const res = await axios.post(`${API}/categories`, catForm, { headers: auth() });
      if (res.data.success) {
        toast.success('Category created successfully');
        if (typeof fetchCategories === 'function') {
          await fetchCategories();
        }
        set('category', res.data.data.category_key);
        setShowAddCat(false);
        setCatForm({ label: '', category_key: '', icon: '📢', color: '#7c3aed', bg: '#ede9fe' });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create category');
    } finally { setCatSaving(false); }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.title.trim())       return toast.error('Title is required');
    if (!form.description.trim()) return toast.error('Description is required');
    if (!form.publish_date)       return toast.error('Publish date is required');
    if (!form.expiry_date)        return toast.error('Expiry date is required');
    if (new Date(form.expiry_date) <= new Date(form.publish_date))
      return toast.error('Expiry must be after publish date');

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'attachment') { if (v) fd.append('attachment', v); }
        else if (k === 'remove_attachment') fd.append('remove_attachment', v ? '1' : '0');
        else if (v !== null && v !== undefined) fd.append(k, v);
      });
      if (editData) {
        await axios.put(`${API}/${editData.id}`, fd, { headers: { ...auth(), 'Content-Type': 'multipart/form-data' } });
        toast.success('Announcement updated');
      } else {
        await axios.post(API, fd, { headers: { ...auth(), 'Content-Type': 'multipart/form-data' } });
        toast.success('Announcement created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth: 780, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={S.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Newspaper size={18} />
            {editData ? 'Edit Announcement' : 'Create New Announcement'}
          </div>
          <button style={S.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {/* Title */}
          <div style={S.row}>
            <label style={S.lbl}>Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={S.input} value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Enter announcement title" maxLength={500} />
          </div>

          {/* Description */}
          <div style={S.row}>
            <label style={S.lbl}>Description <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea style={{ ...S.input, minHeight: 110, resize: 'vertical' }}
              value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Enter full announcement content…" />
          </div>

          {/* Category + Priority */}
          <div style={S.grid2}>
            <div style={S.row}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ ...S.lbl, marginBottom: 0 }}>Category <span style={{ color: '#ef4444' }}>*</span></label>
                <button type="button" onClick={() => setShowAddCat(true)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Plus size={11} /> Add Category
                </button>
              </div>
              <select style={S.input} value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div style={S.row}>
              <label style={S.lbl}>Priority <span style={{ color: '#ef4444' }}>*</span></label>
              <select style={S.input} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Audience + Status */}
          <div style={S.grid2}>
            <div style={S.row}>
              <label style={S.lbl}>Target Audience <span style={{ color: '#ef4444' }}>*</span></label>
              <select style={S.input} value={form.audience} onChange={e => set('audience', e.target.value)}>
                {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
              </select>
            </div>
            <div style={S.row}>
              <label style={S.lbl}>Status</label>
              <select style={S.input} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div style={S.grid2}>
            <div style={S.row}>
              <label style={S.lbl}>Publish Date & Time <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="datetime-local" style={S.input} value={form.publish_date} onChange={e => set('publish_date', e.target.value)} />
            </div>
            <div style={S.row}>
              <label style={S.lbl}>Expiry Date & Time <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="datetime-local" style={S.input} value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
            </div>
          </div>

          {/* Pin toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <input type="checkbox" id="pin" checked={!!form.is_pinned}
              onChange={e => set('is_pinned', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="pin" style={{ fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
              📌 Pin this announcement (appears at top of the board)
            </label>
          </div>

          {/* Attachment */}
          <div style={S.row}>
            <label style={S.lbl}>Attachment (PDF / DOC / Image)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ ...S.btnSecondary, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Upload size={13} /> {attachName ? 'Replace File' : 'Upload File'}
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" />
              </label>
              {attachName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0f9ff', padding: '4px 12px', borderRadius: 6, fontSize: 12 }}>
                  <Paperclip size={12} style={{ color: '#0369a1' }} />
                  <span style={{ color: '#0369a1', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachName}</span>
                  <button type="button" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, lineHeight: 1 }} onClick={removeFile}><X size={12} /></button>
                </div>
              )}
              {editData?.attachment_path && !form.remove_attachment && !form.attachment && (
                <a href={`${FILES}${editData.attachment_path}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={12} /> View current
                </a>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
            <button type="button" style={S.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" style={S.btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editData ? '✓ Update Announcement' : '+ Create Announcement'}
            </button>
          </div>
        </form>
      </div>

      {showAddCat && (
        <div style={S.subOverlay} onClick={e => e.stopPropagation()}>
          <div style={{ ...S.modal, maxWidth: 440, padding: '20px 24px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #f3f4f6', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} /> Add Custom Category
              </h3>
              <button type="button" style={S.closeBtn} onClick={() => setShowAddCat(false)}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={S.lbl}>Category Name *</label>
                <input 
                  style={S.input} 
                  value={catForm.label} 
                  onChange={e => {
                    const val = e.target.value;
                    setCatForm(prev => ({
                      ...prev,
                      label: val,
                      category_key: prev.category_key === prev.label.toLowerCase().replace(/[^a-z0-9_]/g, '_') || !prev.category_key 
                        ? val.toLowerCase().replace(/[^a-z0-9_]/g, '_') 
                        : prev.category_key
                    }));
                  }}
                  placeholder="e.g. Scholarship" 
                />
              </div>

              <div>
                <label style={S.lbl}>Unique Key * <span style={{ fontSize: 10, fontWeight: 400, color: '#64748b' }}>(lowercase, a-z, 0-9, _)</span></label>
                <input 
                  style={S.input} 
                  value={catForm.category_key} 
                  onChange={e => setCatForm(prev => ({ ...prev, category_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="e.g. scholarship" 
                />
              </div>

              <div>
                <label style={S.lbl}>Icon (Pick or Type) *</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {['📢', '📰', '📋', '🚨', '⏰', '🎓', '💼', '🔬', '💰', '🏆', '📌', '🏷️', '🔔', '✉️'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCatForm(prev => ({ ...prev, icon: emoji }))}
                      style={{
                        fontSize: 16,
                        padding: '4px 6px',
                        borderRadius: 6,
                        border: catForm.icon === emoji ? '2px solid #2563eb' : '1px solid #e5e7eb',
                        background: catForm.icon === emoji ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.1s'
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <input 
                  style={{ ...S.input, width: 80 }} 
                  value={catForm.icon} 
                  onChange={e => setCatForm(prev => ({ ...prev, icon: e.target.value }))}
                  placeholder="📢" 
                  maxLength={5}
                />
              </div>

              <div>
                <label style={S.lbl}>Theme Preset (Harmonized Colors) *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                  {[
                    { name: 'Blue', color: '#0369a1', bg: '#e0f2fe' },
                    { name: 'Violet', color: '#7c3aed', bg: '#ede9fe' },
                    { name: 'Teal', color: '#0f766e', bg: '#ccfbf1' },
                    { name: 'Red', color: '#dc2626', bg: '#fee2e2' },
                    { name: 'Orange', color: '#d97706', bg: '#fef3c7' },
                    { name: 'Green', color: '#059669', bg: '#d1fae5' },
                    { name: 'Indigo', color: '#4f46e5', bg: '#e0e7ff' },
                    { name: 'Pink', color: '#db2777', bg: '#fce7f3' },
                  ].map(preset => {
                    const isSelected = catForm.color === preset.color && catForm.bg === preset.bg;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setCatForm(prev => ({ ...prev, color: preset.color, bg: preset.bg }))}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px 4px',
                          borderRadius: 8,
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                          background: isSelected ? '#eff6ff' : '#fff',
                          cursor: 'pointer',
                          fontSize: 10,
                          fontWeight: 600,
                          transition: 'all 0.1s'
                        }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: '50%', background: preset.color, display: 'inline-block', marginBottom: 2, border: `2px solid ${preset.bg}` }} />
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...S.lbl, fontSize: 11 }}>Custom Text Color</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input 
                        type="color" 
                        value={catForm.color} 
                        onChange={e => setCatForm(prev => ({ ...prev, color: e.target.value }))}
                        style={{ width: 34, height: 34, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
                      />
                      <input style={{ ...S.input, fontSize: 11, padding: '4px 8px' }} value={catForm.color} onChange={e => setCatForm(prev => ({ ...prev, color: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...S.lbl, fontSize: 11 }}>Custom Background</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input 
                        type="color" 
                        value={catForm.bg} 
                        onChange={e => setCatForm(prev => ({ ...prev, bg: e.target.value }))}
                        style={{ width: 34, height: 34, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
                      />
                      <input style={{ ...S.input, fontSize: 11, padding: '4px 8px' }} value={catForm.bg} onChange={e => setCatForm(prev => ({ ...prev, bg: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px dashed #e2e8f0', marginTop: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Live Preview Badge</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: catForm.bg, color: catForm.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span>{catForm.icon}</span>
                    <span>{catForm.label || 'Category Name'}</span>
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <button type="button" style={S.btnSecondary} onClick={() => setShowAddCat(false)}>Cancel</button>
              <button type="button" style={S.btnPrimary} onClick={handleAddCatSubmit} disabled={catSaving}>
                {catSaving ? 'Saving…' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const PER_PAGE = [10, 20, 50, 100];

export default function NewsAnnouncementsManagement() {
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [limit, setLimit]       = useState(20);

  const [search, setSearch]             = useState('');
  const [filterCat, setFilterCat]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAud, setFilterAud]       = useState('');
  const [filterPri, setFilterPri]       = useState('');
  const [showFilters, setShowFilters]   = useState(false);

  const [showForm,  setShowForm]  = useState(false);
  const [editData,  setEditData]  = useState(null);
  const [viewItem,  setViewItem]  = useState(null);
  
  const [categoriesLoaded, setCategoriesLoaded] = useState(0);

  const totalPages = Math.ceil(total / limit);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/categories`, { headers: auth() });
      if (res.data.success && res.data.data) {
        const apiCats = res.data.data.map(c => ({
          value: c.category_key,
          label: c.label,
          icon: c.icon || '📢',
          color: c.color || '#7c3aed',
          bg: c.bg || '#ede9fe'
        }));
        
        const unique = [];
        const keys = new Set();
        apiCats.forEach(c => {
          if (!keys.has(c.value)) {
            keys.add(c.value);
            unique.push(c);
          }
        });
        const hardcoded = [
          { value: 'news',         label: 'News',           icon: '📰', color: '#0369a1', bg: '#e0f2fe' },
          { value: 'announcement', label: 'Announcement',   icon: '📢', color: '#7c3aed', bg: '#ede9fe' },
          { value: 'circular',     label: 'Circular',       icon: '📋', color: '#0f766e', bg: '#ccfbf1' },
          { value: 'alert',        label: 'Important Alert',icon: '🚨', color: '#dc2626', bg: '#fee2e2' },
          { value: 'deadline',     label: 'Deadline',       icon: '⏰', color: '#d97706', bg: '#fef3c7' },
          { value: 'event',        label: 'Event',          icon: '🎓', color: '#059669', bg: '#d1fae5' },
        ];
        hardcoded.forEach(c => {
          if (!keys.has(c.value)) {
            keys.add(c.value);
            unique.push(c);
          }
        });
        CATEGORIES = unique;
        setCategoriesLoaded(prev => prev + 1);
      }
    } catch (err) {
      console.error('Failed to load dynamic categories:', err);
    }
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(API, {
      headers: auth(),
      params: { page, limit, search, category: filterCat, status: filterStatus, audience: filterAud, priority: filterPri },
    })
      .then(r => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [page, limit, search, filterCat, filterStatus, filterAud, filterPri]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => { load(); }, [load]);

  const action = async (method, url, msg) => {
    try {
      if (method === 'delete') await axios.delete(url, { headers: auth() });
      else await axios.patch(url, {}, { headers: auth() });
      toast.success(msg);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const openEdit = async id => {
    try {
      const r = await axios.get(`${API}/${id}`, { headers: auth() });
      setEditData(r.data.data); setShowForm(true);
    } catch { toast.error('Load failed'); }
  };

  const resetFilters = () => {
    setSearch(''); setFilterCat(''); setFilterStatus('');
    setFilterAud(''); setFilterPri(''); setPage(1);
  };

  const activeFilters = [filterCat, filterStatus, filterAud, filterPri].filter(Boolean).length;

  // stat counts from current rows (rough — page-level)
  const countBy = (key, val) => rows.filter(r => r[key] === val).length;

  return (
    <div style={{ padding: 24, fontFamily: "'Inter', sans-serif", background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#1e3a5f,#2a52b4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Newspaper size={20} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e293b' }}>News & Announcements</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Central communication hub — publish news, circulars, alerts and deadlines visible on all portal dashboards.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={S.btnSecondary} onClick={load}><RefreshCw size={13} /> Refresh</button>
          <button style={S.btnPrimary} onClick={() => { setEditData(null); setShowForm(true); }}>
            <Plus size={14} /> New Announcement
          </button>
        </div>
      </div>

      {/* ── Category quick-stats strip ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => (
          <div key={c.value} onClick={() => { setFilterCat(filterCat === c.value ? '' : c.value); setPage(1); }}
            style={{ padding: '8px 14px', borderRadius: 10, background: '#fff', border: `1px solid ${filterCat === c.value ? c.color : '#e5e7eb'}`, cursor: 'pointer',
              boxShadow: filterCat === c.value ? `0 0 0 2px ${c.color}44` : '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 17 }}>{c.icon}</div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
        <div style={{ padding: '8px 16px', borderRadius: 10, background: '#1e3a5f', color: '#fff', marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{total}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>Total</div>
        </div>
      </div>

      {/* ── Priority legend ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {PRIORITIES.map(p => (
          <div key={p.value} onClick={() => { setFilterPri(filterPri === p.value ? '' : p.value); setPage(1); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: p.bg, border: `1.5px solid ${filterPri === p.value ? p.color : 'transparent'}`, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: p.color }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.dot, display: 'inline-block' }} />
            {p.label}
          </div>
        ))}
      </div>

      {/* ── Search + Filters ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input style={{ ...S.input, paddingLeft: 32, margin: 0 }} placeholder="Search title or content…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button style={{ ...S.btnSecondary, position: 'relative' }} onClick={() => setShowFilters(v => !v)}>
            <Filter size={13} /> Filters
            {activeFilters > 0 && <span style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{activeFilters}</span>}
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {activeFilters > 0 && <button style={{ ...S.btnSecondary, color: '#ef4444', borderColor: '#fecaca' }} onClick={resetFilters}><X size={13} /> Clear</button>}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Per page:</span>
            <select style={{ ...S.input, padding: '5px 8px', margin: 0, width: 'auto' }} value={limit}
              onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }}>
              {PER_PAGE.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
            {[
              { label: 'Status',   val: filterStatus, set: v => { setFilterStatus(v); setPage(1); }, opts: STATUSES.map(s => ({ value: s.value, label: s.label })) },
              { label: 'Audience', val: filterAud,    set: v => { setFilterAud(v);    setPage(1); }, opts: AUDIENCES.map(a => ({ value: a.value, label: a.label })) },
            ].map(({ label, val, set: setFn, opts }) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{label}</div>
                <select style={{ ...S.input, padding: '6px 10px', margin: 0, fontSize: 12 }} value={val} onChange={e => setFn(e.target.value)}>
                  <option value="">All</option>
                  {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                {['Title', 'Category', 'Priority', 'Audience', 'Status', 'Publish Date', 'Expiry Date', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />Loading…
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 56, textAlign: 'center' }}>
                  <Newspaper size={40} style={{ color: '#d1d5db', marginBottom: 10 }} />
                  <div style={{ color: '#9ca3af', fontWeight: 600 }}>No announcements found</div>
                  <div style={{ color: '#d1d5db', fontSize: 12, marginTop: 4 }}>Click "New Announcement" to get started.</div>
                </td></tr>
              ) : rows.map((row, idx) => (
                <tr key={row.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                  <td style={S.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {row.is_pinned ? <Pin size={12} style={{ color: '#f59e0b', flexShrink: 0 }} /> : null}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.title}>{row.title}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>#{row.id} · {row.created_by_email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={S.td}><CatBadge cat={row.category} /></td>
                  <td style={S.td}><PriBadge pri={row.priority} /></td>
                  <td style={S.td}><span style={{ fontSize: 12 }}>{audOf(row.audience).icon} {audOf(row.audience).label}</span></td>
                  <td style={S.td}><StatBadge status={row.status} /></td>
                  <td style={S.td}><span style={{ fontSize: 12 }}>{fmtDate(row.publish_date)}</span></td>
                  <td style={S.td}><span style={{ fontSize: 12 }}>{fmtDate(row.expiry_date)}</span></td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button style={{ ...S.iconBtn, color: '#6366f1' }} title="View" onClick={() => setViewItem(row)}><Eye size={14} /></button>
                      <button style={{ ...S.iconBtn, color: '#2563eb' }} title="Edit" onClick={() => openEdit(row.id)}><Edit2 size={14} /></button>
                      {row.status !== 'published' && <button style={{ ...S.iconBtn, color: '#059669' }} title="Publish" onClick={() => action('patch', `${API}/${row.id}/publish`, 'Published!')}><CheckCircle size={14} /></button>}
                      {row.status === 'published' && <button style={{ ...S.iconBtn, color: '#d97706' }} title="Unpublish" onClick={() => action('patch', `${API}/${row.id}/unpublish`, 'Unpublished')}><EyeOff size={14} /></button>}
                      {row.status !== 'archived' && <button style={{ ...S.iconBtn, color: '#78350f' }} title="Archive" onClick={() => action('patch', `${API}/${row.id}/archive`, 'Archived')}><Archive size={14} /></button>}
                      <button style={{ ...S.iconBtn, color: row.is_pinned ? '#f59e0b' : '#9ca3af' }} title={row.is_pinned ? 'Unpin' : 'Pin'}
                        onClick={() => action('patch', `${API}/${row.id}/pin`, row.is_pinned ? 'Unpinned' : 'Pinned!')}>
                        {row.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button style={{ ...S.iconBtn, color: '#ef4444' }} title="Delete"
                        onClick={() => { if (window.confirm('Delete this announcement?')) action('delete', `${API}/${row.id}`, 'Deleted'); }}>
                        <Trash2 size={14} />
                      </button>
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
              Showing {Math.min((page-1)*limit+1, total)}–{Math.min(page*limit, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={S.pageBtn} disabled={page === 1} onClick={() => setPage(p => p-1)}><ChevronLeft size={14} /></button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p = totalPages <= 7 ? i+1 : page <= 4 ? i+1 : page >= totalPages-3 ? totalPages-6+i : page-3+i;
                return <button key={p} style={{ ...S.pageBtn, background: p === page ? '#1e3a5f' : '#fff', color: p === page ? '#fff' : '#374151' }} onClick={() => setPage(p)}>{p}</button>;
              })}
              <button style={S.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p+1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showForm && <FormModal editData={editData} onClose={() => { setShowForm(false); setEditData(null); }} onSaved={() => { setShowForm(false); setEditData(null); load(); }} fetchCategories={fetchCategories} />}
      {viewItem && <ViewModal item={viewItem} onClose={() => setViewItem(null)} onEdit={item => { openEdit(item.id); setViewItem(null); }} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  subOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal:      { background: '#fff', borderRadius: 14, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: 16, color: '#1e293b' },
  closeBtn:   { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' },
  input:      { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, color: '#1e293b', outline: 'none', background: '#fff', boxSizing: 'border-box' },
  lbl:        { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 },
  row:        { marginBottom: 14 },
  grid2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1e3a5f,#2a52b4)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnSecondary:{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  iconBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center' },
  th:         { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.4px' },
  td:         { padding: '10px 12px', fontSize: 13, color: '#374151', verticalAlign: 'middle' },
  pageBtn:    { minWidth: 32, height: 32, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 },
};
