-- ============================================================
-- UNIFIED NOTIFICATION SYSTEM MIGRATION
-- ============================================================

USE rsm_db;

-- 1. Generalize notifications table
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS target_type ENUM('student', 'supervisor', 'center') NOT NULL DEFAULT 'student' AFTER user_id;

-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_type, user_id);

-- 3. Add recipient email to notifications for audit trail
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(200) DEFAULT NULL AFTER message;

-- 4. Rejection Reason support if not already there
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS action_link VARCHAR(500) DEFAULT NULL;
