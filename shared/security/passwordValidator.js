'use strict';

const MIN_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128; // prevents DoS via slow hash (argon2/bcrypt)
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

/**
 * Validates password complexity on the server side.
 * Returns { valid: true } or { valid: false, message: '...' }.
 */
function validatePasswordComplexity(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, message: 'Password is required.' };
    }
    if (password.length < MIN_LENGTH) {
        return { valid: false, message: `Password must be at least ${MIN_LENGTH} characters.` };
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
        return { valid: false, message: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters.` };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter.' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number.' };
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one special character.' };
    }
    return { valid: true };
}

/**
 * Validates email format and length.
 * Returns { valid: true } or { valid: false, message: '...' }.
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { valid: false, message: 'Email is required.' };
    }
    if (email.length > 320) {
        return { valid: false, message: 'Email address is too long.' };
    }
    if (!EMAIL_RE.test(email.trim())) {
        return { valid: false, message: 'Invalid email format.' };
    }
    return { valid: true };
}

/**
 * Validates login credentials (email format + password presence + max length).
 * Suitable for all login handlers — does NOT check complexity (that's for signup).
 */
function validateLoginInput(email, password) {
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) return emailCheck;
    if (!password || typeof password !== 'string') {
        return { valid: false, message: 'Password is required.' };
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
        return { valid: false, message: 'Invalid credentials.' }; // generic — don't reveal max length
    }
    return { valid: true };
}

module.exports = { validatePasswordComplexity, validateEmail, validateLoginInput };
