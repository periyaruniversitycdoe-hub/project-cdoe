'use strict';

const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { transporter } = require('../config/mailConfig');
const { logSent, logFailed } = require('../utils/emailLogger');

const FROM_NAME    = process.env.MAIL_FROM_NAME || 'Periyar University PhD Portal';
const FROM_ADDRESS = process.env.MAIL_FROM      || process.env.SMTP_FROM || process.env.MAIL_USER || process.env.SMTP_USER;
const FROM         = `"${FROM_NAME}" <${FROM_ADDRESS}>`;

async function getLogoDetails() {
    try {
        const [rows] = await db.query('SELECT logo_url FROM university_settings LIMIT 1');
        if (rows.length > 0 && rows[0].logo_url) {
            const relativePath = rows[0].logo_url; // e.g. /uploads/settings/1779422827424-logo.png
            const absolutePath = path.join(__dirname, '../', relativePath);
            if (fs.existsSync(absolutePath)) {
                return {
                    path: absolutePath,
                    filename: path.basename(absolutePath)
                };
            }
        }
    } catch (err) {
        console.error('[EmailWorker] Failed to read logo from settings, falling back to default:', err.message);
    }
    
    // Default fallback to pu_logo.png
    const defaultLogoPath = path.join(__dirname, '../uploads/settings/pu_logo.png');
    return {
        path: defaultLogoPath,
        filename: 'pu_logo.png'
    };
}

class EmailWorker {
    constructor(pollIntervalMs = 5000) {
        this.pollIntervalMs = pollIntervalMs;
        this.isRunning = false;
        this.intervalId = null;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`[EmailWorker] Started polling every ${this.pollIntervalMs}ms`);
        this.intervalId = setInterval(() => this.processQueue(), this.pollIntervalMs);
        // Process immediately on start
        this.processQueue();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[EmailWorker] Stopped');
    }

    async processQueue() {
        try {
            // Find one pending email to process
            const [rows] = await db.query(`
                SELECT * FROM email_queue 
                WHERE status = 'pending' OR (status = 'failed' AND retries < 3) 
                ORDER BY created_at ASC LIMIT 1
            `);

            if (rows.length === 0) return; // Queue empty

            const emailJob = rows[0];

            // Lock it atomically so other workers or threads don't grab it concurrently
            const [lockResult] = await db.query(`
                UPDATE email_queue 
                SET status = 'processing', updated_at = NOW() 
                WHERE id = ? AND (status = 'pending' OR (status = 'failed' AND retries < 3))
            `, [emailJob.id]);

            if (lockResult.affectedRows === 0) {
                // Job already acquired by another worker instance
                return;
            }

            try {
                if (!FROM_ADDRESS) throw new Error('MAIL_USER / MAIL_FROM not configured in .env');

                let html = emailJob.html_body;
                let attachments = [];

                if (html) {
                    const logoDetails = await getLogoDetails();
                    
                    // 1. Replace src that looks like a settings/logos upload path containing logo/logo2/pu_logo/default-logo
                    html = html.replace(
                        /src=["'](?:https?:\/\/[^"']*)?\/uploads\/(?:logos|settings)\/[^"']*\b(?:logo|logo2|pu_logo|default-logo)[^"']*["']/gi,
                        'src="cid:pu_logo"'
                    );
                    
                    // 2. Replace src of any image with alt="University Logo" if it wasn't already caught (both alt-first and src-first configurations)
                    html = html.replace(
                        /(<img[^>]*\bsrc=["'])([^"']*)(["'][^>]*\balt=["']University Logo["'])/gi,
                        `$1cid:pu_logo$3`
                    );
                    html = html.replace(
                        /(<img[^>]*\balt=["']University Logo["'][^>]*\bsrc=["'])([^"']*)(["'])/gi,
                        `$1cid:pu_logo$3`
                    );

                    if (html.includes('cid:pu_logo') && fs.existsSync(logoDetails.path)) {
                        attachments.push({
                            filename: logoDetails.filename,
                            path: logoDetails.path,
                            cid: 'pu_logo'
                        });
                    }
                }

                const info = await transporter.sendMail({
                    from: FROM,
                    to: emailJob.to_email,
                    subject: emailJob.subject,
                    html: html,
                    text: emailJob.text_body,
                    attachments: attachments.length > 0 ? attachments : undefined
                });

                // Completed
                await db.query(`UPDATE email_queue SET status = 'completed', updated_at = NOW() WHERE id = ?`, [emailJob.id]);
                
                // Write success entry to email_logs for Admin Telemetry
                try {
                    await db.query(
                        'INSERT INTO email_logs (service_key, recipient_email, email_subject, status) VALUES (?, ?, ?, ?)',
                        [emailJob.template_name || 'general', emailJob.to_email, emailJob.subject, 'success']
                    );
                } catch (logErr) {
                    console.error('[EmailWorker] Failed to write success log to email_logs:', logErr.message);
                }

                logSent(emailJob.to_email, emailJob.subject, info.messageId, emailJob.template_name);
                console.log(`[EmailWorker] Sent email ID ${emailJob.id} to ${emailJob.to_email}`);
            } catch (err) {
                // Failed — Increment retries
                const errorStr = (err.message || 'Unknown error').substring(0, 500);
                await db.query(`
                    UPDATE email_queue 
                    SET status = 'failed', retries = retries + 1, error_log = ?, updated_at = NOW() 
                    WHERE id = ?
                `, [errorStr, emailJob.id]);
                
                // Write failure entry to email_logs for Admin Telemetry
                try {
                    await db.query(
                        'INSERT INTO email_logs (service_key, recipient_email, email_subject, status, error_message) VALUES (?, ?, ?, ?, ?)',
                        [emailJob.template_name || 'general', emailJob.to_email, emailJob.subject, 'failed', errorStr]
                    );
                } catch (logErr) {
                    console.error('[EmailWorker] Failed to write failure log to email_logs:', logErr.message);
                }

                logFailed(emailJob.to_email, emailJob.subject, errorStr, emailJob.template_name);
                console.error(`[EmailWorker] Failed email ID ${emailJob.id}: ${errorStr}`);
            }
        } catch (dbErr) {
            // Db level error (e.g. pool exhausted) - fail silently so the application does not crash
        }
    }
}

module.exports = new EmailWorker();
