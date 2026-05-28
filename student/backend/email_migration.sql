-- Email system columns migration
-- Run once against rsm_db to add OTP and password-reset token support.
-- Safe to re-run: all statements use IF NOT EXISTS / column existence checks.

-- ── users table additions ──────────────────────────────────────────────────

-- OTP for email verification / login second factor
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS otp_code         VARCHAR(6)   NULL,
  ADD COLUMN IF NOT EXISTS otp_expires_at   DATETIME     NULL,
  ADD COLUMN IF NOT EXISTS otp_attempts     INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_purpose      VARCHAR(20)  NULL COMMENT 'verification | login | reset';

-- Secure password-reset token (64 hex chars = 32 random bytes)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token         VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME     NULL;

-- Index for fast token lookups (avoids full table scan on reset)
ALTER TABLE users
  ADD INDEX IF NOT EXISTS idx_reset_token (reset_token),
  ADD INDEX IF NOT EXISTS idx_otp_code    (otp_code);
