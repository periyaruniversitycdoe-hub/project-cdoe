import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  User, MapPin, Briefcase, GraduationCap, 
  ChevronRight, ChevronLeft, Save, Send, 
  CheckCircle, AlertCircle, Plus, Trash2,
  Camera, Lock, Clock, XCircle, FileText, Landmark
} from 'lucide-react';
import { INDIAN_BANKS } from '../constants/banks';

const API = (import.meta.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002') + '/api';

const STEPS = [
  { label: 'General Info', icon: User, desc: 'Personal & designation details' },
  { label: 'Address & Identity', icon: MapPin, desc: 'Contact & ID proof' },
  { label: 'Professional Details', icon: Briefcase, desc: 'Experience & dates' },
  { label: 'Bank Details', icon: Landmark, desc: 'Account disbursement details' },
  { label: 'Disciplines', icon: GraduationCap, desc: 'Research areas & centres' },
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
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' },
  container: { maxWidth: 1000, margin: '0 auto', padding: '32px 20px' },
  pageHeader: { marginBottom: 32 },
  pageTitle: { fontSize: 28, fontWeight: 800, color: '#1e293b', margin: 0 },
  pageSub: { fontSize: 14, color: '#64748b', marginTop: 6 },
  statusBar: { 
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
    borderRadius: 12, marginBottom: 28, border: '1.5px solid', fontWeight: 600, fontSize: 14
  },
  stepper: { display: 'flex', marginBottom: 36, position: 'relative', gap: 0 },
  stepItem: (active, done) => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    cursor: done ? 'pointer' : 'default', position: 'relative', zIndex: 1
  }),
  stepCircle: (active, done) => ({
    width: 52, height: 52, borderRadius: '50%',
    background: active ? 'linear-gradient(135deg, #4338ca, #6366f1)' : done ? 'linear-gradient(135deg, #10b981, #059669)' : '#fff',
    border: `2px solid ${active ? '#4338ca' : done ? '#10b981' : '#e2e8f0'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: (active || done) ? '#fff' : '#94a3b8', marginBottom: 10,
    boxShadow: active ? '0 0 0 6px rgba(67,56,202,0.12)' : 'none',
    transition: 'all 0.3s'
  }),
  stepLabel: (active) => ({ fontSize: 11, fontWeight: 700, color: active ? '#4338ca' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }),
  stepDesc: { fontSize: 10, color: '#cbd5e1', textAlign: 'center', marginTop: 2 },
  stepLine: { position: 'absolute', top: 26, left: '55%', right: '-45%', height: 2, background: '#e2e8f0', zIndex: 0 },
  card: { background: '#fff', borderRadius: 20, padding: '36px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 },
  sectionSub: { fontSize: 13, color: '#64748b', marginBottom: 28 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 },
  group: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  required: { color: '#ef4444', marginLeft: 3 },
  input: (err) => ({ 
    padding: '11px 15px', borderRadius: 10, fontSize: 14, outline: 'none', 
    border: `1.5px solid ${err ? '#f87171' : '#e2e8f0'}`, background: err ? '#fff5f5' : '#f8fafc',
    transition: 'all 0.2s', width: '100%', boxSizing: 'border-box'
  }),
  select: (err) => ({ 
    padding: '11px 15px', borderRadius: 10, fontSize: 14, outline: 'none', 
    border: `1.5px solid ${err ? '#f87171' : '#e2e8f0'}`, background: err ? '#fff5f5' : '#f8fafc',
    appearance: 'none', cursor: 'pointer', width: '100%', boxSizing: 'border-box'
  }),
  errMsg: { fontSize: 11, color: '#ef4444', fontWeight: 500, marginTop: 2 },
  actions: { display: 'flex', justifyContent: 'space-between', marginTop: 36, gap: 16 },
  btnSecondary: { padding: '12px 24px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 },
  btnPrimary: { padding: '12px 32px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4338ca, #312e81)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, boxShadow: '0 4px 12px rgba(67,56,202,0.25)' },
  btnSuccess: { padding: '12px 32px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, boxShadow: '0 4px 12px rgba(5,150,105,0.25)' },
  photoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 },
  photo: { width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' },
  photoPlaceholder: { width: 110, height: 110, borderRadius: '50%', background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  photoBtn: { marginTop: 10, fontSize: 12, fontWeight: 700, color: '#4338ca', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 },
  td: { padding: '14px', background: '#f8fafc', borderTop: '1.5px solid #e2e8f0', borderBottom: '1.5px solid #e2e8f0', fontSize: 13 },
  tdFirst: { borderLeft: '1.5px solid #e2e8f0', borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  tdLast: { borderRight: '1.5px solid #e2e8f0', borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  readonlyBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#92400e', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 20 },
  notice: { background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#92400e', marginTop: 24 },
  skeleton: { background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 10, height: 48 },
  inputGroup: { position: 'relative' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  maskBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 },
  dropdownContainer: { position: 'relative' },
  dropdownMenu: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 10, marginTop: 6, maxHeight: 220, overflowY: 'auto', zIndex: 10, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)', listStyle: 'none', padding: 0 },
  dropdownItem: { padding: '10px 16px', fontSize: 14, cursor: 'pointer', color: '#334155', transition: 'background 0.15s' },
  noResult: { padding: '12px 16px', fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  ifscLoader: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4 },
  successIndicator: { display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', marginLeft: 6 },
  errIndicator: { display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#ef4444', marginLeft: 6 },
};

const REQUIRED_STEP0 = ['name', 'gender', 'designation_id'];
const REQUIRED_STEP1 = ['address_1', 'district_id', 'pincode', 'mobile', 'home_address_1', 'home_district_id', 'home_pincode'];
const REQUIRED_STEP2 = ['dob', 'date_of_joining', 'max_candidates'];
const REQUIRED_STEP3 = ['bank_holder_name', 'bank_name', 'account_number', 'ifsc_code'];

function validate(step, formData) {
  const errors = {};
  const req = 
    step === 0 ? REQUIRED_STEP0 : 
    step === 1 ? REQUIRED_STEP1 : 
    step === 2 ? REQUIRED_STEP2 : 
    step === 3 ? REQUIRED_STEP3 : [];
  req.forEach(f => { if (!formData[f] || String(formData[f]).trim() === '') errors[f] = 'This field is required'; });
  
  if (step === 1 && formData.mobile && !/^\d{10}$/.test(formData.mobile)) errors.mobile = 'Enter valid 10-digit mobile number';
  if (step === 1 && formData.aadhaar_no && !/^\d{12}$/.test(formData.aadhaar_no)) errors.aadhaar_no = 'Aadhaar must be 12 digits';
  if (step === 1 && formData.pincode && !/^\d{6}$/.test(formData.pincode)) errors.pincode = 'Pincode must be 6 digits';
  if (step === 1 && formData.home_pincode && !/^\d{6}$/.test(formData.home_pincode)) errors.home_pincode = 'Pincode must be 6 digits';
  
  if (step === 3) {
    if (formData.bank_holder_name && !/^[A-Z\s]{3,}$/.test(formData.bank_holder_name)) {
      errors.bank_holder_name = 'Name must be at least 3 uppercase characters and spaces only';
    }
    if (formData.bank_name && !INDIAN_BANKS.includes(formData.bank_name)) {
      errors.bank_name = 'Please select a valid bank from the suggestions dropdown';
    }
    if (formData.account_number && !/^\d{9,18}$/.test(formData.account_number)) {
      errors.account_number = 'Account number must be 9 to 18 digits';
    }
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (formData.ifsc_code && !ifscRegex.test(formData.ifsc_code)) {
      errors.ifsc_code = 'Invalid IFSC format. Fifth digit must be 0 (e.g. SBIN0000456)';
    }
  }
  return errors;
}

export default function ApplicationForm() {
  const { user, fetchMe } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dropdowns, setDropdowns] = useState({});
  const [errors, setErrors] = useState({});
  const [appStatus, setAppStatus] = useState('Draft');
  const [formData, setFormData] = useState({
    name: '', gender: 'Male', designation_id: '', special_designation_id: '',
    department_id: '', area_of_specialization: '', serving_institute_id: '',
    address_1: '', address_2: '', address_3: '', district_id: '', pincode: '',
    home_address_1: '', home_address_2: '', home_address_3: '', home_district_id: '', home_pincode: '',
    aadhaar_no: '', mobile: '', email: '',
    dob: '', date_of_joining: '', date_of_superannuation: '',
    recognition_ref_no: '', max_candidates: 0, current_vacancy: 0,
    max_part_time: 0, max_full_time: 0, status: 'Draft', disciplines: [],
    bank_holder_name: '', bank_name: '', account_number: '', ifsc_code: ''
  });
  const [files, setFiles] = useState({ profile_image: null, dob_evidence: null, recognition_certificate: null });
  const [previews, setPreviews] = useState({ profile_image: null });

  const [ifscResolving, setIfscResolving] = useState(false);
  const [isMasked, setIsMasked] = useState(true);
  const [bankSearch, setBankSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLockedByIFSC, setIsLockedByIFSC] = useState(false);
  const [ifscInfo, setIfscInfo] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isReadOnly = ['Active', 'Approved'].includes(appStatus);

  useEffect(() => {
    const tables = ['master_designations', 'master_departments', 'master_institutes', 'master_districts', 'master_disciplines', 'research_centres', 'master_special_designations'];
    Promise.all(tables.map(t => axios.get(`${API}/dropdowns/${t}`))).then(results => {
      const data = {};
      tables.forEach((t, i) => data[t] = results[i].data || []);
      setDropdowns(data);
    }).catch(() => toast.error('Failed to load dropdown data.'));

    axios.get(`${API}/portal/me`).then(res => {
      const d = res.data;
      setAppStatus(d.supervisor_status || 'Draft');
      if (d.supervisor_id) {
        setFormData(prev => ({
          ...prev, ...d,
          // CRITICAL: supervisor_status is the application status (Draft/Pending/Active/Rejected)
          // d.status is the USER ACCOUNT status — must not overwrite the form's status field
          status: d.supervisor_status || 'Draft',
          dob: d.dob ? d.dob.split('T')[0] : '',
          date_of_joining: d.date_of_joining ? d.date_of_joining.split('T')[0] : '',
          date_of_superannuation: d.date_of_superannuation ? d.date_of_superannuation.split('T')[0] : '',
        }));
        if (d.profile_image) setPreviews(p => ({ ...p, profile_image: `${import.meta.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002'}/${d.profile_image}` }));
        if (d.bank_name) setBankSearch(d.bank_name);
        if (d.ifsc_code && d.bank_name) {
          const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
          if (ifscRegex.test(d.ifsc_code)) {
            setIsLockedByIFSC(true);
          }
        }
      } else {
        setFormData(prev => ({ ...prev, name: d.name || '', email: d.email || '', mobile: d.mobile || '' }));
      }
      if (d.supervisor_id) {
        axios.get(`${API}/portal/disciplines`).then(r => {
          setFormData(f => ({
            ...f,
            disciplines: r.data.map(x => ({
              discipline_id:   String(x.discipline_id || ''),
              center_id:       String(x.center_id     || ''),
              type:            x.type || 'Primary',
              recognition_date: x.recognition_date ? x.recognition_date.split('T')[0] : '',
            })),
          }));
        }).catch(() => {});
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  // ENTERPRISE CAPACITY AUTOMATION ENGINE — fires when designation changes
  useEffect(() => {
    if (!formData.designation_id) return;

    axios.get(`${API}/portal/capacity/${formData.designation_id}`).then(res => {
      if (res.data.success) {
        const {
          max_candidates,
          current_vacancy,
          max_full_time,
          max_part_time,
        } = res.data.data;
        setFormData(prev => ({
          ...prev,
          max_candidates,
          current_vacancy,   // = max_candidates − scholars (0 for now)
          max_full_time,
          max_part_time,
        }));
      }
    }).catch(() => {});
  }, [formData.designation_id]);

  // LIVE CAPACITY VALIDATION
  useEffect(() => {
    const ft = parseInt(formData.max_full_time) || 0;
    const pt = parseInt(formData.max_part_time) || 0;
    const max = parseInt(formData.max_candidates) || 0;
    
    if (ft + pt > max) {
      setErrors(prev => ({ ...prev, capacity: `Total capacity (${ft+pt}) cannot exceed designation limit of ${max}` }));
    } else {
      setErrors(prev => { const n = { ...prev }; delete n.capacity; return n; });
    }
  }, [formData.max_full_time, formData.max_part_time, formData.max_candidates]);

  const handleIFSCChange = async (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
    setFormData(prev => ({ ...prev, ifsc_code: value }));
    setErrors(prev => { const n = { ...prev }; delete n.ifsc_code; return n; });
    setIfscInfo(null);

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (value.length === 11) {
      if (!ifscRegex.test(value)) {
        setErrors(prev => ({ ...prev, ifsc_code: 'Invalid IFSC format. Fifth digit must be 0.' }));
        return;
      }

      setIfscResolving(true);
      try {
        const { data } = await axios.get(`${API}/ifsc/${value}`);
        if (data.success && data.data) {
          const resolved = data.data;
          setFormData(prev => ({ ...prev, bank_name: resolved.bank_name }));
          setBankSearch(resolved.bank_name);
          setIsLockedByIFSC(true);
          setIfscInfo(resolved);
          toast.success(`Bank identified: ${resolved.bank_name}`);
        }
      } catch (err) {
        console.error(err);
        setErrors(prev => ({ ...prev, ifsc_code: err.response?.data?.message || 'IFSC lookup failed. Please enter details manually.' }));
        setIsLockedByIFSC(false);
      } finally {
        setIfscResolving(false);
      }
    } else {
      setIsLockedByIFSC(false);
    }
  };

  const filteredBanks = INDIAN_BANKS.filter(b => 
    b.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const getMaskedAccountNumber = () => {
    if (!formData.account_number) return '';
    if (!isMasked) return formData.account_number;
    const len = formData.account_number.length;
    if (len <= 4) return 'X'.repeat(len);
    return 'X'.repeat(len - 4) + formData.account_number.slice(-4);
  };

  const handleInput = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Use functional update — no dependency on errors state needed
    setErrors(prev => {
      if (!prev[name]) return prev; // nothing to clear, skip re-render
      const n = { ...prev };
      delete n[name];
      return n;
    });
  }, []);

  const handleFile = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large. Max 5MB allowed.'); return; }
    setFiles(prev => ({ ...prev, [field]: file }));
    if (field === 'profile_image') setPreviews(prev => ({ ...prev, profile_image: URL.createObjectURL(file) }));
    toast.success(`${field.replace(/_/g,' ')} uploaded`);
  };

  const addDiscipline = () => {
    setFormData(prev => ({ ...prev, disciplines: [...prev.disciplines, { discipline_id: '', center_id: '', recognition_date: '' }] }));
  };

  const removeDiscipline = (idx) => {
    setFormData(prev => ({ ...prev, disciplines: prev.disciplines.filter((_, i) => i !== idx) }));
  };

  const saveApplication = async (isFinal = false) => {
    if (isReadOnly && isFinal) return;
    if (isFinal) {
      const allErrors = { ...validate(0, formData), ...validate(1, formData), ...validate(2, formData), ...validate(3, formData) };
      if (Object.keys(allErrors).length > 0) {
        toast.error('Please fill all required fields before submitting.');
        setErrors(allErrors);
        throw new Error('validation');
      }
    } else {
      // Step 4 (Disciplines) has no required fields — always allow draft save
      const errs = step < 4 ? validate(step, formData) : {};
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        toast.error('Please fix the highlighted errors.');
        throw new Error('validation');
      }
    }
    setSaving(true);
    const postData = new FormData();
    Object.entries(formData).forEach(([k, v]) => {
      postData.append(k, k === 'disciplines' ? JSON.stringify(v) : (v ?? ''));
    });
    if (isFinal) postData.set('status', 'Pending');
    Object.entries(files).forEach(([k, v]) => { if (v) postData.append(k, v); });

    const toastId = toast.loading(isFinal ? 'Submitting application...' : 'Saving progress...');
    try {
      await axios.post(`${API}/portal/application`, postData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(isFinal ? '✅ Application submitted for review!' : '💾 Progress saved!', { id: toastId });
      if (isFinal) { await fetchMe(); navigate('/dashboard'); }
    } catch (err) {
      // Only show error toast for actual network/server failures, not internal validation throws
      if (err.message !== 'validation') {
        toast.error(err.response?.data?.message || 'Failed to save application.', { id: toastId });
      }
      throw err; // re-throw so goNext catches it and doesn't advance step
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    const errs = validate(step, formData);
    if (Object.keys(errs).length > 0) { setErrors(errs); toast.error('Please fix all required fields.'); return; }
    setErrors({});
    // Await the save so if it fails we don't silently advance to next step
    try {
      await saveApplication(false);
      setStep(s => s + 1);
    } catch {
      // saveApplication handles its own error toasts; don't advance
    }
  };

  if (loading) return (
    <div style={S.page}>
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
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .form-input:focus {
          border-color: #4338ca !important;
          box-shadow: 0 0 0 4px rgba(67,56,202,0.1) !important;
          background: #fff !important;
        }
        .form-input.valid {
          border-color: #22c55e !important;
        }
        .form-input.invalid {
          border-color: #ef4444 !important;
        }
        .dropdown-item:hover {
          background: #f1f5f9 !important;
        }
      `}</style>
      <div style={S.container}>
        {/* Page Header */}
        <div style={S.pageHeader}>
          <h1 style={S.pageTitle}>Supervisor Recognition Application</h1>
          <p style={S.pageSub}>Complete all sections to apply for PhD supervisor recognition from Periyar University.</p>
        </div>

        {/* Status Bar */}
        <div style={{ ...S.statusBar, background: sc.bg, borderColor: sc.color, color: sc.color }}>
          <StatusIcon size={18} />
          <span>Application Status: <strong>{appStatus}</strong></span>
          {appStatus === 'Pending' && <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.8 }}>Awaiting admin review</span>}
          {appStatus === 'Rejected' && <span style={{ marginLeft: 'auto', fontSize: 12 }}>Contact admin for details</span>}
        </div>

        {isReadOnly && (
          <div style={S.readonlyBadge}>
            <Lock size={15} /> Your profile is <strong>{appStatus}</strong> — editing is locked. Contact admin to make changes.
          </div>
        )}

        {/* Stepper */}
        <div style={S.stepper}>
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === i;
            const done = step > i;
            return (
              <div key={i} style={S.stepItem(active, done)} onClick={() => done && !isReadOnly && setStep(i)}>
                {i < STEPS.length - 1 && <div style={S.stepLine} />}
                <div style={S.stepCircle(active, done)}>
                  {done ? <CheckCircle size={22} /> : <Icon size={22} />}
                </div>
                <div style={S.stepLabel(active)}>{s.label}</div>
                <div style={S.stepDesc}>{s.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Form Card */}
        <div style={S.card}>
          <div style={S.sectionTitle}>
            {React.createElement(STEPS[step].icon, { size: 22, color: '#4338ca' })}
            {STEPS[step].label}
          </div>
          <div style={S.sectionSub}>{STEPS[step].desc}</div>

          {/* ─── Step 0: General Info ─── */}
          {step === 0 && (
            <div>
              <div style={S.photoWrap}>
                <label style={{ cursor: isReadOnly ? 'default' : 'pointer' }}>
                  {previews.profile_image
                    ? <img src={previews.profile_image} style={S.photo} alt="Profile" />
                    : <div style={S.photoPlaceholder}><Camera size={36} color="#6366f1" /></div>}
                  {!isReadOnly && <input type="file" hidden onChange={e => handleFile(e, 'profile_image')} accept="image/*" />}
                  {!isReadOnly && <div style={S.photoBtn}><Camera size={13} /> Change Photo</div>}
                </label>
              </div>
              <div style={S.grid2}>
                <div style={S.group}>
                  <label style={S.label}>Full Name<span style={S.required}>*</span></label>
                  <input style={S.input(errors.name)} name="name" value={formData.name} onChange={handleInput} readOnly={isReadOnly} placeholder="e.g. Dr. Rajendran Subramaniam" />
                  {errors.name && <span style={S.errMsg}>{errors.name}</span>}
                </div>
                <div style={S.group}>
                  <label style={S.label}>Gender<span style={S.required}>*</span></label>
                  <select style={S.select(errors.gender)} name="gender" value={formData.gender} onChange={handleInput} disabled={isReadOnly}>
                    <option>Male</option><option>Female</option><option>Transgender</option>
                  </select>
                </div>
                <div style={S.group}>
                  <label style={S.label}>Designation<span style={S.required}>*</span></label>
                  <select style={S.select(errors.designation_id)} name="designation_id" value={formData.designation_id} onChange={handleInput} disabled={isReadOnly}>
                    <option value="">— Select Designation —</option>
                    {dropdowns.master_designations?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {errors.designation_id && <span style={S.errMsg}>{errors.designation_id}</span>}
                </div>
                <div style={S.group}>
                  <label style={S.label}>Special Designation</label>
                  <select style={S.select(false)} name="special_designation_id" value={formData.special_designation_id} onChange={handleInput} disabled={isReadOnly}>
                    <option value="">— Select Special Designation —</option>
                    {dropdowns.master_special_designations?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div style={S.group}>
                  <label style={S.label}>Department</label>
                  <select style={S.select(false)} name="department_id" value={formData.department_id} onChange={handleInput} disabled={isReadOnly}>
                    <option value="">— Select Department —</option>
                    {dropdowns.master_departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div style={S.group}>
                  <label style={S.label}>Serving Institute</label>
                  <select style={S.select(false)} name="serving_institute_id" value={formData.serving_institute_id} onChange={handleInput} disabled={isReadOnly}>
                    <option value="">— Select Institute —</option>
                    {dropdowns.master_institutes?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div style={{ ...S.group, gridColumn: '1 / -1' }}>
                  <label style={S.label}>Area of Specialization</label>
                  <input
                    style={S.input(false)}
                    name="area_of_specialization"
                    value={formData.area_of_specialization || ''}
                    onChange={handleInput}
                    readOnly={isReadOnly}
                    placeholder="e.g. Image Processing, Machine Learning, Power Systems"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 1: Address & Identity ─── */}
          {step === 1 && (
            <div>
              {/* Office Address Section */}
              <div style={{ fontSize: 16, fontWeight: 700, color: '#4f46e5', marginBottom: 16, borderBottom: '2.5px solid #e0e7ff', paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                🏫 Office Address
              </div>
              <div style={{ ...S.grid2, marginBottom: 32 }}>
                <div style={{ ...S.group, gridColumn: '1 / -1' }}>
                  <label style={S.label}>Address Line 1<span style={S.required}>*</span></label>
                  <input style={S.input(errors.address_1)} name="address_1" value={formData.address_1} onChange={handleInput} readOnly={isReadOnly} placeholder="Door No., Street Name" />
                  {errors.address_1 && <span style={S.errMsg}>{errors.address_1}</span>}
                </div>
                <div style={S.group}>
                  <label style={S.label}>Address Line 2</label>
                  <input style={S.input(false)} name="address_2" value={formData.address_2} onChange={handleInput} readOnly={isReadOnly} placeholder="Colony / Area" />
                </div>
                <div style={S.group}>
                  <label style={S.label}>City / Town</label>
                  <input style={S.input(false)} name="address_3" value={formData.address_3} onChange={handleInput} readOnly={isReadOnly} placeholder="City or Town" />
                </div>
                <div style={S.group}>
                  <label style={S.label}>District<span style={S.required}>*</span></label>
                  <select style={S.select(errors.district_id)} name="district_id" value={formData.district_id} onChange={handleInput} disabled={isReadOnly}>
                    <option value="">— Select District —</option>
                    {dropdowns.master_districts?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {errors.district_id && <span style={S.errMsg}>{errors.district_id}</span>}
                </div>
                <div style={S.group}>
                  <label style={S.label}>Pincode<span style={S.required}>*</span></label>
                  <input style={S.input(errors.pincode)} name="pincode" value={formData.pincode} onChange={handleInput} readOnly={isReadOnly} maxLength={6} placeholder="6-digit pincode" />
                  {errors.pincode && <span style={S.errMsg}>{errors.pincode}</span>}
                </div>
              </div>

              {/* Home Address Section */}
              <div style={{ fontSize: 16, fontWeight: 700, color: '#4f46e5', marginBottom: 16, borderBottom: '2.5px solid #e0e7ff', paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                🏠 Home Address
              </div>
              <div style={{ ...S.grid2, marginBottom: 32 }}>
                <div style={{ ...S.group, gridColumn: '1 / -1' }}>
                  <label style={S.label}>Address Line 1<span style={S.required}>*</span></label>
                  <input style={S.input(errors.home_address_1)} name="home_address_1" value={formData.home_address_1} onChange={handleInput} readOnly={isReadOnly} placeholder="Door No., Street Name" />
                  {errors.home_address_1 && <span style={S.errMsg}>{errors.home_address_1}</span>}
                </div>
                <div style={S.group}>
                  <label style={S.label}>Address Line 2</label>
                  <input style={S.input(false)} name="home_address_2" value={formData.home_address_2} onChange={handleInput} readOnly={isReadOnly} placeholder="Colony / Area" />
                </div>
                <div style={S.group}>
                  <label style={S.label}>City / Town</label>
                  <input style={S.input(false)} name="home_address_3" value={formData.home_address_3} onChange={handleInput} readOnly={isReadOnly} placeholder="City or Town" />
                </div>
                <div style={S.group}>
                  <label style={S.label}>District<span style={S.required}>*</span></label>
                  <select style={S.select(errors.home_district_id)} name="home_district_id" value={formData.home_district_id} onChange={handleInput} disabled={isReadOnly}>
                    <option value="">— Select District —</option>
                    {dropdowns.master_districts?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {errors.home_district_id && <span style={S.errMsg}>{errors.home_district_id}</span>}
                </div>
                <div style={S.group}>
                  <label style={S.label}>Pincode<span style={S.required}>*</span></label>
                  <input style={S.input(errors.home_pincode)} name="home_pincode" value={formData.home_pincode} onChange={handleInput} readOnly={isReadOnly} maxLength={6} placeholder="6-digit pincode" />
                  {errors.home_pincode && <span style={S.errMsg}>{errors.home_pincode}</span>}
                </div>
              </div>

              {/* Identity & Contact Section */}
              <div style={{ fontSize: 16, fontWeight: 700, color: '#4f46e5', marginBottom: 16, borderBottom: '2.5px solid #e0e7ff', paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                🔑 Identity & Contact
              </div>
              <div style={S.grid2}>
                <div style={S.group}>
                  <label style={S.label}>Aadhaar Number</label>
                  <input style={S.input(errors.aadhaar_no)} name="aadhaar_no" value={formData.aadhaar_no} onChange={handleInput} readOnly={isReadOnly} maxLength={12} placeholder="12-digit Aadhaar" />
                  {errors.aadhaar_no && <span style={S.errMsg}>{errors.aadhaar_no}</span>}
                </div>
                <div style={S.group}>
                  <label style={S.label}>Mobile Number<span style={S.required}>*</span></label>
                  <input style={S.input(errors.mobile)} name="mobile" value={formData.mobile} onChange={handleInput} readOnly={isReadOnly} placeholder="10-digit mobile" />
                  {errors.mobile && <span style={S.errMsg}>{errors.mobile}</span>}
                </div>
                <div style={S.group}>
                  <label style={S.label}>Email Address</label>
                  <input style={S.input(false)} name="email" value={formData.email} onChange={handleInput} readOnly={isReadOnly} type="email" />
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Professional Details ─── */}
          {step === 2 && (
            <div style={S.grid2}>
              <div style={S.group}>
                <label style={S.label}>Date of Birth<span style={S.required}>*</span></label>
                <input style={S.input(errors.dob)} name="dob" type="date" value={formData.dob} onChange={handleInput} readOnly={isReadOnly} />
                {errors.dob && <span style={S.errMsg}>{errors.dob}</span>}
              </div>
              <div style={S.group}>
                <label style={S.label}>Date of Joining<span style={S.required}>*</span></label>
                <input style={S.input(errors.date_of_joining)} name="date_of_joining" type="date" value={formData.date_of_joining} onChange={handleInput} readOnly={isReadOnly} />
                {errors.date_of_joining && <span style={S.errMsg}>{errors.date_of_joining}</span>}
              </div>
              <div style={S.group}>
                <label style={S.label}>Date of Superannuation</label>
                <input style={S.input(false)} name="date_of_superannuation" type="date" value={formData.date_of_superannuation} onChange={handleInput} readOnly={isReadOnly} />
              </div>
              <div style={S.group}>
                <label style={S.label}>Recognition Ref. No.</label>
                <input style={S.input(false)} name="recognition_ref_no" value={formData.recognition_ref_no} onChange={handleInput} readOnly={isReadOnly} placeholder="e.g. PU/RG/2024/001" />
              </div>
              <div style={{ ...S.group, gridColumn: '1 / -1' }}>
                <div style={{ ...S.notice, background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1', marginBottom: 0 }}>
                  <AlertCircle size={18} />
                  <span>
                    <strong>Flexible Capacity Logic:</strong> Max candidates are determined by your designation. 
                    You can distribute this between Full-Time and Part-Time research.
                  </span>
                </div>
              </div>
              <div style={S.group}>
                <label style={S.label}>Designation Max Candidates</label>
                <div style={{ ...S.input(false), background: '#f1f5f9', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={14} /> {formData.max_candidates}
                </div>
              </div>
              <div style={S.group}>
                <label style={S.label}>Current Vacancy</label>
                <div style={{ ...S.input(false), background: '#f1f5f9', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={14} /> {formData.current_vacancy}
                </div>
              </div>
              <div style={S.group}>
                <label style={S.label}>Max Full-Time Scholars<span style={S.required}>*</span></label>
                <input style={S.input(errors.capacity)} name="max_full_time" type="number" min={0} value={formData.max_full_time} onChange={handleInput} readOnly={isReadOnly} />
              </div>
              <div style={S.group}>
                <label style={S.label}>Max Part-Time Scholars<span style={S.required}>*</span></label>
                <input style={S.input(errors.capacity)} name="max_part_time" type="number" min={0} value={formData.max_part_time} onChange={handleInput} readOnly={isReadOnly} />
              </div>
              {errors.capacity && (
                <div style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> {errors.capacity}
                </div>
              )}
              <div style={{ ...S.group, gridColumn: '1 / -1' }}>
                <label style={S.label}>DOB Evidence (PDF/Image)</label>
                <input type="file" onChange={e => handleFile(e, 'dob_evidence')} accept=".pdf,.jpg,.jpeg,.png" disabled={isReadOnly} />
                {files.dob_evidence && <span style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>✓ {files.dob_evidence.name}</span>}
              </div>
              <div style={{ ...S.group, gridColumn: '1 / -1' }}>
                <label style={S.label}>Recognition Certificate (PDF)</label>
                <input type="file" onChange={e => handleFile(e, 'recognition_certificate')} accept=".pdf,.jpg,.jpeg,.png" disabled={isReadOnly} />
                {files.recognition_certificate && <span style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>✓ {files.recognition_certificate.name}</span>}
              </div>
            </div>
          )}

          {/* ─── Step 3: Bank Details ─── */}
          {step === 3 && (
            <div>
              <div style={{ ...S.notice, background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1', marginTop: 0, marginBottom: 24 }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Secure Remittance Profile:</strong> Configure your supervisor disbursement account settings. All fields must be exactly verified.
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Bank Holder Name */}
                <div style={S.group}>
                  <label style={S.label}>
                    BANK HOLDER NAME <span style={S.required}>*</span>
                    {formData.bank_holder_name && !errors.bank_holder_name && <span style={S.successIndicator} />}
                    {errors.bank_holder_name && <span style={S.errIndicator} />}
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formData.bank_holder_name ? (errors.bank_holder_name ? 'invalid' : 'valid') : ''}`}
                    style={S.input(errors.bank_holder_name)}
                    placeholder="ENTER EXACT NAME AS APPEARS IN BANK PASSBOOK"
                    value={formData.bank_holder_name}
                    onChange={e => {
                      const upperVal = e.target.value.toUpperCase().replace(/[^A-Z\s]/g, '');
                      setFormData(prev => ({ ...prev, bank_holder_name: upperVal }));
                      if (errors.bank_holder_name) setErrors(prev => { const n = { ...prev }; delete n.bank_holder_name; return n; });
                    }}
                    readOnly={isReadOnly}
                    required
                  />
                  {errors.bank_holder_name && <span style={S.errMsg}>{errors.bank_holder_name}</span>}
                </div>

                <div style={S.row}>
                  {/* IFSC Code */}
                  <div style={S.group}>
                    <label style={S.label}>
                      IFSC CODE <span style={S.required}>*</span>
                      {formData.ifsc_code && !errors.ifsc_code && <span style={S.successIndicator} />}
                      {errors.ifsc_code && <span style={S.errIndicator} />}
                    </label>
                    <div style={S.inputGroup}>
                      <input
                        type="text"
                        className={`form-input ${formData.ifsc_code ? (errors.ifsc_code ? 'invalid' : 'valid') : ''}`}
                        style={{ ...S.input(errors.ifsc_code), paddingRight: 40 }}
                        placeholder="e.g. SBIN0000456"
                        value={formData.ifsc_code}
                        onChange={handleIFSCChange}
                        readOnly={isReadOnly}
                        required
                      />
                      {ifscResolving && (
                        <div style={S.ifscLoader}>
                          <div style={{ animation: 'spin 0.8s linear infinite', border: '2px solid #cbd5e1', borderTop: '2px solid #4338ca', width: 16, height: 16, borderRadius: '50%' }} />
                        </div>
                      )}
                    </div>
                    {errors.ifsc_code && <span style={S.errMsg}>{errors.ifsc_code}</span>}
                    {ifscInfo && (
                      <div style={{ fontSize: 11, color: '#16a34a', marginTop: 6, fontWeight: 600 }}>
                        ✓ {ifscInfo.branch} Branch ({ifscInfo.city}, {ifscInfo.state})
                      </div>
                    )}
                  </div>

                  {/* Bank Name Searchable Dropdown */}
                  <div style={S.group}>
                    <label style={S.label}>
                      BANK NAME <span style={S.required}>*</span>
                      {formData.bank_name && !errors.bank_name && <span style={S.successIndicator} />}
                      {errors.bank_name && <span style={S.errIndicator} />}
                    </label>
                    <div style={S.dropdownContainer} ref={dropdownRef}>
                      <input
                        type="text"
                        className={`form-input ${formData.bank_name ? (errors.bank_name ? 'invalid' : 'valid') : ''}`}
                        style={{ 
                          ...S.input(errors.bank_name), 
                          background: isLockedByIFSC ? '#f1f5f9' : (errors.bank_name ? '#fff5f5' : '#f8fafc'),
                          color: isLockedByIFSC ? '#64748b' : '#1e293b',
                          cursor: isLockedByIFSC ? 'not-allowed' : 'text'
                        }}
                        placeholder="SEARCH OR SELECT BANK NAME"
                        value={bankSearch}
                        disabled={isLockedByIFSC || isReadOnly}
                        onChange={e => {
                          const upperVal = e.target.value.toUpperCase();
                          setBankSearch(upperVal);
                          setFormData(prev => ({ ...prev, bank_name: '' }));
                          setShowDropdown(true);
                          if (errors.bank_name) setErrors(prev => { const n = { ...prev }; delete n.bank_name; return n; });
                        }}
                        onFocus={() => {
                          if (!isLockedByIFSC && !isReadOnly) setShowDropdown(true);
                        }}
                      />
                      
                      {isLockedByIFSC && (
                        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#0369a1', fontWeight: 700 }}>
                          AUTO-LOCKED
                        </div>
                      )}

                      {showDropdown && !isLockedByIFSC && !isReadOnly && (
                        <ul style={S.dropdownMenu}>
                          {filteredBanks.length > 0 ? (
                            filteredBanks.map(b => (
                              <li 
                                key={b} 
                                className="dropdown-item" 
                                style={S.dropdownItem}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, bank_name: b }));
                                  setBankSearch(b);
                                  setShowDropdown(false);
                                }}
                              >
                                {b}
                              </li>
                            ))
                          ) : (
                            <li style={S.noResult}>No matching bank found</li>
                          )}
                        </ul>
                      )}
                    </div>
                    {errors.bank_name && <span style={S.errMsg}>{errors.bank_name}</span>}
                  </div>
                </div>

                {/* Account Number */}
                <div style={S.group}>
                  <label style={S.label}>
                    ACCOUNT NUMBER <span style={S.required}>*</span>
                    {formData.account_number && !errors.account_number && <span style={S.successIndicator} />}
                    {errors.account_number && <span style={S.errIndicator} />}
                  </label>
                  <div style={S.inputGroup}>
                    <input
                      type="text"
                      className={`form-input ${formData.account_number ? (errors.account_number ? 'invalid' : 'valid') : ''}`}
                      style={{ 
                        ...S.input(errors.account_number), 
                        paddingRight: 50, 
                        fontFamily: isMasked ? 'monospace' : 'inherit', 
                        letterSpacing: isMasked ? '0.15em' : 'normal' 
                      }}
                      placeholder="ENTER 9 TO 18 DIGIT ACCOUNT NUMBER"
                      value={isMasked ? getMaskedAccountNumber() : formData.account_number}
                      onChange={e => {
                        let rawVal = e.target.value;
                        if (isMasked) {
                          setIsMasked(false);
                          rawVal = '';
                        }
                        const cleanVal = rawVal.replace(/[^\d]/g, '').slice(0, 18);
                        setFormData(prev => ({ ...prev, account_number: cleanVal }));
                        if (errors.account_number) setErrors(prev => { const n = { ...prev }; delete n.account_number; return n; });
                      }}
                      onFocus={() => {
                        if (isMasked && !isReadOnly) setIsMasked(false);
                      }}
                      onBlur={() => {
                        setIsMasked(true);
                      }}
                      readOnly={isReadOnly}
                      required
                    />
                    {formData.account_number && (
                      <button
                        type="button"
                        style={S.maskBtn}
                        onClick={() => setIsMasked(prev => !prev)}
                        onMouseDown={e => e.preventDefault()}
                        title={isMasked ? "Show account number" : "Hide account number"}
                      >
                        {isMasked ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {errors.account_number && <span style={S.errMsg}>{errors.account_number}</span>}
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 4: Disciplines ─── */}
          {step === 4 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Research Disciplines & Centre Affiliations</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Add all disciplines you are recognized for and associate them with research centres.</div>
                </div>
                {!isReadOnly && (
                  <button onClick={addDiscipline} style={{ ...S.btnPrimary, padding: '9px 18px', fontSize: 13 }}>
                    <Plus size={15} /> Add Row
                  </button>
                )}
              </div>
              {formData.disciplines.length > 0 ? (
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>#</th>
                      <th style={S.th}>Discipline<span style={S.required}>*</span></th>
                      <th style={S.th}>Research Centre</th>
                      <th style={S.th}>Recognition Date</th>
                      {!isReadOnly && <th style={S.th}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.disciplines.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ ...S.td, ...S.tdFirst, width: 40, color: '#94a3b8', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={S.td}>
                          <select style={S.select(false)} value={item.discipline_id} disabled={isReadOnly}
                            onChange={e => { const n = [...formData.disciplines]; n[idx].discipline_id = e.target.value; setFormData(f => ({ ...f, disciplines: n })); }}>
                            <option value="">— Select —</option>
                            {dropdowns.master_disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </td>
                        <td style={S.td}>
                          <select style={S.select(false)} value={item.center_id || ''} disabled={isReadOnly}
                            onChange={e => { const n = [...formData.disciplines]; n[idx].center_id = e.target.value; setFormData(f => ({ ...f, disciplines: n })); }}>
                            <option value="">— Select Centre —</option>
                            {dropdowns.research_centres?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td style={S.td}>
                          <input style={S.input(false)} type="date" value={item.recognition_date || ''} readOnly={isReadOnly}
                            onChange={e => { const n = [...formData.disciplines]; n[idx].recognition_date = e.target.value; setFormData(f => ({ ...f, disciplines: n })); }} />
                        </td>
                        {!isReadOnly && (
                          <td style={{ ...S.td, ...S.tdLast }}>
                            <button onClick={() => removeDiscipline(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>
                              <Trash2 size={17} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: 48, border: '2px dashed #e2e8f0', borderRadius: 16, color: '#94a3b8' }}>
                  <GraduationCap size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                  <div style={{ fontWeight: 600 }}>No disciplines added yet</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Click "Add Row" to add your research disciplines</div>
                </div>
              )}
              <div style={S.notice}>
                <AlertCircle size={18} style={{ flexShrink: 0, color: '#d97706' }} />
                <span>Verify all information carefully before final submission. Once submitted (Pending status), the form can only be edited after admin review.</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={S.actions}>
          {step > 0
            ? <button style={S.btnSecondary} onClick={() => setStep(s => s - 1)}><ChevronLeft size={17} /> Previous</button>
            : <div />}
          <div style={{ display: 'flex', gap: 12 }}>
            {!isReadOnly && (
              <button style={{ ...S.btnSecondary, borderColor: '#c7d2fe', color: '#4338ca' }} onClick={() => saveApplication(false)} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button style={S.btnPrimary} onClick={goNext} disabled={saving}>
                Next Step <ChevronRight size={17} />
              </button>
            ) : !isReadOnly ? (
              <button style={S.btnSuccess} onClick={() => saveApplication(true)} disabled={saving}>
                <Send size={16} /> {saving ? 'Submitting...' : 'Submit Application'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
