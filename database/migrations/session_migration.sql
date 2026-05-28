-- ============================================================
-- SESSION MANAGEMENT MIGRATION
-- Run this against rsm_db to enable the session management system
-- ============================================================

USE rsm_db;

-- Step 1: Session Types master table
CREATE TABLE IF NOT EXISTS session_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default session types
INSERT INTO session_types (session_name)
SELECT 'Session 1' WHERE NOT EXISTS (SELECT 1 FROM session_types WHERE session_name = 'Session 1');

INSERT INTO session_types (session_name)
SELECT 'Session 2' WHERE NOT EXISTS (SELECT 1 FROM session_types WHERE session_name = 'Session 2');

-- Step 2: Sessions main table
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    month VARCHAR(20) NOT NULL,
    session_type_id INT NOT NULL,
    is_active TINYINT(1) DEFAULT 0,
    registration_open TINYINT(1) DEFAULT 0,
    application_open TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_type_id) REFERENCES session_types(id) ON DELETE RESTRICT ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 3: Add session_id FK to users table (if column doesn't exist)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS session_id INT NULL AFTER role,
    ADD CONSTRAINT IF NOT EXISTS fk_user_session
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL ON UPDATE CASCADE;
