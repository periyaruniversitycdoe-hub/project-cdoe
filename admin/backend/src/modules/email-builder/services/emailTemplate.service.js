const path = require('path');
const fs = require('fs');
const db = require('../../../../config/db'); // Using existing db pool
const EmailTemplateModel = require('../models/emailTemplate.model');
const PreviewService = require('./preview.service');
const HtmlGeneratorService = require('./htmlGenerator.service');
const { sendTransacEmail } = require('../../../../../../backend/src/services/emailService');

async function getLogoDetails() {
    try {
        const [rows] = await db.execute('SELECT logo_url FROM university_settings LIMIT 1');
        if (rows.length > 0 && rows[0].logo_url) {
            const relativePath = rows[0].logo_url; // e.g. /uploads/settings/...
            const absolutePath = path.join(__dirname, '../../../../', relativePath);
            if (fs.existsSync(absolutePath)) {
                return {
                    path: absolutePath,
                    filename: path.basename(absolutePath)
                };
            }
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
    const defaultLogoPath = path.join(__dirname, '../../../../../../student/backend/uploads/settings/pu_logo.png');
    return {
        path: defaultLogoPath,
        filename: 'pu_logo.png'
    };
}

class EmailTemplateService {
    static async getTemplates() {
        return await EmailTemplateModel.findAll();
    }

    static async getTemplateById(id) {
        return await EmailTemplateModel.findById(id);
    }

    static async getTemplateByKey(key) {
        return await EmailTemplateModel.findByKey(key);
    }

    static async createTemplate(data) {
        return await EmailTemplateModel.create(data);
    }

    static async updateTemplate(id, data) {
        return await EmailTemplateModel.update(id, data);
    }

    static async deleteTemplate(id) {
        return await EmailTemplateModel.delete(id);
    }

    static async toggleTemplate(id, is_active) {
        return await EmailTemplateModel.toggleActive(id, is_active);
    }

    /**
     * Sends a direct simulated SMTP email to a test address
     */
    static async sendTestEmail(targetEmail, templateConfig) {
        try {
            // 1. Compile final preview-grade email HTML using mock values
            let compiledHtml = PreviewService.renderPreview(templateConfig);
            
            // 2. Prepare text fallback
            const textFallback = `${templateConfig.greeting || 'Hello'}\n\n${templateConfig.message || ''}\n\n${templateConfig.footer || ''}`;
            
            let attachments = [];
            if (compiledHtml) {
                const logoDetails = await getLogoDetails();

                // 1. Replace src that looks like a settings/logos upload path containing logo/logo2/pu_logo/default-logo
                compiledHtml = compiledHtml.replace(
                    /src=["'](?:https?:\/\/[^"']*)?\/uploads\/(?:logos|settings)\/[^"']*\b(?:logo|logo2|pu_logo|default-logo)[^"']*["']/gi,
                    'src="cid:pu_logo"'
                );

                // 2. Replace src of any image with alt="University Logo" if it wasn't already caught (both alt-first and src-first configurations)
                compiledHtml = compiledHtml.replace(
                    /(<img[^>]*\bsrc=["'])([^"']*)(["'][^>]*\balt=["']University Logo["'])/gi,
                    `$1cid:pu_logo$3`
                );
                compiledHtml = compiledHtml.replace(
                    /(<img[^>]*\balt=["']University Logo["'][^>]*\bsrc=["'])([^"']*)(["'])/gi,
                    `$1cid:pu_logo$3`
                );

                if (compiledHtml.includes('cid:pu_logo') && fs.existsSync(logoDetails.path)) {
                    attachments.push({
                        filename: logoDetails.filename,
                        path: logoDetails.path,
                        cid: 'pu_logo'
                    });
                }
            }

            // 3 & 4. Dispatch email directly via Brevo
            const info = await sendTransacEmail({
                to: targetEmail,
                subject: `[TEST] ${templateConfig.subject || 'University Notification'}`,
                html: compiledHtml,
                text: textFallback,
                attachments: attachments.length > 0 ? attachments : undefined
            });

            // Write success entry to email_logs for Admin Telemetry
            try {
                await db.execute(
                    'INSERT INTO email_logs (service_key, recipient_email, email_subject, status) VALUES (?, ?, ?, ?)',
                    [`test_${templateConfig.service_key || 'general'}`, targetEmail, `[TEST] ${templateConfig.subject || 'University Notification'}`, 'success']
                );
            } catch (logErr) {
                console.error('[EmailTemplateService] Failed to write success log to email_logs:', logErr.message);
            }

            console.log(`[EmailBuilder] Test email successfully dispatched to ${targetEmail}. Message ID: ${info.messageId}`);
            return {
                success: true,
                messageId: info.messageId,
                response: info.response
            };
        } catch (err) {
            console.error('[EmailBuilder] Direct SMTP test email failed:', err.message);
            // Write failure entry to email_logs for Admin Telemetry
            try {
                await db.execute(
                    'INSERT INTO email_logs (service_key, recipient_email, email_subject, status, error_message) VALUES (?, ?, ?, ?, ?)',
                    [`test_${templateConfig?.service_key || 'general'}`, targetEmail, `[TEST] ${templateConfig?.subject || 'University Notification'}`, 'failed', err.message]
                );
            } catch (logErr) {
                console.error('[EmailTemplateService] Failed to write failure log to email_logs:', logErr.message);
            }
            throw new Error(`SMTP Dispatch Failed: ${err.message}`);
        }
    }
}

module.exports = EmailTemplateService;
