-- Migration 028: Additional unused table cleanup for hosting

SET FOREIGN_KEY_CHECKS = 0;

-- Never queried in any backend code (created in update_settings_schema.sql but never used)
DROP TABLE IF EXISTS uploads;

-- Superseded by the `departments` table via the department consolidation migration.
-- supervisor/backend/routes/dropdowns.js already redirects master_departments -> departments.
DROP TABLE IF EXISTS master_departments;

-- Legacy roster tables: renamed from their original names at startup by roster.js (lines 32-44).
-- After rename they are never queried again — roster.js creates fresh replacements.
DROP TABLE IF EXISTS roster_merit_list_legacy;
DROP TABLE IF EXISTS roster_category_config_legacy;
DROP TABLE IF EXISTS roster_merit_config_legacy;
DROP TABLE IF EXISTS roster_audit_log_legacy;
DROP TABLE IF EXISTS roster_entries_legacy;

SET FOREIGN_KEY_CHECKS = 1;
