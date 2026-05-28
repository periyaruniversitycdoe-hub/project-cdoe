-- ============================================================
-- APPLICATION ID DELAYED GENERATION MIGRATION
-- PhD ERP — Periyar University
--
-- PURPOSE:
--   Delay official Application ID generation until after
--   registration form submission. Before submission, students
--   are tracked by email / user_id only.
--
-- SAFE: uses IF EXISTS / MODIFY COLUMN — idempotent on re-run.
-- DO NOT drop or truncate any data tables.
-- ============================================================

USE rsm_db;

-- ─── STEP 1: Extend users.application_id to VARCHAR(30) and make it nullable ──
-- Existing records keep their application_id.
-- New registrations will have NULL until form submission.
ALTER TABLE users
  MODIFY COLUMN application_id VARCHAR(30) UNIQUE NULL;

-- ─── STEP 2: Drop FK from applications → users(application_id) ───────────────
-- We cannot make applications.application_id nullable while the FK exists.
-- Use information_schema to find and drop any such FK safely.

SET @fk_apps := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'applications'
    AND COLUMN_NAME = 'application_id'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);

SET @drop_fk_apps := IF(
  @fk_apps IS NOT NULL,
  CONCAT('ALTER TABLE applications DROP FOREIGN KEY `', @fk_apps, '`'),
  'SELECT 1'
);
PREPARE _stmt FROM @drop_fk_apps;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;

-- ─── STEP 3: Make applications.application_id nullable, extend length ─────────
ALTER TABLE applications
  MODIFY COLUMN application_id VARCHAR(30) NULL;

-- ─── STEP 4: Drop FK from application_documents → users(application_id) ──────
SET @fk_docs := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'application_documents'
    AND COLUMN_NAME = 'application_id'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);

SET @drop_fk_docs := IF(
  @fk_docs IS NOT NULL,
  CONCAT('ALTER TABLE application_documents DROP FOREIGN KEY `', @fk_docs, '`'),
  'SELECT 1'
);
PREPARE _stmt FROM @drop_fk_docs;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;

-- ─── STEP 5: Make all related table application_id columns nullable ───────────

-- school_education
ALTER TABLE school_education
  MODIFY COLUMN application_id VARCHAR(30) NULL;

-- higher_education
ALTER TABLE higher_education
  MODIFY COLUMN application_id VARCHAR(30) NULL;

-- experience_details (may not exist in all environments — guard with procedure)
DROP PROCEDURE IF EXISTS _mod_col_safe;
DELIMITER $$
CREATE PROCEDURE _mod_col_safe(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @_sql = CONCAT('ALTER TABLE `', tbl, '` MODIFY COLUMN `', col, '` ', def);
    PREPARE _s FROM @_sql;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END$$
DELIMITER ;

CALL _mod_col_safe('experience_details',     'application_id', 'VARCHAR(30) NULL');
CALL _mod_col_safe('application_documents',  'application_id', 'VARCHAR(30) NULL');
CALL _mod_col_safe('student_qualifications', 'application_id', 'VARCHAR(30) NULL');

-- ─── STEP 6: Add user_id to related tables for pre-submission tracking ─────────
-- These columns allow all draft-save operations to use user_id as the key.

DROP PROCEDURE IF EXISTS _add_col_safe;
DELIMITER $$
CREATE PROCEDURE _add_col_safe(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @_sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE _s FROM @_sql;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END$$
DELIMITER ;

CALL _add_col_safe('school_education',      'user_id', 'INT NULL AFTER application_id');
CALL _add_col_safe('higher_education',      'user_id', 'INT NULL AFTER application_id');
CALL _add_col_safe('experience_details',    'user_id', 'INT NULL AFTER application_id');
CALL _add_col_safe('application_documents', 'user_id', 'INT NULL AFTER application_id');
CALL _add_col_safe('student_qualifications','user_id', 'INT NULL AFTER application_id');

-- ─── STEP 7: Add application_submitted flag to applications (tracking helper) ──
CALL _add_col_safe('applications', 'application_submitted',      'TINYINT(1) NOT NULL DEFAULT 0');
CALL _add_col_safe('applications', 'application_id_generated_at','TIMESTAMP NULL DEFAULT NULL');

-- ─── STEP 8: Backfill user_id on existing related-table records ───────────────
-- Safe UPDATE — only fills rows where user_id is not yet set.

UPDATE school_education se
  JOIN applications a ON se.application_id = a.application_id
SET se.user_id = a.user_id
WHERE se.user_id IS NULL AND se.application_id IS NOT NULL;

UPDATE higher_education he
  JOIN applications a ON he.application_id = a.application_id
SET he.user_id = a.user_id
WHERE he.user_id IS NULL AND he.application_id IS NOT NULL;

UPDATE experience_details ed
  JOIN applications a ON ed.application_id = a.application_id
SET ed.user_id = a.user_id
WHERE ed.user_id IS NULL AND ed.application_id IS NOT NULL;

UPDATE application_documents ad
  JOIN users u ON ad.application_id = u.application_id
SET ad.user_id = u.id
WHERE ad.user_id IS NULL AND ad.application_id IS NOT NULL;

UPDATE student_qualifications sq
  JOIN applications a ON sq.application_id = a.application_id
SET sq.user_id = a.user_id
WHERE sq.user_id IS NULL AND sq.application_id IS NOT NULL;

-- Also backfill application_submitted flag for all previously-submitted apps
UPDATE applications
SET application_submitted = 1
WHERE status != 'Draft'
  AND application_submitted = 0;

-- ─── STEP 9a: Add user_id-based unique key to student_qualifications ──────────
-- The existing unique key is (application_id, qualification_id).
-- We need the equivalent for user_id so ON DUPLICATE KEY UPDATE works
-- during pre-submission (when application_id is still NULL).
SET @has_uk := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'student_qualifications'
    AND INDEX_NAME   = 'uk_user_qual'
);
SET @add_uk := IF(@has_uk = 0,
  'ALTER TABLE student_qualifications ADD UNIQUE KEY uk_user_qual (user_id, qualification_id)',
  'SELECT 1'
);
PREPARE _stmt FROM @add_uk;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;

-- ─── STEP 9: Session-wise serial counter table ────────────────────────────────
-- Used by ApplicationIdEngine for transaction-safe CETPHD serial generation.
-- One row per session; last_serial is the last assigned serial for that session.
CREATE TABLE IF NOT EXISTS application_id_serials (
  session_id  INT          NOT NULL PRIMARY KEY,
  last_serial INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Cleanup helper procedures ────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _mod_col_safe;
DROP PROCEDURE IF EXISTS _add_col_safe;
