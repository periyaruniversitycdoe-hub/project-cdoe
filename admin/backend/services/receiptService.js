'use strict';
const PDFDocument = require('pdfkit');
const QRCode      = require('qrcode');
const db          = require('../config/db');

/**
 * Generates an official PDF payment receipt for admin and streams it to the response.
 */
async function streamReceiptPDF(orderId, res) {
  let [[receipt]] = await db.query(
    `SELECT pr.*, pt.payment_method, pt.provider_name, pt.gateway_transaction_id
     FROM payment_receipts pr
     JOIN payment_transactions pt ON pr.order_id = pt.order_id
     WHERE pr.order_id = ?`,
    [orderId]
  );

  if (!receipt) {
    // Check if the payment transaction is SUCCESSful
    const [[txn]] = await db.query(
      `SELECT * FROM payment_transactions WHERE order_id = ? LIMIT 1`,
      [orderId]
    );
    if (!txn || txn.payment_status !== 'SUCCESS') {
      throw Object.assign(new Error('Receipt not found'), { statusCode: 404 });
    }

    // Get applicant details
    const [[appRow]] = await db.query(
      `SELECT a.applicant_name, a.applicant_initial, a.email, a.mobile, a.application_id, a.receipt_number
       FROM applications a
       WHERE a.user_id = ? LIMIT 1`,
      [txn.user_id]
    );

    const crypto = require('crypto');
    const safeAppId = (txn.application_id || (appRow && appRow.application_id) || `PU-${txn.user_id}`).replace(/[^A-Z0-9]/gi, '').substring(0, 8).toUpperCase();
    const receiptNumber = (appRow && appRow.receipt_number) || `RCPT-${new Date().getFullYear()}-${safeAppId}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();
    const displayName = appRow
      ? `${appRow.applicant_name || ''} ${appRow.applicant_initial || ''}`.trim()
      : 'N/A';

    // Insert into payment_receipts
    await db.query(
      `INSERT INTO payment_receipts
         (receipt_number, order_id, application_id, user_id, amount, currency,
          payment_method, provider_name, gateway_transaction_id,
          applicant_name, applicant_email, applicant_mobile, qr_verification_code, issued_at)
       VALUES (?,?,?,?,?,'INR',?,?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE receipt_number=VALUES(receipt_number)`,
      [
        receiptNumber, txn.order_id, txn.application_id || (appRow && appRow.application_id), txn.user_id, txn.amount,
        txn.payment_method || 'card', txn.provider_name || 'Manual', txn.gateway_transaction_id || 'Manual Confirmation',
        displayName, (appRow && appRow.email) || '', (appRow && appRow.mobile) || '', verificationCode
      ]
    );

    // Also update the application with receipt number if it doesn't have one
    if (appRow && !appRow.receipt_number) {
      await db.query(
        `UPDATE applications SET receipt_number = ? WHERE user_id = ?`,
        [receiptNumber, txn.user_id]
      );
    }

    // Re-fetch receipt
    const [[newReceipt]] = await db.query(
      `SELECT pr.*, pt.payment_method, pt.provider_name, pt.gateway_transaction_id
       FROM payment_receipts pr
       JOIN payment_transactions pt ON pr.order_id = pt.order_id
       WHERE pr.order_id = ?`,
      [orderId]
    );
    receipt = newReceipt;
  }

  if (!receipt) throw Object.assign(new Error('Receipt not found'), { statusCode: 404 });

  const [[settings]] = await db.query('SELECT * FROM university_settings LIMIT 1').catch(() => [[{}]]);
  const uni = settings || {};

  // For verification URL, point to the student portal verify page
  const verifyUrl = `${process.env.STUDENT_FRONTEND_URL || 'http://localhost:5173'}/verify-receipt?code=${receipt.qr_verification_code}`;
  const qrBuffer  = await QRCode.toBuffer(verifyUrl, { width: 100, margin: 1, color: { dark: '#1a3a5c' } });

  const doc = new PDFDocument({ size: 'A4', margin: 45 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Payment_Receipt_${receipt.receipt_number}.pdf`);
  doc.pipe(res);

  const PRIMARY  = '#1a3a5c';
  const GOLD     = '#c8a951';
  const GREEN    = '#15803d';
  const LIGHT    = '#f0f4f8';
  const W        = 505;

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.rect(45, 40, W, 80).fill(PRIMARY);
  doc.image(qrBuffer, 490, 45, { width: 70 }); // QR top-right inside header

  doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
     .text(uni.university_name_en || 'PERIYAR UNIVERSITY', 55, 52, { width: 420 });
  doc.fontSize(8).font('Helvetica').fillColor('#c8d8e8')
     .text('Reaccredited with "A++" Grade by NAAC | Salem - 636 011, Tamil Nadu, India', 55, 73);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(GOLD)
     .text('OFFICIAL PAYMENT RECEIPT', 55, 92, { width: 420 });

  // ── RECEIPT META BAR ────────────────────────────────────────────────────────
  doc.rect(45, 125, W, 28).fill(LIGHT);
  doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(9)
     .text(`Receipt No: ${receipt.receipt_number}`, 55, 133)
     .text(`Date: ${new Date(receipt.issued_at || receipt.created_at).toLocaleDateString('en-IN', { day:'2-digit',month:'long',year:'numeric' })}`, 300, 133, { width: 240, align: 'right' });

  // ── SECTION HELPER ──────────────────────────────────────────────────────────
  let y = 165;
  function sectionHeader(title) {
    doc.rect(45, y, W, 20).fill('#e8f0f8');
    doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), 55, y + 6);
    y += 26;
  }
  function row(label, value, bold = false) {
    doc.fillColor('#666666').font('Helvetica').fontSize(9).text(label, 55, y, { width: 200 });
    doc.fillColor('#111111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
       .text(String(value || '-'), 260, y, { width: 285 });
    y += 18;
  }
  function divider() {
    doc.moveTo(45, y).lineTo(550, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    y += 10;
  }

  // ── APPLICANT INFO ──────────────────────────────────────────────────────────
  sectionHeader('Applicant Details');
  row('Applicant Name',   receipt.applicant_name, true);
  row('Application ID',   receipt.application_id);
  row('Email Address',    receipt.applicant_email);
  row('Mobile Number',    receipt.applicant_mobile);
  divider();

  // ── PAYMENT DETAILS ─────────────────────────────────────────────────────────
  sectionHeader('Payment Details');
  row('Amount Paid',          `₹ ${parseFloat(receipt.amount).toFixed(2)}`, true);
  row('Currency',             receipt.currency || 'INR');
  row('Payment Method',       formatMethod(receipt.payment_method));
  row('Payment Provider',     (receipt.provider_name || 'Enterprise Gateway').toUpperCase());
  row('Gateway Transaction',  receipt.gateway_transaction_id || receipt.qr_verification_code);
  row('Order Reference',      receipt.order_id);
  row('Payment Status',       'SUCCESSFUL');
  row('Transaction Date',     new Date(receipt.issued_at || receipt.created_at).toLocaleString('en-IN'));
  divider();

  // ── UNIVERSITY DETAILS ──────────────────────────────────────────────────────
  sectionHeader('University Payment Reference');
  row('University',       uni.university_name_en || 'Periyar University');
  row('Purpose',          'Ph.D. Admission Processing Fee (Non-Refundable)');
  row('Academic Year',    uni.academic_year || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1));
  row('Verification QR',  'Scan QR code to verify authenticity of this receipt');

  y += 15;

  // ── QR + WATERMARK ──────────────────────────────────────────────────────────
  doc.image(qrBuffer, 45, y, { width: 80 });
  doc.fillColor('#888888').font('Helvetica').fontSize(7)
     .text('Scan to verify online', 45, y + 83, { width: 80, align: 'center' });
  doc.fillColor('#aaaaaa').fontSize(7)
     .text(`Verification code: ${receipt.qr_verification_code}`, 140, y + 10);

  // ── FOOTER ──────────────────────────────────────────────────────────────────
  doc.rect(45, 760, W, 30).fill(PRIMARY);
  doc.fillColor('#c8d8e8').fontSize(7).font('Helvetica')
     .text('This is a computer-generated receipt. No signature required. For queries: admissions@periyaruniversity.ac.in', 55, 770, { width: W - 20, align: 'center' });

  doc.end();
}

function formatMethod(m) {
  const map = {
    card: 'Credit / Debit Card', upi_qr: 'UPI – QR Code', upi_intent: 'UPI – App Intent',
    upi_id: 'UPI – ID / VPA', netbanking: 'Net Banking', wallet: 'Digital Wallet'
  };
  return map[m] || m || 'Online';
}

module.exports = { streamReceiptPDF };
