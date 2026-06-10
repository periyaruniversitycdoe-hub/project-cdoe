-- =========================================================================
-- MIGRATION 012 — Permission Form Workflow
-- Adds workflow tracking columns to counselling_applications and creates
-- the four supporting tables for the Permission Review & Allocation module.
-- Safe / idempotent — uses IF NOT EXISTS / IF EXISTS guards throughout.
-- =========================================================================

USE rsm_db;

-- ── 1. Extend counselling_applications with workflow_status ───────────────
ALTER TABLE counselling_applications
    ADD COLUMN IF NOT EXISTS workflow_status
        ENUM(
            'Submitted',
            'Documents_Verified',
            'Center_Allocated',
            'Supervisor_Allocated',
            'Forwarded_Center',
            'Center_Evaluated',
            'Forwarded_Supervisor',
            'Supervisor_Evaluated',
            'Approved',
            'Waitlisted',
            'Rejected'
        ) NOT NULL DEFAULT 'Submitted',
    ADD COLUMN IF NOT EXISTS forwarded_center_at    TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS forwarded_supervisor_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS final_decision          ENUM('Approved','Waitlisted','Rejected') NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS final_decision_at       TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS final_remarks           TEXT NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS admin_verified_by       VARCHAR(255) NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS admin_verified_at       TIMESTAMP NULL DEFAULT NULL;

-- Index for quick workflow_status queries
ALTER TABLE counselling_applications
    ADD INDEX IF NOT EXISTS idx_ca_workflow (workflow_status);

-- ── 2. permission_allocations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permission_allocations (
    id                         INT AUTO_INCREMENT PRIMARY KEY,
    counselling_application_id INT NOT NULL,
    allocated_center_id        INT NULL,
    allocated_supervisor_id    INT NULL,
    center_allocation_date     DATE NULL,
    supervisor_allocation_date DATE NULL,
    center_remarks             TEXT NULL,
    supervisor_remarks         TEXT NULL,
    allocated_by               VARCHAR(255) NULL,
    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pa_app (counselling_application_id),
    CONSTRAINT fk_pa_app    FOREIGN KEY (counselling_application_id)
        REFERENCES counselling_applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_pa_center FOREIGN KEY (allocated_center_id)
        REFERENCES research_centers(id) ON DELETE SET NULL,
    CONSTRAINT fk_pa_sup    FOREIGN KEY (allocated_supervisor_id)
        REFERENCES research_supervisors(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 3. permission_center_evaluations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS permission_center_evaluations (
    id                         INT AUTO_INCREMENT PRIMARY KEY,
    counselling_application_id INT NOT NULL,
    center_id                  INT NULL,
    evaluated_by               VARCHAR(255) NULL,
    academic_record            TINYINT UNSIGNED NOT NULL DEFAULT 0
                                   COMMENT 'Out of 20',
    research_aptitude          TINYINT UNSIGNED NOT NULL DEFAULT 0
                                   COMMENT 'Out of 20',
    subject_relevance          TINYINT UNSIGNED NOT NULL DEFAULT 0
                                   COMMENT 'Out of 20',
    research_proposal          TINYINT UNSIGNED NOT NULL DEFAULT 0
                                   COMMENT 'Out of 20',
    interview_performance      TINYINT UNSIGNED NOT NULL DEFAULT 0
                                   COMMENT 'Out of 20',
    remarks                    TEXT NULL,
    recommendation             ENUM('Recommended','Waitlisted','Rejected') NOT NULL,
    submitted_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pce_app (counselling_application_id),
    CONSTRAINT fk_pce_app    FOREIGN KEY (counselling_application_id)
        REFERENCES counselling_applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_pce_center FOREIGN KEY (center_id)
        REFERENCES research_centers(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 4. permission_supervisor_evaluations ─────────────────────────────────
CREATE TABLE IF NOT EXISTS permission_supervisor_evaluations (
    id                         INT AUTO_INCREMENT PRIMARY KEY,
    counselling_application_id INT NOT NULL,
    supervisor_id              INT NULL,
    evaluated_by               VARCHAR(255) NULL,
    subject_knowledge          TINYINT UNSIGNED NOT NULL DEFAULT 0
                                   COMMENT 'Out of 25',
    research_aptitude          TINYINT UNSIGNED NOT NULL DEFAULT 0
                                   COMMENT 'Out of 25',
    research_feasibility       TINYINT UNSIGNED NOT NULL DEFAULT 0
                                   COMMENT 'Out of 25',
    interview                  TINYINT UNSIGNED NOT NULL DEFAULT 0
                                   COMMENT 'Out of 25',
    remarks                    TEXT NULL,
    recommendation             ENUM('Accept','Waitlist','Reject') NOT NULL,
    submitted_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pse_app (counselling_application_id),
    CONSTRAINT fk_pse_app FOREIGN KEY (counselling_application_id)
        REFERENCES counselling_applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_pse_sup FOREIGN KEY (supervisor_id)
        REFERENCES research_supervisors(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 5. permission_workflow_history ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permission_workflow_history (
    id                         INT AUTO_INCREMENT PRIMARY KEY,
    counselling_application_id INT NOT NULL,
    action                     VARCHAR(100) NOT NULL,
    performed_by               VARCHAR(255) NOT NULL,
    role                       VARCHAR(50)  NOT NULL,
    from_status                VARCHAR(50)  NULL,
    to_status                  VARCHAR(50)  NULL,
    remarks                    TEXT NULL,
    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pwh_app (counselling_application_id),
    CONSTRAINT fk_pwh_app FOREIGN KEY (counselling_application_id)
        REFERENCES counselling_applications(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 6. permission_notifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permission_notifications (
    id                         INT AUTO_INCREMENT PRIMARY KEY,
    counselling_application_id INT NOT NULL,
    recipient_type             ENUM('center','supervisor','admin') NOT NULL,
    recipient_id               INT NOT NULL,
    message                    TEXT NOT NULL,
    is_read                    TINYINT(1) NOT NULL DEFAULT 0,
    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pn_recipient (recipient_type, recipient_id),
    INDEX idx_pn_app (counselling_application_id),
    CONSTRAINT fk_pn_app FOREIGN KEY (counselling_application_id)
        REFERENCES counselling_applications(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'Migration 012 — Permission Workflow complete' AS status;
