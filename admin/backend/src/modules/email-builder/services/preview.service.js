const HtmlGeneratorService = require('./htmlGenerator.service');

const MOCK_PREVIEW_DATA = {
    student_name: 'Arun Kumar',
    application_no: 'APP-2026-8942',
    department: 'Computer Science & Engineering',
    supervisor_name: 'Dr. M. Srinivasan, F.N.A.Sc.',
    interview_date: 'June 15, 2026',
    interview_time: '10:30 AM',
    venue: 'Ramanujan Block Seminar Hall',
    otp: '738495'
};

class PreviewService {
    /**
     * Accepts a template configuration, generates the live HTML,
     * injects mock variables, and compiles for previewing.
     * @param {object} templateConfig 
     * @returns {string} Compiled HTML page
     */
    static renderPreview(templateConfig) {
        // 1. Generate standard HTML layout (containing {{student_name}}, etc.)
        const rawTemplateHtml = HtmlGeneratorService.generateTemplateHtml(templateConfig);
        
        // 2. Compile it using mock data for visual simulation
        return HtmlGeneratorService.compileHtml(rawTemplateHtml, MOCK_PREVIEW_DATA);
    }
}

module.exports = PreviewService;
