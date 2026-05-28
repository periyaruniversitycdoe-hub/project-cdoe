import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Send, ChevronRight, ChevronLeft, CheckCircle } from 'lucide-react';

const API_URL     = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;
const STUDENT_API = `(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api`;

const STEPS = ['Exam & Personal Details', 'Communication & Identity', 'PG & Mark Sheet'];

const COUNTRIES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Belarus","Belgium","Bhutan","Bolivia","Brazil","Brunei","Bulgaria","Cambodia","Cameroon","Canada","Chile","China","Colombia","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Ecuador","Egypt","Estonia","Ethiopia","Fiji","Finland","France","Georgia","Germany","Ghana","Greece","Guatemala","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Korea, South","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Libya","Lithuania","Luxembourg","Malaysia","Maldives","Mali","Malta","Mauritius","Mexico","Moldova","Mongolia","Morocco","Mozambique","Myanmar","Nepal","Netherlands","New Zealand","Nicaragua","Nigeria","Norway","Oman","Pakistan","Panama","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saudi Arabia","Senegal","Serbia","Singapore","Slovakia","Slovenia","South Africa","Spain","Sri Lanka","Sudan","Sweden","Switzerland","Syria","Taiwan","Tanzania","Thailand","Tunisia","Turkey","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"];
const RELIGIONS   = ["Hindu","Christian","Muslim","Sikh","Buddhist","Jain","Parsi","Other"];
const DEGREES     = ["M.A.","M.Sc.","M.Com.","M.Tech.","M.E.","M.B.A.","M.C.A.","M.Phil.","M.S.W.","M.Ed.","M.P.Ed.","M.Lib.I.Sc.","LL.M.","M.D.","M.S.","M.D.S.","Other"];
const UNIVERSITIES = ["Periyar University, Salem","Anna University, Chennai","University of Madras, Chennai","Madurai Kamaraj University, Madurai","Bharathiar University, Coimbatore","Bharathidasan University, Tiruchirappalli","Annamalai University, Chidambaram","Alagappa University, Karaikudi","Manonmaniam Sundaranar University, Tirunelveli","Pondicherry University, Puducherry","Tamil Nadu Agricultural University, Coimbatore","Tamil Nadu Teachers Education University, Chennai","Tamil Nadu Dr. M.G.R. Medical University, Chennai","Tamil Nadu Dr. Ambedkar Law University, Chennai","Tamil University, Thanjavur","University of Delhi, Delhi","Jawaharlal Nehru University (JNU), Delhi","Banaras Hindu University (BHU), Varanasi","Aligarh Muslim University (AMU), Aligarh","Jamia Millia Islamia, Delhi","University of Calcutta, Kolkata","University of Mumbai, Mumbai","University of Hyderabad, Hyderabad","Bangalore University, Bangalore","University of Mysore, Mysore","University of Kerala, Thiruvananthapuram","Andhra University, Visakhapatnam","Sri Venkateswara University, Tirupati","Indian Institute of Science (IISc), Bangalore","IIT Madras","IIT Delhi","IIT Bombay","IIT Kanpur","IIT Kharagpur","IIT Roorkee","IIT Guwahati","NIT Trichy","NIT Warangal","Other Indian University","Foreign University"];

const FALLBACK_GENDERS     = [{ id:1, name:'Male' },{ id:2, name:'Female' },{ id:3, name:'Transgender' }];
const FALLBACK_COMMUNITIES = [{ id:1, name:'OC - Open Category' },{ id:2, name:'BC - Backward Class' },{ id:3, name:'BCM - Backward Class Muslim' },{ id:4, name:'MBC - Most Backward Class' },{ id:5, name:'DNC - Denotified Community' },{ id:6, name:'SC - Scheduled Caste' },{ id:7, name:'SCA - Scheduled Caste (Arunthathiyar)' },{ id:8, name:'ST - Scheduled Tribe' }];
const FALLBACK_EXAM_CENTERS= [{ id:1, name:'Salem' },{ id:2, name:'Chennai' },{ id:3, name:'Coimbatore' },{ id:4, name:'Madurai' },{ id:5, name:'Trichy' }];
const FALLBACK_SUBJECTS    = [{ id:1, name:'Computer Science' },{ id:2, name:'English' },{ id:3, name:'Mathematics' },{ id:4, name:'Physics' },{ id:5, name:'Commerce' },{ id:6, name:'History' }];
const FALLBACK_CATEGORIES  = [{ id:1, name:'Full Time' },{ id:2, name:'Part Time' }];
const FALLBACK_DISTRICTS   = ["Ariyalur","Chennai","Coimbatore","Cuddalore","Dharmapuri","Dindigul","Erode","Kallakurichi","Kancheepuram","Kanniyakumari","Karur","Krishnagiri","Madurai","Nagapattinam","Namakkal","Nilgiris","Perambalur","Pudukkottai","Ramanathapuram","Ranipet","Salem","Sivaganga","Tenkasi","Thanjavur","Theni","Thoothukudi","Tiruchirappalli","Tirunelveli","Tirupathur","Tiruppur","Tiruvallur","Tiruvannamalai","Tiruvarur","Vellore","Viluppuram","Virudhunagar"];

