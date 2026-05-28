'use strict';

const otpService = require('../services/otpService');

/**
 * Controller to verify the submitted OTP code.
 * @param {object} db - Database pool
 * @param {string} portal - 'student' | 'admin' | 'supervisor' | 'center'
 */
module.exports = function verifyOtpController(db, portal) {
  return async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Both email address and OTP code are required.'
      });
    }

    try {
      const result = await otpService.verifyOtp(db, { email, portal, otp });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (err) {
      console.error(`[Verify OTP Controller - ${portal}] Error:`, err);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while verifying the OTP. Please try again.'
      });
    }
  };
};
