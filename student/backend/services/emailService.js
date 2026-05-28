'use strict';

const { transporter }               = require('../config/mailConfig');
const { logSent, logFailed }        = require('../utils/emailLogger');
const welcomeTemplate               = require('../templates/welcomeTemplate');
const otpTemplate                   = require('../templates/otpTemplate');
const passwordResetTemplate         = require('../templates/passwordResetTemplate');
const applicationSubmittedTemplate  = require('../templates/applicationSubmittedTemplate');
const applicationStatusTemplate     = require('../templates/applicationStatusTemplate');

const FROM_NAME    = process.env.MAIL_FROM_NAME || 'Periyar University PhD Portal';
const FROM_ADDRESS = process.env.MAIL_FROM      || process.env.MAIL_USER;
const FROM         = `"${FROM_NAME}" <${FROM_ADDRESS}>`;

const db = require('../config/db');

// ─── Theme Configurations for visual compiling ────────────────────────
const THEMES = {
    'university-blue': {
        primaryColor: '#2563eb',
        headerBg: '#1e3a8a',
        accentColor: '#3b82f6',
        bodyBg: '#f8fafc',
        cardBg: '#ffffff',
        textColor: '#1e293b',
        buttonTextColor: '#ffffff',
        footerTextColor: '#64748b',
        borderColor: '#e2e8f0',
        greetingColor: '#1e3a8a'
    },
    'emerald': {
        primaryColor: '#059669',
        headerBg: '#064e3b',
        accentColor: '#10b981',
        bodyBg: '#f0fdf4',
        cardBg: '#ffffff',
        textColor: '#0f172a',
        buttonTextColor: '#ffffff',
        footerTextColor: '#475569',
        borderColor: '#dcfce7',
        greetingColor: '#064e3b'
    },
    'crimson': {
        primaryColor: '#dc2626',
        headerBg: '#7f1d1d',
        accentColor: '#f43f5e',
        bodyBg: '#fff5f5',
        cardBg: '#ffffff',
        textColor: '#2d3748',
        buttonTextColor: '#ffffff',
        footerTextColor: '#718096',
        borderColor: '#fed7d7',
        greetingColor: '#7f1d1d'
    },
    'dark': {
        primaryColor: '#38bdf8',
        headerBg: '#0f172a',
        accentColor: '#64748b',
        bodyBg: '#0f172a',
        cardBg: '#1e293b',
        textColor: '#e2e8f0',
        buttonTextColor: '#0f172a',
        footerTextColor: '#94a3b8',
        borderColor: '#334155',
        greetingColor: '#38bdf8'
    }
};

/**
 * Lightweight, zero-dependency double-mustache template compiler
 */
function compileTemplateString(templateStr, payload) {
    if (!templateStr) return '';
    return templateStr.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
        const normalizedKey = key.trim();
        if (payload[normalizedKey] !== undefined) {
            return payload[normalizedKey];
        }
        // Snake case alternative
        const alternativeSnake = normalizedKey.replace(/([A-Z])/g, "_$1").toLowerCase();
        if (payload[alternativeSnake] !== undefined) {
            return payload[alternativeSnake];
        }
        // Camel case alternative
        const alternativeCamel = normalizedKey.replace(/_([a-z])/g, (m, letter) => letter.toUpperCase());
        if (payload[alternativeCamel] !== undefined) {
            return payload[alternativeCamel];
        }
        return match;
    });
}

/**
 * Loads a visual template designed by the admin from the shared database
 */
async function loadVisualTemplate(categoryName, keyName) {
    try {
        const [rows] = await db.query(
            `SELECT * FROM email_templates 
             WHERE (template_type = ? OR template_key = ?) AND is_active = 1 
             LIMIT 1`,
            [categoryName, keyName]
        );
        if (rows.length > 0) {
            const row = rows[0];
            return typeof row.template_config === 'string' ? JSON.parse(row.template_config) : row.template_config;
        }
    } catch (err) {
        console.error(`[emailService] Failed to load visual template:`, err.message);
    }
    return null;
}

