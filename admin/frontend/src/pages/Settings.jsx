import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Trash2, CheckCircle, Globe, Settings as SettingsIcon } from 'lucide-react';
import PortalManagement from './PortalManagement';
const API = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;
const token = () => localStorage.getItem('adminToken');
const authHeader = () => ({ Authorization: `Bearer ${token()}` });

const Settings = () => {
  const [settings, setSettings] = useState({});
  const [activeTab, setActiveTab] = useState('admission');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { 
    fetchAll(); 
  }, []);

  const fetchAll = async () => {
    try {
      const res = await axios.get(`${API}/settings`);
      setSettings(res.data.data || {});
    } catch { toast.error('Failed to load settings'); }
    setLoading(false);
  };

  const set = (key, val) => setSettings(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!settings.university_name_english || !settings.university_name_english.toString().trim()) {
      toast.error('Header Line 1 (English University Name) is required and cannot be empty!');
      return;
    }
    if (!settings.university_name_tamil || !settings.university_name_tamil.toString().trim()) {
      toast.error('Header Line 2 (Tamil University Name) is required and cannot be empty!');
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/settings/update`, settings, { headers: authHeader() });
      toast.success('Settings saved successfully!', {
        icon: <CheckCircle size={20} style={{ color: '#10b981' }} />,
        duration: 3000
      });
    } catch { toast.error('Failed to save settings'); }
    setSaving(false);
  };

  const uploadFile = async (field, file, type = 'image') => {
    const fd = new FormData();
    if (type === 'image') { fd.append('image', file); fd.append('field', field); }
    else { fd.append('file', file); fd.append('field', field); }
    const endpoint = type === 'image' ? 'upload-image' : 'upload-file';
    try {
      const res = await axios.post(`${API}/settings/${endpoint}`, fd, { headers: authHeader() });
      set(field, res.data.path);
      toast.success('Uploaded successfully!', {
        icon: <CheckCircle size={20} style={{ color: '#10b981' }} />
      });
    } catch { toast.error('Upload failed'); }
  };
  const deleteFile = async (field) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    set(field, null);
    toast.success('File removed. Click Save All Changes to apply.', {
      icon: <CheckCircle size={20} style={{ color: '#10b981' }} />
    });
  };

  const FileUploadCell = ({ label, field, type = 'image' }) => {
    const ref = useRef();
    const getUrl = (path) => {
      if (!path) return '#';
      if (path.startsWith('/uploads')) return `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + ''${path}`;
      return path; // Standard relative assets like /images/...
    };

    return (
      <div className="d-flex align-items-center gap-2">
        <input type="file" ref={ref} className="d-none" onChange={e => uploadFile(field, e.target.files[0], type)} />
        <div className="d-flex flex-column">
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-outline-primary" onClick={() => ref.current.click()}>
              {settings[field] ? 'Change' : 'Upload'} {label}
            </button>
            {settings[field] && (
              <div className="btn-group">
                <a href={getUrl(settings[field])} target="_blank" rel="noreferrer" className="btn btn-sm btn-success text-white">
                  View
                </a>
                <button 
                  className="btn btn-sm btn-danger text-white" 
                  onClick={() => deleteFile(field)}
                  title="Remove file"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
          {settings[field] && type === 'image' && (
            <img src={getUrl(settings[field])} alt={label} className="mt-2 rounded border" style={{ height: 40, objectFit: 'contain' }} />
          )}
        </div>
      </div>
    );
  };

  const Toggle = ({ field, label }) => (
    <div className="form-check form-switch d-flex align-items-center gap-2 mb-0">
      <input className="form-check-input" type="checkbox" style={{ width: 40, height: 22 }}
        checked={!!settings[field]} onChange={e => set(field, e.target.checked ? 1 : 0)} />
      <label className="form-check-label fw-semibold">{label}</label>
    </div>
  );

  const DateRange = ({ enableField, openField, closeField, label }) => (
    <tr>
      <td className="fw-semibold ps-3" style={{ width: 200 }}>{label}</td>
      <td><Toggle field={enableField} label="" /></td>
      <td><input type="date" className="form-control form-control-sm" value={settings[openField] ? settings[openField].slice(0,10) : ''} onChange={e => set(openField, e.target.value)} /></td>
      <td><input type="date" className="form-control form-control-sm" value={settings[closeField] ? settings[closeField].slice(0,10) : ''} onChange={e => set(closeField, e.target.value)} /></td>
    </tr>
  );

  if (loading) return <div className="p-5 text-center"><div className="spinner-border text-primary" /></div>;

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#32c5d2' }}>Online Application Settings</h2>
          <p className="text-muted mb-0 small">Manage all admission portal configuration and community fees</p>
        </div>
        {activeTab === 'admission' && (
          <button className="btn btn-primary px-4" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : '💾 Save All Changes'}
          </button>
        )}
      </div>

      {/* Dynamic Tab Switcher */}
      <div className="d-flex gap-2 mb-4 border-bottom pb-2">
        <button 
          onClick={() => setActiveTab('admission')} 
          className={`btn btn-sm d-flex align-items-center gap-1.5 px-3 py-2 border-0 rounded-3 ${
            activeTab === 'admission' ? 'btn-primary' : 'btn-outline-secondary bg-white'
          }`}
          style={activeTab === 'admission' ? { backgroundColor: '#32c5d2' } : {}}
        >
          <SettingsIcon size={16} /> Admission & Fees Settings
        </button>
        <button 
          onClick={() => setActiveTab('portals')} 
          className={`btn btn-sm d-flex align-items-center gap-1.5 px-3 py-2 border-0 rounded-3 ${
            activeTab === 'portals' ? 'btn-primary' : 'btn-outline-secondary bg-white'
          }`}
          style={activeTab === 'portals' ? { backgroundColor: '#32c5d2' } : {}}
        >
          <Globe size={16} /> Portal Landing Management
        </button>
      </div>

      {activeTab === 'portals' && <PortalManagement />}

      {activeTab === 'admission' && (
        <>
          {/* ── SECTION 1: HEADER ─────────────────────── */}
          <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>🏫 Header Information</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label small fw-semibold">Header Line 1 (English University Name)</label>
              <input className="form-control" value={settings.university_name_english || ''} onChange={e => set('university_name_english', e.target.value)} placeholder="PERIYAR UNIVERSITY" />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold">Header Line 2 (Tamil University Name)</label>
              <input className="form-control" value={settings.university_name_tamil || ''} onChange={e => set('university_name_tamil', e.target.value)} placeholder="பெரியார் பல்கலைக்கழகம்" />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold">Header Line 3 (Sub-title / NAAC Details)</label>
              <input className="form-control" value={settings.header_line2 || ''} onChange={e => set('header_line2', e.target.value)} placeholder="State University - NAAC 'A++' GRADE" />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold">Header Line 4 (Address)</label>
              <input className="form-control" value={settings.header_line3 || ''} onChange={e => set('header_line3', e.target.value)} placeholder="Salem - 636011, Tamil Nadu, INDIA" />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">University Logo</label>
              <FileUploadCell label="Logo" field="logo" type="image" />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Secondary Logo</label>
              <FileUploadCell label="Logo 2" field="logo2" type="image" />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: PORTAL HEADER NAVIGATION SETTINGS ───────────── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>🌐 Portal Header Navigation Settings</div>
        <div className="card-body">
          <div className="row g-4">
            
            {/* About Us Link Settings */}
            <div className="col-lg-4 col-md-12 border-end pe-md-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="fw-bold text-primary mb-0">ℹ️ About Us Link</h6>
                <Toggle field="about_us_enabled" label="Enabled" />
              </div>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">Button Title</label>
                  <input className="form-control form-control-sm" value={settings.about_us_title || ''} onChange={e => set('about_us_title', e.target.value)} placeholder="About Us" />
                </div>
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">URL / Link</label>
                  <input className="form-control form-control-sm" value={settings.about_us_link || ''} onChange={e => set('about_us_link', e.target.value)} placeholder="https://university.edu/about" />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Open Mode</label>
                  <select className="form-select form-select-sm" value={settings.about_us_open_mode || '_blank'} onChange={e => set('about_us_open_mode', e.target.value)}>
                    <option value="_blank">New Tab</option>
                    <option value="_self">Same Tab</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Order</label>
                  <input type="number" className="form-control form-control-sm" value={settings.about_us_order === undefined ? 1 : settings.about_us_order} onChange={e => set('about_us_order', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            {/* Policies Link Settings */}
            <div className="col-lg-4 col-md-12 border-end px-md-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="fw-bold text-success mb-0">🛡️ Policies Link</h6>
                <Toggle field="policies_enabled" label="Enabled" />
              </div>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">Button Title</label>
                  <input className="form-control form-control-sm" value={settings.policies_title || ''} onChange={e => set('policies_title', e.target.value)} placeholder="Policies" />
                </div>
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">URL / Link</label>
                  <input className="form-control form-control-sm" value={settings.policies_link || ''} onChange={e => set('policies_link', e.target.value)} placeholder="https://university.edu/policies.pdf" />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Open Mode</label>
                  <select className="form-select form-select-sm" value={settings.policies_open_mode || '_blank'} onChange={e => set('policies_open_mode', e.target.value)}>
                    <option value="_blank">New Tab</option>
                    <option value="_self">Same Tab</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Order</label>
                  <input type="number" className="form-control form-control-sm" value={settings.policies_order === undefined ? 2 : settings.policies_order} onChange={e => set('policies_order', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            {/* Contact Link Settings */}
            <div className="col-lg-4 col-md-12 ps-md-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="fw-bold text-info mb-0">📞 Contact Link</h6>
                <Toggle field="contact_enabled" label="Enabled" />
              </div>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">Button Title</label>
                  <input className="form-control form-control-sm" value={settings.contact_title || ''} onChange={e => set('contact_title', e.target.value)} placeholder="Contact" />
                </div>
                <div className="col-12">
                  <label className="form-label small text-muted mb-1">URL / Link</label>
                  <input className="form-control form-control-sm" value={settings.contact_link || ''} onChange={e => set('contact_link', e.target.value)} placeholder="/contact" />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Open Mode</label>
                  <select className="form-select form-select-sm" value={settings.contact_open_mode || '_self'} onChange={e => set('contact_open_mode', e.target.value)}>
                    <option value="_blank">New Tab</option>
                    <option value="_self">Same Tab</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">Order</label>
                  <input type="number" className="form-control form-control-sm" value={settings.contact_order === undefined ? 3 : settings.contact_order} onChange={e => set('contact_order', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── SECTION 3: FILES ───────────────────────── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>📎 Documents & Files</div>
        <div className="card-body">
          <div className="row g-3">
            {[
              { label: 'Prospectus', field: 'prospectus' },
              { label: 'Instructions', field: 'instruction_file' },
              { label: 'Syllabus', field: 'syllabus_file' },
            ].map(({ label, field }) => (
              <div className="col-md-4" key={field}>
                <label className="form-label small fw-semibold">{label}</label>
                <FileUploadCell label={label} field={field} type="file" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: PORTAL ENABLE SETTINGS ──────── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>🔐 Portal Access Control</div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bordered mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 200 }}>Module</th>
                  <th style={{ width: 100 }}>Enable</th>
                  <th>Open Date</th>
                  <th>Close Date</th>
                </tr>
              </thead>
              <tbody>
                <DateRange enableField="apply_now_enabled" openField="apply_now_open" closeField="apply_now_close" label="Apply Now (Registration)" />
                <DateRange enableField="applicant_login_enabled" openField="applicant_login_open" closeField="applicant_login_close" label="Applicant Login" />
                <DateRange enableField="hall_ticket_enabled" openField="hall_ticket_open" closeField="hall_ticket_close" label="Hall Ticket" />
                <DateRange enableField="payment_enabled" openField="payment_open" closeField="payment_close" label="Payment Window" />
                <tr>
                  <td className="fw-semibold ps-3">Last Payment Date</td>
                  <td colSpan="2"><input type="date" className="form-control form-control-sm" value={settings.last_payment_date ? settings.last_payment_date.slice(0,10) : ''} onChange={e => set('last_payment_date', e.target.value)} /></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: EXAM & INTERVIEW ─────────────── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>📅 Exam & Interview Schedule</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3"><label className="form-label small fw-semibold">Exam Date</label><input type="date" className="form-control" value={settings.exam_date ? settings.exam_date.slice(0,10) : ''} onChange={e => set('exam_date', e.target.value)} /></div>
            <div className="col-md-3"><label className="form-label small fw-semibold">Exam Time</label><input type="text" className="form-control" value={settings.exam_time || ''} onChange={e => set('exam_time', e.target.value)} placeholder="10:00 AM - 12:00 PM" /></div>
            <div className="col-md-3"><label className="form-label small fw-semibold">Interview Date</label><input type="date" className="form-control" value={settings.interview_date ? settings.interview_date.slice(0,10) : ''} onChange={e => set('interview_date', e.target.value)} /></div>
            <div className="col-md-3"><label className="form-label small fw-semibold">Interview Time</label><input type="text" className="form-control" value={settings.interview_time || ''} onChange={e => set('interview_time', e.target.value)} placeholder="10:00 AM" /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Certificate Validity</label><input className="form-control" value={settings.certificate_validity || ''} onChange={e => set('certificate_validity', e.target.value)} placeholder="This Session only" /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Certificate Date</label><input type="date" className="form-control" value={settings.certificate_date ? settings.certificate_date.slice(0,10) : ''} onChange={e => set('certificate_date', e.target.value)} /></div>
          </div>
        </div>
      </div>

      {/* ── SECTION 6: MARKS CONFIG ──────────────────── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>📊 Marks Configuration</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4"><label className="form-label small fw-semibold">Entrance Max Mark</label><input type="number" className="form-control" value={settings.entrance_max_mark || ''} onChange={e => set('entrance_max_mark', e.target.value)} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Entrance Calculated To</label><input type="number" className="form-control" value={settings.entrance_calculated_to || ''} onChange={e => set('entrance_calculated_to', e.target.value)} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Entrance Min Mark (Pass)</label><input type="number" className="form-control" value={settings.entrance_min_mark || ''} onChange={e => set('entrance_min_mark', e.target.value)} /></div>
            <div className="col-md-6"><label className="form-label small fw-semibold">Interview Max Mark</label><input type="number" className="form-control" value={settings.interview_max_mark || ''} onChange={e => set('interview_max_mark', e.target.value)} /></div>
            <div className="col-md-6"><label className="form-label small fw-semibold">Interview Calculated To</label><input type="number" className="form-control" value={settings.interview_calculated_to || ''} onChange={e => set('interview_calculated_to', e.target.value)} /></div>
          </div>
        </div>
      </div>

      {/* ── SECTION 7: QUICK LINKS ──────────────────── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>🔗 Quick Links & Toggles</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Online Application Link</label>
              <div className="input-group">
                <input className="form-control" value={settings.online_app_link || ''} onChange={e => set('online_app_link', e.target.value)} placeholder="https://..." />
                <span className="input-group-text"><Toggle field="online_app_enabled" label="" /></span>
              </div>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Merit List Link</label>
              <div className="input-group">
                <input className="form-control" value={settings.merit_list_link || ''} onChange={e => set('merit_list_link', e.target.value)} placeholder="https://..." />
                <span className="input-group-text"><Toggle field="merit_list_enabled" label="" /></span>
              </div>
            </div>
            <div className="col-md-4 d-flex align-items-center">
              <Toggle field="eligible_list_enabled" label="Show Eligible List" />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 9: CONTACT & FOOTER ─────────────── */}
      <div className="card mb-4">
        <div className="card-header fw-bold text-uppercase" style={{ fontSize: 12, letterSpacing: 1 }}>📬 Contact & Footer</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4"><label className="form-label small fw-semibold">Email</label><input type="email" className="form-control" value={settings.email || ''} onChange={e => set('email', e.target.value)} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Phone</label><input className="form-control" value={settings.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Website</label><input className="form-control" value={settings.website || ''} onChange={e => set('website', e.target.value)} /></div>
            <div className="col-12"><label className="form-label small fw-semibold">Address</label><textarea className="form-control" rows="2" value={settings.address || ''} onChange={e => set('address', e.target.value)} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Payment Button Text</label><input className="form-control" value={settings.payment_button_text || ''} onChange={e => set('payment_button_text', e.target.value)} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Payment Button Link</label><input className="form-control" value={settings.payment_button_link || ''} onChange={e => set('payment_button_link', e.target.value)} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Footer Text</label><input className="form-control" value={settings.footer_text || ''} onChange={e => set('footer_text', e.target.value)} /></div>
          </div>
        </div>
      </div>
      {/* Sticky Save */}
      <div className="d-flex justify-content-end mb-5">
        <button className="btn btn-primary btn-lg px-5" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : '💾 Save All Changes'}
        </button>
      </div>
        </>
      )}
    </div>
  );
};

export default Settings;
