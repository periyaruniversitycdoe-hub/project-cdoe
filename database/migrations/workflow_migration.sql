ALTER TABLE attendance_upload_logs ADD COLUMN IF NOT EXISTS venue_id INT DEFAULT NULL AFTER session_id;
