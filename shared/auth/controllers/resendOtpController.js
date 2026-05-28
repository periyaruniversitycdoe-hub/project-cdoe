'use strict';

const otpService = require('../services/otpService');
const emailService = require('../services/emailService');

/**
 * Controller to resend a new OTP.
 * @param {object} db - Database pool
 * @param {string} portal - 'student' | 'admin' | 'supervisor' | 'center'
 */
module.exports = function resendOtpController(db, portal) {
  return async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.'
      });
    }

    try {
      // 1. Verify user exists in correct table (safety precaution)
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

      // 2. Generate new 4-digit OTP (this deletes any prior OTP entries)
      const otp = await otpService.generateOtp(db, { email, portal });

      // 3. Send the OTP email
      await emailService.sendOtpEmail({
        email,
        otp,
        portalName: portal,
        expiresIn: 5
      });

      return res.status(200).json({
        success: true,
        message: 'A new 4-digit OTP code has been successfully resent to your email.'
      });
    } catch (err) {
      console.error(`[Resend OTP Controller - ${portal}] Error:`, err);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while resending the OTP. Please try again.'
      });
    }
  };
};
