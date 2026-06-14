-- =========================================================================
-- MIGRATION 013 — Admin-Created Counselling Applications
-- Adds admin-linking columns to counselling_applications and creates
-- the counselling_admin_logs audit table.
-- Safe / idempotent — uses IF NOT EXISTS guards throughout.
-- =========================================================================

USE rsm_db;

-- ── 1. Extend counselling_applications ───────────────────────────────────
ALTER TABLE counselling_applications
    ADD COLUMN IF NOT EXISTS student_application_id VARCHAR(50) NULL DEFAULT NULL
        COMMENT 'Mirrors users.application_id — set when admin creates application',
    ADD COLUMN IF NOT EXISTS created_by_admin TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS department_filter VARCHAR(255) NULL DEFAULT NULL
        COMMENT 'Captured from applications.subject at creation time',
    ADD COLUMN IF NOT EXISTS admin_notes TEXT NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cancelled_by INT NULL DEFAULT NULL;

-- ── 2. Extend status ENUM to include Cancelled ───────────────────────────
ALTER TABLE counselling_applications
    MODIFY COLUMN status ENUM('Draft','Submitted','Cancelled') NOT NULL DEFAULT 'Draft';

-- ── 3. Indexes for efficient lookups ─────────────────────────────────────
ALTER TABLE counselling_applications
    ADD INDEX IF NOT EXISTS idx_ca_admin_created (created_by_admin),
    ADD INDEX IF NOT EXISTS idx_ca_student_app_id (student_application_id);

-- ── 4. Admin audit log table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counselling_admin_logs (
    id                         INT AUTO_INCREMENT PRIMARY KEY,
    counselling_application_id INT NULL,
    application_number         VARCHAR(50) NULL,
    action                     ENUM('Created','Updated','Cancelled','Submitted','Validated') NOT NULL,
    admin_id                   INT NULL,
    admin_email                VARCHAR(255) NULL,
    old_value                  JSON NULL,
    new_value                  JSON NULL,
    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cal_app_id     (counselling_application_id),
    INDEX idx_cal_app_number (application_number),
    INDEX idx_cal_created_at (created_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'Migration 013 — Counselling Admin Linking complete' AS status;
