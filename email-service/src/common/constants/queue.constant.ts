export const MAIL_QUEUE = 'mail-queue';

export const MailJobName = {
  SEND_WELCOME_EMAIL:      'send-welcome-email',
  SEND_VERIFICATION_EMAIL: 'send-verification-email',
} as const;

export type MailJobNameType = (typeof MailJobName)[keyof typeof MailJobName];
