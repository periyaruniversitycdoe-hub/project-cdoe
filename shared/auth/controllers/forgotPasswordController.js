'use strict';

const otpService = require('../services/otpService');
const emailService = require('../services/emailService');

/**
 * Initiates the forgot password process by sending an OTP to the registered email.
 * @param {object} db - Database pool
 * @param {string} portal - 'student' | 'admin' | 'supervisor' | 'center'
 */
module.exports = function forgotPasswordController(db, portal) {
  return async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }

    try {
      // 1. Verify that the user exists in the correct portal user table
      let userQuery = '';
      let queryParams = [];

      switch (portal) {
        case 'student':
          userQuery = 'SELECT id FROM users WHERE email = ? LIMIT 1';
          queryParams = [email];
          break;
        case 'admin':
          userQuery = 'SELECT id FROM users WHERE email = ? AND role = "admin" LIMIT 1';
          queryParams = [email];
          break;
        case 'supervisor':
          userQuery = 'SELECT id FROM supervisor_users WHERE email = ? LIMIT 1';
          queryParams = [email];
          break;
        case 'center':
          userQuery = 'SELECT id FROM center_users WHERE email = ? LIMIT 1';
          queryParams = [email];
          break;
        default:
          return res.status(500).json({
            success: false,
            message: 'Invalid portal configuration.'
          });
      }

      const [users] = await db.query(userQuery, queryParams);

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'The email address is not registered in our system.'
        });
      }

      // 2. Generate and save the 4-digit OTP
      const otp = await otpService.generateOtp(db, { email, portal });

      // 3. Send the OTP email
      await emailService.sendOtpEmail({
        email,
        otp,
        portalName: portal,
        expiresIn: 5 // 5 minutes expiration
      });

      return res.status(200).json({
        success: true,
        message: 'A 4-digit OTP has been sent to your registered email address.'
      });
    } catch (err) {
      console.error(`[Forgot Password Controller - ${portal}] Error:`, err);
      try {
        await db.query(
          'INSERT INTO settings_audit_logs (action, field_name, new_value) VALUES (?, ?, ?)',
          [`Forgot Password Failure - ${portal}`, 'forgot_password_error', JSON.stringify({ message: err.message, stack: err.stack })]
        );
      } catch (dbErr) {
        console.error('Failed to log error to DB:', dbErr);
      }
      return res.status(500).json({
        success: false,
        message: `An error occurred: ${err.message}`
      });
    }
  };
};
