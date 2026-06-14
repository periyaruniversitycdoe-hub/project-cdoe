'use strict';
const https   = require('https');
const QRCode  = require('qrcode');
const crypto  = require('crypto');

let PaytmChecksum;
try { PaytmChecksum = require('paytmchecksum'); } catch { PaytmChecksum = null; }

const IS_PROD   = process.env.PAYMENT_ENV === 'production';
const BASE_HOST = IS_PROD ? 'securegw.paytm.in' : 'securegw-stage.paytm.in';

function getMid()  { return process.env.PAYTM_MID            || ''; }
function getKey()  { return process.env.PAYTM_MERCHANT_KEY   || ''; }
function getSite() { return process.env.PAYTM_WEBSITE        || 'WEBSTAGING'; }

// ── Low-level HTTPS POST ─────────────────────────────────────────────────────
function httpsPost(host, path, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      host, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Non-JSON response from Paytm: ' + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Generate Paytm checksum signature ────────────────────────────────────────
async function sign(bodyObj) {
  if (!PaytmChecksum) throw new Error('paytmchecksum package not installed. Run: npm install paytmchecksum');
  return PaytmChecksum.generateSignature(JSON.stringify(bodyObj), getKey());
}

// ── Create Order — returns { txnToken, checkoutUrl, orderId } ─────────────────
async function createOrder({ orderId, amount, custId }) {
  const mid = getMid();
  if (!mid) throw new Error('PAYTM_MID not configured');

  const body = {
    requestType   : 'Payment',
    mid,
    websiteName   : getSite(),
    orderId,
    callbackUrl   : process.env.PAYTM_CALLBACK_URL || `${process.env.PAYMENT_WEBHOOK_BASE_URL}/api/payment/callback`,
    txnAmount     : { value: parseFloat(amount).toFixed(2), currency: 'INR' },
    userInfo      : { custId: String(custId) },
    channelId     : process.env.PAYTM_CHANNEL_ID   || 'WEB',
    industryTypeId: process.env.PAYTM_INDUSTRY_TYPE || 'Education',
  };

  const signature = await sign(body);
  const path = `/theia/api/v1/initiateTransaction?mid=${mid}&orderId=${orderId}`;
  const result = await httpsPost(BASE_HOST, path, { body, head: { signature } });

  if (!result.body) throw new Error('Empty response from Paytm initiateTransaction');
  const info = result.body.resultInfo || {};
  if (info.resultStatus !== 'S') {
    throw new Error(info.resultMsg || `Paytm order creation failed (${info.resultStatus})`);
  }

  const txnToken    = result.body.txnToken;
  const checkoutUrl = `https://${BASE_HOST}/theia/api/v1/showPaymentPage?mid=${mid}&orderId=${orderId}&txnToken=${txnToken}`;
  return { txnToken, checkoutUrl, orderId };
}

// ── Verify Transaction — returns { status, txnId, bankTxnId, paymentMode } ───
async function verifyTransaction(orderId) {
  const mid = getMid();
  const body = { mid, orderId };
  const signature = await sign(body);
  const result = await httpsPost(BASE_HOST, '/v3/order/status', { body, head: { signature } });

  if (!result.body) throw new Error('Empty response from Paytm order status');
  const info = result.body.resultInfo || {};

  return {
    status      : _mapStatus(info.resultStatus),
    txnId       : result.body.txnId       || null,
    bankTxnId   : result.body.bankTxnId   || null,
    txnAmount   : result.body.txnAmount   || null,
    paymentMode : result.body.paymentMode || null,
    resultMsg   : info.resultMsg          || '',
    raw         : result.body,
  };
}

function _mapStatus(s) {
  if (s === 'TXN_SUCCESS') return 'SUCCESS';
  if (s === 'PENDING')     return 'PROCESSING';
  if (s === 'TXN_FAILURE') return 'FAILED';
  return 'PROCESSING';
}

// ── Generate UPI QR + deep links ─────────────────────────────────────────────
async function generateUpiData(amount, orderId) {
  const vpa  = process.env.UNIVERSITY_UPI_VPA  || 'periyaruniversity@sbi';
  const name = process.env.UNIVERSITY_UPI_NAME || 'Periyar University';
  const note = `PhD Admission Fee - ${orderId}`;

  const upiString = [
    `upi://pay?pa=${vpa}`,
    `pn=${encodeURIComponent(name)}`,
    `am=${parseFloat(amount).toFixed(2)}`,
    `cu=INR`,
    `tn=${encodeURIComponent(note)}`,
    `tr=${orderId}`,
  ].join('&');

  const qrCode = await QRCode.toDataURL(upiString, {
    width: 256, margin: 2,
    color: { dark: '#1a3a5c', light: '#ffffff' },
  });

  const params = `pa=${vpa}&pn=${encodeURIComponent(name)}&am=${parseFloat(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}&tr=${orderId}`;

  return {
    upiString,
    qrCode,
    deepLinks: {
      googlepay : `tez://upi/pay?${params}`,
      phonepe   : `phonepe://pay?${params}`,
      paytm     : `paytmmp://pay?${params}`,
      generic   : upiString,
    },
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

// ── Verify Paytm checksum signature ──────────────────────────────────────────
// bodyObj must NOT contain CHECKSUMHASH — strip it before calling.
// Package takes the object directly (JSON.stringify internally), NOT a pre-stringified string.
async function verifyWebhookSignature(bodyObj, paytmChecksum) {
  if (!PaytmChecksum || !paytmChecksum) return false;
  try {
    return await PaytmChecksum.verifySignature(bodyObj, getKey(), paytmChecksum);
  } catch { return false; }
}

// ── Generate unique order ID ─────────────────────────────────────────────────
function generateOrderId(applicationId) {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const date = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  
  const timestamp = `${year}${month}${date}${hours}${minutes}${seconds}`;
  // Append 4 random hex characters to guarantee absolute uniqueness across concurrent payments
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PURD${timestamp}${rand}`;
}

// ── Generate receipt number ───────────────────────────────────────────────────
function generateReceiptNumber(applicationId) {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RCPT-${year}-${applicationId}-${rand}`;
}

module.exports = {
  createOrder,
  verifyTransaction,
  generateUpiData,
  verifyWebhookSignature,
  generateOrderId,
  generateReceiptNumber,
};
