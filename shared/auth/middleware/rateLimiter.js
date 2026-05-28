'use strict';

// Zero-dependency memory-based rate limiter
const rateLimitMap = new Map();

/**
 * Creates a rate limiter middleware
 * @param {object} options
 * @param {number} options.max - Maximum requests allowed in the window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {string} options.message - Error message to return when rate limit is exceeded
 */
module.exports = function createRateLimiter({
  max = 5,
  windowMs = 15 * 60 * 1000, // 15 minutes default
  message = 'Too many attempts. Please try again after 15 minutes.'
} = {}) {
  // Periodically clean up expired IPs to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitMap.entries()) {
      const activeTimestamps = data.filter(t => now - t < windowMs);
      if (activeTimestamps.length === 0) {
        rateLimitMap.delete(ip);
      } else {
        rateLimitMap.set(ip, activeTimestamps);
      }
    }
  }, 10 * 60 * 1000).unref(); // Run every 10 minutes, unref to not block process exit

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, []);
    }

    const timestamps = rateLimitMap.get(ip);
    // Filter timestamps within the current window
    const activeTimestamps = timestamps.filter(t => now - t < windowMs);
    
    if (activeTimestamps.length >= max) {
      return res.status(429).json({
        success: false,
        message
      });
    }

    activeTimestamps.push(now);
    rateLimitMap.set(ip, activeTimestamps);
    next();
  };
};
