const path = require('path');
const fs = require('fs');
const db = require('../../../../config/db'); // Using existing db pool
const { transporter } = require('./transporter.service');
const { compileTemplate } = require('../utils/handlebars.util');

async function getLogoDetails() {
    try {
        const [rows] = await db.execute('SELECT logo_url FROM university_settings LIMIT 1');
        if (rows.length > 0 && rows[0].logo_url) {
            const relativePath = rows[0].logo_url; // e.g. /uploads/settings/...
            // Resolves to admin/backend/uploads/settings/...
            const absolutePath = path.join(__dirname, '../../../../', relativePath);
            if (fs.existsSync(absolutePath)) {
                return {
                    path: absolutePath,
                    filename: path.basename(absolutePath)
                };
            }
            // Fallback to student backend uploads/settings folder if not found in admin folder
            const fallbackPath = path.join(__dirname, '../../../../../../student/backend', relativePath);
            if (fs.existsSync(fallbackPath)) {
                return {
                    path: fallbackPath,
                    filename: path.basename(fallbackPath)
                };
            }
        }
    } catch (err) {
        console.error('[LogoDetails] Failed to retrieve logo from settings, falling back:', err.message);
    }
    // Fallback to default pu_logo in student/backend/uploads/settings/
    const defaultLogoPath = path.join(__dirname, '../../../../../../student/backend/uploads/settings/pu_logo.png');
    return {
        path: defaultLogoPath,
        filename: 'pu_logo.png'
    };
}

/**
 * Core dynamic email sending service
 */
const sendDynamicEmail = async ({ serviceKey, to, variables }) => {
    try {
        // 1. Fetch Service Configuration from DB (Mapped to unified email_templates)
        const [templates] = await db.execute(
            'SELECT * FROM email_templates WHERE template_key = ? AND is_active = 1 LIMIT 1',
            [serviceKey]
        );

        if (templates.length === 0) {
            throw new Error(`Email service [${serviceKey}] not found or inactive`);
        }

        const templateRow = templates[0];
        let config = {};
        try {
            config = typeof templateRow.template_config === 'string' ? JSON.parse(templateRow.template_config) : (templateRow.template_config || {});
        } catch (e) {
            config = {};
        }

        const service = {
            service_key: templateRow.template_key,
            service_name: templateRow.template_name,
            email_subject: config.subject || '',
            email_template: config.message || ''
        };

        // 2. Compile Template & Subject
        let htmlBody = compileTemplate(service.email_template, variables);
        const subject = compileTemplate(service.email_subject, variables);

        let attachments = [];
        if (htmlBody) {
            const logoDetails = await getLogoDetails();

            // 1. Replace src that looks like a settings/logos upload path containing logo/logo2/pu_logo/default-logo
            htmlBody = htmlBody.replace(
                /src=["'](?:https?:\/\/[^"']*)?\/uploads\/(?:logos|settings)\/[^"']*\b(?:logo|logo2|pu_logo|default-logo)[^"']*["']/gi,
                'src="cid:pu_logo"'
            );

            // 2. Replace src of any image with alt="University Logo" if it wasn't already caught (both alt-first and src-first configurations)
            htmlBody = htmlBody.replace(
                /(<img[^>]*\bsrc=["'])([^"']*)(["'][^>]*\balt=["']University Logo["'])/gi,
                `$1cid:pu_logo$3`
            );
            htmlBody = htmlBody.replace(
                /(<img[^>]*\balt=["']University Logo["'][^>]*\bsrc=["'])([^"']*)(["'])/gi,
                `$1cid:pu_logo$3`
            );

            if (htmlBody.includes('cid:pu_logo') && fs.existsSync(logoDetails.path)) {
                attachments.push({
                    filename: logoDetails.filename,
                    path: logoDetails.path,
                    cid: 'pu_logo'
                });
            }
        }

        // 3. Send via Nodemailer
        try {
            const info = await transporter.sendMail({
                from: `"${process.env.MAIL_FROM_NAME || 'Periyar University'}" <${process.env.SMTP_USER}>`,
                to,
                subject,
                html: htmlBody,
                attachments: attachments.length > 0 ? attachments : undefined
            });

            // 4. Log Success
            await db.execute(
                'INSERT INTO email_logs (service_key, recipient_email, email_subject, status) VALUES (?, ?, ?, ?)',
                [serviceKey, to, subject, 'success']
            );

            return { success: true, messageId: info.messageId };
        } catch (mailError) {
            // 5. Log Failure
            await db.execute(
                'INSERT INTO email_logs (service_key, recipient_email, email_subject, status, error_message) VALUES (?, ?, ?, ?, ?)',
                [serviceKey, to, subject, 'failed', mailError.message]
            );
            throw mailError;
        }
    } catch (error) {
        console.error(`[EmailService] Failed to send ${serviceKey}:`, error.message);
        throw error;
    }
};

/**
 * Fetches all email logs
 */
const getEmailLogs = async () => {
    const [logs] = await db.execute('SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 100');
    return logs;
};

module.exports = { sendDynamicEmail, getEmailLogs };
