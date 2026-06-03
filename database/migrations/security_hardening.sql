-- ============================================================
-- Security Hardening Migration
-- Periyar University PhD Management System
-- Creates: security_events, account_lockouts, refresh_tokens,
--          admin_mfa, blocked_ips, secure_download_tokens
-- + Security views over sensitive tables
-- Run once against rsm_db
-- ============================================================

SET NAMES utf8mb4;

-- ────────────────────────────────────────────────────────────
-- 1. Security Events  (forensic audit trail)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_events (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_type         VARCHAR(60)   NOT NULL,
    portal             VARCHAR(20)   NOT NULL,
    severity           ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low',
    user_id            INT           NULL,
    email              VARCHAR(255)  NULL,
    ip_address         VARCHAR(45)   NULL,
    device_fingerprint VARCHAR(16)   NULL,
    request_id         VARCHAR(64)   NULL,
    user_agent         VARCHAR(255)  NULL,
    message            VARCHAR(500)  NULL,
    meta               JSON          NULL,
    created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_se_event_type  (event_type),
    INDEX idx_se_portal      (portal),
    INDEX idx_se_severity    (severity),
    INDEX idx_se_user_id     (user_id),
    INDEX idx_se_email       (email),
    INDEX idx_se_ip          (ip_address),
    INDEX idx_se_created_at  (created_at),
    INDEX idx_se_request_id  (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Immutable security audit log';

-- ────────────────────────────────────────────────────────────
-- 2. Account Lockouts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_lockouts (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email            VARCHAR(255)  NOT NULL,
    portal           VARCHAR(20)   NOT NULL,
    failed_attempts  TINYINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until     DATETIME      NULL,
    lockout_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    last_attempt_at  DATETIME      NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_email_portal (email, portal),
    INDEX idx_al_locked_until (locked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- 3. Refresh Tokens  (one active token per user per portal)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT           NOT NULL,
    portal       VARCHAR(20)   NOT NULL,
    token_hash   CHAR(64)      NOT NULL,     -- SHA-256 of the raw token
    device_hash  VARCHAR(16)   NULL,
    ip_address   VARCHAR(45)   NULL,
    issued_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at   DATETIME      NOT NULL,
    revoked      TINYINT(1)    NOT NULL DEFAULT 0,
    revoked_at   DATETIME      NULL,

    UNIQUE KEY uk_token_hash (token_hash),
    INDEX idx_rt_user_portal (user_id, portal),
    INDEX idx_rt_expires_at  (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- 4. Admin MFA (TOTP)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_mfa (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT           NOT NULL UNIQUE,
    secret       VARCHAR(255)  NOT NULL,   -- AES-encrypted TOTP secret
    is_enabled   TINYINT(1)    NOT NULL DEFAULT 0,
    setup_at     DATETIME      NULL,
    last_used_at DATETIME      NULL,
    backup_codes TEXT          NULL,       -- JSON array of hashed backup codes
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_mfa_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- 5. Blocked IPs  (auto-block engine)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_ips (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ip_address   VARCHAR(45)   NOT NULL,
    reason       VARCHAR(255)  NULL,
    blocked_by   VARCHAR(20)   NOT NULL DEFAULT 'auto',   -- 'auto'|'admin'
    blocked_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at   DATETIME      NULL,   -- NULL = permanent
    is_active    TINYINT(1)    NOT NULL DEFAULT 1,

    UNIQUE KEY uk_ip (ip_address),
    INDEX idx_bi_active     (is_active),
    INDEX idx_bi_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- 6. Secure Download Tokens  (5-minute one-time file access)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS secure_download_tokens (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    token        CHAR(64)      NOT NULL UNIQUE,
    user_id      INT           NOT NULL,
    file_path    VARCHAR(500)  NOT NULL,
    portal       VARCHAR(20)   NOT NULL,
    expires_at   DATETIME      NOT NULL,
    used         TINYINT(1)    NOT NULL DEFAULT 0,
    used_at      DATETIME      NULL,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_sdt_user_id    (user_id),
    INDEX idx_sdt_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- 7. Security Views  (controlled exposure of sensitive tables)
-- ────────────────────────────────────────────────────────────

-- v_student_profile: safe columns only, masks password/OTP
CREATE OR REPLACE VIEW v_student_profile AS
SELECT
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.session_id,
    u.application_id,
    u.created_at,
    a.status        AS application_status,
    a.updated_at    AS application_updated_at
FROM users u
LEFT JOIN applications a ON a.user_id = u.id
WHERE u.role NOT IN ('admin');
-- Excludes: password, otp_code, otp_expires_at, mfa_secret, reset_token

-- v_admin_profile: admin users without secrets
CREATE OR REPLACE VIEW v_admin_profile AS
SELECT
    id,
    email,
    full_name,
    role,
    created_at
FROM users
WHERE role = 'admin';

-- v_applications_summary: for admin review — no internal-only fields
CREATE OR REPLACE VIEW v_applications_summary AS
SELECT
    a.id,
    a.application_id,
    a.user_id,
    u.full_name       AS applicant_name,
    u.email           AS applicant_email,
    a.status,
    a.session_id,
    a.created_at,
    a.updated_at
FROM applications a
JOIN users u ON u.id = a.user_id;

-- v_security_events_summary: for security dashboard (no raw meta)
CREATE OR REPLACE VIEW v_security_events_summary AS
SELECT
    id,
    event_type,
    portal,
    severity,
    email,
    ip_address,
    request_id,
    message,
    created_at
FROM security_events;
-- Excludes: user_id (until authorized), device_fingerprint, meta (may contain tokens)

-- v_payment_audit: finance view — no raw gateway response
CREATE OR REPLACE VIEW v_payment_audit AS
SELECT
    p.id,
    p.transaction_id,
    p.amount,
    p.status,
    p.created_at,
    u.full_name  AS student_name,
    u.email      AS student_email
FROM payments p
JOIN users u ON u.id = p.user_id;

-- ────────────────────────────────────────────────────────────
-- 8. Cleanup job: purge expired tokens/events (via event scheduler)
-- ────────────────────────────────────────────────────────────
-- Enable MySQL event scheduler: SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS purge_expired_security_data;
CREATE EVENT IF NOT EXISTS purge_expired_security_data
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Remove used/expired download tokens older than 1 day
    DELETE FROM secure_download_tokens
     WHERE (used = 1 OR expires_at < NOW())
       AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY);

    -- Remove expired (non-active) blocked IPs
    UPDATE blocked_ips SET is_active = 0
     WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_active = 1;

    -- Remove revoked refresh tokens older than 30 days
    DELETE FROM refresh_tokens
     WHERE revoked = 1 AND revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

    -- Archive security events older than 90 days (keep HIGH/CRITICAL indefinitely)
    DELETE FROM security_events
     WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
       AND severity IN ('low', 'medium');
END;
