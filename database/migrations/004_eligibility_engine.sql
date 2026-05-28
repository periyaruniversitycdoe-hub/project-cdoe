-- =========================================================================
-- MIGRATION 004 — Enterprise Eligibility Engine
-- MariaDB 10.4 compatible — safe, non-destructive
-- Fixes: interview_status default bug, adds final_result_status
-- =========================================================================

-- 1. Fix critical bug: interview_status was DEFAULT 'PASS' (auto-passes everyone)
--    Change default to NULL — no auto-pass assumptions
ALTER TABLE applications MODIFY COLUMN interview_status VARCHAR(50) NULL DEFAULT NULL;

-- 2. Clear spurious 'PASS' values that came from the bad default.
--    Rule: if interview_mark is NULL, the interview was never conducted → clear status
UPDATE applications SET interview_status = NULL WHERE interview_mark IS NULL;

-- 3. Fix qualification_status for exempted students (should be 'Direct Qualified', not 'Pending')
UPDATE applications
SET qualification_status = 'Direct Qualified'
WHERE entrance_exam_status = 'Exempted' AND qualification_status = 'Pending';

-- 4. Add centralized final_result_status column
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS final_result_status
        ENUM('Pending','PASS','FAIL') NOT NULL DEFAULT 'Pending';

-- 5. Backfill final_result_status for exempted students
UPDATE applications
SET final_result_status = CASE
    WHEN interview_status = 'PASS' THEN 'PASS'
    WHEN interview_status = 'FAIL' THEN 'FAIL'
    ELSE 'Pending'
END
WHERE entrance_exam_status = 'Exempted';

-- 6. Backfill final_result_status for non-exempted students
--    PASS only when BOTH entrance qualified AND interview passed
--    FAIL if ANY stage failed
UPDATE applications
SET final_result_status = CASE
    WHEN qualification_status IN ('Qualified','Direct Qualified') AND interview_status = 'PASS' THEN 'PASS'
    WHEN qualification_status IN ('Failed','Absent') THEN 'FAIL'
    WHEN interview_status = 'FAIL' THEN 'FAIL'
    ELSE 'Pending'
END
WHERE entrance_exam_status != 'Exempted';

-- 7. Index for fast filtering
ALTER TABLE applications
    ADD INDEX IF NOT EXISTS idx_app_final_result (final_result_status);

-- =========================================================================
-- END OF MIGRATION 004
-- =========================================================================
