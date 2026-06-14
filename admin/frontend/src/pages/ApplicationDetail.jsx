
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { ArrowLeft, CheckCircle, XCircle, Clock, Save, Edit3, Printer, CreditCard, AlertTriangle, Eye } from 'lucide-react';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';
const SEMESTERS = ['First Semester', 'Second Semester', 'Third Semester', 'Fourth Semester', 'Fifth Semester', 'Sixth Semester'];
const DIRECT_EXAMS = ['NET', 'SET', 'JRF', 'SLET'];

const QUAL_BADGE = {
  'Pending':        'bg-secondary text-white',
  'Qualified':      'bg-success text-white',
  'Direct Qualified':'bg-primary text-white',
  'Failed':         'bg-danger text-white',
};

const PAY_BADGE = {
  'Unpaid': 'bg-warning text-dark',
  'Paid':   'bg-success text-white',
  'Failed': 'bg-danger text-white',
};

const ApplicationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editMode, setEditMode] = useState(searchParams.get('edit') === '1');

  const [app, setApp] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [dropdowns, setDropdowns] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});

  // Entrance & admission state
  const [entranceCriteria, setEntranceCriteria] = useState({ passing_mark: 50, total_mark: 100 });
  const [entranceMark, setEntranceMark] = useState('');
  const [entranceRemarks, setEntranceRemarks] = useState('');
  const [savingEntrance, setSavingEntrance] = useState(false);
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [savingAdmission, setSavingAdmission] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  // Rejection dialog state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [showRejectionCard, setShowRejectionCard] = useState(false);

  const token = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async () => {
    try {
        const [appRes, ecRes, subRes, catRes, distRes, genRes, comRes, criteriaRes, boardsRes, degreesRes, uniTypesRes, specsRes, empTypesRes] = await Promise.all([
        axios.get(`${API_URL}/applications/${id}`, { headers }),
        axios.get(`${API_URL}/dropdowns/exam_centers`),
        axios.get(`${API_URL}/dropdowns/subjects`),
        axios.get(`${API_URL}/dropdowns/categories`),
        axios.get(`${API_URL}/dropdowns/districts`),
        axios.get(`${API_URL}/dropdowns/genders`),
        axios.get(`${API_URL}/dropdowns/communities`),
        axios.get(`${API_URL}/applications/entrance-settings/config`, { headers }),
        axios.get(`${API_URL}/dropdowns/education_boards`),
        axios.get(`${API_URL}/dropdowns/degree_types`),
        axios.get(`${API_URL}/dropdowns/university_types`),
        axios.get(`${API_URL}/dropdowns/specializations`),
        axios.get(`${API_URL}/dropdowns/employment_types`),
      ]);
      const data = appRes.data.data;
      setApp(data);
      setFormData(data);
      setDocuments(appRes.data.documents || []);
      setDropdowns({
        exam_centers: ecRes.data.data,
        subjects:     subRes.data.data,
        categories:   catRes.data.data,
        districts:    distRes.data.data,
        genders:      genRes.data.data,
        communities:  comRes.data.data,
        education_boards: boardsRes.data.data,
        degree_types: degreesRes.data.data,
        university_types: uniTypesRes.data.data,
        specializations: specsRes.data.data,
        employment_types: empTypesRes.data.data,
      });
      setEntranceCriteria(criteriaRes.data.data || { passing_mark: 50, total_mark: 100 });
      setEntranceMark(data.entrance_mark ?? '');
      setEntranceRemarks(data.remarks ?? '');
      setLoading(false);
    } catch (err) {
      toast.error('Failed to load application');
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/applications/${id}`, formData, { headers });
      toast.success('Application saved');
      setApp(formData);
      setEditMode(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleStatus = async (status) => {
    try {
      await axios.put(`${API_URL}/applications/${id}/status`, { status }, { headers });
      toast.success(`Status → ${status}`);
      setApp(prev => ({ ...prev, status }));
      setFormData(prev => ({ ...prev, status }));
    } catch { toast.error('Status update failed'); }
  };

  const handleRejectWithReason = async ({ rejection_category, rejection_reason, notify_email, notify_dashboard }) => {
    setRejectSubmitting(true);
    try {
      await axios.put(`${API_URL}/applications/${id}/status`, {
        status: 'Rejected', rejection_category, rejection_reason, notify_email, notify_dashboard,
      }, { headers });
      toast.success('Application rejected');
      setShowRejectDialog(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const handleSaveEntrance = async () => {
    if (entranceMark === '' || entranceMark === null) return toast.error('Please enter entrance mark');
    setSavingEntrance(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${id}/entrance-mark`,
        { entrance_mark: parseFloat(entranceMark), remarks: entranceRemarks }, { headers });
      toast.success(`Saved — Status: ${res.data.qualification_status}`);
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save entrance mark'); }
    finally { setSavingEntrance(false); }
  };

  const handleSaveCriteria = async () => {
    setSavingCriteria(true);
    try {
      await axios.put(`${API_URL}/applications/entrance-settings/config`, entranceCriteria, { headers });
      toast.success('Passing criteria updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update criteria'); }
    finally { setSavingCriteria(false); }
  };

  const handleAdmission = async (approved) => {
    if (!window.confirm(approved ? 'Approve admission for this applicant?' : 'Reject admission for this applicant?')) return;
    setSavingAdmission(true);
    try {
      await axios.put(`${API_URL}/applications/${id}/admission`,
        { approved, remarks: entranceRemarks }, { headers });
      toast.success(approved ? 'Admission Approved!' : 'Admission Rejected');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSavingAdmission(false); }
  };

  const handlePaymentStatus = async (payment_status) => {
    setSavingPayment(true);
    try {
      await axios.put(`${API_URL}/applications/${id}/payment-status`, { payment_status }, { headers });
      toast.success(`Payment → ${payment_status}`);
      fetchAll();
    } catch (err) { toast.error('Failed to update payment status'); }
    finally { setSavingPayment(false); }
  };

  const field = (label, fieldName, type = 'text', opts = []) => {
    if (!editMode) return (
      <>
        <td className="text-end fw-semibold bg-light" style={{ width: '28%', fontSize: '13px' }}>{label}</td>
        <td style={{ fontSize: '13px' }}>{formData[fieldName] || <span className="text-muted">—</span>}</td>
      </>
    );
    if (type === 'select') return (
      <>
        <td className="text-end fw-semibold bg-light" style={{ width: '28%', fontSize: '13px' }}>{label}</td>
        <td>
          <select className="form-select form-select-sm" value={formData[fieldName] || ''} onChange={e => handleChange(fieldName, e.target.value)}>
            <option value="">Select</option>
            {opts.map(o => <option key={o.id || o} value={o.name || o}>{o.name || o}</option>)}
          </select>
        </td>
      </>
    );
    if (type === 'date') return (
      <>
        <td className="text-end fw-semibold bg-light" style={{ width: '28%', fontSize: '13px' }}>{label}</td>
        <td><input type="date" className="form-control form-control-sm" value={formData[fieldName]?.split('T')[0] || ''} onChange={e => handleChange(fieldName, e.target.value)} /></td>
      </>
    );
    return (
      <>
        <td className="text-end fw-semibold bg-light" style={{ width: '28%', fontSize: '13px' }}>{label}</td>
        <td><input type={type} className="form-control form-control-sm" value={formData[fieldName] || ''} onChange={e => handleChange(fieldName, e.target.value)} /></td>
      </>
    );
  };

  const getDoc = (type) => documents.find(d => d.document_type === type);
  const userBackendURL = (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000').replace('/api', '');
  const getDocUrl = (filePath) => {
    if (!filePath) return '';
    let path = filePath.replace(/\\/g, '/');
    const idx = path.indexOf('uploads/');
    if (idx !== -1) {
      return `${userBackendURL}/${path.substring(idx)}`;
    }
    return `${userBackendURL}/${path}`;
  };

  let qualifiedExams = [];
  try { qualifiedExams = JSON.parse(app?.qualified_exams || '[]'); } catch {}
  const hasDirectQual = qualifiedExams.some(e => DIRECT_EXAMS.includes(e));

  if (loading) return <div className="p-5 text-center"><div className="spinner-border text-secondary" /></div>;
  if (!app) return <div className="p-5 text-center text-danger">Application not found.</div>;

  return (
    <div>
      {/* Top Bar */}
      <div className="card mb-3">
        <div className="card-body py-2 px-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-3">
            <button onClick={() => navigate('/applications')} className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1">
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <span className="fw-bold" style={{ fontSize: '15px' }}>Application: </span>
              <span className="fw-bold text-primary">{app.application_id || `Pending Payment (${app.email})`}</span>
              <span className="text-muted ms-2" style={{ fontSize: '13px' }}>| {app.full_name}</span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button className="btn btn-sm btn-success d-flex align-items-center gap-1" onClick={() => handleStatus('Approved')}>
              <CheckCircle size={13} /> Approve
            </button>
            <button className="btn btn-sm btn-warning d-flex align-items-center gap-1" onClick={() => handleStatus('Under Review')}>
              <Clock size={13} /> Review
            </button>
            <button className="btn btn-sm btn-danger d-flex align-items-center gap-1" onClick={() => setShowRejectDialog(true)}>
              <XCircle size={13} /> Reject
            </button>
            {app?.status === 'Rejected' && (
              <button className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1" onClick={() => setShowRejectionCard(v => !v)}>
                <Eye size={13} /> View Reason
              </button>
            )}
            <div className="vr mx-1" />
            {editMode ? (
              <>
                <button className="btn btn-sm btn-secondary" onClick={() => { setEditMode(false); setFormData(app); }}>Cancel</button>
                <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="spinner-border spinner-border-sm" /> : <Save size={13} />} Save
                </button>
              </>
            ) : (
              <button className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" onClick={() => setEditMode(true)}>
                <Edit3 size={13} /> Edit
              </button>
            )}
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => window.print()}>
              <Printer size={13} /> Print
            </button>
          </div>
        </div>
      </div>

      <div className="bg-light p-3 rounded">

        {/* SECTION 1: Exam & Personal Details */}
        <div className="card border-0 shadow-sm rounded-3 mb-3">
          <div className="card-header py-2 px-4" style={{ background: '#32b5c0', color: '#fff' }}>
            <h6 className="mb-0 fw-bold">Exam &amp; Personal Details</h6>
          </div>
          <div className="card-body p-3">
            <table className="table table-bordered align-middle mb-0 admin-form-table">
              <tbody>
                <tr>
                  {field('Exam Centre Preference 1', 'exam_center_1', 'select', dropdowns.exam_centers)}
                  {field('Exam Center Preference 2', 'exam_center_2', 'select', dropdowns.exam_centers)}
                  <td rowSpan={4} className="text-center align-middle" style={{ width: '120px' }}>
                    {getDoc('photo') ? (
                      <img src={getDocUrl(getDoc('photo').file_path)} style={{ width: 90, height: 110, objectFit: 'cover', border: '1px solid #ccc' }} alt="Photo" />
                    ) : (
                      <div style={{ width: 90, height: 110, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#aaa', margin: '0 auto' }}>No Photo</div>
                    )}
                  </td>
                </tr>
                <tr>
                  {field('Subject', 'subject', 'select', dropdowns.subjects)}
                  {field('Category', 'category', 'select', dropdowns.categories)}
                </tr>
                <tr>
                  {field('Applicant Name (English)', 'applicant_name')}
                  {field('Applicant Name (Tamil)', 'applicant_name_tamil')}
                </tr>
                <tr>
                  {field('Date of Birth', 'dob', 'date')}
                  {field('Nationality', 'nationality')}
                </tr>
                <tr>
                  {field('Gender', 'gender', 'select', dropdowns.genders)}
                  {field('Religion', 'religion')}
                </tr>
                <tr>
                  {field('Community', 'community', 'select', dropdowns.communities)}
                  {field('Parent / Guardian Name', 'parent_name')}
                </tr>
                <tr>
                  {field('Working District', 'working_district', 'select', dropdowns.districts)}
                  <td className="bg-light"></td><td></td>
                </tr>
                {formData.category === 'Part Time' && (
                  <>
                    <tr>
                      {field('Part-Time Category', 'part_time_category')}
                      {field('Role / Designation', 'part_time_designation')}
                    </tr>
                    <tr>
                      {field('Working Area', 'part_time_area')}
                      <td className="bg-light"></td><td></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: Communication & Identity */}
        <div className="card border-0 shadow-sm rounded-3 mb-3">
          <div className="card-header py-2 px-4" style={{ background: '#32b5c0', color: '#fff' }}>
            <h6 className="mb-0 fw-bold">Communication &amp; Identity Details</h6>
          </div>
          <div className="card-body p-3">
            <table className="table table-bordered align-middle mb-0 admin-form-table">
              <tbody>
                <tr>
                  <td className="text-end fw-semibold bg-light" style={{ width: '28%', fontSize: '13px' }}>Address Line 1</td>
                  <td colSpan={3}>
                    {editMode
                      ? <input type="text" className="form-control form-control-sm" value={formData.address_1 || ''} onChange={e => handleChange('address_1', e.target.value)} />
                      : <span style={{ fontSize: '13px' }}>{formData.address_1 || '—'}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="text-end fw-semibold bg-light" style={{ fontSize: '13px' }}>Address Line 2</td>
                  <td colSpan={3}>
                    {editMode
                      ? <input type="text" className="form-control form-control-sm" value={formData.address_2 || ''} onChange={e => handleChange('address_2', e.target.value)} />
                      : <span style={{ fontSize: '13px' }}>{formData.address_2 || '—'}</span>}
                  </td>
                </tr>
                <tr>
                  {field('District', 'district', 'select', dropdowns.districts)}
                  {field('State', 'state')}
                </tr>
                <tr>
                  {field('Pincode', 'pincode')}
                  {field('Mobile No.', 'mobile', 'tel')}
                </tr>
                <tr>
                  {field('Phone (Landline)', 'phone', 'tel')}
                  {field('E-mail ID', 'email', 'email')}
                </tr>
                <tr>
                  {field('ID Type', 'id_type')}
                  {field('ID Number', 'id_number')}
                </tr>
                <tr>
                  {field('Physically Challenged', 'is_physically_challenged')}
                  <td className="text-end fw-semibold bg-light" style={{ fontSize: '13px' }}>ID Proof</td>
                  <td>
                    {getDoc('id_proof')
                      ? <a href={getDocUrl(getDoc('id_proof').file_path)} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-info">View</a>
                      : <span className="text-muted" style={{ fontSize: '12px' }}>Not uploaded</span>}
                  </td>
                </tr>
                {/* Permanent Address */}
                <tr><td colSpan={4} className="bg-light fw-bold" style={{ fontSize: '13px' }}>Permanent Address</td></tr>
                <tr>
                  <td className="text-end fw-semibold bg-light" style={{ fontSize: '13px' }}>Perm. Address Line 1</td>
                  <td colSpan={3} style={{ fontSize: '13px' }}>{formData.perm_address_1 || <span className="text-muted">—</span>}</td>
                </tr>
                <tr>
                  <td className="text-end fw-semibold bg-light" style={{ fontSize: '13px' }}>Perm. State / District</td>
                  <td style={{ fontSize: '13px' }}>{formData.perm_state || '—'}</td>
                  <td className="text-end fw-semibold bg-light" style={{ fontSize: '13px' }}>Perm. Pincode</td>
                  <td style={{ fontSize: '13px' }}>{formData.perm_pincode || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: School Education Details */}
        <div className="card border-0 shadow-sm rounded-3 mb-3">
          <div className="card-header py-2 px-4" style={{ background: '#32b5c0', color: '#fff' }}>
            <h6 className="mb-0 fw-bold">School Education Details</h6>
          </div>
          <div className="card-body p-3">
            <table className="table table-bordered align-middle mb-0 admin-form-table small">
              <thead className="table-light">
                <tr>
                  <th>Level</th><th>Institution</th><th>Board</th><th>Year/Month</th><th>%</th><th>Marksheet</th>
                </tr>
              </thead>
              <tbody>
                {(app.school_education || []).map((edu, i) => (
                  <tr key={i}>
                    <td className="fw-bold">{edu.level}</td>
                    <td>{edu.institution_name}</td>
                    <td>{edu.board_name || dropdowns.education_boards?.find(b => b.id == edu.board_id)?.name || edu.other_board_name}</td>
                    <td>{edu.passing_month} {edu.passing_year}</td>
                    <td>{edu.percentage}%</td>
                    <td className="text-center">
                      {getDoc(`${edu.level.toLowerCase()}_marksheet`) 
                        ? <a href={getDocUrl(getDoc(`${edu.level.toLowerCase()}_marksheet`).file_path)} target="_blank" className="btn btn-xs btn-outline-info p-1">View</a>
                        : <span className="text-muted">No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: Higher Education Details */}
        <div className="card border-0 shadow-sm rounded-3 mb-3">
          <div className="card-header py-2 px-4" style={{ background: '#32b5c0', color: '#fff' }}>
            <h6 className="mb-0 fw-bold">Higher Education Details (UG & PG)</h6>
          </div>
          <div className="card-body p-3">
            <table className="table table-bordered align-middle mb-0 admin-form-table small">
              <thead className="table-light">
                <tr>
                  <th>Level</th><th>Degree</th><th>Specialization</th><th>Institution/University</th><th>Timeline</th><th>Score</th><th>Docs</th>
                </tr>
              </thead>
              <tbody>
                {(app.higher_education || []).map((edu, i) => (
                  <tr key={i}>
                    <td className="fw-bold">{edu.level}</td>
                    <td>{dropdowns.degree_types?.find(d => d.id == edu.degree_id)?.name}</td>
                    <td>{dropdowns.specializations?.find(s => s.id == edu.specialization_id)?.name}</td>
                    <td>{edu.institution_name} <br/><small className="text-muted">{edu.university_name}</small></td>
                    <td>
                      {edu.level === 'UG' || edu.level === 'PG' || edu.level === 'Integrated' ? (
                        <>
                          <div>{edu.passing_month || '—'}</div>
                          {(edu.start_year || edu.completion_year) && (
                            <div className="text-muted" style={{ fontSize: '11px' }}>
                              {edu.start_year ? `Start: ${edu.start_year}` : ''} {edu.completion_year ? `| End: ${edu.completion_year}` : ''}
                            </div>
                          )}
                        </>
                      ) : (
                        <div>{edu.passing_month} {edu.passing_year && `Pass: ${edu.passing_year}`}</div>
                      )}
                    </td>
                    <td>
                      {edu.score_type === 'CGPA' && edu.cgpa_scale && ['UG','PG','M.Phil'].includes(edu.level)
                        ? <>
                            <span>{edu.score_value} CGPA ({edu.cgpa_scale}-pt scale)</span>
                            {edu.normalized_cgpa != null && (
                              <div className="text-primary" style={{ fontSize: '11px' }}>
                                Normalized: {parseFloat(edu.normalized_cgpa).toFixed(2)} / 10
                              </div>
                            )}
                          </>
                        : `${edu.score_value} (${edu.score_type})`}
                    </td>
                    <td>
                      <div className="d-flex flex-column gap-1">
                        {getDoc(`${edu.level.toLowerCase()}_marksheet`) && <a href={getDocUrl(getDoc(`${edu.level.toLowerCase()}_marksheet`).file_path)} target="_blank" className="btn btn-xs btn-outline-primary p-0">Marksheet</a>}
                        {getDoc(`${edu.level.toLowerCase()}_consolidated`) && <a href={getDocUrl(getDoc(`${edu.level.toLowerCase()}_consolidated`).file_path)} target="_blank" className="btn btn-xs btn-outline-secondary p-0">Consolidated</a>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 5: Experience Details */}
        <div className="card border-0 shadow-sm rounded-3 mb-3">
          <div className="card-header py-2 px-4" style={{ background: '#32b5c0', color: '#fff' }}>
            <h6 className="mb-0 fw-bold">Work Experience Details</h6>
          </div>
          <div className="card-body p-3">
            {app.experience_details?.length > 0 ? (
              <table className="table table-bordered align-middle mb-0 admin-form-table small">
                <thead className="table-light">
                  <tr>
                    <th>Designation</th><th>Organization</th><th>Type</th><th>Duration</th><th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {app.experience_details.map((exp, i) => {
                    const fromDisplay = exp.from_date 
                      ? new Date(exp.from_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
                      : `${exp.from_month || ''} ${exp.from_year || ''}`.trim() || '—';
                    const toDisplay = exp.to_date 
                      ? new Date(exp.to_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
                      : `${exp.to_month || ''} ${exp.to_year || ''}`.trim() || '—';
                    return (
                      <tr key={i}>
                        <td>{exp.designation}</td>
                        <td>{exp.organization_name}</td>
                        <td>{exp.employment_type || dropdowns.employment_types?.find(t => t.id == exp.employment_type_id)?.name || '—'}</td>
                        <td>{fromDisplay} - {toDisplay}</td>
                        <td className="fw-bold text-primary">{exp.total_years}Y {exp.total_months}M</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <p className="text-muted text-center py-2 mb-0">No experience details provided.</p>}
          </div>
        </div>

        {/* SECTION 4: Status & Signature */}
        <div className="card border-0 shadow-sm rounded-3 mb-3">
          <div className="card-header py-2 px-4" style={{ background: '#32b5c0', color: '#fff' }}>
            <h6 className="mb-0 fw-bold">Application Status &amp; Signature</h6>
          </div>
          <div className="card-body p-3">
            <table className="table table-bordered align-middle admin-form-table">
              <tbody>
                <tr>
                  <td className="text-end fw-semibold bg-light" style={{ width: '28%', fontSize: '13px' }}>Current Status</td>
                  <td>
                    {editMode
                      ? <select className="form-select form-select-sm" style={{ width: 200 }} value={formData.status || 'Draft'} onChange={e => handleChange('status', e.target.value)}>
                          {['Draft','Submitted','Under Review','Approved'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      : <span className={`status-badge ${app.status === 'Approved' ? 'status-approved' : app.status === 'Rejected' ? 'status-rejected' : app.status === 'Submitted' ? 'bg-info text-white' : app.status === 'Under Review' ? 'status-pending' : 'bg-secondary text-white'}`}>{app.status}</span>
                    }
                  </td>
                  <td className="text-end fw-semibold bg-light" style={{ fontSize: '13px' }}>Signature</td>
                  <td>
                    {getDoc('signature')
                      ? <img src={getDocUrl(getDoc('signature').file_path)} style={{ height: 50, objectFit: 'contain' }} alt="Signature" />
                      : <span className="text-muted" style={{ fontSize: '12px' }}>Not uploaded</span>}
                  </td>
                </tr>
                <tr>
                  <td className="text-end fw-semibold bg-light" style={{ fontSize: '13px' }}>Submitted On</td>
                  <td style={{ fontSize: '13px' }}>{new Date(app.created_at).toLocaleString('en-IN')}</td>
                  <td className="text-end fw-semibold bg-light" style={{ fontSize: '13px' }}>Last Updated</td>
                  <td style={{ fontSize: '13px' }}>{app.updated_at ? new Date(app.updated_at).toLocaleString('en-IN') : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>


        {/* SECTION 6: Payment */}
        <div className="card border-0 shadow-sm rounded-3 mb-3">
          <div className="card-header py-2 px-4" style={{ background: '#32b5c0', color: '#fff' }}>
            <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
              <CreditCard size={15} /> Payment Status
            </h6>
          </div>
          <div className="card-body p-3">
            <div className="d-flex flex-column gap-3">
              <div className="d-flex align-items-center gap-4 flex-wrap">
                <div>
                  <small className="text-muted d-block mb-1">Current Status</small>
                  <div>
                    <span className={`badge ${PAY_BADGE[app.payment_status] || 'bg-secondary text-white'}`} style={{ fontSize: '13px' }}>
                      {app.payment_status || 'Unpaid'}
                    </span>
                  </div>
                </div>
                <div className="d-flex gap-2 flex-wrap pt-3">
                  {['Unpaid','Paid','Failed'].map(ps => (
                    <button key={ps}
                      className={`btn btn-sm ${app.payment_status === ps ? (ps === 'Paid' ? 'btn-success' : ps === 'Failed' ? 'btn-danger' : 'btn-warning') : 'btn-outline-secondary'}`}
                      style={{ fontSize: '12px' }}
                      disabled={savingPayment || app.payment_status === ps}
                      onClick={() => handlePaymentStatus(ps)}>
                      Mark as {ps}
                    </button>
                  ))}
                </div>
              </div>

              {app.payment_status === 'Paid' && (
                <div className="border-top pt-3 mt-1">
                  <div className="row g-3">
                    <div className="col-md-3 col-sm-6">
                      <small className="text-muted d-block">Receipt Number</small>
                      <strong className="text-dark font-monospace" style={{ fontSize: '13px' }}>{app.receipt_number || '—'}</strong>
                    </div>
                    <div className="col-md-3 col-sm-6">
                      <small className="text-muted d-block">Submission Reference</small>
                      <strong className="text-dark font-monospace" style={{ fontSize: '13px' }}>{app.submission_reference || '—'}</strong>
                    </div>
                    <div className="col-md-3 col-sm-6">
                      <small className="text-muted d-block">Transaction ID</small>
                      <strong className="text-dark font-monospace" style={{ fontSize: '13px' }}>{app.payment_transaction_id || '—'}</strong>
                    </div>
                    <div className="col-md-3 col-sm-6">
                      <small className="text-muted d-block">Payment Completed On</small>
                      <strong className="text-dark" style={{ fontSize: '13px' }}>
                        {app.payment_completed_at || app.payment_date ? new Date(app.payment_completed_at || app.payment_date).toLocaleString('en-IN') : '—'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom save */}
        {editMode && (
          <div className="d-flex justify-content-end gap-3 mt-3">
            <button className="btn btn-secondary px-4" onClick={() => { setEditMode(false); setFormData(app); }}>Cancel</button>
            <button className="btn btn-primary px-5 d-flex align-items-center gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner-border spinner-border-sm" /> : <Save size={16} />}
              Save All Changes
            </button>
          </div>
        )}

        {/* Rejection Reason Card */}
        {app?.status === 'Rejected' && showRejectionCard && (
          <div className="card border-danger border-2 mt-3 shadow-sm">
            <div className="card-header bg-danger text-white d-flex align-items-center gap-2 py-2">
              <AlertTriangle size={16} />
              <span className="fw-bold">Rejection Details</span>
            </div>
            <div className="card-body">
              <div className="row g-3">
                {[
                  ['Reason Category', app.rejection_category || '—'],
                  ['Rejected By',     app.rejected_by_name  || '—'],
                  ['Rejected On',     app.rejection_datetime ? new Date(app.rejection_datetime).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'],
                  ['Email Sent',      app.rejection_email_sent ? 'Yes' : 'No'],
                  ['Dashboard Notified', app.rejection_notification_sent ? 'Yes' : 'No'],
                ].map(([k, v]) => (
                  <div className="col-md-4" key={k}>
                    <div className="small text-muted fw-semibold">{k}</div>
                    <div className="fw-semibold">{v}</div>
                  </div>
                ))}
                {app.rejection_reason && (
                  <div className="col-12">
                    <div className="small text-muted fw-semibold mb-1">Detailed Rejection Reason</div>
                    <div className="p-3 rounded" style={{ background: '#fef2f2', border: '1px solid #fca5a5', fontSize: 14 }}>
                      {app.rejection_reason}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Rejection Dialog Modal */}
        {showRejectDialog && (
          <RejectionDialog
            app={app}
            loading={rejectSubmitting}
            onConfirm={handleRejectWithReason}
            onCancel={() => setShowRejectDialog(false)}
          />
        )}
      </div>
    </div>
  );
};

// ── Rejection Reason Dialog ────────────────────────────────────────────────────
const REJECTION_CATEGORIES = [
  'Document Verification Failed',
  'Eligibility Criteria Not Met',
  'Minimum Marks Not Satisfied',
  'Incorrect Information Submitted',
  'Invalid Certificates',
  'Duplicate Application',
  'Application Incomplete',
  'Fee Verification Failed',
  'Community Certificate Issue',
  'Photo / Signature Issue',
  'Other',
];

function RejectionDialog({ app, loading, onConfirm, onCancel }) {
  const [category,     setCategory]     = useState('');
  const [reason,       setReason]       = useState('');
  const [notifyEmail,  setNotifyEmail]  = useState(true);
  const [notifyDash,   setNotifyDash]   = useState(true);
  const [error,        setError]        = useState('');

  function handleSubmit() {
    if (!category) { setError('Please select a reason category.'); return; }
    if (!reason.trim()) { setError('Detailed rejection reason is required.'); return; }
    setError('');
    onConfirm({ rejection_category: category, rejection_reason: reason.trim(), notify_email: notifyEmail, notify_dashboard: notifyDash });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14,
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ background: '#fef2f2', borderRadius: '14px 14px 0 0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fca5a5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <XCircle size={22} color="#ef4444" />
            <span style={{ fontWeight: 700, fontSize: 17, color: '#991b1b' }}>Reject Application</span>
          </div>
          <button onClick={onCancel} disabled={loading} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          {/* Read-only info */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              <div>
                <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Application ID</div>
                <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{app?.application_id || `Pending (${app?.email})`}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Applicant Name</div>
                <div style={{ fontWeight: 700 }}>{app?.full_name || '—'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Email</div>
                <div style={{ fontWeight: 600 }}>{app?.email || '—'}</div>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
              Reason Category <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              className="form-select"
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ fontSize: 13 }}
            >
              <option value="">— Select Reason Category —</option>
              {REJECTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
              Detailed Rejection Reason <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              className="form-control"
              rows={4}
              placeholder="Provide a clear explanation of why the application is being rejected…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ fontSize: 13 }}
            />
            <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>{reason.trim().length} characters</div>
          </div>

          <div style={{ display: 'flex', gap: 24, marginBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} />
              Send Email Notification
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={notifyDash} onChange={e => setNotifyDash(e.target.checked)} />
              Notify Student Dashboard
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-outline-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className="btn btn-danger fw-semibold px-4"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <span className="spinner-border spinner-border-sm me-2" /> : <XCircle size={15} className="me-1" />}
            Reject Application
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApplicationDetail;
