/**
 * Notification helper — write events to the notifications table.
 * Both `connection` (transaction-bound) and `pool` (auto-checkout) variants
 * are supported so callers inside and outside transactions can use this.
 */

/**
 * Insert a single notification for one user.
 * @param {object} conn  mysql2 connection OR pool
 * @param {number} userId
 * @param {string} title
 * @param {string} message
 * @param {string} type   info | success | warning | danger | payment | result | hall_ticket | counselling | direct_pass
 */
async function notifyUser(conn, userId, title, message, type = 'info') {
  try {
    await conn.execute(
      'INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)',
      [userId, title, message, type]
    );

    // Enterprise physical email integration (Outbox Pattern push -> EmailWorker parses later)
    if (['payment', 'success', 'hall_ticket', 'counselling'].includes(type) || title.toLowerCase().includes('approved') || title.toLowerCase().includes('confirmed')) {
      const [[user]] = await conn.execute('SELECT email, full_name, application_id FROM users WHERE id = ? LIMIT 1', [userId]);
      if (user && user.email) {
        // Enqueue physical email dynamically using general layout
        const emailHtml = `
          <div style="font-family: sans-serif; padding: 20px;">
            <h3>Hello ${user.full_name},</h3>
            <p>You have a new update regarding your application (<b>${user.application_id || 'N/A'}</b>):</p>
            <div style="padding: 15px; border-left: 4px solid #32c5d2; background: #f8f9fa; margin: 20px 0;">
                <h4 style="margin:0 0 10px 0; color: #2c3e50;">${title}</h4>
                <p style="margin:0; font-size:14px; color:#555;">${message}</p>
            </div>
            <p>Please log in to your portal to review action items.</p>
          </div>
        `;
        
        await conn.execute(`
          INSERT INTO email_queue (to_email, subject, html_body, text_body, template_name, status)
          VALUES (?, ?, ?, ?, ?, 'pending')
        `, [user.email, `Application Update: ${title}`, emailHtml, message, 'admin_notification']);
      }
    }
  } catch (_) {
    // Non-critical — never break the main flow
  }
}

/**
 * Insert the same notification for multiple users in one query.
 * @param {object} conn   mysql2 connection OR pool
 * @param {number[]} userIds
 * @param {string} title
 * @param {string} message
 * @param {string} type
 */
async function notifyBulk(conn, userIds, title, message, type = 'info') {
  if (!userIds || userIds.length === 0) return;
  try {
    const placeholders = userIds.map(() => '(?, ?, ?, ?, 0)').join(', ');
    const values = userIds.flatMap(uid => [uid, title, message, type]);
    await conn.execute(
      `INSERT INTO notifications (user_id, title, message, type, is_read) VALUES ${placeholders}`,
      values
    );

    // Enterprise physical email integration for Bulk
    if (['payment', 'success', 'hall_ticket', 'counselling'].includes(type) || title.toLowerCase().includes('approved') || title.toLowerCase().includes('confirmed')) {
      const qPlaceholders = userIds.map(() => '?').join(',');
      const [users] = await conn.execute(`SELECT email, full_name, application_id FROM users WHERE id IN (${qPlaceholders})`, userIds);
      
      for (const user of users) {
        if (!user.email) continue;
        const emailHtml = `
          <div style="font-family: sans-serif; padding: 20px;">
            <h3>Hello ${user.full_name},</h3>
            <p>You have a new bulk update regarding your application (<b>${user.application_id || 'N/A'}</b>):</p>
            <div style="padding: 15px; border-left: 4px solid #32c5d2; background: #f8f9fa; margin: 20px 0;">
                <h4 style="margin:0 0 10px 0; color: #2c3e50;">${title}</h4>
                <p style="margin:0; font-size:14px; color:#555;">${message}</p>
            </div>
            <p>Please log in to your portal to review.</p>
          </div>
        `;
        await conn.execute(`
          INSERT INTO email_queue (to_email, subject, html_body, text_body, template_name, status)
          VALUES (?, ?, ?, ?, ?, 'pending')
        `, [user.email, `Application Update: ${title}`, emailHtml, message, 'admin_notification']);
      }
    }
  } catch (_) {}
}

module.exports = { notifyUser, notifyBulk };
