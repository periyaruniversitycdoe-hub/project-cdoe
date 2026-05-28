import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => {
  const port   = parseInt(process.env.MAIL_PORT ?? '587', 10);
  const secure = port === 465; // SSL on 465; STARTTLS on 587
  return {
    host:        process.env.MAIL_HOST ?? 'smtp.gmail.com',
    port,
    secure,
    requireTLS:  !secure,
    auth: {
      user: process.env.MAIL_USER ?? '',
      pass: process.env.MAIL_PASS ?? '',
    },
    fromName:    process.env.MAIL_FROM_NAME ?? 'Periyar University',
    fromAddress: process.env.MAIL_FROM      ?? process.env.MAIL_USER ?? 'noreply@periyaruniversity.ac.in',
  };
});
