'use strict';

/**
 * Credential Notification Service
 *
 * Called immediately after any portal registers a new user. Responsibilities:
 *   1. Ensure credential_logs table exists (idempotent CREATE IF NOT EXISTS).
 *   2. Insert a credential log record.
 *   3. Send the user their login credentials by email.
 *   4. (Optional) Notify the admin email address.
 *
 * Usage:
 *   const credSvc = require('../../shared/credential/credentialNotificationService');
 *   credSvc.notify({ db, name, email, password, portalType, loginUrl }).catch(() => {});
 */

const path = require('path');
const fs   = require('fs');
const { sendTransacEmail } = require('../../backend/src/services/emailService');

function getBackendBaseUrl() {
  const studentApiUrl = process.env.VITE_STUDENT_API_URL || process.env.STUDENT_API_URL;
  if (studentApiUrl) {
    return studentApiUrl.replace(/\/student\/?$/, '');
  }
  return 'http://localhost:5000';
}

const logoUrl = `${getBackendBaseUrl()}/student/uploads/settings/pu_logo.png`;

const ADMIN_EMAIL  = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || null;

// ── HTML Templates ─────────────────────────────────────────────────────────────

function userCredentialTemplate({ name, email, password, portalType, loginUrl }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your PhD Portal Account Details</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#1a3c5e 0%,#2d6a9f 100%);padding:28px 36px;text-align:center;">
          <img src="${logoUrl}" alt="Periyar University" style="height:64px;width:auto;object-fit:contain;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
          <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Periyar University</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">PhD Portal — Account Created</div>
        </td>
      </tr>

      <!-- Greeting -->
      <tr>
        <td style="padding:28px 36px 0;">
          <p style="font-size:15px;color:#2d3748;margin:0 0 6px;">Dear <strong>${name}</strong>,</p>
          <p style="font-size:14px;color:#4a5568;margin:0;">Your account has been created successfully on the <strong>${portalType} Portal</strong>. Please find your login credentials below.</p>
        </td>
      </tr>

      <!-- Credentials Card -->
      <tr>
        <td style="padding:20px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff;border:1px solid #bee3f8;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#2d6a9f;padding:10px 20px;">
                <span style="color:#fff;font-size:13px;font-weight:600;letter-spacing:0.4px;">🔐 YOUR LOGIN CREDENTIALS</span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                      <span style="font-size:12px;color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Portal</span>
                      <div style="font-size:14px;color:#2d3748;font-weight:600;margin-top:3px;">${portalType} Portal</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                      <span style="font-size:12px;color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Username / Email</span>
                      <div style="font-size:14px;color:#2d3748;font-weight:600;margin-top:3px;">${email}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <span style="font-size:12px;color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Password</span>
                      <div style="font-size:16px;color:#2d6a9f;font-weight:700;font-family:monospace;margin-top:3px;letter-spacing:1px;">${password}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Login Button -->
      ${loginUrl ? `
      <tr>
        <td style="padding:0 36px 20px;text-align:center;">
          <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#1a3c5e,#2d6a9f);color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 36px;border-radius:6px;">Login to ${portalType} Portal →</a>
        </td>
      </tr>` : ''}

      <!-- Footer -->
      <tr>
        <td style="background:#f7fafc;padding:18px 36px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="font-size:12px;color:#718096;margin:0;">Regards,<br/><strong style="color:#2d3748;">PhD Administration — Periyar University</strong></p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function adminNotificationTemplate({ name, email, password, portalType, registeredAt }) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New User Registration</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
  <tr><td align="center">
    <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#2d3748,#4a5568);padding:24px 32px;">
          <div style="font-size:18px;font-weight:700;color:#fff;">🔔 New User Registration Alert</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:4px;">PhD Portal — Admin Notification</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px;">
          <p style="font-size:14px;color:#4a5568;margin:0 0 16px;">A new user has registered on the <strong>${portalType} Portal</strong>:</p>
          <table width="100%" cellpadding="0" cellspacing="6">
            <tr><td style="font-size:12px;color:#718096;width:130px;padding:6px 0;">Name</td><td style="font-size:13px;color:#2d3748;font-weight:600;">${name}</td></tr>
            <tr><td style="font-size:12px;color:#718096;padding:6px 0;">Email / Username</td><td style="font-size:13px;color:#2d3748;font-weight:600;">${email}</td></tr>
            <tr><td style="font-size:12px;color:#718096;padding:6px 0;">Password</td><td style="font-size:13px;color:#2d6a9f;font-weight:700;font-family:monospace;">${password}</td></tr>
            <tr><td style="font-size:12px;color:#718096;padding:6px 0;">Portal</td><td style="font-size:13px;color:#2d3748;font-weight:600;">${portalType}</td></tr>
            <tr><td style="font-size:12px;color:#718096;padding:6px 0;">Registered At</td><td style="font-size:13px;color:#2d3748;">${registeredAt}</td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#f7fafc;padding:14px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="font-size:11px;color:#a0aec0;margin:0;">This is an automated notification. View all credentials in the Admin Credential Management Dashboard.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Auto-create table on first require (idempotent) ───────────────────────────

async function ensureTable(db) {
    await db.query(`
        CREATE TABLE IF NOT EXISTS credential_logs (
            id                   INT AUTO_INCREMENT PRIMARY KEY,
            user_name            VARCHAR(255) NOT NULL,
            email                VARCHAR(255) NOT NULL,
            plain_password       VARCHAR(255) NOT NULL,
            portal_type          ENUM('Student','Supervisor','Center','Admin') NOT NULL,
            account_status       VARCHAR(50)  NOT NULL DEFAULT 'Active',
            login_url            VARCHAR(500) DEFAULT NULL,
            email_sent           TINYINT(1)   NOT NULL DEFAULT 0,
            password_changed     TINYINT(1)   NOT NULL DEFAULT 0,
            password_changed_at  TIMESTAMP    NULL DEFAULT NULL,
            password_change_ip   VARCHAR(45)  NULL DEFAULT NULL,
            created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_clog_portal  (portal_type),
            INDEX idx_clog_email   (email),
            INDEX idx_clog_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Add new columns to existing tables (idempotent)
    const newCols = [
        `ALTER TABLE credential_logs ADD COLUMN password_changed TINYINT(1) NOT NULL DEFAULT 0`,
        `ALTER TABLE credential_logs ADD COLUMN password_changed_at TIMESTAMP NULL DEFAULT NULL`,
        `ALTER TABLE credential_logs ADD COLUMN password_change_ip VARCHAR(45) NULL DEFAULT NULL`,
    ];
    for (const sql of newCols) {
        await db.query(sql).catch(e => { if (e.errno !== 1060 && e.code !== 'ER_DUP_FIELDNAME') throw e; });
    }
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {object} opts.db          - mysql2 promise pool/connection from the calling portal
 * @param {string} opts.name        - User's full display name
 * @param {string} opts.email       - User's email (also serves as username)
 * @param {string} opts.password    - Plain-text password BEFORE hashing
 * @param {string} opts.portalType  - 'Student' | 'Supervisor' | 'Center' | 'Admin'
 * @param {string} [opts.loginUrl]  - Portal login URL
 */
async function notify({ db, name, email, password, portalType, loginUrl = '' }) {
    // 1. Ensure table exists
    await ensureTable(db);

    // 2. Log to database
    let emailSent = 0;
    await db.query(
        'INSERT INTO credential_logs (user_name, email, plain_password, portal_type, login_url, email_sent) VALUES (?, ?, ?, ?, ?, 0)',
        [name, email, password, portalType, loginUrl || null]
    );

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // 3. Send credential email to user
    try {
        const html        = userCredentialTemplate({ name, email, password, portalType, loginUrl });
        await sendTransacEmail({
            to:          email,
            subject:     `Your ${portalType} Portal Account Details — Periyar University`,
            html,
        });
        emailSent = 1;
        console.log(`[CredentialSvc] ✅ Credential email sent to ${email} (${portalType})`);
    } catch (mailErr) {
        console.error(`[CredentialSvc] ⚠️  Failed to send credential email to ${email}:`, mailErr.message);
    }

    // 4. Update email_sent flag
    if (emailSent) {
        await db.query(
            'UPDATE credential_logs SET email_sent = 1 WHERE email = ? AND portal_type = ? ORDER BY created_at DESC LIMIT 1',
            [email, portalType]
        );
    }

    // 5. Notify admin (non-fatal)
    if (ADMIN_EMAIL) {
        try {
            const adminHtml = adminNotificationTemplate({ name, email, password, portalType, registeredAt: now });
            await sendTransacEmail({
                to:      ADMIN_EMAIL,
                subject: `[PhD Admin] New ${portalType} Registration — ${name} <${email}>`,
                html:    adminHtml,
            });
            console.log(`[CredentialSvc] ✅ Admin notification sent to ${ADMIN_EMAIL}`);
        } catch (adminMailErr) {
            console.error(`[CredentialSvc] ⚠️  Admin notification failed:`, adminMailErr.message);
        }
    }
}

// ── Password-change email template ────────────────────────────────────────────

function passwordChangedTemplate({ name, email, portalType, changedAt, ipAddress, loginUrl }) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Password Changed</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
  <tr><td align="center">
    <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#1a3c5e,#d97706);padding:28px 36px;text-align:center;">
          <img src="${logoUrl}" alt="Periyar University" style="height:60px;width:auto;object-fit:contain;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
          <div style="font-size:20px;font-weight:700;color:#fff;">Periyar University</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;">PhD Portal — Password Changed</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 36px 0;">
          <p style="font-size:15px;color:#2d3748;margin:0 0 6px;">Dear <strong>${name}</strong>,</p>
          <p style="font-size:14px;color:#4a5568;margin:0 0 16px;">Your password on the <strong>${portalType} Portal</strong> was changed successfully.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 36px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;overflow:hidden;">
            <tr><td style="background:#d97706;padding:10px 20px;"><span style="color:#fff;font-size:13px;font-weight:600;">📋 CHANGE DETAILS</span></td></tr>
            <tr><td style="padding:16px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="font-size:12px;color:#78350f;font-weight:600;width:140px;padding:5px 0;">Email</td><td style="font-size:13px;color:#1c1917;font-weight:600;">${email}</td></tr>
                <tr><td style="font-size:12px;color:#78350f;font-weight:600;padding:5px 0;">Portal</td><td style="font-size:13px;color:#1c1917;font-weight:600;">${portalType} Portal</td></tr>
                <tr><td style="font-size:12px;color:#78350f;font-weight:600;padding:5px 0;">Changed At</td><td style="font-size:13px;color:#1c1917;font-weight:600;">${changedAt}</td></tr>
                ${ipAddress ? `<tr><td style="font-size:12px;color:#78350f;font-weight:600;padding:5px 0;">IP Address</td><td style="font-size:13px;color:#1c1917;">${ipAddress}</td></tr>` : ''}
              </table>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 36px 20px;">
          <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;padding:12px 16px;">
            <p style="font-size:12px;color:#7f1d1d;margin:0;line-height:1.6;">
              ⚠️ <strong>If you did not make this change</strong>, please contact the PhD administration office immediately and reset your password.
            </p>
          </div>
        </td>
      </tr>
      ${loginUrl ? `<tr><td style="padding:0 36px 20px;text-align:center;"><a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#1a3c5e,#2d6a9f);color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 32px;border-radius:6px;">Login to ${portalType} Portal →</a></td></tr>` : ''}
      <tr>
        <td style="background:#f7fafc;padding:16px 36px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="font-size:12px;color:#718096;margin:0;">Regards,<br/><strong style="color:#2d3748;">PhD Administration — Periyar University</strong></p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── notifyPasswordChange ──────────────────────────────────────────────────────

/**
 * Called after any portal user successfully changes their password.
 * Updates the credential_logs record and notifies the user + admin.
 *
 * @param {object} opts
 * @param {object} opts.db          - mysql2 promise pool from the calling portal
 * @param {string} opts.email       - User's email
 * @param {string} opts.newPassword - New plain-text password (before hashing)
 * @param {string} opts.portalType  - 'Student' | 'Supervisor' | 'Center' | 'Admin'
 * @param {string} [opts.ipAddress] - Requester IP for audit
 */
async function notifyPasswordChange({ db, email, newPassword, portalType, ipAddress = null }) {
    await ensureTable(db);

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Update the most recent credential log for this email+portal
    const [upd] = await db.query(
        `UPDATE credential_logs
            SET plain_password = ?, password_changed = 1, password_changed_at = NOW(), password_change_ip = ?
          WHERE email = ? AND portal_type = ?
          ORDER BY created_at DESC
          LIMIT 1`,
        [newPassword, ipAddress || null, email, portalType]
    );

    // Fetch name + login_url for the email template
    const [rows] = await db.query(
        `SELECT user_name, login_url FROM credential_logs WHERE email = ? AND portal_type = ? ORDER BY created_at DESC LIMIT 1`,
        [email, portalType]
    );
    const name     = rows[0]?.user_name || email;
    const loginUrl = rows[0]?.login_url || '';

    // Send email to user
    try {
        const html       = passwordChangedTemplate({ name, email, portalType, changedAt: now, ipAddress, loginUrl });
        await sendTransacEmail({
            to:          email,
            subject:     `Your ${portalType} Portal Password Was Changed — Periyar University`,
            html,
        });
        console.log(`[CredentialSvc] ✅ Password-change email sent to ${email} (${portalType})`);
    } catch (mailErr) {
        console.error(`[CredentialSvc] ⚠️  Password-change email failed for ${email}:`, mailErr.message);
    }

    // Notify admin
    if (ADMIN_EMAIL) {
        try {
            await sendTransacEmail({
                to:      ADMIN_EMAIL,
                subject: `[PhD Admin] Password Changed — ${portalType}: ${name} <${email}>`,
                html: `<p style="font-family:sans-serif;font-size:14px;">
                    <strong>${name}</strong> (${email}) changed their password on the
                    <strong>${portalType} Portal</strong> at <strong>${now}</strong>${ipAddress ? ` from IP ${ipAddress}` : ''}.
                    <br/><br/>View the updated record in the
                    <a href="${process.env.ADMIN_PORTAL_URL || 'http://localhost:5174'}/credential-management">Credential Monitor</a>.
                </p>`,
            });
        } catch (e) { /* non-fatal */ }
    }
}

module.exports = { notify, notifyPasswordChange };
