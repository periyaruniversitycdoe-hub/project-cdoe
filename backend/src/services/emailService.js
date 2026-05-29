'use strict';

const fs = require('fs');
const path = require('path');
const Brevo = require('@getbrevo/brevo');

// Load environment variables if not loaded
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const apiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || process.env.MAIL_USER || 'noreply@yourdomain.com';
const senderName = process.env.BREVO_SENDER_NAME || 'PhD Research Portal';

if (!apiKey) {
    console.warn('[Brevo Service] ⚠️ BREVO_API_KEY is not defined in environment variables. Email sending may fail.');
}

// Configure API key authorization: apiKey
const defaultClient = Brevo.ApiClient.instance;
const apiKeyAuth = defaultClient.authentications['api-key'];
if (apiKeyAuth) {
    apiKeyAuth.apiKey = apiKey;
}

const apiInstance = new Brevo.TransactionalEmailsApi();

/**
 * Sends a transactional email using Brevo HTTP API.
 * 
 * @param {object} opts
 * @param {string|string[]|object|object[]} opts.to - Recipient(s). Can be email string, array of email strings, or object/array of objects with {email, name}.
 * @param {string} opts.subject - Email subject.
 * @param {string} opts.html - HTML email content.
 * @param {string} [opts.text] - Plain text email content.
 * @param {object[]} [opts.attachments] - Array of attachments in Nodemailer-like format (containing path or content/filename).
 */
async function sendTransacEmail({ to, subject, html, text, attachments = [] }) {
    try {
        if (!apiKey) {
            throw new Error('BREVO_API_KEY is not configured in .env');
        }

        const sendSmtpEmail = new Brevo.SendSmtpEmail();
        
        // 1. Resolve recipients
        let toList = [];
        if (typeof to === 'string') {
            toList = [{ email: to }];
        } else if (Array.isArray(to)) {
            toList = to.map(item => {
                if (typeof item === 'string') return { email: item };
                if (item && typeof item === 'object') return { email: item.email, name: item.name };
                return null;
            }).filter(Boolean);
        } else if (to && typeof to === 'object') {
            toList = [{ email: to.email, name: to.name }];
        }

        if (toList.length === 0) {
            throw new Error('No valid recipients specified');
        }

        sendSmtpEmail.to = toList;
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;
        if (text) {
            sendSmtpEmail.textContent = text;
        }

        // Sender configuration
        sendSmtpEmail.sender = {
            email: senderEmail,
            name: senderName
        };

        // 2. Resolve attachments (Nodemailer compatibility layer)
        if (attachments && attachments.length > 0) {
            sendSmtpEmail.attachment = attachments.map(att => {
                // If direct content (base64 string) is supplied
                if (att.content && att.filename) {
                    return {
                        content: att.content,
                        name: att.filename
                    };
                }

                // If a local file path is specified, read and encode to base64
                if (att.path) {
                    try {
                        const resolvedPath = path.resolve(att.path);
                        if (fs.existsSync(resolvedPath)) {
                            const fileBuffer = fs.readFileSync(resolvedPath);
                            return {
                                content: fileBuffer.toString('base64'),
                                name: att.filename || path.basename(resolvedPath)
                            };
                        } else {
                            console.warn(`[Brevo Service] Attachment path not found: ${resolvedPath}`);
                        }
                    } catch (readErr) {
                        console.error(`[Brevo Service] Failed to read attachment file at ${att.path}:`, readErr.message);
                    }
                }

                // If a public URL is specified
                if (att.url) {
                    return {
                        url: att.url,
                        name: att.filename || path.basename(att.url)
                    };
                }

                return null;
            }).filter(Boolean);
        }

        console.log(`[Brevo Service] Dispatching email to: ${JSON.stringify(toList)} | Subject: "${subject}"`);
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        
        console.log(`[Brevo Service] ✅ Email successfully dispatched. Response:`, JSON.stringify(data));
        return {
            success: true,
            messageId: data.messageId || (data.body && data.body.messageId),
            response: data
        };
    } catch (err) {
        console.error(`[Brevo Service] ❌ Failed to send transactional email:`, err.message || err);
        if (err.response && err.response.body) {
            console.error(`[Brevo Service] API Error response body:`, JSON.stringify(err.response.body));
        }
        throw err;
    }
}

module.exports = {
    sendTransacEmail,
    apiKey,
    senderEmail,
    senderName
};
