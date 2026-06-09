'use strict';
const express        = require('express');
const crypto         = require('crypto');
const router         = express.Router();
const { authenticateToken } = require('../middleware/auth');
const paymentService = require('../services/payment/paymentService');
const webhook        = require('../services/payment/webhookService');
const receipt        = require('../services/payment/receiptService');
const verification   = require('../services/payment/verificationService');
const db             = require('../config/db');

// ── Rate limiter: 5 payment initiations per user per minute ──────────────────
const _rateBuckets = new Map();
function paymentRateLimit(req, res, next) {
  const key   = `pay:${req.user?.id}:${Math.floor(Date.now() / 60000)}`;
  const count = (_rateBuckets.get(key) || 0) + 1;
  _rateBuckets.set(key, count);
  if (count > 5) return res.status(429).json({ success: false, message: 'Too many payment attempts. Please wait a minute.' });
  next();
}

// ── POST /api/payment/initiate ────────────────────────────────────────────────
router.post('/initiate', authenticateToken, paymentRateLimit, async (req, res) => {
  const { payment_method, payment_sub_method } = req.body;
  const VALID = ['upi_intent', 'upi_qr', 'upi_id', 'card', 'netbanking'];

  if (!VALID.includes(payment_method)) {
    return res.status(400).json({ success: false, message: `payment_method must be one of: ${VALID.join(', ')}` });
  }

  try {
    // Fetch application + fee
    const [[app]] = await db.query(
      `SELECT application_id, community, is_physically_challenged, payment_status, payment_due_date, payment_decision
       FROM applications WHERE user_id = ? LIMIT 1`,
      [req.user.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (['Paid', 'Verified', 'Approved'].includes(app.payment_status)) {
      return res.status(409).json({ success: false, message: 'Payment already completed for this application', alreadyPaid: true });
    }
    // Block if payment deadline has expired
    if (app.payment_due_date && new Date(app.payment_due_date).getTime() < Date.now()) {
      await db.query(
        `UPDATE applications SET status='PAYMENT_EXPIRED', payment_expired_at=COALESCE(payment_expired_at,NOW()), updated_at=NOW()
         WHERE user_id=?`,
        [req.user.id]
      );
      return res.status(403).json({ success: false, message: 'Payment deadline has expired. Please contact the university to extend your deadline.', expired: true });
    }

    // Duplicate success check by user_id (application_id not yet generated pre-payment)
    if (await verification.isDuplicatePayment(req.user.id)) {
      return res.status(409).json({ success: false, message: 'A successful payment already exists for this application', alreadyPaid: true });
    }

    const CommunityFeeCalculationService = require('../services/CommunityFeeCalculationService');
    const amount = await CommunityFeeCalculationService.calculateFee(app.community, app.is_physically_challenged, db);
    // Use user_id for order ID generation — application_id is null until after payment
    const orderId = paymentService.generateOrderId(req.user.id);

    // ALL payment methods (UPI, Card, Net Banking) → create Paytm order → hosted checkout.
    // Paytm's checkout page natively supports Google Pay, PhonePe, Paytm UPI, Cards, and
    // Net Banking. Routing UPI through Paytm ensures every payment is gateway-tracked,
    // webhook-confirmed, and auto-reconciled — direct-UPI bypass broke polling.
    const orderResult = await paymentService.createOrder({
      orderId, amount, custId: req.user.id,
    });
    const responseData = {
      orderId,
      amount,
      payment_method,
      checkoutUrl: orderResult.checkoutUrl,
      txnToken   : orderResult.txnToken,
    };

    // Persist transaction record — application_id is NULL here; updated to the
    // generated CETPHD ID by lockApplicationAndGenerateReceipt after payment success.
    await db.query(
      `INSERT INTO payment_transactions
         (order_id, application_id, user_id, amount, payment_method,
          payment_sub_method, provider_name, payment_status,
          redirect_url, expires_at, initiated_at)
       VALUES (?,?,?,?,?,?,'paytm','INITIATED',?,DATE_ADD(NOW(), INTERVAL 30 MINUTE),NOW())`,
      [orderId, null, req.user.id, amount, payment_method,
       payment_sub_method || null,
       responseData.checkoutUrl || null]
    );

    // Audit log — application_id null until post-payment generation
    await db.query(
      `INSERT INTO payment_audit_logs (order_id, application_id, user_id, action, new_status, ip_address)
       VALUES (?,?,?,'PAYMENT_INITIATED','INITIATED',?)`,
      [orderId, null, req.user.id, req.ip]
    ).catch(() => {});

    res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('[payment/initiate]', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Failed to initiate payment' });
  }
});

// ── POST /api/payment/callback  (Paytm server-side callback after redirect) ───
// Paytm POSTs here (form-encoded) after the user completes payment.
// NEVER trust the POST data alone — always verify via Paytm status API.
router.post('/callback', async (req, res) => {
  const orderId = req.body.ORDERID || req.body.order_id;
  const SPA     = process.env.PAYMENT_RETURN_URL || 'http://localhost:5173/payment/callback';

  if (!orderId) return res.redirect(`${SPA}?error=no_order_id`);

  try {
    // Step 1: Verify checksum of callback data (optional but recommended)
    const checksumHash = req.body.CHECKSUMHASH;
    if (checksumHash) {
      const bodyForVerify = { ...req.body };
      delete bodyForVerify.CHECKSUMHASH;
      const sigOk = await paymentService.verifyWebhookSignature(bodyForVerify, checksumHash).catch(() => false);
      if (!sigOk) {
        console.warn('[callback] Checksum mismatch for order', orderId, '— will still verify via API');
      }
    }

    // Step 2: Always verify against Paytm API — never lock application based on callback params alone
    const result = await paymentService.verifyTransaction(orderId);
    if (result.status === 'SUCCESS') {
      await _processVerification(orderId, { STATUS: 'TXN_SUCCESS', TXNID: result.txnId });
    }
  } catch (err) {
    console.error('[payment/callback]', err.message);
  }
  // Redirect to SPA — SPA will call /verify for final receipt data
  res.redirect(`${SPA}?order_id=${orderId}`);
});

// ── POST /api/payment/verify  (client-side verification after redirect) ───────
router.post('/verify', authenticateToken, async (req, res) => {
  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ success: false, message: 'order_id is required' });

  try {
    const [[txn]] = await db.query(
      'SELECT * FROM payment_transactions WHERE order_id = ? AND user_id = ? LIMIT 1',
      [order_id, req.user.id]
    );
    if (!txn) return res.status(404).json({ success: false, message: 'Order not found' });

    // If already success, return receipt info
    if (txn.payment_status === 'SUCCESS') {
      const [[rcpt]] = await db.query(
        'SELECT * FROM payment_receipts WHERE order_id = ? LIMIT 1', [order_id]
      );
      return res.json({ success: true, status: 'SUCCESS', data: { receipt: rcpt } });
    }

    // Query Paytm for latest status
    const result = await paymentService.verifyTransaction(order_id).catch(() => null);
    if (!result) return res.json({ success: true, status: txn.payment_status, data: {} });

    if (result.status === 'SUCCESS') {
      await _processVerification(order_id, { STATUS: 'TXN_SUCCESS', TXNID: result.txnId });
      const [[rcpt]] = await db.query('SELECT * FROM payment_receipts WHERE order_id = ? LIMIT 1', [order_id]);
      return res.json({ success: true, status: 'SUCCESS', data: { receipt: rcpt } });
    }
    if (result.status === 'FAILED') {
      return res.json({ success: false, status: 'FAILED', message: result.resultMsg || 'Payment failed' });
    }
    // Still processing
    res.json({ success: true, status: 'PROCESSING', data: {} });
  } catch (err) {
    console.error('[payment/verify]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/status/:orderId ─────────────────────────────────────────
router.get('/status/:orderId', authenticateToken, async (req, res) => {
  try {
    const [[txn]] = await db.query(
      'SELECT payment_status, gateway_transaction_id, amount FROM payment_transactions WHERE order_id = ? AND user_id = ? LIMIT 1',
      [req.params.orderId, req.user.id]
    );
    if (!txn) return res.status(404).json({ success: false, message: 'Order not found' });

    let status = txn.payment_status;

    // For non-terminal UPI states, poll Paytm for fresh status
    if (['INITIATED', 'PROCESSING'].includes(status)) {
      const live = await paymentService.verifyTransaction(req.params.orderId).catch(() => null);
      if (live && live.status === 'SUCCESS') {
        await _processVerification(req.params.orderId, { STATUS: 'TXN_SUCCESS', TXNID: live.txnId });
        status = 'SUCCESS';
      } else if (live?.status === 'FAILED') {
        status = 'FAILED';
      }
    }

    res.json({ success: true, data: { status, order_id: req.params.orderId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payment/record-resume  (increment resume count when user visits payment page) ──
router.post('/record-resume', authenticateToken, async (req, res) => {
  try {
    await db.query(
      `UPDATE applications
       SET payment_resume_count = COALESCE(payment_resume_count, 0) + 1,
           payment_latest_attempt_at = NOW(),
           payment_first_attempt_at = COALESCE(payment_first_attempt_at, NOW()),
           updated_at = NOW()
       WHERE user_id = ?`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/pending-status  (dashboard card data) ───────────────────
router.get('/pending-status', authenticateToken, async (req, res) => {
  try {
    const [[app]] = await db.query(
      `SELECT application_id, community, is_physically_challenged, payment_status, payment_decision,
              payment_due_date, payment_expired_at, payment_resume_count,
              status AS app_status
       FROM applications WHERE user_id = ? LIMIT 1`,
      [req.user.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    const CommunityFeeCalculationService = require('../services/CommunityFeeCalculationService');
    const amount = await CommunityFeeCalculationService.calculateFee(app.community, app.is_physically_challenged, db);

    const now     = Date.now();
    const dueDate = app.payment_due_date ? new Date(app.payment_due_date) : null;
    const isExpired = dueDate ? now > dueDate.getTime() : false;
    const msLeft    = dueDate ? Math.max(0, dueDate.getTime() - now) : null;
    const daysLeft  = msLeft !== null ? Math.floor(msLeft / 86400000) : null;
    const hoursLeft = msLeft !== null ? Math.floor((msLeft % 86400000) / 3600000) : null;

    // Auto-expire in DB when boundary is crossed
    if (isExpired && app.app_status === 'AWAITING_PAYMENT' && !app.payment_expired_at) {
      await db.query(
        `UPDATE applications SET status='PAYMENT_EXPIRED', payment_expired_at=NOW(), updated_at=NOW()
         WHERE user_id=?`,
        [req.user.id]
      );
    }

    const isPaid = ['Paid', 'Verified', 'Approved'].includes(app.payment_status);

    res.json({
      success: true,
      data: {
        application_id:       app.application_id,
        payment_status:       app.payment_status,
        app_status:           isExpired && app.app_status === 'AWAITING_PAYMENT' ? 'PAYMENT_EXPIRED' : app.app_status,
        payment_decision:     app.payment_decision,
        payment_due_date:     app.payment_due_date,
        payment_expired_at:   app.payment_expired_at,
        payment_resume_count: app.payment_resume_count || 0,
        amount,
        community:            app.community,
        is_expired:           isExpired,
        is_paid:              isPaid,
        awaiting_payment:     ['AWAITING_PAYMENT', 'PAYMENT_PENDING'].includes(app.app_status) && !isPaid,
        days_left:            daysLeft,
        hours_left:           hoursLeft,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/fee-details ─────────────────────────────────────────────
router.get('/fee-details', authenticateToken, async (req, res) => {
  try {
    const [[app]] = await db.query(
      'SELECT application_id, community, is_physically_challenged, payment_status FROM applications WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    const CommunityFeeCalculationService = require('../services/CommunityFeeCalculationService');
    const amount = await CommunityFeeCalculationService.calculateFee(app.community, app.is_physically_challenged, db);

    res.json({
      success        : true,
      amount,
      community      : app.community,
      is_physically_challenged: app.is_physically_challenged,
      category       : [1, '1', 'Yes', 'yes'].includes(app.is_physically_challenged) ? 'Differently Abled' : 'General',
      fee_type       : [1, '1', 'Yes', 'yes'].includes(app.is_physically_challenged) ? 'Differently Abled Fee' : 'General Fee',
      application_id : app.application_id,
      payment_status : app.payment_status,
      university_upi_vpa: process.env.UNIVERSITY_UPI_VPA || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/history ──────────────────────────────────────────────────
router.get('/history', authenticateToken, async (req, res) => {
  try {
    // Query by user_id — application_id may be null pre-payment
    const [rows] = await db.query(
      `SELECT pt.order_id, pt.amount, pt.currency, pt.payment_method, pt.payment_sub_method,
              pt.provider_name, pt.payment_status, pt.gateway_transaction_id,
              pt.initiated_at, pt.completed_at, pt.created_at,
              pr.receipt_number, pr.issued_at AS receipt_issued_at
       FROM payment_transactions pt
       LEFT JOIN payment_receipts pr ON pt.order_id = pr.order_id
       WHERE pt.user_id = ?
       ORDER BY pt.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/receipt/:orderId ─────────────────────────────────────────
router.get('/receipt/:orderId', authenticateToken, async (req, res) => {
  try {
    await receipt.streamReceiptPDF(req.params.orderId, req.user.id, res);
  } catch (err) {
    if (!res.headersSent) res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/receipt-data/:orderId ────────────────────────────────────
router.get('/receipt-data/:orderId', authenticateToken, async (req, res) => {
  try {
    const [[receipt]] = await db.query(
      `SELECT pr.*, pt.payment_method, pt.payment_sub_method, pt.provider_name, 
              pt.gateway_transaction_id, pt.payment_status, pt.completed_at, pt.callback_payload
       FROM payment_receipts pr
       JOIN payment_transactions pt ON pr.order_id = pt.order_id
       WHERE pr.order_id = ?`,
      [req.params.orderId]
    );

    let data;
    if (!receipt) {
      const [[txn]] = await db.query(
        `SELECT pt.*, a.applicant_name, a.email, a.mobile
         FROM payment_transactions pt
         JOIN applications a ON pt.application_id = a.application_id COLLATE utf8mb4_general_ci
         WHERE pt.order_id = ? LIMIT 1`,
        [req.params.orderId]
      );
      if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found' });
      if (txn.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

      let parsedPayload = {};
      try { parsedPayload = txn.callback_payload ? JSON.parse(txn.callback_payload) : {}; } catch { /* ignore */ }

      data = {
        receipt_number: txn.order_id.replace('PU', 'RC'),
        order_id: txn.order_id,
        application_id: txn.application_id,
        amount: txn.amount,
        payment_method: txn.payment_method,
        payment_sub_method: txn.payment_sub_method,
        provider_name: txn.provider_name,
        gateway_transaction_id: txn.gateway_transaction_id || parsedPayload.TXNID || txn.order_id,
        applicant_name: txn.applicant_name || '',
        applicant_email: txn.email || '',
        applicant_mobile: txn.mobile || '',
        issued_at: txn.completed_at || txn.updated_at || new Date(),
        payment_status: txn.payment_status,
        callback_payload: txn.callback_payload
      };
    } else {
      if (receipt.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });
      data = receipt;
    }

    if (data) {
      try {
        const QRCode = require('qrcode');
        const feBase = process.env.STUDENT_FRONTEND_URL || 'http://localhost:5173';
        const qrContent = data.qr_verification_code
          ? `${feBase}/verify-receipt?code=${encodeURIComponent(data.qr_verification_code)}`
          : `${feBase}/receipt/${encodeURIComponent(data.order_id || data.application_id || 'N/A')}`;
        data.qr_code_base64 = await QRCode.toDataURL(qrContent, { width: 120, margin: 1 });
      } catch (qrErr) {
        console.error('Failed to generate QR code:', qrErr);
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/receipt-data-by-app/:appId ───────────────────────────────
router.get('/receipt-data-by-app/:appId', authenticateToken, async (req, res) => {
  try {
    const [[receipt]] = await db.query(
      `SELECT pr.*, pt.payment_method, pt.payment_sub_method, pt.provider_name, 
              pt.gateway_transaction_id, pt.payment_status, pt.completed_at, pt.callback_payload
       FROM payment_receipts pr
       JOIN payment_transactions pt ON pr.order_id = pt.order_id
       WHERE pr.application_id = ?
       ORDER BY pr.created_at DESC LIMIT 1`,
      [req.params.appId]
    );

    let data;
    if (!receipt) {
      const [[app]] = await db.query(
        `SELECT * FROM applications WHERE application_id = ? LIMIT 1`,
        [req.params.appId]
      );
      if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
      if (app.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

      const [[txn]] = await db.query(
        `SELECT * FROM payment_transactions 
         WHERE application_id = ? AND (payment_status = 'SUCCESS' OR payment_status = 'AWAITING_CONFIRMATION')
         ORDER BY created_at DESC LIMIT 1`,
        [req.params.appId]
      );

      let parsedPayload = {};
      if (txn) {
        try { parsedPayload = txn.callback_payload ? JSON.parse(txn.callback_payload) : {}; } catch { /* ignore */ }
      }

      data = {
        receipt_number: app.receipt_number || (txn ? txn.order_id.replace('PU', 'RC') : 'RC' + app.application_id.replace(/[^0-9]/g, '')),
        order_id: txn ? txn.order_id : app.payment_transaction_id || 'N/A',
        application_id: app.application_id,
        amount: txn ? txn.amount : (app.amount_paid || '500.00'),
        payment_method: txn ? txn.payment_method : 'Online',
        payment_sub_method: txn ? txn.payment_sub_method : null,
        provider_name: txn ? txn.provider_name : 'Paytm',
        gateway_transaction_id: txn ? (txn.gateway_transaction_id || parsedPayload.TXNID) : app.payment_transaction_id || 'N/A',
        applicant_name: `${app.applicant_name || ''} ${app.applicant_initial || ''}`.trim(),
        applicant_email: app.email || '',
        applicant_mobile: app.mobile || '',
        issued_at: app.payment_completed_at || app.submitted_at || new Date(),
        payment_status: txn ? txn.payment_status : 'SUCCESS',
        callback_payload: txn ? txn.callback_payload : null
      };
    } else {
      if (receipt.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });
      data = receipt;
    }

    if (data) {
      try {
        const QRCode = require('qrcode');
        const feBase = process.env.STUDENT_FRONTEND_URL || 'http://localhost:5173';
        const qrContent = data.qr_verification_code
          ? `${feBase}/verify-receipt?code=${encodeURIComponent(data.qr_verification_code)}`
          : `${feBase}/receipt/${encodeURIComponent(data.order_id || data.application_id || 'N/A')}`;
        data.qr_code_base64 = await QRCode.toDataURL(qrContent, { width: 120, margin: 1 });
      } catch (qrErr) {
        console.error('Failed to generate QR code:', qrErr);
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ── GET /api/payment/verify-receipt  (public QR code receipt verification) ───
router.get('/verify-receipt', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ success: false, message: 'code is required' });
  try {
    const [[receipt]] = await db.query(
      `SELECT pr.*, pt.payment_method, pt.payment_sub_method, pt.provider_name, 
              pt.gateway_transaction_id, pt.payment_status, pt.completed_at, pt.callback_payload
       FROM payment_receipts pr
       LEFT JOIN payment_transactions pt ON pr.order_id = pt.order_id
       WHERE pr.qr_verification_code = ? LIMIT 1`,
      [code]
    );
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });

    // Generate base64 QR code
    try {
      const QRCode = require('qrcode');
      const verifyUrl = `${process.env.STUDENT_FRONTEND_URL || 'http://localhost:5173'}/verify-receipt?code=${encodeURIComponent(receipt.qr_verification_code)}`;
      receipt.qr_code_base64 = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 });
    } catch (qrErr) {
      console.error('Failed to generate verification QR code:', qrErr);
    }

    res.json({ success: true, data: receipt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payment/utr-submit  (manual UPI fallback) ──────────────────────
router.post('/utr-submit', authenticateToken, async (req, res) => {
  const { order_id, utr_number } = req.body;
  if (!order_id || !utr_number) {
    return res.status(400).json({ success: false, message: 'order_id and utr_number are required' });
  }
  const cleanUtr = utr_number.replace(/[^A-Za-z0-9]/g, '').substring(0, 22);
  if (cleanUtr.length < 12) {
    return res.status(400).json({ success: false, message: 'Invalid UTR. Must be 12-22 alphanumeric characters.' });
  }

  try {
    const [[txn]] = await db.query(
      'SELECT * FROM payment_transactions WHERE order_id = ? AND user_id = ?', [order_id, req.user.id]
    );
    if (!txn) return res.status(404).json({ success: false, message: 'Order not found' });
    if (txn.payment_status === 'SUCCESS') return res.json({ success: true, message: 'Payment already verified' });
    if (!['upi_qr','upi_intent','upi_id'].includes(txn.payment_method)) {
      return res.status(400).json({ success: false, message: 'UTR submission is only for UPI payments' });
    }

    await db.query(
      `UPDATE payment_transactions
       SET payment_status='AWAITING_CONFIRMATION', gateway_transaction_id=?,
           callback_payload=JSON_SET(COALESCE(callback_payload,'{}'), '$.utrNumber', ?, '$.submittedAt', ?),
           updated_at=NOW()
       WHERE order_id=?`,
      [cleanUtr, cleanUtr, new Date().toISOString(), order_id]
    );
    await db.query(
      `UPDATE applications SET payment_status='AwaitingConfirmation', updated_at=NOW()
       WHERE user_id=?`,
      [txn.user_id]
    );

    res.json({ success: true, message: 'UTR submitted. Admin will verify within 24 hours.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payment/webhook/paytm  (Paytm server-to-server webhook) ─────────
router.post('/webhook/paytm', async (req, res) => {
  res.status(200).json({ received: true }); // ACK immediately
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body) || '';
    await webhook.processWebhook(rawBody, req.headers);
  } catch (err) {
    console.error('[webhook/paytm]', err.message);
  }
});

// ── Internal: process verification + lock application ────────────────────────
async function _processVerification(orderId, paytmData) {
  const [[txn]] = await db.query(
    'SELECT * FROM payment_transactions WHERE order_id = ? LIMIT 1', [orderId]
  );
  if (!txn || txn.payment_status === 'SUCCESS') return;

  const txnStatus = paytmData.STATUS || paytmData.status || '';
  const gatewayTxnId = paytmData.TXNID || paytmData.txnId || paytmData.txn_id || '';
  const isPaid = txnStatus === 'TXN_SUCCESS' || txnStatus === 'SUCCESS';

  if (!isPaid) return;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE payment_transactions
       SET payment_status='SUCCESS', gateway_transaction_id=?,
           completed_at=NOW(), verified_at=NOW(), updated_at=NOW()
       WHERE order_id=?`,
      [gatewayTxnId, orderId]
    );
    await webhook.lockApplicationAndGenerateReceipt(conn, txn, gatewayTxnId);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = router;
