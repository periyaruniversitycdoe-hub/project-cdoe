import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  CreditCard, Building2, Shield,
  ArrowLeft, Loader2, ExternalLink,
  Smartphone, Wallet, AlertTriangle, Clock,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api';

// ── Payment methods — all route through Paytm's hosted checkout ───────────────
// The tab selection is informational UX; on Paytm's page the user picks the
// matching option (e.g. "Google Pay" under UPI). Paytm supports all methods.
const METHODS = [
  {
    id        : 'googlepay',
    label     : 'Google Pay',
    payMethod : 'upi_intent',
    subMethod : 'googlepay',
    color     : '#4285F4',
    initials  : 'G',
    badgeColor: '#4285F4',
    group     : 'upi',
    hint      : "Select 'Google Pay' on the Paytm secure page",
  },
  {
    id        : 'phonepe',
    label     : 'PhonePe',
    payMethod : 'upi_intent',
    subMethod : 'phonepe',
    color     : '#5f259f',
    initials  : 'Ph',
    badgeColor: '#5f259f',
    group     : 'upi',
    hint      : "Select 'PhonePe' on the Paytm secure page",
  },
  {
    id        : 'paytm',
    label     : 'Paytm',
    payMethod : 'upi_intent',
    subMethod : 'paytm',
    color     : '#00BAF2',
    initials  : 'Py',
    badgeColor: '#00BAF2',
    group     : 'upi',
    hint      : 'Pay using Paytm UPI / Wallet on the secure page',
  },
  {
    id        : 'credit_card',
    label     : 'Credit Card',
    payMethod : 'card',
    subMethod : 'credit',
    icon      : CreditCard,
    color     : '#1e3a8a',
    group     : 'card',
    hint      : 'Enter your credit card details on the Paytm secure page',
    badges    : ['Visa', 'Master', 'RuPay', 'Amex'],
  },
  {
    id        : 'debit_card',
    label     : 'Debit Card',
    payMethod : 'card',
    subMethod : 'debit',
    icon      : CreditCard,
    color     : '#0f766e',
    group     : 'card',
    hint      : 'Enter your debit card details on the Paytm secure page',
    badges    : ['Visa', 'Master', 'RuPay'],
  },
  {
    id        : 'netbanking',
    label     : 'Net Banking',
    payMethod : 'netbanking',
    subMethod : null,
    icon      : Building2,
    color     : '#b45309',
    group     : 'card',
    hint      : 'Select your bank on the Paytm secure page',
    badges    : ['SBI', 'HDFC', 'ICICI', '+more'],
  },
];

// ── Method group pill ─────────────────────────────────────────────────────────
function GroupLabel({ children }) {
  return (
    <p className="text-muted mb-1 mt-2" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em' }}>
      {children}
    </p>
  );
}

