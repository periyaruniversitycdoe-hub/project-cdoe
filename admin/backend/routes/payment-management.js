const { safeError } = require('../../../shared/security/safeError');
'use strict';
const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const Joi      = require('joi');
const ExcelJS  = require('exceljs');
const { verifyToken, isAdmin } = require('../../../shared/middleware/auth');
const { generateCETPHDApplicationId } = require('../../../student/backend/services/applicationIdEngine');
const { auditWrite } = require('../../../shared/security/writeAudit');
const { logEvent, EVENT_TYPES, SEVERITY } = require('../../../shared/security/auditLogger');

// All routes here require admin JWT (ADMIN_JWT_SECRET via shared middleware)
router.use(verifyToken, isAdmin);

// ─── GET /api/payment-management/transactions ──────────────────────────────────
// Paginated list with filters: status, provider, method, source, date range,
// course, application_number, transaction_id, search
router.get('/transactions', async (req, res) => {
  const {
    status, provider, method, date_from, date_to,
    course, application_number, transaction_id, search,
    page = 1, limit = 30
  } = req.query;

  const offset  = (parseInt(page) - 1) * parseInt(limit);
  const filters = ["pt.payment_status = 'SUCCESS'"];
  const params  = [];
  if (provider)           { filters.push('pt.provider_name = ?');                params.push(provider); }
  if (method)             { filters.push('pt.payment_method = ?');               params.push(method); }
  if (date_from)          { filters.push('pt.created_at >= ?');                  params.push(date_from); }
  if (date_to)            { filters.push('pt.created_at <= ?');                  params.push(date_to + ' 23:59:59'); }
  if (course)             { filters.push('a.subject LIKE ?');                    params.push(`%${course}%`); }
  if (application_number) { filters.push('pt.application_id = ?');               params.push(application_number); }
  if (transaction_id)     { filters.push('pt.gateway_transaction_id LIKE ?');    params.push(`%${transaction_id}%`); }
  if (search) {
    filters.push('(pt.order_id LIKE ? OR a.applicant_name LIKE ? OR a.email LIKE ? OR pt.gateway_transaction_id LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM payment_transactions pt
       LEFT JOIN applications a ON a.user_id = pt.user_id
       LEFT JOIN users u ON pt.user_id = u.id
       ${where}`, params
    );
    const [rows] = await db.query(
      `SELECT
         pt.order_id, pt.application_id, pt.amount, pt.currency,
         pt.payment_method, pt.payment_sub_method, pt.provider_name,
         pt.payment_status, pt.gateway_order_id, pt.gateway_transaction_id, pt.failure_reason,
         pt.retry_count, pt.webhook_received, pt.webhook_verified,
         pt.initiated_at, pt.completed_at, pt.verified_at, pt.reconciliation_status,
         pt.created_at, pt.updated_at,
         pr.receipt_number, pr.issued_at AS receipt_issued_at,
         COALESCE(a.applicant_name, u.full_name) AS applicant_name,
         a.applicant_initial,
         COALESCE(a.email, u.email) AS email,
         a.mobile,
         a.community, a.subject
       FROM payment_transactions pt
       LEFT JOIN payment_receipts pr ON pt.order_id = pr.order_id
       LEFT JOIN applications a ON a.user_id = pt.user_id
       LEFT JOIN users u ON pt.user_id = u.id
       ${where}
       ORDER BY pt.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── GET /api/payment-management/transactions/:orderId ─────────────────────────
router.get('/transactions/:orderId', async (req, res) => {
  try {
    const [[txn]] = await db.query(
      `SELECT pt.*, pr.receipt_number, pr.qr_verification_code,
              a.applicant_name, a.applicant_initial, a.email, a.mobile, a.community,
              a.subject, a.status AS app_status
       FROM payment_transactions pt
       LEFT JOIN payment_receipts pr ON pt.order_id = pr.order_id
       LEFT JOIN applications a ON a.user_id = pt.user_id
       WHERE pt.order_id = ?`,
      [req.params.orderId]
    );
    if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found' });

    const [attempts] = await db.query(
      `SELECT * FROM payment_attempts WHERE order_id = ? ORDER BY attempted_at ASC`,
      [req.params.orderId]
    );
    const [webhooks] = await db.query(
      `SELECT id, provider_name, webhook_type, is_verified, is_processed, received_at, processed_at
       FROM payment_webhooks WHERE order_id = ? ORDER BY received_at DESC`,
      [req.params.orderId]
    );
    const [auditLogs] = await db.query(
      `SELECT * FROM payment_audit_logs WHERE order_id = ? ORDER BY created_at ASC`,
      [req.params.orderId]
    );

    res.json({ success: true, data: { ...txn, attempts, webhooks, auditLogs } });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── GET /api/payment-management/receipt/:orderId ──────────────────────────────
router.get('/receipt/:orderId', async (req, res) => {
  try {
    const receiptService = require('../services/receiptService');
    await receiptService.streamReceiptPDF(req.params.orderId, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(err.statusCode || 500).json({ success: false, message: safeError(err) });
    }
  }
});

// ─── PUT /api/payment-management/transactions/:orderId/status ──────────────────
// Admin manually updates payment status with reason + remarks.
// Does NOT touch the automated gateway workflow.
const updateStatusSchema = Joi.object({
  newStatus: Joi.string().valid(
    'PENDING', 'INITIATED', 'PROCESSING', 'AWAITING_CONFIRMATION',
    'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED', 'EXPIRED',
    'MANUAL_VERIFICATION_REQUIRED', 'PARTIALLY_PAID'
  ).required(),
  reason:  Joi.string().min(3).max(500).required(),
  remarks: Joi.string().max(1000).allow('', null).optional(),
});

const APP_STATUS_MAP = {
  SUCCESS:                      'Paid',
  FAILED:                       'Failed',
  CANCELLED:                    'Failed',
  EXPIRED:                      'Failed',
  REFUNDED:                     'Rejected',
  PENDING:                      'Pending',
  INITIATED:                    'Processing',
  PROCESSING:                   'Processing',
  AWAITING_CONFIRMATION:        'Pending',
  MANUAL_VERIFICATION_REQUIRED: 'Pending',
  PARTIALLY_PAID:               'Pending',
};

router.put('/transactions/:orderId/status', async (req, res) => {
  const { error, value } = updateStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const { newStatus, reason, remarks } = value;
  const { orderId } = req.params;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[txn]] = await conn.query(
      'SELECT * FROM payment_transactions WHERE order_id = ? FOR UPDATE',
      [orderId]
    );
    if (!txn) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const oldStatus = txn.payment_status;

    await conn.query(
      `UPDATE payment_transactions
       SET payment_status = ?, updated_at = NOW()
       WHERE order_id = ?`,
      [newStatus, orderId]
    );

    const appPaymentStatus = APP_STATUS_MAP[newStatus] || 'Pending';
    await conn.query(
      'UPDATE applications SET payment_status = ?, updated_at = NOW() WHERE user_id = ?',
      [appPaymentStatus, txn.user_id]
    );

    const ip = req.headers['x-real-ip'] ||
               (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
               req.ip || 'unknown';

    await conn.query(
      `INSERT INTO payment_audit_logs
         (order_id, application_id, user_id, action, actor, old_status, new_status, details, ip_address, user_agent)
       VALUES (?, ?, ?, 'ADMIN_MANUAL_STATUS_UPDATE', ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        txn.application_id,
        txn.user_id,
        `admin:${req.user?.id || 'unknown'}`,
        oldStatus,
        newStatus,
        JSON.stringify({ reason, remarks: remarks || null, adminId: req.user?.id }),
        ip,
        (req.headers['user-agent'] || '').substring(0, 255),
      ]
    );

    await conn.commit();

    // Fire-and-forget write audit (never crashes on failure)
    auditWrite(db, {
      req,
      action:   'UPDATE',
      table:    'payment_transactions',
      recordId: orderId,
      before:   { payment_status: oldStatus },
      after:    { payment_status: newStatus, reason },
    });

    res.json({ success: true, message: `Payment status updated to ${newStatus}` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: safeError(err) });
  } finally {
    conn.release();
  }
});

// ─── GET /api/payment-management/transactions/:orderId/history ─────────────────
// Full chronological timeline: audit logs + payment attempts + webhooks
router.get('/transactions/:orderId/history', async (req, res) => {
  try {
    const { orderId } = req.params;

    const [auditLogs] = await db.query(
      `SELECT 'audit' AS source_type, id, action, actor, old_status, new_status,
              details, ip_address, user_agent, created_at AS event_time
       FROM payment_audit_logs WHERE order_id = ?`,
      [orderId]
    );

    const [attempts] = await db.query(
      `SELECT 'attempt' AS source_type, id, attempt_number AS action,
              provider_name, attempt_status AS new_status, error_code, error_message,
              ip_address, NULL AS user_agent, attempted_at AS event_time
       FROM payment_attempts WHERE order_id = ?`,
      [orderId]
    );

    const [webhooks] = await db.query(
      `SELECT 'webhook' AS source_type, id, webhook_type AS action,
              provider_name, NULL AS new_status, is_verified, is_processed,
              NULL AS ip_address, NULL AS user_agent, received_at AS event_time
       FROM payment_webhooks WHERE order_id = ?`,
      [orderId]
    );

    const timeline = [...auditLogs, ...attempts, ...webhooks]
      .sort((a, b) => new Date(a.event_time) - new Date(b.event_time));

    res.json({ success: true, data: timeline });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── GET /api/payment-management/export ────────────────────────────────────────
// Export payment records as Excel (.xlsx) or CSV.
// Query params: format (xlsx|csv), + same filters as GET /transactions
router.get('/export', async (req, res) => {
  const {
    format = 'xlsx', status, provider, method,
    date_from, date_to, course, application_number, transaction_id
  } = req.query;

  const filters = ["pt.payment_status = 'SUCCESS'"];
  const params  = [];
  if (provider)           { filters.push('pt.provider_name = ?');             params.push(provider); }
  if (method)             { filters.push('pt.payment_method = ?');            params.push(method); }
  if (date_from)          { filters.push('pt.created_at >= ?');               params.push(date_from); }
  if (date_to)            { filters.push('pt.created_at <= ?');               params.push(date_to + ' 23:59:59'); }
  if (course)             { filters.push('a.subject LIKE ?');                 params.push(`%${course}%`); }
  if (application_number) { filters.push('pt.application_id = ?');            params.push(application_number); }
  if (transaction_id)     { filters.push('pt.gateway_transaction_id LIKE ?'); params.push(`%${transaction_id}%`); }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  try {
    const [rows] = await db.query(
      `SELECT
         pt.order_id, pt.application_id,
         a.applicant_name, a.email, a.mobile,
         pt.amount, pt.currency, pt.payment_method,
         pt.payment_status, pt.provider_name, pt.gateway_transaction_id,
         pr.receipt_number, pt.failure_reason,
         pt.created_at, pt.completed_at, pt.verified_at
       FROM payment_transactions pt
       LEFT JOIN applications a ON a.user_id = pt.user_id
       LEFT JOIN payment_receipts pr ON pt.order_id = pr.order_id
       ${where}
       ORDER BY pt.created_at DESC`,
      params
    );

    // Log the export event
    await logEvent(db, {
      eventType: EVENT_TYPES.DATA_EXPORT,
      portal:    'admin',
      severity:  SEVERITY.MEDIUM,
      req,
      userId:    req.user?.id,
      email:     req.user?.email,
      message:   `Payment data exported: ${rows.length} records (format=${format})`,
      meta:      { format, filters: req.query, count: rows.length },
    });

    const COLUMNS = [
      { header: 'Order ID',          key: 'order_id',               width: 30 },
      { header: 'Application ID',    key: 'application_id',         width: 20 },
      { header: 'Applicant Name',    key: 'applicant_name',         width: 25 },
      { header: 'Email',             key: 'email',                  width: 28 },
      { header: 'Mobile',            key: 'mobile',                 width: 15 },
      { header: 'Amount (INR)',      key: 'amount',                 width: 14 },
      { header: 'Currency',          key: 'currency',               width: 10 },
      { header: 'Payment Method',    key: 'payment_method',         width: 18 },
      { header: 'Status',            key: 'payment_status',         width: 32 },
      { header: 'Provider',          key: 'provider_name',          width: 14 },
      { header: 'Transaction ID',    key: 'gateway_transaction_id', width: 32 },
      { header: 'Receipt Number',    key: 'receipt_number',         width: 26 },
      { header: 'Failure Reason',    key: 'failure_reason',         width: 32 },
      { header: 'Created At',        key: 'created_at',             width: 22 },
      { header: 'Completed At',      key: 'completed_at',           width: 22 },
      { header: 'Verified At',       key: 'verified_at',            width: 22 },
    ];

    const formatVal = (v) => {
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toLocaleString('en-IN');
      return String(v);
    };

    // ── CSV ──
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="payment_export_${Date.now()}.csv"`);
      let csv = '﻿' + COLUMNS.map(c => `"${c.header}"`).join(',') + '\n';
      rows.forEach(r => {
        csv += COLUMNS.map(c => `"${formatVal(r[c.key]).replace(/"/g, '""')}"`).join(',') + '\n';
      });
      return res.send(csv);
    }

    // ── XLSX ──
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Periyar University PhD ERP';
    wb.created = new Date();

    const ws = wb.addWorksheet('Payment Transactions', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', ySplit: 4 }],
    });
    ws.columns = COLUMNS.map(c => ({ key: c.key, width: c.width }));

    // Title row
    ws.addRow(['Periyar University — Payment Transactions Export']);
    ws.mergeCells(1, 1, 1, COLUMNS.length);
    const titleCell = ws.getRow(1).getCell(1);
    titleCell.font      = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    // Meta row
    const genDate = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
    ws.addRow([`Generated: ${genDate}   |   Total Records: ${rows.length}`]);
    ws.mergeCells(2, 1, 2, COLUMNS.length);
    const metaCell = ws.getRow(2).getCell(1);
    metaCell.font      = { italic: true, size: 10, color: { argb: 'FF555555' } };
    metaCell.alignment = { horizontal: 'left' };

    // Spacer
    ws.addRow([]);

    // Header row
    ws.addRow(COLUMNS.map(c => c.header));
    ws.getRow(4).height = 22;
    ws.getRow(4).eachCell({ includeEmpty: true }, cell => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563eb' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border    = { bottom: { style: 'medium', color: { argb: 'FF1e3a5f' } } };
    });

    // Data rows
    rows.forEach((r, idx) => {
      const row = ws.addRow(COLUMNS.map(c => formatVal(r[c.key])));
      row.height = 18;
      if (idx % 2 === 0) {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFeff6ff' } };
        });
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="payment_export_${Date.now()}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── GET /api/payment-management/stats ────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  try {
    const [[totals]] = await db.query(
      `SELECT
         COUNT(*)                                                            AS total_transactions,
         SUM(CASE WHEN payment_status='SUCCESS' THEN 1 ELSE 0 END)          AS successful,
         SUM(CASE WHEN payment_status='FAILED'  THEN 1 ELSE 0 END)          AS failed,
         SUM(CASE WHEN payment_status='AWAITING_CONFIRMATION' THEN 1 ELSE 0 END) AS awaiting_utr,
         SUM(CASE WHEN payment_status IN ('INITIATED','PROCESSING') THEN 1 ELSE 0 END) AS in_progress,
         SUM(CASE WHEN payment_status='SUCCESS' THEN amount ELSE 0 END)     AS total_collected,
         SUM(CASE WHEN DATE(created_at)=CURDATE() AND payment_status='SUCCESS' THEN amount ELSE 0 END) AS today_collected
       FROM payment_transactions`
    );
    const [byProvider] = await db.query(
      `SELECT provider_name,
         COUNT(*) AS total,
         SUM(CASE WHEN payment_status='SUCCESS' THEN 1 ELSE 0 END) AS success_count,
         SUM(CASE WHEN payment_status='SUCCESS' THEN amount ELSE 0 END) AS collected
       FROM payment_transactions GROUP BY provider_name`
    );
    const [byMethod] = await db.query(
      `SELECT payment_method,
         COUNT(*) AS total,
         SUM(CASE WHEN payment_status='SUCCESS' THEN 1 ELSE 0 END) AS success_count
       FROM payment_transactions GROUP BY payment_method`
    );
    const [dailyTrend] = await db.query(
      `SELECT DATE(created_at) AS date,
         COUNT(*) AS transactions,
         SUM(CASE WHEN payment_status='SUCCESS' THEN amount ELSE 0 END) AS collected
       FROM payment_transactions
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`
    );

    res.json({ success: true, data: { totals, byProvider, byMethod, dailyTrend } });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── POST /api/payment-management/approve-utr ─────────────────────────────────
// Admin manually approves or rejects a direct UPI payment (UTR verification).
router.post('/approve-utr', async (req, res) => {
  const { order_id, action, remarks } = req.body;
  if (!order_id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'order_id and action (approve|reject) are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[txn]] = await conn.query(
      `SELECT * FROM payment_transactions WHERE order_id = ? FOR UPDATE`, [order_id]
    );
    if (!txn) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Transaction not found' }); }
    if (txn.payment_status === 'SUCCESS') { await conn.rollback(); return res.json({ success: true, message: 'Already approved' }); }

    if (action === 'approve') {
      await conn.query(
        `UPDATE payment_transactions SET payment_status='SUCCESS', verified_at=NOW(), updated_at=NOW() WHERE order_id=?`,
        [order_id]
      );

      // ── Generate Application ID if not already done (idempotency guard) ──
      const [[appRow]] = await conn.query(
        `SELECT a.application_id, u.session_id, a.applicant_name, a.applicant_initial, a.email, a.mobile
         FROM applications a
         JOIN users u ON a.user_id = u.id
         WHERE a.user_id = ? LIMIT 1`,
        [txn.user_id]
      );

      let applicationId = appRow?.application_id;
      if (!applicationId) {
        if (!appRow?.session_id) {
          throw new Error('UTR approve: user has no session_id — cannot generate Application ID');
        }
        applicationId = await generateCETPHDApplicationId(db, appRow.session_id);

        // Propagate to all related tables
        await conn.query('UPDATE users SET application_id = ? WHERE id = ?', [applicationId, txn.user_id]);
        await conn.query(
          `UPDATE applications SET application_id = ?, application_submitted = 1, application_id_generated_at = NOW()
           WHERE user_id = ?`,
          [applicationId, txn.user_id]
        );
        await conn.query('UPDATE school_education       SET application_id = ? WHERE user_id = ?', [applicationId, txn.user_id]);
        await conn.query('UPDATE higher_education       SET application_id = ? WHERE user_id = ?', [applicationId, txn.user_id]);
        await conn.query('UPDATE experience_details     SET application_id = ? WHERE user_id = ?', [applicationId, txn.user_id]);
        await conn.query('UPDATE application_documents  SET application_id = ? WHERE user_id = ?', [applicationId, txn.user_id]);
        await conn.query('UPDATE student_qualifications SET application_id = ? WHERE user_id = ?', [applicationId, txn.user_id]);
        await conn.query('UPDATE payment_transactions SET application_id = ? WHERE order_id = ?', [applicationId, txn.order_id]);
      }

      const crypto = require('crypto');
      const safeAppId = applicationId.replace(/[^A-Z0-9]/gi, '').substring(0, 8).toUpperCase();
      const receiptNumber = `RCPT-${new Date().getFullYear()}-${safeAppId}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();
      const gatewayRef = txn.gateway_transaction_id || txn.order_id;

      await conn.query(
        `UPDATE applications
         SET status='SUBMITTED', payment_status='Paid', payment_date=NOW(),
             payment_transaction_id=?, pay_choice='PayNow', final_submitted=1,
             is_locked=1, form_locked=1,
             application_generated_date=COALESCE(application_generated_date, NOW()),
             payment_completed_at=NOW(), submitted_at=COALESCE(submitted_at, NOW()),
             receipt_number=?, submission_reference=?, updated_at=NOW()
         WHERE user_id=?`,
        [gatewayRef, receiptNumber, `REF-${txn.order_id}`, txn.user_id]
      );

      // Audit trail — APPLICATION_ID_GENERATED & FORM_LOCKED
      try {
        await conn.query(
          `INSERT INTO payment_audit_logs (order_id, application_id, user_id, action, actor, new_status, details)
           VALUES (?,?,?,'APPLICATION_ID_GENERATED',?,?,?),
                  (?,?,?,'FORM_LOCKED',?,?,?)`,
          [order_id, applicationId, txn.user_id, `admin:${req.user?.id||'unknown'}`, 'GENERATED',
           JSON.stringify({ application_id: applicationId, trigger: 'ADMIN_UTR_APPROVAL' }),
           order_id, applicationId, txn.user_id, `admin:${req.user?.id||'unknown'}`, 'LOCKED',
           JSON.stringify({ trigger: 'ADMIN_UTR_APPROVAL', admin_id: req.user?.id, timestamp: new Date().toISOString() })]
        );
      } catch (_) {}

      const displayName = appRow
        ? `${appRow.applicant_name || ''} ${appRow.applicant_initial || ''}`.trim()
        : 'N/A';

      await conn.query(
        `INSERT INTO payment_receipts
           (receipt_number, order_id, application_id, user_id, amount, currency,
            payment_method, provider_name, gateway_transaction_id,
            applicant_name, applicant_email, applicant_mobile, qr_verification_code, issued_at)
         VALUES (?,?,?,?,?,'INR',?,?,?,?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE receipt_number=VALUES(receipt_number)`,
        [
          receiptNumber, txn.order_id, applicationId, txn.user_id, txn.amount,
          txn.payment_method, 'direct_upi', gatewayRef,
          displayName, appRow?.email || '', appRow?.mobile || '', verificationCode
        ]
      );

      await conn.query(
        `INSERT INTO payments
           (application_id, user_id, amount, gateway, transaction_id, payment_status,
            payment_mode, receipt_number, paid_at, payment_verified, payment_approved,
            enterprise_order_id, provider_name)
         VALUES (?,?,?,'Direct UPI',?,'Success',?,?,NOW(),1,1,?,?)
         ON DUPLICATE KEY UPDATE payment_status='Success', payment_verified=1`,
        [applicationId, txn.user_id, txn.amount, gatewayRef,
         txn.payment_method, receiptNumber, txn.order_id, 'direct_upi']
      );

    } else {
      await conn.query(
        `UPDATE payment_transactions SET payment_status='FAILED', failure_reason=?, updated_at=NOW() WHERE order_id=?`,
        [remarks || 'Admin rejected UPI payment', order_id]
      );
      await conn.query(
        `UPDATE applications SET payment_status='Failed', updated_at=NOW() WHERE user_id=?`,
        [txn.user_id]
      );
    }

    await conn.query(
      `INSERT INTO payment_audit_logs (order_id, application_id, user_id, action, actor, old_status, new_status, details)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        order_id, txn.application_id, txn.user_id,
        action === 'approve' ? 'ADMIN_UTR_APPROVED' : 'ADMIN_UTR_REJECTED',
        `admin:${req.user?.id || 'unknown'}`,
        txn.payment_status,
        action === 'approve' ? 'SUCCESS' : 'FAILED',
        JSON.stringify({ remarks: remarks || null, adminId: req.user?.id })
      ]
    );

    await conn.commit();
    res.json({ success: true, message: `Payment ${action}d successfully` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: safeError(err) });
  } finally {
    conn.release();
  }
});

// ─── GET /api/payment-management/pending-utr ──────────────────────────────────
router.get('/pending-utr', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT pt.order_id, pt.application_id, pt.amount, pt.payment_method,
              pt.gateway_transaction_id AS utr_number, pt.created_at, pt.updated_at,
              a.applicant_name, a.applicant_initial, a.email, a.mobile
       FROM payment_transactions pt
       LEFT JOIN applications a ON a.user_id = pt.user_id
       WHERE pt.payment_status = 'AWAITING_CONFIRMATION'
       ORDER BY pt.updated_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── GET /api/payment-management/reconciliation ───────────────────────────────
router.get('/reconciliation', async (req, res) => {
  const { date_from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0,10),
          date_to   = new Date().toISOString().slice(0,10) } = req.query;
  try {
    const [rows] = await db.query(
      `SELECT
         DATE(created_at) AS date,
         provider_name,
         payment_status,
         payment_method,
         COUNT(*)      AS count,
         SUM(amount)   AS total_amount,
         reconciliation_status
       FROM payment_transactions
       WHERE created_at BETWEEN ? AND ?
       GROUP BY DATE(created_at), provider_name, payment_status, payment_method, reconciliation_status
       ORDER BY date DESC`,
      [date_from, date_to + ' 23:59:59']
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── GET /api/payment-management/audit-logs/:orderId ──────────────────────────
router.get('/audit-logs/:orderId', async (req, res) => {
  try {
    const [logs] = await db.query(
      `SELECT * FROM payment_audit_logs WHERE order_id = ? ORDER BY created_at ASC`,
      [req.params.orderId]
    );
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── GET /api/payment-management/webhooks/:orderId ────────────────────────────
router.get('/webhooks/:orderId', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM payment_webhooks WHERE order_id = ? ORDER BY received_at DESC`,
      [req.params.orderId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── GET /api/payment-management/awaiting-payment ─────────────────────────────
router.get('/awaiting-payment', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.application_id, a.applicant_name, a.community, a.payment_status,
              a.payment_decision, a.payment_due_date, a.payment_expired_at,
              a.payment_resume_count, a.status AS app_status, a.updated_at,
              u.email, u.phone,
              CASE WHEN a.payment_due_date < NOW() THEN 1 ELSE 0 END AS is_overdue,
              DATEDIFF(a.payment_due_date, NOW()) AS days_remaining
       FROM applications a
       JOIN users u ON a.user_id = u.id
       WHERE a.status IN ('AWAITING_PAYMENT','PAYMENT_PENDING','PAYMENT_EXPIRED')
         AND (a.payment_status IS NULL OR a.payment_status NOT IN ('Paid','Verified','Approved'))
       ORDER BY a.payment_due_date ASC`,
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── PUT /api/payment-management/extend-due/:applicationId ────────────────────
router.put('/extend-due/:applicationId', async (req, res) => {
  const { extra_days } = req.body;
  const days = parseInt(extra_days, 10);
  if (!days || days < 1 || days > 90) {
    return res.status(400).json({ success: false, message: 'extra_days must be between 1 and 90' });
  }
  try {
    const [[app]] = await db.query(
      `SELECT application_id, status, payment_due_date, payment_status FROM applications WHERE application_id = ?`,
      [req.params.applicationId]
    );
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (['Paid','Verified','Approved'].includes(app.payment_status)) {
      return res.status(409).json({ success: false, message: 'Payment already completed' });
    }

    const base = (app.payment_due_date && new Date(app.payment_due_date) > new Date())
      ? new Date(app.payment_due_date)
      : new Date();
    const newDueDate = new Date(base.getTime() + days * 86400000);

    await db.query(
      `UPDATE applications
       SET payment_due_date = ?, payment_expired_at = NULL,
           status = CASE WHEN status = 'PAYMENT_EXPIRED' THEN 'AWAITING_PAYMENT' ELSE status END,
           updated_at = NOW()
       WHERE application_id = ?`,
      [newDueDate, req.params.applicationId]
    );
    res.json({ success: true, message: `Due date extended by ${days} days`, new_due_date: newDueDate });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

// ─── PUT /api/payment-management/force-expire/:applicationId ──────────────────
router.put('/force-expire/:applicationId', async (req, res) => {
  try {
    await db.query(
      `UPDATE applications SET status='PAYMENT_EXPIRED', payment_expired_at=NOW(), updated_at=NOW()
       WHERE application_id=? AND status IN ('AWAITING_PAYMENT','PAYMENT_PENDING')`,
      [req.params.applicationId]
    );
    res.json({ success: true, message: 'Application marked as payment expired' });
  } catch (err) {
    res.status(500).json({ success: false, message: safeError(err) });
  }
});

module.exports = router;
