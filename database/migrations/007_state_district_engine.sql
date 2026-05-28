-- Migration 007: State → District Hierarchical Working Area Engine
-- Extends part_time_eligible_areas (which serve as "states") with a districts sub-table.
-- Safe, additive only — existing data and foreign keys untouched.
USE rsm_db;

-- 1. Districts sub-table linked to working areas (which represent states)
CREATE TABLE IF NOT EXISTS part_time_area_districts (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    area_id      INT          NOT NULL,
    district_name VARCHAR(255) NOT NULL,
    status       TINYINT      NOT NULL DEFAULT 1,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES part_time_eligible_areas(id) ON DELETE CASCADE,
    INDEX idx_pad_area (area_id),
    UNIQUE KEY uniq_area_district (area_id, district_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add part_time_district column to applications (nullable, backward-compatible)
SET @dbname = DATABASE();
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname
       AND TABLE_NAME   = 'applications'
       AND COLUMN_NAME  = 'part_time_district'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE applications ADD COLUMN part_time_district VARCHAR(255) DEFAULT NULL AFTER part_time_area'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add part_time_area_id column to applications (nullable, for resolving FK)
SET @preparedStatement2 = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname
       AND TABLE_NAME   = 'applications'
       AND COLUMN_NAME  = 'part_time_area_id'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE applications ADD COLUMN part_time_area_id INT DEFAULT NULL AFTER part_time_designation'
));
PREPARE stmt2 FROM @preparedStatement2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
