
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './HallTicketPrint.css';

const API_URL = `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api`;

const getPhotoUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '')/${cleanPath}`;
};

const HallTicketPrint = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, [id]);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/settings`);
      const sData = res.data.success ? res.data.data : res.data;
      setSettings(sData);
    } catch (err) {
      console.error('Failed to fetch settings');
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_URL}/hall-tickets/print/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to fetch hall ticket details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-5 text-center">Loading Hall Ticket...</div>;
  if (!data) return <div className="p-5 text-center text-danger">Hall Ticket not found</div>;

  return (
    <div className="hall-ticket-container">
      {/* Action Bar (Hidden during print) */}
      <div className="print-action-bar no-print">
        <button onClick={() => window.print()} className="btn-print-main">Print Hall Ticket</button>
        <button onClick={() => window.close()} className="btn-close-main">Close</button>
      </div>

      <div className="hall-ticket-page">
        {/* Header Section */}
        <div className="ht-header" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="ht-logo" style={{ display: 'flex', gap: '10px' }}>
            <img 
              src={settings?.logo?.startsWith('/uploads') ? `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + ''${settings.logo}` : settings?.logo || '/images/pu_logo.png'} 
              alt="University Logo" 
              style={{ height: '75px', width: 'auto', objectFit: 'contain' }} 
            />
          </div>
          <div className="ht-header-text" style={{ flex: 1, textAlign: 'left', padding: '0 10px' }}>
            <h1 style={{ color: '#901a1e', fontWeight: 'bold', fontSize: '18px', margin: '0 0 1px 0', fontFamily: 'serif', lineHeight: '1.2', textDecoration: 'none' }}>
              {settings?.university_name_tamil || 'பெரியார் பல்கலைக்கழகம்'}
            </h1>
            <h2 style={{ color: '#0f4c81', fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0', fontFamily: 'sans-serif', lineHeight: '1.2', textDecoration: 'none' }}>
              {settings?.university_name_english || 'PERIYAR UNIVERSITY'}
            </h2>
            <p style={{ margin: '0', color: '#111827', fontSize: '10.5px', fontWeight: '500', lineHeight: '1.3' }}>
              {settings?.header_line2 || 'State University - NAAC \'A++\' Grade - NIRF Rank 94'}
            </p>
            <p style={{ margin: '0', color: '#111827', fontSize: '10.5px', fontWeight: '500', lineHeight: '1.3' }}>
              {settings?.naac_details || 'State Public University Rank 40 - SDG Institutions Rank Band: 11-50'}
            </p>
            <p style={{ margin: '0', color: '#111827', fontSize: '10.5px', fontWeight: '500', lineHeight: '1.3' }}>
              {settings?.subtitle || 'Periyar Palkalai Nagar'}
            </p>
            <p style={{ margin: '0', color: '#111827', fontSize: '10.5px', fontWeight: '500', lineHeight: '1.3' }}>
              {settings?.header_line3 || settings?.address || 'Salem - 636 011, Tamil Nadu, India.'}
            </p>
            <h2 className="section-title" style={{ fontSize: '13px', margin: '6px 0 0 0', fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase' }}>
              Common Entrance Test for Ph.D. Programme December 2026 Session
            </h2>
          </div>
          <div className="ht-reg-box">
            <div className="reg-label">Registration No. :</div>
            <div className="reg-value">{data.hall_ticket_number}</div>
            <div className="barcode-area">
              <div className="barcode-mock">
                {[...Array(60)].map((_, i) => (
                  <div key={i} className="barcode-line" style={{ width: Math.random() > 0.5 ? '1px' : '2px', marginRight: Math.random() > 0.5 ? '1px' : '2px' }}></div>
                ))}
              </div>
              <span className="barcode-text">*{data.hall_ticket_number}*</span>
            </div>
          </div>
        </div>

        <hr className="divider" />

        <h3 className="document-title">Hall Ticket</h3>

        {/* Candidate Details Table */}
        <div className="details-section">
          <table className="details-table">
            <tbody>
              <tr>
                <td className="label">Name of the Candidate</td>
                <td className="value">{data.full_name.toUpperCase()} [{data.application_id}]</td>
                <td rowSpan="4" className="photo-cell">
                  <div className="photo-box">
                    {data.photo_path ? (
                      <img src={getPhotoUrl(data.photo_path)} alt="Candidate" />
                    ) : (
                      <div className="no-photo">No Photo Uploaded</div>
                    )}
                  </div>
                </td>
              </tr>
              <tr>
                <td className="label">Subject / Discipline</td>
                <td className="value">{data.subject}</td>
              </tr>
              <tr>
                <td className="label">Date & Time</td>
                <td className="value">{new Date(data.exam_date).toLocaleDateString('en-GB').replace(/\//g, '.')} & {data.exam_time}</td>
              </tr>
              <tr>
                <td className="label">Venue</td>
                <td className="value">{data.venue_hall_name || data.exam_venue}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Instructions */}
        <div className="instructions-section">
          <h4>Instructions :</h4>
          <ol>
            <li>Applicant should be in the Examination hall 30 minutes before the commencement of Entrance Examination.</li>
            <li>Applicant should carry one ID proof authorized by the Government.</li>
            <li>No TA/DA will be paid for attending the Common Entrance Test.</li>
            <li>No Candidate will be allowed to the entrance test without hall ticket.</li>
            <li>Mobile (or) Other Electronics items are not allowed in the Examination Hall.</li>
            <li>Candidates are requested to carefully read the instructions of the Entrance Examinations before answering the questions.</li>
            <li>The person with visual impairment can bring their scribe for entrance test. Scribe should not be in the same subject (Evidence should be produced) and must have computer knowledge.</li>
            <li>The candidates should not press the submit button before answering all the questions.</li>
            <li>The Result will be released through University website The candidate can download their entrance marks, from the CET portal link: <strong>http://65.0.100.133/rsm/index.php/prePhd/OnlineApplication/alreadyRegistered/login/2</strong> The user name is your application number and password is your date of birth.</li>
            <li>Candidates qualifying CET and fulfilling all the minimum eligibility conditions shall apply and appear for the interview. Admission to Ph.D programme is based on the CET, PG Marks and interview scores.</li>
            <li>Selection of Candidate for admission in based on the vacancies available for the particular programme even if the candidate fulfills all the minimum requirements.</li>
            <li>Admission for Ph.D. programmes will be processed by the concerned Departments / Colleges based on the Ph.D. regulations of Periyar University.</li>
          </ol>
        </div>

        <div className="note-section">
          <strong>Note:</strong> The issuance of Hall Ticket shall not be deemed to have conferred any right to claim admission to the Ph.D.Programme for which the candidate has applied for.
        </div>

        {/* Signatures */}
        <div className="signature-section">
          <div className="student-sig">
            <div className="sig-space"></div>
            <span>STUDENT SIGNATURE</span>
          </div>
          <div className="registrar-sig">
            <div className="registrar-content">
              <p>-/Sd../-</p>
              <span className="registrar-label">REGISTRAR I/c</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HallTicketPrint;