export default function Payment() {
  const { token } = useAuthStore();
  const navigate  = useNavigate();

  const [feeInfo,       setFeeInfo]       = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState('googlepay');
  const [paying,        setPaying]        = useState(false);
  const [agreed,        setAgreed]        = useState(false);

  const ax = useCallback(
    () => axios.create({ headers: { Authorization: `Bearer ${token}` } }),
    [token],
  );

  // Load fee details + pending status on mount; also increment resume count
  useEffect(() => {
    const client = ax();
    Promise.all([
      client.get(`${API}/payment/fee-details`),
      client.get(`${API}/payment/pending-status`),
    ]).then(([feeRes, statusRes]) => {
      setFeeInfo(feeRes.data);
      if (statusRes.data.success) {
        const ps = statusRes.data.data;
        setPendingStatus(ps);
        // If already paid, redirect away
        if (ps.is_paid || feeRes.data?.payment_status === 'Paid') {
          navigate('/review');
          return;
        }
        // Increment resume count when user arrives at payment page after pay_later
        if (ps.payment_decision === 'pay_later' && !ps.is_expired) {
          client.post(`${API}/payment/record-resume`).catch(() => {});
        }
      }
    })
    .catch(() => toast.error('Failed to load payment details. Please refresh.'))
    .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isExpired = pendingStatus?.is_expired;
  const dueDate   = pendingStatus?.payment_due_date
    ? new Date(pendingStatus.payment_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;
  const daysLeft  = pendingStatus?.days_left;

  // ── Initiate payment — ALL methods create a Paytm order & redirect ──────────
  async function handlePay() {
    if (!agreed) { toast.error('Please accept the terms to proceed.'); return; }
    const method = METHODS.find(m => m.id === selected);
    if (!method) return;

    setPaying(true);
    try {
      const { data: resp } = await ax().post(`${API}/payment/initiate`, {
        payment_method    : method.payMethod,
        payment_sub_method: method.subMethod,
      });

      if (!resp.success) throw new Error(resp.message || 'Payment initiation failed');

      const checkoutUrl = resp.data?.checkoutUrl;
      if (!checkoutUrl) throw new Error('No checkout URL received from payment gateway');

      // Redirect to Paytm's hosted payment page — handles UPI, Cards, Net Banking
      window.location.href = checkoutUrl;

      // Note: setPaying(false) is intentionally NOT called here because we are
      // redirecting away. If the redirect fails, the catch block handles it.
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to start payment');
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    );
  }

  // Expired: block entire payment page
  if (isExpired) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center px-3">
        <div className="card border-0 shadow-lg rounded-4 p-5 text-center" style={{ maxWidth: 480 }}>
          <div className="d-flex justify-content-center mb-3">
            <div className="rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: 80, height: 80, background: '#fee2e2' }}>
              <AlertTriangle size={40} className="text-danger" />
            </div>
          </div>
          <h4 className="fw-bold text-danger mb-2">Payment Deadline Expired</h4>
          <p className="text-muted mb-1">
            Your payment deadline{dueDate ? ` (${dueDate})` : ''} has passed.
          </p>
          <p className="text-muted small mb-4">
            Please contact the university to request a payment deadline extension before making any payment.
          </p>
          <button className="btn btn-outline-secondary rounded-pill px-4" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={15} className="me-2" />Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const method = METHODS.find(m => m.id === selected);
  const amount = feeInfo?.amount || 1500;
  const isUpi  = method?.group === 'upi';

  return (
    <div className="container-fluid py-4 px-3 px-md-4" style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ── Deadline warning banner ──────────────────────────────────────────── */}
      {dueDate && daysLeft !== null && daysLeft <= 3 && !isExpired && (
        <div className="alert border-0 rounded-3 d-flex align-items-center gap-3 mb-4 py-2 px-3"
          style={{ background: daysLeft === 0 ? '#fef2f2' : '#fff7ed', border: `1.5px solid ${daysLeft === 0 ? '#fca5a5' : '#fed7aa'}` }}>
          <Clock size={16} className={daysLeft === 0 ? 'text-danger flex-shrink-0' : 'text-warning flex-shrink-0'} />
          <span className="small fw-semibold" style={{ color: daysLeft === 0 ? '#dc2626' : '#92400e' }}>
            {daysLeft === 0
              ? `Payment deadline is TODAY (${dueDate}). Complete payment immediately.`
              : `Payment deadline in ${daysLeft} day${daysLeft > 1 ? 's' : ''} — ${dueDate}. Pay before it expires.`}
          </span>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <button className="btn btn-sm btn-outline-secondary rounded-3" onClick={() => navigate('/review')}>
          <ArrowLeft size={15} />
        </button>
        <div>
          <h5 className="fw-bold mb-0">Pay Application Fee</h5>
          <p className="text-muted small mb-0">Secure online payment — Periyar University PhD Admissions</p>
        </div>
      </div>

      <div className="row g-4">

        {/* ── Left: method selector ─────────────────────────────────────────── */}
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3">
            <p className="text-muted fw-semibold mb-1" style={{ fontSize: 11, letterSpacing: '.07em' }}>
              SELECT PAYMENT METHOD
            </p>

            <GroupLabel>UPI</GroupLabel>
            <div className="d-flex flex-column gap-2 mb-1">
              {METHODS.filter(m => m.group === 'upi').map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelected(m.id); setAgreed(false); }}
                  className={`btn text-start rounded-3 px-3 py-2 d-flex align-items-center gap-2 ${
                    selected === m.id ? 'text-white border-0' : 'btn-outline-secondary border'
                  }`}
                  style={selected === m.id ? { background: m.color } : {}}
                >
                  <span
                    className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                    style={{
                      width: 28, height: 28, fontSize: 11,
                      background: selected === m.id ? 'rgba(255,255,255,.25)' : m.badgeColor,
                    }}
                  >
                    {m.initials}
                  </span>
                  <span className="fw-semibold small">{m.label}</span>
                </button>
              ))}
            </div>

            <GroupLabel>CARD &amp; NET BANKING</GroupLabel>
            <div className="d-flex flex-column gap-2">
              {METHODS.filter(m => m.group === 'card').map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelected(m.id); setAgreed(false); }}
                  className={`btn text-start rounded-3 px-3 py-2 d-flex align-items-center gap-2 ${
                    selected === m.id ? 'text-white border-0' : 'btn-outline-secondary border'
                  }`}
                  style={selected === m.id ? { background: m.color } : {}}
                >
                  {m.icon && <m.icon size={15} className="flex-shrink-0" />}
                  <span className="fw-semibold small">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Gateway badge */}
            <div className="mt-3 pt-3 border-top d-flex align-items-center gap-2" style={{ fontSize: 10 }}>
              <Shield size={11} className="text-success" />
              <span className="text-muted">Powered by Paytm Payment Gateway</span>
            </div>
          </div>
        </div>

        {/* ── Right: payment panel ──────────────────────────────────────────── */}
        <div className="col-12 col-md-8">
          <div className="card border-0 shadow-sm rounded-4 p-4">

            {/* Amount bar */}
            <div
              className="d-flex align-items-center justify-content-between rounded-3 px-4 py-3 mb-3"
              style={{ background: '#f0f4f8' }}
            >
              <div>
                <div className="text-muted small">Amount to Pay</div>
                <div className="fw-bold fs-3" style={{ color: '#1a3a5c' }}>
                  ₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  PhD Admission Processing Fee (Non-Refundable)
                </div>
              </div>
              <Shield size={36} className="text-success opacity-75" />
            </div>

            {/* Premium Payment Summary Details */}
            <div className="mb-4 p-3 rounded-3" style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', fontSize: '13px' }}>
              <p className="text-muted fw-bold mb-2" style={{ fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase' }}>
                Applicant Payment Summary
              </p>
              <div className="row g-2">
                <div className="col-sm-6">
                  <span className="text-muted">Community:</span> <strong className="text-dark">{feeInfo?.community || 'N/A'}</strong>
                </div>
                <div className="col-sm-6">
                  <span className="text-muted">Category:</span> <strong className="text-dark">{feeInfo?.category || 'General'}</strong>
                </div>
                <div className="col-sm-6">
                  <span className="text-muted">Applicable Fee Type:</span> <strong className="text-dark">{feeInfo?.fee_type || 'General Fee'}</strong>
                </div>
                <div className="col-sm-6">
                  <span className="text-muted">Payable Amount:</span> <strong className="text-primary">₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
            </div>

            {/* Method panel */}
            <div className="text-center py-2">

              {/* Icon */}
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: 80, height: 80, background: (method?.color || '#333') + '18' }}
              >
                {isUpi ? (
                  <span className="fw-bold" style={{ fontSize: 28, color: method?.color }}>
                    {method?.initials}
                  </span>
                ) : method?.icon ? (
                  <method.icon size={36} style={{ color: method?.color }} />
                ) : (
                  <Wallet size={36} className="text-muted" />
                )}
              </div>

              <h6 className="fw-bold mb-1">Pay with {method?.label}</h6>

              {/* Network badges for card/netbanking */}
              {method?.badges && (
                <div className="d-flex flex-wrap gap-1 justify-content-center mb-2">
                  {method.badges.map(b => (
                    <span key={b} className="badge bg-light text-secondary border" style={{ fontSize: 11 }}>
                      {b}
                    </span>
                  ))}
                </div>
              )}

              {/* Info box — explains what happens next */}
              <div
                className="alert border rounded-3 text-start small mb-4 mx-auto"
                style={{ maxWidth: 420, background: '#f8fafc', borderColor: '#e2e8f0' }}
              >
                <div className="d-flex gap-2 align-items-start">
                  <Smartphone size={14} className="text-primary flex-shrink-0 mt-1" />
                  <div>
                    {isUpi ? (
                      <>
                        Clicking <strong>Pay Now</strong> opens <strong>Paytm's secure payment page</strong>.
                        On that page, choose{' '}
                        <strong>
                          {method?.id === 'googlepay' && 'Google Pay'}
                          {method?.id === 'phonepe'   && 'PhonePe'}
                          {method?.id === 'paytm'     && 'Paytm UPI / Wallet'}
                        </strong>{' '}
                        under the UPI section to complete payment instantly.
                      </>
                    ) : method?.id === 'netbanking' ? (
                      <>
                        Clicking <strong>Pay Now</strong> opens <strong>Paytm's secure payment page</strong>.
                        Select your bank from the list to complete net banking authentication.
                      </>
                    ) : (
                      <>
                        Clicking <strong>Pay Now</strong> opens <strong>Paytm's secure payment page</strong>.
                        Enter your {method?.id === 'credit_card' ? 'credit' : 'debit'} card number, expiry,
                        and CVV. 3D Secure / OTP verification is enabled for your protection.
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Terms */}
              <div className="form-check d-flex align-items-start gap-2 text-start mb-4 mx-auto" style={{ maxWidth: 420 }}>
                <input
                  className="form-check-input mt-1 flex-shrink-0"
                  type="checkbox"
                  id="terms"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                />
                <label className="form-check-label small text-muted" htmlFor="terms">
                  I understand the PhD admission processing fee is <strong>non-refundable</strong> and
                  I am making this payment to Periyar University. I authorise this transaction.
                </label>
              </div>

              {/* Pay button */}
              <button
                className="btn btn-lg fw-bold rounded-3 text-white px-5 py-2"
                style={{ background: agreed ? (method?.color || '#1a3a5c') : '#94a3b8', cursor: agreed ? 'pointer' : 'not-allowed', transition: 'background .2s' }}
                disabled={paying || !agreed}
                onClick={handlePay}
              >
                {paying ? (
                  <><Loader2 size={16} className="animate-spin me-2" />Redirecting to Paytm…</>
                ) : (
                  <>
                    Pay ₹{parseFloat(amount).toLocaleString('en-IN')}
                    <ExternalLink size={14} className="ms-2" />
                  </>
                )}
              </button>

              <p className="text-muted mt-2 mb-0" style={{ fontSize: 11 }}>
                You will be redirected to Paytm's secure payment page
              </p>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-top d-flex flex-wrap align-items-center gap-3" style={{ fontSize: 11 }}>
              <span className="d-flex align-items-center gap-1 text-muted">
                <Shield size={12} className="text-success" /> PCI-DSS compliant
              </span>
              <span className="d-flex align-items-center gap-1 text-muted">
                <Shield size={12} className="text-success" /> 256-bit SSL encryption
              </span>
              <span className="d-flex align-items-center gap-1 text-muted">
                <Shield size={12} className="text-success" /> Card details not stored on our servers
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
