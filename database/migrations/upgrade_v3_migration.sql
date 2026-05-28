-- =========================================================================
-- UPGRADE V3 MIGRATION — PhD Admission Portal Enterprise Upgrade
-- MariaDB 10.4 compatible — fully safe, non-destructive schema updates
-- Run once; all statements use IF NOT EXISTS / IGNORE guards
-- =========================================================================

-- ─── 1. applications — new lifecycle columns ───────────────────────────────

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS registration_date       DATETIME     NULL COMMENT 'When user first registered (created account)',
    ADD COLUMN IF NOT EXISTS payment_date            DATETIME     NULL COMMENT 'Actual payment completion timestamp',
    ADD COLUMN IF NOT EXISTS payment_transaction_id  VARCHAR(100) NULL COMMENT 'Gateway transaction reference',
    ADD COLUMN IF NOT EXISTS approval_date           DATETIME     NULL COMMENT 'When admin set status = Approved',
    ADD COLUMN IF NOT EXISTS hall_ticket_generated_at DATETIME    NULL COMMENT 'When hall ticket was first generated',
    ADD COLUMN IF NOT EXISTS hall_ticket_downloaded_at DATETIME   NULL COMMENT 'When student first downloaded hall ticket',
    ADD COLUMN IF NOT EXISTS result_published_at     DATETIME     NULL COMMENT 'When entrance result was published for this record',
    ADD COLUMN IF NOT EXISTS counselling_opened_at   DATETIME     NULL COMMENT 'When student first opened counselling form',
    ADD COLUMN IF NOT EXISTS counselling_submitted_at DATETIME    NULL COMMENT 'When student submitted counselling preferences',
    ADD COLUMN IF NOT EXISTS direct_pass_status      ENUM('None','DirectPass') NOT NULL DEFAULT 'None' COMMENT 'Bypasses exam workflow entirely',
    ADD COLUMN IF NOT EXISTS pay_choice              ENUM('PayNow','PayLater') NULL COMMENT 'Choice made after registration';

-- ─── 2. hall_tickets — track download timestamp ────────────────────────────

ALTER TABLE hall_tickets
    ADD COLUMN IF NOT EXISTS student_downloaded_at DATETIME NULL COMMENT 'First time student downloaded their hall ticket';

