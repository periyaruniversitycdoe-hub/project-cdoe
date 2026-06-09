'use strict';
const PDFDocument = require('pdfkit');
const QRCode      = require('qrcode');
const fs          = require('fs');
const path        = require('path');
const db          = require('../config/db');

/**
 * Generates an official PDF payment receipt and streams it to the response.
 * Layout matches the reference e-receipt exactly:
 *   - Left  : university logo (dynamic from settings)
 *   - Center: university name + NAAC details
 *   - Right : founder/chancellor portrait in gold border (dynamic from settings)
 *   - Box   : e-Receipt for Payment + payment table (NO QR code inside box)
 */
async function streamReceiptPDF(orderId, res) {
  let [[receipt]] = await db.query(
    `SELECT pr.*, pt.payment_method, pt.provider_name, pt.gateway_transaction_id, pt.callback_payload
     FROM payment_receipts pr
     JOIN payment_transactions pt ON pr.order_id = pt.order_id
     WHERE pr.order_id = ?`,
    [orderId]
  );

  if (!receipt) {
    const [[txn]] = await db.query(
      `SELECT * FROM payment_transactions WHERE order_id = ? LIMIT 1`,
      [orderId]
    );
    if (!txn || txn.payment_status !== 'SUCCESS') {
      throw Object.assign(new Error('Receipt not found'), { statusCode: 404 });
    }

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

    if (appRow && !appRow.receipt_number) {
      await db.query(
        `UPDATE applications SET receipt_number = ? WHERE user_id = ?`,
        [receiptNumber, txn.user_id]
      );
    }

    const [[newReceipt]] = await db.query(
      `SELECT pr.*, pt.payment_method, pt.provider_name, pt.gateway_transaction_id, pt.callback_payload
       FROM payment_receipts pr
       JOIN payment_transactions pt ON pr.order_id = pt.order_id
       WHERE pr.order_id = ?`,
      [orderId]
    );
    receipt = newReceipt;
  }

  if (!receipt) throw Object.assign(new Error('Receipt not found'), { statusCode: 404 });

  // ── Resolve logo and portrait from university_settings (with static fallbacks) ──
  const STATIC_LOGO     = path.join(__dirname, '../../../student/frontend/public/images/pu_logo.png');
  const STATIC_PORTRAIT = path.join(__dirname, '../../../student/frontend/public/images/periyar.png');
  const UPLOADS_ROOT    = path.join(__dirname, '../../../uploads');

  let logoPath     = fs.existsSync(STATIC_LOGO)     ? STATIC_LOGO     : null;
  let portraitPath = fs.existsSync(STATIC_PORTRAIT) ? STATIC_PORTRAIT : null;

  try {
    const [[settings]] = await db.query(
      'SELECT logo_url, founder_image_url FROM university_settings LIMIT 1'
    );
    if (settings) {
      if (settings.logo_url) {
        // logo_url is stored as e.g. "/uploads/settings/1234-logo.png"
        const p = settings.logo_url.startsWith('/uploads/')
          ? path.join(UPLOADS_ROOT, settings.logo_url.replace(/^\/uploads/, ''))
          : STATIC_LOGO;
        if (fs.existsSync(p)) logoPath = p;
      }
      if (settings.founder_image_url) {
        const p = settings.founder_image_url.startsWith('/uploads/')
          ? path.join(UPLOADS_ROOT, settings.founder_image_url.replace(/^\/uploads/, ''))
          : STATIC_PORTRAIT;
        if (fs.existsSync(p)) portraitPath = p;
      }
    }
  } catch (_) { /* keep static fallbacks */ }

  // ── Parse callback payload ──
  let payload = {};
  if (receipt.callback_payload) {
    try {
      payload = typeof receipt.callback_payload === 'string'
        ? JSON.parse(receipt.callback_payload)
        : receipt.callback_payload;
    } catch (_) {}
  }

  // ── Compute display fields ──
  const transactionId     = receipt.gateway_transaction_id || payload.TXNID || receipt.order_id || 'N/A';
  const bankTransactionId = payload.BANKTXNID || receipt.gateway_transaction_id || receipt.order_id || 'N/A';
  const orderIdVal        = receipt.order_id || 'N/A';
  const txnAmount         = receipt.amount ? parseFloat(receipt.amount).toFixed(2) : '0.00';
  const txnStatus         = receipt.payment_status === 'SUCCESS' ? 'TXN_SUCCESS' : (receipt.payment_status || 'TXN_SUCCESS');
  const gatewayName       = payload.GATEWAYNAME || 'SBI';
  const responseCode      = payload.RESPCODE    || '01';
  const responseMessage   = payload.RESPMSG     || 'Txn Success';
  const bankName          = payload.BANKNAME    || 'State Bank of India';
  const merchantId        = payload.MID         || 'Periya40654046259334';
  const paymentMode       = payload.PAYMENTMODE || (receipt.payment_method === 'netbanking' ? 'NB' : receipt.payment_method === 'card' ? 'CC' : (receipt.payment_method || 'NB'));

  const formattedDate = receipt.issued_at
    ? new Date(receipt.issued_at).toLocaleString('en-IN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).replace(/\//g, '-').replace(',', '')
    : 'N/A';

  const tableRows = [
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
    ['Transaction Date',    formattedDate],
  ];

  // Generate QR buffer
  const verifyUrl = `${process.env.STUDENT_FRONTEND_URL || 'http://localhost:5173'}/verify-receipt?code=${receipt.qr_verification_code}`;
  const qrBuffer  = await QRCode.toBuffer(verifyUrl, { width: 100, margin: 1, color: { dark: '#000000' } });

  // ── Build PDF ──
  // A4: 595.28 × 841.89 pt, margin 40 → usable width = 515.28
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Payment_Receipt_${receipt.receipt_number}.pdf`);
  doc.pipe(res);

  // ── HEADER ──
  // Left logo
  if (logoPath) {
    doc.image(logoPath, 40, 40, { width: 80 });
  }

  // Center university info
  doc.fillColor('#000000').fontSize(22).font('Helvetica-Bold')
     .text('PERIYAR UNIVERSITY', 130, 42, { align: 'center', width: 295 });
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000000')
     .text("STATE UNIVERSITY - NAAC 'A++' GRADE - NIRF\nRANK 94 STATE PUBLIC UNIVERSITY RANK 40 -\nSDG INSTITUTIONS RANK BAND: 11-50", 130, 68, { align: 'center', width: 295, lineGap: 2 });
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
     .text('SALEM - 636 011, TAMIL NADU, INDIA', 130, 106, { align: 'center', width: 295 });

  // Right portrait — gold border box, dynamic image from settings
  if (portraitPath) {
    doc.rect(470, 40, 85, 98).lineWidth(2.5).stroke('#dfb020');
    doc.image(portraitPath, 472, 42, { width: 81, height: 94 });
  }

  // Divider line under header
  doc.moveTo(40, 150).lineTo(555.28, 150).lineWidth(0.8).stroke('#cccccc');

  // ── RECEIPT BOX ──
  doc.rect(40, 155, 515.28, 380).lineWidth(1).stroke('#7eb4f7');

  // Section title: e-Receipt for Payment
  doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
     .text('e-Receipt for Payment', 55, 170);

  // Payment receipt details line
  doc.fontSize(11).font('Helvetica-Bold')
     .text('Payment Receipt Details: ', 55, 195, { underline: true, continued: true })
     .text(`${receipt.applicant_name || ''} [ ${receipt.application_id || orderIdVal} ]`, { underline: false });

  // QR Code top-right inside box
  doc.image(qrBuffer, 465, 165, { width: 75 });
  doc.fillColor('#555555').fontSize(7).font('Helvetica-Bold').text('SCAN TO VERIFY', 465, 242, { align: 'center', width: 75 });

  // ── TABLE ──
  let rowY = 230;
  for (const [label, val] of tableRows) {
    // Cell backgrounds (White left and right columns)
    doc.rect(55, rowY, 170, 20).fillAndStroke('#ffffff', '#cccccc');
    doc.rect(225, rowY, 315.28, 20).fillAndStroke('#ffffff', '#cccccc');

    // Label Text
    doc.fillColor('#000000').fontSize(9.5).font('Helvetica-Bold')
       .text(label, 65, rowY + 5, { width: 150 });

    // Value Text
    doc.fillColor('#333333').fontSize(9.5).font('Helvetica')
       .text(String(val || 'N/A'), 235, rowY + 5, { width: 295 });

    rowY += 20;
  }

  doc.end();
}

module.exports = { streamReceiptPDF };
