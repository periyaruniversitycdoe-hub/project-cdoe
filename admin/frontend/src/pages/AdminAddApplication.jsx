import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import { Send, ChevronRight, ChevronLeft, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL     = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';
const STUDENT_API = (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api'; // used only for read-only dropdown/state/district lookups

const STEPS = [
  'Account Setup',
  'Personal Details',
  'Communication & Identity',
  'Academic Details',
  'Experience & Declaration',
];

const YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() - 1979 },
  (_, i) => new Date().getFullYear() - i
);

const COUNTRIES = ["Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea, North", "Korea, South", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"];

const FALLBACK_STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep", "Delhi", "Puducherry", "Ladakh", "Jammu and Kashmir"];

const RELIGIONS = ["Hindu", "Christian", "Muslim", "Sikh", "Buddhist", "Jain", "Parsi", "Other"];



const FALLBACK_GENDERS = [
  { id: 1, name: 'Male' },
  { id: 2, name: 'Female' },
  { id: 3, name: 'Transgender' }
];

const FALLBACK_COMMUNITIES = [
  { id: 1, name: 'OC - Open Category' },
  { id: 2, name: 'BC - Backward Class' },
  { id: 3, name: 'BCM - Backward Class Muslim' },
  { id: 4, name: 'MBC - Most Backward Class' },
  { id: 5, name: 'DNC - Denotified Community' },
  { id: 6, name: 'SC - Scheduled Caste' },
  { id: 7, name: 'SCA - Scheduled Caste (Arunthathiyar)' },
  { id: 8, name: 'ST - Scheduled Tribe' }
];

const FALLBACK_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode",
  "Kallakurichi", "Kancheepuram", "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet",
  "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"
];

const FALLBACK_EXAM_CENTERS = [
  { id: 1, name: 'Salem' },
  { id: 2, name: 'Chennai' },
  { id: 3, name: 'Coimbatore' },
  { id: 4, name: 'Madurai' },
  { id: 5, name: 'Trichy' }
];

const FALLBACK_SUBJECTS = [
  { id: 1, name: 'Computer Science' },
  { id: 2, name: 'English' },
  { id: 3, name: 'Mathematics' },
  { id: 4, name: 'Physics' },
  { id: 5, name: 'Commerce' },
  { id: 6, name: 'History' },
  { id: 7, name: 'Chemistry' },
  { id: 8, name: 'Tamil' }
];

const FALLBACK_CATEGORIES = [
  { id: 1, name: 'Full Time' },
  { id: 2, name: 'Part Time' }
];

const FALLBACK_EDUCATION_BOARDS = [
  { id: 1, name: 'State Board' },
  { id: 2, name: 'CBSE' },
  { id: 3, name: 'ICSE' },
  { id: 4, name: 'Matriculation' },
  { id: 5, name: 'Open School' },
  { id: 6, name: 'Others' }
];

const FALLBACK_DEGREE_TYPES = [
  { id: 1, name: 'B.Sc.', level: 'UG' },
  { id: 2, name: 'B.A.', level: 'UG' },
  { id: 3, name: 'B.Com.', level: 'UG' },
  { id: 4, name: 'B.E.', level: 'UG' },
  { id: 5, name: 'B.Tech.', level: 'UG' },
  { id: 6, name: 'M.Sc.', level: 'PG' },
  { id: 7, name: 'M.A.', level: 'PG' },
  { id: 8, name: 'M.Com.', level: 'PG' },
  { id: 9, name: 'M.E.', level: 'PG' },
  { id: 10, name: 'M.Tech.', level: 'PG' },
  { id: 11, name: 'M.Phil.', level: 'PG' }
];

const FALLBACK_UNIVERSITY_TYPES = [
  { id: 1, name: 'State University' },
  { id: 2, name: 'Central University' },
  { id: 3, name: 'Deemed University' },
  { id: 4, name: 'Private University' },
  { id: 5, name: 'Autonomous College' }
];

const FALLBACK_EMPLOYMENT_TYPES = [
  { id: 1, name: 'Regular' },
  { id: 2, name: 'Temporary' },
  { id: 3, name: 'Contract' },
  { id: 4, name: 'Part-Time' },
  { id: 5, name: 'Visiting' }
];

const FALLBACK_SPECIALIZATIONS = [
  { id: 1, name: 'Computer Science' },
  { id: 2, name: 'Mathematics' },
  { id: 3, name: 'Physics' },
  { id: 4, name: 'Chemistry' },
  { id: 5, name: 'Biology' },
  { id: 6, name: 'English' },
  { id: 7, name: 'History' },
  { id: 8, name: 'Commerce' }
];

const COUNTRY_CODES = [
  { code: '+91', name: 'India', flag: '🇮🇳' },
];

