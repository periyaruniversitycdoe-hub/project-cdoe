-- =========================================================================
-- INTEGRATED COURSE & ACADEMIC VALIDATION REFACTOR MIGRATION
-- MariaDB 10.4 compatible — safe, non-destructive schema updates
-- =========================================================================

-- 1. Alter higher_education to support Integrated details
ALTER TABLE higher_education
    MODIFY COLUMN level VARCHAR(50) NOT NULL,
    ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS upload_mode VARCHAR(50) NULL;

-- 2. Alter applications to track checkbox choices (conditional mandatory validation)
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS has_sslc TINYINT(1) DEFAULT 1,
    ADD COLUMN IF NOT EXISTS has_hsc TINYINT(1) DEFAULT 1,
    ADD COLUMN IF NOT EXISTS has_diploma TINYINT(1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_ug TINYINT(1) DEFAULT 1,
    ADD COLUMN IF NOT EXISTS has_pg TINYINT(1) DEFAULT 1,
    ADD COLUMN IF NOT EXISTS has_mphil TINYINT(1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_integrated TINYINT(1) DEFAULT 0;

-- 3. Alter file_upload_settings to support Extended Integrated upload configurations
ALTER TABLE file_upload_settings
    ADD COLUMN IF NOT EXISTS is_integrated_course TINYINT(1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS consolidated_enabled TINYINT(1) DEFAULT 1,
    ADD COLUMN IF NOT EXISTS semester_wise_enabled TINYINT(1) DEFAULT 1,
    ADD COLUMN IF NOT EXISTS max_semesters INT DEFAULT 10,
    ADD COLUMN IF NOT EXISTS allowed_semester_doc_types VARCHAR(255) DEFAULT 'jpg,jpeg,png,pdf',
    ADD COLUMN IF NOT EXISTS per_file_size_limit INT DEFAULT 500, -- in KB
    ADD COLUMN IF NOT EXISTS total_size_limit INT DEFAULT 5000;  -- in KB

-- 4. Seed the default configuration for 5-Year Integrated Course
INSERT INTO file_upload_settings (
    file_type, max_size, size_unit, allowed_extensions, 
    is_integrated_course, consolidated_enabled, semester_wise_enabled, 
    max_semesters, allowed_semester_doc_types, per_file_size_limit, total_size_limit
) VALUES (
    '5-Year Integrated Course', 2, 'MB', 'jpg,jpeg,png,pdf', 
    1, 1, 1, 
    10, 'jpg,jpeg,png,pdf', 500, 5000
) ON DUPLICATE KEY UPDATE 
    is_integrated_course = 1, 
    consolidated_enabled = 1, 
    semester_wise_enabled = 1,
    max_semesters = 10,
    allowed_semester_doc_types = 'jpg,jpeg,png,pdf',
    per_file_size_limit = 500,
    total_size_limit = 5000;
