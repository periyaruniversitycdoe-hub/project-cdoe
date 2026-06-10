-- Migration 026: Cleanup unused tables and views

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Access Control
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS admin_permissions;
DROP TABLE IF EXISTS admin_roles;

-- 2. Legacy / Consolidated Data Tables
DROP TABLE IF EXISTS community_fee_master;
DROP TABLE IF EXISTS email_services;
DROP TABLE IF EXISTS master_special_designations;
DROP TABLE IF EXISTS roster_audit_logs;
DROP TABLE IF EXISTS supervisor_capacity_master;

-- 3. Unreferenced Stubs
DROP TABLE IF EXISTS application_sessions;
DROP TABLE IF EXISTS counselling_logs;
DROP TABLE IF EXISTS dashboard_audit_logs;
DROP TABLE IF EXISTS interview_schedule;
DROP TABLE IF EXISTS part_time_configurations;
DROP TABLE IF EXISTS payment_approval_requests;
DROP TABLE IF EXISTS payment_records;
DROP TABLE IF EXISTS roster_allocations;
DROP TABLE IF EXISTS roster_configurations;

-- 4. Database Views
DROP VIEW IF EXISTS v_admin_profile;
DROP VIEW IF EXISTS v_applications_summary;
DROP VIEW IF EXISTS v_payment_audit;
DROP VIEW IF EXISTS v_security_events_summary;
DROP VIEW IF EXISTS v_student_profile;

SET FOREIGN_KEY_CHECKS = 1;
