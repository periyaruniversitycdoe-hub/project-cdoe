import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { Save, Send, ChevronRight, ChevronLeft, CheckCircle, ArrowLeft, Eye, ChevronDown, ChevronUp } from 'lucide-react';

const API       = import.meta.env.VITE_API_URL || (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';
const ADMIN_API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const STEPS = [
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

const DEGREES = ["M.A.", "M.Sc.", "M.Com.", "M.Tech.", "M.E.", "M.B.A.", "M.C.A.", "M.Phil.", "M.S.W.", "M.Ed.", "M.P.Ed.", "M.Lib.I.Sc.", "LL.M.", "M.D.", "M.S.", "M.D.S.", "Other"];



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

const QUAL_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const currentYear = new Date().getFullYear();
const QUAL_YEARS = Array.from({ length: 30 }, (_, i) => currentYear - i);

const FALLBACK_EXAM_CENTERS = [
  { id: 1, name: 'Salem' },
  { id: 2, name: 'Chennai' },
  { id: 3, name: 'Coimbatore' },
  { id: 4, name: 'Madurai' },
  { id: 5, name: 'Trichy' }
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

const UNIVERSITIES = [
  "Periyar University, Salem",
  "Anna University, Chennai",
  "University of Madras, Chennai",
  "Madurai Kamaraj University, Madurai",
  "Bharathiar University, Coimbatore",
  "Bharathidasan University, Tiruchirappalli",
  "Annamalai University, Chidambaram",
  "Alagappa University, Karaikudi",
  "Manonmaniam Sundaranar University, Tirunelveli",
  "Pondicherry University, Puducherry",
  "Tamil Nadu Agricultural University, Coimbatore",
  "Tamil Nadu Teachers Education University, Chennai",
  "Tamil Nadu Physical Education and Sports University, Chennai",
  "Tamil Nadu Dr. M.G.R. Medical University, Chennai",
  "Tamil Nadu Dr. Ambedkar Law University, Chennai",
  "Tamil University, Thanjavur",
  "University of Delhi, Delhi",
  "Jawaharlal Nehru University (JNU), Delhi",
  "Banaras Hindu University (BHU), Varanasi",
  "Aligarh Muslim University (AMU), Aligarh",
  "Jamia Millia Islamia, Delhi",
  "University of Calcutta, Kolkata",
  "University of Mumbai, Mumbai",
  "Osmania University, Hyderabad",
  "University of Hyderabad, Hyderabad",
  "Bangalore University, Bangalore",
  "University of Mysore, Mysore",
  "Karnataka University, Dharwad",
  "University of Kerala, Thiruvananthapuram",
  "Mahatma Gandhi University, Kottayam",
  "University of Calicut, Thenhipalam",
  "Cochin University of Science and Technology (CUSAT), Kochi",
  "Andhra University, Visakhapatnam",
  "Sri Venkateswara University, Tirupati",
  "Jawaharlal Nehru Technological University (JNTU), Hyderabad",
  "Visvesvaraya Technological University (VTU), Belagavi",
  "Indian Institute of Science (IISc), Bangalore",
  "IIT Madras", "IIT Delhi", "IIT Bombay", "IIT Kanpur", "IIT Kharagpur", "IIT Roorkee", "IIT Guwahati",
  "NIT Trichy", "NIT Warangal", "NIT Surathkal",
  "Other Indian University",
  "Foreign University"
];

const COUNTRY_CODES = [
  { code: '+91', name: 'India', flag: '🇮🇳' },
];

const ApplicationForm = ({ isAdminMode = false, adminApplicationId = null, onAdminDone = null, studentToken: propStudentToken = null, studentUser: propStudentUser = null }) => {
  const { user: storeUser, token: storeToken, updateUser } = useAuthStore();
  // When admin impersonates a student (propStudentToken provided), override user/token from Zustand
  const isImpersonating = !!propStudentToken;
  const user  = isImpersonating ? propStudentUser : storeUser;
  const token = isImpersonating ? propStudentToken : storeToken;
  const adminToken = isAdminMode ? (localStorage.getItem('adminToken') || '') : null;
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [partTimeMapping, setPartTimeMapping] = useState({});
  const [dropdowns, setDropdowns] = useState({});
  const [photos, setPhotos] = useState({});
  const [loading, setLoading] = useState(true);
  const [appStatus, setAppStatus] = useState('Draft');
  const [applicationOpen, setApplicationOpen] = useState(true);
  const [states, setStates] = useState([]);
  const [commDistricts, setCommDistricts] = useState([]);
  const [permDistricts, setPermDistricts] = useState([]);
  const [fileSettings, setFileSettings] = useState({});
  const [ugSemesters,      setUgSemesters]      = useState(['ug_sem_1']);
  const [pgSemesters,      setPgSemesters]      = useState(['pg_sem_1']);
  const [diplomaSemesters, setDiplomaSemesters] = useState(['diploma_sem_1']);
  const [mphilSemesters,   setMphilSemesters]   = useState(['mphil_sem_1']);
  const [integratedSemesters, setIntegratedSemesters] = useState(['integrated_sem_1']);
  // Dynamic qualifications from API
  const [qualificationTypes, setQualificationTypes] = useState([]);
  const [selectedQualIds,    setSelectedQualIds]    = useState(new Set());
  // Qualification pass month/year — keyed by qualification_id
  const [qualDates,          setQualDates]          = useState({});
  // Per-experience-entry districts
  const [expDistricts,       setExpDistricts]       = useState({});
  // Eligibility engine state
  const [departments,        setDepartments]        = useState([]);
  const [programs,           setPrograms]           = useState([]);
  const [eligibilityHints,   setEligibilityHints]   = useState({ pg: [], mphil: [], integrated: [] });
  const [loadingPrograms,    setLoadingPrograms]    = useState(false);
  const [loadingHints,       setLoadingHints]       = useState(false);
  const [expandedAcademicSections, setExpandedAcademicSections] = useState({
    sslc: true,
    hsc: false,
    diploma: false,
    ug: false,
    pg: false,
    mphil: false,
    integrated: false
  });

  const { register, handleSubmit, watch, getValues, reset, setValue, clearErrors, formState: { errors } } = useForm({
    defaultValues: {
      user_id: user?.id,
      department_id: '',
      program_offered_id: '',
      nationality: 'India',
      state: 'Tamil Nadu',
      religion: 'Hindu',
      is_physically_challenged: 'No',
      mobile_code: '+91',
      gender: 'Male',
      score_type: 'Percentage',
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
        level: 'Diploma', degree_id: '', specialization_id: '', specialization_other: '', institution_name: '',
        university_name: '', university_type_id: '', passing_month: '', passing_year: '',
        score_type: 'Percentage', score_value: ''
      },
      mphil: {
        level: 'M.Phil', degree_id: '', degree_name: '', specialization_id: '', institution_name: '',
        university_name: '', university_type_id: '', passing_month: '', passing_year: '',
        score_type: 'Percentage', score_value: ''
      },
      integrated: {
        level: 'Integrated', degree_id: '', degree_name: '', degree_name_other: '', specialization_id: '', institution_name: '',
        university_name: '', university_type_id: '', passing_month: '', passing_year: '',
        score_type: 'Percentage', score_value: '', registration_number: '', upload_mode: 'Consolidated'
      },
      id_type: 'Aadhaar No',
      category: '',
      school_education: [
        { level: 'SSLC', institution_name: '', board_id: '', other_board_name: '', passing_month: '', passing_year: '', percentage: '' },
        { level: 'HSC', institution_name: '', board_id: '', other_board_name: '', passing_month: '', passing_year: '', percentage: '' }
      ],
      higher_education: [
        { level: 'UG', degree_id: '', specialization_id: '', specialization_other: '', institution_name: '', university_name: '', university_type_id: '', passing_month: '', passing_year: '', score_type: 'Percentage', score_value: '' },
        { level: 'PG', degree_id: '', degree_name: '', specialization_id: '', institution_name: '', university_name: '', university_type_id: '', passing_month: '', passing_year: '', score_type: 'Percentage', score_value: '' }
      ],
      experience_details: [],
    }
  });

  const selectedDeptId      = watch('department_id');
  const selectedProgId      = watch('program_offered_id');
  const category            = watch('category');
  const partTimeCategory    = watch('part_time_category');
  // Module 1: watch all 5 possible exam centre slots
  const examCenterSelections = [
    watch('exam_center_1') || '',
    watch('exam_center_2') || '',
    watch('exam_center_3') || '',
    watch('exam_center_4') || '',
    watch('exam_center_5') || '',
  ];
  // Keep backward-compat aliases used elsewhere in this file
  const center1 = examCenterSelections[0];
  const center2 = examCenterSelections[1];
  const isPhysicallyChallenged = watch('is_physically_challenged');

  // Module 2: watch timeline fields for real-time validation
  const sslcPassingYear      = watch('school_education.0.passing_year');
  const hscPassingYear       = watch('school_education.1.passing_year');
  const ugStartYear          = watch('higher_education.0.start_year');
  const ugPassingYear        = watch('higher_education.0.passing_year');
  const pgStartYear          = watch('higher_education.1.start_year');
  const pgPassingYear        = watch('higher_education.1.passing_year');
  const integratedStartYear  = watch('integrated.start_year');
  const ugMarkType          = watch('ug_mark_statement_type');
  const pgMarkType          = watch('pg_mark_statement_type');
  const diplomaMarkType     = watch('diploma_mark_statement_type');
  const mphilMarkType       = watch('mphil_mark_statement_type');
  const integratedMarkType  = watch('integrated_mark_statement_type');
  const hasSslc             = watch('has_sslc') !== false;
  const hasHsc              = watch('has_hsc') !== false;
  const hasUg               = watch('has_ug') !== false;
  const hasPg               = watch('has_pg') !== false;
  const hasDiploma          = watch('has_diploma') === true || watch('has_diploma') === 1 || watch('has_diploma') === '1';
  const hasMphil            = watch('has_mphil') === true || watch('has_mphil') === 1 || watch('has_mphil') === '1';
  const hasIntegrated       = watch('has_integrated') === true || watch('has_integrated') === 1 || watch('has_integrated') === '1';
  const idType              = watch('id_type');
  const commState           = watch('state');
  const permState           = watch('perm_state');
  const permSameAsComm      = watch('perm_same_as_comm');
  
  // Real-time Community Consolidation & Eligibility Engine watches
  const selectedCommunityName = watch('community');
  const pgScoreVal = watch('higher_education.1.score_value');
  const integratedScoreVal = watch('integrated.score_value');

  const selectedCommunityObj = (dropdowns.communities || []).find(c => c.name === selectedCommunityName);
  const isValidationApplicable = hasPg || hasIntegrated;

  const getEligibilityInfo = () => {
    if (!isValidationApplicable || !selectedCommunityObj || selectedCommunityObj.pg_min_mark == null) {
      return { isEligible: true, requiredPercentage: null, enteredPercentage: null };
    }

    const minRequired = parseFloat(selectedCommunityObj.pg_min_mark);
    const scoreVal = hasPg ? pgScoreVal : integratedScoreVal;
    const score = parseFloat(scoreVal);

    if (isNaN(score)) {
      return { isEligible: true, requiredPercentage: minRequired, enteredPercentage: null };
    }

    return {
      isEligible: score >= minRequired,
      requiredPercentage: minRequired,
      enteredPercentage: score
    };
  };

  const { isEligible, requiredPercentage, enteredPercentage } = getEligibilityInfo();

  const [ptCategories, setPtCategories] = useState([]);
  const [ptRoles, setPtRoles] = useState([]);
  const [ptAreas, setPtAreas] = useState([]);
  const [ptDistricts, setPtDistricts] = useState([]);

  const [globalDoc, setGlobalDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState('pdf');

  // Module 1: Exam Centre Configuration (dynamic preference count)
  const [examCentreConfig, setExamCentreConfig] = useState({ max_preferences: 2, status: 'active' });

  // Module 2: Academic Timeline Validation errors
  const [timelineErrors, setTimelineErrors] = useState({});

  // Module 1: Load admin-configured exam centre preference count
  useEffect(() => {
    axios.get(`${API}/exam-centre-config`)
      .then(r => { if (r.data.success && r.data.data) setExamCentreConfig(r.data.data); })
      .catch(() => {}); // fallback to default 2
  }, []);

  // Module 2: Real-time Academic Timeline Validation Engine
  useEffect(() => {
    const errs = {};
    const yr = (v) => parseInt(v);
    const ok = (v) => v && !isNaN(parseInt(v));

    if (ok(sslcPassingYear) && ok(hscPassingYear)) {
      if (yr(hscPassingYear) <= yr(sslcPassingYear)) {
        errs.hsc = '+2 completion year must be greater than 10th completion year.';
      }
    }
    if (ok(hscPassingYear) && ok(ugStartYear)) {
      if (yr(ugStartYear) < yr(hscPassingYear)) {
        errs.ugStart = 'UG start year cannot be earlier than +2 completion year.';
      }
    }
    if (ok(ugStartYear) && ok(ugPassingYear)) {
      if (yr(ugPassingYear) <= yr(ugStartYear)) {
        errs.ugEnd = 'UG completion year must be greater than UG start year.';
      }
    }
    if (ok(ugPassingYear) && ok(pgStartYear)) {
      if (yr(pgStartYear) < yr(ugPassingYear)) {
        errs.pgStart = 'PG start year cannot be earlier than UG completion year.';
      }
    }
    if (ok(pgStartYear) && ok(pgPassingYear)) {
      if (yr(pgPassingYear) <= yr(pgStartYear)) {
        errs.pgEnd = 'PG completion year must be greater than PG start year.';
      }
    }
    if (ok(hscPassingYear) && ok(integratedStartYear)) {
      if (yr(integratedStartYear) < yr(hscPassingYear)) {
        errs.intStart = 'Integrated course start year cannot be earlier than +2 completion year.';
      }
    }
    setTimelineErrors(errs);
  }, [sslcPassingYear, hscPassingYear, ugStartYear, ugPassingYear, pgStartYear, pgPassingYear, integratedStartYear]);

  // Fetch dynamic part-time categories and global guidance on mount
  useEffect(() => {
    axios.get(`${API}/part-time/categories`).then(res => {
      if (res.data.success) setPtCategories(res.data.data);
    }).catch(() => {});

    axios.get(`${API}/part-time/global-guidance`).then(res => {
      if (res.data.success && res.data.data) {
        setGlobalDoc(res.data.data);
      }
    }).catch(() => {});
  }, []);

  const handleViewGlobalDoc = () => {
    if (!globalDoc) return;
    setPreviewType(globalDoc.document_type);
    setPreviewUrl(`${API}/part-time/global-guidance/preview?token=${token}`);
  };

  const partTimeCategoryVal    = watch('part_time_category_id');
  const partTimeDesignationVal = watch('part_time_designation_id');
  const partTimeAreaVal        = watch('part_time_area');

  // Fetch roles when category changes & sync Name for DB
  useEffect(() => {
    if (partTimeCategoryVal) {
      const cat = ptCategories.find(c => String(c.id) === String(partTimeCategoryVal));
      if (cat) setValue('part_time_category', cat.name);

      axios.get(`${API}/part-time/categories/${partTimeCategoryVal}/roles`).then(res => {
        if (res.data.success) setPtRoles(res.data.data);
      });
    } else {
      setPtRoles([]);
      setValue('part_time_category', '');
    }
    setValue('part_time_designation_id', '');
    setValue('part_time_designation', '');
    setValue('part_time_area', '');
    setValue('part_time_area_id', '');
    setValue('part_time_district', '');
    setPtDistricts([]);
  }, [partTimeCategoryVal, ptCategories, setValue]);

  // Fetch areas when role changes & sync Role Name for DB
  useEffect(() => {
    if (partTimeDesignationVal) {
      const role = ptRoles.find(r => String(r.id) === String(partTimeDesignationVal));
      if (role) setValue('part_time_designation', role.name);

      axios.get(`${API}/part-time/roles/${partTimeDesignationVal}/areas`).then(res => {
        if (res.data.success) setPtAreas(res.data.data);
      });
    } else {
      setPtAreas([]);
      setValue('part_time_designation', '');
    }
    setValue('part_time_area', '');
    setValue('part_time_area_id', '');
    setValue('part_time_district', '');
    setPtDistricts([]);
  }, [partTimeDesignationVal, ptRoles, setValue]);

  // Fetch districts when working-area/state is selected
  useEffect(() => {
    if (!partTimeAreaVal) {
      setPtDistricts([]);
      setValue('part_time_district', '');
      setValue('part_time_area_id', '');
      return;
    }
    const area = ptAreas.find(a => a.name === partTimeAreaVal);
    if (!area) return;
    setValue('part_time_area_id', area.id);
    axios.get(`${API}/part-time/areas/${area.id}/districts`).then(res => {
      if (res.data.success) setPtDistricts(res.data.data || []);
    }).catch(() => setPtDistricts([]));
    setValue('part_time_district', '');
  }, [partTimeAreaVal, ptAreas, setValue]);

  // Fetch session to know if application_open
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/student/session`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setApplicationOpen(!!res.data?.application_open))
      .catch(() => setApplicationOpen(true)); // default open on error
  }, [token]);

  // Load dynamic qualification types from API
  useEffect(() => {
    axios.get(`${API}/qualifications`)
      .then(r => setQualificationTypes(r.data.data || []))
      .catch(() => {
        // Fallback to common qualifications if API unavailable
        setQualificationTypes([
          { id: 1, qualification_name: 'NET',    is_exemption: 1 },
          { id: 2, qualification_name: 'SET',    is_exemption: 1 },
          { id: 3, qualification_name: 'JRF',    is_exemption: 1 },
          { id: 4, qualification_name: 'SLET',   is_exemption: 1 },
          { id: 5, qualification_name: 'GATE',   is_exemption: 0 },
          { id: 6, qualification_name: 'M.Phil', is_exemption: 0 },
        ]);
      });
  }, []);

  // Load dropdowns
  useEffect(() => {
    const tables = [
      'exam_centers', 'categories', 'genders', 'communities',
      'education_boards', 'degree_types', 'university_types', 'specializations', 'employment_types',
      'mphil_courses'
    ];
    const data = {};
    Promise.all(tables.map(t =>
      axios.get(`${API}/dropdowns/${t}`).then(r => { data[t] = r.data; }).catch(() => {})
    )).then(() => setDropdowns(data));
  }, []);

  // ── Eligibility engine: fetch departments on mount ──────────────────────────
  useEffect(() => {
    axios.get(`${API}/eligibility/departments`)
      .then(r => setDepartments(r.data.data || []))
      .catch(() => {});
  }, []);

  // ── Eligibility engine: fetch programs when department changes ───────────────
  useEffect(() => {
    if (!selectedDeptId) { setPrograms([]); setValue('program_offered_id', ''); setEligibilityHints({ pg: [], mphil: [], integrated: [] }); return; }
    setLoadingPrograms(true);
    axios.get(`${API}/eligibility/programs?department_id=${selectedDeptId}`)
      .then(r => {
        setPrograms(r.data.data || []);
        // Sync subject = department name for backward compatibility (hall tickets, reports)
        const dept = departments.find(d => String(d.id) === String(selectedDeptId));
        if (dept) setValue('subject', dept.name);
      })
      .catch(() => {})
      .finally(() => setLoadingPrograms(false));
  }, [selectedDeptId, departments, setValue]);

  // ── Eligibility engine: fetch hints when program changes ─────────────────────
  useEffect(() => {
    if (!selectedProgId) { setEligibilityHints({ pg: [], mphil: [], integrated: [] }); return; }
    setLoadingHints(true);
    axios.get(`${API}/eligibility/programs/${selectedProgId}/hints`)
      .then(r => {
        setEligibilityHints({ pg: r.data.data?.pg || [], mphil: r.data.data?.mphil || [], integrated: r.data.data?.integrated || [] });
        // Store program name for denormalized display
        const prog = programs.find(p => String(p.id) === String(selectedProgId));
        if (prog) setValue('program_offered_name', prog.name);
      })
      .catch(() => setEligibilityHints({ pg: [], mphil: [], integrated: [] }))
      .finally(() => setLoadingHints(false));
  }, [selectedProgId, programs, setValue]);

  // Load all Indian states from API
  useEffect(() => {
    axios.get(`${API}/states`)
      .then(r => setStates(r.data.data || []))
      .catch(() => {});
  }, []);

  // Load per-file-type upload size limits from admin settings
  useEffect(() => {
    axios.get(`${API}/file-upload-settings`)
      .then(r => {
        const map = {};
        (r.data.data || []).forEach(s => { map[s.file_type] = s; });
        setFileSettings(map);
      })
      .catch(() => {});
  }, []);

  // Cascade: communication state → communication districts
  useEffect(() => {
    if (!commState) { setCommDistricts([]); return; }
    axios.get(`${API}/districts?state_name=${encodeURIComponent(commState)}`)
      .then(r => setCommDistricts(r.data.data || []))
      .catch(() => setCommDistricts(FALLBACK_DISTRICTS.map(d => ({ id: d, district_name: d }))));
  }, [commState]);

  // Cascade: permanent state → permanent districts
  useEffect(() => {
    if (!permState) { setPermDistricts([]); return; }
    axios.get(`${API}/districts?state_name=${encodeURIComponent(permState)}`)
      .then(r => setPermDistricts(r.data.data || []))
      .catch(() => {});
  }, [permState]);

  // "Same as Communication Address" — copy comm fields into perm fields
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

  useEffect(() => {
    if (ugMarkType === 'Consolidated Mark Statement') {
      setValue('ug_is_awaiting_final_sem', 0);
    } else if (!ugSemesters.some(k => k.startsWith('ug_sem_'))) {
      setUgSemesters(['ug_sem_1']);
    }
  }, [ugMarkType, setValue]);

  useEffect(() => {
    if (pgMarkType === 'Consolidated Mark Statement') {
      setValue('pg_is_awaiting_final_sem', 0);
    } else if (!pgSemesters.some(k => k.startsWith('pg_sem_'))) {
      setPgSemesters(['pg_sem_1']);
    }
  }, [pgMarkType, setValue]);

  useEffect(() => {
    if (diplomaMarkType === 'Consolidated Mark Statement') {
      setValue('diploma_is_awaiting_final_sem', 0);
    } else if (!diplomaSemesters.some(k => k.startsWith('diploma_sem_'))) {
      setDiplomaSemesters(['diploma_sem_1']);
    }
  }, [diplomaMarkType, setValue]);

  useEffect(() => {
    if (mphilMarkType === 'Consolidated Mark Statement') {
      setValue('mphil_is_awaiting_final_sem', 0);
    } else if (!mphilSemesters.some(k => k.startsWith('mphil_sem_'))) {
      setMphilSemesters(['mphil_sem_1']);
    }
  }, [mphilMarkType, setValue]);

  useEffect(() => {
    if (integratedMarkType === 'Consolidated Mark Statement') {
      setValue('integrated_is_awaiting_final_sem', 0);
    } else if (!integratedSemesters.some(k => k.startsWith('integrated_sem_'))) {
      setIntegratedSemesters(['integrated_sem_1']);
    }
  }, [integratedMarkType, setValue]);

  useEffect(() => {
    if (category !== 'Part Time') {
      setValue('part_time_category_id', '');
      setValue('part_time_category', '');
      setValue('part_time_designation_id', '');
      setValue('part_time_designation', '');
      setValue('part_time_area', '');
      setValue('part_time_area_id', '');
      setValue('part_time_district', '');
      setPtDistricts([]);
    }
  }, [category, setValue]);

  // Clear work experience entries when candidate switches to Full Time —
  // prevents stale data from being validated or submitted for ineligible category.
  useEffect(() => {
    if (category === 'Full Time') {
      setValue('experience_details', []);
    }
  }, [category, setValue]);

  // Enterprise Validation Engine: Clear errors when sections are disabled
  useEffect(() => { if (!hasSslc) clearErrors('school_education.0'); }, [hasSslc, clearErrors]);
  useEffect(() => { if (!hasHsc) clearErrors('school_education.1'); }, [hasHsc, clearErrors]);
  useEffect(() => { if (!hasUg) clearErrors('higher_education.0'); }, [hasUg, clearErrors]);
  useEffect(() => { if (!hasPg) clearErrors('higher_education.1'); }, [hasPg, clearErrors]);
  useEffect(() => { if (!hasDiploma) clearErrors('diploma'); }, [hasDiploma, clearErrors]);
  useEffect(() => { if (!hasMphil) clearErrors('mphil'); }, [hasMphil, clearErrors]);
  useEffect(() => { if (!hasIntegrated) clearErrors('integrated'); }, [hasIntegrated, clearErrors]);

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

  // Load existing application data.
  // Admin mode: load by applicationId from admin backend.
  // Portal mode: load via /my endpoint (identifies user by JWT).
  useEffect(() => {
    const fetchAppData = async () => {
      if (isAdminMode && !isImpersonating && !adminApplicationId) return;
      if (!isAdminMode && !isImpersonating && !token) return;
      try {
        const res = (isAdminMode && !isImpersonating)
          ? await axios.get(`${ADMIN_API}/applications/${encodeURIComponent(adminApplicationId)}`, {
              headers: { Authorization: `Bearer ${adminToken}` }
            })
          : await axios.get(`${API}/applications/my`, {
              headers: { Authorization: `Bearer ${token}` }
            });
        const data = res.data;
        setAppStatus(data.status);

        if (data.qualified_exams && typeof data.qualified_exams === 'string') {
          try { data.qualified_exams = JSON.parse(data.qualified_exams); } catch(e) {}
        }

        // Restore normalized student_qualifications selections + pass dates
        if (data.student_qualifications && data.student_qualifications.length > 0) {
          const ids = new Set(data.student_qualifications.map(q => q.qualification_id));
          setSelectedQualIds(ids);
          const dates = {};
          data.student_qualifications.forEach(q => {
            if (q.qual_month || q.qual_year) {
              dates[q.qualification_id] = { month: q.qual_month || '', year: q.qual_year ? String(q.qual_year) : '' };
            }
          });
          if (Object.keys(dates).length > 0) setQualDates(dates);
        }

        if (data.dob) {
          data.dob = new Date(data.dob).toISOString().split('T')[0];
        }

        if (data.experience_details && data.experience_details.length > 0) {
          data.experience_details.forEach(exp => {
            if (exp.from_date) {
              exp.from_date = new Date(exp.from_date).toISOString().split('T')[0];
            }
            if (exp.to_date) {
              exp.to_date = new Date(exp.to_date).toISOString().split('T')[0];
            }
          });
        }

        // Self-heal checkbox toggle states if loading pre-migration application draft
        if (data.has_sslc === undefined || data.has_sslc === null) data.has_sslc = true;
        if (data.has_hsc === undefined || data.has_hsc === null) data.has_hsc = true;
        if (data.has_ug === undefined || data.has_ug === null) data.has_ug = true;
        if (data.has_pg === undefined || data.has_pg === null) data.has_pg = true;
        if (data.has_diploma === undefined || data.has_diploma === null) data.has_diploma = false;
        if (data.has_mphil === undefined || data.has_mphil === null) data.has_mphil = false;
        if (data.has_integrated === undefined || data.has_integrated === null) data.has_integrated = false;

        reset(data);

        // Pre-load districts for existing work experience entries
        if (data.experience_details && data.experience_details.length > 0) {
          data.experience_details.forEach(async (exp, idx) => {
            if (exp.state_id) {
              try {
                const r = await axios.get(`${API}/districts?state_id=${exp.state_id}`);
                setExpDistricts(prev => ({ ...prev, [idx]: r.data.data || [] }));
              } catch (e) {
                console.error('[loadExpDistricts on mount] error:', e);
              }
            }
          });
        }

        // Restore eligibility dropdowns: if a department_id is saved, pre-load
        // its programmes so the programme dropdown shows the correct saved value.
        if (data.department_id) {
          axios.get(`${API}/eligibility/programs?department_id=${data.department_id}`)
            .then(r => setPrograms(r.data.data || []))
            .catch(() => {});
          if (data.program_offered_id) {
            axios.get(`${API}/eligibility/programs/${data.program_offered_id}/hints`)
              .then(r => setEligibilityHints({ pg: r.data.data?.pg || [], mphil: r.data.data?.mphil || [], integrated: r.data.data?.integrated || [] }))
              .catch(() => {});
          }
        }

        const docs = {};
        if (data.documents) {
          data.documents.forEach(doc => {
            docs[doc.document_type] = {
              preview: `${import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000'}/${doc.file_path}`,
              isExisting: true
            };
          });
        }
        setPhotos(docs);

        const ugSems = Object.keys(docs)
          .filter(k => /^ug_sem_\d+$/.test(k))
          .sort((a, b) => parseInt(a.split('_').pop()) - parseInt(b.split('_').pop()));
        setUgSemesters(ugSems.length > 0 ? ugSems : ['ug_sem_1']);

        const pgSems = Object.keys(docs)
          .filter(k => /^pg_sem_\d+$/.test(k))
          .sort((a, b) => parseInt(a.split('_').pop()) - parseInt(b.split('_').pop()));
        setPgSemesters(pgSems.length > 0 ? pgSems : ['pg_sem_1']);

        const diplomaSems = Object.keys(docs)
          .filter(k => /^diploma_sem_\d+$/.test(k))
          .sort((a, b) => parseInt(a.split('_').pop()) - parseInt(b.split('_').pop()));
        setDiplomaSemesters(diplomaSems.length > 0 ? diplomaSems : ['diploma_sem_1']);

        const mphilSems = Object.keys(docs)
          .filter(k => /^mphil_sem_\d+$/.test(k))
          .sort((a, b) => parseInt(a.split('_').pop()) - parseInt(b.split('_').pop()));
        setMphilSemesters(mphilSems.length > 0 ? mphilSems : ['mphil_sem_1']);

        const integratedSems = Object.keys(docs)
          .filter(k => /^integrated_sem_\d+$/.test(k))
          .sort((a, b) => parseInt(a.split('_').pop()) - parseInt(b.split('_').pop()));
        setIntegratedSemesters(integratedSems.length > 0 ? integratedSems : ['integrated_sem_1']);
      } catch (err) {
        // 404 means fresh user with no data yet — silently start with an empty form
        if (err?.response?.status !== 404) console.error('[ApplicationForm] load error:', err);
      } finally { setLoading(false); }
    };
    fetchAppData();
  }, [token, reset]);

  const isSubmitted = appStatus === 'Submitted';

  // Module 1: resolved max preferences (config or default 2)
  const maxExamPreferences = Math.min(
    Math.max(parseInt(examCentreConfig?.max_preferences) || 2, 1),
    10
  );

  // Module 2: block save/next when there are timeline errors
  const hasTimelineErrors = Object.keys(timelineErrors).length > 0;

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
    if (isSubmitted) return true;
    if (!key.includes('_sem_')) return false;
    const parts = key.split('_sem_');
    const prefix = parts[0];
    const semNum = parseInt(parts[1]);
    if (semNum === 1) return false;
    
    // Check if previous semester file exists
    const prevKey = `${prefix}_sem_${semNum - 1}`;
    return !photos[prevKey];
  };

  const renderUploadControls = (key, disabled = isSubmitted) => {
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
      <div className="mt-2">
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
    if (semLevel === 'mphil')   return [mphilSemesters,   setMphilSemesters];
    if (semLevel === 'integrated') return [integratedSemesters, setIntegratedSemesters];
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

  // Dynamic file size validation using admin-configured limits
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
      const fallback = { photo: 50, signature: 30, id_proof: 150, community_cert: 500, pc_cert: 500 };
      limitKB = fallback[key] || 500;
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

  // Build FormData from current form values + any new file uploads
  const buildFormData = (status = 'Draft') => {
    const data = { ...getValues() };
    const formData = new FormData();

    // Nested objects must be JSON-stringified for the backend parser
    const nestedFields = ['school_education', 'higher_education', 'experience_details', 'qualified_exams'];
    nestedFields.forEach(field => {
      if (data[field] !== undefined) {
        formData.append(field, JSON.stringify(data[field]));
        delete data[field];
      }
    });

    // Send normalized qualification IDs + pass dates for server-side storage
    formData.append('student_qualifications', JSON.stringify([...selectedQualIds]));
    selectedQualIds.forEach(id => {
      const dates = qualDates[id] || {};
      if (dates.month) formData.append(`qual_month_${id}`, dates.month);
      if (dates.year)  formData.append(`qual_year_${id}`,  dates.year);
    });

    Object.entries(data).forEach(([k, v]) => {
      if (v != null && k !== 'status' && k !== 'declarationAccepted') {
        const val = (Array.isArray(v) || (typeof v === 'object' && v !== null)) ? JSON.stringify(v) : v;
        formData.append(k, val);
      }
    });

    // Only append NEW files (not existing server-side ones)
    Object.entries(photos).forEach(([k, v]) => {
      if (v.file) formData.append(k, v.file);
    });

    formData.set('status', status);
    return formData;
  };

  // Save form data and return success boolean
  const saveData = async (status = 'Draft') => {
    if (status === 'Submitted') {
      const values = getValues();
      if (!values.declarationAccepted) {
        toast.error('Please accept the declaration before final submission');
        return false;
      }
      // Validate that all selected qualifications have month and year
      for (const id of selectedQualIds) {
        const dates = qualDates[id] || {};
        if (!dates.month || !dates.year) {
          const qt = qualificationTypes.find(q => q.id === id);
          toast.error(`Please select Month and Year of Passing for ${qt?.qualification_name || 'the selected qualification'}.`);
          return false;
        }
        // Future date check
        const monthIdx = QUAL_MONTHS.indexOf(dates.month);
        const year = parseInt(dates.year, 10);
        const now = new Date();
        if (year > now.getFullYear() || (year === now.getFullYear() && monthIdx + 1 > now.getMonth() + 1)) {
          toast.error('Month/Year of Passing for a qualification cannot be in the future.');
          return false;
        }
      }
    }

    setLoading(true);
    const formData = buildFormData(status);

    try {
      const saveUrl = (isAdminMode && !isImpersonating) ? `${ADMIN_API}/applications/save-admin` : `${API}/applications/save`;
      const saveToken = (isAdminMode && !isImpersonating) ? adminToken : token;
      // save-admin requires application_id in body; portal mode gets it from user.application_id via getValues()
      if (isAdminMode && !isImpersonating && adminApplicationId) formData.set('application_id', adminApplicationId);
      const res = await axios.post(saveUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${saveToken}`,
        }
      });
      if (status === 'Submitted') {
        if (!isAdminMode && !isImpersonating && res.data?.application_id) {
          updateUser({ application_id: res.data.application_id });
        }
        toast.success('Application submitted successfully!');
        if ((isAdminMode || isImpersonating) && onAdminDone) { onAdminDone(); } else { navigate('/dashboard'); }
      } else {
        toast.success('Progress saved!');
      }
      return true;
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Error saving application. Please try again.';
      toast.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Save current step then advance — only navigates on confirmed save
  const handleSaveAndNext = async () => {
    setLoading(true);
    const formData = buildFormData('Draft');
    if (isAdminMode && !isImpersonating && adminApplicationId) formData.set('application_id', adminApplicationId);
    try {
      const stepUrl = (isAdminMode && !isImpersonating) ? `${ADMIN_API}/applications/save-admin` : `${API}/applications/save`;
      const stepToken = (isAdminMode && !isImpersonating) ? adminToken : token;
      await axios.post(stepUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${stepToken}` }
      });
      toast.success('Step saved!');
      setStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg = err.response?.data?.message || 'Save failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const stateOptions = () =>
    (states.length > 0 ? states : FALLBACK_STATES.map(s => ({ id: s, state_name: s })))
      .map(s => <option key={s.id} value={s.state_name}>{s.state_name}</option>);

  const districtOptions = (districts) =>
    districts.length > 0
      ? districts.map(d => <option key={d.id} value={d.district_name}>{d.district_name}</option>)
      : FALLBACK_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>);

  // ── STEP 1 ───────────────────────────────────────────────────────────────
  const Step1 = () => (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
        <h5 className="mb-0 fw-bold">+ Add New Application</h5>
      </div>
      <div className="card-body p-4">
        <div className="row g-4">
          {/* Left Side: Form Fields */}
          <div className="col-lg-9">
            {/* Row 1: Exam Centre Preferences — count driven by admin config */}
            <div className="row g-3 mb-3">
              {Array.from({ length: maxExamPreferences }, (_, i) => {
                const fieldName = `exam_center_${i + 1}`;
                const otherSelected = examCenterSelections.filter((v, j) => j !== i && v);
                return (
                  <div className="col-md-6" key={fieldName}>
                    <label className="form-label fw-semibold">
                      Exam Centre Preference {i + 1}{' '}
                      {i === 0 && <span className="text-danger">*</span>}
                    </label>
                    <select
                      className="form-select form-select-sm"
                      {...register(fieldName)}
                      disabled={isSubmitted}
                    >
                      <option value="">Select</option>
                      {(dropdowns.exam_centers || FALLBACK_EXAM_CENTERS)
                        .filter(c => !otherSelected.includes(c.name))
                        .map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Row 2: Department + Programme Offered */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">
                  Department <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-sm"
                  {...register('department_id')}
                  disabled={isSubmitted}
                >
                  <option value="">Select Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">
                  Programme Offered <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-sm"
                  {...register('program_offered_id')}
                  disabled={isSubmitted || !selectedDeptId || loadingPrograms}
                >
                  <option value="">
                    {!selectedDeptId ? 'Select Department first' : loadingPrograms ? 'Loading…' : 'Select Programme'}
                  </option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Eligibility hints — shown after programme is selected */}
            {selectedProgId && (
              <div className="row g-3 mb-3">
                <div className="col-md-12">
                  {loadingHints ? (
                    <div className="text-muted small">Loading eligibility…</div>
                  ) : (eligibilityHints.pg.length > 0 || eligibilityHints.mphil.length > 0 || eligibilityHints.integrated.length > 0) ? (
                    <div className="p-3 rounded-3" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                      <div className="fw-semibold mb-2" style={{ fontSize: 12, color: '#0369a1' }}>
                        Eligibility for the selected programme:
                      </div>
                      <div className="row g-2">
                        {eligibilityHints.pg.length > 0 && (
                          <div className="col-md-4">
                            <div className="fw-semibold text-success mb-1" style={{ fontSize: 11 }}>
                              Eligible PG Degrees ({eligibilityHints.pg.length})
                            </div>
                            <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                              {eligibilityHints.pg.map((c, i) => (
                                <div key={i} className="d-flex align-items-center gap-1 mb-1">
                                  <span style={{ width: 5, height: 5, background: '#22c55e', borderRadius: '50%', flexShrink: 0 }} />
                                  <span style={{ fontSize: 11 }}>{c}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {eligibilityHints.mphil.length > 0 && (
                          <div className="col-md-4">
                            <div className="fw-semibold text-warning mb-1" style={{ fontSize: 11 }}>
                              Eligible M.Phil Degrees ({eligibilityHints.mphil.length})
                            </div>
                            <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                              {eligibilityHints.mphil.map((c, i) => (
                                <div key={i} className="d-flex align-items-center gap-1 mb-1">
                                  <span style={{ width: 5, height: 5, background: '#f59e0b', borderRadius: '50%', flexShrink: 0 }} />
                                  <span style={{ fontSize: 11 }}>{c}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {eligibilityHints.integrated.length > 0 && (
                          <div className="col-md-4">
                            <div className="fw-semibold text-primary mb-1" style={{ fontSize: 11 }}>
                              Eligible Integrated Courses ({eligibilityHints.integrated.length})
                            </div>
                            <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                              {eligibilityHints.integrated.map((c, i) => (
                                <div key={i} className="d-flex align-items-center gap-1 mb-1">
                                  <span style={{ width: 5, height: 5, background: '#3b82f6', borderRadius: '50%', flexShrink: 0 }} />
                                  <span style={{ fontSize: 11 }}>{c}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Row 3: Category & Working District */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Category under which registration is sought <span className="text-danger">*</span></label>
                <select className="form-select form-select-sm" {...register('category')} disabled={isSubmitted}>
                  <option value="">Select</option>
                  {(dropdowns.categories || FALLBACK_CATEGORIES).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
              </div>
            </div>

            {/* Conditionally Render Part-Time Detailed Subcategories */}
            {category === 'Part Time' && (() => {
              const selectedPtCat = ptCategories.find(c => String(c.id) === String(partTimeCategoryVal));
              const currentHint = selectedPtCat?.category_hint;
              const selectedPtRole = ptRoles.find(r => String(r.id) === String(partTimeDesignationVal));
              const currentRoleHint = selectedPtRole?.role_hint;
              return (
                <div className="row g-3 mb-3 p-3 rounded-3 border bg-light bg-opacity-50 animate-fade-in">
                  <div className="col-md-12 mb-1 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <span className="badge bg-primary text-white px-2.5 py-1">Part-Time Validation Gate</span>
                    {globalDoc && (
                      <button
                        type="button"
                        className="btn btn-xs btn-primary text-white py-1 px-3.5 d-inline-flex align-items-center gap-1.5 fw-bold border-0 shadow-sm"
                        style={{ fontSize: '11px', borderRadius: '6px', height: '26px' }}
                        onClick={handleViewGlobalDoc}
                      >
                        <Eye size={12} className="text-white" /> View Guidance Document
                      </button>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Part-Time Category <span className="text-danger">*</span></label>
                    <select className="form-select form-select-sm" {...register('part_time_category_id')} disabled={isSubmitted}>
                      <option value="">Select Part-Time Category</option>
                      {ptCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Role / Designation <span className="text-danger">*</span></label>
                    <select className="form-select form-select-sm" {...register('part_time_designation_id')} disabled={isSubmitted}>
                      <option value="">Select Designation</option>
                      {ptRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Working State <span className="text-danger">*</span></label>
                    <select className="form-select form-select-sm" {...register('part_time_area')} disabled={isSubmitted || !partTimeDesignationVal}>
                      <option value="">{!partTimeDesignationVal ? 'Select Designation first' : 'Select Working State'}</option>
                      {ptAreas.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                  </div>
                  {/* Hidden area_id field for server-side FK resolution */}
                  <input type="hidden" {...register('part_time_area_id')} />
                  {ptDistricts.length > 0 && (
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">District <span className="text-danger">*</span></label>
                      <select className="form-select form-select-sm" {...register('part_time_district')} disabled={isSubmitted}>
                        <option value="">Select District</option>
                        {ptDistricts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                  )}

                  {currentHint && (
                    <div className="col-md-12 mt-2">
                      <div className="alert alert-info py-2 px-3 mb-0 d-flex align-items-start gap-2 border-info border-opacity-25" style={{ borderRadius: '6px', fontSize: '12px' }}>
                        <span style={{ fontSize: '15px', lineHeight: '1', cursor: 'default' }}>💡</span>
                        <div>
                          <strong className="d-block text-info-emphasis mb-0.5" style={{ fontWeight: '600' }}>
                            Registration Instructions for {selectedPtCat.name}
                            {selectedPtCat.category_reference_code && (
                              <span className="ms-2 badge bg-info-subtle text-info border border-info-subtle fw-bold" style={{ fontSize: '13px', fontWeight: '800', verticalAlign: 'middle', padding: '0.25em 0.6em' }}>§{selectedPtCat.category_reference_code}</span>
                            )}
                            :
                          </strong>
                          <span className="text-secondary" style={{ lineHeight: '1.4' }}>{currentHint}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentRoleHint && (
                    <div className="col-md-12 mt-2">
                      <div className="alert alert-warning py-2 px-3 mb-0 d-flex align-items-start gap-2 border-warning border-opacity-25" style={{ borderRadius: '6px', fontSize: '12px' }}>
                        <span style={{ fontSize: '15px', lineHeight: '1', cursor: 'default' }}>📋</span>
                        <div>
                          <strong className="d-block text-warning-emphasis mb-0.5" style={{ fontWeight: '600' }}>Guidelines for {selectedPtRole.name}:</strong>
                          <span className="text-secondary" style={{ lineHeight: '1.4' }}>{currentRoleHint}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Row 4: Name, Initial & DOB */}
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label fw-semibold">Applicant's Name <span className="text-danger">*</span><br /><small className="text-muted">(IN CAPITAL LETTERS)</small></label>
                <input type="text" className="form-control form-control-sm" placeholder="Enter Name" {...register('applicant_name')} disabled={isSubmitted} onInput={handleCapsAlphaInput} style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-semibold">Initial <span className="text-danger">*</span><br /><small className="text-muted">(CAPITAL)</small></label>
                <input type="text" className="form-control form-control-sm" placeholder="Initial" {...register('applicant_initial', { required: true })} maxLength={5} disabled={isSubmitted} onInput={handleCapsAlphaInput} style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Date of Birth <span className="text-danger">*</span><br /><small className="text-danger">(mm/dd/yyyy)</small></label>
                <input type="date" className="form-control form-control-sm" {...register('dob')} disabled={isSubmitted} />
              </div>
            </div>

            {/* Row 5: Name in Tamil */}
            <div className="row g-3 mb-3">
              <div className="col-md-12">
                <label className="form-label fw-semibold">விண்ணப்பதாரரின் பெயர் <br /><small className="text-muted">(தமிழ் எழுத்துக்களில்)</small></label>
                <input type="text" className="form-control form-control-sm" placeholder="பெயரை தமிழில் உள்ளிடவும்" {...register('applicant_name_tamil')} disabled={isSubmitted} onInput={handleAlphaInput} />
              </div>
            </div>

            {/* Row 6: Nationality & Religion */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Nationality <span className="text-danger">*</span></label>
                <select className="form-select form-select-sm" {...register('nationality')} disabled={isSubmitted}>
                  <option value="">Select Nationality</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Religion</label>
                <select className="form-select form-select-sm" {...register('religion')} disabled={isSubmitted}>
                  <option value="">Select Religion</option>
                  {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Row 7: Gender & Community */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Gender <span className="text-danger">*</span></label>
                <select className="form-select form-select-sm" {...register('gender', { required: true })} disabled={isSubmitted}>
                  <option value="">Select Gender</option>
                  {(dropdowns.genders || FALLBACK_GENDERS).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
                {errors.gender && <small className="text-danger d-block">Required</small>}
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Community <span className="text-danger">*</span></label>
                <select className="form-select form-select-sm mb-2" {...register('community', { required: true })} disabled={isSubmitted}>
                  <option value="">Select Community</option>
                  {(dropdowns.communities || FALLBACK_COMMUNITIES).map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                </select>
                {renderUploadControls('community_cert')}
                {errors.community && <small className="text-danger d-block mt-1">Please select your community</small>}
                
                {/* Dynamic Community Information & Fee Display Panel */}
                {selectedCommunityObj && (
                  <div className="card mt-3 border-info border-opacity-25 bg-info-subtle bg-opacity-10 shadow-sm animate-fade-in" style={{ borderRadius: '10px' }}>
                    <div className="card-body p-3">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <span style={{ fontSize: '16px' }}>📋</span>
                        <h6 className="fw-bold text-info-emphasis mb-0" style={{ fontSize: '13.5px' }}>Community Info Panel</h6>
                      </div>
                      <div className="small text-secondary mb-1.5">
                        <strong>Selected Community:</strong> <span className="text-dark fw-bold">{selectedCommunityObj.name}</span>
                      </div>
                      <div className="small text-secondary mb-1.5">
                        <strong>Minimum Required PG Percentage:</strong>{' '}
                        <span className="text-dark fw-bold">
                          {selectedCommunityObj.pg_min_mark != null ? `${selectedCommunityObj.pg_min_mark}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="small text-secondary">
                        <strong>Application Fee:</strong>{' '}
                        {isPhysicallyChallenged === 'Yes' ? (
                          <span className="text-success fw-bold">
                            ₹{selectedCommunityObj.differently_abled_fee || 500} <span className="badge bg-success-subtle text-success border border-success-subtle ms-1" style={{ fontSize: '10px', verticalAlign: 'middle' }}>Differently Abled Fee Applied</span>
                          </span>
                        ) : (
                          <span className="text-primary fw-bold">
                            ₹{selectedCommunityObj.general_fee || 1000}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 8: Parent Name */}
            <div className="row g-3">
              <div className="col-md-12">
                <label className="form-label fw-semibold">Parent / Husband / Guardian Name <span className="text-danger">*</span></label>
                <input type="text" className="form-control form-control-sm" {...register('parent_name')} disabled={isSubmitted} onInput={handleCapsAlphaInput} style={{ textTransform: 'uppercase' }} />
              </div>
            </div>
          </div>

          {/* Right Side: Photo & Signature */}
          <div className="col-lg-3 text-center border-start">
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
          </div>
        </div>
      </div>
    </div>
  );

  // ── STEP 2 ───────────────────────────────────────────────────────────────
  const Step2 = () => (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
        <h5 className="mb-0 fw-bold">Communication & Identity Details</h5>
      </div>
      <div className="card-body p-4">
        {/* Communication Address */}
        <p className="fw-bold text-secondary mb-3" style={{ fontSize: '14px' }}>Communication Address</p>
        <div className="row g-3 mb-4">
          <div className="col-12">
            <label className="form-label fw-semibold">Address for Communication <span className="text-danger">*</span> (Line 1)</label>
            <input type="text" className="form-control form-control-sm" {...register('address_1')} disabled={isSubmitted} />
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold">Line 2 <span className="text-danger">*</span></label>
            <input type="text" className="form-control form-control-sm" {...register('address_2')} disabled={isSubmitted} />
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold">Line 3</label>
            <input type="text" className="form-control form-control-sm" {...register('address_3')} disabled={isSubmitted} />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">State <span className="text-danger">*</span></label>
            <select className="form-select form-select-sm" {...register('state')} disabled={isSubmitted}>
              <option value="">Select State</option>
              {stateOptions()}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">District <span className="text-danger">*</span></label>
            <select className="form-select form-select-sm" {...register('district', { required: true })} disabled={isSubmitted}>
              <option value="">Select District</option>
              {districtOptions(commDistricts)}
            </select>
            {errors.district && <small className="text-danger d-block">Required</small>}
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">Pincode <span className="text-danger">*</span></label>
            <input type="text" className="form-control form-control-sm" style={{ width: '150px' }} maxLength={6} {...register('pincode')} disabled={isSubmitted} onInput={handleNumericInput} />
          </div>
        </div>

        {/* Permanent Address */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <p className="fw-bold text-secondary mb-0" style={{ fontSize: '14px' }}>Permanent Address</p>
          <div className="form-check mb-0">
            <input
              type="checkbox"
              className="form-check-input"
              id="permSameAsComm"
              {...register('perm_same_as_comm')}
              disabled={isSubmitted}
            />
            <label className="form-check-label fw-semibold" htmlFor="permSameAsComm" style={{ fontSize: '13px' }}>
              Same as Communication Address
            </label>
          </div>
        </div>
        <div className="row g-3 mb-4">
          <div className="col-12">
            <label className="form-label fw-semibold">Permanent Address <span className="text-danger">*</span> (Line 1)</label>
            <input type="text" className="form-control form-control-sm" {...register('perm_address_1')} disabled={isSubmitted || !!permSameAsComm} />
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold">Line 2</label>
            <input type="text" className="form-control form-control-sm" {...register('perm_address_2')} disabled={isSubmitted || !!permSameAsComm} />
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold">Line 3</label>
            <input type="text" className="form-control form-control-sm" {...register('perm_address_3')} disabled={isSubmitted || !!permSameAsComm} />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">State <span className="text-danger">*</span></label>
            <select className="form-select form-select-sm" {...register('perm_state')} disabled={isSubmitted || !!permSameAsComm}>
              <option value="">Select State</option>
              {stateOptions()}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">District <span className="text-danger">*</span></label>
            <select className="form-select form-select-sm" {...register('perm_district')} disabled={isSubmitted || !!permSameAsComm}>
              <option value="">Select District</option>
              {districtOptions(permDistricts)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">Pincode <span className="text-danger">*</span></label>
            <input type="text" className="form-control form-control-sm" style={{ width: '150px' }} maxLength={6} {...register('perm_pincode')} disabled={isSubmitted || !!permSameAsComm} onInput={handleNumericInput} />
          </div>
        </div>

        {/* Contact & Identity */}
        <p className="fw-bold text-secondary mb-3" style={{ fontSize: '14px' }}>Contact & Identity</p>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label fw-semibold">Mobile No. <span className="text-danger">*</span></label>
            <div className="d-flex gap-2">
              <select className="form-select form-select-sm" style={{ width: '130px' }} {...register('mobile_code')} disabled={isSubmitted}>
                {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>)}
              </select>
              <input type="text" className="form-control form-control-sm" maxLength={10} {...register('mobile')} disabled={isSubmitted} onInput={handleNumericInput} />
            </div>
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">Phone No.(LL)</label>
            <input type="text" className="form-control form-control-sm" {...register('phone')} disabled={isSubmitted} onInput={handleNumericInput} />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">E-mail ID <span className="text-danger">*</span></label>
            <input type="email" className="form-control form-control-sm bg-light" style={{ cursor: 'not-allowed' }} defaultValue={user?.email} {...register('email_id')} disabled />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold text-warning">Select ID <span className="text-danger">*</span> (Aadhaar / Voter / Passport)</label>
            <div className="d-flex gap-2 mb-2">
              <select className="form-select form-select-sm" style={{ width: '160px' }} {...register('id_type')} disabled={isSubmitted}>
                <option>Aadhaar No</option>
                <option>Voter ID</option>
                <option>Passport</option>
              </select>
              <input
                type="text"
                className="form-control form-control-sm"
                {...register('id_number', {
                  validate: (v) => {
                    if (idType === 'Aadhaar No') {
                      const digits = (v || '').replace(/\s/g, '');
                      return digits.length === 12 || 'Aadhaar must be exactly 12 digits';
                    }
                    return true;
                  }
                })}
                disabled={isSubmitted}
                maxLength={idType === 'Aadhaar No' ? 14 : 20}
                onInput={idType === 'Aadhaar No' ? handleAadhaarInput : handleNumericInput}
                placeholder={idType === 'Aadhaar No' ? '0000 0000 0000' : 'Enter ID Number'}
              />
            </div>
            {renderUploadControls('id_proof')}
            {errors.id_number && <small className="text-danger d-block mt-1">{errors.id_number.message}</small>}
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold">Physically Challenged</label>
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <select className="form-select form-select-sm mb-2" style={{ width: '100px' }} {...register('is_physically_challenged')} disabled={isSubmitted}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
              {isPhysicallyChallenged === 'Yes' && (
                <>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <label className="fw-semibold mb-0">Percentage (%)</label>
                    <input type="text" className="form-control form-control-sm" style={{ width: '80px' }} {...register('pc_percentage')} disabled={isSubmitted} onInput={handleNumericInput} placeholder="%" />
                    <label className="fw-semibold mb-0">Type of Challenge</label>
                    <select className="form-select form-select-sm" style={{ width: '180px' }} {...register('pc_type')} disabled={isSubmitted}>
                      <option value="">Select Type</option>
                      <option value="Visual">Visual</option>
                      <option value="Hearing">Hearing</option>
                      <option value="Orthopedic">Orthopedic</option>
                      <option value="Locomotor">Locomotor</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="w-100 mt-1">
                    {renderUploadControls('pc_cert')}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── STEP 3: Academic Details ──────────────────────────────────────────
  const Step3 = () => {
    const schoolData = watch('school_education') || [];
    const higherData = watch('higher_education') || [];

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

    const integratedVal = watch('integrated') || {};
    const isIntegratedComplete = !!(integratedVal.institution_name?.trim() && integratedVal.degree_id && integratedVal.passing_month && integratedVal.passing_year && integratedVal.score_value && integratedVal.registration_number);

    const hasSslc = watch('has_sslc') !== false;
    const hasHsc = watch('has_hsc') !== false;
    const hasUg = watch('has_ug') !== false;
    const hasPg = watch('has_pg') !== false;
    const hasDiploma = watch('has_diploma') === true || watch('has_diploma') === 1 || watch('has_diploma') === '1';
    const hasMphil = watch('has_mphil') === true || watch('has_mphil') === 1 || watch('has_mphil') === '1';
    const hasIntegrated = watch('has_integrated') === true || watch('has_integrated') === 1 || watch('has_integrated') === '1';

    const renderEducationRow = (prefix, label, level, isRequired = true) => {
      const boardId = watch(`${prefix}.board_id`);
      
      // Dynamic validation rules based on section toggle
      const rules = isRequired ? { required: 'This field is required' } : {};
      
      // Helper to get nested errors: school_education.0.xxx -> errors.school_education[0].xxx
      const getFieldError = (fieldName) => {
        const parts = `${prefix}.${fieldName}`.split('.');
        return parts.reduce((acc, part) => acc?.[part], errors);
      };

      const renderError = (fieldName) => {
        const error = getFieldError(fieldName);
        return error ? <div className="text-danger mt-1" style={{ fontSize: '11px' }}>{error.message}</div> : null;
      };

      return (
        <div className="mb-4 pb-3 border-bottom text-start">
          <input type="hidden" value={level} {...register(`${prefix}.level`)} />
          <div className="d-flex align-items-center gap-2 mb-3">
            <h6 className="fw-bold text-secondary mb-0">{label}</h6>
            {isRequired && <span className="badge bg-danger-subtle text-danger px-2 py-0.5" style={{ fontSize: '10px' }}>Mandatory</span>}
          </div>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label small fw-bold">Institution Name {isRequired && <span className="text-danger">*</span>}</label>
              <input type="text" className={`form-control form-control-sm ${getFieldError('institution_name') ? 'is-invalid' : ''}`} 
                {...register(`${prefix}.institution_name`, rules)} disabled={isSubmitted} />
              {renderError('institution_name')}
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-bold">Board {isRequired && <span className="text-danger">*</span>}</label>
              <select className={`form-select form-select-sm ${getFieldError('board_id') ? 'is-invalid' : ''}`} 
                {...register(`${prefix}.board_id`, rules)} disabled={isSubmitted}>
                <option value="">Select Board</option>
                {(dropdowns.education_boards || FALLBACK_EDUCATION_BOARDS).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {renderError('board_id')}
              {(dropdowns.education_boards || FALLBACK_EDUCATION_BOARDS).find(b => b.id == boardId)?.name === 'Others' && (
                <div className="mt-2">
                  <input type="text" className={`form-control form-control-sm ${getFieldError('other_board_name') ? 'is-invalid' : ''}`} 
                    placeholder="Enter Board Name" {...register(`${prefix}.other_board_name`, rules)} disabled={isSubmitted} />
                  {renderError('other_board_name')}
                </div>
              )}
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-bold">Passing Month {isRequired && <span className="text-danger">*</span>}</label>
              <select className={`form-select form-select-sm ${getFieldError('passing_month') ? 'is-invalid' : ''}`} 
                {...register(`${prefix}.passing_month`, rules)} disabled={isSubmitted}>
                <option value="">Month</option>
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {renderError('passing_month')}
            </div>
            <div className="col-md-1">
              <label className="form-label small fw-bold">Year {isRequired && <span className="text-danger">*</span>}</label>
              <select
                className={`form-select form-select-sm ${getFieldError('passing_year') || (level === 'HSC' && timelineErrors.hsc) ? 'is-invalid' : ''}`}
                {...register(`${prefix}.passing_year`, rules)} disabled={isSubmitted}>
                <option value="">Year</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {renderError('passing_year')}
              {level === 'HSC' && timelineErrors.hsc && (
                <div className="text-danger mt-1" style={{ fontSize: '11px' }}>{timelineErrors.hsc}</div>
              )}
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-bold">Percentage {isRequired && <span className="text-danger">*</span>}</label>
              <input type="number" step="0.01" className={`form-control form-control-sm ${getFieldError('percentage') ? 'is-invalid' : ''}`} 
                {...register(`${prefix}.percentage`, rules)} disabled={isSubmitted} />
              {renderError('percentage')}
            </div>
            <div className="col-md-12">
              {renderUploadControls(`${prefix}_marksheet`)}
            </div>
          </div>
        </div>
      );
    };

    const renderHigherEdRow = (prefix, label, semLevel, degreeLevel, isRequired = true, eligibleCourses = [], hideSpecialization = false) => {
      // eligibleCourses: string[] from eligibility hints (PG/M.Phil only)
      // hideSpecialization: true for PG/M.Phil — course name replaces degree+specialization pair
      const isEligibilityMode = hideSpecialization;
      const semArr   = semLevel === 'ug' ? ugSemesters : semLevel === 'pg' ? pgSemesters
                     : semLevel === 'diploma' ? diplomaSemesters : semLevel === 'integrated' ? integratedSemesters : mphilSemesters;
      const markType = semLevel === 'ug' ? ugMarkType  : semLevel === 'pg' ? pgMarkType
                     : semLevel === 'diploma' ? diplomaMarkType  : semLevel === 'integrated' ? integratedMarkType : mphilMarkType;
      const filterLevel = degreeLevel || label.split(' ')[0];
      const semPrefix = `${semLevel}_sem_`;
      const semKeys   = semArr.filter(k => k.startsWith(semPrefix));

      const rules = isRequired ? { required: 'This field is required' } : {};
      
      const getFieldError = (fieldName) => {
        const parts = `${prefix}.${fieldName}`.split('.');
        return parts.reduce((acc, part) => acc?.[part], errors);
      };

      const renderError = (fieldName) => {
        const error = getFieldError(fieldName);
        return error ? <div className="text-danger mt-1" style={{ fontSize: '11px' }}>{error.message}</div> : null;
      };

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

      return (
        <div className="mb-4 pb-3 border-bottom text-start">
          <input type="hidden" value={degreeLevel || label.split(' ')[0]} {...register(`${prefix}.level`)} />
          <div className="d-flex align-items-center gap-2 mb-3">
            <h6 className="fw-bold text-secondary mb-0">{label}</h6>
            {isRequired && <span className="badge bg-danger-subtle text-danger px-2 py-0.5" style={{ fontSize: '10px' }}>Mandatory</span>}
          </div>
          <div className="row g-3">
            {semLevel === 'mphil' ? (
              /* ── M.Phil centralized Course Master dropdown ── */
              <div className="col-md-6">
                <label className="form-label small fw-bold">
                  M.Phil Course {isRequired && <span className="text-danger">*</span>}
                </label>
                <select
                  className={`form-select form-select-sm ${getFieldError('degree_name') ? 'is-invalid' : ''}`}
                  {...register(`${prefix}.degree_name`, rules)}
                  disabled={isSubmitted}
                >
                  <option value="">Select M.Phil Course</option>
                  {(dropdowns.mphil_courses || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                {renderError('degree_name')}
              </div>
            ) : isEligibilityMode ? (
              /* ── Eligibility-driven course name (PG / M.Phil / Integrated) ── */
              <>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">
                    {degreeLevel === 'Integrated' ? 'Integrated Course Name' : 'Eligible Course'} {isRequired && <span className="text-danger">*</span>}
                  </label>
                  {eligibleCourses.length > 0 ? (
                    <>
                      <select
                        className={`form-select form-select-sm ${getFieldError('degree_name') ? 'is-invalid' : ''}`}
                        {...register(`${prefix}.degree_name`, rules)}
                        disabled={isSubmitted}
                      >
                        <option value="">Select {degreeLevel === 'Integrated' ? 'Course' : 'Eligible Course'}</option>
                        {eligibleCourses.map(c => <option key={c} value={c}>{c}</option>)}
                        {degreeLevel === 'Integrated' && <option value="Others">Others (please specify below)</option>}
                      </select>
                      {renderError('degree_name')}
                      <div className="text-muted mt-1" style={{ fontSize: '10px' }}>
                        {degreeLevel === 'Integrated' ? 'Select your integrated course or choose Others to enter manually.' : 'Only courses mapped by admin for this programme are shown.'}
                      </div>
                    </>
                  ) : selectedProgId ? (
                    <div className="alert alert-warning py-2 px-3 mb-0" style={{ fontSize: '12px', borderRadius: '6px' }}>
                      No eligible courses have been mapped for this programme yet. Please contact the university.
                    </div>
                  ) : (
                    <div className="alert alert-info py-2 px-3 mb-0" style={{ fontSize: '12px', borderRadius: '6px' }}>
                      Please select a Department and Programme above to see eligible courses.
                    </div>
                  )}
                </div>
                {/* "Others" text input — shown only for Integrated when "Others" is selected */}
                {degreeLevel === 'Integrated' && watch(`${prefix}.degree_name`) === 'Others' && (
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">
                      Specify Course Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control form-control-sm ${getFieldError('degree_name_other') ? 'is-invalid' : ''}`}
                      {...register(`${prefix}.degree_name_other`, {
                        validate: v => watch(`${prefix}.degree_name`) !== 'Others' || (v && v.trim()) ? true : 'Please specify the course name'
                      })}
                      placeholder="Enter your integrated course name"
                      disabled={isSubmitted}
                    />
                    {renderError('degree_name_other')}
                  </div>
                )}
              </>
            ) : (
              /* ── Standard degree + specialization (UG / Diploma — NOT Integrated) ── */
              <>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">Degree {isRequired && <span className="text-danger">*</span>}</label>
                  <select className={`form-select form-select-sm ${getFieldError('degree_id') ? 'is-invalid' : ''}`}
                    {...register(`${prefix}.degree_id`, rules)} disabled={isSubmitted}>
                    <option value="">Select Degree</option>
                    {(dropdowns.degree_types || FALLBACK_DEGREE_TYPES).filter(d => !filterLevel || d.level === filterLevel).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {renderError('degree_id')}
                </div>
                {/* Module 3: Specialization removed from Integrated Course — keep for UG/Diploma only */}
                {degreeLevel !== 'Integrated' && (
                  <>
                    <div className="col-md-3">
                      <label className="form-label small fw-bold">Specialization {isRequired && <span className="text-danger">*</span>}</label>
                      <select className={`form-select form-select-sm ${getFieldError('specialization_id') ? 'is-invalid' : ''}`}
                        {...register(`${prefix}.specialization_id`, rules)} disabled={isSubmitted}>
                        <option value="">Select Specialization</option>
                        {(dropdowns.specializations || FALLBACK_SPECIALIZATIONS).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        <option value="Others">Others (please specify)</option>
                      </select>
                      {renderError('specialization_id')}
                    </div>
                    {watch(`${prefix}.specialization_id`) === 'Others' && (
                      <div className="col-md-3">
                        <label className="form-label small fw-bold">Specify Specialization <span className="text-danger">*</span></label>
                        <input type="text" className={`form-control form-control-sm ${getFieldError('specialization_other') ? 'is-invalid' : ''}`}
                          placeholder="Enter your specialization"
                          {...register(`${prefix}.specialization_other`, {
                            validate: v => watch(`${prefix}.specialization_id`) !== 'Others' || (v && v.trim()) ? true : 'Please specify your specialization'
                          })}
                          disabled={isSubmitted} />
                        {renderError('specialization_other')}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            <div className="col-md-3">
              <label className="form-label small fw-bold">Institution Name {isRequired && <span className="text-danger">*</span>}</label>
              <input type="text" className={`form-control form-control-sm ${getFieldError('institution_name') ? 'is-invalid' : ''}`} 
                {...register(`${prefix}.institution_name`, rules)} disabled={isSubmitted} />
              {renderError('institution_name')}
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-bold">University Name {isRequired && <span className="text-danger">*</span>}</label>
              <input type="text" className={`form-control form-control-sm ${getFieldError('university_name') ? 'is-invalid' : ''}`} 
                {...register(`${prefix}.university_name`, rules)} disabled={isSubmitted} />
              {renderError('university_name')}
            </div>
            {degreeLevel === 'Integrated' && (
              <div className="col-md-3">
                <label className="form-label small fw-bold">Registration Number {isRequired && <span className="text-danger">*</span>}</label>
                <input type="text" className={`form-control form-control-sm ${getFieldError('registration_number') ? 'is-invalid' : ''}`}
                  {...register(`${prefix}.registration_number`, rules)} disabled={isSubmitted} />
                {renderError('registration_number')}
              </div>
            )}
            <div className="col-md-3">
              <label className="form-label small fw-bold">University Type {isRequired && <span className="text-danger">*</span>}</label>
              <select className={`form-select form-select-sm ${getFieldError('university_type_id') ? 'is-invalid' : ''}`} 
                {...register(`${prefix}.university_type_id`, rules)} disabled={isSubmitted}>
                <option value="">Select Type</option>
                {(dropdowns.university_types || FALLBACK_UNIVERSITY_TYPES).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {renderError('university_type_id')}
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-bold">Passing Month {isRequired && <span className="text-danger">*</span>}</label>
              <select className={`form-select form-select-sm ${getFieldError('passing_month') ? 'is-invalid' : ''}`} 
                {...register(`${prefix}.passing_month`, rules)} disabled={isSubmitted}>
                <option value="">Month</option>
                {["January","February","March","April","May","June","July","August","September","October","November","December"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {renderError('passing_month')}
            </div>
            <div className="col-md-1">
              <label className="form-label small fw-bold">
                {(degreeLevel === 'UG' || degreeLevel === 'PG' || degreeLevel === 'Integrated') ? 'Completion Year' : 'Year'}
                {isRequired && <span className="text-danger">*</span>}
              </label>
              <select className={`form-select form-select-sm ${getFieldError('passing_year') || (degreeLevel === 'UG' && timelineErrors.ugEnd) || (degreeLevel === 'PG' && timelineErrors.pgEnd) ? 'is-invalid' : ''}`}
                {...register(`${prefix}.passing_year`, rules)} disabled={isSubmitted}>
                <option value="">Year</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {renderError('passing_year')}
              {degreeLevel === 'UG' && timelineErrors.ugEnd && (
                <div className="text-danger mt-1" style={{ fontSize: '11px' }}>{timelineErrors.ugEnd}</div>
              )}
              {degreeLevel === 'PG' && timelineErrors.pgEnd && (
                <div className="text-danger mt-1" style={{ fontSize: '11px' }}>{timelineErrors.pgEnd}</div>
              )}
            </div>

            {/* Module 2: Start Year — shown for UG, PG, Integrated only */}
            {(degreeLevel === 'UG' || degreeLevel === 'PG' || degreeLevel === 'Integrated') && (
              <div className="col-md-1">
                <label className="form-label small fw-bold">
                  Start Year <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select form-select-sm ${
                    (degreeLevel === 'UG' && timelineErrors.ugStart) ||
                    (degreeLevel === 'PG' && timelineErrors.pgStart) ||
                    (degreeLevel === 'Integrated' && timelineErrors.intStart)
                      ? 'is-invalid' : ''
                  }`}
                  {...register(`${prefix}.start_year`, isRequired ? { required: 'Start year is required' } : {})}
                  disabled={isSubmitted}
                >
                  <option value="">Year</option>
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {degreeLevel === 'UG' && timelineErrors.ugStart && (
                  <div className="text-danger mt-1" style={{ fontSize: '11px' }}>{timelineErrors.ugStart}</div>
                )}
                {degreeLevel === 'PG' && timelineErrors.pgStart && (
                  <div className="text-danger mt-1" style={{ fontSize: '11px' }}>{timelineErrors.pgStart}</div>
                )}
                {degreeLevel === 'Integrated' && timelineErrors.intStart && (
                  <div className="text-danger mt-1" style={{ fontSize: '11px' }}>{timelineErrors.intStart}</div>
                )}
              </div>
            )}

            <div className="col-md-2">
              <label className="form-label small fw-bold">Score {isRequired && <span className="text-danger">*</span>}</label>
              <div className="input-group input-group-sm">
                <select className="form-select p-1" style={{ maxWidth: '80px' }} {...register(`${prefix}.score_type`)} disabled={isSubmitted}>
                  <option>Percentage</option><option>CGPA</option>
                </select>
                <input type="number" step="0.01" className={`form-control ${getFieldError('score_value') ? 'is-invalid' : ''}`} 
                  {...register(`${prefix}.score_value`, rules)} disabled={isSubmitted} />
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
                          {...register(`${semLevel}_mark_statement_type`)} disabled={isSubmitted} />
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
                        {...register(`${semLevel}_is_awaiting_final_sem`)} disabled={isSubmitted} />
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
                                {!isSubmitted && semKeys.length > 1 && (
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
                      {!isSubmitted && semKeys.length < (activeSetting?.max_semesters || 10) && (
                        <button type="button" className="btn btn-sm btn-outline-success"
                          onClick={() => addSemester(semLevel)}>+ Add Next Semester</button>
                      )}
                      <small className="text-muted">{semKeys.length}/{activeSetting?.max_semesters || 10} semesters</small>
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

    return (
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
          <h5 className="mb-0 fw-bold">Academic Details</h5>
        </div>
        <div className="card-body p-4">
          {/* Module 4: Original Document Verification Notice */}
          <div className="mb-4 p-3 d-flex align-items-start gap-3" style={{ background: '#fff8e1', border: '1px solid #f59e0b', borderLeft: '5px solid #f59e0b', borderRadius: '8px' }}>
            <span style={{ fontSize: '22px', flexShrink: 0, marginTop: '1px' }}>⚠️</span>
            <div>
              <div className="fw-bold mb-1" style={{ color: '#92400e', fontSize: '13.5px', letterSpacing: '0.3px' }}>IMPORTANT — Original Document Upload Notice</div>
              <div style={{ color: '#78350f', fontSize: '12.5px', lineHeight: '1.7' }}>
                Upload only <strong>original academic documents</strong>. Scanned copies must be <strong>clear, readable and unaltered</strong>.
                Tampered, edited, incomplete or misleading documents may result in <strong>rejection of the application</strong> during verification.
                The University reserves the right to request original documents at any stage of admission.
              </div>
            </div>
          </div>

          <div className="alert alert-info py-2 small mb-4 d-flex align-items-center gap-2">
            <span style={{ fontSize: '16px' }}>📌</span>
            <span><strong>Interactive Panel:</strong> Click on any section box below to expand/collapse and fill out details. Sections turn green when completed.</span>
          </div>

          {/* 1. SSLC Box */}
          <div className="border rounded-4 mb-3 shadow-sm" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.sslc ? '#32b5c0' : '#e2e8f0' }}>
            <div 
              className="d-flex align-items-center justify-content-between p-3 select-none" 
              onClick={() => {
                if (isSubmitted) return;
                const nextVal = !hasSslc;
                setValue('has_sslc', nextVal);
                setExpandedAcademicSections(prev => ({ ...prev, sslc: nextVal }));
              }}
              style={{ cursor: isSubmitted ? 'default' : 'pointer', background: expandedAcademicSections.sslc ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.sslc ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
            >
              <div className="d-flex align-items-center gap-3">
                <input 
                  type="checkbox" 
                  className="form-check-input mt-0" 
                  checked={hasSslc}
                  disabled={isSubmitted}
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
          <div className="border rounded-4 mb-3 shadow-sm" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.hsc ? '#32b5c0' : '#e2e8f0' }}>
            <div 
              className="d-flex align-items-center justify-content-between p-3 select-none" 
              onClick={() => {
                if (isSubmitted) return;
                const nextVal = !hasHsc;
                setValue('has_hsc', nextVal);
                setExpandedAcademicSections(prev => ({ ...prev, hsc: nextVal }));
              }}
              style={{ cursor: isSubmitted ? 'default' : 'pointer', background: expandedAcademicSections.hsc ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.hsc ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
            >
              <div className="d-flex align-items-center gap-3">
                <input 
                  type="checkbox" 
                  className="form-check-input mt-0" 
                  checked={hasHsc}
                  disabled={isSubmitted}
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
          <div className="border rounded-4 mb-3 shadow-sm" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.diploma ? '#32b5c0' : '#e2e8f0' }}>
            <div 
              className="d-flex align-items-center justify-content-between p-3 select-none" 
              onClick={() => {
                if (isSubmitted) return;
                const nextVal = !hasDiploma;
                setValue('has_diploma', nextVal);
                setExpandedAcademicSections(prev => ({ ...prev, diploma: nextVal }));
              }}
              style={{ cursor: isSubmitted ? 'default' : 'pointer', background: expandedAcademicSections.diploma ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.diploma ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
            >
              <div className="d-flex align-items-center gap-3">
                <input 
                  type="checkbox" 
                  className="form-check-input mt-0" 
                  checked={hasDiploma}
                  disabled={isSubmitted}
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
          <div className="border rounded-4 mb-3 shadow-sm" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.ug ? '#32b5c0' : '#e2e8f0' }}>
            <div 
              className="d-flex align-items-center justify-content-between p-3 select-none" 
              onClick={() => {
                if (isSubmitted) return;
                const nextVal = !hasUg;
                setValue('has_ug', nextVal);
                setExpandedAcademicSections(prev => ({ ...prev, ug: nextVal }));
              }}
              style={{ cursor: isSubmitted ? 'default' : 'pointer', background: expandedAcademicSections.ug ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.ug ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
            >
              <div className="d-flex align-items-center gap-3">
                <input 
                  type="checkbox" 
                  className="form-check-input mt-0" 
                  checked={hasUg}
                  disabled={isSubmitted}
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
          <div className="border rounded-4 mb-3 shadow-sm" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.pg ? '#32b5c0' : '#e2e8f0' }}>
            <div 
              className="d-flex align-items-center justify-content-between p-3 select-none" 
              onClick={() => {
                if (isSubmitted) return;
                const nextVal = !hasPg;
                setValue('has_pg', nextVal);
                setExpandedAcademicSections(prev => ({ ...prev, pg: nextVal }));
              }}
              style={{ cursor: isSubmitted ? 'default' : 'pointer', background: expandedAcademicSections.pg ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.pg ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
            >
              <div className="d-flex align-items-center gap-3">
                <input 
                  type="checkbox" 
                  className="form-check-input mt-0" 
                  checked={hasPg}
                  disabled={isSubmitted}
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
                {renderHigherEdRow('higher_education.1', 'PG Details', 'pg', 'PG', hasPg, eligibilityHints.pg, true)}
              </div>
            )}
          </div>

          {/* 6. M.Phil Box */}
          <div className="border rounded-4 mb-3 shadow-sm" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.mphil ? '#32b5c0' : '#e2e8f0' }}>
            <div 
              className="d-flex align-items-center justify-content-between p-3 select-none" 
              onClick={() => {
                if (isSubmitted) return;
                const nextVal = !hasMphil;
                setValue('has_mphil', nextVal);
                setExpandedAcademicSections(prev => ({ ...prev, mphil: nextVal }));
              }}
              style={{ cursor: isSubmitted ? 'default' : 'pointer', background: expandedAcademicSections.mphil ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.mphil ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
            >
              <div className="d-flex align-items-center gap-3">
                <input 
                  type="checkbox" 
                  className="form-check-input mt-0" 
                  checked={hasMphil}
                  disabled={isSubmitted}
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
                {renderHigherEdRow('mphil', 'M.Phil Details', 'mphil', 'M.Phil', hasMphil, [], false)}
              </div>
            )}
          </div>

          {/* 7. 5-Year Integrated Course Box */}
          <div className="border rounded-4 mb-3 shadow-sm" style={{ overflow: 'hidden', borderColor: expandedAcademicSections.integrated ? '#32b5c0' : '#e2e8f0' }}>
            <div 
              className="d-flex align-items-center justify-content-between p-3 select-none" 
              onClick={() => {
                if (isSubmitted) return;
                const nextVal = !hasIntegrated;
                setValue('has_integrated', nextVal);
                setExpandedAcademicSections(prev => ({ ...prev, integrated: nextVal }));
              }}
              style={{ cursor: isSubmitted ? 'default' : 'pointer', background: expandedAcademicSections.integrated ? '#f4fbfb' : '#fff', borderBottom: expandedAcademicSections.integrated ? '1px solid #e2e8f0' : 'none', transition: 'all 0.2s' }}
            >
              <div className="d-flex align-items-center gap-3">
                <input 
                  type="checkbox" 
                  className="form-check-input mt-0" 
                  checked={hasIntegrated}
                  disabled={isSubmitted}
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
                {renderHigherEdRow('integrated', '5-Year Integrated Course Details', 'integrated', 'Integrated', hasIntegrated, eligibilityHints.integrated, eligibilityHints.integrated.length > 0)}
              </div>
            )}
          </div>
          {/* Module 2: Timeline error summary */}
          {hasTimelineErrors && (
            <div className="alert alert-danger mt-4 shadow-sm" style={{ borderRadius: '10px', borderLeft: '4px solid #dc3545' }}>
              <div className="d-flex align-items-start gap-2">
                <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</span>
                <div>
                  <strong className="text-danger d-block mb-1">Academic Timeline Errors</strong>
                  <ul className="mb-0 ps-3" style={{ fontSize: '12.5px' }}>
                    {Object.values(timelineErrors).map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                  <div className="text-muted mt-2" style={{ fontSize: '11.5px' }}>
                    Please correct the highlighted fields before saving or proceeding.
                  </div>
                </div>
              </div>
            </div>
          )}

          {isValidationApplicable && !isEligible && enteredPercentage !== null && (
            <div className="alert alert-danger d-flex align-items-center gap-2 mt-4 shadow-sm border-danger border-opacity-25 animate-fade-in" style={{ borderRadius: '10px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <div>
                <strong className="text-danger">Eligibility Alert:</strong> Minimum required PG percentage for your selected community is <span className="fw-bold">{requiredPercentage}%</span>. Your entered percentage is <span className="fw-bold">{enteredPercentage}%</span>.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── STEP 4: Experience & Declaration ───────────────────────────────────
  const Step4 = () => {
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

    const loadExpDistricts = async (idx, stateId) => {
      if (!stateId) { setExpDistricts(prev => ({ ...prev, [idx]: [] })); return; }
      try {
        const r = await axios.get(`${API}/districts?state_id=${stateId}`);
        setExpDistricts(prev => ({ ...prev, [idx]: r.data.data || [] }));
      } catch { setExpDistricts(prev => ({ ...prev, [idx]: [] })); }
    };

    const handleExpStateChange = async (idx, stateId) => {
      setValue(`experience_details.${idx}.state_id`, stateId);
      setValue(`experience_details.${idx}.district_id`, '');
      await loadExpDistricts(idx, stateId);
    };

    const addExperience = () => {
      const current = getValues('experience_details') || [];
      setValue('experience_details', [...current, {
        designation: '', organization_name: '', employment_type_id: '',
        from_month: '', from_year: '', to_month: '', to_year: '',
        from_date: '', to_date: '',
        total_years: 0, total_months: 0,
        state_id: '', district_id: '', experience_certificate_path: '',
        address: ''
      }]);
    };

    const removeExperience = (idx) => {
      const current = getValues('experience_details');
      setValue('experience_details', current.filter((_, i) => i !== idx));
      setExpDistricts(prev => {
        const next = {};
        Object.keys(prev).forEach(key => {
          const k = parseInt(key);
          if (k < idx) next[k] = prev[k];
          else if (k > idx) next[k - 1] = prev[k];
        });
        return next;
      });
    };

    return (
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-header py-3" style={{ background: '#32b5c0', color: '#fff' }}>
          <h5 className="mb-0 fw-bold">Experience & Declaration</h5>
        </div>
        <div className="card-body p-4">
          {/* ── Work Experience — visible only for Part Time candidates ─────────
               Full Time applicants don't need to submit work history, so we
               hide the entire block and clear any accumulated entries when the
               category is not "Part Time".  The max-height / opacity transition
               gives a smooth accordion effect without an extra library. */}
          <div
            className="work-experience-section"
            style={{
              overflow: 'hidden',
              maxHeight: category === 'Part Time' ? '9999px' : '0px',
              opacity: category === 'Part Time' ? 1 : 0,
              transition: 'max-height 0.45s ease-in-out, opacity 0.35s ease-in-out',
              pointerEvents: category === 'Part Time' ? 'auto' : 'none',
            }}
          >
            <div className="section-title mb-4 bg-light p-2 rounded fw-bold text-primary d-flex align-items-center gap-2">
              I. WORK EXPERIENCE
              <span className="badge bg-danger ms-1" style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                Required for Part Time
              </span>
            </div>

            <div className="row g-3 mb-4">
              {experienceData.map((exp, idx) => (
                <div key={idx} className="col-12">
                  <div className="border rounded-3 p-3 bg-white shadow-sm position-relative">
                    <button type="button" className="btn btn-sm btn-outline-danger position-absolute top-0 end-0 mt-2 me-2" onClick={() => removeExperience(idx)} style={{ width: '28px', height: '28px', padding: '0', borderRadius: '50%' }}>×</button>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label small fw-bold">Designation & Organization</label>
                        <input type="text" className="form-control form-control-sm mb-1" placeholder="Designation" {...register(`experience_details.${idx}.designation`)} disabled={isSubmitted} />
                        <input type="text" className="form-control form-control-sm" placeholder="Organization Name" {...register(`experience_details.${idx}.organization_name`)} disabled={isSubmitted} />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label small fw-bold">Employment Type</label>
                        <select className="form-select form-select-sm" {...register(`experience_details.${idx}.employment_type_id`)} disabled={isSubmitted}>
                          <option value="">Select Type</option>
                          {(dropdowns.employment_types || FALLBACK_EMPLOYMENT_TYPES).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-bold">Duration (From → To)</label>
                        <div className="d-flex flex-column gap-1">
                          <input type="date" className="form-control form-control-sm" {...register(`experience_details.${idx}.from_date`)} disabled={isSubmitted} />
                          <input type="date" className="form-control form-control-sm" {...register(`experience_details.${idx}.to_date`)} disabled={isSubmitted} />
                        </div>
                      </div>
                      <div className="col-md-1 d-flex flex-column justify-content-center">
                        <span className="small text-muted d-block mb-1">Duration:</span>
                        <span className="fw-bold text-primary small">{calculateDuration(idx)}</span>
                      </div>
                      <div className="col-md-12">
                        <label className="form-label small fw-bold">Organization Address</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Enter Organization Address"
                          {...register(`experience_details.${idx}.address`)}
                          disabled={isSubmitted}
                        />
                      </div>
                      <div className="col-md-12 pt-2 border-top mt-1">
                        <div className="d-flex align-items-center gap-3 flex-wrap">
                          <span className="small fw-bold text-secondary">Experience Certificate:</span>
                          <div className="flex-grow-1">
                            {renderUploadControls(`exp_cert_${idx}`)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="col-12 text-center mt-2">
                <button type="button" className="btn btn-sm btn-outline-success" onClick={addExperience}>+ Add Experience Record</button>
              </div>
            </div>
          </div>
          {/* ── Hint shown when Full Time is selected ─── */}
          {category === 'Full Time' && (
            <div className="alert alert-info py-2 small mb-4 d-flex align-items-center gap-2">
              <span>ℹ️</span>
              <span>Work Experience section is not applicable for <strong>Full Time</strong> candidates and has been hidden.</span>
            </div>
          )}
          {/* ── Prompt to select category if not yet chosen ─── */}
          {!category && (
            <div className="alert alert-warning py-2 small mb-4">
              Please select a <strong>Category</strong> (Step 1) to determine whether work experience details are required.
            </div>
          )}

          <div className="section-title my-4 bg-light p-2 rounded fw-bold text-primary">II. OTHER QUALIFICATIONS & DECLARATION</div>
          <div className="alert alert-info py-2 small mb-3">
            If you hold NET / SET / JRF / SLET or any admin-listed qualification, select below to upload your certificate.
            Exemption qualifications allow you to bypass the entrance exam and proceed directly to interview.
          </div>

          {/* Dynamic qualification checkboxes loaded from admin */}
          <div className="row g-3 mb-4">
            {qualificationTypes.map(qt => {
              const isChecked = selectedQualIds.has(qt.id);
              const certKey   = `qual_cert_${qt.id}`;
              return (
                <div key={qt.id} className="col-12">
                  <div className={`border rounded-3 p-3 ${isChecked ? 'border-primary bg-light' : 'bg-white'}`}>
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                      <div className="form-check mb-0">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`qual_${qt.id}`}
                          checked={isChecked}
                          disabled={isSubmitted}
                          onChange={e => {
                            setSelectedQualIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(qt.id);
                              else {
                                next.delete(qt.id);
                                removeFile(certKey);
                                setQualDates(d => { const n = { ...d }; delete n[qt.id]; return n; });
                              }
                              return next;
                            });
                          }}
                        />
                        <label className="form-check-label fw-bold" htmlFor={`qual_${qt.id}`}>
                          {qt.qualification_name}
                        </label>
                      </div>
                      {qt.is_exemption === 1 && (
                        <span className="badge bg-warning text-dark" style={{ fontSize: 10 }}>Direct Interview (Exempted from Entrance)</span>
                      )}
                      {/* Month & Year of Passing + Certificate upload — when qualification is selected */}
                      {isChecked && (
                        <div className="mt-2 w-100">
                          <div className="row g-2 align-items-end mb-2">
                            <div className="col-auto">
                              <label className="form-label small fw-bold mb-1">
                                Month of Passing <span className="text-danger">*</span>
                              </label>
                              <select
                                className={`form-select form-select-sm ${isChecked && !(qualDates[qt.id]?.month) && !isSubmitted ? '' : ''}`}
                                value={qualDates[qt.id]?.month || ''}
                                disabled={isSubmitted}
                                onChange={e => setQualDates(prev => ({ ...prev, [qt.id]: { ...(prev[qt.id] || {}), month: e.target.value } }))}
                                style={{ minWidth: 140 }}
                              >
                                <option value="">Select Month</option>
                                {QUAL_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                            <div className="col-auto">
                              <label className="form-label small fw-bold mb-1">
                                Year of Passing <span className="text-danger">*</span>
                              </label>
                              <select
                                className="form-select form-select-sm"
                                value={qualDates[qt.id]?.year || ''}
                                disabled={isSubmitted}
                                onChange={e => {
                                  const yr = parseInt(e.target.value, 10);
                                  const mon = qualDates[qt.id]?.month;
                                  const now = new Date();
                                  const mIdx = QUAL_MONTHS.indexOf(mon);
                                  if (yr > now.getFullYear() || (yr === now.getFullYear() && mIdx !== -1 && mIdx + 1 > now.getMonth() + 1)) return;
                                  setQualDates(prev => ({ ...prev, [qt.id]: { ...(prev[qt.id] || {}), year: e.target.value } }));
                                }}
                                style={{ minWidth: 100 }}
                              >
                                <option value="">Select Year</option>
                                {QUAL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                            </div>
                            <div className="col-auto ms-auto">
                              {renderUploadControls(certKey)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {qualificationTypes.length === 0 && (
              <div className="col-12 text-muted small">Loading qualification options…</div>
            )}
          </div>

          <div className="alert alert-warning d-flex align-items-start gap-3">
            <input type="checkbox" className="form-check-input mt-1" {...register('declarationAccepted', { required: true })} disabled={isSubmitted} />
            <div>
              <strong>Declaration:</strong> I hereby acknowledge that the university has the authority to reject my application at any stage.
            </div>
          </div>
        </div>
      </div>
    );
  };

  const steps = [Step1, Step2, Step3, Step4];

  return (
    <div className="bg-light min-vh-100 pb-5">
      {!isAdminMode && !isImpersonating && <Header />}
      <div className="container mt-4">
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/dashboard">Application List</a></li>
            <li className="breadcrumb-item active">Add New</li>
          </ol>
        </nav>

        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center gap-3">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="btn btn-sm btn-white border shadow-sm d-flex align-items-center gap-2 px-3 fw-bold" 
              style={{ borderRadius: '20px', height: '36px' }}
            >
              <ArrowLeft size={16} className="text-secondary" />
              <span>Back</span>
            </button>
            <div>
              <h4 className="fw-bold mb-0">Add New Application <small className="text-muted fs-6 fw-normal">add new application here..</small></h4>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="card border-0 shadow-sm rounded-4 mb-4 p-3">
          {appStatus === 'Rejected' && (
            <div className="alert alert-danger py-3 px-4 mb-3 rounded-4 shadow-sm" style={{ borderLeft: '5px solid #dc2626', background: '#fef2f2' }}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <XCircle size={22} className="text-danger" />
                <h5 className="alert-heading fw-bold mb-0 text-danger" style={{ fontSize: '15px' }}>Application Status: REJECTED</h5>
              </div>
              <p className="mb-3 text-dark" style={{ fontSize: '14px' }}>
                We regret to inform you that your application has been reviewed and could not be approved at this stage.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                {getValues('rejection_category') && (
                  <div>
                    <span className="text-muted small d-block">Reason Category</span>
                    <strong className="text-danger" style={{ fontSize: '13px' }}>{getValues('rejection_category')}</strong>
                  </div>
                )}
                {getValues('rejection_datetime') && (
                  <div>
                    <span className="text-muted small d-block">Rejected On</span>
                    <strong className="text-dark" style={{ fontSize: '13px' }}>
                      {new Date(getValues('rejection_datetime')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </strong>
                  </div>
                )}
                {getValues('rejected_by_name') && (
                  <div>
                    <span className="text-muted small d-block">Rejected By</span>
                    <strong className="text-dark" style={{ fontSize: '13px' }}>{getValues('rejected_by_name')}</strong>
                  </div>
                )}
              </div>

              {getValues('rejection_reason') && (
                <div className="p-3 rounded-3" style={{ background: '#fff', border: '1px solid #fca5a5', fontSize: '13px', color: '#7f1d1d' }}>
                  <span className="text-muted small d-block mb-1 fw-bold">Detailed Reason</span>
                  {getValues('rejection_reason')}
                </div>
              )}
            </div>
          )}
          {isSubmitted && (
            <div className="alert alert-info py-2 px-3 mb-3 d-flex align-items-center justify-content-between gap-2 flex-wrap" style={{ fontSize: '14px' }}>
              <div className="d-flex align-items-center gap-2">
                <CheckCircle size={18} className="text-success" />
                <strong>Application Locked:</strong>&nbsp;This application has been successfully submitted and is no longer editable.
              </div>
              <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => navigate('/review')}>
                <Eye size={14} className="me-1" />View Submission
              </button>
            </div>
          )}
          {!isSubmitted && !applicationOpen && (
            <div className="alert alert-danger py-2 px-3 mb-3 d-flex align-items-center gap-2" style={{ fontSize: '14px' }}>
              <span>🔒</span>
              <span><strong>Submissions Closed:</strong> The university has temporarily closed application submissions. You can still save your draft, but <strong>Final Submit is disabled</strong> until submissions reopen.</span>
            </div>
          )}
          <div className="d-flex align-items-center justify-content-between">
            {STEPS.map((s, i) => (
              <div key={i} className="d-flex align-items-center" style={{ flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <div
                  className="d-flex align-items-center gap-2"
                  onClick={() => setStep(i)}
                  style={{ cursor: 'pointer' }}
                  title={`Go to ${s}`}
                >
                  <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                    style={{ width: 32, height: 32, background: i <= step ? '#32b5c0' : '#dee2e6', color: i <= step ? '#fff' : '#888', fontSize: 14, transition: 'background 0.2s' }}>
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
        {steps[step]()}

        {/* Navigation */}
        <div className="d-flex justify-content-between mt-4">
          <button className="btn btn-outline-secondary px-4" onClick={() => setStep(s => s - 1)} disabled={step === 0 || isSubmitted}>
            <ChevronLeft size={16} className="me-1" /> Previous
          </button>
          <div className="d-flex gap-2">
            {/* Save Draft button removed */}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn px-4 text-white d-flex align-items-center gap-2"
                style={{ background: '#32b5c0' }}
                onClick={handleSaveAndNext}
                disabled={loading || isSubmitted || (step === 2 && !isEligible) || (step === 2 && hasTimelineErrors)}
              >
                {loading
                  ? <><span className="spinner-border spinner-border-sm" role="status" /> Saving…</>
                  : <>Save Draft &amp; Next <ChevronRight size={16} /></>
                }
              </button>
            ) : (
              <button
                className="btn px-5 fw-bold d-flex align-items-center gap-2"
                style={{ background: isSubmitted ? '#6b7280' : '#32b5c0', color: '#fff' }}
                onClick={handleSubmit(async () => {
                  // Save draft first, then navigate to review
                  const ok = await saveData('Draft');
                  if (ok) navigate('/review');
                })}
                disabled={loading || isSubmitted || !applicationOpen}
                title={isSubmitted ? 'Already submitted' : !applicationOpen ? 'Submissions are currently closed' : 'Save and proceed to final review'}
              >
                {loading
                  ? <><span className="spinner-border spinner-border-sm" />Saving…</>
                  : isSubmitted
                  ? <><CheckCircle size={16} />Submitted</>
                  : !applicationOpen
                  ? 'Submissions Closed'
                  : <><Eye size={16} />Review &amp; Submit</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Guidance Document Previewer Modal */}
      {previewUrl && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered" style={{ maxWidth: '85%' }}>
            <div className="modal-content shadow-lg border-0" style={{ height: '85vh' }}>
              <div className="modal-header bg-dark text-white py-2.5">
                <h6 className="modal-title fw-bold mb-0" style={{ fontSize: '14px' }}>Guidance Document Preview - {globalDoc?.file_name}</h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setPreviewUrl(null)}></button>
              </div>
              <div className="modal-body p-0 bg-secondary bg-opacity-10 d-flex justify-content-center align-items-center overflow-auto" style={{ height: '75vh' }}>
                {previewType === 'pdf' ? (
                  <iframe
                    src={previewUrl}
                    title="Guidance Document Preview"
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                  />
                ) : (
                  <img src={previewUrl} alt="Guidance Document" className="img-fluid max-vh-100 shadow-sm" style={{ objectFit: 'contain' }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationForm;
