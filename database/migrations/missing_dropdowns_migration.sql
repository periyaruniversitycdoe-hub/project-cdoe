-- ============================================================
-- MISSING DROPDOWN TABLES MIGRATION
-- Run against: rsm_db
-- ============================================================

-- ID types (Aadhaar, PAN, Passport, etc.)
CREATE TABLE IF NOT EXISTS dropdown_id_types (
  id   INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO dropdown_id_types (name) VALUES
  ('Aadhaar No'),
  ('PAN Card'),
  ('Passport'),
  ('Voter ID'),
  ('Driving Licence');

-- Score types (Percentage / CGPA)
CREATE TABLE IF NOT EXISTS dropdown_score_types (
  id   INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO dropdown_score_types (name) VALUES
  ('Percentage'),
  ('CGPA');

-- Mark statement types
CREATE TABLE IF NOT EXISTS dropdown_mark_statement_types (
  id   INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO dropdown_mark_statement_types (name) VALUES
  ('Individual Mark Statement'),
  ('Consolidated Mark Statement');
