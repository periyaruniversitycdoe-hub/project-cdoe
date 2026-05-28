-- =============================================================================
-- ENTERPRISE PAYMENT SYSTEM MIGRATION
-- Periyar University PhD Admission Portal
-- Run AFTER all existing migrations
-- =============================================================================

-- 1. payment_transactions — core enterprise transaction ledger
CREATE TABLE IF NOT EXISTS payment_transactions (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id         VARCHAR(100) UNIQUE NOT NULL,
  application_id   VARCHAR(50)  NOT NULL,
  user_id          INT          NOT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  currency         VARCHAR(10)  DEFAULT 'INR',
  payment_method   ENUM('card','upi_qr','upi_intent','upi_id','netbanking','wallet') NOT NULL,
  payment_sub_method VARCHAR(80) DEFAULT NULL COMMENT 'e.g. googlepay, SBI, paytm_wallet',
  provider_name    VARCHAR(50)  NOT NULL COMMENT 'cashfree|phonepe|payu|ccavenue',
  gateway_order_id       VARCHAR(200) DEFAULT NULL,
  gateway_transaction_id VARCHAR(200) DEFAULT NULL,
  gateway_payment_id     VARCHAR(200) DEFAULT NULL,
  payment_status   ENUM('PENDING','INITIATED','PROCESSING','AWAITING_CONFIRMATION','SUCCESS','FAILED','CANCELLED','REFUNDED','EXPIRED') DEFAULT 'PENDING',
  failure_reason   TEXT         DEFAULT NULL,
  retry_count      INT          DEFAULT 0,
  idempotency_key  VARCHAR(200) DEFAULT NULL,
  qr_code_data     TEXT         DEFAULT NULL COMMENT 'upi:// deep-link used for QR',
  qr_expires_at    DATETIME     DEFAULT NULL,
  redirect_url     TEXT         DEFAULT NULL,
  callback_payload JSON         DEFAULT NULL COMMENT 'raw data received at /callback',
  webhook_received TINYINT(1)   DEFAULT 0,
  webhook_verified TINYINT(1)   DEFAULT 0,
  initiated_at     DATETIME     DEFAULT NULL,
  processing_at    DATETIME     DEFAULT NULL,
  completed_at     DATETIME     DEFAULT NULL,
  verified_at      DATETIME     DEFAULT NULL,
  expires_at       DATETIME     DEFAULT NULL,
  reconciliation_status ENUM('PENDING','MATCHED','MISMATCH','MANUAL_REVIEW') DEFAULT 'PENDING',
  reconciled_at    DATETIME     DEFAULT NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pt_app    (application_id),
  INDEX idx_pt_user   (user_id),
  INDEX idx_pt_status (payment_status),
  INDEX idx_pt_gw_ord (gateway_order_id),
  INDEX idx_pt_idem   (idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. payment_attempts — retry / multi-attempt tracking
CREATE TABLE IF NOT EXISTS payment_attempts (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id       VARCHAR(100) NOT NULL,
  attempt_number INT          NOT NULL DEFAULT 1,
  provider_name  VARCHAR(50)  NOT NULL,
  attempt_status ENUM('INITIATED','SUCCESS','FAILED','TIMEOUT','CANCELLED') NOT NULL,
  gateway_response JSON       DEFAULT NULL,
  error_code     VARCHAR(100) DEFAULT NULL,
  error_message  TEXT         DEFAULT NULL,
  ip_address     VARCHAR(45)  DEFAULT NULL,
  attempted_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pa_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. payment_webhooks — raw webhook event store (idempotent)
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id        VARCHAR(100) DEFAULT NULL,
  provider_name   VARCHAR(50)  NOT NULL,
  webhook_type    VARCHAR(100) DEFAULT NULL,
  payload         JSON         NOT NULL,
  signature_header VARCHAR(500) DEFAULT NULL,
  is_verified     TINYINT(1)   DEFAULT 0,
  is_processed    TINYINT(1)   DEFAULT 0,
  processing_error TEXT        DEFAULT NULL,
  idempotency_key VARCHAR(200) DEFAULT NULL,
  received_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  processed_at    DATETIME     DEFAULT NULL,
  UNIQUE KEY uk_wh_idem (idempotency_key),
  INDEX idx_wh_order   (order_id),
  INDEX idx_wh_proc    (is_processed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. payment_receipts — official receipt registry
CREATE TABLE IF NOT EXISTS payment_receipts (
  id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
  receipt_number          VARCHAR(50)  UNIQUE NOT NULL,
  order_id                VARCHAR(100) NOT NULL,
  application_id          VARCHAR(50)  NOT NULL,
  user_id                 INT          NOT NULL,
  amount                  DECIMAL(10,2) NOT NULL,
  currency                VARCHAR(10)  DEFAULT 'INR',
  payment_method          VARCHAR(100) DEFAULT NULL,
  provider_name           VARCHAR(50)  DEFAULT NULL,
  gateway_transaction_id  VARCHAR(200) DEFAULT NULL,
  applicant_name          VARCHAR(200) DEFAULT NULL,
  applicant_email         VARCHAR(200) DEFAULT NULL,
  applicant_mobile        VARCHAR(20)  DEFAULT NULL,
  qr_verification_code    VARCHAR(100) DEFAULT NULL,
  issued_at               DATETIME     DEFAULT NULL,
  created_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pr_order (order_id),
  INDEX idx_pr_app (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. payment_audit_logs — immutable audit trail
CREATE TABLE IF NOT EXISTS payment_audit_logs (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id        VARCHAR(100) DEFAULT NULL,
  application_id  VARCHAR(50)  DEFAULT NULL,
  user_id         INT          DEFAULT NULL,
  action          VARCHAR(100) NOT NULL,
  actor           VARCHAR(50)  DEFAULT 'system',
  old_status      VARCHAR(50)  DEFAULT NULL,
  new_status      VARCHAR(50)  DEFAULT NULL,
  details         JSON         DEFAULT NULL,
  ip_address      VARCHAR(45)  DEFAULT NULL,
  user_agent      TEXT         DEFAULT NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_al_order  (order_id),
  INDEX idx_al_app    (application_id),
  INDEX idx_al_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Extend legacy payments table with enterprise columns
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS enterprise_order_id     VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS provider_name           VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_status   VARCHAR(50)  DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS failure_reason          TEXT         DEFAULT NULL;

-- 7. Extend applications table payment status to include new enterprise states
ALTER TABLE applications
  MODIFY COLUMN payment_status
    ENUM('Unpaid','Pending','Processing','Success','Paid','Failed','Verified','Approved','Rejected','AwaitingConfirmation')
    DEFAULT 'Pending';
