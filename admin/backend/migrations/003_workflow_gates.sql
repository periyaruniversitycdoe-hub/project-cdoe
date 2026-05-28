-- =========================================================================
-- MIGRATION 003 — Complete Workflow Gates
-- MariaDB 10.4 compatible — safe, non-destructive
-- Implements: entrance result publish, counselling allotment, joining letter
-- =========================================================================

-- 1. Entrance result publish flag (separate from interview result publish)
ALTER TABLE university_settings
    ADD COLUMN IF NOT EXISTS entrance_result_publish TINYINT(1) NOT NULL DEFAULT 0;

-- 2. Counselling seat allotment columns
ALTER TABLE counselling_applications
    ADD COLUMN IF NOT EXISTS allotment_status
        ENUM('Pending','Allotted','Not Allotted') NOT NULL DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS allotted_center_id      INT          NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS allotted_supervisor_id  INT          NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS allotment_remarks       TEXT         NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS allotted_at             TIMESTAMP    NULL DEFAULT NULL;

-- 3. Indexes for allotment queries
ALTER TABLE counselling_applications
    ADD INDEX IF NOT EXISTS idx_ca_allotment (allotment_status);

-- =========================================================================
-- END OF MIGRATION 003
-- =========================================================================