/**
 * Formulate client-safe responsive visual HTML based on active template configurations
 */
function compileVisualTemplate(config, payload) {
    const themeKey = config.theme || 'university-blue';
    const theme = THEMES[themeKey] || THEMES['university-blue'];
    
    const logoUrl = config.logo 
        ? (config.logo.startsWith('http') ? config.logo : `http://localhost:5000${config.logo}`)
        : 'http://localhost:5000/uploads/settings/pu_logo.png';

    const subject = compileTemplateString(config.subject, payload);
    const greeting = compileTemplateString(config.greeting, payload);
    const rawMessage = compileTemplateString(config.message, payload);
    const buttonText = compileTemplateString(config.buttonText, payload);
    const buttonUrl = compileTemplateString(config.buttonUrl, payload);
    const footer = compileTemplateString(config.footer, payload);

    const buttonHtml = (buttonUrl && buttonText) ? `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px; margin-bottom: 30px;">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td align="center" bgcolor="${theme.primaryColor}" style="border-radius: 6px;">
                                <a href="${buttonUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: bold; color: ${theme.buttonTextColor}; text-decoration: none; border-radius: 6px; letter-spacing: 0.5px;">
                                    ${buttonText}
                                </a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    ` : '';

    const formattedMessage = rawMessage 
        ? rawMessage.split('\n').map(p => p.trim() ? `<p style="margin-top: 0; margin-bottom: 16px; font-size: 15px; line-height: 1.6; color: ${theme.textColor};">${p}</p>` : '').join('')
        : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${subject}</title>
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
        @media screen and (max-width: 600px) {
            .email-container { width: 100% !important; max-width: 100% !important; padding: 10px !important; }
            .body-padding { padding: 24px !important; }
            .header-padding { padding: 24px 16px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${theme.bodyBg}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <center style="width: 100%; background-color: ${theme.bodyBg};">
        <div style="display: none; font-size: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
            ${subject}
        </div>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" height="100%" bgcolor="${theme.bodyBg}">
            <tr>
                <td align="center" valign="top" style="padding: 40px 10px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; background-color: ${theme.cardBg}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid ${theme.borderColor};">
                        <tr>
                            <td align="center" valign="top" bgcolor="${theme.headerBg}" class="header-padding" style="padding: 35px 40px; border-bottom: 4px solid ${theme.accentColor};">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td align="center" style="padding-bottom: 15px;">
                                            <img src="${logoUrl}" alt="University Logo" width="65" height="65" style="display: block; width: 65px; height: 65px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="font-family: 'Inter', Arial, sans-serif; color: #ffffff;">
                                            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; line-height: 1.2;">
                                                Periyar University
                                            </h1>
                                            <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: 600; color: #cbd5e1; letter-spacing: 0.5px; text-transform: uppercase;">
                                                Ph.D. Admission & Research Portal
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td align="left" valign="top" class="body-padding" style="padding: 40px; background-color: ${theme.cardBg};">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="padding-bottom: 20px; font-family: 'Inter', Arial, sans-serif;">
                                            <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: ${theme.greetingColor};">
                                                ${greeting}
                                            </h2>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: ${theme.textColor};">
                                            ${formattedMessage}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            ${buttonHtml}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td align="center" valign="top" style="padding: 30px 40px; background-color: ${theme.bodyBg}; border-top: 1px solid ${theme.borderColor}; font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: ${theme.footerTextColor}; line-height: 1.5;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td align="center" style="padding-bottom: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                            ${footer}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 15px;">
                                            Periyar Palkalai Nagar, Salem - 636 011, Tamil Nadu, India.<br>
                                            Ph.D. Academic Advisory Secretariat
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="font-size: 11px; color: ${theme.footerTextColor}; opacity: 0.8;">
                                            This is an official system transmission dispatched securely from the research admission gateway. Please do not reply directly to this mailbox.
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </center>
</body>
</html>`;
    return html;
}

// ─── Core send helper (Now Enqueues via Outbox Pattern) ───────────

/**
 * Enqueues an email into the database-backed worker queue.
 * Returns { success, enqueued: true }.
 * Never throws — all errors are caught and logged.
 */
async function sendEmail({ to, subject, html, text, template }) {
  if (!FROM_ADDRESS) {
    logFailed(to, subject, 'MAIL_USER / MAIL_FROM not configured', template);
    return { success: false, error: 'Mail not configured' };
  }
  try {
    await db.query(`
      INSERT INTO email_queue (to_email, subject, html_body, text_body, template_name, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [to, subject, html, text || '', template || 'general']);
    
    return { success: true, enqueued: true };
  } catch (err) {
    logFailed(to, subject, err.message, template);
    return { success: false, error: err.message };
  }
}

/**
 * Automatically creates necessary email tables and seeds standard Periyar University templates
 */
async function ensureDefaultTemplates() {
  try {
    // 1. Create email_templates table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_key VARCHAR(100) UNIQUE NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        template_type VARCHAR(100) NOT NULL,
        template_config JSON NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create email_template_types table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_template_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type_name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ email_templates & email_template_types tables verified/created successfully!');

    // 3. Define standard templates
    const defaultTemplates = [
      {
        key: 'welcome',
        name: 'Welcome Template',
        type: 'Welcome & Account Activation',
        config: {
          subject: 'Welcome to Periyar University PhD Portal — Account Activated!',
          greeting: 'Dear {{studentName}},',
          message: 'Congratulations! Your account has been successfully created on the Periyar University Ph.D. Admission and Research Portal.\n\nYour Application ID is: {{applicationId}}.\n\nPlease keep this ID safe as it will be used for all future correspondence, exam hall ticket downloads, and fee payments.',
          buttonText: 'Log In to Student Dashboard',
          buttonUrl: '{{loginUrl}}',
          theme: 'university-blue',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      },
      {
        key: 'otp_verification',
        name: 'OTP Verification Template',
        type: 'OTP Verification',
        config: {
          subject: 'Your Security Verification OTP — Periyar University PhD Portal',
          greeting: 'Dear {{studentName}},',
          message: 'Your One-Time Password (OTP) for verification is:\n\n{{otp}}\n\nThis security code is confidential. It is valid for {{expiresInMinutes}} minutes. Please do not share this OTP with anyone.',
          buttonText: '',
          buttonUrl: '',
          theme: 'university-blue',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      },
      {
        key: 'password_reset',
        name: 'Password Reset Template',
        type: 'Password Reset Link',
        config: {
          subject: 'Reset Your Password — Periyar University PhD Portal',
          greeting: 'Dear {{studentName}},',
          message: 'You have requested to reset your password for the Ph.D. Admission Portal.\n\nPlease click the button below to set a new password. This reset link is secure and will expire in {{expiresInHours}} hour(s).',
          buttonText: 'Reset My Password',
          buttonUrl: '{{resetUrl}}',
          theme: 'university-blue',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      },
      {
        key: 'application_submitted',
        name: 'Application Submitted Template',
        type: 'Application Submission Confirmation',
        config: {
          subject: 'Ph.D. Application Submitted Successfully — {{applicationId}}',
          greeting: 'Dear {{studentName}},',
          message: 'We are pleased to inform you that your Ph.D. application has been submitted successfully.\n\nApplication ID: {{applicationId}}\nDepartment: {{department}}\nSubmitted At: {{submittedAt}}\n\nYour application will now be verified by the university committee. You can check the real-time status of your application anytime via the portal.',
          buttonText: 'Track Application Status',
          buttonUrl: '{{portalUrl}}',
          theme: 'university-blue',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      },
      {
        key: 'application_approved',
        name: 'Application Approved Template',
        type: 'Application Approved Update',
        config: {
          subject: 'Ph.D. Application Approved — {{applicationId}} | Periyar University',
          greeting: 'Dear {{studentName}},',
          message: 'Great news! Your Ph.D. application has been reviewed and APPROVED by the academic committee.\n\nApplication ID: {{applicationId}}\nDepartment: {{department}}\n\n{{message}}\n\nPlease log in to the portal to proceed with further steps, verify your schedules, or pay any required fees.',
          buttonText: 'Proceed to Student Dashboard',
          buttonUrl: '{{actionUrl}}',
          theme: 'emerald',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      },
      {
        key: 'application_rejected',
        name: 'Application Rejected Template',
        type: 'Application Rejected Update',
        config: {
          subject: 'Academic Update: Ph.D. Application Status — {{applicationId}}',
          greeting: 'Dear {{studentName}},',
          message: 'Thank you for your interest in Periyar University. We regret to inform you that after careful review, your application has not been approved for the Ph.D. program in the department of {{department}}.\n\nReason/Remarks: {{message}}\n\nYou can review specific notes or apply for other available streams via the portal.',
          buttonText: 'View Details on Portal',
          buttonUrl: '{{actionUrl}}',
          theme: 'crimson',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      },
      {
        key: 'payment_confirmed',
        name: 'Payment Confirmed Template',
        type: 'Payment Confirmed Update',
        config: {
          subject: 'Payment Confirmed Successfully — {{applicationId}}',
          greeting: 'Dear {{studentName}},',
          message: 'This is to confirm that we have successfully received your payment for the Ph.D. Admission process.\n\nApplication ID: {{applicationId}}\nTransaction ID: {{transactionId}}\nAmount Paid: Rs. {{amount}}\n\nYour updated payment receipt is now available in your portal outbox/profile.',
          buttonText: 'Download Receipt',
          buttonUrl: '{{actionUrl}}',
          theme: 'emerald',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      },
      {
        key: 'hall_ticket',
        name: 'Hall Ticket Ready Template',
        type: 'Hall Ticket Generation Notification',
        config: {
          subject: 'Ph.D. Entrance Exam Hall Ticket Ready — {{applicationId}}',
          greeting: 'Dear {{studentName}},',
          message: 'Your official Entrance Exam Hall Ticket has been generated and is now ready for download.\n\nApplication ID: {{applicationId}}\nDepartment: {{department}}\n\nPlease download, print, and carry a physical copy of this hall ticket along with a valid photo ID to the examination venue. Candidates without a physical hall ticket will not be permitted to enter the exam hall.',
          buttonText: 'Download Hall Ticket Now',
          buttonUrl: '{{actionUrl}}',
          theme: 'university-blue',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      },
      {
        key: 'result_published',
        name: 'Result Published Template',
        type: 'Result Published Update',
        config: {
          subject: 'Entrance Exam Results Published — {{applicationId}}',
          greeting: 'Dear {{studentName}},',
          message: 'Your entrance examination marks and shortlist eligibility results have been published officially by the controller of examinations.\n\nApplication ID: {{applicationId}}\nDepartment: {{department}}\n\nPlease log in to the portal and view the results scorecard under the Results tab.',
          buttonText: 'View My Scorecard',
          buttonUrl: '{{actionUrl}}',
          theme: 'university-blue',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      },
      {
        key: 'admission_confirmation',
        name: 'Admission Confirmation Template',
        type: 'Admission Confirmation Announcement',
        config: {
          subject: 'Provisional Admission Confirmation Letter — {{applicationId}}',
          greeting: 'Dear {{studentName}},',
          message: 'Heartiest congratulations! We are pleased to inform you that you have been provisionally selected for admission to the Ph.D. program at Periyar University.\n\nApplication ID: {{applicationId}}\nDepartment: {{department}}\n\nPlease download your official provisional admission letter and complete the certificate verification process on or before the due date.',
          buttonText: 'Download Admission Letter',
          buttonUrl: '{{actionUrl}}',
          theme: 'emerald',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      },
      {
        key: 'interview_call',
        name: 'Interview Call Template',
        type: 'Interview Call',
        config: {
          subject: 'Ph.D. Interview Call Letter — {{applicationId}}',
          greeting: 'Dear {{studentName}},',
          message: 'We are pleased to inform you that you have been shortlisted for the Ph.D. interview in the department of {{department}}.\n\nApplication ID: {{applicationId}}\n\nPlease download your official interview call letter and report to the venue on time with all your original certificates and research proposals.',
          buttonText: 'Download Interview Call',
          buttonUrl: '{{actionUrl}}',
          theme: 'university-blue',
          footer: 'Office of PhD Admissions, Periyar University',
          logo: '/uploads/settings/pu_logo.png'
        }
      }
    ];

    // 4. Seed types into email_template_types and templates into email_templates
    for (const t of defaultTemplates) {
      // Seed category type
      try {
        await db.query(
          'INSERT IGNORE INTO email_template_types (type_name) VALUES (?)',
          [t.type]
        );
      } catch (err) {
        console.error(`[emailService] Failed to seed type name "${t.type}":`, err.message);
      }

      // Seed email template config if key not exists
      try {
        const [existing] = await db.query(
          'SELECT id FROM email_templates WHERE template_key = ? LIMIT 1',
          [t.key]
        );
        if (existing.length === 0) {
          await db.query(
            `INSERT INTO email_templates (template_key, template_name, template_type, template_config, is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [t.key, t.name, t.type, JSON.stringify(t.config), true]
          );
          console.log(`🌱 Seeded standard university template: ${t.key}`);
        }
      } catch (err) {
        console.error(`[emailService] Failed to seed template for key "${t.key}":`, err.message);
      }
    }

    // 5. Migrate existing seeded templates in DB to point to /uploads/settings/pu_logo.png
    try {
      const [allTemplates] = await db.query('SELECT id, template_config FROM email_templates');
      for (const row of allTemplates) {
        try {
          let config = typeof row.template_config === 'string' ? JSON.parse(row.template_config) : row.template_config;
          if (config && config.logo === '/uploads/logos/default-logo.png') {
            config.logo = '/uploads/settings/pu_logo.png';
            await db.query('UPDATE email_templates SET template_config = ? WHERE id = ?', [JSON.stringify(config), row.id]);
            console.log(`🧹 Migrated logo for template ID ${row.id} to pu_logo.png`);
          }
        } catch (e) {
          console.error(`[emailService] Migration failed for template ID ${row.id}:`, e.message);
        }
      }
    } catch (migErr) {
      console.error('[emailService] Could not complete database template migration:', migErr.message);
    }

  } catch (err) {
    console.error('❌ Failed to ensure default templates:', err.message);
  }
}

// Initialize/Seed standard templates on module boot
(async () => {
  try {
    await ensureDefaultTemplates();
  } catch (err) {
    console.error('Error seeding default templates:', err.message);
  }
})();

// ─── Welcome email ────────────────────────────────────────────────────────────

/**
 * Sent immediately after a student completes registration.
 */
async function sendWelcomeEmail({ to, studentName, applicationId, loginUrl }) {
  const payload = { studentName, applicationId, loginUrl, email: to };
  try {
    const visualConfig = await loadVisualTemplate('Welcome & Account Activation', 'welcome');
    if (visualConfig) {
      const html = compileVisualTemplate(visualConfig, payload);
      const subject = compileTemplateString(visualConfig.subject, payload) || `Welcome to Periyar University PhD Portal — Your Application ID: ${applicationId}`;
      return sendEmail({
        to,
        subject,
        html,
        text: `Welcome ${studentName}!\n\nYour application ${applicationId} is ready.\nLogin: ${loginUrl}`,
        template: 'welcome',
      });
    }
  } catch (err) {
    console.error(`[emailService] Welcome visual template compile failed, falling back to static:`, err.message);
  }

  // Fallback to static
  const html = welcomeTemplate(payload);
  return sendEmail({
    to,
    subject: `Welcome to Periyar University PhD Portal — Your Application ID: ${applicationId}`,
    html,
    text: `Welcome ${studentName}!\n\nYour application ${applicationId} is ready.\nLogin: ${loginUrl}`,
    template: 'welcome',
  });
}

// ─── OTP email ────────────────────────────────────────────────────────────────

/**
 * @param {'verification'|'login'|'reset'} purpose
 */
async function sendOTPEmail({ to, studentName, otp, purpose = 'verification', expiresInMinutes = 10 }) {
  const purposeLabels = {
    verification: 'Email Verification OTP',
    login:        'Login Verification OTP',
    reset:        'Password Reset OTP',
  };
  const payload = { studentName, otp, purpose, expiresInMinutes };
  try {
    const visualConfig = await loadVisualTemplate('OTP Verification', 'otp_verification');
    if (visualConfig) {
      const html = compileVisualTemplate(visualConfig, payload);
      const subject = compileTemplateString(visualConfig.subject, payload) || `${purposeLabels[purpose] || 'Your OTP'} — Periyar University PhD Portal`;
      return sendEmail({
        to,
        subject,
        html,
        text: `Hello ${studentName},\n\nYour OTP is: ${otp}\nValid for ${expiresInMinutes} minutes.\nDo not share this code.`,
        template: 'otp',
      });
    }
  } catch (err) {
    console.error(`[emailService] OTP visual template compile failed, falling back to static:`, err.message);
  }

  // Fallback to static
  const html = otpTemplate(payload);
  return sendEmail({
    to,
    subject: `${purposeLabels[purpose] || 'Your OTP'} — Periyar University PhD Portal`,
    html,
    text: `Hello ${studentName},\n\nYour OTP is: ${otp}\nValid for ${expiresInMinutes} minutes.\nDo not share this code.`,
    template: 'otp',
  });
}

// ─── Password-reset email ─────────────────────────────────────────────────────

async function sendPasswordResetEmail({ to, studentName, resetUrl, expiresInHours = 1 }) {
  const payload = { studentName, resetUrl, expiresInHours };
  try {
    const visualConfig = await loadVisualTemplate('Password Reset Link', 'password_reset');
    if (visualConfig) {
      const html = compileVisualTemplate(visualConfig, payload);
      const subject = compileTemplateString(visualConfig.subject, payload) || 'Reset Your Password — Periyar University PhD Portal';
      return sendEmail({
        to,
        subject,
        html,
        text: `Hello ${studentName},\n\nReset your password here:\n${resetUrl}\n\nThis link expires in ${expiresInHours} hour(s).`,
        template: 'password-reset',
      });
    }
  } catch (err) {
    console.error(`[emailService] Password reset visual template compile failed, falling back to static:`, err.message);
  }

  // Fallback to static
  const html = passwordResetTemplate(payload);
  return sendEmail({
    to,
    subject: 'Reset Your Password — Periyar University PhD Portal',
    html,
    text: `Hello ${studentName},\n\nReset your password here:\n${resetUrl}\n\nThis link expires in ${expiresInHours} hour(s).`,
    template: 'password-reset',
  });
}

// ─── Application submitted email ──────────────────────────────────────────────

async function sendApplicationSubmittedEmail({ to, studentName, applicationId, department, submittedAt, portalUrl }) {
  const payload = { studentName, applicationId, department, submittedAt, portalUrl };
  try {
    const visualConfig = await loadVisualTemplate('Application Submission Confirmation', 'application_submitted');
    if (visualConfig) {
      const html = compileVisualTemplate(visualConfig, payload);
      const subject = compileTemplateString(visualConfig.subject, payload) || `Application Submitted — ${applicationId} | Periyar University`;
      return sendEmail({
        to,
        subject,
        html,
        text: `Dear ${studentName},\n\nYour application ${applicationId} has been submitted successfully.\nDepartment: ${department || 'N/A'}\n\nPortal: ${portalUrl}`,
        template: 'application-submitted',
      });
    }
  } catch (err) {
    console.error(`[emailService] Application submitted visual template compile failed, falling back to static:`, err.message);
  }

  // Fallback to static
  const html = applicationSubmittedTemplate(payload);
  return sendEmail({
    to,
    subject: `Application Submitted — ${applicationId} | Periyar University`,
    html,
    text: `Dear ${studentName},\n\nYour application ${applicationId} has been submitted successfully.\nDepartment: ${department || 'N/A'}\n\nPortal: ${portalUrl}`,
    template: 'application-submitted',
  });
}

// ─── Application status email ─────────────────────────────────────────────────

/**
 * Covers: approved, rejected, payment_confirmed, hall_ticket.
 */
async function sendApplicationStatusEmail({
  to, studentName, applicationId, statusType,
  department, message, actionUrl, actionLabel,
  amount, transactionId,
}) {
  const subjectMap = {
    approved:          `Application Approved — ${applicationId} | Periyar University`,
    rejected:          `Application Status Update — ${applicationId} | Periyar University`,
    payment_confirmed: `Payment Confirmed — ${applicationId} | Periyar University`,
    hall_ticket:       `Hall Ticket Ready — ${applicationId} | Periyar University`,
  };

  const visualConfigMap = {
    approved:          { type: 'Application Approved Update', key: 'application_approved' },
    rejected:          { type: 'Application Rejected Update', key: 'application_rejected' },
    payment_confirmed: { type: 'Payment Confirmed Update', key: 'payment_confirmed' },
    hall_ticket:       { type: 'Hall Ticket Generation Notification', key: 'hall_ticket' },
  };

  const payload = {
    studentName, applicationId, statusType, department,
    message, actionUrl, actionLabel, amount, transactionId,
    actionUrl // interchangeable binding
  };

  const mapped = visualConfigMap[statusType];
  if (mapped) {
    try {
      const visualConfig = await loadVisualTemplate(mapped.type, mapped.key);
      if (visualConfig) {
        const html = compileVisualTemplate(visualConfig, payload);
        const subject = compileTemplateString(visualConfig.subject, payload) || (subjectMap[statusType] || `Application Update — ${applicationId} | Periyar University`);
        return sendEmail({
          to,
          subject,
          html,
          text: `Dear ${studentName},\n\nYour application ${applicationId} status: ${statusType.toUpperCase().replace('_', ' ')}.\n\nLogin to the portal for details: ${actionUrl}`,
          template: `status-${statusType}`,
        });
      }
    } catch (err) {
      console.error(`[emailService] Status visual template compile failed (${statusType}), falling back to static:`, err.message);
    }
  }

  // Fallback to static
  const html = applicationStatusTemplate(payload);
  return sendEmail({
    to,
    subject: subjectMap[statusType] || `Application Update — ${applicationId} | Periyar University`,
    html,
    text: `Dear ${studentName},\n\nYour application ${applicationId} status: ${statusType.toUpperCase().replace('_', ' ')}.\n\nLogin to the portal for details: ${actionUrl}`,
    template: `status-${statusType}`,
  });
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

const sendPaymentConfirmedEmail = ({ to, studentName, applicationId, amount, transactionId, actionUrl }) =>
  sendApplicationStatusEmail({ to, studentName, applicationId, statusType: 'payment_confirmed', amount, transactionId, actionUrl });

const sendHallTicketEmail = ({ to, studentName, applicationId, department, actionUrl }) =>
  sendApplicationStatusEmail({ to, studentName, applicationId, statusType: 'hall_ticket', department, actionUrl });

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendApplicationSubmittedEmail,
  sendApplicationStatusEmail,
  sendPaymentConfirmedEmail,
  sendHallTicketEmail,
};
