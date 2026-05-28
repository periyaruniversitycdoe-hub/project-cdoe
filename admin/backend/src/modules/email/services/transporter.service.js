const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../../.env') });


const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Verifies the SMTP connection
 */
const verifyConnection = async () => {
    try {
        await transporter.verify();
        console.log('✅ SMTP Transporter Verified Ready');
        return true;
    } catch (error) {
        console.error('❌ SMTP Connection Failed:', error.message);
        return false;
    }
};

module.exports = { transporter, verifyConnection };
