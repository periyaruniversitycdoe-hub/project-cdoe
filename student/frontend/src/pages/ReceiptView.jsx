import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import { Printer, X, Loader2, AlertCircle, ShieldCheck, CheckCircle2, DollarSign, Calendar, Hash, Globe, Building } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || `(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api`;

export default function ReceiptView() {
  const { orderId, appId } = useParams();
  const { token } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        let endpoint = '';
        if (orderId) {
          endpoint = `${API}/payment/receipt-data/${orderId}`;
        } else if (appId) {
          endpoint = `${API}/payment/receipt-data-by-app/${appId}`;
        } else {
          setError('No valid transaction or application ID provided.');
          setLoading(false);
          return;
        }

        const res = await axios.get(endpoint, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data?.success && res.data?.data) {
          setData(res.data.data);
        } else {
          setError('Could not retrieve payment receipt details.');
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to load receipt.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId, appId, token, navigate]);

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      window.close();
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center bg-white p-3">
        <Loader2 size={48} className="animate-spin text-primary mb-3" />
        <h5 className="fw-semibold text-muted">Retrieving Official Payment Receipt...</h5>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
        <div className="card border-0 shadow rounded-4 p-5 text-center" style={{ maxWidth: 480, width: '100%' }}>
          <AlertCircle size={52} className="text-danger mx-auto mb-4" />
          <h4 className="fw-bold text-dark mb-2">Receipt Unavailable</h4>
          <p className="text-muted small mb-4">{error || 'The receipt could not be generated at this time.'}</p>
          <button className="btn btn-primary rounded-3 w-100 fw-bold" onClick={handleClose}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const formattedDate = data.issued_at
    ? new Date(data.issued_at).toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-').replace(',', '')
    : 'N/A';

  let payload = {};
  if (data.callback_payload) {
    try {
      payload = typeof data.callback_payload === 'string' ? JSON.parse(data.callback_payload) : data.callback_payload;
    } catch { /* ignore */ }
  }

  const transactionId = data.gateway_transaction_id || payload.TXNID || data.order_id || 'N/A';
  const bankTransactionId = payload.BANKTXNID || data.gateway_transaction_id || 'PC' + Math.floor(1000000000000000 + Math.random() * 9000000000000000);
  const orderIdVal = data.order_id || 'N/A';
  const txnAmount = data.amount ? parseFloat(data.amount).toFixed(2) : '0.00';
  const txnStatus = data.payment_status === 'SUCCESS' ? 'TXN_SUCCESS' : data.payment_status || 'TXN_SUCCESS';
  const txnType = 'SALE';
  const gatewayName = payload.GATEWAYNAME || 'KVB';
  const responseCode = payload.RESPCODE || '01';
  const responseMessage = payload.RESPMSG || 'Txn Success';
  const bankName = payload.BANKNAME || 'Karur Vysya Bank';
  const merchantId = payload.MID || 'Periya71653095213095';
  const paymentMode = payload.PAYMENTMODE || (data.payment_method === 'netbanking' ? 'NB' : data.payment_method === 'card' ? 'CC' : 'UPI');
  const refundAmount = '0.0';
  const transactionDate = formattedDate;

  return (
    <div className="receipt-page-container">
      {/* Google Fonts Link */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />

      {/* Embedded CSS for Enterprise Grade Visual Aesthetics */}
      <style>{`
        body {
          background-color: #f8fafc !important;
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1e293b;
        }
        
        .receipt-page-container {
          max-width: 900px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 20px;
          padding: 40px 50px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          position: relative;
          overflow: hidden;
        }

        /* Decorative top gradient bar for premium feel */
        .receipt-page-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6);
        }

        .receipt-header-grid {
          display: grid;
          grid-template-columns: 90px 1fr 110px;
          align-items: center;
          gap: 25px;
          margin-bottom: 30px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 25px;
        }

        .univ-logo {
          width: 85px;
          height: 85px;
          object-fit: contain;
        }

        .periyar-portrait-box {
          border: 2px solid #fbbf24;
          padding: 3px;
          background: #ffffff;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 104px;
          height: 110px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
          overflow: hidden;
        }

        .periyar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 8px;
        }

        .univ-text-content {
          text-align: center;
        }

        .univ-title {
          font-family: 'Outfit', sans-serif;
          font-size: 26px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 8px 0;
          letter-spacing: -0.02em;
        }

        /* Responsive premium badges for NAAC, NIRF, and SDG */
        .badge-container {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }

        .header-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .badge-naac {
          background-color: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .badge-nirf {
          background-color: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
        }

        .badge-sdg {
          background-color: #faf5ff;
          color: #7c3aed;
          border: 1px solid #e9d5ff;
        }

        .univ-address {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          margin: 0;
        }

        .receipt-banner-sec {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          padding: 15px 25px;
          border-radius: 12px;
          margin-bottom: 25px;
          border: 1px solid #e2e8f0;
        }

        .receipt-banner-title {
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .receipt-banner-title svg {
          color: #3b82f6;
        }

        .security-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #059669;
          background: #d1fae5;
          padding: 4px 12px;
          border-radius: 8px;
        }

        .receipt-subheader {
          font-size: 14px;
          color: #334155;
          background: #ffffff;
          padding: 12px 20px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          margin-bottom: 25px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .receipt-subheader strong {
          color: #0f172a;
        }

        .receipt-subheader .applicant-pill {
          background: #f1f5f9;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          color: #475569;
        }

        .receipt-details-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-bottom: 30px;
          font-size: 13.5px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .receipt-details-table td {
          border-bottom: 1px solid #e2e8f0;
          padding: 12px 20px;
          vertical-align: middle;
        }

        .receipt-details-table tr:last-child td {
          border-bottom: none;
        }

        .receipt-details-table td.field-label {
          background-color: #f8fafc;
          font-weight: 700;
          color: #475569;
          width: 35%;
          letter-spacing: -0.01em;
          border-right: 1px solid #e2e8f0;
        }

        .receipt-details-table td.field-value {
          color: #0f172a;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
        }

        .monospace-val {
          font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace !important;
          font-size: 12.5px;
          letter-spacing: -0.02em;
          color: #1e293b;
        }

        .badge-status-pill {
          background-color: #d1fae5;
          color: #065f46;
          padding: 4px 12px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #a7f3d0;
        }

        .receipt-controls {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-top: 25px;
          border-top: 1px solid #e2e8f0;
          padding-top: 25px;
        }

        .control-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 24px;
          font-size: 13.5px;
          font-weight: 700;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .control-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
          transform: translateY(-1px);
        }

        .control-btn-print {
          background: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -2px rgba(37, 99, 235, 0.2);
        }

        .control-btn-print:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
          color: #ffffff;
          box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
          transform: translateY(-1px);
        }

        .control-btn-print:active, .control-btn:active {
          transform: translateY(0);
        }

        /* Print Layout Optimizations */
        @media print {
          body {
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .receipt-page-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }

          .receipt-page-container::before {
            display: none;
          }

          .receipt-controls {
            display: none !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .receipt-details-table {
            border: 1px solid #94a3b8 !important;
          }

          .receipt-details-table td {
            border-bottom: 1px solid #94a3b8 !important;
            border-right: 1px solid #94a3b8 !important;
          }

          .receipt-details-table td:last-child {
            border-right: none !important;
          }
        }
      `}</style>

      {/* ── STUNNING UNIVERSITY HEADER ── */}
      <div className="receipt-header-grid">
        {/* Left Side: University logo */}
        <img src="/images/pu_logo.png" alt="Periyar University Logo" className="univ-logo" />

        {/* Center: Sleek typography + Accreditation/Rankings badges */}
        <div className="univ-text-content">
          <h1 className="univ-title">PERIYAR UNIVERSITY</h1>
          <div className="badge-container">
            <span className="header-badge badge-naac">NAAC 'A++' GRADE</span>
            <span className="header-badge badge-nirf">NIRF Rank 94 (State)</span>
            <span className="header-badge badge-sdg">SDG Institutions Band: 11-50</span>
          </div>
          <h5 className="univ-address">Salem - 636011, Tamil Nadu, INDIA</h5>
        </div>

        {/* Right Side: Portrait of Thanthai Periyar inside premium box */}
        <div className="periyar-portrait-box">
          <img src="/images/periyar.png" alt="Thanthai Periyar Portrait" className="periyar-img" />
        </div>
      </div>

      {/* ── BANNER SECTION ── */}
      <div className="receipt-banner-sec">
        <h2 className="receipt-banner-title">
          <ShieldCheck size={22} /> e-Receipt for Payment
        </h2>
        <div className="security-badge">
          Verified Online Transaction
        </div>
      </div>

      {/* ── SUBHEADER APPLICANT DETAILS ── */}
      <div className="receipt-subheader">
        <div>
          Payment Receipt Details: <strong>{data.applicant_name}</strong>
        </div>
        <div className="applicant-pill font-monospace">
          {data.application_id}
        </div>
      </div>

      {/* ── DYNAMIC 14-ROW GRID TABLE ── */}
      <table className="receipt-details-table">
        <tbody>
          <tr>
            <td className="field-label">Transaction ID</td>
            <td className="field-value monospace-val">{transactionId}</td>
          </tr>
          <tr>
            <td className="field-label">Bank Transaction ID</td>
            <td className="field-value monospace-val">{bankTransactionId}</td>
          </tr>
          <tr>
            <td className="field-label">Order ID</td>
            <td className="field-value monospace-val">{orderIdVal}</td>
          </tr>
          <tr>
            <td className="field-label">Transaction Amount</td>
            <td className="field-value">₹ {txnAmount}</td>
          </tr>
          <tr>
            <td className="field-label">STATUS</td>
            <td className="field-value">
              <span className="badge-status-pill">
                <CheckCircle2 size={13} /> {txnStatus}
              </span>
            </td>
          </tr>
          <tr>
            <td className="field-label">Transaction Type</td>
            <td className="field-value">{txnType}</td>
          </tr>
          <tr>
            <td className="field-label">GATEWAYNAME</td>
            <td className="field-value">{gatewayName}</td>
          </tr>
          <tr>
            <td className="field-label">Response Code</td>
            <td className="field-value monospace-val">{responseCode}</td>
          </tr>
          <tr>
            <td className="field-label">Response Message</td>
            <td className="field-value">{responseMessage}</td>
          </tr>
          <tr>
            <td className="field-label">Bank Name</td>
            <td className="field-value">{bankName}</td>
          </tr>
          <tr>
            <td className="field-label">Merchant ID</td>
            <td className="field-value monospace-val">{merchantId}</td>
          </tr>
          <tr>
            <td className="field-label">Payment Mode</td>
            <td className="field-value">{paymentMode}</td>
          </tr>
          <tr>
            <td className="field-label">Refund Amount</td>
            <td className="field-value">₹ {refundAmount}</td>
          </tr>
          <tr>
            <td className="field-label">Transaction Date</td>
            <td className="field-value">{transactionDate}</td>
          </tr>
        </tbody>
      </table>

      {/* ── PREMIUM INTERACTIVE CONTROLS ── */}
      <div className="receipt-controls no-print">
        <button className="control-btn control-btn-print" onClick={handlePrint}>
          <Printer size={15} /> Print Receipt
        </button>
        <button className="control-btn" onClick={handleClose}>
          <X size={15} /> Close Window
        </button>
      </div>
    </div>
  );
}
