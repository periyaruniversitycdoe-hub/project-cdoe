import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv:     process.env.NODE_ENV     ?? 'development',
  port:        parseInt(process.env.PORT ?? '3000', 10),
  name:        process.env.APP_NAME     ?? 'Periyar University ERP',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  frontendVerifyPath:
    process.env.FRONTEND_VERIFY_PATH ?? '/auth/verify-email',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
}));
