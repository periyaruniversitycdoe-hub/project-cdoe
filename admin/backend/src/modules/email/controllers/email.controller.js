const emailService = require('../services/email.service');

exports.sendEmail = async (req, res) => {
    const { serviceKey, to, variables } = req.body;
    if (!serviceKey || !to) {
        return res.status(400).json({ success: false, message: 'serviceKey and to are required' });
    }

    try {
        await emailService.sendDynamicEmail({ serviceKey, to, variables: variables || {} });
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send email',
            error: error.message 
        });
    }
};

exports.getLogs = async (req, res) => {
    try {
        const data = await emailService.getEmailLogs();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
