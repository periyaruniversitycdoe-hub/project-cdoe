'use strict';

/**
 * Shared Joi validation schemas for all auth routes.
 * Use validateBody(schema) middleware to apply these in route handlers.
 */

const Joi = require('joi');

// ── Reusable field definitions ───────────────────────────────────────────────

const emailField = Joi.string()
    .email({ tlds: { allow: false } })
    .max(320)
    .required()
    .messages({
        'string.email':   'Invalid email format.',
        'string.max':     'Email address is too long.',
        'any.required':   'Email is required.',
    });

const passwordLoginField = Joi.string()
    .min(1)
    .max(128)
    .required()
    .messages({
        'string.max':   'Invalid credentials.',
        'any.required': 'Password is required.',
    });

const passwordSignupField = Joi.string()
    .min(8)
    .max(128)
    .pattern(/[A-Z]/, 'uppercase')
    .pattern(/[0-9]/, 'digit')
    .pattern(/[^A-Za-z0-9]/, 'special')
    .required()
    .messages({
        'string.min':          'Password must be at least 8 characters.',
        'string.max':          'Password must not exceed 128 characters.',
        'string.pattern.name': 'Password must contain at least one {#name} character.',
        'any.required':        'Password is required.',
    });

const nameField = Joi.string().min(2).max(200).required()
    .messages({ 'any.required': 'Name is required.' });

const mobileField = Joi.string().pattern(/^[0-9+\-\s()]{7,20}$/).optional().allow('', null);

const totpCodeField = Joi.string().pattern(/^\d{6}$/).required()
    .messages({ 'string.pattern.base': 'TOTP code must be exactly 6 digits.', 'any.required': 'TOTP code is required.' });

// ── Schemas ───────────────────────────────────────────────────────────────────

const loginSchema = Joi.object({
    email:    emailField,
    password: passwordLoginField,
}).unknown(false);

// Student login uses 'username' instead of 'email'
const studentLoginSchema = Joi.object({
    username: emailField,
    password: passwordLoginField,
}).unknown(false);

const signupSchema = Joi.object({
    name:     nameField,
    email:    emailField,
    password: passwordSignupField,
    mobile:   mobileField,
}).unknown(false);

const forgotPasswordSchema = Joi.object({
    email: emailField,
}).unknown(false);

const verifyOtpSchema = Joi.object({
    email: emailField,
    otp:   Joi.string().length(6).pattern(/^\d{6}$/).required(),
}).unknown(false);

const resetPasswordSchema = Joi.object({
    email:       emailField,
    otp:         Joi.string().length(6).pattern(/^\d{6}$/).required(),
    newPassword: passwordSignupField,
}).unknown(false);

const mfaValidateSchema = Joi.object({
    mfaToken:  Joi.string().required(),
    totpCode:  totpCodeField,
}).unknown(false);

const mfaSetupVerifySchema = Joi.object({
    totpCode: totpCodeField,
}).unknown(false);

// ── Middleware factory ────────────────────────────────────────────────────────

/**
 * Returns Express middleware that validates req.body against the given schema.
 * Responds 400 with the first validation error if invalid.
 */
function validateBody(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: true, stripUnknown: true });
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }
        req.body = value; // replace with sanitized/coerced values
        next();
    };
}

module.exports = {
    loginSchema, studentLoginSchema, signupSchema,
    forgotPasswordSchema, verifyOtpSchema, resetPasswordSchema,
    mfaValidateSchema, mfaSetupVerifySchema,
    validateBody,
};
