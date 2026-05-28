import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import axios from 'axios';
import { CheckCircle, AlertCircle, Loader2, Clock, Download, ArrowRight, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || `(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api`;

/**
 * PaymentCallback — handles the return redirect from any payment gateway.
 *
 * All gateways redirect to: /payment/callback?order_id=ORDER_xxx&...
 * PayU / CCAvenue POST to this URL (handled by reading searchParams since
 * the Vite SPA can't receive a direct POST; the gateway must be configured
 * with a GET return URL or we catch the data from the form POST via sessionStorage).
 */
export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const { token }      = useAuthStore();
  const navigate       = useNavigate();

  const [phase,   setPhase]   = useState('verifying'); // verifying | success | failed | awaiting | error
  const [receipt, setReceipt] = useState(null);
  const [errMsg,  setErrMsg]  = useState('');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }

    const orderId = searchParams.get('order_id');
    if (!orderId) {
      setPhase('error');
      setErrMsg('No order ID found in callback. Please check your payment history.');
      return;
    }

    // Collect any provider-specific params from the URL
    const callbackPayload = {};
    searchParams.forEach((val, key) => { if (key !== 'order_id') callbackPayload[key] = val; });

    // Check for PayU / CCAvenue form POST data stored by the return page
    const storedPayload = sessionStorage.getItem('payment_callback_payload');
    if (storedPayload) {
      try { Object.assign(callbackPayload, JSON.parse(storedPayload)); }
      catch { /* ignore */ }
      sessionStorage.removeItem('payment_callback_payload');
    }

    verifyPayment(orderId, callbackPayload);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function verifyPayment(orderId, callbackPayload) {
    setPhase('verifying');
    try {
      const res = await axios.post(`${API}/payment/verify`, {
        order_id: orderId,
        ...callbackPayload
      }, { headers: { Authorization: `Bearer ${token}` } });

      const { status, data } = res.data;

      if (status === 'SUCCESS') {
        setPhase('success');
        setReceipt(data?.receipt || null);
        toast.success('Payment verified successfully!');
      } else if (status === 'AWAITING_CONFIRMATION') {
        setPhase('awaiting');
      } else if (status === 'PROCESSING') {
        // Poll once more after 5 seconds
        setTimeout(() => pollStatus(orderId), 5000);
      } else {
        setPhase('failed');
        setErrMsg(res.data.message || 'Payment could not be verified.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setPhase('error');
      setErrMsg(msg);
    }
  }

  async function pollStatus(orderId) {
    try {
      const res = await axios.get(`${API}/payment/status/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { status } = res.data?.data || {};
      if (status === 'SUCCESS') {
        setPhase('success');
        toast.success('Payment confirmed!');
      } else if (status === 'AWAITING_CONFIRMATION') {
        setPhase('awaiting');
      } else {
        setPhase('failed');
        setErrMsg('Payment status: ' + (status || 'unknown'));
      }
    } catch {
      setPhase('error');
      setErrMsg('Unable to verify payment status. Please check your payment history.');
    }
  }

  function viewReceipt() {
    if (!receipt?.order_id) return;
    window.open(`/payment/receipt/${receipt.order_id}`, '_blank');
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div className="card border-0 shadow rounded-4 p-5 text-center" style={{ maxWidth: '500px', width: '100%' }}>

        {/* ── VERIFYING ─────────────────────────────────────────── */}
        {phase === 'verifying' && (
          <>
            <Loader2 size={52} className="animate-spin text-primary mb-4 mx-auto" />
            <h5 className="fw-bold text-dark mb-2">Verifying Your Payment</h5>
            <p className="text-muted small mb-0">
              Confirming transaction with the payment gateway. Please do not close this page.
            </p>
          </>
        )}

        {/* ── SUCCESS ──────────────────────────────────────────── */}
        {phase === 'success' && (
          <>
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-4 mx-auto"
                 style={{ width: 80, height: 80, background: '#dcfce7' }}>
              <CheckCircle size={44} className="text-success" />
            </div>
            <h5 className="fw-bold text-dark mb-1">Payment Successful!</h5>
            <p className="text-muted small mb-4">
              Your payment has been verified and your application has been submitted successfully.
            </p>

            {receipt && (
              <div className="bg-light border rounded-3 p-3 mb-4 text-start">
                {[
                  ['Receipt No',    receipt.receipt_number],
                  ['Amount Paid',   receipt.amount ? `₹ ${parseFloat(receipt.amount).toLocaleString('en-IN')}` : null],
                  ['Transaction',   receipt.gateway_transaction_id],
                  ['Payment Method',receipt.payment_method],
                  ['Issued At',     receipt.issued_at ? new Date(receipt.issued_at).toLocaleString('en-IN') : null]
                ].filter(([,v]) => v).map(([label, val]) => (
                  <div key={label} className="d-flex justify-content-between py-1 border-bottom" style={{ fontSize: '12px' }}>
                    <span className="text-muted">{label}</span>
                    <span className="fw-semibold text-dark text-end" style={{ maxWidth: '60%' }}>{val}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="d-flex flex-column gap-2">
              {receipt?.order_id && (
                <button className="btn btn-success rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2"
                        onClick={viewReceipt}>
                  <Printer size={16} /> View & Print Official Receipt
                </button>
              )}
              <button className="btn btn-primary rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2"
                      onClick={() => navigate('/review')}>
                View Submitted Application <ArrowRight size={16} />
              </button>
              <button className="btn btn-outline-secondary rounded-3 small"
                      onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </button>
            </div>
          </>
        )}

        {/* ── AWAITING ADMIN CONFIRMATION ───────────────────────── */}
        {phase === 'awaiting' && (
          <>
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-4 mx-auto"
                 style={{ width: 80, height: 80, background: '#fef9c3' }}>
              <Clock size={44} className="text-warning" />
            </div>
            <h5 className="fw-bold text-dark mb-2">Payment Under Review</h5>
            <p className="text-muted small mb-4">
              Your UPI payment reference has been received. Our admin team will verify it
              within <strong>24 hours</strong> and you will receive an email confirmation.
            </p>
            <div className="alert alert-warning border-0 rounded-3 small text-start mb-4">
              <strong>What happens next?</strong>
              <ul className="mt-1 mb-0 ps-3">
                <li>Admin verifies your UTR against bank records</li>
                <li>Application is locked and receipt generated</li>
                <li>Confirmation email sent to your registered address</li>
              </ul>
            </div>
            <button className="btn btn-primary rounded-3 fw-bold w-100"
                    onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
          </>
        )}

        {/* ── FAILED ───────────────────────────────────────────── */}
        {phase === 'failed' && (
          <>
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-4 mx-auto"
                 style={{ width: 80, height: 80, background: '#fee2e2' }}>
              <AlertCircle size={44} className="text-danger" />
            </div>
            <h5 className="fw-bold text-dark mb-2">Payment Failed</h5>
            <p className="text-muted small mb-4">
              {errMsg || 'Your payment could not be processed. No amount has been deducted.'}
            </p>
            <div className="d-flex flex-column gap-2">
              <button className="btn btn-primary rounded-3 fw-bold"
                      onClick={() => navigate('/payment')}>
                Try Again
              </button>
              <button className="btn btn-outline-secondary rounded-3 small"
                      onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </button>
            </div>
          </>
        )}

        {/* ── ERROR ─────────────────────────────────────────────── */}
        {phase === 'error' && (
          <>
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-4 mx-auto"
                 style={{ width: 80, height: 80, background: '#fee2e2' }}>
              <AlertCircle size={44} className="text-danger" />
            </div>
            <h5 className="fw-bold text-dark mb-2">Verification Error</h5>
            <p className="text-muted small mb-4">
              {errMsg || 'An unexpected error occurred while verifying your payment.'}
            </p>
            <div className="alert alert-info border-0 rounded-3 small text-start mb-4">
              If money was deducted from your account, please contact the admissions office with your
              transaction reference. Your payment will be verified manually.
            </div>
            <div className="d-flex flex-column gap-2">
              <button className="btn btn-outline-primary rounded-3 small"
                      onClick={() => navigate('/payment')}>
                Return to Payment
              </button>
              <button className="btn btn-outline-secondary rounded-3 small"
                      onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
