'use strict';
const crypto         = require('crypto');
const db             = require('../../config/db');
const paymentService = require('./paymentService');
const { generateCETPHDApplicationId } = require('../applicationIdEngine');

// ── ApplicationIdGenerationEngine: called inside an open transaction ──────────
// Generates CETPHD/{SESSION_CODE}/{SERIAL} for the user, propagates it to all
// related tables, then locks the application and issues the payment receipt.
// Idempotent: if application_id is already set for this user, skips generation.
async function lockApplicationAndGenerateReceipt(conn, txn, gatewayTxnId) {
  const userId = txn.user_id;

  // 1. Lock the application row for this user so concurrent webhooks/callbacks
  //    queue here and re-check application_id after the first one commits.
  const [[appRow]] = await conn.query(
    `SELECT a.application_id, u.session_id,
            a.applicant_name, a.email, a.mobile
     FROM applications a
     JOIN users u ON a.user_id = u.id
     WHERE a.user_id = ? LIMIT 1 FOR UPDATE`,
    [userId]
  );
  if (!appRow) {
    throw new Error(`lockApplication: no application found for user_id=${userId}`);
  }

  // 2. Generate Application ID (only if not yet generated — idempotency guard)
  let applicationId = appRow.application_id;
  if (!applicationId) {
    if (!appRow.session_id) {
      throw new Error('lockApplication: user has no session_id — cannot generate Application ID');
    }

    // generateCETPHDApplicationId opens its own connection+transaction internally
    // (SELECT … FOR UPDATE on application_id_serials) — fully concurrency-safe.
    applicationId = await generateCETPHDApplicationId(db, appRow.session_id);

    // 3. Propagate Application ID to all related tables
    await conn.query(
      'UPDATE users SET application_id = ? WHERE id = ?',
      [applicationId, userId]
    );
    await conn.query(
      `UPDATE applications
         SET application_id = ?, application_submitted = 1, application_id_generated_at = NOW()
       WHERE user_id = ?`,
      [applicationId, userId]
    );
    await conn.query(
      'UPDATE school_education       SET application_id = ? WHERE user_id = ?',
      [applicationId, userId]
    );
    await conn.query(
      'UPDATE higher_education       SET application_id = ? WHERE user_id = ?',
      [applicationId, userId]
    );
    await conn.query(
      'UPDATE experience_details     SET application_id = ? WHERE user_id = ?',
      [applicationId, userId]
    );
    await conn.query(
      'UPDATE application_documents  SET application_id = ? WHERE user_id = ?',
      [applicationId, userId]
    );
    await conn.query(
      'UPDATE student_qualifications SET application_id = ? WHERE user_id = ?',
      [applicationId, userId]
    );

    // 4. Back-fill the payment_transactions row that was initiated with NULL application_id
    await conn.query(
      'UPDATE payment_transactions SET application_id = ? WHERE order_id = ?',
      [applicationId, txn.order_id]
    );
  }

  // 5. Lock application and record payment success
  await conn.query(
    `UPDATE applications
       SET status = 'SUBMITTED', payment_status = 'Paid', is_locked = 1,
           final_submitted = 1, submitted_at = COALESCE(submitted_at, NOW()), updated_at = NOW()
     WHERE user_id = ?`,
    [userId]
  );

  // 6. Insert into legacy payments table
  await conn.query(
    `INSERT INTO payments
       (application_id, user_id, amount, transaction_id, payment_method,
        payment_date, payment_status, enterprise_order_id, provider_name)
     VALUES (?,?,?,?,?,NOW(),'Paid',?,?)
     ON DUPLICATE KEY UPDATE
       transaction_id = VALUES(transaction_id), payment_status = 'Paid', updated_at = NOW()`,
    [applicationId, userId, txn.amount, gatewayTxnId,
     txn.payment_method, txn.order_id, 'paytm']
  );

  // 7. Generate and insert official payment receipt
  const receiptNumber = paymentService.generateReceiptNumber(applicationId);
  const verifyCode    = crypto.randomBytes(12).toString('hex').toUpperCase();

  await conn.query(
    `INSERT INTO payment_receipts
       (receipt_number, order_id, application_id, user_id, amount, currency,
        payment_method, provider_name, gateway_transaction_id,
        applicant_name, applicant_email, applicant_mobile,
        qr_verification_code, issued_at)
     VALUES (?,?,?,?,?,'INR',?,?,?,?,?,?,?,NOW())
     ON DUPLICATE KEY UPDATE gateway_transaction_id = VALUES(gateway_transaction_id)`,
    [receiptNumber, txn.order_id, applicationId, userId, txn.amount,
     txn.payment_method, 'paytm', gatewayTxnId,
     appRow.applicant_name || '', appRow.email || '', appRow.mobile || '',
     verifyCode]
  );

  return { receiptNumber, verifyCode, applicationId };
}

