-- ============================================================
-- REGISTRATION FORM ARCHITECTURAL REBUILD
-- The Research Centre Registration Form becomes the single
-- source of truth for all downstream modules.
--
-- Changes:
--   1. Add institute/principal fields directly to research_centres
--      so the form data is the master — no JOIN dependency for
--      institute details display.
--   2. Add source_centre_id to master_institutes so every institute
--      row can trace back to the registration that created it.
-- ============================================================

-- ─── 1. Extend research_centres with institute/principal details ──────────────
ALTER TABLE research_centres
    ADD COLUMN IF NOT EXISTS college_code    VARCHAR(50)  DEFAULT NULL AFTER centre_ref_no,
    ADD COLUMN IF NOT EXISTS college_name    VARCHAR(300) DEFAULT NULL AFTER college_code,
    ADD COLUMN IF NOT EXISTS principal_name  VARCHAR(300) DEFAULT NULL AFTER hod_email,
    ADD COLUMN IF NOT EXISTS principal_mobile VARCHAR(20) DEFAULT NULL AFTER principal_name,
    ADD COLUMN IF NOT EXISTS college_phone   VARCHAR(20)  DEFAULT NULL AFTER principal_mobile;

-- status column (Pending/Approved/Rejected/Suspended/Draft) — add if missing
ALTER TABLE research_centres
    MODIFY COLUMN status ENUM('Draft','Pending','Approved','Rejected','Suspended','Inactive')
        NOT NULL DEFAULT 'Draft';

-- ─── 2. Extend master_institutes with registration provenance ─────────────────
ALTER TABLE master_institutes
    ADD COLUMN IF NOT EXISTS source_centre_id INT DEFAULT NULL AFTER college_phone,
    ADD COLUMN IF NOT EXISTS college_code     VARCHAR(50) DEFAULT NULL AFTER abbreviation,
    ADD COLUMN IF NOT EXISTS college_name     VARCHAR(300) DEFAULT NULL AFTER college_code,
    ADD COLUMN IF NOT EXISTS principal_name   VARCHAR(300) DEFAULT NULL AFTER college_name,
    ADD COLUMN IF NOT EXISTS principal_mobile VARCHAR(20)  DEFAULT NULL AFTER principal_name,
    ADD COLUMN IF NOT EXISTS college_email    VARCHAR(255) DEFAULT NULL AFTER principal_mobile,
    ADD COLUMN IF NOT EXISTS college_phone    VARCHAR(20)  DEFAULT NULL AFTER college_email,
    ADD COLUMN IF NOT EXISTS created_by       INT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS updated_by       INT DEFAULT NULL;

-- FK: master_institutes → research_centres (nullable — legacy rows have NULL)
ALTER TABLE master_institutes
    ADD CONSTRAINT IF NOT EXISTS fk_inst_source_centre
        FOREIGN KEY (source_centre_id) REFERENCES research_centres(id) ON DELETE SET NULL;

-- Index for fast lookup by college_code on both tables
ALTER TABLE research_centres
    ADD INDEX IF NOT EXISTS idx_rc_college_code (college_code);

ALTER TABLE master_institutes
    ADD UNIQUE INDEX IF NOT EXISTS uq_inst_college_code (college_code);

-- ─── 3. Backfill: copy abbreviation → college_code for existing rc rows ───────
UPDATE research_centres
SET college_code = abbreviation
WHERE college_code IS NULL AND abbreviation IS NOT NULL;

-- ─── 4. Backfill: copy master_institutes.abbreviation → college_code ──────────
UPDATE master_institutes
SET college_code = COALESCE(college_code, abbreviation)
WHERE college_code IS NULL;

UPDATE master_institutes
SET college_name = COALESCE(college_name, name)
WHERE college_name IS NULL;

-- ─── 5. centre_tracking_audit_log — ensure table exists ──────────────────────
CREATE TABLE IF NOT EXISTS centre_tracking_audit_log (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    centre_id          INT NOT NULL,
    action             VARCHAR(50) NOT NULL,
    previous_status    VARCHAR(50) DEFAULT NULL,
    new_status         VARCHAR(50) DEFAULT NULL,
    performed_by       INT DEFAULT NULL,
    performed_by_name  VARCHAR(300) DEFAULT NULL,
    reason_category    VARCHAR(200) DEFAULT NULL,
    custom_reason      TEXT DEFAULT NULL,
    remarks            TEXT DEFAULT NULL,
    allow_resubmission TINYINT(1) DEFAULT 1,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ctal_centre FOREIGN KEY (centre_id) REFERENCES research_centres(id) ON DELETE CASCADE,
    INDEX idx_ctal_centre (centre_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- END OF MIGRATION 011
-- ============================================================
