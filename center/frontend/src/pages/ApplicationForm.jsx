import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Building, MapPin, ChevronRight, ChevronLeft,
  Save, Send, CheckCircle, AlertCircle, Clock,
  Lock, XCircle, FileText, Phone, Mail
} from 'lucide-react';

const API = `(import.meta.env.VITE_CENTER_API_URL || 'http://localhost:5003') + '/api`;

const STEPS = [
  { label: 'Centre Information', icon: Building, desc: 'Name, type & recognition details' },
  { label: 'Address & Contact', icon: MapPin, desc: 'Location & communication details' },
];

const STATUS_COLORS = {
  Draft:    { bg: '#fef9c3', color: '#854d0e', icon: FileText },
  Pending:  { bg: '#eff6ff', color: '#1d4ed8', icon: Clock },
  Active:   { bg: '#dcfce7', color: '#166534', icon: CheckCircle },
  Approved: { bg: '#dcfce7', color: '#166534', icon: CheckCircle },
  Rejected: { bg: '#fee2e2', color: '#991b1b', icon: XCircle },
  Inactive: { bg: '#f1f5f9', color: '#475569', icon: XCircle },
};

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' },
  container: { maxWidth: 860, margin: '0 auto', padding: '32px 20px' },
  pageHeader: { marginBottom: 32 },
  pageTitle: { fontSize: 26, fontWeight: 800, color: '#0c4a6e', margin: 0 },
  pageSub: { fontSize: 14, color: '#0369a1', marginTop: 6 },
  statusBar: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderRadius: 12, marginBottom: 24, border: '1.5px solid', fontWeight: 600, fontSize: 14 },
  stepper: { display: 'flex', marginBottom: 36, gap: 0 },
  stepCircle: (active, done) => ({
    width: 52, height: 52, borderRadius: '50%', marginBottom: 10,
    background: active ? 'linear-gradient(135deg, #0891b2, #0e7490)' : done ? 'linear-gradient(135deg, #10b981, #059669)' : '#fff',
    border: `2px solid ${active ? '#0891b2' : done ? '#10b981' : '#e2e8f0'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: (active || done) ? '#fff' : '#94a3b8',
    boxShadow: active ? '0 0 0 6px rgba(8,145,178,0.12)' : 'none', transition: 'all 0.3s'
  }),
  stepLabel: (active) => ({ fontSize: 11, fontWeight: 700, color: active ? '#0891b2' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }),
  stepLine: { position: 'absolute', top: 26, left: '55%', right: '-45%', height: 2, background: '#e2e8f0', zIndex: 0 },
  stepItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 },
  card: { background: '#fff', borderRadius: 20, padding: '36px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #e0f2fe', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#0c4a6e', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 },
  sectionSub: { fontSize: 13, color: '#0369a1', marginBottom: 28 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 },
  group: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 },
  required: { color: '#ef4444' },
  input: (err) => ({
    padding: '11px 15px', borderRadius: 10, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
    border: `1.5px solid ${err ? '#f87171' : '#e2e8f0'}`, background: err ? '#fff5f5' : '#f8fafc', transition: 'all 0.2s'
  }),
  select: (err) => ({
    padding: '11px 15px', borderRadius: 10, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
    border: `1.5px solid ${err ? '#f87171' : '#e2e8f0'}`, background: err ? '#fff5f5' : '#f8fafc',
    appearance: 'none', cursor: 'pointer'
  }),
  errMsg: { fontSize: 11, color: '#ef4444', fontWeight: 500 },
  actions: { display: 'flex', justifyContent: 'space-between', marginTop: 32, gap: 16 },
  btnSecondary: { padding: '12px 24px', borderRadius: 12, border: '1.5px solid #bae6fd', background: '#fff', color: '#0369a1', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 },
  btnPrimary: { padding: '12px 32px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #0891b2, #0e7490)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, boxShadow: '0 4px 12px rgba(8,145,178,0.25)' },
  btnSuccess: { padding: '12px 32px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, boxShadow: '0 4px 12px rgba(5,150,105,0.25)' },
  readonlyBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#92400e', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 20 },
  notice: { background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#0369a1', marginTop: 24 },
  skeleton: { background: 'linear-gradient(90deg, #f0f9ff 25%, #e0f2fe 50%, #f0f9ff 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 10, height: 48 },
};

function validate(step, formData) {
  const errors = {};
  if (step === 0) {
    if (!formData.name?.trim()) errors.name = 'Centre name is required';
    if (!formData.centre_type_id) errors.centre_type_id = 'Centre type is required';
  }
  if (step === 1) {
    if (!formData.address_1?.trim()) errors.address_1 = 'Address is required';
    if (!formData.district_id) errors.district_id = 'District is required';
    if (formData.contact_number && !/^\d{10,11}$/.test(formData.contact_number)) errors.contact_number = 'Enter valid phone number';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Enter valid email address';
    if (formData.pincode && !/^\d{6}$/.test(formData.pincode)) errors.pincode = 'Pincode must be 6 digits';
  }
  return errors;
}

export default function ApplicationForm() {
  const { user, fetchMe } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [dropdowns, setDropdowns] = useState({});
  const [appStatus, setAppStatus] = useState('Draft');
  const [formData, setFormData] = useState({
    name: '',
    // ── Institute fields — use semantic names; DB id resolved by backend ──
    college_code: '',   // drives College Code dropdown; saved as rc.abbreviation
    college_name: '',   // drives College Name dropdown; NOT a DB column (join)
    // institute_id is kept for backward-compat with old saved drafts; backend
    // always resolves it from college_code on POST so we never rely on it in UI
    institute_id: '',
    centre_type_id: '',
    address_1: '', address_2: '', address_3: '', district_id: '', pincode: '',
    contact_number: '', email: '', hod_email: '',
    recognition_date: '', centre_ref_no: '', status: 'Draft',
    recognition_certificate: null
  });
  const [files, setFiles] = useState({ recognition_certificate: null });

  const isReadOnly = ['Active', 'Approved'].includes(appStatus);

  useEffect(() => {
    const tables = ['master_districts', 'master_centre_types', 'master_institutes'];
    Promise.all(tables.map(t => axios.get(`${API}/dropdowns/${t}`))).then(results => {
      const data = {};
      tables.forEach((t, i) => data[t] = results[i].data || []);
      setDropdowns(data);
    }).catch(() => toast.error('Failed to load dropdown data.'));

    axios.get(`${API}/portal/me`).then(res => {
      const d = res.data;
      setAppStatus(d.centre_status || d.centre_active || 'Draft');
      if (d.center_id) {
        setFormData(prev => ({
          ...prev, ...d,
          name:                    d.centre_name || d.name || '',
          email:                   d.centre_email || d.email || '',
          recognition_date:        d.recognition_date ? d.recognition_date.split('T')[0] : '',
          recognition_certificate: d.recognition_certificate || null,
          // ── Institute — use semantic identifiers, never DB serial ──────────
          // /me now returns mi.college_code AS college_code and mi.name AS college_name
          // from the joined master_institutes row.  These are the only values the
          // dropdowns care about; institute_id is kept internally for legacy compat.
          college_code:    d.college_code    || '',
          college_name:    d.college_name    || '',
          institute_id:    d.institute_id    ? String(d.institute_id)    : '',
          // ── FK dropdowns ────────────────────────────────────────────────────
          centre_type_id:  d.centre_type_id  ? String(d.centre_type_id)  : '',
          district_id:     d.district_id     ? String(d.district_id)     : '',
        }));
      } else {
        setFormData(prev => ({ ...prev, name: d.name || '', email: d.email || '' }));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const handleInput = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  }, [errors]);

  // ── Bidirectional Institute Sync Engine ────────────────────────────────────
  // Both handlers resolve from the same institutes list and update college_code,
  // college_name, AND institute_id (FK kept for backend persistence) atomically.
  // Neither handler ever touches a DB serial number in user-facing state.

  // College Code selected → auto-fill College Name
  const handleCollegeCodeChange = useCallback((e) => {
    const code = e.target.value;
    const inst = dropdowns.master_institutes?.find(d => d.college_code === code);
    setFormData(prev => ({
      ...prev,
      college_code: code,
      college_name: inst ? inst.college_name : '',
      institute_id: inst ? String(inst.id)   : '',   // FK; resolved by backend on save too
    }));
  }, [dropdowns.master_institutes]);

  // College Name selected → auto-fill College Code
  const handleCollegeNameChange = useCallback((e) => {
    const name = e.target.value;
    const inst = dropdowns.master_institutes?.find(d => d.college_name === name);
    setFormData(prev => ({
      ...prev,
      college_name: name,
      college_code: inst ? inst.college_code : '',
      institute_id: inst ? String(inst.id)   : '',   // FK; resolved by backend on save too
    }));
  }, [dropdowns.master_institutes]);

  const handleFile = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF documents are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Max 5MB allowed.');
      return;
    }
    setFiles(prev => ({ ...prev, [field]: file }));
    toast.success('Certificate selected successfully');
  };

  const saveApplication = async (isFinal = false) => {
    if (isReadOnly) return;
    if (isFinal) {
      const allErrors = { ...validate(0, formData), ...validate(1, formData) };
      if (Object.keys(allErrors).length > 0) {
        toast.error('Please fill all required fields before submitting.');
        setErrors(allErrors);
        return;
      }
    } else {
      const errs = validate(step, formData);
      if (Object.keys(errs).length > 0) { setErrors(errs); toast.error('Please fix highlighted errors.'); return; }
    }
    setSaving(true);
    
    const postData = new FormData();
    Object.entries(formData).forEach(([k, v]) => {
      postData.append(k, v ?? '');
    });
    if (isFinal) postData.set('status', 'Pending');
    if (files.recognition_certificate) {
      postData.append('recognition_certificate', files.recognition_certificate);
    }

    const toastId = toast.loading(isFinal ? 'Submitting registration...' : 'Saving progress...');
    try {
      await axios.post(`${API}/portal/application`, postData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(isFinal ? '✅ Registration submitted for university review!' : '💾 Progress saved successfully!', { id: toastId });
      if (isFinal) { await fetchMe(); navigate('/dashboard'); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save. Please try again.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    const errs = validate(step, formData);
    if (Object.keys(errs).length > 0) { setErrors(errs); toast.error('Please fix required fields.'); return; }
    setErrors({});
    saveApplication(false);
    setStep(s => s + 1);
  };

  if (loading) return (
    <div style={S.page}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={S.container}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 40 }}>
          {[1,2,3].map(i => <div key={i} style={{ ...S.skeleton, marginBottom: 20 }} />)}
        </div>
      </div>
    </div>
  );

  const sc = STATUS_COLORS[appStatus] || STATUS_COLORS.Draft;
  const StatusIcon = sc.icon;

  return (
    <div style={S.page}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={S.container}>
        <div style={S.pageHeader}>
          <h1 style={S.pageTitle}>Research Centre Registration</h1>
          <p style={S.pageSub}>Register your research centre for PhD program recognition by Periyar University.</p>
        </div>

        <div style={{ ...S.statusBar, background: sc.bg, borderColor: sc.color, color: sc.color }}>
          <StatusIcon size={18} />
          <span>Registration Status: <strong>{appStatus}</strong></span>
          {appStatus === 'Pending' && <span style={{ marginLeft: 'auto', fontSize: 12 }}>Under university review</span>}
          {appStatus === 'Rejected' && <span style={{ marginLeft: 'auto', fontSize: 12 }}>Contact admin for clarification</span>}
        </div>

        {isReadOnly && (
          <div style={S.readonlyBadge}>
            <Lock size={15} /> Centre is <strong>{appStatus}</strong> — editing locked. Contact university admin to modify.
          </div>
        )}

        <div style={S.stepper}>
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === i;
            const done = step > i;
            return (
              <div key={i} style={S.stepItem} onClick={() => done && setStep(i)}>
                {i < STEPS.length - 1 && <div style={S.stepLine} />}
                <div style={S.stepCircle(active, done)}>
                  {done ? <CheckCircle size={22} /> : <Icon size={22} />}
                </div>
                <div style={S.stepLabel(active)}>{s.label}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>{s.desc}</div>
              </div>
            );
          })}
        </div>

        <div style={S.card}>
          <div style={S.sectionTitle}>
            {React.createElement(STEPS[step].icon, { size: 22, color: '#0891b2' })}
            {STEPS[step].label}
          </div>
          <div style={S.sectionSub}>{STEPS[step].desc}</div>

          {step === 0 && (
            <div style={S.grid2}>
              <div style={{ ...S.group, gridColumn: '1 / -1' }}>
                <label style={S.label}><Building size={14} color="#0891b2" /> Centre Name <span style={S.required}>*</span></label>
                <input style={S.input(errors.name)} name="name" value={formData.name} onChange={handleInput} readOnly={isReadOnly} placeholder="e.g. Department of Computer Science, Periyar University" />
                {errors.name && <span style={S.errMsg}>{errors.name}</span>}
              </div>
              {/* ── College Code dropdown ──────────────────────────────────────────
                   value  = college_code string  (e.g. "101", "102")
                   sorted ASC by the API (college_code ASC) — no serial numbers    */}
              <div style={S.group}>
                <label style={S.label}>College Code</label>
                <select
                  style={S.select(false)}
                  name="college_code"
                  value={formData.college_code}
                  onChange={handleCollegeCodeChange}
                  disabled={isReadOnly}
                >
                  <option value="">— Select Code —</option>
                  {dropdowns.master_institutes?.map(d => (
                    <option key={d.college_code} value={d.college_code}>
                      {d.college_code}
                    </option>
                  ))}
                </select>
              </div>

              <div style={S.group}>
                <label style={S.label}>Centre Type <span style={S.required}>*</span></label>
                <select style={S.select(errors.centre_type_id)} name="centre_type_id" value={formData.centre_type_id} onChange={handleInput} disabled={isReadOnly}>
                  <option value="">— Select Type —</option>
                  {dropdowns.master_centre_types?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.centre_type_id && <span style={S.errMsg}>{errors.centre_type_id}</span>}
              </div>

              {/* ── College Name dropdown ──────────────────────────────────────────
                   value  = college_name string  (e.g. "Arignar Anna Govt Arts College")
                   sorted alphabetically (frontend sort) so names are easy to find   */}
              <div style={S.group}>
                <label style={S.label}>College Name</label>
                <select
                  style={S.select(false)}
                  name="college_name"
                  value={formData.college_name}
                  onChange={handleCollegeNameChange}
                  disabled={isReadOnly}
                >
                  <option value="">— Select College —</option>
                  {[...(dropdowns.master_institutes || [])]
                    .sort((a, b) => (a.college_name || '').localeCompare(b.college_name || ''))
                    .map(d => (
                      <option key={d.college_code} value={d.college_name}>
                        {d.college_name}
                      </option>
                    ))
                  }
                </select>
              </div>
              <div style={S.group}>
                <label style={S.label}>Recognition Ref. No.</label>
                <input style={S.input(false)} name="centre_ref_no" value={formData.centre_ref_no} onChange={handleInput} readOnly={isReadOnly} placeholder="e.g. PU/RC/2024/001" />
              </div>
              <div style={S.group}>
                <label style={S.label}>Recognition Date</label>
                <input style={S.input(false)} name="recognition_date" type="date" value={formData.recognition_date} onChange={handleInput} readOnly={isReadOnly} />
              </div>
              <div style={S.group}>
                <label style={S.label}>Recognition Certificate (PDF)</label>
                {formData.recognition_certificate && (
                  <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={15} color="#0891b2" />
                    <a
                      href={`((import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '')${formData.recognition_certificate}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#0891b2', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      View Existing Certificate
                    </a>
                  </div>
                )}
                <input
                  style={S.input(errors.recognition_certificate)}
                  type="file"
                  accept=".pdf"
                  onChange={e => handleFile(e, 'recognition_certificate')}
                  disabled={isReadOnly}
                />
                {errors.recognition_certificate && <span style={S.errMsg}>{errors.recognition_certificate}</span>}
              </div>
              <div style={{ ...S.notice, gridColumn: '1 / -1' }}>
                <AlertCircle size={17} style={{ flexShrink: 0 }} />
                <span>Once submitted, a Periyar University administrator will review and activate your centre for PhD admissions.</span>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={S.grid2}>
              <div style={{ ...S.group, gridColumn: '1 / -1' }}>
                <label style={S.label}><MapPin size={14} color="#0891b2" /> Address Line 1 <span style={S.required}>*</span></label>
                <input style={S.input(errors.address_1)} name="address_1" value={formData.address_1} onChange={handleInput} readOnly={isReadOnly} placeholder="Building No., Street Name" />
                {errors.address_1 && <span style={S.errMsg}>{errors.address_1}</span>}
              </div>
              <div style={S.group}>
                <label style={S.label}>Address Line 2</label>
                <input style={S.input(false)} name="address_2" value={formData.address_2} onChange={handleInput} readOnly={isReadOnly} placeholder="Area / Colony" />
              </div>
              <div style={S.group}>
                <label style={S.label}>City / Town</label>
                <input style={S.input(false)} name="address_3" value={formData.address_3} onChange={handleInput} readOnly={isReadOnly} />
              </div>
              <div style={S.group}>
                <label style={S.label}>District <span style={S.required}>*</span></label>
                <select style={S.select(errors.district_id)} name="district_id" value={formData.district_id} onChange={handleInput} disabled={isReadOnly}>
                  <option value="">— Select District —</option>
                  {dropdowns.master_districts?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.district_id && <span style={S.errMsg}>{errors.district_id}</span>}
              </div>
              <div style={S.group}>
                <label style={S.label}>Pincode</label>
                <input style={S.input(errors.pincode)} name="pincode" value={formData.pincode} onChange={handleInput} readOnly={isReadOnly} maxLength={6} placeholder="6-digit pincode" />
                {errors.pincode && <span style={S.errMsg}>{errors.pincode}</span>}
              </div>
              <div style={S.group}>
                <label style={S.label}><Mail size={13} color="#0891b2" /> Centre Email</label>
                <input style={S.input(errors.email)} name="email" type="email" value={formData.email} onChange={handleInput} readOnly={isReadOnly} placeholder="centre@university.edu" />
                {errors.email && <span style={S.errMsg}>{errors.email}</span>}
              </div>
              <div style={S.group}>
                <label style={S.label}><Phone size={13} color="#0891b2" /> Contact Number</label>
                <input style={S.input(errors.contact_number)} name="contact_number" value={formData.contact_number} onChange={handleInput} readOnly={isReadOnly} placeholder="10-digit phone number" />
                {errors.contact_number && <span style={S.errMsg}>{errors.contact_number}</span>}
              </div>
              <div style={{ ...S.group, gridColumn: '1 / -1' }}>
                <label style={S.label}>HOD / PRINCIPAL</label>
                <input style={S.input(false)} name="hod_email" type="email" value={formData.hod_email} onChange={handleInput} readOnly={isReadOnly} placeholder="hod@university.edu" />
              </div>
            </div>
          )}
        </div>

        <div style={S.actions}>
          {step > 0
            ? <button style={S.btnSecondary} onClick={() => setStep(s => s - 1)}><ChevronLeft size={17} /> Previous</button>
            : <div />}
          <div style={{ display: 'flex', gap: 12 }}>
            {!isReadOnly && (
              <button style={S.btnSecondary} onClick={() => saveApplication(false)} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button style={S.btnPrimary} onClick={goNext} disabled={saving}>
                Next Step <ChevronRight size={17} />
              </button>
            ) : !isReadOnly ? (
              <button style={S.btnSuccess} onClick={() => saveApplication(true)} disabled={saving}>
                <Send size={16} /> {saving ? 'Submitting...' : 'Submit Registration'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
