const Handlebars = require('handlebars');

/**
 * Compiles a template string with provided variables.
 * @param {string} templateString - The Handlebars template string
 * @param {object} variables - Key-value pairs for replacement
 * @returns {string} - Compiled HTML
 */
const compileTemplate = (templateString, variables) => {
    try {
        const template = Handlebars.compile(templateString);
        return template(variables);
    } catch (error) {
        console.error('[Handlebars] Compilation Error:', error.message);
        throw new Error('Failed to compile email template');
    }
};

module.exports = { compileTemplate };
