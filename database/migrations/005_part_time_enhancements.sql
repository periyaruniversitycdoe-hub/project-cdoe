-- Migration: Part-Time Dynamic Category Hints & Global Guidance Document Registry
USE rsm_db;

-- 1. Safely add category_hint column to part_time_categories
SET @dbname = DATABASE();
SET @tablename = 'part_time_categories';
SET @columnname = 'category_hint';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE part_time_categories ADD COLUMN category_hint TEXT DEFAULT NULL AFTER category_name'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Create global_part_time_guidance table
CREATE TABLE IF NOT EXISTS global_part_time_guidance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_path VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'pdf' or 'image'
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