// ── Process Paytm webhook ─────────────────────────────────────────────────────
async function processWebhook(rawBody, headers) {
  let body;
  try { body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody; }
  catch { console.error('[webhook] Invalid JSON body'); return; }

  // CHECKSUMHASH is in the body for Paytm callbacks; fallback to headers for newer webhook APIs
  const paytmChecksum = body.CHECKSUMHASH || headers['x-paytm-signature'] || headers['paytm-checksum'] || '';
  const idemKey = 'paytm:' + crypto.createHash('sha256').update(rawBody || JSON.stringify(body)).digest('hex');

  // Idempotency check
  const [[existing]] = await db.query(
    'SELECT id FROM payment_webhooks WHERE idempotency_key = ? LIMIT 1', [idemKey]
  );
  if (existing) return;

  // Verify checksum — strip CHECKSUMHASH from body before verification
  const bodyForVerify = { ...body };
  delete bodyForVerify.CHECKSUMHASH;
  const sigValid = paytmChecksum
    ? await paymentService.verifyWebhookSignature(bodyForVerify, paytmChecksum).catch(() => false)
    : false;

  // Extract order ID and status from Paytm webhook payload
  const orderId = body.ORDERID || body.orderId || body.order_id || null;
  const txnStatus = body.STATUS || body.status || '';

  await db.query(
    `INSERT IGNORE INTO payment_webhooks
       (order_id, provider_name, webhook_type, payload, signature_header,
        is_verified, is_processed, idempotency_key)
     VALUES (?,?,?,?,?,?,0,?)`,
    [orderId, 'paytm', txnStatus, JSON.stringify(body),
     paytmChecksum, sigValid ? 1 : 0, idemKey]
  );

  if (!orderId) return;

  const [[txn]] = await db.query(
    'SELECT * FROM payment_transactions WHERE order_id = ? LIMIT 1', [orderId]
  );
  if (!txn) return;

  const isPaid = txnStatus === 'TXN_SUCCESS' || txnStatus === 'SUCCESS';

  if (isPaid && txn.payment_status !== 'SUCCESS') {
    const gatewayTxnId = body.TXNID || body.txnId || body.txn_id || '';
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE payment_transactions
         SET payment_status='SUCCESS', webhook_received=1, webhook_verified=?,
             gateway_transaction_id=?, completed_at=NOW(), updated_at=NOW()
         WHERE order_id=?`,
        [sigValid ? 1 : 0, gatewayTxnId, orderId]
      );
      await lockApplicationAndGenerateReceipt(conn, txn, gatewayTxnId);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error('[webhook] Lock failed:', err.message);
    } finally {
      conn.release();
    }
  } else if (['TXN_FAILURE', 'FAILED'].includes(txnStatus) && txn.payment_status === 'PROCESSING') {
    await db.query(
      `UPDATE payment_transactions SET payment_status='FAILED', webhook_received=1,
           failure_reason=?, updated_at=NOW() WHERE order_id=?`,
      [body.RESPMSG || 'Payment failed', orderId]
    );
  }

  await db.query(
    'UPDATE payment_webhooks SET is_processed=1, processed_at=NOW() WHERE idempotency_key=?',
    [idemKey]
  );
}

module.exports = { processWebhook, lockApplicationAndGenerateReceipt };
