'use strict';

/**
 * Returns a safe error message for API responses.
 * In production: always returns a generic string (no internal details leaked).
 * In development: returns the actual error message for easier debugging.
 */
function safeError(err, fallback = 'Internal server error') {
    if (process.env.NODE_ENV === 'production') return fallback;
    return (err && err.message) ? err.message : fallback;
}

module.exports = { safeError };
