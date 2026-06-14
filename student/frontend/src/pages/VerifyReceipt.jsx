import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const API = (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';

function fmtDate(iso) {
  if (!iso) return 'N/A';
  const s = String(iso).trim();
  const ddmm = s.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (ddmm) return `${ddmm[3]}-${ddmm[2]}-${ddmm[1]} ${ddmm[4]}:${ddmm[5]}:${ddmm[6]}.0`;
  const d = new Date(s);
  if (isNaN(d)) return s;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.0`;
}

function nowStamp() {
  return fmtDate(new Date().toISOString()).replace('.0', '');
}

export default function VerifyReceipt() {
  const [params] = useSearchParams();
  const code = params.get('code');
  const navigate = useNavigate();

  const [phase, setPhase] = useState('loading');
  const [data, setData] = useState(null);
  const [generatedAt] = useState(() => nowStamp());

  useEffect(() => {
    if (!code) { setPhase('invalid'); return; }
    axios.get(`${API}/payment/verify-receipt?code=${encodeURIComponent(code)}`)
      .then(r => { setData(r.data?.data || null); setPhase('valid'); })
      .catch(e => { setPhase(e.response?.status === 404 ? 'notfound' : 'error'); });
  }, [code]);

  if (phase === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
      <Loader2 size={48} style={{ color: '#0d6efd', marginBottom: 12 }} />
      <p style={{ color: '#555', fontWeight: 600 }}>Verifying Payment Receipt Authenticity...</p>
    </div>
  );

  if (phase !== 'valid') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: '40px 48px', textAlign: 'center', maxWidth: 440, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
        <AlertCircle size={52} style={{ color: phase === 'error' ? '#f59e0b' : '#dc3545', marginBottom: 16 }} />
        <h4 style={{ fontFamily: 'Arial', fontWeight: 700, marginBottom: 8 }}>
          {phase === 'error' ? 'Verification Unavailable' : 'Receipt Verification Failed'}
        </h4>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
          {phase === 'invalid' ? 'No verification code provided.'
            : phase === 'notfound' ? 'This receipt code is not valid or was not issued by Periyar University.'
            : 'We encountered an issue. Please try again later.'}
        </p>
        <button onClick={() => navigate('/')} style={{ background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 32px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Go to Portal Home
        </button>
      </div>
    </div>
  );

  let payload = {};
  try { payload = data?.callback_payload ? (typeof data.callback_payload === 'string' ? JSON.parse(data.callback_payload) : data.callback_payload) : {}; } catch { /**/ }

  const orderIdVal        = data.order_id || 'N/A';
  const transactionId     = data.gateway_transaction_id || payload.TXNID || payload.txnId || orderIdVal;
  const bankTransactionId = payload.BANKTXNID || payload.bankTxnId || data.gateway_transaction_id || orderIdVal;
  const txnAmount         = data.amount ? parseFloat(data.amount).toFixed(2) : '0.00';
  const txnStatus         = data.payment_status === 'SUCCESS' ? 'TXN_SUCCESS' : (data.payment_status || 'TXN_SUCCESS');
  const gatewayName       = payload.GATEWAYNAME || payload.gatewayName || 'SBI';
  const responseCode      = payload.RESPCODE || payload.respCode || (payload.resultInfo ? payload.resultInfo.resultCode : null) || '01';
  const responseMessage   = payload.RESPMSG || payload.respMsg || (payload.resultInfo ? payload.resultInfo.resultMsg : null) || 'Txn Success';
  const bankName          = payload.BANKNAME || payload.bankName || 'State Bank of India';
  const merchantId        = payload.MID || payload.mid || 'Periya40654046259334';
  const paymentMode       = payload.PAYMENTMODE || payload.paymentMode || (data.payment_method === 'netbanking' ? 'NB' : data.payment_method === 'card' ? 'CC' : (data.payment_method || 'NB'));

  const rows = [
    ['Transaction ID',      transactionId],
    ['Bank Transaction ID', bankTransactionId],
    ['Order ID',            orderIdVal],
    ['Transaction Amount',  txnAmount],
    ['STATUS',              txnStatus],
    ['Transaction Type',    'SALE'],
    ['GATEWAYNAME',         gatewayName],
    ['Response Code',       responseCode],
    ['Response Message',    responseMessage],
    ['Bank Name',           bankName],
    ['Merchant ID',         merchantId],
    ['Payment Mode',        paymentMode],
    ['Refund Amount',       '0.0'],
    ['Transaction Date',    fmtDate(data.issued_at)],
  ];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #e8eaf0; }

        .rp-outer { background: #e8eaf0; min-height: 100vh; padding: 24px 16px 48px; }

        .rp-banner {
          max-width: 800px;
          margin: 0 auto 14px;
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
          border-radius: 5px;
          padding: 11px 16px;
          font-family: Arial, sans-serif;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 500;
        }

        .rp-page {
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
          padding: 24px 28px 20px;
          font-family: Arial, Helvetica, sans-serif;
          color: #000;
        }

        .rp-hdr {
          display: grid;
          grid-template-columns: 108px 1fr 108px;
          align-items: center;
          margin-bottom: 20px;
        }
        .rp-hdr-logo img { width: 96px; height: auto; display: block; }
        .rp-hdr-text { text-align: center; padding: 0 10px; }
        .rp-hdr-text h1 { font-size: 28px; font-weight: 900; margin: 0 0 3px; letter-spacing: 0.3px; color: #000; }
        .rp-hdr-text .sub { font-size: 10.5px; font-weight: 700; line-height: 1.6; color: #000; margin: 0 0 4px; }
        .rp-hdr-text .addr { font-size: 14.5px; font-weight: 900; color: #000; margin: 0; }
        .rp-hdr-photo { display: flex; justify-content: flex-end; align-items: center; }
        .rp-photo-frame { border: 3px solid #c8940a; padding: 2px; background: #fff; display: inline-block; line-height: 0; overflow: hidden; width: 102px; height: 122px; }
        .rp-photo-frame img { width: 96px; height: 116px; object-fit: cover; object-position: 50% 5%; display: block; }

        .rp-box { border: 1.5px solid #5a9fd4; padding: 14px 18px 18px; margin-bottom: 16px; }
        .rp-box-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 2px; }
        .rp-box-left { flex: 1; }

        .rp-title { font-size: 16px; font-weight: 700; margin: 0 0 7px; display: flex; align-items: center; gap: 7px; color: #000; }
        .rp-title-icon { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0; color: #000; }

        .rp-det { font-size: 13px; margin: 0; color: #000; }
        .rp-det-lbl { font-weight: 700; text-decoration: underline; }
        .rp-det-val { font-weight: 700; }

        .rp-qr { flex-shrink: 0; text-align: center; }
        .rp-qr img { width: 90px; height: 90px; display: block; border: 1px solid #ddd; }
        .rp-qr-lbl { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-top: 3px; }

        .rp-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .rp-table td { border: 1px solid #bbb; padding: 5.5px 11px; font-size: 13px; vertical-align: middle; }
        .rp-table td.L { background: #f4f4f4; font-weight: 700; color: #000; width: 33%; }
        .rp-table td.R { background: #fff; color: #222; }

        .rp-dl-stamp { font-size: 10px; color: #333; font-family: Arial, sans-serif; margin-bottom: 6px; text-align: left; }
        .rp-stamp { font-size: 10.5px; color: #666; text-align: right; margin-top: 6px; margin-bottom: 14px; font-style: italic; }

        .rp-ctrl { display: flex; justify-content: center; align-items: center; gap: 36px; margin-top: 4px; padding-top: 4px; }
        .rp-btn { background: none; border: none; cursor: pointer; font-weight: 700; font-size: 13.5px; display: flex; align-items: center; gap: 6px; color: #000; padding: 4px 6px; font-family: Arial, sans-serif; }
        .rp-btn:hover { opacity: 0.6; }
        .rp-close-circle { width: 16px; height: 16px; border: 1.5px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; line-height: 1; }

        @media print {
          body { background: #fff !important; margin: 0 !important; }
          .rp-outer { background: #fff !important; padding: 0 !important; min-height: 0 !important; }
          .rp-banner, .rp-ctrl, .rp-stamp { display: none !important; }
          .rp-dl-stamp { display: block !important; }
          .rp-page { max-width: 100% !important; margin: 0 !important; padding: 10px 18px !important; }
          .rp-box { border: 1.5px solid #5a9fd4 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .rp-table td.L { background: #f4f4f4 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .rp-photo-frame { border: 3px solid #c8940a !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div className="rp-outer">

        {/* Verified banner */}
        <div className="rp-banner">
          <CheckCircle size={17} color="#059669" style={{ flexShrink: 0 }} />
          <span><strong>Receipt Verified Successfully</strong> — This is an authentic digital payment record generated by Periyar University.</span>
        </div>

        <div className="rp-page">

          {/* ── DOWNLOAD TIMESTAMP — top-left, visible on screen & print ── */}
          <div className="rp-dl-stamp">
            Downloaded on: {generatedAt}
          </div>

          {/* ── UNIVERSITY HEADER ── */}
          <div className="rp-hdr">
            <div className="rp-hdr-logo">
              <img src="/images/pu_logo.png" alt="Periyar University" />
            </div>
            <div className="rp-hdr-text">
              <h1>PERIYAR UNIVERSITY</h1>
              <p className="sub">
                STATE UNIVERSITY - NAAC 'A++' GRADE - NIRF<br />
                RANK 94 STATE PUBLIC UNIVERSITY RANK 40 -<br />
                SDG INSTITUTIONS RANK BAND: 11-50
              </p>
              <p className="addr">SALEM - 636 011, TAMIL NADU, INDIA</p>
            </div>
            <div className="rp-hdr-photo">
              <div className="rp-photo-frame">
                <img src="/images/periyar.png" alt="Thanthai Periyar" />
              </div>
            </div>
          </div>

          {/* ── RECEIPT BOX ── */}
          <div className="rp-box">
            <div className="rp-box-row">
              <div className="rp-box-left">
                <p className="rp-title">
                  <span className="rp-title-icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"/>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                  </span>
                  e-Receipt for Payment
                </p>
                <p className="rp-det">
                  <span className="rp-det-lbl">Payment Receipt Details:</span>{' '}
                  <span className="rp-det-val">
                    {data.applicant_name ? `${data.applicant_name} ` : ''}
                    [ {data.application_id || data.receipt_number || orderIdVal} ]
                  </span>
                </p>
              </div>
              {data.qr_code_base64 && (
                <div className="rp-qr">
                  <img src={data.qr_code_base64} alt="Scan to verify" />
                  <div className="rp-qr-lbl">Scan to Verify</div>
                </div>
              )}
            </div>

            <table className="rp-table">
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <td className="L">{label}</td>
                    <td className="R">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rp-stamp">Receipt generated on: {generatedAt}</div>

          {/* Controls */}
          <div className="rp-ctrl">
            <button className="rp-btn" onClick={() => window.print()}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print Receipt
            </button>
            <button className="rp-btn" onClick={() => navigate('/')}>
              <span className="rp-close-circle">✕</span>
              Close
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
