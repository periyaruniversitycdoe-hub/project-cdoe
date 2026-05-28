const EmailTemplateService = require('../services/emailTemplate.service');
const EmailTemplateModel = require('../models/emailTemplate.model');
const PreviewService = require('../services/preview.service');
const path = require('path');
const fs = require('fs');

class EmailTemplateController {
    static async getTemplates(req, res) {
        try {
            const data = await EmailTemplateService.getTemplates();
            res.json({ success: true, data });
        } catch (error) {
            console.error('getTemplates Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getTemplateById(req, res) {
        try {
            const data = await EmailTemplateService.getTemplateById(req.params.id);
            if (!data) {
                return res.status(404).json({ success: false, message: 'Email template not found' });
            }
            res.json({ success: true, data });
        } catch (error) {
            console.error('getTemplateById Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async createTemplate(req, res) {
        try {
            const { template_key, template_name, template_type, template_config, is_active } = req.body;
            
            // Check for duplicate key
            const existing = await EmailTemplateService.getTemplateByKey(template_key);
            if (existing) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'A template with this key identifier already exists.' 
                });
            }

            const id = await EmailTemplateService.createTemplate({
                template_key,
                template_name,
                template_type,
                template_config,
                is_active: is_active !== false
            });

            res.status(201).json({ 
                success: true, 
                message: 'Visual email template created successfully', 
                id 
            });
        } catch (error) {
            console.error('createTemplate Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async updateTemplate(req, res) {
        try {
            const id = req.params.id;
            const existing = await EmailTemplateService.getTemplateById(id);
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Email template not found' });
            }

            const { template_name, template_type, template_config, is_active } = req.body;
            await EmailTemplateService.updateTemplate(id, {
                template_name,
                template_type,
                template_config,
                is_active: is_active !== false
            });

            res.json({ success: true, message: 'Visual email template updated successfully' });
        } catch (error) {
            console.error('updateTemplate Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async deleteTemplate(req, res) {
        try {
            const id = req.params.id;
            const existing = await EmailTemplateService.getTemplateById(id);
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Email template not found' });
            }

            await EmailTemplateService.deleteTemplate(id);
            res.json({ success: true, message: 'Email template deleted successfully' });
        } catch (error) {
            console.error('deleteTemplate Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Accepts a template configuration, generates the live HTML,
     * and returns the compiled preview markup
     */
    static renderPreview(req, res) {
        try {
            const { template_config } = req.body;
            const renderedHtml = PreviewService.renderPreview(template_config);
            res.json({ success: true, html: renderedHtml });
        } catch (error) {
            console.error('renderPreview Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Triggers a live test email using current form settings
     */
    static async sendTestEmail(req, res) {
        try {
            const { targetEmail, template_config } = req.body;
            if (!targetEmail) {
                return res.status(400).json({ success: false, message: 'Recipient target email is required' });
            }

            const result = await EmailTemplateService.sendTestEmail(targetEmail, template_config);
            res.json({ 
                success: true, 
                message: `Test email successfully dispatched to ${targetEmail}!`,
                data: result 
            });
        } catch (error) {
            console.error('sendTestEmail Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Handle university logo upload
     */
    static uploadLogo(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No image file uploaded' });
            }

            // Return the web accessible path
            const logoPath = `/uploads/logos/${req.file.filename}`;
            res.json({
                success: true,
                message: 'Logo uploaded successfully!',
                logoUrl: logoPath
            });
        } catch (error) {
            console.error('uploadLogo Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getCategories(req, res) {
        try {
            const customTypes = await EmailTemplateModel.getCustomTypes();
            res.json({ success: true, customTypes });
        } catch (error) {
            console.error('getCategories Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async addCategory(req, res) {
        try {
            const { type_name } = req.body;
            if (!type_name) {
                return res.status(400).json({ success: false, message: 'Category type name is required' });
            }
            const sanitized = type_name.trim();
            if (!sanitized) {
                return res.status(400).json({ success: false, message: 'Category type name cannot be blank' });
            }
            
            // Check if already exists in dynamic list or static list
            const staticTypes = [
                'Hall Ticket',
                'Result Published',
                'OTP',
                'Interview Call',
                'Admission Confirmation',
                'General Announcement'
            ];
            
            if (staticTypes.map(t => t.toLowerCase()).includes(sanitized.toLowerCase())) {
                return res.status(400).json({ success: false, message: 'This category type already exists as a default' });
            }

            const customTypes = await EmailTemplateModel.getCustomTypes();
            if (customTypes.map(t => t.toLowerCase()).includes(sanitized.toLowerCase())) {
                return res.status(400).json({ success: false, message: 'This category type already exists' });
            }

            await EmailTemplateModel.addCustomType(sanitized);

            // Automatically seed a default university-branded template for this custom category
            const routeKey = sanitized.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
            const defaultConfig = {
                subject: `Important Update: ${sanitized} — Periyar University`,
                greeting: `Dear {{studentName}},`,
                message: `This is an official system transmission regarding your Ph.D. admissions process at Periyar University for ${sanitized}.\n\nPlease log in to the student portal to review the complete details, notices, or download materials.\n\nShould you have any questions, feel free to contact our admissions support team.`,
                buttonText: `Go to Student Dashboard`,
                buttonUrl: `{{actionUrl}}`,
                theme: `university-blue`,
                footer: `Office of PhD Admissions, Periyar University`,
                logo: `/uploads/logos/default-logo.png`
            };

            // Check if it already exists to avoid unique constraint violations
            const existingTmpl = await EmailTemplateModel.findByKey(routeKey);
            if (!existingTmpl) {
                await EmailTemplateModel.create({
                    template_key: routeKey || 'custom_template_' + Date.now(),
                    template_name: `${sanitized} Notification`,
                    template_type: sanitized,
                    template_config: defaultConfig,
                    is_active: true
                });
            }

            res.status(201).json({ success: true, message: 'Custom template category type added and automated successfully', typeName: sanitized });
        } catch (error) {
            console.error('addCategory Error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = EmailTemplateController;
