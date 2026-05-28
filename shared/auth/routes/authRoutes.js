'use strict';

const createRateLimiter = require('../middleware/rateLimiter');

// Import controllers
const forgotPasswordController = require('../controllers/forgotPasswordController');
const verifyOtpController = require('../controllers/verifyOtpController');
const resendOtpController = require('../controllers/resendOtpController');
const resetPasswordController = require('../controllers/resetPasswordController');

/**
 * Creates the auth routes router for the specified portal.
 * @param {object} express - Express library reference from host server
 * @param {object} db - Database pool reference for the portal
 * @param {string} portal - Portal identifier ('student' | 'admin' | 'supervisor' | 'center')
 * @param {object} bcrypt - Hashing library reference from host server
 * @returns {object} Express.Router
 */
module.exports = function createAuthRouter(express, db, portal, bcrypt) {
  const router = express.Router();

  if (!db || !portal) {
    throw new Error('[Shared Auth Routes] Database pool and portal identifier are required.');
  }

  // Rate limiters
  const forgotPasswordLimiter = createRateLimiter({
    max: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Too many password reset requests. Please try again after 15 minutes.'
  });

  const resendOtpLimiter = createRateLimiter({
    max: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Too many OTP resend attempts. Please try again after 15 minutes.'
  });

  const verifyOtpLimiter = createRateLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Too many OTP verification attempts. Please try again after 15 minutes.'
  });

  const resetPasswordLimiter = createRateLimiter({
    max: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Too many password reset attempts. Please try again after 15 minutes.'
  });

  // Define endpoints
  router.post('/forgot-password', forgotPasswordLimiter, forgotPasswordController(db, portal));
  router.post('/verify-otp', verifyOtpLimiter, verifyOtpController(db, portal));
  router.post('/resend-otp', resendOtpLimiter, resendOtpController(db, portal));
  router.post('/reset-password', resetPasswordLimiter, resetPasswordController(db, portal, bcrypt));

  return router;
};
