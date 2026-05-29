const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { sendTransacEmail } = require('../../backend/src/services/emailService');

(async () => {
    console.log('Sending live test email via Brevo HTTPS API...');
    try {
        const info = await sendTransacEmail({
            to: 'majeed74905@gmail.com',
            subject: '⭐ Brevo HTTPS Transactional Delivery Verification Check',
            html: `
                <div style="font-family: 'Inter', -apple-system, sans-serif; padding: 30px; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px;">
                        <h1 style="color: #1e3a8a; margin: 0; font-size: 22px;">Periyar University PhD Admissions</h1>
                        <p style="color: #64748b; font-size: 13px; margin: 5px 0 0 0;">BREVO HTTPS TRANSACTIONAL DELIVERY</p>
                    </div>
                    
                    <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">100% Production Grade HTTPS Integration Verified!</h2>
                    
                    <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                        This communication confirms that the transaction email dispatch module has been thoroughly upgraded to use Brevo's HTTPS API over secure Port 443, making it 100% compatible with Render Free Tier firewall rules.
                    </p>
                </div>
            `,
            text: 'Brevo transactional email dispatch successful.'
        });
        
        console.log('✅ Brevo Email Sent successfully!');
        console.log('Message ID:', info.messageId);
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to send Brevo email:', err.message);
        process.exit(1);
    }
})();