const AdminAddApplication = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [applicationId, setApplicationId] = useState(null);
  const [dropdowns, setDropdowns] = useState({});
  const [photos, setPhotos] = useState({});
  const [fileSettings, setFileSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState([]);
  const [commDistricts, setCommDistricts] = useState([]);
  const [permDistricts, setPermDistricts] = useState([]);
  const [ugSemesters,      setUgSemesters]      = useState(['ug_sem_1']);
  const [pgSemesters,      setPgSemesters]      = useState(['pg_sem_1']);
  const [diplomaSemesters, setDiplomaSemesters] = useState(['diploma_sem_1']);
  const [mphilSemesters,   setMphilSemesters]   = useState(['mphil_sem_1']);
  const [integratedSemesters, setIntegratedSemesters] = useState(['integrated_sem_1']);
  const [partTimeMapping, setPartTimeMapping] = useState({});
  const [expandedAcademicSections, setExpandedAcademicSections] = useState({
    sslc: true,
    hsc: false,
    diploma: false,
    ug: false,
    pg: false,
    mphil: false,
    integrated: false
  });
  const inputRef = useRef(null);

  const adminToken  = localStorage.getItem('adminToken');
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const { register, handleSubmit, watch, getValues, setValue, clearErrors, formState: { errors } } = useForm({
    defaultValues: {
      nationality: 'India',
      state: 'Tamil Nadu',
      religion: 'Hindu',
      is_physically_challenged: 'No',
      mobile_code: '+91',
      gender: 'Male',
      ug_mark_statement_type:      'Individual Mark Statement',
      pg_mark_statement_type:      'Individual Mark Statement',
      diploma_mark_statement_type: 'Individual Mark Statement',
      mphil_mark_statement_type:   'Individual Mark Statement',
      integrated_mark_statement_type: 'Individual Mark Statement',
      ug_is_awaiting_final_sem:      0,
      pg_is_awaiting_final_sem:      0,
      diploma_is_awaiting_final_sem: 0,
      mphil_is_awaiting_final_sem:   0,
      integrated_is_awaiting_final_sem: 0,
      has_sslc: true,
      has_hsc: true,
      has_ug: true,
      has_pg: true,
      has_diploma: false,
      has_mphil:   false,
      has_integrated: false,
      diploma: {
        level: 'Diploma', degree_id: '', specialization_id: '', institution_name: '',
        university_name: '', university_type_id: '', passing_month: '', passing_year: '',
        score_type: 'Percentage', score_value: ''
      },
      mphil: {
        level: 'M.Phil', degree_id: '', specialization_id: '', institution_name: '',
        university_name: '', university_type_id: '', passing_month: '', passing_year: '',
        score_type: 'Percentage', score_value: ''
      },
      integrated: {
        level: 'Integrated', degree_id: '', specialization_id: '', institution_name: '',
        university_name: '', university_type_id: '', passing_month: '', passing_year: '',
        score_type: 'Percentage', score_value: '', registration_number: '', upload_mode: 'Consolidated'
      },
      id_type: 'Aadhaar No',
      category: '',
      school_education: [
        { level: 'SSLC', institution_name: '', board_id: '', other_board_name: '', passing_month: '', passing_year: '', percentage: '' },
        { level: 'HSC',  institution_name: '', board_id: '', other_board_name: '', passing_month: '', passing_year: '', percentage: '' }
      ],
      higher_education: [
        { level: 'UG', degree_id: '', specialization_id: '', institution_name: '', university_name: '', university_type_id: '', passing_month: '', passing_year: '', score_type: 'Percentage', score_value: '' },
        { level: 'PG', degree_id: '', specialization_id: '', institution_name: '', university_name: '', university_type_id: '', passing_month: '', passing_year: '', score_type: 'Percentage', score_value: '' }
      ],
      experience_details: [],
    }
  });

  const category           = watch('category');
  const partTimeCategory   = watch('part_time_category');
  const center1            = watch('exam_center_1');
  const center2            = watch('exam_center_2');
  const isPhysicallyChallenged = watch('is_physically_challenged');
  const ugMarkType         = watch('ug_mark_statement_type');
  const pgMarkType         = watch('pg_mark_statement_type');
  const diplomaMarkType    = watch('diploma_mark_statement_type');
  const mphilMarkType      = watch('mphil_mark_statement_type');
  const integratedMarkType = watch('integrated_mark_statement_type');
  const hasSslc            = watch('has_sslc') !== false;
  const hasHsc             = watch('has_hsc') !== false;
  const hasUg              = watch('has_ug') !== false;
  const hasPg              = watch('has_pg') !== false;
  const hasDiploma         = watch('has_diploma') === true || watch('has_diploma') === 1 || watch('has_diploma') === '1';
  const hasMphil           = watch('has_mphil') === true || watch('has_mphil') === 1 || watch('has_mphil') === '1';
  const hasIntegrated      = watch('has_integrated') === true || watch('has_integrated') === 1 || watch('has_integrated') === '1';
  const idType             = watch('id_type');
  const commState          = watch('state');
  const permState          = watch('perm_state');
  const permSameAsComm     = watch('perm_same_as_comm');

  // Clear errors when sections are disabled
  useEffect(() => { if (!hasSslc) clearErrors('school_education.0'); }, [hasSslc, clearErrors]);
  useEffect(() => { if (!hasHsc) clearErrors('school_education.1'); }, [hasHsc, clearErrors]);
  useEffect(() => { if (!hasUg) clearErrors('higher_education.0'); }, [hasUg, clearErrors]);
  useEffect(() => { if (!hasPg) clearErrors('higher_education.1'); }, [hasPg, clearErrors]);
  useEffect(() => { if (!hasDiploma) clearErrors('diploma'); }, [hasDiploma, clearErrors]);
  useEffect(() => { if (!hasMphil) clearErrors('mphil'); }, [hasMphil, clearErrors]);
  useEffect(() => { if (!hasIntegrated) clearErrors('integrated'); }, [hasIntegrated, clearErrors]);

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

  // Load dropdowns
  useEffect(() => {
    const tables = [
      'exam_centers', 'categories', 'genders', 'communities',
      'education_boards', 'degree_types', 'university_types', 'specializations', 'employment_types',
      'mphil_courses'
    ];
    const data = {};
    Promise.all(tables.map(t =>
      axios.get(`${STUDENT_API}/dropdowns/${t}`).then(r => { data[t] = r.data; }).catch(() => {})
    )).then(() => setDropdowns(data));
  }, []);

  // Load states
  useEffect(() => {
    axios.get(`${STUDENT_API}/states`)
      .then(r => setStates(r.data.data || []))
      .catch(() => {});
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

  // Cascade: comm state → comm districts
  useEffect(() => {
    if (!commState) { setCommDistricts([]); return; }
    axios.get(`${STUDENT_API}/districts?state_name=${encodeURIComponent(commState)}`)
      .then(r => setCommDistricts(r.data.data || []))
      .catch(() => setCommDistricts(FALLBACK_DISTRICTS.map(d => ({ id: d, district_name: d }))));
  }, [commState]);

  // Cascade: perm state → perm districts
  useEffect(() => {
    if (!permState) { setPermDistricts([]); return; }
    axios.get(`${STUDENT_API}/districts?state_name=${encodeURIComponent(permState)}`)
      .then(r => setPermDistricts(r.data.data || []))
      .catch(() => {});
  }, [permState]);

  // Same as comm address
  useEffect(() => {
    if (permSameAsComm) {
      const v = getValues();
      setValue('perm_address_1', v.address_1 || '');
      setValue('perm_address_2', v.address_2 || '');
      setValue('perm_address_3', v.address_3 || '');
      setValue('perm_state',    v.state    || '');
      if (commDistricts && commDistricts.length > 0) {
        setPermDistricts([...commDistricts]);
      }
      setTimeout(() => {
        setValue('perm_district', v.district || '');
      }, 50);
      setValue('perm_pincode',  v.pincode  || '');
    }
  }, [permSameAsComm, commDistricts]);

  useEffect(() => { if (ugMarkType      === 'Consolidated Mark Statement') setValue('ug_is_awaiting_final_sem',      0); }, [ugMarkType,      setValue]);
  useEffect(() => { if (pgMarkType      === 'Consolidated Mark Statement') setValue('pg_is_awaiting_final_sem',      0); }, [pgMarkType,      setValue]);
  useEffect(() => { if (diplomaMarkType === 'Consolidated Mark Statement') setValue('diploma_is_awaiting_final_sem', 0); }, [diplomaMarkType, setValue]);
  useEffect(() => { if (mphilMarkType   === 'Consolidated Mark Statement') setValue('mphil_is_awaiting_final_sem',   0); }, [mphilMarkType,   setValue]);
  useEffect(() => { if (category !== 'Part Time') setValue('working_district', ''); }, [category, setValue]);

  // Auto-sync mark statement type selection based on active settings
  useEffect(() => {
    ['ug', 'pg', 'integrated'].forEach(level => {
      const sKey = level === 'ug' ? 'UG Degree Documents' : level === 'pg' ? 'PG Degree Documents' : '5-Year Integrated Course';
      const setting = fileSettings[sKey];
      if (setting) {
        const isCons = setting.consolidated_enabled !== 0;
        const isSem = setting.semester_wise_enabled !== 0;
        const currentType = watch(`${level}_mark_statement_type`);
        if (!isCons && isSem && currentType !== 'Individual Mark Statement') {
          setValue(`${level}_mark_statement_type`, 'Individual Mark Statement');
        } else if (isCons && !isSem && currentType !== 'Consolidated Mark Statement') {
          setValue(`${level}_mark_statement_type`, 'Consolidated Mark Statement');
        }
      }
    });
  }, [fileSettings, setValue, watch]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleAlphaInput = (e) => {
    e.target.value = e.target.value.replace(/[^A-Za-z஀-௿\s]/g, '');
  };
  const handleCapsAlphaInput = (e) => {
    e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '').toUpperCase();
  };
  const handleNumericInput = (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  };
  const handleAadhaarInput = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 12) value = value.slice(0, 12);
    e.target.value = value.match(/.{1,4}/g)?.join(' ') || value;
  };

  const removeFile = (key) => {
    setPhotos(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const getUploadIntimation = (key) => {
    const typeMap = {
      photo:          'Photo',
      signature:      'Signature',
      id_proof:       'ID Proof',
      community_cert: 'Community Certificate',
      pc_cert:        'PC Certificate',
      sslc_marksheet: '10th Standard Marksheet',
      hsc_marksheet:  '12th Standard Marksheet',
      ug_marksheet:   'UG Degree Documents',
      pg_marksheet:   'PG Degree Documents',
      ug_consolidated: 'UG Degree Documents',
      pg_consolidated: 'PG Degree Documents',
      diploma_marksheet: 'Mark Sheet',
      diploma_consolidated: 'Mark Sheet',
      mphil_marksheet: 'Mark Sheet',
      mphil_consolidated: 'Mark Sheet',
      integrated_marksheet: '5-Year Integrated Course',
      integrated_consolidated: '5-Year Integrated Course',
    };
    
    let settingKey = typeMap[key];
    if (!settingKey) {
      if (key.startsWith('ug_sem_')) {
        settingKey = 'UG Degree Documents';
      } else if (key.startsWith('pg_sem_')) {
        settingKey = 'PG Degree Documents';
      } else if (key.startsWith('integrated_sem_')) {
        settingKey = '5-Year Integrated Course';
      } else if (key.startsWith('diploma_sem_') || key.startsWith('mphil_sem_')) {
        settingKey = 'Mark Sheet';
      } else if (key.startsWith('exp_cert_') || key.startsWith('qual_cert_')) {
        return 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 2 MB';
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
      '10th Standard Marksheet': 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 2 MB',
      '12th Standard Marksheet': 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 2 MB',
      'UG Degree Documents': 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 2 MB',
      'PG Degree Documents': 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 2 MB',
    };

    return fallbacks[settingKey] || 'Allowed: JPG, JPEG, PNG, PDF | Max Size: 2 MB';
  };

  const isSequentialUploadDisabled = (key) => {
    if (!key.includes('_sem_')) return false;
    const parts = key.split('_sem_');
    const prefix = parts[0];
    const semNum = parseInt(parts[1]);
    if (semNum === 1) return false;
    
    // Check if previous semester file exists
    const prevKey = `${prefix}_sem_${semNum - 1}`;
    return !photos[prevKey];
  };

  const renderUploadControls = (key, disabled = false) => {
    const typeMap = {
      photo:          'Photo',
      signature:      'Signature',
      id_proof:       'ID Proof',
      community_cert: 'Community Certificate',
      pc_cert:        'PC Certificate',
      sslc_marksheet: '10th Standard Marksheet',
      hsc_marksheet:  '12th Standard Marksheet',
      ug_marksheet:   'UG Degree Documents',
      pg_marksheet:   'PG Degree Documents',
      ug_consolidated: 'UG Degree Documents',
      pg_consolidated: 'PG Degree Documents',
      diploma_marksheet: 'Mark Sheet',
      diploma_consolidated: 'Mark Sheet',
      mphil_marksheet: 'Mark Sheet',
      mphil_consolidated: 'Mark Sheet',
      integrated_marksheet: '5-Year Integrated Course',
      integrated_consolidated: '5-Year Integrated Course',
    };
    let settingKey = typeMap[key];
    if (!settingKey) {
      if (key.startsWith('ug_sem_')) settingKey = 'UG Degree Documents';
      else if (key.startsWith('pg_sem_')) settingKey = 'PG Degree Documents';
      else if (key.startsWith('integrated_sem_')) settingKey = '5-Year Integrated Course';
      else if (key.startsWith('diploma_sem_') || key.startsWith('mphil_sem_')) settingKey = 'Mark Sheet';
    }
    const setting = settingKey ? fileSettings[settingKey] : null;
    if (setting && setting.is_active === 0) {
      return null; // Hide upload control completely if inactive
    }

    const fileData = photos[key];
    const intimation = getUploadIntimation(key);
    const isDisabled = disabled || isSequentialUploadDisabled(key);
    
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
              className={`btn btn-sm ${isDisabled ? 'btn-light disabled text-muted' : 'btn-secondary'} px-3 d-inline-flex align-items-center justify-content-center`}
              style={{ cursor: isDisabled ? 'default' : 'pointer', width: 'fit-content', fontSize: '12px', height: '32px' }}
            >
              Upload File
              <input
                type="file"
                hidden
                accept={key === 'photo' || key === 'signature' ? 'image/*' : 'image/*,.pdf'}
                onChange={e => handleFileChange(e, key)}
                disabled={isDisabled}
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

  const getSemState = (semLevel) => {
    if (semLevel === 'ug')      return [ugSemesters,      setUgSemesters];
    if (semLevel === 'pg')      return [pgSemesters,      setPgSemesters];
    if (semLevel === 'diploma') return [diplomaSemesters, setDiplomaSemesters];
    if (semLevel === 'integrated') return [integratedSemesters, setIntegratedSemesters];
    return                             [mphilSemesters,   setMphilSemesters];
  };

  const addSemester = (semLevel) => {
    const [arr, setter] = getSemState(semLevel);
    const prefix = `${semLevel}_sem_`;
    const keys   = arr.filter(k => k.startsWith(prefix));
    
    // Check max semesters limit
    const settingKey = semLevel === 'ug' ? 'UG Degree Documents' : semLevel === 'pg' ? 'PG Degree Documents' : '5-Year Integrated Course';
    const setting = fileSettings[settingKey];
    const maxSems = (setting && setting.max_semesters) ? setting.max_semesters : 10;
    if (keys.length >= maxSems) return;

    const maxNum = keys.reduce((max, k) => Math.max(max, parseInt(k.split('_').pop())), 0);
    setter(prev => [...prev, `${prefix}${maxNum + 1}`]);
  };

  const removeSemesterRow = (key, semLevel) => {
    const [arr, setter] = getSemState(semLevel);
    const prefix = `${semLevel}_sem_`;
    if (arr.filter(k => k.startsWith(prefix)).length <= 1) return;
    
    // Enforce sequential removal: can only remove the last semester row
    const parts = key.split('_sem_');
    const semNum = parseInt(parts[1]);
    const maxNum = arr.reduce((max, k) => Math.max(max, parseInt(k.split('_').pop())), 0);
    if (semNum !== maxNum) {
      toast.error('Please remove semesters in reverse sequential order (starting from the last one)');
      return;
    }

    setter(prev => prev.filter(k => k !== key));
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
      sslc_marksheet: '10th Standard Marksheet',
      hsc_marksheet:  '12th Standard Marksheet',
      ug_marksheet:   'UG Degree Documents',
      pg_marksheet:   'PG Degree Documents',
      ug_consolidated: 'UG Degree Documents',
      pg_consolidated: 'PG Degree Documents',
      diploma_marksheet: 'Mark Sheet',
      diploma_consolidated: 'Mark Sheet',
      mphil_marksheet: 'Mark Sheet',
      mphil_consolidated: 'Mark Sheet',
      integrated_marksheet: '5-Year Integrated Course',
      integrated_consolidated: '5-Year Integrated Course',
    };
    
    let settingKey = typeMap[key];
    if (!settingKey) {
      if (key.startsWith('ug_sem_')) {
        settingKey = 'UG Degree Documents';
      } else if (key.startsWith('pg_sem_')) {
        settingKey = 'PG Degree Documents';
      } else if (key.startsWith('integrated_sem_')) {
        settingKey = '5-Year Integrated Course';
      } else if (key.startsWith('diploma_sem_') || key.startsWith('mphil_sem_')) {
        settingKey = 'Mark Sheet';
      } else {
        settingKey = 'Mark Sheet';
      }
    }
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

    setPhotos(prev => ({ ...prev, [key]: { file, preview: URL.createObjectURL(file) } }));
  };

  const stateOptions = () =>
    (states.length > 0 ? states : FALLBACK_STATES.map(s => ({ id: s, state_name: s })))
      .map(s => <option key={s.id} value={s.state_name}>{s.state_name}</option>);

  const districtOptions = (districts) =>
    districts.length > 0
      ? districts.map(d => <option key={d.id} value={d.district_name}>{d.district_name}</option>)
      : FALLBACK_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>);

  // ── Account creation (Step 0 submit) ─────────────────────────────────────
  const handleCreateAccount = async () => {
    const { acct_full_name, acct_email, acct_password, acct_confirm } = getValues();
    if (!acct_full_name?.trim() || !acct_email?.trim() || !acct_password?.trim()) {
      toast.error('Please fill in all required fields'); return;
    }
    if (acct_password !== acct_confirm) {
      toast.error('Passwords do not match'); return;
    }
    if (acct_password.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/applications/add`,
        { full_name: acct_full_name, email: acct_email, password: acct_password },
        { headers: adminHeaders }
      );
      setApplicationId(res.data.applicationId);
      setValue('email_id', acct_email);
      toast.success(`Account created! Application ID: ${res.data.applicationId}`);
      setStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create account');
    } finally { setLoading(false); }
  };

  // ── Build FormData ────────────────────────────────────────────────────────
  const buildFormData = (status = 'Draft') => {
    const data = { ...getValues() };
    const formData = new FormData();
    const nestedFields = ['school_education', 'higher_education', 'experience_details', 'qualified_exams'];
    nestedFields.forEach(field => {
      if (data[field] !== undefined) {
        formData.append(field, JSON.stringify(data[field]));
        delete data[field];
      }
    });
    Object.entries(data).forEach(([k, v]) => {
      if (v != null && k !== 'status' && k !== 'declarationAccepted' && !k.startsWith('acct_')) {
        const val = (Array.isArray(v) || (typeof v === 'object' && v !== null)) ? JSON.stringify(v) : v;
        formData.append(k, val);
      }
    });
    Object.entries(photos).forEach(([k, v]) => {
      if (v.file) formData.append(k, v.file);
    });
    formData.set('status', status);
    formData.set('application_id', applicationId);
    return formData;
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveData = async (status = 'Draft') => {
    if (!applicationId) return false;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/applications/save-admin`, buildFormData(status), {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${adminToken}` }
      });
      toast.success('Progress saved!');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving. Please try again.');
      return false;
    } finally { setLoading(false); }
  };

  const handleSaveAndNext = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/applications/save-admin`, buildFormData('Draft'), {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${adminToken}` }
      });
      toast.success('Step saved!');
      setStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed. Please try again.');
    } finally { setLoading(false); }
  };

  // ── STEP 0: Account Setup ─────────────────────────────────────────────────
  const Step0 = (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
        <h5 className="mb-0 fw-bold">Account Setup</h5>
      </div>
      <div className="card-body p-4" style={{ maxWidth: 560 }}>
        <p className="text-muted mb-4" style={{ fontSize: 13 }}>
          Create a student login account first. The system will generate a unique Application ID automatically.
        </p>
        <div className="mb-3">
          <label className="form-label fw-semibold">Full Name <span className="text-danger">*</span></label>
          <input type="text" className="form-control" placeholder="Student's full name"
            {...register('acct_full_name')} onInput={handleAlphaInput} />
        </div>
        <div className="mb-3">
          <label className="form-label fw-semibold">Email Address <span className="text-danger">*</span></label>
          <input type="email" className="form-control" placeholder="student@example.com"
            {...register('acct_email')} />
        </div>
        <div className="mb-3">
          <label className="form-label fw-semibold">Password <span className="text-danger">*</span></label>
          <input type="password" className="form-control" placeholder="Min 6 characters"
            {...register('acct_password')} />
        </div>
        <div className="mb-4">
          <label className="form-label fw-semibold">Confirm Password <span className="text-danger">*</span></label>
          <input type="password" className="form-control" placeholder="Re-enter password"
            {...register('acct_confirm')} />
        </div>
        <button className="btn btn-primary px-5 fw-bold" onClick={handleCreateAccount} disabled={loading}>
          {loading
            ? <><span className="spinner-border spinner-border-sm me-2" />Creating...</>
            : 'Create Account & Continue →'}
        </button>
      </div>
    </div>
  );

  // ── STEP 1: Personal Details ──────────────────────────────────────────────
  const Step1 = (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
        <h5 className="mb-0 fw-bold">+ Add New Application</h5>
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
              <td className="text-end fw-semibold bg-light">Exam Center Preference 2 <span className="text-danger">*</span></td>
              <td>
                <select className="form-select form-select-sm" {...register('exam_center_2')}>
                  <option value="">Select</option>
                  {(dropdowns.exam_centers || FALLBACK_EXAM_CENTERS).filter(i => i.name !== center1).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
              </td>
              <td rowSpan={8} className="text-center align-top py-3" style={{ width: '180px' }}>
                <div className="mb-4">
                  <div className="border d-flex align-items-center justify-content-center mx-auto rounded" style={{ width: '100px', height: '120px', background: '#f8f9fa', overflow: 'hidden' }}>
                    {photos.photo ? <img src={photos.photo.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="photo" /> : <small className="text-muted">Photo</small>}
                  </div>
                  {renderUploadControls('photo')}
                  <small className="text-muted d-block mt-1 fw-bold" style={{ fontSize: '10px' }}>Applicant's Photo</small>
                </div>
                <div className="mt-4 pt-4 border-top">
                  <div className="border d-flex align-items-center justify-content-center mx-auto rounded" style={{ width: '120px', height: '60px', background: '#f8f9fa', overflow: 'hidden' }}>
                    {photos.signature ? <img src={photos.signature.preview} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="signature" /> : <small className="text-muted">Signature</small>}
                  </div>
                  {renderUploadControls('signature')}
                  <small className="text-muted d-block mt-1 fw-bold" style={{ fontSize: '10px' }}>Applicant's Signature</small>
                </div>
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Subject/Discipline for registration <span className="text-danger">*</span></td>
              <td>
                <select className="form-select form-select-sm" {...register('subject')}>
                  <option value="">Select</option>
                  {(dropdowns.subjects || FALLBACK_SUBJECTS).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
              </td>
              <td colSpan="2"></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Category under which registration is sought <span className="text-danger">*</span></td>
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
                    {districtOptions(commDistricts)}
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
              <td className="text-end fw-semibold bg-light text-danger">Date of Birth <span className="text-danger">*</span><br /><small>(dd/mm/yyyy)</small></td>
              <td><input type="date" className="form-control form-control-sm" {...register('dob')} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">விண்ணப்பதாரரின் பெயர் <br /><small className="text-muted">(தமிழ் எழுத்துக்களில்)</small></td>
              <td><input type="text" className="form-control form-control-sm" placeholder="பெயரை தமிழில் உள்ளிடவும்" {...register('applicant_name_tamil')} onInput={handleAlphaInput} /></td>
              <td className="bg-light"></td>
              <td></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Nationality <span className="text-danger">*</span></td>
              <td>
                <div className="d-flex align-items-center gap-3">
                  <select className="form-select form-select-sm" style={{ width: '180px' }} {...register('nationality')}>
                    <option value="">Select Nationality</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <label className="fw-semibold mb-0">Religion</label>
                  <select className="form-select form-select-sm" style={{ width: '150px' }} {...register('religion')}>
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
                <select className="form-select form-select-sm" style={{ width: '250px' }} {...register('gender', { required: true })}>
                  <option value="">Select Gender</option>
                  {(dropdowns.genders || FALLBACK_GENDERS).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
                {errors.gender && <small className="text-danger d-block">Required</small>}
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
                {errors.community && <small className="text-danger d-block mt-1">Please select your community</small>}
              </td>
              <td></td><td></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Parent / Husband / Guardian Name <span className="text-danger">*</span></td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" {...register('parent_name')} onInput={handleCapsAlphaInput} style={{ textTransform: 'uppercase' }} /></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── STEP 2: Communication & Identity ─────────────────────────────────────
  const Step2 = (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
        <h5 className="mb-0 fw-bold">Communication & Identity Details</h5>
      </div>
      <div className="card-body p-4">
        {/* Communication Address */}
        <p className="fw-bold text-secondary mb-2" style={{ fontSize: '13px' }}>Communication Address</p>
        <table className="table table-bordered align-middle mb-4">
          <tbody>
            <tr>
              <td className="text-end fw-semibold bg-light" style={{ width: '28%' }}>Address for Communication <span className="text-danger">*</span><br /><small>(Line 1)</small></td>
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
                <select className="form-select form-select-sm" {...register('state')}>
                  <option value="">Select State</option>
                  {stateOptions()}
                </select>
              </td>
              <td className="text-end fw-semibold bg-light">District <span className="text-danger">*</span></td>
              <td>
                <select className="form-select form-select-sm" {...register('district', { required: true })}>
                  <option value="">Select District</option>
                  {districtOptions(commDistricts)}
                </select>
                {errors.district && <small className="text-danger d-block">Required</small>}
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Pincode <span className="text-danger">*</span></td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" style={{ width: '150px' }} maxLength={6} {...register('pincode')} onInput={handleNumericInput} /></td>
            </tr>
          </tbody>
        </table>

        {/* Permanent Address */}
        <div className="d-flex align-items-center justify-content-between mb-2">
          <p className="fw-bold text-secondary mb-0" style={{ fontSize: '13px' }}>Permanent Address</p>
          <div className="form-check mb-0">
            <input type="checkbox" className="form-check-input" id="permSameAsComm" {...register('perm_same_as_comm')} />
            <label className="form-check-label fw-semibold" htmlFor="permSameAsComm" style={{ fontSize: '13px' }}>
              Same as Communication Address
            </label>
          </div>
        </div>
        <table className="table table-bordered align-middle mb-4">
          <tbody>
            <tr>
              <td className="text-end fw-semibold bg-light" style={{ width: '28%' }}>Permanent Address <span className="text-danger">*</span><br /><small>(Line 1)</small></td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" {...register('perm_address_1')} disabled={!!permSameAsComm} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Line 2</td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" {...register('perm_address_2')} disabled={!!permSameAsComm} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Line 3</td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" {...register('perm_address_3')} disabled={!!permSameAsComm} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">State <span className="text-danger">*</span></td>
              <td>
                <select className="form-select form-select-sm" {...register('perm_state')} disabled={!!permSameAsComm}>
                  <option value="">Select State</option>
                  {stateOptions()}
                </select>
              </td>
              <td className="text-end fw-semibold bg-light">District <span className="text-danger">*</span></td>
              <td>
                <select className="form-select form-select-sm" {...register('perm_district')} disabled={!!permSameAsComm}>
                  <option value="">Select District</option>
                  {districtOptions(permDistricts)}
                </select>
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">Pincode <span className="text-danger">*</span></td>
              <td colSpan={3}><input type="text" className="form-control form-control-sm" style={{ width: '150px' }} maxLength={6} {...register('perm_pincode')} disabled={!!permSameAsComm} onInput={handleNumericInput} /></td>
            </tr>
          </tbody>
        </table>

        {/* Contact & Identity */}
        <p className="fw-bold text-secondary mb-2" style={{ fontSize: '13px' }}>Contact & Identity</p>
        <table className="table table-bordered align-middle mb-0">
          <tbody>
            <tr>
              <td className="text-end fw-semibold bg-light" style={{ width: '28%' }}>Mobile No. <span className="text-danger">*</span></td>
              <td>
                <div className="d-flex align-items-center gap-2">
                  <select className="form-select form-select-sm" style={{ width: '130px' }} {...register('mobile_code')}>
                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>)}
                  </select>
                  <input type="text" className="form-control form-control-sm" maxLength={10} {...register('mobile')} onInput={handleNumericInput} />
                </div>
              </td>
              <td className="text-end fw-semibold bg-light">Phone No.(LL)</td>
              <td><input type="text" className="form-control form-control-sm" {...register('phone')} onInput={handleNumericInput} /></td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light">E-mail ID <span className="text-danger">*</span></td>
              <td colSpan={3}>
                <input type="email" className="form-control form-control-sm bg-white" style={{ width: '300px' }} {...register('email_id')} />
              </td>
            </tr>
            <tr>
              <td className="text-end fw-semibold bg-light text-warning">Select ID <span className="text-danger">*</span><br /><small className="text-warning">(Aadhaar / Voter / Passport)</small></td>
              <td colSpan={3}>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <select className="form-select form-select-sm" style={{ width: '160px' }} {...register('id_type')}>
                    <option>Aadhaar No</option>
                    <option>Voter ID</option>
                    <option>Passport</option>
                  </select>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ width: '200px' }}
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
                  <select className="form-select form-select-sm" style={{ width: '100px' }} {...register('is_physically_challenged')}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                  {isPhysicallyChallenged === 'Yes' && (
                    <>
                      <label className="fw-semibold mb-0">Percentage (%)</label>
                      <input type="text" className="form-control form-control-sm" style={{ width: '80px' }} {...register('pc_percentage')} onInput={handleNumericInput} placeholder="%" />
                      <label className="fw-semibold mb-0">Type of Challenge</label>
                      <select className="form-select form-select-sm" style={{ width: '180px' }} {...register('pc_type')}>
                        <option value="">Select Type</option>
                        <option value="Visual">Visual</option>
                        <option value="Hearing">Hearing</option>
                        <option value="Orthopedic">Orthopedic</option>
                        <option value="Locomotor">Locomotor</option>
                        <option value="Other">Other</option>
                      </select>
                      <div className="flex-grow-1">
                        {renderUploadControls('pc_cert')}
                      </div>
                    </>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── STEP 3: Academic Details ──────────────────────────────────────────────
  const renderEducationRow = (prefix, label, level, isRequired = true) => {
    const boardId = watch(`${prefix}.board_id`);
    const rules = isRequired ? { required: 'This field is required' } : {};
    
    const getFieldError = (fieldName) => {
      const parts = `${prefix}.${fieldName}`.split('.');
      return parts.reduce((acc, part) => acc?.[part], errors);
    };

    const renderError = (fieldName) => {
      const error = getFieldError(fieldName);
      return error ? <div className="text-danger mt-1" style={{ fontSize: '11px' }}>{error.message}</div> : null;
    };

    return (
      <div className="mb-4 pb-3 border-bottom text-start" key={prefix}>
        <input type="hidden" value={level} {...register(`${prefix}.level`)} />
        <div className="d-flex align-items-center gap-2 mb-3">
          <h6 className="fw-bold text-secondary mb-0">{label}</h6>
          {isRequired && <span className="badge bg-danger-subtle text-danger px-2 py-0.5" style={{ fontSize: '10px' }}>Mandatory</span>}
        </div>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label small fw-bold">Institution Name {isRequired && <span className="text-danger">*</span>}</label>
            <input type="text" className={`form-control form-control-sm ${getFieldError('institution_name') ? 'is-invalid' : ''}`} 
              {...register(`${prefix}.institution_name`, rules)} />
            {renderError('institution_name')}
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-bold">Board {isRequired && <span className="text-danger">*</span>}</label>
            <select className={`form-select form-select-sm ${getFieldError('board_id') ? 'is-invalid' : ''}`} 
              {...register(`${prefix}.board_id`, rules)}>
              <option value="">Select Board</option>
              {(dropdowns.education_boards || FALLBACK_EDUCATION_BOARDS).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {renderError('board_id')}
            {(dropdowns.education_boards || FALLBACK_EDUCATION_BOARDS).find(b => b.id == boardId)?.name === 'Others' && (
              <div className="mt-2">
                <input type="text" className={`form-control form-control-sm ${getFieldError('other_board_name') ? 'is-invalid' : ''}`} 
                  placeholder="Enter Board Name" {...register(`${prefix}.other_board_name`, rules)} />
                {renderError('other_board_name')}
              </div>
            )}
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-bold">Passing Month {isRequired && <span className="text-danger">*</span>}</label>
            <select className={`form-select form-select-sm ${getFieldError('passing_month') ? 'is-invalid' : ''}`} 
              {...register(`${prefix}.passing_month`, rules)}>
              <option value="">Month</option>
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {renderError('passing_month')}
          </div>
          <div className="col-md-1">
            <label className="form-label small fw-bold">Year {isRequired && <span className="text-danger">*</span>}</label>
            <select className={`form-select form-select-sm ${getFieldError('passing_year') ? 'is-invalid' : ''}`} 
              {...register(`${prefix}.passing_year`, rules)}>
              <option value="">Year</option>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {renderError('passing_year')}
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-bold">Percentage {isRequired && <span className="text-danger">*</span>}</label>
            <input type="number" step="0.01" className={`form-control form-control-sm ${getFieldError('percentage') ? 'is-invalid' : ''}`} 
              {...register(`${prefix}.percentage`, rules)} />
            {renderError('percentage')}
          </div>
          <div className="col-md-12">
            {renderUploadControls(`${prefix}_marksheet`)}
          </div>
        </div>
      </div>
    );
  };

  const renderHigherEdRow = (prefix, label, semLevel, degreeLevel, isRequired = true) => {
    const semArr   = semLevel === 'ug' ? ugSemesters : semLevel === 'pg' ? pgSemesters
                   : semLevel === 'diploma' ? diplomaSemesters : semLevel === 'integrated' ? integratedSemesters : mphilSemesters;
    const markType = semLevel === 'ug' ? ugMarkType  : semLevel === 'pg' ? pgMarkType
                   : semLevel === 'diploma' ? diplomaMarkType  : semLevel === 'integrated' ? integratedMarkType : mphilMarkType;
    const filterLevel = degreeLevel || label.split(' ')[0];
    const semPrefix = `${semLevel}_sem_`;
    const semKeys   = semArr.filter(k => k.startsWith(semPrefix));

    const rules = isRequired ? { required: 'This field is required' } : {};

    const getAcademicSettingsKey = (semLvl) => {
      if (semLvl === 'ug') return 'UG Degree Documents';
      if (semLvl === 'pg') return 'PG Degree Documents';
      if (semLvl === 'integrated') return '5-Year Integrated Course';
      return null;
    };
    const sKey = getAcademicSettingsKey(semLevel);
    const activeSetting = sKey ? fileSettings[sKey] : null;
    const isAcademicActive = !activeSetting || activeSetting.is_active !== 0;
    const isConsAllowed = !activeSetting || activeSetting.consolidated_enabled !== 0;
    const isSemAllowed = !activeSetting || activeSetting.semester_wise_enabled !== 0;
    const maxSems = activeSetting?.max_semesters || 10;
    
    const getFieldError = (fieldName) => {
      const parts = `${prefix}.${fieldName}`.split('.');
      return parts.reduce((acc, part) => acc?.[part], errors);
    };

    const renderError = (fieldName) => {
      const error = getFieldError(fieldName);
      return error ? <div className="text-danger mt-1" style={{ fontSize: '11px' }}>{error.message}</div> : null;
    };

    return (
      <div className="mb-4 pb-3 border-bottom text-start" key={prefix}>
        <input type="hidden" value={degreeLevel || label.split(' ')[0]} {...register(`${prefix}.level`)} />
        <div className="d-flex align-items-center gap-2 mb-3">
          <h6 className="fw-bold text-secondary mb-0">{label}</h6>
          {isRequired && <span className="badge bg-danger-subtle text-danger px-2 py-0.5" style={{ fontSize: '10px' }}>Mandatory</span>}
        </div>
        <div className="row g-3">
          {semLevel === 'mphil' ? (
            /* ── M.Phil centralized Course Master dropdown ── */
            <div className="col-md-6">
              <label className="form-label small fw-bold">M.Phil Course {isRequired && <span className="text-danger">*</span>}</label>
              <select className={`form-select form-select-sm ${getFieldError('degree_name') ? 'is-invalid' : ''}`} 
                {...register(`${prefix}.degree_name`, rules)}>
                <option value="">Select M.Phil Course</option>
                {(dropdowns.mphil_courses || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              {renderError('degree_name')}
            </div>
          ) : (
            <>
              <div className="col-md-3">
                <label className="form-label small fw-bold">Degree {isRequired && <span className="text-danger">*</span>}</label>
                <select className={`form-select form-select-sm ${getFieldError('degree_id') ? 'is-invalid' : ''}`} 
                  {...register(`${prefix}.degree_id`, rules)}>
                  <option value="">Select Degree</option>
                  {(dropdowns.degree_types || FALLBACK_DEGREE_TYPES).filter(d => !filterLevel || d.level === filterLevel).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {renderError('degree_id')}
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-bold">Specialization {isRequired && <span className="text-danger">*</span>}</label>
                <select className={`form-select form-select-sm ${getFieldError('specialization_id') ? 'is-invalid' : ''}`} 
                  {...register(`${prefix}.specialization_id`, rules)}>
                  <option value="">Select Specialization</option>
                  {(dropdowns.specializations || FALLBACK_SPECIALIZATIONS).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {renderError('specialization_id')}
              </div>
            </>
          )}
          <div className="col-md-3">
            <label className="form-label small fw-bold">Institution Name {isRequired && <span className="text-danger">*</span>}</label>
            <input type="text" className={`form-control form-control-sm ${getFieldError('institution_name') ? 'is-invalid' : ''}`} 
              {...register(`${prefix}.institution_name`, rules)} />
            {renderError('institution_name')}
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-bold">University Name {isRequired && <span className="text-danger">*</span>}</label>
            <input type="text" className={`form-control form-control-sm ${getFieldError('university_name') ? 'is-invalid' : ''}`} 
              {...register(`${prefix}.university_name`, rules)} />
            {renderError('university_name')}
          </div>
          {degreeLevel === 'Integrated' && (
            <div className="col-md-3">
              <label className="form-label small fw-bold">Registration Number {isRequired && <span className="text-danger">*</span>}</label>
              <input type="text" className={`form-control form-control-sm ${getFieldError('registration_number') ? 'is-invalid' : ''}`}
                {...register(`${prefix}.registration_number`, rules)} />
              {renderError('registration_number')}
            </div>
          )}
          <div className="col-md-3">
            <label className="form-label small fw-bold">University Type {isRequired && <span className="text-danger">*</span>}</label>
            <select className={`form-select form-select-sm ${getFieldError('university_type_id') ? 'is-invalid' : ''}`} 
              {...register(`${prefix}.university_type_id`, rules)}>
              <option value="">Select Type</option>
              {(dropdowns.university_types || FALLBACK_UNIVERSITY_TYPES).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {renderError('university_type_id')}
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-bold">Passing Month {isRequired && <span className="text-danger">*</span>}</label>
            <select className={`form-select form-select-sm ${getFieldError('passing_month') ? 'is-invalid' : ''}`} 
              {...register(`${prefix}.passing_month`, rules)}>
              <option value="">Month</option>
              {["January","February","March","April","May","June","July","August","September","October","November","December"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {renderError('passing_month')}
          </div>
          <div className="col-md-1">
            <label className="form-label small fw-bold">Year {isRequired && <span className="text-danger">*</span>}</label>
            <select className={`form-select form-select-sm ${getFieldError('passing_year') ? 'is-invalid' : ''}`} 
              {...register(`${prefix}.passing_year`, rules)}>
              <option value="">Year</option>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {renderError('passing_year')}
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-bold">Score {isRequired && <span className="text-danger">*</span>}</label>
            <div className="input-group input-group-sm">
              <select className="form-select p-1" style={{ maxWidth: '80px' }} {...register(`${prefix}.score_type`)}>
                <option>Percentage</option><option>CGPA</option>
              </select>
              <input type="number" step="0.01" className={`form-control ${getFieldError('score_value') ? 'is-invalid' : ''}`} 
                {...register(`${prefix}.score_value`, rules)} />
            </div>
            {renderError('score_value')}
          </div>

          {/* ── Mark Statement Documents ── */}
          {isAcademicActive && (
            <div className="col-md-12 border-top pt-3 mt-1">
              <div className="fw-semibold small text-primary mb-2">Mark Statement Documents</div>

              {isConsAllowed && isSemAllowed && (
                <div className="d-flex align-items-center gap-4 mb-3">
                  <span className="fw-semibold small text-secondary">Type:</span>
                  {['Individual Mark Statement', 'Consolidated Mark Statement'].map(type => (
                    <div key={type} className="form-check mb-0">
                      <input type="radio" className="form-check-input"
                        id={`${semLevel}_mst_${type}`} value={type}
                        {...register(`${semLevel}_mark_statement_type`)} />
                      <label className="form-check-label small fw-semibold" htmlFor={`${semLevel}_mst_${type}`}>{type}</label>
                    </div>
                  ))}
                </div>
              )}

              {/* Individual mode */}
              {markType !== 'Consolidated Mark Statement' && isSemAllowed && (
                <div>
                  <div className="form-check mb-2">
                    <input type="checkbox" className="form-check-input" id={`${semLevel}_awaiting`}
                      {...register(`${semLevel}_is_awaiting_final_sem`)} />
                    <label className="form-check-label small fw-semibold text-warning" htmlFor={`${semLevel}_awaiting`}>
                      I am awaiting my final semester results (mark sheet will be submitted later)
                    </label>
                  </div>

                  <div className="border rounded-3 mb-2" style={{ fontSize: 13 }}>
                    <div className="bg-light p-2 fw-bold d-none d-md-flex">
                      <div style={{ width: 120 }} className="text-center">Semester</div>
                      <div className="flex-grow-1">Document & Actions</div>
                      <div style={{ width: 180 }} className="text-center">Row Control</div>
                    </div>
                    <div className="list-group list-group-flush">
                      {semKeys.map((key, idx) => (
                        <div key={key} className="list-group-item p-2">
                          <div className="row g-2 align-items-center">
                            <div className="col-12 col-md-2 text-md-center fw-semibold">Semester {idx + 1}</div>
                            <div className="col-12 col-md-7">
                              {renderUploadControls(key)}
                            </div>
                            <div className="col-12 col-md-3 text-md-end">
                              {semKeys.length > 1 && (
                                <button type="button" className="btn btn-sm btn-outline-danger"
                                  onClick={() => removeSemesterRow(key, semLevel)} style={{ fontSize: 12 }}>Remove Row</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-3">
                    {semKeys.length < maxSems && (
                      <button type="button" className="btn btn-sm btn-outline-success"
                        onClick={() => addSemester(semLevel)}>+ Add Next Semester</button>
                    )}
                    <small className="text-muted">{semKeys.length}/{maxSems} semesters</small>
                  </div>
                </div>
              )}

              {/* Consolidated mode */}
              {markType === 'Consolidated Mark Statement' && isConsAllowed && (
                <div className="border p-3 rounded-3" style={{ fontSize: 13 }}>
                  <div className="row g-2 align-items-center">
                    <div className="col-12 col-md-3 fw-semibold">Consolidated Mark Sheet</div>
                    <div className="col-12 col-md-9">
                      {renderUploadControls(`${semLevel}_consolidated`)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const sslcVal = watch('school_education.0') || {};
  const isSslcComplete = !!(sslcVal.institution_name?.trim() && sslcVal.board_id && sslcVal.passing_month && sslcVal.passing_year && sslcVal.percentage);

  const hscVal = watch('school_education.1') || {};
  const isHscComplete = !!(hscVal.institution_name?.trim() && hscVal.board_id && hscVal.passing_month && hscVal.passing_year && hscVal.percentage);

  const diplomaVal = watch('diploma') || {};
  const isDiplomaComplete = !!(diplomaVal.institution_name?.trim() && diplomaVal.degree_id && diplomaVal.passing_month && diplomaVal.passing_year && diplomaVal.score_value);

  const ugVal = watch('higher_education.0') || {};
  const isUgComplete = !!(ugVal.institution_name?.trim() && ugVal.degree_id && ugVal.passing_month && ugVal.passing_year && ugVal.score_value);

  const pgVal = watch('higher_education.1') || {};
  const isPgComplete = !!(pgVal.institution_name?.trim() && pgVal.degree_id && pgVal.passing_month && pgVal.passing_year && pgVal.score_value);

  const mphilVal = watch('mphil') || {};
  const isMphilComplete = !!(mphilVal.institution_name?.trim() && mphilVal.degree_name && mphilVal.passing_month && mphilVal.passing_year && mphilVal.score_value);

  const Step3 = (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
        <h5 className="mb-0 fw-bold">Academic Details</h5>
      </div>
      <div className="card-body p-4">
        <div className="alert alert-info py-2 small mb-4 d-flex align-items-center gap-2">
          <span style={{ fontSize: '16px' }}>📌</span>
          <span><strong>Interactive Panel:</strong> Click on any section box below to expand/collapse and fill out details. Sections turn green when completed.</span>
        </div>

        {/* 1. SSLC Box */}
        <div className="border rounded-4 mb-3 shadow-sm text-start" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.sslc ? '#32b5c0' : '#e2e8f0' }}>
          <div 
            className="d-flex align-items-center justify-content-between p-3 select-none" 
            onClick={() => {
              const nextVal = !hasSslc;
              setValue('has_sslc', nextVal);
              setExpandedAcademicSections(prev => ({ ...prev, sslc: nextVal }));
            }}
            style={{ cursor: 'pointer', background: expandedAcademicSections.sslc ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.sslc ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
          >
            <div className="d-flex align-items-center gap-3">
              <input 
                type="checkbox" 
                className="form-check-input mt-0" 
                checked={hasSslc}
                onChange={() => {}}
                style={{ width: 18, height: 18, pointerEvents: 'none' }}
              />
              <div>
                <h6 className="fw-bold mb-0 text-dark">SSLC (10th) Details <span className="text-muted fw-normal">(Optional if unchecked)</span></h6>
                <span className="text-muted d-none d-md-inline" style={{ fontSize: '11px' }}>School name, board, year of passing, percentage & marksheet.</span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              {hasSslc ? (
                isSslcComplete ? (
                  <span className="badge bg-success text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                    ✓ Complete
                  </span>
                ) : null
              ) : (
                <span className="badge bg-secondary text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                  Optional
                </span>
              )}
              {expandedAcademicSections.sslc ? <ChevronUp size={18} className="text-secondary" /> : <ChevronDown size={18} className="text-secondary" />}
            </div>
          </div>
          {expandedAcademicSections.sslc && hasSslc && (
            <div className="p-3 bg-white border-top">
              {renderEducationRow('school_education.0', 'SSLC (10th) Details', 'SSLC', hasSslc)}
            </div>
          )}
        </div>

        {/* 2. HSC Box */}
        <div className="border rounded-4 mb-3 shadow-sm text-start" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.hsc ? '#32b5c0' : '#e2e8f0' }}>
          <div 
            className="d-flex align-items-center justify-content-between p-3 select-none" 
            onClick={() => {
              const nextVal = !hasHsc;
              setValue('has_hsc', nextVal);
              setExpandedAcademicSections(prev => ({ ...prev, hsc: nextVal }));
            }}
            style={{ cursor: 'pointer', background: expandedAcademicSections.hsc ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.hsc ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
          >
            <div className="d-flex align-items-center gap-3">
              <input 
                type="checkbox" 
                className="form-check-input mt-0" 
                checked={hasHsc}
                onChange={() => {}}
                style={{ width: 18, height: 18, pointerEvents: 'none' }}
              />
              <div>
                <h6 className="fw-bold mb-0 text-dark">HSC (12th) Details <span className="text-muted fw-normal">(Optional if unchecked)</span></h6>
                <span className="text-muted d-none d-md-inline" style={{ fontSize: '11px' }}>School name, board, passing details & marksheet.</span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              {hasHsc ? (
                isHscComplete ? (
                  <span className="badge bg-success text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                    ✓ Complete
                  </span>
                ) : null
              ) : (
                <span className="badge bg-secondary text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                  Optional
                </span>
              )}
              {expandedAcademicSections.hsc ? <ChevronUp size={18} className="text-secondary" /> : <ChevronDown size={18} className="text-secondary" />}
            </div>
          </div>
          {expandedAcademicSections.hsc && hasHsc && (
            <div className="p-3 bg-white border-top">
              {renderEducationRow('school_education.1', 'HSC (12th) Details', 'HSC', hasHsc)}
            </div>
          )}
        </div>

        {/* 3. Diploma Box */}
        <div className="border rounded-4 mb-3 shadow-sm text-start" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.diploma ? '#32b5c0' : '#e2e8f0' }}>
          <div 
            className="d-flex align-items-center justify-content-between p-3 select-none" 
            onClick={() => {
              const nextVal = !hasDiploma;
              setValue('has_diploma', nextVal);
              setExpandedAcademicSections(prev => ({ ...prev, diploma: nextVal }));
            }}
            style={{ cursor: 'pointer', background: expandedAcademicSections.diploma ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.diploma ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
          >
            <div className="d-flex align-items-center gap-3">
              <input 
                type="checkbox" 
                className="form-check-input mt-0" 
                checked={hasDiploma}
                onChange={() => {}}
                style={{ width: 18, height: 18, pointerEvents: 'none' }}
              />
              <div>
                <h6 className="fw-bold mb-0 text-dark">Diploma Details <span className="text-muted fw-normal">(Optional)</span></h6>
                <span className="text-muted d-none d-md-inline" style={{ fontSize: '11px' }}>Toggle this box if you hold a diploma qualification.</span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              {hasDiploma ? (
                isDiplomaComplete ? (
                  <span className="badge bg-success text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                    ✓ Complete
                  </span>
                ) : null
              ) : (
                <span className="badge bg-secondary text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                  Optional
                </span>
              )}
              {expandedAcademicSections.diploma ? <ChevronUp size={18} className="text-secondary" /> : <ChevronDown size={18} className="text-secondary" />}
            </div>
          </div>
          {expandedAcademicSections.diploma && hasDiploma && (
            <div className="p-3 bg-white border-top">
              {renderHigherEdRow('diploma', 'Diploma Details', 'diploma', 'Diploma', hasDiploma)}
            </div>
          )}
        </div>

        {/* 4. UG Box */}
        <div className="border rounded-4 mb-3 shadow-sm text-start" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.ug ? '#32b5c0' : '#e2e8f0' }}>
          <div 
            className="d-flex align-items-center justify-content-between p-3 select-none" 
            onClick={() => {
              const nextVal = !hasUg;
              setValue('has_ug', nextVal);
              setExpandedAcademicSections(prev => ({ ...prev, ug: nextVal }));
            }}
            style={{ cursor: 'pointer', background: expandedAcademicSections.ug ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.ug ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
          >
            <div className="d-flex align-items-center gap-3">
              <input 
                type="checkbox" 
                className="form-check-input mt-0" 
                checked={hasUg}
                onChange={() => {}}
                style={{ width: 18, height: 18, pointerEvents: 'none' }}
              />
              <div>
                <h6 className="fw-bold mb-0 text-dark">UG Details <span className="text-muted fw-normal">(Optional if unchecked)</span></h6>
                <span className="text-muted d-none d-md-inline" style={{ fontSize: '11px' }}>Undergraduate degree, specialization, university, scores & marksheets.</span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              {hasUg ? (
                isUgComplete ? (
                  <span className="badge bg-success text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                    ✓ Complete
                  </span>
                ) : null
              ) : (
                <span className="badge bg-secondary text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                  Optional
                </span>
              )}
              {expandedAcademicSections.ug ? <ChevronUp size={18} className="text-secondary" /> : <ChevronDown size={18} className="text-secondary" />}
            </div>
          </div>
          {expandedAcademicSections.ug && hasUg && (
            <div className="p-3 bg-white border-top">
              {renderHigherEdRow('higher_education.0', 'UG Details', 'ug', 'UG', hasUg)}
            </div>
          )}
        </div>

        {/* 5. PG Box */}
        <div className="border rounded-4 mb-3 shadow-sm text-start" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.pg ? '#32b5c0' : '#e2e8f0' }}>
          <div 
            className="d-flex align-items-center justify-content-between p-3 select-none" 
            onClick={() => {
              const nextVal = !hasPg;
              setValue('has_pg', nextVal);
              setExpandedAcademicSections(prev => ({ ...prev, pg: nextVal }));
            }}
            style={{ cursor: 'pointer', background: expandedAcademicSections.pg ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.pg ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
          >
            <div className="d-flex align-items-center gap-3">
              <input 
                type="checkbox" 
                className="form-check-input mt-0" 
                checked={hasPg}
                onChange={() => {}}
                style={{ width: 18, height: 18, pointerEvents: 'none' }}
              />
              <div>
                <h6 className="fw-bold mb-0 text-dark">PG Details <span className="text-muted fw-normal">(Optional if unchecked)</span></h6>
                <span className="text-muted d-none d-md-inline" style={{ fontSize: '11px' }}>Postgraduate degree, specialization, university, scores & marksheets.</span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              {hasPg ? (
                isPgComplete ? (
                  <span className="badge bg-success text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                    ✓ Complete
                  </span>
                ) : null
              ) : (
                <span className="badge bg-secondary text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                  Optional
                </span>
              )}
              {expandedAcademicSections.pg ? <ChevronUp size={18} className="text-secondary" /> : <ChevronDown size={18} className="text-secondary" />}
            </div>
          </div>
          {expandedAcademicSections.pg && hasPg && (
            <div className="p-3 bg-white border-top">
              {renderHigherEdRow('higher_education.1', 'PG Details', 'pg', 'PG', hasPg)}
            </div>
          )}
        </div>

        {/* 6. M.Phil Box */}
        <div className="border rounded-4 mb-3 shadow-sm text-start" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.mphil ? '#32b5c0' : '#e2e8f0' }}>
          <div 
            className="d-flex align-items-center justify-content-between p-3 select-none" 
            onClick={() => {
              const nextVal = !hasMphil;
              setValue('has_mphil', nextVal);
              setExpandedAcademicSections(prev => ({ ...prev, mphil: nextVal }));
            }}
            style={{ cursor: 'pointer', background: expandedAcademicSections.mphil ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.mphil ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
          >
            <div className="d-flex align-items-center gap-3">
              <input 
                type="checkbox" 
                className="form-check-input mt-0" 
                checked={hasMphil}
                onChange={() => {}}
                style={{ width: 18, height: 18, pointerEvents: 'none' }}
              />
              <div>
                <h6 className="fw-bold mb-0 text-dark">M.Phil Details <span className="text-muted fw-normal">(Optional)</span></h6>
                <span className="text-muted d-none d-md-inline" style={{ fontSize: '11px' }}>Toggle this box if you hold an M.Phil qualification.</span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              {hasMphil ? (
                isMphilComplete ? (
                  <span className="badge bg-success text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                    ✓ Complete
                  </span>
                ) : null
              ) : (
                <span className="badge bg-secondary text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                  Optional
                </span>
              )}
              {expandedAcademicSections.mphil ? <ChevronUp size={18} className="text-secondary" /> : <ChevronDown size={18} className="text-secondary" />}
            </div>
          </div>
          {expandedAcademicSections.mphil && hasMphil && (
            <div className="p-3 bg-white border-top">
              {renderHigherEdRow('mphil', 'M.Phil Details', 'mphil', 'M.Phil', hasMphil)}
            </div>
          )}
        </div>

        {/* 7. 5-Year Integrated Course Box */}
        <div className="border rounded-4 mb-3 shadow-sm text-start" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.integrated ? '#32b5c0' : '#e2e8f0' }}>
          <div 
            className="d-flex align-items-center justify-content-between p-3 select-none" 
            onClick={() => {
              const nextVal = !hasIntegrated;
              setValue('has_integrated', nextVal);
              setExpandedAcademicSections(prev => ({ ...prev, integrated: nextVal }));
            }}
            style={{ cursor: 'pointer', background: expandedAcademicSections.integrated ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.integrated ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
          >
            <div className="d-flex align-items-center gap-3">
              <input 
                type="checkbox" 
                className="form-check-input mt-0" 
                checked={hasIntegrated}
                onChange={() => {}}
                style={{ width: 18, height: 18, pointerEvents: 'none' }}
              />
              <div>
                <h6 className="fw-bold mb-0 text-dark">5-Year Integrated Course Details <span className="text-muted fw-normal">(Optional)</span></h6>
                <span className="text-muted d-none d-md-inline" style={{ fontSize: '11px' }}>Toggle this box if you hold a 5-Year Integrated Course qualification.</span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              {hasIntegrated ? (
                isIntegratedComplete ? (
                  <span className="badge bg-success text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                    ✓ Complete
                  </span>
                ) : null
              ) : (
                <span className="badge bg-secondary text-white" style={{ fontSize: '11.5px', borderRadius: '12px', padding: '4px 10px' }}>
                  Optional
                </span>
              )}
              {expandedAcademicSections.integrated ? <ChevronUp size={18} className="text-secondary" /> : <ChevronDown size={18} className="text-secondary" />}
            </div>
          </div>
          {expandedAcademicSections.integrated && hasIntegrated && (
            <div className="p-3 bg-white border-top">
              {renderHigherEdRow('integrated', '5-Year Integrated Course Details', 'integrated', 'Integrated', hasIntegrated)}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── STEP 4: Experience & Declaration ─────────────────────────────────────
  const experienceData = watch('experience_details') || [];

  const calculateDuration = (idx) => {
    const fromD = watch(`experience_details.${idx}.from_date`);
    const toD = watch(`experience_details.${idx}.to_date`);

    if (!fromD || !toD) return '—';

    const start = new Date(fromD);
    const end = new Date(toD);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—';
    if (end < start) return <span className="text-danger small">Invalid range</span>;

    // Calculate difference
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      // get days in previous month
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    // Populate legacy month/year fields for backward compatibility
    const monthsNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    
    const currentFromMonth = getValues(`experience_details.${idx}.from_month`);
    const currentFromYear = getValues(`experience_details.${idx}.from_year`);
    const currentToMonth = getValues(`experience_details.${idx}.to_month`);
    const currentToYear = getValues(`experience_details.${idx}.to_year`);
    
    const newFromMonth = monthsNames[start.getMonth()];
    const newFromYear = String(start.getFullYear());
    const newToMonth = monthsNames[end.getMonth()];
    const newToYear = String(end.getFullYear());
    const newYears = years;
    const newMonths = months;

    const currentYears = getValues(`experience_details.${idx}.total_years`);
    const currentMonths = getValues(`experience_details.${idx}.total_months`);

    if (
      currentFromMonth !== newFromMonth ||
      String(currentFromYear) !== newFromYear ||
      currentToMonth !== newToMonth ||
      String(currentToYear) !== newToYear ||
      currentYears !== newYears ||
      currentMonths !== newMonths
    ) {
      setTimeout(() => {
        setValue(`experience_details.${idx}.from_month`, newFromMonth);
        setValue(`experience_details.${idx}.from_year`, newFromYear);
        setValue(`experience_details.${idx}.to_month`, newToMonth);
        setValue(`experience_details.${idx}.to_year`, newToYear);
        setValue(`experience_details.${idx}.total_years`, newYears);
        setValue(`experience_details.${idx}.total_months`, newMonths);
      }, 0);
    }

    let durationStr = '';
    if (years > 0) durationStr += `${years} Years`;
    if (months > 0) durationStr += `${durationStr ? ', ' : ''}${months} Months`;
    if (days > 0) durationStr += `${durationStr ? ', ' : ''}${days} Days`;
    if (!durationStr) durationStr = '0 Days';

    return durationStr;
  };

  const addExperience = () => {
    const current = getValues('experience_details') || [];
    setValue('experience_details', [...current, { designation: '', organization_name: '', employment_type_id: '', from_month: '', from_year: '', to_month: '', to_year: '', from_date: '', to_date: '', total_years: 0, total_months: 0 }]);
  };

  const removeExperience = (idx) => {
    const current = getValues('experience_details');
    setValue('experience_details', current.filter((_, i) => i !== idx));
  };

  const Step4 = (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
        <h5 className="mb-0 fw-bold">Experience & Declaration</h5>
      </div>
      <div className="card-body p-4">
        <div className="section-title mb-4 bg-light p-2 rounded fw-bold text-primary">I. WORK EXPERIENCE (OPTIONAL)</div>
        <table className="table table-bordered align-middle">
          <thead className="table-light small">
            <tr>
              <th>Designation & Org</th>
              <th>Employment Type</th>
              <th>Duration (From - To)</th>
              <th>Total</th>
              <th style={{ width: '50px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {experienceData.map((exp, idx) => (
              <tr key={idx}>
                <td>
                  <input type="text" className="form-control form-control-sm mb-1" placeholder="Designation" {...register(`experience_details.${idx}.designation`)} />
                  <input type="text" className="form-control form-control-sm" placeholder="Organization" {...register(`experience_details.${idx}.organization_name`)} />
                </td>
                <td>
                  <select className="form-select form-select-sm" {...register(`experience_details.${idx}.employment_type_id`)}>
                    <option value="">Select Type</option>
                    {(dropdowns.employment_types || FALLBACK_EMPLOYMENT_TYPES).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
                <td>
                  <div className="d-flex flex-column gap-1">
                    <input type="date" className="form-control form-control-sm" {...register(`experience_details.${idx}.from_date`)} />
                    <input type="date" className="form-control form-control-sm" {...register(`experience_details.${idx}.to_date`)} />
                  </div>
                </td>
                <td className="fw-bold text-primary small">{calculateDuration(idx)}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeExperience(idx)}>×</button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="text-center p-1 bg-light">
                <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={addExperience}>+ Add Experience Record</button>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="section-title my-4 bg-light p-2 rounded fw-bold text-primary">II. OTHER QUALIFICATIONS & DECLARATION</div>
        <div className="alert alert-info py-2 small mb-3">
          Ph.D. Applicant Session (CET/JRF/NET/SET/SLET qualified candidates only)
        </div>
        <div className="d-flex gap-4 flex-wrap mb-4">
          {['NET', 'SET', 'JRF', 'SLET'].map(exam => (
            <div key={exam} className="form-check">
              <input type="checkbox" className="form-check-input" id={`admin_${exam}`} value={exam} {...register('qualified_exams')} />
              <label className="form-check-label fw-semibold" htmlFor={`admin_${exam}`}>{exam}</label>
            </div>
          ))}
        </div>

        <div className="alert alert-warning d-flex align-items-start gap-3">
          <input type="checkbox" className="form-check-input mt-1" {...register('declarationAccepted')} />
          <div>
            <strong>Declaration:</strong> I hereby acknowledge that the university has the authority to reject my application at any stage.
          </div>
        </div>
      </div>
    </div>
  );

  const steps = [Step0, Step1, Step2, Step3, Step4];

  return (
    <div>
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="fw-bold mb-0" style={{ color: '#32c5d2', fontSize: 22 }}>Add New Application</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0" style={{ fontSize: 12 }}>
              <li className="breadcrumb-item"><Link to="/" className="text-decoration-none">Home</Link></li>
              <li className="breadcrumb-item"><Link to="/applications" className="text-decoration-none">Applications</Link></li>
              <li className="breadcrumb-item active">Add New</li>
            </ol>
          </nav>
        </div>
        {applicationId && (
          <div className="badge bg-primary px-3 py-2" style={{ fontSize: 13 }}>
            Application ID: {applicationId}
          </div>
        )}
      </div>

      {/* Progress Steps */}
      <div className="card border-0 shadow-sm rounded-4 mb-4 p-3 overflow-hidden">
        <div className="d-flex align-items-center justify-content-between">
          {STEPS.map((s, i) => (
            <div key={i} className="d-flex align-items-center" style={{ flex: i === STEPS.length - 1 ? '0 0 auto' : '1' }}>
              <div
                className="d-flex align-items-center gap-2"
                onClick={() => { if (i === 0 || applicationId) setStep(i); }}
                style={{ cursor: (i === 0 || applicationId) ? 'pointer' : 'default' }}
                title={i > 0 && !applicationId ? 'Complete Account Setup first' : `Go to ${s}`}
              >
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

      {/* Current Step */}
      {steps[step]}

      {/* Navigation */}
      {step > 0 && (
        <div className="d-flex justify-content-between mt-4">
          <button className="btn btn-outline-secondary px-4" onClick={() => setStep(s => s - 1)} disabled={loading}>
            <ChevronLeft size={16} className="me-1" /> Previous
          </button>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-secondary px-4 fw-bold" onClick={() => navigate('/applications')}>Cancel</button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn px-4 text-white d-flex align-items-center gap-2"
                style={{ background: '#32b5c0' }}
                onClick={handleSaveAndNext}
                disabled={loading}
              >
                {loading
                  ? <><span className="spinner-border spinner-border-sm" role="status" /> Saving…</>
                  : <>Save Draft &amp; Next <ChevronRight size={16} /></>
                }
              </button>
            ) : (
              <button
                className="btn btn-success px-5"
                onClick={() => saveData('Draft').then(ok => ok && navigate('/applications'))}
                disabled={loading}
              >
                {loading
                  ? <span className="spinner-border spinner-border-sm me-1" />
                  : <Send size={16} className="me-1" />
                }
                Save & Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAddApplication;
