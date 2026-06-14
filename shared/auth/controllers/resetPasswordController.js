'use strict';

const otpService = require('../services/otpService');
const emailService = require('../services/emailService');
const { validatePasswordComplexity } = require('../../security/passwordValidator');
const { hashPassword } = require('../../security/passwordHash');

/**
 * Controller to reset the password.
 * @param {object} db - Database pool
 * @param {string} portal - 'student' | 'admin' | 'supervisor' | 'center'
 * @param {object} bcrypt - Hashing library from host
 */
module.exports = function resetPasswordController(db, portal) {
  return async (req, res) => {
    const { email, password, confirmPassword } = req.body;

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields (email, password, and confirm password) are required.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation password do not match.'
      });
    }

    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ success: false, message: pwCheck.message });
    }

    try {
      // 1. Verify that the OTP was successfully validated for this email & portal
      const verified = await otpService.isOtpVerified(db, { email, portal });
      if (!verified) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You must verify your email with an OTP first.'
        });
      }

      // 2. Hash the password with argon2id
      const hashedPassword = await hashPassword(password);

      // 3. Update the password in the correct portal user table
      let updateQuery = '';
      let queryParams = [];

      switch (portal) {
        case 'student':
          updateQuery = 'UPDATE users SET password = ? WHERE email = ?';
          queryParams = [hashedPassword, email];
          break;
        case 'admin':
          updateQuery = 'UPDATE users SET password = ? WHERE email = ? AND role = "admin"';
          queryParams = [hashedPassword, email];
          break;
        case 'supervisor':
          updateQuery = 'UPDATE supervisor_users SET password = ? WHERE email = ?';
          queryParams = [hashedPassword, email];
          break;
        case 'center':
          updateQuery = 'UPDATE center_users SET password = ? WHERE email = ?';
          queryParams = [hashedPassword, email];
          break;
        default:
          return res.status(500).json({
            success: false,
            message: 'Invalid portal configuration.'
          });
      }

      const [result] = await db.query(updateQuery, queryParams);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'User account not found.'
        });
      }

      // 4. Clear the OTP entry so it cannot be reused
      await otpService.clearOtp(db, { email, portal });

      // 5. Send password changed confirmation email (non-blocking)
      emailService.sendPasswordChangedEmail({ email, portalName: portal }).catch(err => {
        console.error('[Reset Password] Failed to send confirmation email:', err);
      });

      // 6. Log password change to credential_logs (non-blocking)
      const credSvc = require('../../credential/credentialNotificationService');
      const ptMap = { student: 'Student', admin: 'Admin', supervisor: 'Supervisor', center: 'Center' };
      credSvc.notifyPasswordChange({
        db,
        email,
        newPassword: password,
        portalType: ptMap[portal] || 'Student',
        ipAddress: req.ip,
      }).catch(() => {});

      // 7. Notify admin of password reset (non-blocking, skip admin self-reset)
      if (portal !== 'admin') {
        const labelMap = { student: 'Student', supervisor: 'Supervisor', center: 'Centre' };
        const label = labelMap[portal] || portal;
        const { notifyAdminDB } = require('../../notification/notifyAdminDB');
        notifyAdminDB(db, {
          event_key:   `${portal}.password_reset`,
          title:       `Password Reset — ${label}`,
          message:     `${label} account (${email}) successfully reset their password.`,
          type:        'info',
          source_type: 'password_reset',
          link:        '/credential-management',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Your password has been reset successfully. You can now login with your new password.'
      });
    } catch (err) {
      console.error(`[Reset Password Controller - ${portal}] Error:`, err);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while resetting your password. Please try again.'
      });
    }
  };
};
