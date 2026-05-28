import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret:            process.env.JWT_SECRET                ?? 'change-me-in-production',
  expiresIn:         process.env.JWT_EXPIRES_IN            ?? '15m',
  verifyEmailSecret: process.env.JWT_VERIFY_EMAIL_SECRET   ?? 'verify-change-me',
  verifyEmailExpiresIn:
    process.env.JWT_VERIFY_EMAIL_EXPIRES_IN ?? '24h',
}));
