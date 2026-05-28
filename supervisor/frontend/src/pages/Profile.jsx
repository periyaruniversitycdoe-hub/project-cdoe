import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `(import.meta.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002') + '/api`;

const S = {
  section: { background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: '#f8fafc', outline: 'none' },
  group: { marginBottom: 18 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  btn: { padding: '11px 28px', background: 'linear-gradient(135deg,#4338ca,#7c3aed)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  success: { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
  err: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
  readOnly: { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: '#f1f5f9', color: '#64748b' },
};

export default function Profile() {
  const { user, fetchMe } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', mobile: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  useEffect(() => {
    axios.get(`${API}/portal/me`).then(r => {
      setProfile(r.data);
      setForm({ name: r.data.name, mobile: r.data.mobile || '' });
    });
  }, []);

  async function saveProfile(e) {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      await axios.put(`${API}/portal/profile`, form);
      setMsg('Profile updated successfully!');
      fetchMe();
    } catch (er) { setErr(er.response?.data?.message || 'Update failed'); }
  }

  async function changePassword(e) {
    e.preventDefault(); setPwMsg(''); setPwErr('');
    if (pwForm.newPassword !== pwForm.confirm) return setPwErr('New passwords do not match');
    if (pwForm.newPassword.length < 6) return setPwErr('Password must be at least 6 characters');
    try {
      await axios.put(`${API}/portal/change-password`, { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg('Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (er) { setPwErr(er.response?.data?.message || 'Failed to change password'); }
  }

  if (!profile) return <div style={{ padding: 40, textAlign: 'center', color: '#6366f1' }}>Loading profile...</div>;

  return (
    <div>
      {/* Supervisor Linked Profile (read-only) */}
      {profile.supervisor_no && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Supervisor Profile (Admin Managed)</div>
          <div style={S.row}>
            <div style={S.group}><label style={S.label}>Supervisor No.</label><div style={S.readOnly}>{profile.supervisor_no}</div></div>
            <div style={S.group}><label style={S.label}>Recognition Ref No.</label><div style={S.readOnly}>{profile.recognition_ref_no || '—'}</div></div>
            <div style={S.group}><label style={S.label}>Designation</label><div style={S.readOnly}>{profile.designation_name || '—'}</div></div>
            <div style={S.group}><label style={S.label}>Department</label><div style={S.readOnly}>{profile.department_name || '—'}</div></div>
            <div style={S.group}><label style={S.label}>Institute</label><div style={S.readOnly}>{profile.institute_name || '—'}</div></div>
            <div style={S.group}><label style={S.label}>District</label><div style={S.readOnly}>{profile.district_name || '—'}</div></div>
            <div style={S.group}><label style={S.label}>Date of Joining</label><div style={S.readOnly}>{profile.date_of_joining ? new Date(profile.date_of_joining).toLocaleDateString('en-IN') : '—'}</div></div>
            <div style={S.group}><label style={S.label}>Status</label><div style={S.readOnly}>{profile.supervisor_status}</div></div>
          </div>
        </div>
      )}

      {/* Editable Account Info */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Account Information</div>
        {msg && <div style={S.success}>{msg}</div>}
        {err && <div style={S.err}>{err}</div>}
        <form onSubmit={saveProfile}>
          <div style={S.row}>
            <div style={S.group}>
              <label style={S.label}>Full Name</label>
              <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div style={S.group}>
              <label style={S.label}>Mobile Number</label>
              <input style={S.input} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
            </div>
          </div>
          <div style={S.group}>
            <label style={S.label}>Email Address</label>
            <div style={S.readOnly}>{profile.email} (cannot be changed)</div>
          </div>
          <button style={S.btn} type="submit">Save Changes</button>
        </form>
      </div>

      {/* Change Password */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Change Password</div>
        {pwMsg && <div style={S.success}>{pwMsg}</div>}
        {pwErr && <div style={S.err}>{pwErr}</div>}
        <form onSubmit={changePassword}>
          <div style={S.group}>
            <label style={S.label}>Current Password</label>
            <input style={S.input} type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required />
          </div>
          <div style={S.row}>
            <div style={S.group}>
              <label style={S.label}>New Password</label>
              <input style={S.input} type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required />
            </div>
            <div style={S.group}>
              <label style={S.label}>Confirm New Password</label>
              <input style={S.input} type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
            </div>
          </div>
          <button style={S.btn} type="submit">Change Password</button>
        </form>
      </div>
    </div>
  );
}
