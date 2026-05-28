import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || `(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api`;

export default function VerifyReceipt() {
  const [params] = useSearchParams();
  const code = params.get('code');

  const [phase,  setPhase]  = useState('loading');
  const [data,   setData]   = useState(null);

  useEffect(() => {
    if (!code) { setPhase('invalid'); return; }
    axios.get(`${API}/payment/verify-receipt?code=${encodeURIComponent(code)}`)
      .then(r => { setData(r.data?.data || null); setPhase('valid'); })
      .catch(e => {
        if (e.response?.status === 404) setPhase('notfound');
        else setPhase('error');
      });
  }, [code]);

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div className="card border-0 shadow rounded-4 p-5 text-center" style={{ maxWidth: 480, width: '100%' }}>

        {phase === 'loading' && (
          <>
            <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
            <h6 className="fw-bold">Verifying Receipt…</h6>
          </>
        )}

        {phase === 'valid' && data && (
          <>
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-4 mx-auto"
                 style={{ width: 80, height: 80, background: '#dcfce7' }}>
              <CheckCircle size={44} className="text-success" />
            </div>
            <h5 className="fw-bold text-success mb-1">Receipt Verified</h5>
            <p className="text-muted small mb-4">This is an authentic Periyar University payment receipt.</p>

            <div className="bg-light border rounded-3 p-3 text-start">
              {[
                ['Receipt No',    data.receipt_number],
                ['Amount Paid',   data.amount ? `₹ ${parseFloat(data.amount).toLocaleString('en-IN')}` : null],
                ['Applicant',     data.applicant_name],
                ['Application',   data.application_id],
                ['Issued At',     data.issued_at ? new Date(data.issued_at).toLocaleString('en-IN') : null],
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label} className="d-flex justify-content-between py-1 border-bottom" style={{ fontSize: 12 }}>
                  <span className="text-muted">{label}</span>
                  <span className="fw-semibold text-dark text-end" style={{ maxWidth: '60%' }}>{val}</span>
                </div>
              ))}
            </div>

            <div className="alert alert-success border-0 rounded-3 small mt-3 mb-0">
              Verified by Periyar University Admissions System
            </div>
          </>
        )}

        {(phase === 'notfound' || phase === 'invalid') && (
          <>
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-4 mx-auto"
                 style={{ width: 80, height: 80, background: '#fee2e2' }}>
              <AlertCircle size={44} className="text-danger" />
            </div>
            <h5 className="fw-bold text-danger mb-2">Receipt Not Found</h5>
            <p className="text-muted small mb-0">
              {phase === 'invalid'
                ? 'No verification code provided.'
                : 'This receipt code is not valid or has not been issued by Periyar University.'}
            </p>
          </>
        )}

        {phase === 'error' && (
          <>
            <AlertCircle size={48} className="text-warning mx-auto mb-3" />
            <h6 className="fw-bold">Verification Unavailable</h6>
            <p className="text-muted small">Please try again later or contact the admissions office.</p>
          </>
        )}

      </div>
    </div>
  );
}