-- ─── 3. payments — full payment ledger ────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
    id                 INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    application_id     VARCHAR(50)  NOT NULL,
    amount             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency           VARCHAR(10)  NOT NULL DEFAULT 'INR',
    gateway            VARCHAR(50)  NOT NULL DEFAULT 'Manual',
    transaction_id     VARCHAR(100) NULL,
    payment_status     ENUM('Initiated','Pending','Success','Failed','Refunded') NOT NULL DEFAULT 'Initiated',
    payment_mode       VARCHAR(50)  NULL COMMENT 'UPI, NetBanking, Card, DD, Cash',
    receipt_number     VARCHAR(100) NULL,
    paid_at            DATETIME     NULL,
    gateway_response   JSON         NULL COMMENT 'Raw gateway payload',
    recorded_by        VARCHAR(100) NULL COMMENT 'Admin email if manual entry',
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pay_appid    (application_id),
    INDEX idx_pay_status   (payment_status),
    INDEX idx_pay_paid_at  (paid_at),
    INDEX idx_pay_txn      (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 4. qualification_rules — admin-configurable direct pass engine ────────

CREATE TABLE IF NOT EXISTS qualification_rules (
    id                  INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    rule_name           VARCHAR(150) NOT NULL COMMENT 'Human-readable label',
    qualification_type  VARCHAR(100) NOT NULL COMMENT 'Qualification/course that triggers this rule',
    department          VARCHAR(200) NULL     COMMENT 'NULL = all departments, else comma-separated dept names',
    direct_pass_enabled TINYINT(1)   NOT NULL DEFAULT 1,
    requires_payment    TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'Payment must be complete for rule to activate',
    valid_from          DATE         NULL,
    valid_to            DATE         NULL,
    notes               TEXT         NULL,
    created_by          VARCHAR(100) NULL,
    is_active           TINYINT(1)   NOT NULL DEFAULT 1,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_qr_active  (is_active),
    INDEX idx_qr_qual    (qualification_type),
    INDEX idx_qr_dept    (department(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed common direct-pass qualifications (INSERT IGNORE = safe re-run)
INSERT IGNORE INTO qualification_rules
    (rule_name, qualification_type, department, direct_pass_enabled, requires_payment, is_active)
VALUES
    ('NET Holders - All Departments',  'NET',  NULL, 1, 1, 1),
    ('SET Holders - All Departments',  'SET',  NULL, 1, 1, 1),
    ('JRF Holders - All Departments',  'JRF',  NULL, 1, 1, 1),
    ('SLET Holders - All Departments', 'SLET', NULL, 1, 1, 1);

-- ─── 5. attendance_upload_logs — XLS import audit ─────────────────────────

CREATE TABLE IF NOT EXISTS attendance_upload_logs (
    id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id      INT          NULL,
    department      VARCHAR(200) NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    uploaded_by     VARCHAR(100) NOT NULL,
    total_rows      INT          NOT NULL DEFAULT 0,
    success_rows    INT          NOT NULL DEFAULT 0,
    error_rows      INT          NOT NULL DEFAULT 0,
    errors_json     JSON         NULL COMMENT 'Array of row-level error messages',
    status          ENUM('Processing','Completed','Failed') NOT NULL DEFAULT 'Processing',
    processed_at    DATETIME     NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_aul_session (session_id),
    INDEX idx_aul_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 6. result_publish_logs — result publication history ──────────────────

CREATE TABLE IF NOT EXISTS result_publish_logs (
    id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id      INT          NULL,
    result_type     ENUM('Entrance','Interview','Final') NOT NULL DEFAULT 'Entrance',
    published_by    VARCHAR(100) NOT NULL,
    total_published INT          NOT NULL DEFAULT 0,
    notes           TEXT         NULL,
    published_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rpl_session (session_id),
    INDEX idx_rpl_type    (result_type),
    INDEX idx_rpl_at      (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 7. counselling_logs — counselling activity tracking ──────────────────

CREATE TABLE IF NOT EXISTS counselling_logs (
    id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    application_id  VARCHAR(50)  NOT NULL,
    event_type      ENUM('Opened','Submitted','Allotted','Rejected') NOT NULL,
    event_data      JSON         NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cl_appid (application_id),
    INDEX idx_cl_type  (event_type),
    INDEX idx_cl_at    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 8. dashboard_audit_logs — admin action trail ─────────────────────────

CREATE TABLE IF NOT EXISTS dashboard_audit_logs (
    id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    admin_email     VARCHAR(200) NOT NULL,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50)  NULL,
    entity_id       VARCHAR(50)  NULL,
    details         JSON         NULL,
    ip_address      VARCHAR(45)  NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dal_admin  (admin_email),
    INDEX idx_dal_action (action),
    INDEX idx_dal_entity (entity_type, entity_id),
    INDEX idx_dal_at     (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 9. Performance indexes for date-filtered queries ─────────────────────

-- applications date filtering
ALTER TABLE applications
    ADD INDEX IF NOT EXISTS idx_app_created_at       (created_at),
    ADD INDEX IF NOT EXISTS idx_app_payment_date     (payment_date),
    ADD INDEX IF NOT EXISTS idx_app_approval_date    (approval_date),
    ADD INDEX IF NOT EXISTS idx_app_direct_pass      (direct_pass_status),
    ADD INDEX IF NOT EXISTS idx_app_status_pay       (status, payment_status);

-- hall_tickets date filtering
ALTER TABLE hall_tickets
    ADD INDEX IF NOT EXISTS idx_ht_created_at       (created_at),
    ADD INDEX IF NOT EXISTS idx_ht_downloaded_at    (student_downloaded_at);

-- ─── 10. Backfill registration_date from users.created_at ─────────────────

UPDATE applications a
JOIN users u ON a.user_id = u.id
SET a.registration_date = u.created_at
WHERE a.registration_date IS NULL AND u.created_at IS NOT NULL;

-- ─── 11. Backfill payment_date from existing paid records ─────────────────

UPDATE applications
SET payment_date = updated_at
WHERE payment_status = 'Paid' AND payment_date IS NULL;

-- ─── 12. Backfill approval_date from existing approved records ────────────

UPDATE applications
SET approval_date = updated_at
WHERE status = 'Approved' AND approval_date IS NULL;

-- ─── 13. sessions — ensure result_published columns exist ─────────────────

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS entrance_result_published  TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS result_published_at        DATETIME   NULL,
    ADD COLUMN IF NOT EXISTS result_published_by        VARCHAR(100) NULL;

-- =========================================================================
-- END OF UPGRADE V3 MIGRATION
-- =========================================================================
