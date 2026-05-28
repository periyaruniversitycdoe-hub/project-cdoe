import { sendEmailService } from '../services/mail.service.js';
import { validateMailPayload } from '../validators/mail.validator.js';

export const sendEmail = async (req, res, next) => {
  try {
    const { to, subject, message } = req.body;

    // 1. Validation
    const validation = validateMailPayload({ to, subject, message });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    // 2. Send Email
    await sendEmailService({ to, subject, message });

    // 3. Success Response
    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    next(error); // Pass to error middleware
  }
};
