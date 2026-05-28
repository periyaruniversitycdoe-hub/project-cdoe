-- ============================================================
-- post_payment_application_id_migration.sql
-- ============================================================
-- Purpose : Allow payment_transactions and payment_audit_logs
--           to store NULL application_id during the pre-payment
--           window (application_id is generated ONLY after
--           successful payment, not at form submission).
-- Safe    : All ALTER statements use MODIFY only if needed;
--           all operations are idempotent / non-destructive.
-- ============================================================

-- 1. Allow NULL in payment_transactions.application_id
--    (safe even if already nullable)
ALTER TABLE payment_transactions
  MODIFY COLUMN application_id VARCHAR(50) NULL DEFAULT NULL;

-- 2. Allow NULL in payment_audit_logs.application_id
ALTER TABLE payment_audit_logs
  MODIFY COLUMN application_id VARCHAR(50) NULL DEFAULT NULL;

-- 3. Allow NULL in payment_receipts.application_id
--    (receipts are created on payment success when ID already exists,
--     but belt-and-suspenders safety)
ALTER TABLE payment_receipts
  MODIFY COLUMN application_id VARCHAR(50) NULL DEFAULT NULL;

-- 4. Ensure payment_transactions.user_id has an index
--    (used for JOIN lookups in admin payment management)
CREATE INDEX IF NOT EXISTS idx_pt_user_id
  ON payment_transactions (user_id);

-- 5. Ensure application_id_serials table exists
--    (already created by application_id_delayed_generation.sql,
--     but included here for safety on fresh deployments)
CREATE TABLE IF NOT EXISTS application_id_serials (
  session_id   INT UNSIGNED NOT NULL,
  last_serial  INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
