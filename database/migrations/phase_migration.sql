-- ============================================================
-- PHASE MIGRATION — University ERP (Phases 1-6)
-- Run against: rsm_db  |  MySQL 8+ compatible
-- ============================================================

USE rsm_db;

-- Helper: add column if not exists
DROP PROCEDURE IF EXISTS _add_col;
DELIMITER $$
CREATE PROCEDURE _add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
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

-- Helper: add index if not exists
DROP PROCEDURE IF EXISTS _add_idx;
DELIMITER $$
CREATE PROCEDURE _add_idx(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN col VARCHAR(255))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx
  ) THEN
    SET @_sql = CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` (', col, ')');
    PREPARE _s FROM @_sql;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END$$
DELIMITER ;

-- ─── PHASE 1/2: Attendance & Interview Mark ───────────────────
CALL _add_col('applications', 'attendance_status', "ENUM('Present','Absent') NOT NULL DEFAULT 'Present'");
CALL _add_col('applications', 'interview_mark',    'DECIMAL(5,2) NULL');

-- ─── PHASE 4/5: session_id on applications ────────────────────
CALL _add_col('applications', 'session_id', 'INT NULL');

-- Backfill session_id from user's session
UPDATE applications a
JOIN users u ON a.user_id = u.id
SET a.session_id = u.session_id
WHERE a.session_id IS NULL AND u.session_id IS NOT NULL;

-- ─── PHASE 4/5: session_id on users (ensure exists) ──────────
CALL _add_col('users', 'session_id', 'INT NULL');

-- ─── INDEXES for performance ──────────────────────────────────
CALL _add_idx('applications', 'idx_app_session',     'session_id');
CALL _add_idx('applications', 'idx_app_attendance',  'attendance_status');
CALL _add_idx('applications', 'idx_app_qual_status', 'qualification_status');
CALL _add_idx('applications', 'idx_app_pay_status',  'payment_status');
CALL _add_idx('applications', 'idx_app_user',        'user_id');
CALL _add_idx('users',        'idx_users_session',   'session_id');

-- Extend qualification_status enum if needed
-- (safely done via procedure since MySQL doesn't support IF NOT EXISTS for ENUMs)
-- Add 'Absent' to qualification_status enum
ALTER TABLE applications
  MODIFY COLUMN qualification_status
    ENUM('Pending','Qualified','Direct Qualified','Failed','Absent')
    NOT NULL DEFAULT 'Pending';

-- ─── PHASE 3: Counselling Settings ────────────────────────────
CREATE TABLE IF NOT EXISTS counselling_settings (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  session_id          INT NOT NULL,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  max_research_choices INT NOT NULL DEFAULT 3,
  is_active           TINYINT(1) NOT NULL DEFAULT 1,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cs_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── PHASE 3: Research Centers ────────────────────────────────
CREATE TABLE IF NOT EXISTS research_centers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  center_name VARCHAR(255) NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── PHASE 3: Research Supervisors ───────────────────────────
CREATE TABLE IF NOT EXISTS research_supervisors (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  research_center_id INT NOT NULL,
  supervisor_name    VARCHAR(255) NOT NULL,
  designation        VARCHAR(100) NULL,
  department         VARCHAR(100) NULL,
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rs_center FOREIGN KEY (research_center_id)
    REFERENCES research_centers(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── PHASE 3: Counselling Applications ───────────────────────
CREATE TABLE IF NOT EXISTS counselling_applications (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  user_id                INT NOT NULL,
  session_id             INT NOT NULL,
  counselling_setting_id INT NULL,
  status                 ENUM('Draft','Submitted') NOT NULL DEFAULT 'Draft',
  submitted_at           TIMESTAMP NULL,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ca_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_ca_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_ca_user_session (user_id, session_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── PHASE 3: Counselling Research Choices ────────────────────
CREATE TABLE IF NOT EXISTS counselling_research_choices (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  counselling_application_id INT NOT NULL,
  research_center_id         INT NOT NULL,
  supervisor_id              INT NOT NULL,
  preference_order           INT NOT NULL DEFAULT 1,
  created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_crc_app    FOREIGN KEY (counselling_application_id)
    REFERENCES counselling_applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_crc_center FOREIGN KEY (research_center_id)
    REFERENCES research_centers(id),
  CONSTRAINT fk_crc_sup    FOREIGN KEY (supervisor_id)
    REFERENCES research_supervisors(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Indexes for counselling
CALL _add_idx('counselling_applications',   'idx_ca_session',  'session_id');
CALL _add_idx('counselling_applications',   'idx_ca_user',     'user_id');
CALL _add_idx('counselling_research_choices','idx_crc_app',    'counselling_application_id');
CALL _add_idx('research_supervisors',       'idx_rs_center',   'research_center_id');

-- ─── Cleanup helper procedures ────────────────────────────────
DROP PROCEDURE IF EXISTS _add_col;
DROP PROCEDURE IF EXISTS _add_idx;

-- ─── Seed: entrance_settings if missing ───────────────────────
INSERT IGNORE INTO entrance_settings (id, passing_mark, total_mark) VALUES (1, 50.00, 100.00);

-- Done
SELECT 'Phase migration complete' AS status;
