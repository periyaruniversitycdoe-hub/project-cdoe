import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(process.cwd(), '.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rsm_db',
  waitForConnections: true,
  connectionLimit: 5,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function getLogoDetails() {
  try {
    const [rows] = await pool.execute('SELECT logo_url FROM university_settings LIMIT 1');
    if (rows.length > 0 && rows[0].logo_url) {
      const relativePath = rows[0].logo_url; // e.g. /uploads/settings/1779422827424-logo.png
      // Resolves to student/backend/uploads/settings/...
      const absolutePath = path.join(__dirname, '../../../../student/backend', relativePath);
      if (fs.existsSync(absolutePath)) {
        return {
          path: absolutePath,
          filename: path.basename(absolutePath)
        };
      }
    }
  } catch (err) {
    console.error('[Worker] Failed to read logo from settings database, falling back:', err.message);
  }

  // Fallback to pu_logo.png in student/backend/uploads/settings/
  const defaultLogoPath = path.join(__dirname, '../../../../student/backend/uploads/settings/pu_logo.png');
  return {
    path: defaultLogoPath,
    filename: 'pu_logo.png'
  };
}

async function processQueue() {
  try {
    // 1. Fetch pending jobs
    const [jobs] = await pool.execute(`
      SELECT * FROM email_queue 
      WHERE status = 'pending' 
      OR (status = 'failed' AND retries < 3 AND updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
      ORDER BY created_at ASC LIMIT 5
    `);

    if (jobs.length === 0) return;

    for (const job of jobs) {
      console.log(`[Worker] Processing Job #${job.id} to ${job.to_email}`);
      
      // 2. Lock job atomically to prevent concurrent sending by other worker threads/processes
      const [lockResult] = await pool.execute(`
        UPDATE email_queue 
        SET status = "processing", updated_at = NOW() 
        WHERE id = ? AND status = "pending"
      `, [job.id]);

      if (lockResult.affectedRows === 0) {
        // Job already acquired by another worker instance
        continue;
      }

      try {
        let html = job.html_body;
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

        // 3. Send Email
        await transporter.sendMail({
          from: `"${process.env.MAIL_FROM_NAME || 'Periyar University'}" <${process.env.SMTP_USER}>`,
          to: job.to_email,
          subject: job.subject,
          html: html,
          text: job.text_body || '',
          attachments: attachments.length > 0 ? attachments : undefined
        });

        // 4. Mark Completed
        await pool.execute('UPDATE email_queue SET status = "completed", updated_at = NOW() WHERE id = ?', [job.id]);
        
        // Write success entry to email_logs for Admin Telemetry
        try {
          await pool.execute(
            'INSERT INTO email_logs (service_key, recipient_email, email_subject, status) VALUES (?, ?, ?, ?)',
            [job.template_name || 'general', job.to_email, job.subject, 'success']
          );
        } catch (logErr) {
          console.error('[Worker] Failed to write success log to email_logs:', logErr.message);
        }

        console.log(`[Worker] Job #${job.id} success.`);
      } catch (err) {
        // 5. Mark Failed
        console.error(`[Worker] Job #${job.id} failed:`, err.message);
        await pool.execute(`
          UPDATE email_queue 
          SET status = "failed", retries = retries + 1, error_log = ?, updated_at = NOW() 
          WHERE id = ?
        `, [err.message, job.id]);

        // Write failure entry to email_logs for Admin Telemetry
        try {
          await pool.execute(
            'INSERT INTO email_logs (service_key, recipient_email, email_subject, status, error_message) VALUES (?, ?, ?, ?, ?)',
            [job.template_name || 'general', job.to_email, job.subject, 'failed', err.message]
          );
        } catch (logErr) {
          console.error('[Worker] Failed to write failure log to email_logs:', logErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[Worker] Fatal error:', err.message);
  }
}

console.log('🚀 University Email Worker started...');
setInterval(processQueue, 10000); // 10s intervals
processQueue();
