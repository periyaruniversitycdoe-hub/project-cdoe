'use strict';
const PDFDocument = require('pdfkit');
const QRCode      = require('qrcode');
const fs          = require('fs');
const path        = require('path');
const db          = require('../../config/db');

/**
 * Generates an official PDF payment receipt matching the replica template and streams it to the response.
 */
async function streamReceiptPDF(orderId, userId, res) {
  const [[receipt]] = await db.query(
    `SELECT pr.*, pt.payment_method, pt.provider_name, pt.gateway_transaction_id, pt.callback_payload
     FROM payment_receipts pr
     JOIN payment_transactions pt ON pr.order_id = pt.order_id
     WHERE pr.order_id = ?`,
    [orderId]
  );
  if (!receipt) throw Object.assign(new Error('Receipt not found'), { statusCode: 404 });
  if (receipt.user_id !== userId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });

  // Parse callback payload
  let payload = {};
  if (receipt.callback_payload) {
    try {
      payload = typeof receipt.callback_payload === 'string' ? JSON.parse(receipt.callback_payload) : receipt.callback_payload;
    } catch (e) { /* ignore */ }
  }

  // Compute fields exactly as in frontend e-receipt
  const transactionId = receipt.gateway_transaction_id || payload.TXNID || receipt.order_id || 'N/A';
  const bankTransactionId = payload.BANKTXNID || receipt.gateway_transaction_id || 'PC' + Math.floor(1000000000000000 + Math.random() * 9000000000000000);
  const orderIdVal = receipt.order_id || 'N/A';
  const txnAmount = receipt.amount ? parseFloat(receipt.amount).toFixed(2) : '0.00';
  const txnStatus = receipt.payment_status === 'SUCCESS' ? 'TXN_SUCCESS' : receipt.payment_status || 'TXN_SUCCESS';
  const txnType = 'SALE';
  const gatewayName = payload.GATEWAYNAME || 'SBI';
  const responseCode = payload.RESPCODE || '01';
  const responseMessage = payload.RESPMSG || 'Txn Success';
  const bankName = payload.BANKNAME || 'State Bank of India';
  const merchantId = payload.MID || 'Periya40654046259334';
  const paymentMode = payload.PAYMENTMODE || (receipt.payment_method === 'netbanking' ? 'NB' : receipt.payment_method === 'card' ? 'CC' : 'UPI');
  const refundAmount = '0.0';

  const formattedDate = receipt.issued_at
    ? new Date(receipt.issued_at).toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-').replace(',', '')
    : 'N/A';
  const transactionDate = formattedDate;

  // Define paths to public asset images
  const logoPath = path.join(__dirname, '../../../frontend/public/images/pu_logo.png');
  const portraitPath = path.join(__dirname, '../../../frontend/public/images/periyar.png');

  // Generate QR buffer
  const verifyUrl = `${process.env.STUDENT_FRONTEND_URL || 'http://localhost:5173'}/verify-receipt?code=${receipt.qr_verification_code}`;
  const qrBuffer  = await QRCode.toBuffer(verifyUrl, { width: 100, margin: 1, color: { dark: '#000000' } });

  // A4 Page margins: 40 points (Width = 595.28 - 80 = 515.28)
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Payment_Receipt_${receipt.receipt_number}.pdf`);
  doc.pipe(res);

  // ── HEADER ──
  // Left: logo
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 40, { width: 80 });
  }

  // Center: University Info Text
  doc.fillColor('#000000').fontSize(22).font('Helvetica-Bold')
     .text('PERIYAR UNIVERSITY', 130, 42, { align: 'center', width: 295 });
     
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000000')
     .text("STATE UNIVERSITY - NAAC 'A++' GRADE - NIRF\nRANK 94 STATE PUBLIC UNIVERSITY RANK 40 -\nSDG INSTITUTIONS RANK BAND: 11-50", 130, 68, { align: 'center', width: 295, lineGap: 2 });
     
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
     .text('SALEM - 636 011, TAMIL NADU, INDIA', 130, 106, { align: 'center', width: 295 });

  // Right: Portrait in gold box
  if (fs.existsSync(portraitPath)) {
    doc.rect(470, 40, 85, 98).lineWidth(2.5).stroke('#dfb020');
    doc.image(portraitPath, 472, 42, { width: 81, height: 94 });
  }

  // ── BORDERED CONTAINER ──
  doc.rect(40, 155, 515.28, 380).lineWidth(1).stroke('#7eb4f7');

  // Title inside box
  doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('e-Receipt for Payment', 55, 170);

  // Details row
  doc.fontSize(11).font('Helvetica-Bold')
     .text('Payment Receipt Details: ', 55, 195, { underline: true, continued: true })
     .text(`${receipt.applicant_name} [ ${receipt.application_id} ]`, { underline: false });

  // QR Code top-right inside box
  doc.image(qrBuffer, 465, 165, { width: 75 });
  doc.fillColor('#555555').fontSize(7).font('Helvetica-Bold').text('SCAN TO VERIFY', 465, 242, { align: 'center', width: 75 });

  // ── TABLE ──
  const rows = [
    ['Transaction ID', transactionId],
    ['Bank Transaction ID', bankTransactionId],
    ['Order ID', orderIdVal],
    ['Transaction Amount', txnAmount],
    ['STATUS', txnStatus],
    ['Transaction Type', txnType],
    ['GATEWAYNAME', gatewayName],
    ['Response Code', responseCode],
    ['Response Message', responseMessage],
    ['Bank Name', bankName],
    ['Merchant ID', merchantId],
    ['Payment Mode', paymentMode],
    ['Refund Amount', refundAmount],
    ['Transaction Date', transactionDate]
  ];

  let rowY = 230;
  for (const [label, val] of rows) {
    // Cell backgrounds
    doc.rect(55, rowY, 170, 20).fillAndStroke('#f9f9f9', '#cccccc');
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
