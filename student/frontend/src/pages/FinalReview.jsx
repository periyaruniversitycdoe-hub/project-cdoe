import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import {
  ArrowLeft, CheckCircle, AlertCircle, FileText, User, MapPin,
  BookOpen, Briefcase, Upload, Shield, Lock, Printer, Eye,
  ChevronRight, Clock, BadgeCheck, XCircle, Download, ExternalLink,
  CreditCard, CalendarClock
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || `${import.meta.env.VITE_STUDENT_API_URL || ('http://localhost:5000')}/api`;
const BASE_API = (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000').replace('/api', '');

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (val) => val || <span className="text-muted fst-italic">Not provided</span>;

const fmtDate = (val) => {
  if (!val) return <span className="text-muted fst-italic">Not provided</span>;
  try { return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return val; }
};

const fmtDateTime = (val) => {
  if (!val) return '—';
  try { return new Date(val).toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return val; }
};

const Row = ({ label, value, highlight }) => (
  <div className="col-md-6 col-lg-4 mb-3">
    <div className="small text-muted mb-1">{label}</div>
    <div className={`fw-semibold ${highlight ? 'text-primary' : ''}`} style={{ fontSize: 14 }}>
      {value ?? <span className="text-muted fst-italic">Not provided</span>}
    </div>
  </div>
);

const SectionCard = ({ icon, title, color, children, onEdit, locked }) => (
  <div className="card border-0 shadow-sm rounded-4 mb-4">
    <div className="card-header d-flex align-items-center justify-content-between py-3 rounded-top-4"
      style={{ background: color || '#f8f9fa', borderBottom: '2px solid rgba(0,0,0,0.06)' }}>
      <div className="d-flex align-items-center gap-2 fw-bold" style={{ fontSize: 15 }}>
        {icon}
        <span>{title}</span>
      </div>
      {!locked && onEdit && (
        <button className="btn btn-sm btn-outline-primary rounded-pill px-3" style={{ fontSize: 12 }} onClick={onEdit}>
          Edit Section
        </button>
      )}
    </div>
    <div className="card-body p-4">{children}</div>
  </div>
);

const CheckBadge = ({ ok, label }) => (
  <div className={`d-flex align-items-center gap-2 px-3 py-2 rounded-3 border ${ok ? 'border-success bg-success bg-opacity-10' : 'border-warning bg-warning bg-opacity-10'}`}>
    {ok
      ? <CheckCircle size={16} className="text-success flex-shrink-0" />
      : <AlertCircle size={16} className="text-warning flex-shrink-0" />}
    <span className="small fw-semibold">{label}</span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const FinalReview = () => {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const declarationRef = useRef(null);

  const [data,            setData]            = useState(null);
  const [completion,      setCompletion]      = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [declared,        setDeclared]        = useState(false);
  const [showDecision,    setShowDecision]    = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [submitted,       setSubmitted]       = useState(false);
  const [submittedAt,     setSubmittedAt]     = useState(null);
  const [uniSettings,     setUniSettings]     = useState(null);
  const [pdfLoading,      setPdfLoading]      = useState(false);

  // Declared before the effect so it can be a stable dep.
  // Accepts a signal so the boot effect can cancel it on cleanup.
  const fetchData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/application/review`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      setData(res.data.data);
      setCompletion(res.data.completion);
      if (res.data.data.final_submitted || res.data.data.form_locked || res.data.data.is_locked) {
        setSubmitted(true);
        setSubmittedAt(res.data.data.final_submitted_at || res.data.data.application_generated_date);
      }
    } catch (err) {
      // ERR_CANCELED = AbortController fired on cleanup — not a real error.
      if (err?.code !== 'ERR_CANCELED') {
        toast.error('Failed to load application. Redirecting to form…');
        navigate('/apply');
      }
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  // Boot effect: both calls share one AbortController — React StrictMode safe.
  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    const ac = new AbortController();
    const { signal } = ac;

    fetchData(signal);
    axios.get(`${API}/settings`, { signal })
      .then(res => setUniSettings(res.data.success ? res.data.data : res.data))
      .catch(() => {});

    return () => ac.abort();
  }, [token, navigate, fetchData]);

  const goEdit = (stepIndex) => navigate(`/apply?step=${stepIndex}`);

  const handleDownloadPdf = async () => {
    if (!data) return;
    const isPaid = ['Paid', 'Verified', 'Approved', 'Success'].includes(data.payment_status);
    if (!data.final_submitted && !isPaid) {
      toast.error('PDF download is locked until final submission and payment success.');
      return;
    }
    setPdfLoading(true);
    try {
      const res = await axios.get(`${API}/applications/download-pdf/${data.application_id}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const tab = window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      if (!tab) toast.error('Pop-up blocked — please allow pop-ups for this site.');
      else toast.success('PDF opened in new tab!');
    } catch {
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrint = () => {
    if (!data) return;
    const isPaid = ['Paid', 'Verified', 'Approved', 'Success'].includes(data.payment_status);
    if (!data.final_submitted && !isPaid) {
      toast.error('Print feature is locked until final submission and payment success.');
      return;
    }

    const photoSrc  = (data.documents || []).find(d => d.document_type === 'Photo')?.file_path;
    const signSrc   = (data.documents || []).find(d => d.document_type === 'Signature')?.file_path;
    const BASE      = ('http://localhost:5000');
    
    const logoUrl = uniSettings?.logo 
      ? (uniSettings.logo.startsWith('/uploads') ? `${BASE}${uniSettings.logo}` : uniSettings.logo)
      : null;
    const logo2Url = null;

    // Periyar University emblem SVG
    const puLogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90">
      <!-- outer ring -->
      <circle cx="45" cy="45" r="43" fill="#1a3a5c"/>
      <circle cx="45" cy="45" r="43" fill="none" stroke="#c8a951" stroke-width="2"/>
      <circle cx="45" cy="45" r="36" fill="none" stroke="#c8a951" stroke-width="0.8"/>
      <!-- open book (left page) -->
      <path d="M45,28 L22,34 L22,58 L45,52 Z" fill="#ffffff"/>
      <!-- open book (right page) -->
      <path d="M45,28 L68,34 L68,58 L45,52 Z" fill="#dce8f5"/>
      <!-- spine -->
      <line x1="45" y1="28" x2="45" y2="52" stroke="#c8a951" stroke-width="1"/>
      <!-- flame above book -->
      <ellipse cx="45" cy="25" rx="3.5" ry="5" fill="#ffd166"/>
      <ellipse cx="45" cy="23" rx="2" ry="3" fill="#ffaa00"/>
      <!-- lamp base -->
      <rect x="42" y="28" width="6" height="2" rx="1" fill="#c8a951"/>
      <!-- person silhouette (elderly, simplified) -->
      <circle cx="45" cy="64" r="3.5" fill="#c8a951"/>
      <path d="M45,67.5 L45,75 M42,70 L48,70 M43,75 L44,80 M47,75 L46,80" stroke="#c8a951" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M42,67.5 Q39,70 40,74" stroke="#c8a951" stroke-width="1" fill="none" stroke-linecap="round"/>
      <!-- gold ribbon banner -->
      <path d="M10,72 Q45,68 80,72 Q45,79 10,72 Z" fill="#c8a951"/>
      <text x="45" y="77.5" text-anchor="middle" fill="#1a3a5c" font-size="5.2" font-weight="bold" font-family="Arial,sans-serif" letter-spacing="0.3">Wisdom Maketh the World</text>
      <!-- top arc text -->
      <path id="topArc" d="M 12,45 A 33,33 0 0,1 78,45" fill="none"/>
      <text font-size="6.5" font-weight="bold" font-family="Arial,sans-serif" fill="#c8a951" letter-spacing="1.5">
        <textPath href="#topArc" startOffset="10%">PERIYAR UNIVERSITY</textPath>
      </text>
      <!-- bottom text -->
      <text x="45" y="62" text-anchor="middle" fill="#fff" font-size="5.5" font-family="Arial,sans-serif" letter-spacing="1">SALEM</text>
    </svg>`;

    const fmtD = (v) => { try { return v ? new Date(v).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) : '—'; } catch { return v || '—'; } };
    const v    = (x) => x || '—';

    const schoolRows = (data.school_education || []).map(s => `
      <tr>
        <td>${v(s.level)}</td><td>${v(s.institution_name)}</td>
        <td>${v(s.board_name || s.other_board_name || s.board_id)}</td>
        <td>${v(s.passing_month)} ${v(s.passing_year)}</td>
        <td>${s.percentage ? s.percentage + '%' : '—'}</td>
      </tr>`).join('');

    const higherRows = (data.higher_education || []).map(h => {
      const isUgPgInt = h.level === 'UG' || h.level === 'PG' || h.level === 'Integrated';
      const timelineHtml = isUgPgInt
        ? `${h.passing_month ? h.passing_month : '—'}${ (h.start_year || h.completion_year) ? `<br/><span style="font-size:10px;color:#666;">${h.start_year ? 'Start: ' + h.start_year : ''} ${h.completion_year ? ' | End: ' + h.completion_year : ''}</span>` : '' }`
        : `${h.passing_month ? h.passing_month + ' ' : ''}${h.passing_year ? 'Pass: ' + h.passing_year : '—'}`;
      
      let levelText = h.level;
      if (h.mark_statement_type) {
        levelText += `<br/><span style="font-size:8.5px;color:#555;font-style:italic;">${h.mark_statement_type}</span>`;
      }
      if (h.is_awaiting_final_sem == 1) {
        levelText += `<br/><span style="font-size:8.5px;color:#d97706;font-weight:bold;">[Awaiting Results]</span>`;
      }

      return `
      <tr>
        <td>${levelText}</td><td>${v(h.institution_name)}</td>
        <td>${v(h.university_name)}</td>
        <td>${timelineHtml}</td>
        <td>${(() => {
          if (!h.score_value) return '—';
          if (h.score_type === 'CGPA' && h.cgpa_scale && ['UG','PG','M.Phil'].includes(h.level)) {
            const norm = h.normalized_cgpa != null ? parseFloat(h.normalized_cgpa).toFixed(2) : null;
            return `${h.score_value} CGPA (${h.cgpa_scale}-pt scale)${norm ? `<br/><span style="font-size:10px;color:#0d6efd;">Normalized: ${norm} / 10</span>` : ''}`;
          }
          return h.score_value + (h.score_type ? ` (${h.score_type})` : '');
        })()}</td>
      </tr>`;
    }).join('');

    const expRows = (data.experience_details || []).map(e => {
      const fromDisplay = e.from_date 
        ? new Date(e.from_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
        : `${v(e.from_month)} ${v(e.from_year)}`;
      const toDisplay = e.to_date 
        ? new Date(e.to_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
        : `${v(e.to_month)} ${v(e.to_year)}`;
      return `
      <tr>
        <td>${v(e.designation)}</td><td>${v(e.organization_name)}</td>
        <td>${v(e.employment_type || e.employment_type_id)}</td>
        <td>${fromDisplay}</td>
        <td>${toDisplay}</td>
        <td>${e.total_years || 0}Y ${e.total_months || 0}M</td>
      </tr>`;
    }).join('');

    let qualStr = '—';
    try { const q = data.qualified_exams; qualStr = q ? (typeof q === 'string' ? JSON.parse(q) : q).join(', ') || 'None' : 'None'; } catch {}

    const field = (label, value) => `
      <div class="field">
        <span class="flabel">${label}</span>
        <span class="fvalue">${v(value)}</span>
      </div>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Ph.D. Application — ${data.application_id}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Times New Roman',serif;font-size:11pt;color:#000;background:#fff;padding:10mm 15mm}
  @page{size:A4;margin:12mm 15mm}

  .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px double #1a3a5c;padding-bottom:8px;margin-bottom:8px;gap:10px}
  .logo-box{width:82px;height:82px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
  .logo-box img{width:82px;height:82px;object-fit:contain}
  .header-text{flex:1;text-align:center}
  .uni-name{font-size:17pt;font-weight:bold;color:#1a3a5c;letter-spacing:0.5px}
  .uni-sub{font-size:10pt;color:#333;margin-top:2px}
  .uni-addr{font-size:8.5pt;color:#555;margin-top:2px}
  .photo-box{width:80px;height:95px;border:1.5px solid #555;display:flex;align-items:center;justify-content:center;font-size:8pt;color:#888;flex-shrink:0}
  .photo-box img{width:100%;height:100%;object-fit:cover}

  .form-title{text-align:center;background:#1a3a5c;color:#fff;padding:5px 0;font-size:13pt;font-weight:bold;margin:8px 0;letter-spacing:1px}

  .meta-bar{display:flex;justify-content:space-between;font-size:9pt;margin-bottom:10px;padding:4px 6px;background:#f1f5f9;border:1px solid #cbd5e1}
  .meta-bar strong{color:#1a3a5c}

  .section{margin-bottom:10px;page-break-inside:avoid}
  .sec-title{background:#1a3a5c;color:#fff;font-size:9.5pt;font-weight:bold;padding:3px 8px;margin-bottom:6px}

  .fields-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;padding:2px 6px}
  .field{display:flex;flex-direction:column;margin-bottom:5px}
  .flabel{font-size:8pt;color:#555;font-style:italic}
  .fvalue{font-size:9.5pt;font-weight:bold;border-bottom:1px dotted #aaa;padding-bottom:1px;min-height:14px}

  table{width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:4px}
  th{background:#1a3a5c;color:#fff;padding:3px 6px;text-align:left;font-size:8pt}
  td{border:1px solid #cbd5e1;padding:3px 6px}
  tr:nth-child(even) td{background:#f8fafc}

  .decl-box{border:1px solid #888;padding:8px 10px;font-size:8.5pt;line-height:1.7;margin-bottom:10px;background:#fafafa}
  .decl-box ol{padding-left:16px}

  .sign-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;padding-top:8px;border-top:1px solid #ccc}
  .sign-block{text-align:center;font-size:8.5pt}
  .sign-img{height:40px;max-width:130px;object-fit:contain;border-bottom:1px solid #000;margin-bottom:2px}
  .sign-line{width:160px;border-bottom:1px solid #000;margin:0 auto 2px}

  .footer{text-align:center;font-size:7.5pt;color:#666;border-top:2px solid #1a3a5c;padding-top:4px;margin-top:12px}
  @media print{
    body{padding:0}
    .no-print{display:none}
    a{text-decoration:none;color:#000}
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header" style="display:flex;align-items:center;border-bottom:2px solid #ccc;padding-bottom:10px;margin-bottom:15px;gap:15px;">
  <!-- University Logo -->
  <div class="logo-box" style="width:auto;height:75px;display:flex;gap:8px;flex-shrink:0;">
    ${logoUrl
      ? `<img src="${logoUrl}" alt="University Logo" crossorigin="anonymous" style="height:75px;width:auto;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div style="display:none;width:75px;height:75px;align-items:center;justify-content:center">${puLogoSVG}</div>`
      : puLogoSVG
    }
    ${logo2Url
      ? `<img src="${logo2Url}" alt="Secondary Logo" crossorigin="anonymous" style="height:75px;width:auto;object-fit:contain;"/>`
      : ''
    }
  </div>
  <!-- University Name & Address -->
  <div class="header-text" style="flex:1;text-align:left;padding-left:10px;">
    <div class="uni-name" style="font-size:16pt;font-weight:bold;color:#901a1e;font-family:'Times New Roman',serif;line-height:1.2;">${uniSettings?.university_name_tamil || 'பெரியார் பல்கலைக்கழகம்'}</div>
    <div class="uni-name" style="font-size:14pt;font-weight:bold;color:#0f4c81;font-family:sans-serif;line-height:1.2;margin-top:2px;">${uniSettings?.university_name_english || 'PERIYAR UNIVERSITY'}</div>
    <div class="uni-sub" style="font-size:9.5pt;color:#111827;font-weight:500;margin-top:3px;line-height:1.3;">${uniSettings?.header_line2 || "State University - NAAC 'A++' Grade - NIRF Rank 94"}</div>
    <div class="uni-sub" style="font-size:9.5pt;color:#111827;font-weight:500;margin-top:1px;line-height:1.3;">${uniSettings?.naac_details || "State Public University Rank 40 - SDG Institutions Rank Band: 11-50"}</div>
    <div class="uni-sub" style="font-size:9.5pt;color:#111827;font-weight:500;margin-top:1px;line-height:1.3;">${uniSettings?.subtitle || "Periyar Palkalai Nagar"}</div>
    <div class="uni-addr" style="font-size:9.5pt;color:#111827;font-weight:500;margin-top:1px;line-height:1.3;">${uniSettings?.header_line3 || uniSettings?.address || "Salem - 636 011, Tamil Nadu, India."}</div>
  </div>
  <!-- Applicant Photo -->
  <div class="photo-box" style="width:75px;height:90px;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:8pt;color:#888;flex-shrink:0;margin-left:auto;">
    ${photoSrc ? `<img src="${BASE}/${photoSrc}" alt="Photo" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;"/>` : 'Photo'}
  </div>
</div>

<div class="form-title">APPLICATION FOR Ph.D. ADMISSION</div>

<div class="meta-bar">
  <span><strong>Application No:</strong> ${data.application_id}</span>
  <span><strong>Status:</strong> ${v(data.status)}</span>
  <span><strong>Submitted:</strong> ${data.final_submitted_at ? fmtD(data.final_submitted_at) : 'Not yet submitted'}</span>
  <span><strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN')}</span>
</div>

<!-- SECTION 1: EXAM DETAILS -->
<div class="section">
  <div class="sec-title">1. EXAMINATION DETAILS</div>
  <div class="fields-grid">
    ${field('Department', data.department_name)}
    ${field('Programme Offered', data.program_offered_name)}
    ${field('Exam Centre (First Preference)', data.exam_center_1)}
    ${field('Exam Centre (Second Preference)', data.exam_center_2)}
    ${field('Subject / Discipline', data.subject)}
    ${field('Category', data.category)}
    ${data.category === 'Part Time' ? `
      ${field('Working District', data.working_district)}
      ${field('Part-Time Category', data.part_time_category)}
      ${field('Role / Designation', data.part_time_designation)}
      ${field('Working area', data.part_time_area)}
    ` : ''}
    ${field('Qualified Examinations (NET/SET/JRF/SLET)', qualStr)}
  </div>
</div>

<!-- SECTION 2: PERSONAL DETAILS -->
<div class="section">
  <div class="sec-title">2. PERSONAL DETAILS</div>
  <div class="fields-grid">
    ${field('Applicant Name (English)', `${data.applicant_name || ''} ${data.applicant_initial || ''}`.trim())}
    ${field('Applicant Name (Tamil)', data.applicant_name_tamil)}
    ${field('Date of Birth', fmtD(data.dob))}
    ${field('Gender', data.gender)}
    ${field('Community', data.community)}
    ${field('Nationality', data.nationality)}
    ${field('Religion', data.religion)}
    ${field('NRI', data.is_nri ? 'Yes' : 'No')}
    ${field('Parent / Guardian Name', data.parent_name)}
    ${field('Physically Challenged', (data.is_physically_challenged == 1 || data.is_physically_challenged === 'Yes') ? `Yes – ${v(data.pc_percentage)}% (${v(data.pc_type)})` : 'No')}
    ${field('ID Type', data.id_type)}
    ${field('ID Number', data.id_number)}
  </div>
</div>

<!-- SECTION 3: CONTACT & ADDRESS -->
<div class="section">
  <div class="sec-title">3. CONTACT & ADDRESS</div>
  <div class="fields-grid">
    ${field('Mobile Number', data.mobile)}
    ${field('Phone (Landline)', data.phone)}
    ${field('Email Address', data.email)}
    ${field('Communication Address', [data.address_1, data.address_2, data.address_3].filter(Boolean).join(', '))}
    ${field('District', data.district)}
    ${field('State', data.state)}
    ${field('Pincode', data.pincode)}
    ${field('Permanent Address', data.perm_same_as_comm ? 'Same as Communication Address' : [data.perm_address_1, data.perm_district, data.perm_state, data.perm_pincode].filter(Boolean).join(', '))}
  </div>
</div>

<!-- SECTION 4: SCHOOL EDUCATION -->
${schoolRows ? `<div class="section">
  <div class="sec-title">4. SCHOOL EDUCATION</div>
  <table><thead><tr><th>Level</th><th>Institution Name</th><th>Board</th><th>Month / Year</th><th>Percentage</th></tr></thead>
  <tbody>${schoolRows}</tbody></table>
</div>` : ''}

<!-- SECTION 5: HIGHER EDUCATION -->
${higherRows ? `<div class="section">
  <div class="sec-title">5. HIGHER EDUCATION</div>
  <table><thead><tr><th>Level</th><th>Institution Name</th><th>University</th><th>Month / Year</th><th>Score</th></tr></thead>
  <tbody>${higherRows}</tbody></table>
</div>` : ''}

<!-- SECTION 6: WORK EXPERIENCE -->
${expRows ? `<div class="section">
  <div class="sec-title">6. WORK EXPERIENCE</div>
  <table><thead><tr><th>Designation</th><th>Organisation</th><th>Type</th><th>From</th><th>To</th><th>Duration</th></tr></thead>
  <tbody>${expRows}</tbody></table>
</div>` : ''}

<!-- DECLARATION -->
<div class="section">
  <div class="sec-title">7. DECLARATION</div>
  <div class="decl-box">
    I hereby solemnly declare that all information furnished in this application is true, complete and correct to the best of my knowledge and belief. I have not suppressed any material fact. I satisfy all the eligibility criteria prescribed for admission to the Ph.D. Programme. I understand that if any information is found to be false or incorrect at any stage, my candidature shall be liable to be cancelled. I have read and understood all instructions and conditions governing this application and agree to abide by the rules and regulations of Periyar University. I understand that once submitted, no modifications will be possible.
  </div>
</div>

<!-- SIGNATURE ROW -->
<div class="sign-row">
  <div class="sign-block">
    <div style="margin-bottom:20px">Place: _______________________</div>
    <div>Date: &nbsp;_______________________</div>
  </div>
  <div class="sign-block">
    ${signSrc ? `<img class="sign-img" src="${BASE}/${signSrc}" alt="Signature" crossorigin="anonymous"/>` : '<div class="sign-line"></div>'}
    <div>Signature of the Applicant</div>
  </div>
  <div class="sign-block">
    <div style="border:1px solid #aaa;width:120px;height:50px;margin-bottom:4px"></div>
    <div>Office Seal / Use Only</div>
  </div>
</div>

<div class="footer">
  Periyar University, Salem — Ph.D. Admission Application | ${data.application_id} | This is a computer generated document.
</div>

<script>
  // Wait for images to load then print
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 400);
  });
</script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=900,height=750,scrollbars=yes');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } else {
      toast.error('Pop-up blocked — please allow pop-ups for this site.');
    }
  };

  // Called when user picks Pay Now or Pay Later in the decision modal
  const handlePayDecision = async (decision) => {
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API}/application/final-submit`,
        { declarationAccepted: true, payment_decision: decision },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowDecision(false);
      if (decision === 'pay_now') {
        toast.success('Application validated! Redirecting to payment...');
        setTimeout(() => navigate('/payment'), 1200);
      } else {
        toast.success(`Application saved! Pay before ${res.data.payment_due_date ? new Date(res.data.payment_due_date).toLocaleDateString('en-IN') : 'the deadline'}.`);
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    } catch (err) {
      setShowDecision(false);
      const msg     = err.response?.data?.message || 'Submission failed. Please try again.';
      const missing = err.response?.data?.missingFields;
      if (missing?.length) toast.error(`Incomplete: ${missing.join(', ')}`);
      else toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const res = await axios.get(`${API}/applications/download-receipt/${data.application_id}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const tab = window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      if (!tab) toast.error('Pop-up blocked — please allow pop-ups for this site.');
      else toast.success('E-Receipt opened in new tab!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate E-Receipt. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  // ── loading ──
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" style={{ width: 48, height: 48 }} />
          <div className="text-muted fw-semibold">Loading your application…</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isPaid = ['Paid', 'Verified', 'Approved', 'Success'].includes(data.payment_status);
  const isLocked = !!data.final_submitted || !!data.form_locked || !!data.is_locked || submitted;
  const showPrintFeatures = isLocked && isPaid;
  const pct = completion?.percentage ?? 0;

  // ── success page ──
  if (submitted) {
    return (
      <div className="bg-light min-vh-100 pb-5">
        <div className="container" style={{ maxWidth: 740, paddingTop: 60 }}>
          <div className="card border-0 shadow-lg rounded-4 p-5">
            <div className="text-center mb-4">
              <div className="d-flex justify-content-center mb-3">
                <div className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 96, height: 96, background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                  <BadgeCheck size={52} color="#fff" />
                </div>
              </div>
              <h2 className="fw-bold mb-2" style={{ color: '#065f46' }}>Application Submitted!</h2>
              <p className="text-muted mb-0">
                Your Ph.D. application has been successfully submitted, payment processed, and records <strong>permanently locked</strong>.
              </p>
            </div>

            <div className="rounded-4 p-4 mb-4 text-start" style={{ background: '#f0fdf4', border: '1.5px solid #a7f3d0' }}>
              <h5 className="fw-bold mb-3 text-success border-bottom pb-2 d-flex align-items-center gap-2">
                <Shield size={18} /> Submission & Payment Details
              </h5>
              <div className="row g-3">
                <div className="col-sm-6">
                  <div className="text-muted small">Application ID</div>
                  <div className="fw-bold text-primary font-monospace">{data.application_id}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Verification Status</div>
                  <span className="badge bg-success px-3 py-2 mt-1">SUCCESS / SUBMITTED</span>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Receipt Number</div>
                  <div className="fw-bold text-dark font-monospace">{data.receipt_number || 'N/A'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Submission Reference</div>
                  <div className="fw-bold text-dark font-monospace">{data.submission_reference || 'N/A'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Transaction ID</div>
                  <div className="fw-bold text-dark font-monospace">{data.payment_transaction_id || 'N/A'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Completed On</div>
                  <div className="fw-semibold text-dark">{fmtDateTime(data.payment_completed_at || submittedAt)}</div>
                </div>
                <div className="col-12">
                  <div className="text-muted small">Applicant Name</div>
                  <div className="fw-semibold text-dark">{`${data.applicant_name || ''} ${data.applicant_initial || ''}`.trim()}</div>
                </div>
              </div>
            </div>

            <div className="d-flex gap-3 justify-content-center flex-wrap mt-2">
              <button className="btn btn-outline-secondary rounded-pill px-4" onClick={() => navigate('/dashboard')}>
                <ArrowLeft size={16} className="me-2" />Go to Dashboard
              </button>


              <button className="btn btn-success rounded-pill px-4 d-flex align-items-center gap-2"
                onClick={() => window.open(`/payment/receipt-by-app/${data.application_id}`, '_blank')}>
                <Printer size={16} /> View & Print E-Receipt
              </button>

              <button className="btn btn-outline-dark rounded-pill px-4" onClick={handlePrint}>
                <Printer size={16} className="me-2" />Print
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── documents map ──
  const docMap = {};
  (data.documents || []).forEach(d => { docMap[d.document_type] = d.file_path; });

  // Helper to strip local absolute path segments and keep the relative uploads path
  const cleanDocPath = (path) => {
    if (!path) return '';
    const idx = path.indexOf('uploads/');
    return idx !== -1 ? path.substring(idx) : path;
  };

  // Helper to dynamically resolve the document path based on type
  const getDocPath = (type) => {
    // 1. Direct match
    if (docMap[type]) return docMap[type];

    // 2. Case-insensitive / alias mapping
    if (type === 'Photo') return docMap['photo'] || docMap['Photo'];
    if (type === 'Signature') return docMap['signature'] || docMap['Signature'];
    if (type === 'ID Proof') return docMap['id_proof'] || docMap['ID Proof'] || docMap['id_proof_path'];
    if (type === 'community_cert') return docMap['community_cert'] || docMap['community_certificate'];
    if (type === 'pc_cert') return docMap['pc_cert'] || docMap['pc_certificate'];

    // 3. School Education marksheets
    if (type === 'sslc_marksheet') {
      return docMap['school_education.0_marksheet'] || docMap['sslc_marksheet'] || (data.school_education && data.school_education[0]?.marksheet_path);
    }
    if (type === 'hsc_marksheet') {
      return docMap['school_education.1_marksheet'] || docMap['hsc_marksheet'] || (data.school_education && data.school_education[1]?.marksheet_path);
    }

    // 4. Higher Education marksheets
    if (type === 'ug_marksheet') {
      const ugRow = data.higher_education?.find(h => h.level === 'UG');
      if (ugRow?.consolidated_marksheet_path) return ugRow.consolidated_marksheet_path;
      if (ugRow?.marksheet_path) return ugRow.marksheet_path;
      return docMap['ug_consolidated'] || docMap['ug_sem_1'] || docMap['ug_marksheet'];
    }
    if (type === 'pg_marksheet') {
      const pgRow = data.higher_education?.find(h => h.level === 'PG');
      if (pgRow?.consolidated_marksheet_path) return pgRow.consolidated_marksheet_path;
      if (pgRow?.marksheet_path) return pgRow.marksheet_path;
      return docMap['pg_consolidated'] || docMap['pg_sem_1'] || docMap['pg_marksheet'];
    }

    return null;
  };

  const DocBadge = ({ type, label }) => {
    const path = getDocPath(type);
    return (
      <div className={`d-flex align-items-center gap-2 px-3 py-2 rounded-3 border ${path ? 'border-success bg-success bg-opacity-10' : 'border-secondary bg-light'}`}>
        {path
          ? <CheckCircle size={14} className="text-success flex-shrink-0" />
          : <XCircle size={14} className="text-secondary flex-shrink-0" />}
        <span className="small fw-semibold">{label}</span>
        {path && (
          <a href={`${BASE_API}/${cleanDocPath(path)}`} target="_blank" rel="noreferrer"
            className="ms-auto btn btn-link p-0" style={{ fontSize: 11 }}>
            <Eye size={13} className="me-1" />View
          </a>
        )}
      </div>
    );
  };

  const qualExams = (() => {
    try {
      const raw = data.qualified_exams;
      if (!raw) return [];
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { return []; }
  })();

  // ── review page ──
  return (
    <div className="bg-light min-vh-100 pb-5">

      {/* ── top bar ── */}
      <div className="bg-white border-bottom shadow-sm" style={{ zIndex: 100 }}>
        <div className="container d-flex align-items-center justify-content-between py-3" style={{ maxWidth: 1100 }}>
          <div className="d-flex align-items-center gap-3">
            <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => navigate('/apply')}>
              <ArrowLeft size={15} className="me-1" />Back to Form
            </button>
            <div>
              <div className="fw-bold" style={{ fontSize: 15 }}>Final Review &amp; Submit</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                Application ID: <strong className="text-primary">{data.application_id}</strong>
              </div>
            </div>
          </div>
          {showPrintFeatures && (
            <div className="d-flex align-items-center gap-3">
              <button className="btn btn-sm btn-outline-dark rounded-pill px-3" onClick={handlePrint}>
                <Printer size={14} className="me-1" />Print
              </button>
              <button className="btn btn-sm btn-outline-primary rounded-pill px-3 d-flex align-items-center gap-1"
                onClick={handleDownloadPdf} disabled={pdfLoading}>
                {pdfLoading
                  ? <span className="spinner-border spinner-border-sm" />
                  : <Download size={14} />}
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="container py-4" style={{ maxWidth: 1100 }}>

        {/* ── locked notice ── */}
        {isLocked && (
          <div className="alert alert-success d-flex align-items-center gap-3 rounded-4 mb-4 shadow-sm">
            <Lock size={22} className="flex-shrink-0 text-success" />
            <div>
              <strong>Application Locked &amp; Submitted</strong>
              <div className="small text-muted">Submitted on {fmtDateTime(data.final_submitted_at)}. No further changes are allowed.</div>
            </div>
          </div>
        )}

        {/* ── completion banner ── */}
        {false && (
        <div className="card border-0 shadow-sm rounded-4 mb-4" style={{ overflow: 'hidden' }}>
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3">
              <div>
                <h5 className="fw-bold mb-1">Application Completeness</h5>
                <p className="text-muted small mb-0">All mandatory sections must be completed before final submission.</p>
              </div>
              <div className="text-center">
                <div className="fw-bold" style={{ fontSize: 32, color: pct === 100 ? '#10b981' : '#f59e0b' }}>{pct}%</div>
                <div className="text-muted" style={{ fontSize: 12 }}>Complete</div>
              </div>
            </div>
            <div className="progress mb-4" style={{ height: 10, borderRadius: 99 }}>
              <div
                className={`progress-bar ${pct === 100 ? 'bg-success' : pct >= 75 ? 'bg-warning' : 'bg-danger'}`}
                style={{ width: `${pct}%`, transition: 'width 0.6s' }}
              />
            </div>
            <div className="d-flex flex-wrap gap-3">
              <CheckBadge ok={completion?.checks?.personalInfo} label="Personal Details" />
              <CheckBadge ok={completion?.checks?.contactInfo}  label="Contact Information" />
              <CheckBadge ok={completion?.checks?.academicInfo} label="Academic Details" />
              <CheckBadge ok={completion?.checks?.documents}    label="Photo & Signature" />
            </div>

            {pct < 100 && completion?.missingFields && (
              <div className="mt-4 p-3 rounded-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <div className="fw-bold text-warning-emphasis mb-2 d-flex align-items-center gap-2" style={{ fontSize: 14 }}>
                  <span>⚠️</span>
                  <span>Please complete the following required fields in your draft to enable Final Submission:</span>
                </div>
                <div className="row g-3">
                  {completion.missingFields.personalInfo?.length > 0 && (
                    <div className="col-md-6 col-lg-3">
                      <div className="fw-bold text-dark small mb-1">👤 Personal Details:</div>
                      <ul className="mb-0 ps-3 small text-muted">
                        {completion.missingFields.personalInfo.map(f => <li key={f}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {completion.missingFields.contactInfo?.length > 0 && (
                    <div className="col-md-6 col-lg-3">
                      <div className="fw-bold text-dark small mb-1">📞 Contact & Address:</div>
                      <ul className="mb-0 ps-3 small text-muted">
                        {completion.missingFields.contactInfo.map(f => <li key={f}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {completion.missingFields.academicInfo?.length > 0 && (
                    <div className="col-md-6 col-lg-3">
                      <div className="fw-bold text-dark small mb-1">🎓 Academic Details:</div>
                      <ul className="mb-0 ps-3 small text-muted">
                        {completion.missingFields.academicInfo.map(f => <li key={f}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {completion.missingFields.documents?.length > 0 && (
                    <div className="col-md-6 col-lg-3">
                      <div className="fw-bold text-dark small mb-1">📁 Uploaded Files:</div>
                      <ul className="mb-0 ps-3 small text-muted">
                        {completion.missingFields.documents.map(f => <li key={f}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* ════════════════════════════════════
            SECTION 1 — EXAM DETAILS
        ════════════════════════════════════ */}
        <SectionCard icon={<FileText size={18} className="text-primary" />}
          title="1. Examination Details" color="#eff6ff" onEdit={() => goEdit(0)} locked={isLocked}>
          <div className="row">
            <Row label="Department"                  value={fmt(data.department_name)} highlight />
            <Row label="Programme Offered"           value={fmt(data.program_offered_name)} highlight />
            <Row label="Exam Center (First Choice)"  value={fmt(data.exam_center_1)} />
            <Row label="Exam Center (Second Choice)" value={fmt(data.exam_center_2)} />
            <Row label="Subject / Discipline"        value={fmt(data.subject)} />
            <Row label="Secondary Subject"           value={fmt(data.subject_2)} />
            <Row label="Category"                    value={fmt(data.category)} />
            {data.category === 'Part Time' && (
              <>
                <Row label="Working District" value={fmt(data.working_district)} />
                <Row label="Part-Time Category" value={fmt(data.part_time_category)} />
                <Row label="Role / Designation" value={fmt(data.part_time_designation)} />
                <Row label="Working area" value={fmt(data.part_time_area)} />
              </>
            )}
          </div>
        </SectionCard>

        {/* ════════════════════════════════════
            SECTION 2 — PERSONAL DETAILS
        ════════════════════════════════════ */}
        <SectionCard icon={<User size={18} className="text-success" />}
          title="2. Personal Details" color="#f0fdf4" onEdit={() => goEdit(0)} locked={isLocked}>
          <div className="row">
            <Row label="Applicant Name (English)"    value={fmt(data.applicant_name ? `${data.applicant_name} ${data.applicant_initial || ''}`.trim() : null)} highlight />
            <Row label="Applicant Name (Tamil)"      value={fmt(data.applicant_name_tamil)} />
            <Row label="Date of Birth"               value={fmtDate(data.dob)} />
            <Row label="Nationality"                 value={fmt(data.nationality)} />
            <Row label="Religion"                    value={fmt(data.religion)} />
            <Row label="Gender"                      value={fmt(data.gender)} />
            <Row label="Community"                   value={fmt(data.community)} />
            <Row label="NRI"                         value={data.is_nri ? 'Yes' : 'No'} />
            <Row label="Parent / Guardian Name"      value={fmt(data.parent_name)} />
            {data.is_physically_challenged == 1 && (
              <>
                <Row label="Physically Challenged"   value="Yes" />
                <Row label="Disability %"            value={fmt(data.pc_percentage)} />
                <Row label="Type"                    value={fmt(data.pc_type)} />
              </>
            )}
          </div>
          {/* Photo preview */}
          {(docMap['photo'] || docMap['Photo']) && (
            <div className="mt-3 d-flex align-items-center gap-3">
              <img src={`${BASE_API}/${cleanDocPath(docMap['photo'] || docMap['Photo'])}`} alt="Candidate"
                className="rounded-3 border shadow-sm"
                style={{ width: 90, height: 110, objectFit: 'cover' }} />
              <div>
                <div className="fw-semibold small">Passport Photo</div>
                <div className="text-muted" style={{ fontSize: 12 }}>Uploaded ✓</div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ════════════════════════════════════
            SECTION 3 — COMMUNICATION ADDRESS
        ════════════════════════════════════ */}
        <SectionCard icon={<MapPin size={18} className="text-warning" />}
          title="3. Communication Address" color="#fffbeb" onEdit={() => goEdit(1)} locked={isLocked}>
          <div className="row">
            <Row label="Address Line 1" value={fmt(data.address_1)} />
            <Row label="Address Line 2" value={fmt(data.address_2)} />
            <Row label="Address Line 3" value={fmt(data.address_3)} />
            <Row label="District"       value={fmt(data.district)} />
            <Row label="State"          value={fmt(data.state)} />
            <Row label="Pincode"        value={fmt(data.pincode)} />
            <Row label="Mobile"         value={fmt(data.mobile)} highlight />
            <Row label="Phone"          value={fmt(data.phone)} />
            <Row label="Email"          value={fmt(data.email)} />
            <Row label="ID Type"        value={fmt(data.id_type)} />
            <Row label="ID Number"      value={fmt(data.id_number)} />
          </div>
        </SectionCard>

        {/* ════════════════════════════════════
            SECTION 4 — PERMANENT ADDRESS
        ════════════════════════════════════ */}
        <SectionCard icon={<MapPin size={18} className="text-secondary" />}
          title="4. Permanent Address" color="#f9fafb" onEdit={() => goEdit(1)} locked={isLocked}>
          {data.perm_same_as_comm ? (
            <div className="text-muted small fst-italic">Same as communication address</div>
          ) : (
            <div className="row">
              <Row label="Address Line 1" value={fmt(data.perm_address_1)} />
              <Row label="Address Line 2" value={fmt(data.perm_address_2)} />
              <Row label="Address Line 3" value={fmt(data.perm_address_3)} />
              <Row label="City"           value={fmt(data.perm_city)} />
              <Row label="District"       value={fmt(data.perm_district)} />
              <Row label="State"          value={fmt(data.perm_state)} />
              <Row label="Pincode"        value={fmt(data.perm_pincode)} />
            </div>
          )}
        </SectionCard>

        {/* ════════════════════════════════════
            SECTION 5 — SCHOOL EDUCATION
        ════════════════════════════════════ */}
        {data.school_education?.length > 0 && (
          <SectionCard icon={<BookOpen size={18} className="text-info" />}
            title="5. School Education" color="#f0f9ff" onEdit={() => goEdit(2)} locked={isLocked}>
            <div className="table-responsive">
              <table className="table table-sm align-middle" style={{ fontSize: 13 }}>
                <thead className="table-light">
                  <tr>
                    <th>Level</th><th>Institution</th><th>Board</th>
                    <th>Month/Year</th><th>%</th><th>Marksheet</th>
                  </tr>
                </thead>
                <tbody>
                  {data.school_education.map((s, i) => (
                    <tr key={i}>
                      <td className="fw-semibold">{s.level}</td>
                      <td>{s.institution_name || '—'}</td>
                      <td>{s.board_name || s.other_board_name || s.board_id || '—'}</td>
                      <td>{s.passing_month} {s.passing_year}</td>
                      <td>{s.percentage || '—'}</td>
                      <td>
                        {s.marksheet_path
                          ? <a href={`${BASE_API}/${cleanDocPath(s.marksheet_path)}`} target="_blank" rel="noreferrer" className="btn btn-link btn-sm p-0"><Eye size={13} /></a>
                          : <XCircle size={14} className="text-secondary" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* ════════════════════════════════════
            SECTION 6 — HIGHER EDUCATION
        ════════════════════════════════════ */}
        {data.higher_education?.length > 0 && (() => {
          const pgRow = data.higher_education?.find(h => h.level === 'PG') || {};
          const integratedRow = data.higher_education?.find(h => h.level === 'Integrated') || {};
          return (
            <SectionCard icon={<BookOpen size={18} className="text-primary" />}
              title="6. Higher Education" color="#eef2ff" onEdit={() => goEdit(2)} locked={isLocked}>
              <div className="table-responsive">
                <table className="table table-sm align-middle" style={{ fontSize: 13 }}>
                  <thead className="table-light">
                    <tr>
                      <th>Level</th><th>Institution</th><th>University</th>
                      <th>Timeline</th><th>Score</th><th>Marksheet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.higher_education.map((h, i) => (
                      <tr key={i}>
                        <td className="fw-semibold text-nowrap">
                          {h.level}
                          {h.mark_statement_type && (
                            <div className="text-muted small fw-normal mt-0.5" style={{ fontSize: 10 }}>
                              {h.mark_statement_type}
                            </div>
                          )}
                          {h.is_awaiting_final_sem == 1 && (
                            <span className="badge bg-warning bg-opacity-15 text-warning-emphasis border border-warning-subtle px-1.5 py-0.5 mt-1 d-inline-block fw-semibold" style={{ fontSize: 9 }}>
                              Awaiting Results
                            </span>
                          )}
                        </td>
                        <td>{h.institution_name || '—'}</td>
                        <td style={{ maxWidth: 200 }}>{h.university_name || '—'}</td>
                        <td>
                          {h.level === 'UG' || h.level === 'PG' || h.level === 'Integrated' ? (
                            <>
                              <div>{h.passing_month || '—'}</div>
                              {(h.start_year || h.completion_year) && (
                                <div className="text-muted" style={{ fontSize: 11 }}>
                                  {h.start_year ? `Start: ${h.start_year}` : ''} {h.completion_year ? ` | End: ${h.completion_year}` : ''}
                                </div>
                              )}
                            </>
                          ) : (
                            <div>{h.passing_month ? `${h.passing_month} ` : ''}{h.passing_year ? `Pass: ${h.passing_year}` : '—'}</div>
                          )}
                        </td>
                        <td>
                          {h.score_value
                            ? h.score_type === 'CGPA' && h.cgpa_scale && ['UG','PG','M.Phil'].includes(h.level)
                              ? <>
                                  <span>{h.score_value} CGPA ({h.cgpa_scale}-pt)</span>
                                  {h.normalized_cgpa != null && (
                                    <div className="text-primary" style={{ fontSize: 11 }}>
                                      Normalized: {parseFloat(h.normalized_cgpa).toFixed(2)} / 10
                                    </div>
                                  )}
                                </>
                              : `${h.score_value}${h.score_type ? ` (${h.score_type})` : ''}`
                            : '—'}
                        </td>
                        <td>
                          {h.consolidated_marksheet_path || h.marksheet_path
                            ? <a href={`${BASE_API}/${cleanDocPath(h.consolidated_marksheet_path || h.marksheet_path)}`} target="_blank" rel="noreferrer" className="btn btn-link btn-sm p-0"><Eye size={13} /></a>
                            : <XCircle size={14} className="text-secondary" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Dynamic PG / Integrated Summary Card */}
              {(pgRow.institution_name || integratedRow.institution_name) && (
                <div className="mt-4 p-3 rounded-4 bg-light bg-opacity-70 border border-light-subtle">
                  <h6 className="fw-bold mb-3 text-secondary" style={{ fontSize: 13 }}>
                    Qualifying Academic Details Summary
                  </h6>
                  {integratedRow.institution_name ? (
                    <div className="row">
                      <Row label="Integrated Course Name" value={fmt(integratedRow.degree_name === 'Others' ? integratedRow.degree_name_other : integratedRow.degree_name)} />
                      <Row label="University" value={fmt(integratedRow.university_name)} />
                      <Row label="Institution" value={fmt(integratedRow.institution_name)} />
                      <Row label="Registration Number" value={fmt(integratedRow.registration_number)} />
                      <Row label="Timeline" value={fmt(`${integratedRow.start_year || '—'} to ${integratedRow.completion_year || '—'}`)} />
                      <Row label="Score" value={integratedRow.score_value ? `${integratedRow.score_value} (${integratedRow.score_type})` : null} />
                      <Row label="Mark Statement Type" value={fmt(integratedRow.mark_statement_type)} />
                      {integratedRow.is_awaiting_final_sem == 1 && <Row label="Awaiting Final Semester" value="Yes" highlight />}
                    </div>
                  ) : (
                    <div className="row">
                      <Row label="PG Degree / Course" value={fmt(pgRow.degree_name === 'Others' ? pgRow.degree_name_other : pgRow.degree_name)} />
                      <Row label="PG University" value={fmt(pgRow.university_name)} />
                      <Row label="PG Institution" value={fmt(pgRow.institution_name)} />
                      <Row label="Passing Month & Year" value={fmt(`${pgRow.passing_month || ''} ${pgRow.passing_year || ''}`.trim() || null)} />
                      <Row label="Score" value={pgRow.score_value ? `${pgRow.score_value} (${pgRow.score_type})` : null} />
                      <Row label="Mark Statement Type" value={fmt(pgRow.mark_statement_type)} />
                      {pgRow.is_awaiting_final_sem == 1 && <Row label="Awaiting Final Semester" value="Yes" highlight />}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          );
        })()}

        {/* ════════════════════════════════════
            SECTION 7 — WORK EXPERIENCE
        ════════════════════════════════════ */}
        {data.experience_details?.length > 0 && (
          <SectionCard icon={<Briefcase size={18} className="text-dark" />}
            title="7. Work Experience" color="#f9fafb" onEdit={() => goEdit(3)} locked={isLocked}>
            <div className="table-responsive">
              <table className="table table-sm align-middle" style={{ fontSize: 13 }}>
                <thead className="table-light">
                  <tr>
                    <th>Designation</th><th>Organization</th><th>Type</th>
                    <th>From</th><th>To</th><th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {data.experience_details.map((e, i) => {
                    const fromDisplay = e.from_date 
                      ? new Date(e.from_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
                      : `${e.from_month || ''} ${e.from_year || ''}`.trim() || '—';
                    const toDisplay = e.to_date 
                      ? new Date(e.to_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
                      : `${e.to_month || ''} ${e.to_year || ''}`.trim() || '—';
                    return (
                      <tr key={i}>
                        <td className="fw-semibold">{e.designation || '—'}</td>
                        <td>{e.organization_name || '—'}</td>
                        <td>{e.employment_type || e.employment_type_id || '—'}</td>
                        <td>{fromDisplay}</td>
                        <td>{toDisplay}</td>
                        <td>{e.total_years}Y {e.total_months}M</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* ════════════════════════════════════
            SECTION 8 — OTHER QUALIFICATIONS
        ════════════════════════════════════ */}
        <SectionCard icon={<BadgeCheck size={18} className="text-success" />}
          title="8. Other Qualifications" color="#f0fdf4" onEdit={() => goEdit(2)} locked={isLocked}>
          {qualExams.length > 0 ? (
            <div className="d-flex flex-wrap gap-2">
              {qualExams.map(q => (
                <span key={q} className="badge bg-success bg-opacity-15 text-success border border-success px-3 py-2 fw-semibold" style={{ fontSize: 13 }}>
                  <CheckCircle size={14} className="me-1" />{q}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-muted small fst-italic">No additional qualifications (NET/SET/JRF/SLET) declared.</div>
          )}
        </SectionCard>

        {/* ════════════════════════════════════
            SECTION 9 — UPLOADED DOCUMENTS
        ════════════════════════════════════ */}
        <SectionCard icon={<Upload size={18} className="text-primary" />}
          title="9. Uploaded Documents" color="#eff6ff" onEdit={() => goEdit(2)} locked={isLocked}>
          <div className="row g-3">
            {[
              { type: 'Photo',                 label: 'Passport Photo' },
              { type: 'Signature',             label: 'Signature' },
              { type: 'ID Proof',              label: 'ID Proof' },
              { type: 'community_cert',        label: 'Community Certificate' },
              { type: 'sslc_marksheet',        label: 'SSLC Marksheet' },
              { type: 'hsc_marksheet',         label: 'HSC Marksheet' },
              { type: 'ug_marksheet',          label: 'UG Marksheet' },
              { type: 'pg_marksheet',          label: 'PG Marksheet' },
              (data.is_physically_challenged == 1 || data.is_physically_challenged === 'Yes') ? { type: 'pc_cert', label: 'PC Certificate' } : null,
            ].filter(Boolean).map(d => (
              <div key={d.type} className="col-md-6 col-lg-4">
                <DocBadge type={d.type} label={d.label} />
              </div>
            ))}
          </div>
          {data.documents?.length === 0 && (
            <div className="text-muted small fst-italic mt-2">No documents uploaded yet.</div>
          )}
        </SectionCard>

        {/* ════════════════════════════════════
            DECLARATION + FINAL SUBMIT
        ════════════════════════════════════ */}
        {!isLocked && (
          <div className="card border-0 shadow-sm rounded-4 mb-4" style={{ border: '2px solid #fbbf24' }}>
            <div className="card-header py-3 rounded-top-4 d-flex align-items-center gap-2"
              style={{ background: '#fffbeb', borderBottom: '2px solid #fef3c7' }}>
              <Shield size={18} className="text-warning" />
              <span className="fw-bold" style={{ fontSize: 15 }}>Declaration</span>
            </div>
            <div className="card-body p-4">
              <div ref={declarationRef}
                className="rounded-3 p-4 mb-4"
                style={{ background: '#f9fafb', border: '1px solid #e5e7eb', maxHeight: 220, overflowY: 'auto', fontSize: 13, lineHeight: 1.8 }}>
                <p className="fw-semibold mb-2">I hereby solemnly declare that:</p>
                <ol className="mb-0" style={{ paddingLeft: '1.2rem' }}>
                  <li>All information furnished by me in this application is true, complete and correct to the best of my knowledge and belief.</li>
                  <li>I have not suppressed any material fact or provided any false information in this application.</li>
                  <li>I satisfy all the eligibility criteria prescribed for admission to the Ph.D. Programme.</li>
                  <li>I understand that if any information is found to be false or incorrect at any stage, my candidature shall be liable to be cancelled and I may be debarred from appearing in any future examinations conducted by Periyar University.</li>
                  <li>I have read and understood all the instructions and conditions governing this application, and I agree to abide by the rules and regulations of Periyar University.</li>
                  <li>I understand that once I submit this application, <strong>no modifications or edits will be possible under any circumstances</strong>.</li>
                  <li>I am aware that the issuance of hall ticket does not confer any right to admission and the final decision rests with the university authorities.</li>
                </ol>
              </div>

              <div className="d-flex align-items-start gap-3 p-3 rounded-3"
                style={{ background: declared ? '#f0fdf4' : '#f9fafb', border: `1.5px solid ${declared ? '#a7f3d0' : '#e5e7eb'}`, transition: 'all 0.3s' }}>
                <input
                  type="checkbox"
                  id="decl"
                  className="form-check-input mt-1 flex-shrink-0"
                  checked={declared}
                  onChange={e => setDeclared(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#10b981' }}
                />
                <label htmlFor="decl" className="fw-semibold" style={{ cursor: 'pointer', fontSize: 14 }}>
                  I have read and understood the above declaration in full. I hereby declare that all information provided is true and correct, and I accept all terms and conditions stated above.
                </label>
              </div>

              {false && pct < 100 && (
                <div className="alert alert-warning d-flex gap-2 align-items-center mt-3 mb-0 rounded-3">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span className="small">Your application is <strong>{pct}% complete</strong>. Some mandatory sections are incomplete. <Link to="/apply" className="alert-link fw-bold">Click here to go back and complete all required fields</Link> before submitting.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── sticky action bar ── */}
        {!isLocked && (
          <div className="card border-0 shadow rounded-4 p-4 d-flex flex-row align-items-center justify-content-between gap-3 flex-wrap">
            <div className="small text-muted">
              Review all sections carefully.
              <strong className="text-primary"> Choose Pay Now or Pay Later after proceeding.</strong>
            </div>
            <div className="d-flex gap-3 align-items-center">
              <button className="btn btn-outline-secondary rounded-pill px-4" onClick={() => navigate('/apply')}>
                <ArrowLeft size={15} className="me-1" />Back to Edit
              </button>
              <button
                className="btn btn-success rounded-pill px-5 fw-bold d-flex align-items-center gap-2"
                onClick={() => {
                  setShowDecision(true);
                }}
                disabled={!declared}
                title={!declared ? 'Please read and accept the declaration above first' : ''}
                style={{ opacity: !declared ? 0.6 : 1, transition: 'opacity 0.2s' }}
              >
                <Shield size={16} />
                Proceed to Final Submission
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════
          PAYMENT DECISION MODAL
      ════════════════════════════════════ */}
      {showDecision && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1055 }}
          onClick={e => { if (e.target === e.currentTarget && !submitting) setShowDecision(false); }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">

              {/* Header */}
              <div className="px-4 pt-4 pb-3" style={{ background: 'linear-gradient(135deg,#0f4c81,#1e6bb8)' }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.15)' }}>
                      <CheckCircle size={24} className="text-white" />
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0 text-white">Application Ready for Submission</h5>
                      <p className="mb-0 text-white-50" style={{ fontSize: 13 }}>Choose how you want to proceed with the fee payment</p>
                    </div>
                  </div>
                  <button className="btn-close btn-close-white" onClick={() => !submitting && setShowDecision(false)} />
                </div>
              </div>

              <div className="modal-body px-4 py-4">

                {/* Info banner */}
                <div className="rounded-3 p-3 mb-4 d-flex gap-2 align-items-start"
                  style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd' }}>
                  <AlertCircle size={16} className="text-primary flex-shrink-0 mt-1" />
                  <p className="mb-0 small text-muted">
                    Your application is complete and ready. You can pay the admission fee now or save your application and pay before the last payment date. <strong>Application will only be locked and finalized after successful payment.</strong>
                  </p>
                </div>

                {/* Choices */}
                <div className="row g-3">
                  {/* Pay Now */}
                  <div className="col-6">
                    <button
                      className="btn w-100 py-4 rounded-4 text-start position-relative overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg,#0f4c81,#1e6bb8)',
                        border: 'none', color: '#fff',
                        boxShadow: '0 4px 20px rgba(15,76,129,0.3)',
                        transition: 'transform 0.15s',
                      }}
                      disabled={submitting}
                      onClick={() => handlePayDecision('pay_now')}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <CreditCard size={28} className="mb-2 d-block" />
                      <div className="fw-bold" style={{ fontSize: 15 }}>Pay Now</div>
                      <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3, lineHeight: 1.5 }}>
                        Complete payment immediately and finalize your application today.
                      </div>
                      {submitting && <span className="spinner-border spinner-border-sm position-absolute top-0 end-0 m-2" />}
                    </button>
                  </div>

                  {/* Pay Later */}
                  <div className="col-6">
                    <button
                      className="btn w-100 py-4 rounded-4 text-start"
                      style={{
                        background: '#fff',
                        border: '2px solid #e2e8f0',
                        color: '#374151',
                        transition: 'transform 0.15s, border-color 0.15s',
                      }}
                      disabled={submitting}
                      onClick={() => handlePayDecision('pay_later')}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    >
                      <CalendarClock size={28} className="mb-2 d-block text-secondary" />
                      <div className="fw-bold" style={{ fontSize: 15 }}>Pay Later</div>
                      <div className="text-muted" style={{ fontSize: 11, marginTop: 3, lineHeight: 1.5 }}>
                        Save application now and pay before the deadline from your dashboard.
                      </div>
                    </button>
                  </div>
                </div>

                {/* Note */}
                <div className="mt-3 rounded-3 px-3 py-2" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div className="small text-warning-emphasis d-flex gap-2 align-items-start">
                    <AlertCircle size={13} className="flex-shrink-0 mt-1" />
                    <span>
                      <strong>Pay Later Note:</strong> You will not be able to choose Pay Later again once selected. Payment must be completed before the deadline shown on your dashboard, or your application will expire.
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-0 px-4 pb-4 pt-0">
                <button className="btn btn-link text-muted" onClick={() => !submitting && setShowDecision(false)} disabled={submitting}>
                  Cancel — Go Back to Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalReview;
