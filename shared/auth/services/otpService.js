'use strict';

/**
 * Service to handle OTP generation, validation, and lifecycle
 */

/**
 * Generates a random 4-digit OTP, deletes previous unexpired OTPs, and saves the new one.
 * @param {object} db - The database pool
 * @param {object} p
 * @param {string} p.email - Recipient email
 * @param {string} p.portal - Portal type ('student' | 'admin' | 'supervisor' | 'center')
 * @returns {Promise<string>} The generated OTP
 */
async function generateOtp(db, { email, portal }) {
  // Generate a random 4-digit number between 1000 and 9999
  const otp = String(Math.floor(1000 + Math.random() * 9000));
  
  // Expiry is 5 minutes from now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Use a transaction or sequential statements to delete existing OTPs and insert the new one
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Delete any existing OTP entries for this email and portal to prevent duplicates
    await conn.query(
      'DELETE FROM password_reset_otps WHERE email = ? AND portal = ?',
      [email, portal]
    );

    // 2. Insert new OTP
    await conn.query(
      'INSERT INTO password_reset_otps (email, portal, otp, expires_at) VALUES (?, ?, ?, ?)',
      [email, portal, otp, expiresAt]
    );

    await conn.commit();
    return otp;
  } catch (err) {
    await conn.rollback();
    console.error('[OTP Service] Generate OTP transaction failed:', err);
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Verifies if an OTP is valid, unexpired, and not exceeding attempt limits.
 * @param {object} db - The database pool
 * @param {object} p
 * @param {string} p.email - Recipient email
 * @param {string} p.portal - Portal type
 * @param {string} p.otp - Submitted OTP code
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function verifyOtp(db, { email, portal, otp }) {
  const [rows] = await db.query(
    'SELECT * FROM password_reset_otps WHERE email = ? AND portal = ? LIMIT 1',
    [email, portal]
  );

  if (rows.length === 0) {
    return { success: false, message: 'No active OTP found. Please request a new OTP.' };
  }

  const record = rows[0];

  // Check if already verified
  if (record.verified) {
    return { success: true, message: 'OTP already verified.' };
  }

  // Check if expired
  const now = new Date();
  if (new Date(record.expires_at) < now) {
    // Delete expired OTP
    await db.query('DELETE FROM password_reset_otps WHERE id = ?', [record.id]);
    return { success: false, message: 'OTP has expired. Please request a new one.' };
  }

  // Check failed attempts (brute force protection)
  if (record.attempts >= 5) {
    // Delete record on exceeding maximum attempts
    await db.query('DELETE FROM password_reset_otps WHERE id = ?', [record.id]);
    return { success: false, message: 'Too many incorrect attempts. This OTP has been invalidated. Please request a new one.' };
  }

  // Match OTP
  if (record.otp !== String(otp)) {
    // Increment attempts
    await db.query(
      'UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?',
      [record.id]
    );
    const remaining = 5 - (record.attempts + 1);
    return { 
      success: false, 
      message: `Incorrect OTP code. ${remaining} attempts remaining.` 
    };
  }

  // Successfully verified! Mark as verified
  await db.query(
    'UPDATE password_reset_otps SET verified = 1 WHERE id = ?',
    [record.id]
  );

  return { success: true, message: 'OTP verified successfully.' };
}

/**
 * Checks if a verified OTP exists for this email and portal (used before password reset).
 * @param {object} db - The database pool
 * @param {object} p
 * @param {string} p.email
 * @param {string} p.portal
 * @returns {Promise<boolean>}
 */
async function isOtpVerified(db, { email, portal }) {
  const [rows] = await db.query(
    'SELECT * FROM password_reset_otps WHERE email = ? AND portal = ? AND verified = 1 LIMIT 1',
    [email, portal]
  );

  if (rows.length === 0) {
    return false;
  }

  const record = rows[0];
  
  // Check if expired even if verified (additional layer of security)
  const now = new Date();
  if (new Date(record.expires_at) < now) {
    await db.query('DELETE FROM password_reset_otps WHERE id = ?', [record.id]);
    return false;
  }

  return true;
}

/**
 * Removes the OTP entry (called after password reset completes successfully).
 * @param {object} db - The database pool
 * @param {object} p
 * @param {string} p.email
 * @param {string} p.portal
 */
async function clearOtp(db, { email, portal }) {
  await db.query(
    'DELETE FROM password_reset_otps WHERE email = ? AND portal = ?',
    [email, portal]
  );
}

module.exports = {
  generateOtp,
  verifyOtp,
  isOtpVerified,
  clearOtp
};
