import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Loader2, UserPlus, CheckCircle, Copy, ArrowLeft } from 'lucide-react';
import StudentApplicationForm from '@student/pages/ApplicationForm';

const API         = (import.meta.env.VITE_ADMIN_API_URL  || 'http://localhost:5001') + '/api';
const STUDENT_API = (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';

function getHeaders() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } };
}

function validatePassword(pw) {
  if (pw.length < 8)           return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw))       return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(pw))       return 'Password must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character';
  return null;
}

export default function AdminAddApplication() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { applicationId, userId }

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim())       errs.full_name = 'Full name is required';
    if (!form.email.trim())           errs.email     = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email address';
    const pwErr = validatePassword(form.password);
    if (pwErr) errs.password = pwErr;
    if (!form.confirmPassword)        errs.confirmPassword = 'Please confirm the password';
    else if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords don't match";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const { data } = await axios.post(
        `${API}/admin/register-student`,
        { full_name: form.full_name, email: form.email, password: form.password },
        getHeaders()
      );

      // Auto-login to student backend with the just-created credentials
      let studentToken = null;
      let studentUser  = null;
      try {
        const loginRes = await axios.post(`${STUDENT_API}/auth/login`, {
          username: form.email,
          password: form.password,
        });
        studentToken = loginRes.data.data?.token || loginRes.data.data?.accessToken || null;
        studentUser  = loginRes.data.data?.user  || null;
      } catch (_) {
        // Auto-login failed — Phase 2 will still render but may need manual auth
      }

      setResult({ applicationId: data.applicationId, userId: data.userId, studentToken, studentUser });
      toast.success('Student registered successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };


  // ── Phase 2: Account created — render exact Student Portal ApplicationForm (100% clone) ──
  if (result) {
    return (
      <div>
        <div className="alert alert-success d-flex align-items-center gap-2 mx-4 mt-4 mb-0 py-2">
          <CheckCircle size={18} className="flex-shrink-0" />
          <span>
            <strong>Account created — Application ID: {result.applicationId}</strong>
            <button
              className="btn btn-sm btn-outline-secondary py-0 ms-2"
              style={{ fontSize: 11 }}
              onClick={() => navigator.clipboard.writeText(result.applicationId).then(() => toast.success('Copied!'))}
            >
              <Copy size={11} className="me-1" />Copy
            </button>
            <span className="ms-2 text-muted small">Now fill the full application form below — same form as Student Portal.</span>
          </span>
          <Link to="/applications" className="btn btn-sm btn-outline-secondary ms-auto">
            <ArrowLeft size={13} className="me-1" />Back to Applications
          </Link>
        </div>
        {/* 100% clone of Student Portal ApplicationForm — uses real student JWT, routes to student backend */}
        <StudentApplicationForm
          studentToken={result.studentToken}
          studentUser={result.studentUser}
          onAdminDone={() => navigate('/applications')}
        />
      </div>
    );
  }

  // ── Registration form — exact same fields as Student Portal Register.jsx ────
  return (
    <div className="container-fluid px-4 py-4">
      <div className="row justify-content-center">
        <div className="col-md-6">

          {/* Header */}
          <div className="d-flex align-items-center gap-2 mb-4">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => navigate('/applications')}
            >
              <ArrowLeft size={14} />
            </button>
            <div>
              <h4 className="fw-bold mb-0">Register New Applicant</h4>
              <small className="text-muted">
                Uses the same registration service as student self-registration
              </small>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white">
              <div className="d-flex align-items-center gap-2">
                <UserPlus size={18} className="text-primary" />
                <span className="fw-semibold">Applicant Registration Form</span>
              </div>
            </div>
            <div className="card-body">

              <div className="alert alert-info py-2 small mb-4">
                This form is identical to the Student Portal registration form.
                Credentials will be emailed to the applicant after registration.
              </div>

              <form onSubmit={handleSubmit} noValidate>
                {/* Full Name */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Full Name</label>
                  <input
                    type="text"
                    className={`form-control ${errors.full_name ? 'is-invalid' : ''}`}
                    placeholder="Enter applicant's full name"
                    value={form.full_name}
                    onChange={set('full_name')}
                  />
                  {errors.full_name && <div className="invalid-feedback">{errors.full_name}</div>}
                </div>

                {/* Email */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email Address</label>
                  <input
                    type="email"
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    placeholder="Enter applicant's email"
                    value={form.email}
                    onChange={set('email')}
                  />
                  {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                </div>

                {/* Password */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Password</label>
                  <input
                    type="password"
                    className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                    placeholder="Create a password"
                    value={form.password}
                    onChange={set('password')}
                  />
                  {errors.password
                    ? <div className="invalid-feedback">{errors.password}</div>
                    : <div className="form-text">Min 8 chars · 1 uppercase · 1 number · 1 special character</div>}
                </div>

                {/* Confirm Password */}
                <div className="mb-4">
                  <label className="form-label fw-semibold">Confirm Password</label>
                  <input
                    type="password"
                    className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                    placeholder="Confirm the password"
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                  />
                  {errors.confirmPassword && <div className="invalid-feedback">{errors.confirmPassword}</div>}
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/applications')}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary flex-grow-1"
                    disabled={loading}
                  >
                    {loading
                      ? <><Loader2 size={15} className="me-1 spin" /> Registering...</>
                      : <><UserPlus size={15} className="me-1" /> Register Applicant</>}
                  </button>
                </div>
              </form>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
