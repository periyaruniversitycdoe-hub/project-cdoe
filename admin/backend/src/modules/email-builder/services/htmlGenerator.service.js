const Handlebars = require('handlebars');
const ThemeService = require('./theme.service');

class HtmlGeneratorService {
    /**
     * Generate email-safe HTML structured template
     * The variables (e.g. {{student_name}}) are left intact as Handlebars syntax
     * so that the returned HTML can be compiled with actual student records later.
     * @param {object} config - JSON config from DB
     * @returns {string} - Complete HTML template
     */
    static generateTemplateHtml(config) {
        const theme = ThemeService.getTheme(config.theme);
        
        // Handle logo path, resolving localhost if needed
        const logoUrl = config.logo 
            ? (config.logo.startsWith('http') ? config.logo : `http://localhost:5001${config.logo}`)
            : 'http://localhost:5001/uploads/logos/default-logo.png'; // Fallback

        // Safe URL check for button
        const buttonHtml = (config.buttonUrl && config.buttonText) ? `
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px; margin-bottom: 30px;">
                <tr>
                    <td align="center">
                        <table border="0" cellpadding="0" cellspacing="0">
                            <tr>
                                <td align="center" bgcolor="${theme.primaryColor}" style="border-radius: 6px;">
                                    <a href="${config.buttonUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: bold; color: ${theme.buttonTextColor}; text-decoration: none; border-radius: 6px; letter-spacing: 0.5px;">
                                        ${config.buttonText}
                                    </a>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        ` : '';

        // Formulate the main message body with paragraphs and HTML safe line breaks
        const formattedMessage = config.message 
            ? config.message.split('\n').map(p => p.trim() ? `<p style="margin-top: 0; margin-bottom: 16px; font-size: 15px; line-height: 1.6; color: ${theme.textColor};">${p}</p>` : '').join('')
            : '';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${config.subject || 'University Notification'}</title>
    <style>
        /* Outlook & General Client Normalization */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

        /* Media Queries for Responsiveness */
        @media screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
                max-width: 100% !important;
                padding: 10px !important;
            }
            .body-padding {
                padding: 24px !important;
            }
            .header-padding {
                padding: 24px 16px !important;
            }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${theme.bodyBg}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <center style="width: 100%; background-color: ${theme.bodyBg};">
        <div style="display: none; font-size: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
            ${config.subject || 'Official update regarding your PhD application.'}
        </div>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" height="100%" bgcolor="${theme.bodyBg}">
            <tr>
                <td align="center" valign="top" style="padding: 40px 10px;">
                    <!--[if (gte mso 9)|(IE)]>
                    <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
                    <tr>
                    <td align="center" valign="top" width="600">
                    <![endif]-->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; background-color: ${theme.cardBg}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid ${theme.borderColor};">
                        
                        <!-- Header / Branding Block (BRAND LOCKED) -->
                        <tr>
                            <td align="center" valign="top" bgcolor="${theme.headerBg}" class="header-padding" style="padding: 35px 40px; border-bottom: 4px solid ${theme.accentColor};">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td align="center" style="padding-bottom: 15px;">
                                            <img src="${logoUrl}" alt="University Logo" width="65" height="65" style="display: block; width: 65px; height: 65px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="font-family: 'Inter', Arial, sans-serif; color: #ffffff;">
                                            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; line-height: 1.2;">
                                                Periyar University
                                            </h1>
                                            <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: 600; color: #cbd5e1; letter-spacing: 0.5px; text-transform: uppercase;">
                                                Ph.D. Admission & Research Portal
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Body Section -->
                        <tr>
                            <td align="left" valign="top" class="body-padding" style="padding: 40px; background-color: ${theme.cardBg};">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <!-- Greeting -->
                                    <tr>
                                        <td style="padding-bottom: 20px; font-family: 'Inter', Arial, sans-serif;">
                                            <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: ${theme.greetingColor};">
                                                ${config.greeting}
                                            </h2>
                                        </td>
                                    </tr>
                                    
                                    <!-- Message -->
                                    <tr>
                                        <td style="font-family: 'Inter', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: ${theme.textColor};">
                                            ${formattedMessage}
                                        </td>
                                    </tr>
                                    
                                    <!-- Dynamic Action Button -->
                                    <tr>
                                        <td>
                                            ${buttonHtml}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer Section (BRAND LOCKED) -->
                        <tr>
                            <td align="center" valign="top" style="padding: 30px 40px; background-color: ${theme.bodyBg}; border-top: 1px solid ${theme.borderColor}; font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: ${theme.footerTextColor}; line-height: 1.5;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td align="center" style="padding-bottom: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                            ${config.footer || 'Periyar University'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 15px;">
                                            Periyar Palkalai Nagar, Salem - 636 011, Tamil Nadu, India.<br>
                                            Ph.D. Academic Advisory Secretariat
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="font-size: 11px; color: ${theme.footerTextColor}; opacity: 0.8;">
                                            This is an official system transmission dispatched securely from the research admission gateway. Please do not reply directly to this mailbox.
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                    </table>
                    <!--[if (gte mso 9)|(IE)]>
                    </td>
                    </tr>
                    </table>
                    <![endif]-->
                </td>
            </tr>
        </table>
    </center>
</body>
</html>`;
        return html;
    }

    /**
     * Compile the HTML with Handlebars and real/mock data payload
     * @param {string} rawHtmlTemplate - Template containing Handlebars variables
     * @param {object} payload - Key-value pair variables
     * @returns {string} - Rendered final HTML
     */
    static compileHtml(rawHtmlTemplate, payload) {
        const template = Handlebars.compile(rawHtmlTemplate);
        return template(payload);
    }
}

module.exports = HtmlGeneratorService;
