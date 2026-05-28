/**
 * Variable Registry Utility for Visual Email Template System
 */

const ALLOWED_VARIABLES = [
    'student_name',
    'application_no',
    'department',
    'supervisor_name',
    'interview_date',
    'interview_time',
    'venue',
    'otp'
];

/**
 * Extract all Handlebars variables from a string
 * Matches patterns like {{variable_name}}
 * @param {string} text 
 * @returns {Array<string>}
 */
const extractVariables = (text) => {
    if (!text || typeof text !== 'string') return [];
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.map(m => m.replace(/\{\{|\}\}/g, '').trim());
};

/**
 * Validate that all variables used in text fields are supported.
 * Returns an array of invalid variables, or empty array if all are valid.
 * @param {string} text 
 * @returns {Array<string>}
 */
const getInvalidVariables = (text) => {
    const variables = extractVariables(text);
    return variables.filter(v => !ALLOWED_VARIABLES.includes(v));
};

module.exports = {
    ALLOWED_VARIABLES,
    extractVariables,
    getInvalidVariables
};
