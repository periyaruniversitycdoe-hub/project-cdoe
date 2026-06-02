-- ============================================================
-- MIGRATION: Exam Centre Configuration Engine
-- Created for: PhD ERP Enhancement
-- Safe to run multiple times (idempotent)
-- ============================================================

-- 1. Exam Centre Configuration Table
--    Controls how many exam centre preferences a student can submit.
--    Admin sets max_preferences via the University Settings panel.
CREATE TABLE IF NOT EXISTS exam_centre_config (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    max_preferences INT          NOT NULL DEFAULT 2,
    status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
    description     TEXT                      DEFAULT NULL,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by      INT          DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default config row if none exists
INSERT IGNORE INTO exam_centre_config (id, max_preferences, status, description)
VALUES (1, 2, 'active', 'Default: 2 exam centre preferences per student');

-- 2. Add extra exam_center columns to applications table
--    (columns 1 & 2 already exist; add 3-5 for extended configuration)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS exam_center_3 VARCHAR(100) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS exam_center_4 VARCHAR(100) DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS exam_center_5 VARCHAR(100) DEFAULT NULL;

-- 3. Add start_year to higher_education for Academic Timeline Validation
--    Stores the year a student started a qualification (UG/PG/Integrated).
ALTER TABLE higher_education ADD COLUMN IF NOT EXISTS start_year INT DEFAULT NULL;
