import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;

const JoiningLetterPrint = () => {
  const { id } = useParams();
  const [data, setData]         = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError]       = useState('');

  const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };

  useEffect(() => {
    axios.get(`${API}/counselling/joining-letter/${id}`, { headers })
      .then(res => {
        setData(res.data.data);
        setSettings(res.data.settings);
      })
      .catch(() => setError('Failed to load joining letter data.'));
  }, [id]);

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 600);
  }, [data]);

  if (error)  return <div className="p-5 text-danger">{error}</div>;
  if (!data)  return <div className="p-5 text-muted">Loading joining letter…</div>;

  const logoSrc = settings?.logo_url?.startsWith('/uploads')
    ? `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + ''${settings.logo_url}`
    : settings?.logo_url || '/images/pu_logo.png';

  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{ fontFamily: 'serif', padding: '40px 60px', maxWidth: 800, margin: '0 auto', fontSize: 14 }}>
      {/* University Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #900', paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <img src={logoSrc} alt="Logo" style={{ height: 80, objectFit: 'contain' }} />
          <div>
            <div style={{ color: '#900', fontSize: 20, fontWeight: 'bold' }}>
              {settings?.university_name_ta || 'பெரியார் பல்கலைக்கழகம்'}
            </div>
            <div style={{ color: '#0f4c81', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 }}>
              {settings?.university_name_en || 'PERIYAR UNIVERSITY'}
            </div>
            <div style={{ fontSize: 12 }}>{settings?.header_line2 || "State University — NAAC 'A++'"}</div>
            <div style={{ fontSize: 12 }}>{settings?.address || 'Salem - 636 011, Tamil Nadu, India'}</div>
          </div>
        </div>
        <h3 style={{ margin: 0, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase', color: '#333' }}>
          Ph.D. Admission — Joining Letter
        </h3>
      </div>

      {/* Date & Reference */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 13 }}>
        <div><strong>Ref No:</strong> JL/{data.user_app_id}/{new Date().getFullYear()}</div>
        <div><strong>Date:</strong> {today}</div>
      </div>

      {/* Salutation */}
      <p style={{ marginBottom: 16 }}>
        To,<br />
        <strong>{data.full_name}</strong><br />
        Application ID: <strong>{data.user_app_id}</strong>
      </p>

      {/* Body */}
      <p>
        With reference to your application for Ph.D. Admission for the session{' '}
        <strong>{data.session_name}</strong>, we are pleased to inform you that you have been{' '}
        <strong>allotted a seat</strong> in the following research centre:
      </p>

      {/* Allotment Details Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0', fontSize: 13 }}>
        <tbody>
          {[
            ['Applicant Name',       data.full_name],
            ['Application ID',       data.user_app_id],
            ['Subject / Programme',  data.subject || '—'],
            ['Research Center',      data.allotted_center_name || '—'],
            ['Research Supervisor',  data.allotted_supervisor_name || '—'],
            ['Supervisor Designation', data.allotted_supervisor_designation || '—'],
            ['Allotment Date',       data.allotted_at ? new Date(data.allotted_at).toLocaleDateString('en-IN') : today],
          ].map(([label, value]) => (
            <tr key={label}>
              <td style={{ border: '1px solid #ccc', padding: '7px 12px', fontWeight: 'bold', background: '#f9f9f9', width: '40%' }}>
                {label}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '7px 12px' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Instructions */}
      <p style={{ marginTop: 20 }}>
        You are hereby requested to report to the above-mentioned Research Center within{' '}
        <strong>7 working days</strong> from the date of this letter with the following documents:
      </p>
      <ol style={{ fontSize: 13, lineHeight: 1.8 }}>
        <li>Original and photocopies of all academic certificates</li>
        <li>Original and photocopy of Community / Category Certificate</li>
        <li>Original and photocopy of ID Proof (Aadhaar / Passport)</li>
        <li>4 recent passport-size photographs</li>
        <li>Copy of fee paid receipt (application fee)</li>
        <li>No Objection Certificate from employer (if applicable)</li>
      </ol>

      {data.allotment_remarks && (
        <p style={{ background: '#fffbea', border: '1px solid #e6d000', padding: '10px 14px', borderRadius: 4, fontSize: 13, marginTop: 16 }}>
          <strong>Remarks:</strong> {data.allotment_remarks}
        </p>
      )}

      {/* Signature */}
      <div style={{ marginTop: 60, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #333', width: 180, marginBottom: 4 }}></div>
          <div>Candidate's Signature</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #333', width: 180, marginBottom: 4 }}></div>
          <div>Controller of Examinations</div>
          <div style={{ fontSize: 11 }}>{settings?.university_name_en || 'Periyar University'}</div>
        </div>
      </div>

      <div style={{ marginTop: 40, borderTop: '1px solid #ccc', paddingTop: 10, textAlign: 'center', fontSize: 11, color: '#666' }}>
        This is a computer-generated letter. For queries contact: {settings?.email || 'admissions@periyaruniversity.ac.in'}
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default JoiningLetterPrint;
