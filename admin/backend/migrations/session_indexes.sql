-- ============================================================
-- Session-Driven Performance Indexes
-- Safe to run on existing DB — uses IF NOT EXISTS pattern via
-- a temporary stored procedure so it works on MySQL 5.7+.
-- ============================================================

DROP PROCEDURE IF EXISTS _add_index_safe;

DELIMITER $$
CREATE PROCEDURE _add_index_safe(
    IN p_table  VARCHAR(64),
    IN p_index  VARCHAR(64),
    IN p_cols   TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   information_schema.statistics
        WHERE  table_schema = DATABASE()
          AND  table_name   = p_table
          AND  index_name   = p_index
    ) THEN
        SET @_sql = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` (', p_cols, ')');
        PREPARE _stmt FROM @_sql;
        EXECUTE _stmt;
        DEALLOCATE PREPARE _stmt;
        SELECT CONCAT('Created index: ', p_index, ' on ', p_table) AS result;
    ELSE
        SELECT CONCAT('Index already exists (skipped): ', p_index) AS result;
    END IF;
END$$
DELIMITER ;

-- ── applications table ────────────────────────────────────────
-- Composite indexes covering the most common admin filter combinations.
-- session_id is the leading column in every index so MySQL can use index
-- range scans for "give me all Approved apps in session 3" style queries.

CALL _add_index_safe('applications', 'idx_app_sess_status',  'session_id, status');
CALL _add_index_safe('applications', 'idx_app_sess_payment', 'session_id, payment_status');
CALL _add_index_safe('applications', 'idx_app_sess_qual',    'session_id, qualification_status');
CALL _add_index_safe('applications', 'idx_app_sess_att',     'session_id, attendance_status');
CALL _add_index_safe('applications', 'idx_app_sess_adm',     'session_id, admission_approved');

-- Covering index for the dashboard stats COUNT queries (session + created_at)
CALL _add_index_safe('applications', 'idx_app_sess_created', 'session_id, created_at');

-- ── users table ───────────────────────────────────────────────
-- Used in registration-open checks and the sessions list user-count JOIN.
CALL _add_index_safe('users', 'idx_users_sess_role', 'session_id, role');

-- ── counselling_applications ──────────────────────────────────
CALL _add_index_safe('counselling_applications', 'idx_ca_sess_status', 'session_id, status');

-- ── counselling_research_choices ─────────────────────────────
-- Used in the IN (subquery) filter by center/supervisor inside admin counselling list.
CALL _add_index_safe('counselling_research_choices', 'idx_crc_app', 'counselling_application_id');
CALL _add_index_safe('counselling_research_choices', 'idx_crc_sup',  'supervisor_id');

-- Cleanup
DROP PROCEDURE IF EXISTS _add_index_safe;

SELECT 'Session indexes migration complete.' AS status;
