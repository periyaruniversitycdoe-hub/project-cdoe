const { getInvalidVariables } = require('../utils/variableInsertion.util');

/**
 * Validates a URL cleanly
 * @param {string} urlStr 
 * @returns {boolean}
 */
const isValidUrl = (urlStr) => {
    if (!urlStr) return true; // Optional button URL is fine
    try {
        const url = new URL(urlStr);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
};

/**
 * Validate the template configuration and input fields
 */
const validateTemplate = (req, res, next) => {
    const isUpdate = req.method === 'PUT' || req.method === 'PATCH';
    const { template_key, template_name, template_type, template_config } = req.body;

    const errors = {};

    if (!isUpdate && !template_key) {
        errors.template_key = 'Template key identifier is required';
    } else if (!isUpdate && !/^[a-z0-9_-]+$/i.test(template_key)) {
        errors.template_key = 'Template key must be alphanumeric with underscores or hyphens';
    }

    if (!template_name) {
        errors.template_name = 'Template friendly name is required';
    }

    if (!template_type) {
        errors.template_type = 'Template type selection is required';
    }

    if (!template_config || typeof template_config !== 'object') {
        errors.template_config = 'Template configuration payload is required';
        return res.status(400).json({ success: false, errors });
    }

    const { subject, greeting, message, buttonText, buttonUrl, theme, footer } = template_config;

    if (!subject) {
        errors.subject = 'Subject line is required';
    } else {
        const badVars = getInvalidVariables(subject);
        if (badVars.length > 0) {
            errors.subject = `Unknown variable detected: {{${badVars.join(', ')}}}`;
        }
    }

    if (!greeting) {
        errors.greeting = 'Greeting text is required';
    } else {
        const badVars = getInvalidVariables(greeting);
        if (badVars.length > 0) {
            errors.greeting = `Unknown variable detected: {{${badVars.join(', ')}}}`;
        }
    }

    if (!message) {
        errors.message = 'Main message content is required';
    } else {
        const badVars = getInvalidVariables(message);
        if (badVars.length > 0) {
            errors.message = `Unknown variable detected: {{${badVars.join(', ')}}}`;
        }
    }

    if (buttonUrl) {
        if (!isValidUrl(buttonUrl)) {
            errors.buttonUrl = 'Button URL must be a valid HTTP or HTTPS address';
        }
        if (!buttonText) {
            errors.buttonText = 'Button text is required if a button URL is specified';
        }
    }

    if (buttonText) {
        const badVars = getInvalidVariables(buttonText);
        if (badVars.length > 0) {
            errors.buttonText = `Unknown variable detected: {{${badVars.join(', ')}}}`;
        }
    }

    if (footer) {
        const badVars = getInvalidVariables(footer);
        if (badVars.length > 0) {
            errors.footer = `Unknown variable detected: {{${badVars.join(', ')}}}`;
        }
    }

    const allowedThemes = ['university-blue', 'emerald', 'crimson', 'dark'];
    if (theme && !allowedThemes.includes(theme)) {
        errors.theme = 'Selected theme must be one of: university-blue, emerald, crimson, dark';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Template configuration validation failed',
            errors
        });
    }

    next();
};

/**
 * Validate preview payload specifically
 */
const validatePreviewPayload = (req, res, next) => {
    const { template_config } = req.body;
    if (!template_config || typeof template_config !== 'object') {
        return res.status(400).json({
            success: false,
            message: 'Template configuration payload is required for live preview'
        });
    }

    const { subject, greeting, message, buttonText, buttonUrl, theme, footer } = template_config;
    const errors = {};

    if (subject) {
        const badVars = getInvalidVariables(subject);
        if (badVars.length > 0) errors.subject = `Unknown variable: {{${badVars.join(', ')}}}`;
    }
    if (greeting) {
        const badVars = getInvalidVariables(greeting);
        if (badVars.length > 0) errors.greeting = `Unknown variable: {{${badVars.join(', ')}}}`;
    }
    if (message) {
        const badVars = getInvalidVariables(message);
        if (badVars.length > 0) errors.message = `Unknown variable: {{${badVars.join(', ')}}}`;
    }
    if (buttonUrl && !isValidUrl(buttonUrl)) {
        errors.buttonUrl = 'Must be a valid URL';
    }
    const allowedThemes = ['university-blue', 'emerald', 'crimson', 'dark'];
    if (theme && !allowedThemes.includes(theme)) {
        errors.theme = 'Theme must be: university-blue, emerald, crimson, dark';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    next();
};

module.exports = {
    validateTemplate,
    validatePreviewPayload
};
