-- =============================================================================
-- MIGRATION 025: Payment Management Enhancement
-- Adds payment_source tracking and two new payment status values.
-- Safe to re-run: uses IF NOT EXISTS / full ENUM redeclaration.
-- Run AFTER payment_enterprise_migration.sql
-- =============================================================================

-- 1. Add payment_source to distinguish gateway-automated vs admin-manual updates
ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS payment_source
    ENUM('GATEWAY','MANUAL') DEFAULT 'GATEWAY'
    AFTER payment_method;

-- 2. Extend payment_status ENUM with MANUAL_VERIFICATION_REQUIRED and PARTIALLY_PAID.
--    MySQL requires all existing values to be listed when modifying an ENUM.
ALTER TABLE payment_transactions
  MODIFY COLUMN payment_status
    ENUM(
      'PENDING',
      'INITIATED',
      'PROCESSING',
      'AWAITING_CONFIRMATION',
      'SUCCESS',
      'FAILED',
      'CANCELLED',
      'REFUNDED',
      'EXPIRED',
      'MANUAL_VERIFICATION_REQUIRED',
      'PARTIALLY_PAID'
    ) DEFAULT 'PENDING';

-- 3. Index to speed up filtering by payment_source
CREATE INDEX IF NOT EXISTS idx_pt_source ON payment_transactions(payment_source);
