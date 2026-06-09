import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, AlertCircle } from 'lucide-react';

const ADMIN_API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

/* ── Date helpers ── */
function fmtDate(iso) {
  if (!iso) return 'N/A';
  const s = String(iso).trim();
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}:${m[6]}.0`;
  const d = new Date(s);
  if (isNaN(d)) return s;
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.0`;
}

function nowStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* ── Build full image URL from settings path ── */
function imgUrl(path, fallback) {
  if (!path) return fallback;
  if (path.startsWith('http')) return path;
  const base = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001';
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default function ReceiptView() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [loading,     setLoading]     = useState(true);
  const [data,        setData]        = useState(null);
  const [error,       setError]       = useState('');
  const [uniLogo,     setUniLogo]     = useState('/images/pu_logo.png');
  const [founderImg,  setFounderImg]  = useState(null);
  const [downloadedAt] = useState(() => nowStamp());

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/login'); return; }

    const headers = { Authorization: `Bearer ${token}` };

    const load = async () => {
      try {
        setLoading(true);

        // Fetch settings dynamically
        axios.get(`${ADMIN_API}/settings`, { headers }).then(r => {
          const s = r.data?.data || {};
          if (s.logo)               setUniLogo(imgUrl(s.logo, '/images/pu_logo.png'));
          if (s.founder_image_url)  setFounderImg(imgUrl(s.founder_image_url, null));
        }).catch(() => {/* keep defaults */});

        // Fetch receipt data
        const ep = `${ADMIN_API}/payment-management/receipt-data/${orderId}`;
        const res = await axios.get(ep, { headers });
        if (res.data?.success && res.data?.data) setData(res.data.data);
        else setError('Could not retrieve payment receipt details.');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load receipt.');
      } finally { setLoading(false); }
    };

    load();
  }, [orderId, navigate]);

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#fff', fontFamily:'Arial,sans-serif' }}>
      <Loader2 size={48} style={{ color:'#0d6efd', marginBottom:12 }} />
      <p style={{ color:'#555', fontWeight:600 }}>Retrieving Official Payment Receipt...</p>
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f9fa' }}>
      <div style={{ background:'#fff', borderRadius:10, padding:'40px 48px', textAlign:'center', maxWidth:420, boxShadow:'0 4px 20px rgba(0,0,0,0.12)' }}>
        <AlertCircle size={52} style={{ color:'#dc3545', marginBottom:16 }} />
        <h4 style={{ fontFamily:'Arial', fontWeight:700, marginBottom:8 }}>Receipt Unavailable</h4>
        <p style={{ color:'#666', fontSize:14, marginBottom:24 }}>{error || 'The receipt could not be generated at this time.'}</p>
        <button onClick={() => navigate(-1)} style={{ background:'#0d6efd', color:'#fff', border:'none', borderRadius:6, padding:'10px 32px', fontWeight:700, fontSize:14, cursor:'pointer' }}>Go Back</button>
      </div>
    </div>
  );

  let payload = {};
  try { payload = data.callback_payload ? (typeof data.callback_payload==='string' ? JSON.parse(data.callback_payload) : data.callback_payload) : {}; } catch {/**/}

  const orderIdVal        = data.order_id || 'N/A';
  const transactionId     = data.gateway_transaction_id || payload.TXNID || orderIdVal;
  const bankTransactionId = payload.BANKTXNID || data.gateway_transaction_id || orderIdVal;
  const txnAmount         = data.amount ? parseFloat(data.amount).toFixed(2) : '0.00';
  const txnStatus         = data.payment_status === 'SUCCESS' ? 'TXN_SUCCESS' : (data.payment_status || 'TXN_SUCCESS');
  const gatewayName       = payload.GATEWAYNAME || 'SBI';
  const responseCode      = payload.RESPCODE    || '01';
  const responseMessage   = payload.RESPMSG     || 'Txn Success';
  const bankName          = payload.BANKNAME    || 'State Bank of India';
  const merchantId        = payload.MID         || 'Periya40654046259334';
  const paymentMode       = payload.PAYMENTMODE || (data.payment_method === 'netbanking' ? 'NB' : data.payment_method === 'card' ? 'CC' : (data.payment_method || 'NB'));

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
        *{box-sizing:border-box;}
        body{margin:0;padding:0;background:#e8eaf0;}

        .rp-page{
          max-width:800px;
          margin:28px auto 48px;
          background:#fff;
          padding:10px 28px 20px;
          font-family:Arial,Helvetica,sans-serif;
          color:#000;
        }

        /* ── Download timestamp top-left ── */
        .rp-dl{
          font-size:10px;
          color:#333;
          margin-bottom:8px;
          text-align:left;
          font-family:Arial,sans-serif;
        }

        /* ── University header ── */
        .rp-hdr{
          display:grid;
          grid-template-columns:108px 1fr 108px;
          align-items:center;
          margin-bottom:18px;
        }
        .rp-hdr-logo img{width:96px;height:auto;display:block;}
        .rp-hdr-text{text-align:center;padding:0 10px;}
        .rp-hdr-text h1{font-size:28px;font-weight:900;margin:0 0 3px;letter-spacing:0.3px;color:#000;}
        .rp-hdr-text .sub{font-size:10.5px;font-weight:700;line-height:1.6;color:#000;margin:0 0 4px;}
        .rp-hdr-text .addr{font-size:14.5px;font-weight:900;color:#000;margin:0;}
        .rp-hdr-portrait{display:flex;align-items:center;justify-content:flex-end;}
        .rp-photo-frame { border: 3px solid #c8940a; padding: 2px; background: #fff; display: inline-block; line-height: 0; overflow: hidden; width: 102px; height: 122px; }
        .rp-photo-frame img { width: 96px; height: 116px; object-fit: cover; object-position: 50% 5%; display: block; }

        /* ── Divider line under header ── */
        .rp-divider{
          border:none;
          border-top:1.5px solid #ccc;
          margin:0 0 14px;
        }

        /* ── Receipt box ── */
        .rp-box{border:1.5px solid #5a9fd4;padding:14px 18px 18px;margin-bottom:4px;}
        .rp-box-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:4px;}
        .rp-box-left{flex:1;}
        .rp-title{font-size:16px;font-weight:700;margin:0 0 6px;display:flex;align-items:center;gap:7px;color:#000;}
        .rp-title-icon{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex-shrink:0;color:#000;}
        .rp-det{font-size:13px;margin:0;color:#000;}
        .rp-det-lbl{font-weight:700;text-decoration:underline;}
        .rp-det-val{font-weight:700;}

        /* QR Code */
        .rp-qr { flex-shrink: 0; text-align: center; }
        .rp-qr img { width: 90px; height: 90px; display: block; border: 1px solid #ddd; }
        .rp-qr-lbl { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-top: 3px; }

        /* Table */
        .rp-table{width:100%;border-collapse:collapse;margin-top:10px;}
        .rp-table td{border:1px solid #bbb;padding:5.5px 11px;font-size:13px;vertical-align:middle;}
        .rp-table td.L{background:#fff;font-weight:700;color:#000;width:33%;}
        .rp-table td.R{background:#fff;color:#222;}

        /* Controls */
        .rp-ctrl{display:flex;justify-content:center;align-items:center;gap:36px;margin-top:16px;}
        .rp-btn{background:none;border:none;cursor:pointer;font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:6px;color:#000;padding:4px 6px;font-family:Arial,sans-serif;}
        .rp-btn:hover{opacity:0.6;}
        .rp-close-circle{width:16px;height:16px;border:1.5px solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;line-height:1;}

        /* Print */
        @media print{
          body{background:#fff !important;margin:0 !important;}
          .rp-page{max-width:100% !important;margin:0 !important;padding:10px 18px !important;}
          .rp-ctrl{display:none !important;}
          .rp-dl{display:block !important;}
          .rp-box{border:1.5px solid #5a9fd4 !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
          .rp-table td.L{background:#fff !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
          .rp-photo-frame{border:3px solid #c8940a !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
          .rp-divider{border-top:1.5px solid #ccc !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        }
      `}</style>

      <div className="rp-page">

        {/* ── Downloaded on — top-left, shows on screen AND in print ── */}
        <div className="rp-dl">Downloaded on: {downloadedAt}</div>

        {/* ── University header ── */}
        <div className="rp-hdr">
          <div className="rp-hdr-logo">
            <img src={uniLogo} alt="Periyar University" onError={e => { e.target.src='/images/pu_logo.png'; }} />
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
          {/* Founder / chancellor portrait — loaded from university settings */}
          <div className="rp-hdr-portrait">
            <div className="rp-photo-frame">
              <img src={founderImg || '/images/periyar.png'} alt="Thanthai Periyar" onError={e => { e.target.src='/images/periyar.png'; }} />
            </div>
          </div>
        </div>

        <hr className="rp-divider" />

        {/* ── Receipt box ── */}
        <div className="rp-box">
          <div className="rp-box-row">
            <div className="rp-box-left">
              <p className="rp-title">
                <span className="rp-title-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
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
          <button className="rp-btn" onClick={() => window.close()}>
            <span className="rp-close-circle">✕</span>
            Close
          </button>
        </div>

      </div>
    </>
  );
}