// Year range helper: 1980 to current year
const YEAR_OPTIONS = Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => new Date().getFullYear() - i);



const AdminApplicationForm = () => {
  const { id: applicationId } = useParams();
  const navigate = useNavigate();
  const [step, setStep]       = useState(0);
  const [dropdowns, setDropdowns] = useState({});
  const [states, setStates]   = useState([]);
  const [commDistricts, setCommDistricts] = useState([]);
  const [permDistricts, setPermDistricts] = useState([]);
  const [photos, setPhotos]   = useState({});
  const [fileSettings, setFileSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [appStatus, setAppStatus] = useState('Draft');
  const [semesters, setSemesters] = useState(['sem_1']);
  const [partTimeMapping, setPartTimeMapping] = useState({});

  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const { register, watch, getValues, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      application_id: applicationId,
      nationality: 'India', religion: 'Hindu',
      is_awaiting_final_sem: 0, is_physically_challenged: 'No',
      mobile_code: '+91', gender: 'Male',
      score_type: 'Percentage', mark_statement_type: 'Individual Mark Statement',
      id_type: 'Aadhaar No', category: '',
      perm_same_as_comm: false,
    }
  });

  const category          = watch('category');
  const partTimeCategory   = watch('part_time_category');
  const center1           = watch('exam_center_1');
  const center2           = watch('exam_center_2');
  const isPC              = watch('is_physically_challenged');
  const markType          = watch('mark_statement_type');
  const idType            = watch('id_type');
  const commState         = watch('state');
  const permSameAsComm    = watch('perm_same_as_comm');

  // Fetch dynamic part-time configurations from database
  useEffect(() => {
    axios.get(`${STUDENT_API}/part-time-configurations`)
      .then(res => {
        const map = {};
        (res.data || []).forEach(cfg => {
          map[cfg.category_name] = {
            designations: cfg.designations.split(',').map(d => d.trim()),
            area: cfg.eligible_area
          };
        });
        setPartTimeMapping(map);
      })
      .catch(() => {});
  }, []);

  // Automatically update part-time details when sub-category changes
  useEffect(() => {
    if (partTimeCategory && partTimeMapping[partTimeCategory]) {
      setValue('part_time_area', partTimeMapping[partTimeCategory].area);
    } else {
      setValue('part_time_area', '');
    }
  }, [partTimeCategory, partTimeMapping, setValue]);

  // ── Load dropdowns & states on mount ──────────────────────────────────────
  useEffect(() => {
    const loadDropdowns = async () => {
      const tables = ['exam_centers','subjects','categories','genders','communities','id_types','score_types','mark_statement_types'];
      const data = {};
      for (const t of tables) {
        try { const r = await axios.get(`${STUDENT_API}/dropdowns/${t}`); data[t] = r.data; } catch {}
      }
      setDropdowns(data);
    };
    const loadStates = async () => {
      try { const r = await axios.get(`${STUDENT_API}/states`); setStates(r.data.data || []); } catch {}
    };
    loadDropdowns();
    loadStates();
  }, []);

  // Load per-file-type upload size limits from admin settings
  useEffect(() => {
    axios.get(`${STUDENT_API}/file-upload-settings`)
      .then(r => {
        const map = {};
        (r.data.data || []).forEach(s => { map[s.file_type] = s; });
        setFileSettings(map);
      })
      .catch(() => {});
  }, []);

  // ── Cascade: comm state → comm districts ──────────────────────────────────
  useEffect(() => {
    if (!commState) { setCommDistricts([]); return; }
    axios.get(`${STUDENT_API}/districts?state_name=${encodeURIComponent(commState)}`)
      .then(r => setCommDistricts(r.data.data || []))
      .catch(() => setCommDistricts([]));
  }, [commState]);

  // ── perm_same_as_comm — copy comm address to perm fields ──────────────────
  useEffect(() => {
    if (permSameAsComm) {
      const v = getValues();
      setValue('perm_address_1', v.address_1 || '');
      setValue('perm_address_2', v.address_2 || '');
      setValue('perm_address_3', v.address_3 || '');
      setValue('perm_state',     v.state      || '');
      if (commDistricts && commDistricts.length > 0) {
        setPermDistricts([...commDistricts]);
      }
      setTimeout(() => {
        setValue('perm_district',  v.district   || '');
      }, 50);
      setValue('perm_city',      v.city       || '');
      setValue('perm_pincode',   v.pincode    || '');
    }
  }, [permSameAsComm, commDistricts]);

  // Cascade perm_state → perm_districts
  const permState = watch('perm_state');
  useEffect(() => {
    if (!permState || permSameAsComm) { setPermDistricts([]); return; }
    axios.get(`${STUDENT_API}/districts?state_name=${encodeURIComponent(permState)}`)
      .then(r => setPermDistricts(r.data.data || []))
      .catch(() => setPermDistricts([]));
  }, [permState, permSameAsComm]);

  useEffect(() => {
    if (markType === 'Consolidated Mark Statement') setValue('is_awaiting_final_sem', 0);
  }, [markType, setValue]);

  useEffect(() => {
    if (category !== 'Part Time') setValue('working_district', '');
  }, [category, setValue]);

  // ── Load application data ──────────────────────────────────────────────────
  useEffect(() => {
    if (!applicationId) return;
    const load = async () => {
      try {
        const res  = await axios.get(`${API_URL}/applications/${applicationId}`, { headers });
        const data = res.data.data;
        setAppStatus(data.status);
        if (data.qualified_exams && typeof data.qualified_exams === 'string') {
          try { data.qualified_exams = JSON.parse(data.qualified_exams); } catch {}
        }
        reset(data);

        // Load documents
        const docs = {};
        (res.data.documents || []).forEach(doc => {
          docs[doc.document_type] = { preview: `(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + ''/${doc.file_path}`, isExisting: true };
        });
        setPhotos(docs);

        const sems = Object.keys(docs).filter(k => k.startsWith('sem_')).sort();
        if (sems.length > 0) setSemesters(sems);
        else if (data.mark_statement_type === 'Consolidated Mark Statement') setSemesters(['consolidated']);
        else setSemesters(['sem_1']);

        // Pre-load comm districts
        if (data.state) {
          const dr = await axios.get(`${STUDENT_API}/districts?state_name=${encodeURIComponent(data.state)}`);
          setCommDistricts(dr.data.data || []);
        }
        if (data.perm_state && data.perm_state !== data.state) {
          const dr = await axios.get(`${STUDENT_API}/districts?state_name=${encodeURIComponent(data.perm_state)}`);
          setPermDistricts(dr.data.data || []);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [applicationId, reset]);

  const isSubmitted = false; // admin can always edit

  const handleAlphaInput  = e => { e.target.value = e.target.value.replace(/[^A-Za-z஀-௿\s]/g, ''); };
  const handleCapsAlphaInput = e => { e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '').toUpperCase(); };
  const handleNumericInput= e => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); };
  const handleAadhaarInput= e => {
    let v = e.target.value.replace(/[^0-9]/g, '').slice(0, 12);
    e.target.value = v.match(/.{1,4}/g)?.join(' ') || v;
  };

  const removeFile = key => setPhotos(p => { const n = { ...p }; delete n[key]; return n; });

  const getUploadIntimation = (key) => {
    const typeMap = {
      photo:          'Photo',
      signature:      'Signature',
      id_proof:       'ID Proof',
      community_cert: 'Community Certificate',
      pc_cert:        'PC Certificate',
      sslc_marksheet: 'Mark Sheet',
      hsc_marksheet:  'Mark Sheet',
      consolidated:   'Mark Sheet',
    };
    
    let settingKey = typeMap[key];
    if (!settingKey) {
      if (key.startsWith('sem_')) {
        settingKey = 'Mark Sheet';
      } else {
        settingKey = 'Mark Sheet';
      }
    }

    const setting = fileSettings[settingKey];
    if (setting) {
      const allowed = setting.allowed_extensions.toUpperCase();
      const max = `${setting.max_size} ${setting.size_unit}`;
      return `Allowed: ${allowed} | Max Size: ${max}`;
    }

    const fallbacks = {
      'Photo': 'Allowed: JPG, JPEG, PNG | Max Size: 200 KB',
      'Signature': 'Allowed: JPG, JPEG, PNG | Max Size: 100 KB',
      'ID Proof': 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 500 KB',
      'Community Certificate': 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 1 MB',
      'PC Certificate': 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 1 MB',
      'Mark Sheet': 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 2 MB',
    };

    return fallbacks[settingKey] || 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 2 MB';
  };

  const renderUploadControls = (key, disabled = false) => {
    const fileData = photos[key];
    const intimation = getUploadIntimation(key);
    
    return (
      <div className="mt-2 text-start">
        {fileData ? (
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 d-inline-flex align-items-center gap-1" style={{ fontSize: '11px', fontWeight: '600' }}>
              ✓ Uploaded
            </span>
            {fileData.preview && (
              <button
                type="button"
                className="btn btn-xs btn-outline-primary py-1 px-3 d-inline-flex align-items-center"
                style={{ fontSize: '11px', borderRadius: '4px', height: '24px', lineHeight: '1' }}
                onClick={() => window.open(fileData.preview, '_blank')}
              >
                View
              </button>
            )}
            {!disabled && (
              <button
                type="button"
                className="btn btn-xs btn-outline-danger py-1 px-3 d-inline-flex align-items-center"
                style={{ fontSize: '11px', borderRadius: '4px', height: '24px', lineHeight: '1' }}
                onClick={() => removeFile(key)}
              >
                Delete
              </button>
            )}
          </div>
        ) : (
          <div className="d-flex flex-column gap-1">
            <label
              className={`btn btn-sm ${disabled ? 'btn-light disabled text-muted' : 'btn-secondary'} px-3 d-inline-flex align-items-center justify-content-center`}
              style={{ cursor: disabled ? 'default' : 'pointer', width: 'fit-content', fontSize: '12px', height: '32px' }}
            >
              Upload File
              <input
                type="file"
                hidden
                accept={key === 'photo' || key === 'signature' ? 'image/*' : 'image/*,.pdf'}
                onChange={e => handleFileChange(e, key)}
                disabled={disabled}
              />
            </label>
          </div>
        )}
        <div className="mt-1 d-flex align-items-center gap-1 text-muted" style={{ fontSize: '10.5px' }}>
          <span className="text-info fw-bold">ℹ️</span>
          <span>{intimation}</span>
        </div>
      </div>
    );
  };

  const addSemester = () => {
    if (semesters.length >= 10) return;
    setSemesters(p => [...p, `sem_${p.length + 1}`]);
  };
  const removeSemesterRow = key => {
    if (semesters.length <= 1) return;
    setSemesters(p => p.filter(k => k !== key));
    removeFile(key);
  };

  const handleFileChange = (e, key) => {
    const file = e.target.files[0];
    if (!file) return;

    const typeMap = {
      photo:          'Photo',
      signature:      'Signature',
      id_proof:       'ID Proof',
      community_cert: 'Community Certificate',
      pc_cert:        'PC Certificate',
    };
    const settingKey = typeMap[key] || 'Mark Sheet';
    const setting    = fileSettings[settingKey];

    let limitKB;
    if (setting) {
      limitKB = setting.size_unit === 'MB' ? setting.max_size * 1024 : setting.max_size;
    } else {
      const fallback = { photo: 200, signature: 100, id_proof: 500, community_cert: 1024, pc_cert: 1024 };
      limitKB = fallback[key] || 2048;
    }

    const fileSizeKB = file.size / 1024;
    if (fileSizeKB > limitKB) {
      const display = limitKB >= 1024 ? `${(limitKB / 1024).toFixed(1)}MB` : `${limitKB}KB`;
      toast.error(`${settingKey}: max allowed size is ${display}. (Your file: ${Math.round(fileSizeKB)}KB)`);
      e.target.value = '';
      return;
    }

    setPhotos(p => ({ ...p, [key]: { file, preview: URL.createObjectURL(file) } }));
  };

  // ── Save (save + optional navigate) ────────────────────────────────────────
  const saveData = useCallback(async (status = 'Draft') => {
    setLoading(true);
    const data = getValues();
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => v != null && formData.append(k, v));
    Object.entries(photos).forEach(([k, v]) => { if (v.file) formData.append(k, v.file); });
    formData.set('status', status);
    formData.set('application_id', applicationId);
    try {
      await axios.post(`${STUDENT_API}/applications/save`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Details saved');
      return true;
    } catch { toast.error('Error saving'); return false; }
    finally { setLoading(false); }
  }, [applicationId, getValues, photos]);

  const handleSaveAndNext = async () => {
    const ok = await saveData('Draft');
    if (ok) setStep(s => s + 1);
  };

  // ── STEP 1 ─────────────────────────────────────────────────────────────────
  const Step1 = () => (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
        <h5 className="mb-0 fw-bold">Exam &amp; Personal Details</h5>
      </div>
      <div className="card-body p-4">
        <table className="table table-bordered align-middle mb-0">
          <tbody>
            <tr>
              <td className="text-end fw-semibold bg-light" style={{ width: '30%' }}>Exam Centre Preference 1 <span className="text-danger">*</span></td>
              <td>
                <select className="form-select form-select-sm" {...register('exam_center_1')}>
                  <option value="">Select</option>
                  {(dropdowns.exam_centers || FALLBACK_EXAM_CENTERS).filter(i => i.name !== center2).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
              </td>
              <td className="text-end fw-semibold bg-light">Exam Centre Preference 2</td>
              <td>
                <select className="form-select form-select-sm" {...register('exam_center_2')}>
                  <option value="">Select</option>
                  {(dropdowns.exam_centers || FALLBACK_EXAM_CENTERS).filter(i => i.name !== center1).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
              </td>
              <td rowSpan={8} className="text-center align-top py-3" style={{ width: '180px' }}>
                <div className="mb-4">
                  <div className="border d-flex align-items-center justify-content-center mx-auto rounded" style={{ width: 100, height: 120, background: '#f8f9fa', overflow: 'hidden' }}>
                    {photos.photo ? <img src={photos.photo.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="photo" /> : <small className="text-muted">Photo</small>}
                  </div>
                  {renderUploadControls('photo')}
                  <small className="text-muted d-block mt-1 fw-bold" style={{ fontSize: '10px' }}>Applicant's Photo</small>
                </div>
                <div className="mt-4 pt-4 border-top">
                  <div className="border d-flex align-items-center justify-content-center mx-auto rounded" style={{ width: 120, height: 60, background: '#f8f9fa', overflow: 'hidden' }}>
                    {photos.signature ? <img src={photos.signature.preview} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="sig" /> : <small className="text-muted">Signature</small>}
                  </div>
                  {renderUploadControls('signature')}
                  <small className="text-muted d-block mt-1 fw-bold" style={{ fontSize: '10px' }}>Applicant's Signature</small>
                </div>
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Subject/Discipline <span className="text-danger">*</span></td>
              <td>
                <select className="form-select form-select-sm" {...register('subject')}>
                  <option value="">Select</option>
                  {(dropdowns.subjects || FALLBACK_SUBJECTS).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
              </td>
              <td colSpan="2"></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Category <span className="text-danger">*</span></td>
              <td>
                <select className="form-select form-select-sm" {...register('category')}>
                  <option value="">Select</option>
                  {(dropdowns.categories || FALLBACK_CATEGORIES).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
              </td>
              <td className="text-end fw-semibold bg-light">{category === 'Part Time' ? 'Working District' : ''}</td>
              <td>
                {category === 'Part Time' && (
                  <select className="form-select form-select-sm" {...register('working_district')}>
                    <option value="">Select District</option>
                    {FALLBACK_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
              </td>
            </tr>
            {category === 'Part Time' && (
              <>
                <tr>
                  <td className="text-end fw-semibold bg-light text-primary">Part-Time Category <span className="text-danger">*</span></td>
                  <td>
                    <select className="form-select form-select-sm" {...register('part_time_category')}>
                      <option value="">Select Part-Time Category</option>
                      {Object.keys(partTimeMapping).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </td>
                  <td className="text-end fw-semibold bg-light text-primary">Role / Designation <span className="text-danger">*</span></td>
                  <td>
                    <select className="form-select form-select-sm" {...register('part_time_designation')}>
                      <option value="">Select Designation</option>
                      {partTimeCategory && partTimeMapping[partTimeCategory]?.designations.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td className="text-end fw-semibold bg-light text-muted">Working area</td>
                  <td>
                    <input type="text" className="form-control form-control-sm bg-white" {...register('part_time_area')} readOnly />
                  </td>
                </tr>
              </>
            )}
            <tr>
              <td className="text-end fw-semibold bg-light">Applicant's Name <span className="text-danger">*</span><br /><small className="text-muted">(IN CAPITAL LETTERS)</small></td>
              <td>
                <div className="d-flex gap-2">
                  <input type="text" className="form-control form-control-sm" placeholder="Enter Name" {...register('applicant_name')} onInput={handleCapsAlphaInput} style={{ textTransform: 'uppercase', flex: 3 }} />
                  <input type="text" className="form-control form-control-sm" placeholder="Initial" {...register('applicant_initial', { required: true })} maxLength={5} onInput={handleCapsAlphaInput} style={{ textTransform: 'uppercase', flex: 1, maxWidth: '80px' }} />
                </div>
              </td>
              <td className="text-end fw-semibold bg-light">Date of Birth <span className="text-danger">*</span></td>
              <td><input type="date" className="form-control form-control-sm" {...register('dob')} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">விண்ணப்பதாரரின் பெயர்</td>
              <td><input type="text" className="form-control form-control-sm" {...register('applicant_name_tamil')} onInput={handleAlphaInput} /></td>
              <td className="bg-light"></td><td></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Nationality <span className="text-danger">*</span></td>
              <td>
                <div className="d-flex align-items-center gap-3">
                  <select className="form-select form-select-sm" style={{ width: 180 }} {...register('nationality')}>
                    <option value="">Select Nationality</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <label className="fw-semibold mb-0">Religion</label>
                  <select className="form-select form-select-sm" style={{ width: 150 }} {...register('religion')}>
                    <option value="">Select Religion</option>
                    {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </td>
              <td></td><td></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Gender</td>
              <td>
                <select className="form-select form-select-sm" style={{ width: 250 }} {...register('gender', { required: true })}>
                  <option value="">Select Gender</option>
                  {(dropdowns.genders || FALLBACK_GENDERS).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
                {errors.gender && <small className="text-danger">Required</small>}
              </td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Community <span className="text-danger">*</span></td>
              <td colSpan={2}>
                <select className="form-select form-select-sm mb-2" style={{ width: '350px' }} {...register('community', { required: true })}>
                  <option value="">Select Community</option>
                  {(dropdowns.communities || FALLBACK_COMMUNITIES).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
                {renderUploadControls('community_cert')}
              </td>
              <td></td><td></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Parent / Guardian Name <span className="text-danger">*</span></td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" {...register('parent_name')} onInput={handleCapsAlphaInput} style={{ textTransform: 'uppercase' }} /></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── STEP 2 ─────────────────────────────────────────────────────────────────
  const Step2 = () => (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
        <h5 className="mb-0 fw-bold">Communication &amp; Identity Details</h5>
      </div>
      <div className="card-body p-4">
        <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
          <strong>Instructions:</strong> Provide a valid postal address for all official correspondence.
          If your permanent address is the same, check the checkbox below to auto-fill it.
        </p>
        <table className="table table-bordered align-middle mb-0">
          <tbody>
            {/* Communication Address */}
            <tr><td colSpan={4} className="bg-light fw-bold py-2 ps-3" style={{ fontSize: '13px' }}>Communication Address</td></tr>
            <tr>
              <td className="text-end fw-semibold bg-light" style={{ width: '28%' }}>Address Line 1 <span className="text-danger">*</span></td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" {...register('address_1')} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Line 2 <span className="text-danger">*</span></td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" {...register('address_2')} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Line 3</td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" {...register('address_3')} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">State <span className="text-danger">*</span></td>
              <td>
                <select className="form-select form-select-sm" {...register('state', { required: true })}>
                  <option value="">Select State</option>
                  {states.map(s => <option key={s.id} value={s.state_name}>{s.state_name}</option>)}
                </select>
                {errors.state && <small className="text-danger">Required</small>}
              </td>
              <td className="text-end fw-semibold bg-light">District <span className="text-danger">*</span></td>
              <td>
                <select className="form-select form-select-sm" {...register('district', { required: true })} disabled={!commState}>
                  <option value="">{commState ? 'Select District' : 'Select State first'}</option>
                  {commDistricts.length > 0
                    ? commDistricts.map(d => <option key={d.id} value={d.district_name}>{d.district_name}</option>)
                    : FALLBACK_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">City / Town</td>
              <td><input type="text" className="form-control form-control-sm" {...register('city')} /></td>
              <td className="text-end fw-semibold bg-light">Pincode <span className="text-danger">*</span></td>
              <td><input type="text" className="form-control form-control-sm" maxLength={6} {...register('pincode')} onInput={handleNumericInput} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Mobile No. <span className="text-danger">*</span></td>
              <td>
                <div className="d-flex gap-2">
                  <select className="form-select form-select-sm" style={{ width: 80 }} {...register('mobile_code')}>
                    <option value="+91">+91</option>
                  </select>
                  <input type="text" className="form-control form-control-sm" maxLength={10} {...register('mobile')} onInput={handleNumericInput} />
                </div>
              </td>
              <td className="text-end fw-semibold bg-light">Phone No.(LL)</td>
              <td><input type="text" className="form-control form-control-sm" {...register('phone')} onInput={handleNumericInput} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">E-mail ID <span className="text-danger">*</span></td>
              <td colSpan={3}><input type="email" className="form-control form-control-sm bg-white" style={{ width: 300 }} {...register('email_id')} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Select ID <span className="text-danger">*</span></td>
              <td colSpan={3}>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <select className="form-select form-select-sm" style={{ width: 160 }} {...register('id_type')}>
                    <option>Aadhaar No</option><option>Voter ID</option><option>Passport</option>
                  </select>
                  <input type="text" className="form-control form-control-sm" style={{ width: 200 }}
                    {...register('id_number')}
                    maxLength={idType === 'Aadhaar No' ? 14 : 20}
                    onInput={idType === 'Aadhaar No' ? handleAadhaarInput : handleNumericInput}
                    placeholder={idType === 'Aadhaar No' ? '0000 0000 0000' : 'Enter ID Number'}
                  />
                  <div className="flex-grow-1">
                    {renderUploadControls('id_proof')}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Physically Challenged</td>
              <td colSpan={3}>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <select className="form-select form-select-sm" style={{ width: 100 }} {...register('is_physically_challenged')}>
                    <option value="No">No</option><option value="Yes">Yes</option>
                  </select>
                  {isPC === 'Yes' && (
                    <>
                      <label className="fw-semibold mb-0">% Challenge</label>
                      <input type="text" className="form-control form-control-sm" style={{ width: 80 }} {...register('pc_percentage')} onInput={handleNumericInput} />
                      <select className="form-select form-select-sm" style={{ width: 180 }} {...register('pc_type')}>
                        <option value="">Type</option>
                        {['Visual','Hearing','Orthopedic','Locomotor','Other'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <div className="flex-grow-1">
                        {renderUploadControls('pc_cert')}
                      </div>
                    </>
                  )}
                </div>
              </td>
            </tr>

            {/* Permanent Address */}
            <tr>
              <td colSpan={4} className="py-2 ps-3 bg-light">
                <div className="d-flex align-items-center gap-3">
                  <span className="fw-bold" style={{ fontSize: '13px' }}>Permanent Address</span>
                  <div className="form-check mb-0">
                    <input type="checkbox" className="form-check-input" id="permSame" {...register('perm_same_as_comm')} />
                    <label className="form-check-label" htmlFor="permSame" style={{ fontSize: '13px' }}>
                      Same as Communication Address
                    </label>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Address Line 1</td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" {...register('perm_address_1')} disabled={!!permSameAsComm} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Line 2</td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" {...register('perm_address_2')} disabled={!!permSameAsComm} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">State</td>
              <td>
                <select className="form-select form-select-sm" {...register('perm_state')} disabled={!!permSameAsComm}>
                  <option value="">Select State</option>
                  {states.map(s => <option key={s.id} value={s.state_name}>{s.state_name}</option>)}
                </select>
              </td>
              <td className="text-end fw-semibold bg-light">District</td>
              <td>
                <select className="form-select form-select-sm" {...register('perm_district')} disabled={!!permSameAsComm || !permState}>
                  <option value="">{permState ? 'Select District' : 'Select State first'}</option>
                  {(permSameAsComm ? commDistricts : permDistricts).map(d => <option key={d.id} value={d.district_name}>{d.district_name}</option>)}
                </select>
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">City / Town</td>
              <td><input type="text" className="form-control form-control-sm" {...register('perm_city')} disabled={!!permSameAsComm} /></td>
              <td className="text-end fw-semibold bg-light">Pincode</td>
              <td><input type="text" className="form-control form-control-sm" maxLength={6} {...register('perm_pincode')} disabled={!!permSameAsComm} onInput={handleNumericInput} /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── STEP 3 ─────────────────────────────────────────────────────────────────
  const Step3 = () => (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
        <h5 className="mb-0 fw-bold">PG Details &amp; Mark Sheet Attachment</h5>
      </div>
      <div className="card-body p-4">
        <table className="table table-bordered align-middle mb-4">
          <tbody>
            <tr>
              <td className="text-end fw-semibold bg-light" style={{ width: '30%' }}>PG Degree with Subject <span className="text-danger">*</span></td>
              <td colSpan={3}>
                <div className="d-flex gap-2">
                  <select className="form-select form-select-sm" style={{ width: 150 }} {...register('pg_degree')}>
                    <option value="">Select Degree</option>
                    {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input type="text" className="form-control form-control-sm" placeholder="Subject (e.g. Computer Science)" {...register('pg_subject')} onInput={handleAlphaInput} />
                </div>
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Score in PG Degree <span className="text-danger">*</span></td>
              <td>
                <div className="d-flex align-items-center gap-2">
                  <select className="form-select form-select-sm" style={{ width: 150 }} {...register('score_type')}>
                    <option>Percentage</option><option>CGPA</option><option>Grade</option>
                  </select>
                  <input type="text" className="form-control form-control-sm" style={{ width: 80 }} {...register('score_value')}
                    onInput={e => { e.target.value = e.target.value.replace(/[^0-9.]/g, ''); }} />
                  <span>%</span>
                </div>
              </td>
              <td className="text-end fw-semibold bg-light">Year of Passing <span className="text-danger">*</span></td>
              <td>
                {/* Feature 2: Year picker dropdown */}
                <select className="form-select form-select-sm" style={{ width: 120 }} {...register('year_of_passing')}>
                  <option value="">Select Year</option>
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">University</td>
              <td colSpan={3}>
                <select className="form-select form-select-sm" {...register('pg_university')}>
                  <option value="">Select University</option>
                  {UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Mark Statement <span className="text-danger">*</span></td>
              <td colSpan={3}>
                <div className="d-flex align-items-center gap-3">
                  <select className="form-select form-select-sm" style={{ width: 250 }} {...register('mark_statement_type')}>
                    <option>Individual Mark Statement</option><option>Consolidated Mark Statement</option>
                  </select>
                  {markType !== 'Consolidated Mark Statement' && (
                    <div className="form-check mb-0">
                      <input type="checkbox" className="form-check-input" id="await" {...register('is_awaiting_final_sem')} />
                      <label className="form-check-label" htmlFor="await">Awaiting Final Semester Marksheet</label>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Marksheets */}
        <table className="table table-bordered align-middle">
          <thead className="table-light text-center">
            <tr><th style={{ width: '30%' }}>Document</th><th>Action &amp; Preview</th></tr>
          </thead>
          <tbody>
            {markType === 'Consolidated Mark Statement' ? (
              <tr>
                <td className="fw-semibold">Consolidated Mark Sheet</td>
                <td>
                  {renderUploadControls('consolidated')}
                </td>
              </tr>
            ) : (
              <>
                {semesters.map((key, i) => (
                  <tr key={key}>
                    <td className="fw-semibold">
                      <div className="d-flex align-items-center justify-content-between">
                        <span>Semester {i + 1}</span>
                        {semesters.length > 1 && <button type="button" className="btn btn-link text-danger p-0 small text-decoration-none" onClick={() => removeSemesterRow(key)}>Remove Row</button>}
                      </div>
                    </td>
                    <td>
                      {renderUploadControls(key)}
                    </td>
                  </tr>
                ))}
                {semesters.length < 10 && (
                  <tr>
                    <td colSpan={2} className="text-center bg-light p-1">
                      <button type="button" className="btn btn-sm btn-primary py-1 px-4" onClick={addSemester}>+ Add Semester</button>
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>

        {/* Qualified Exams */}
        <div className="mt-3">
          <p className="fw-bold mb-2">Other Qualified Examinations</p>
          <div className="d-flex gap-4 flex-wrap">
            {['NET','SET','JRF','SLET'].map(exam => (
              <div key={exam} className="form-check">
                <input type="checkbox" className="form-check-input" id={exam} value={exam} {...register('qualified_exams')} />
                <label className="form-check-label fw-semibold" htmlFor={exam}>{exam}</label>
              </div>
            ))}
          </div>
        </div>

        <div className="alert alert-warning mt-4 d-flex align-items-start gap-3">
          <input type="checkbox" className="form-check-input mt-1" style={{ transform: 'scale(1.2)' }}
            {...register('declarationAccepted')} />
          <div>
            <strong>Declaration:</strong> I hereby acknowledge that the university has the authority to reject my application at any stage.
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="d-flex justify-content-center p-5"><div className="spinner-border text-secondary" /></div>;

  const steps = [Step1, Step2, Step3];

  return (
    <div className="bg-light min-vh-100 pb-5">
      <div className="container mt-4">
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/applications" onClick={e => { e.preventDefault(); navigate('/applications'); }}>Application List</a></li>
            <li className="breadcrumb-item active">Edit Application</li>
          </ol>
        </nav>

        <h4 className="fw-bold mb-4">Edit Application <small className="text-muted fs-6 fw-normal">{applicationId}</small></h4>

        {/* Progress Steps */}
        <div className="card border-0 shadow-sm rounded-4 mb-4 p-3 overflow-hidden">
          {appStatus === 'Submitted' && (
            <div className="alert alert-info py-2 px-3 mb-3 d-flex align-items-center gap-2" style={{ fontSize: '14px' }}>
              <CheckCircle size={18} className="text-success" />
              <strong>Submitted Application</strong> — Admin can still edit all fields.
            </div>
          )}
          <div className="d-flex align-items-center justify-content-between">
            {STEPS.map((s, i) => (
              <div key={i} className="d-flex align-items-center" style={{ flex: i === STEPS.length - 1 ? '0 0 auto' : '1' }}>
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                    style={{ width: 32, height: 32, background: i <= step ? '#32b5c0' : '#dee2e6', color: i <= step ? '#fff' : '#888', fontSize: 14 }}>
                    {i + 1}
                  </div>
                  <span className="d-none d-md-inline" style={{ fontSize: 13, fontWeight: i === step ? 700 : 400, color: i === step ? '#32b5c0' : '#666' }}>{s}</span>
                </div>
                {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? '#32b5c0' : '#dee2e6', margin: '0 10px' }} />}
              </div>
            ))}
          </div>
        </div>

        {steps[step]()}

        {/* Navigation */}
        <div className="d-flex justify-content-between mt-4">
          <button className="btn btn-outline-secondary px-4" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ChevronLeft size={16} className="me-1" /> Previous
          </button>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-secondary px-4 fw-bold" onClick={() => navigate('/applications')}>Cancel</button>
            <button type="button" className="btn btn-warning px-4" onClick={() => saveData('Draft')} disabled={loading}>
              <Save size={16} className="me-1" /> Save
            </button>
            {step < STEPS.length - 1 ? (
              <button className="btn px-4 text-white" style={{ background: '#32b5c0' }} onClick={handleSaveAndNext} disabled={loading}>
                Save & Next <ChevronRight size={16} className="ms-1" />
              </button>
            ) : (
              <button type="button" className="btn btn-primary px-5" onClick={() => saveData('Draft').then(ok => ok && navigate('/applications'))} disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm me-1" /> : <Send size={16} className="me-1" />}
                Save & Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminApplicationForm;
