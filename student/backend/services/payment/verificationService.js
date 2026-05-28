'use strict';
const db             = require('../../config/db');
const paymentService = require('./paymentService');

// Verify an order against Paytm and update DB status
async function verifyOrder(orderId) {
  const [[txn]] = await db.query(
    'SELECT * FROM payment_transactions WHERE order_id = ? LIMIT 1', [orderId]
  );
  if (!txn) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

  if (txn.payment_status === 'SUCCESS') return { status: 'SUCCESS', txn };

  const result = await paymentService.verifyTransaction(orderId);

  if (result.status === 'SUCCESS') {
    await db.query(
      `UPDATE payment_transactions
       SET payment_status='SUCCESS', gateway_transaction_id=?, gateway_payment_id=?,
           completed_at=NOW(), verified_at=NOW(), updated_at=NOW()
       WHERE order_id=?`,
      [result.txnId || txn.gateway_transaction_id, result.bankTxnId, orderId]
    );
  } else if (result.status === 'FAILED') {
    await db.query(
      `UPDATE payment_transactions SET payment_status='FAILED', failure_reason=?, updated_at=NOW()
       WHERE order_id=?`,
      [result.resultMsg || 'Payment failed', orderId]
    );
  }

  return { status: result.status, txnId: result.txnId, txn };
}

// Check if this user already has a successful payment (pre-payment: no application_id yet)
async function isDuplicatePayment(userId) {
  const [[row]] = await db.query(
    `SELECT id FROM payment_transactions
     WHERE user_id = ? AND payment_status = 'SUCCESS' LIMIT 1`,
    [userId]
  );
  return !!row;
}

// Validate claimed amount against community fee master
async function validateAmount(applicationId, claimedAmount) {
  const [[app]] = await db.query(
    'SELECT community, is_physically_challenged FROM applications WHERE application_id = ? LIMIT 1', [applicationId]
  );
  if (!app) throw Object.assign(new Error('Application not found'), { statusCode: 404 });

  const CommunityFeeCalculationService = require('../CommunityFeeCalculationService');
  const expected = await CommunityFeeCalculationService.calculateFee(app.community, app.is_physically_challenged, db);

  if (Math.abs(parseFloat(claimedAmount) - expected) > 0.01) {
    throw Object.assign(
      new Error(`Amount mismatch: expected ₹${expected}, got ₹${claimedAmount}`),
      { statusCode: 400 }
    );
  }
  return expected;
}

module.exports = { verifyOrder, isDuplicatePayment, validateAmount };
