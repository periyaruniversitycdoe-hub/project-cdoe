/**
 * Enqueue an email into the email_queue table AND create an in-app notification.
 * @param {object} pool   mysql2 pool or connection
 * @param {object} params { to_email, subject, title, message, bodyHtml?, target_type, user_id, type }
 */
async function enqueueEmail(pool, { to_email, subject, title, message, bodyHtml, target_type = 'student', user_id = null, type = 'info' }) {
  try {
    const html = bodyHtml || `
      <div style="font-family: sans-serif; padding: 20px; color: #2c3e50; line-height: 1.6;">
        <h2 style="color: #3498db;">${title}</h2>
        <div style="padding: 15px; background: #f8f9fa; border-left: 4px solid #3498db; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px;">${message}</p>
        </div>
        <p style="font-size: 14px; color: #7f8c8d;">This is an automated notification from the Periyar University PhD Portal.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #95a5a6;">Please do not reply to this email.</p>
      </div>
    `;

    // 1. Enqueue Physical Email
    await pool.execute(`
      INSERT INTO email_queue (to_email, subject, html_body, text_body, template_name, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [to_email, subject, html, message, 'portal_notification']);

    // 2. Create In-App Notification (If user_id provided)
    if (user_id) {
        await pool.execute(`
            INSERT INTO notifications (user_id, target_type, title, message, recipient_email, type, is_read)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `, [user_id, target_type, title, message, to_email, type]);
    }
  } catch (err) {
    console.error('[Notification] Failed to notify:', err.message);
  }
}

module.exports = { enqueueEmail };
