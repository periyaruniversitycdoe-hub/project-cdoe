export const AuditAction = {
  // ── Registration & Onboarding ────────────────────────────
  USER_REGISTERED:       'USER_REGISTERED',
  WELCOME_EMAIL_SENT:    'WELCOME_EMAIL_SENT',

  // ── Email Verification ───────────────────────────────────
  VERIFICATION_EMAIL_SENT: 'VERIFICATION_EMAIL_SENT',
  EMAIL_VERIFIED:          'EMAIL_VERIFIED',
  VERIFICATION_RESENT:     'VERIFICATION_RESENT',

  // ── Authentication ───────────────────────────────────────
  LOGIN_SUCCESS:   'LOGIN_SUCCESS',
  LOGIN_FAILED:    'LOGIN_FAILED',
  LOGOUT:          'LOGOUT',

  // ── Security ─────────────────────────────────────────────
  RATE_LIMIT_EXCEEDED:   'RATE_LIMIT_EXCEEDED',
  INVALID_VERIFY_TOKEN:  'INVALID_VERIFY_TOKEN',
  EXPIRED_VERIFY_TOKEN:  'EXPIRED_VERIFY_TOKEN',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];
