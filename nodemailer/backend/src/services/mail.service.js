import transporter from '../config/mail.config.js';

export const sendEmailService = async ({ to, subject, message }) => {
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject,
    text: message,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4A90E2;">New Message</h2>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 5px;">
          <p><strong>Subject:</strong> ${subject}</p>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 15px 0;">
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <p style="font-size: 12px; color: #777; margin-top: 20px;">
          This email was sent from the Nodemailer Module.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('📨 Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('📧 Mail Service Error:', error);
    throw error;
  }
};
