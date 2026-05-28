-- =========================================================================
-- MIGRATION 002 — Student Tracking & Counselling Approval
-- MariaDB 10.4 compatible — safe, non-destructive
-- =========================================================================

-- 1. Login tracking table (first/last login per student)
CREATE TABLE IF NOT EXISTS student_logins (
    id              INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         INT         NOT NULL,
    first_login_at  TIMESTAMP   NULL DEFAULT NULL,
    last_login_at   TIMESTAMP   NULL DEFAULT NULL,
    login_count     INT         NOT NULL DEFAULT 0,
    last_ip         VARCHAR(45) NULL DEFAULT NULL,
    UNIQUE KEY uk_sl_user (user_id),
    INDEX idx_sl_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Counselling approval — 3-state, separate from admission_approved (hall ticket gate)
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS counselling_approval
        ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending';

-- 3. Index for counselling approval lookups
ALTER TABLE applications
    ADD INDEX IF NOT EXISTS idx_app_counselling_approval (counselling_approval);

-- =========================================================================
-- END OF MIGRATION 002
-- =========================================================================
