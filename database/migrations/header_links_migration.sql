-- Migration: Add Portal Header Navigation Link Columns to university_settings Table
USE rsm_db;

ALTER TABLE university_settings
  ADD COLUMN IF NOT EXISTS about_us_title VARCHAR(100) DEFAULT 'About Us',
  ADD COLUMN IF NOT EXISTS about_us_link VARCHAR(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS about_us_open_mode VARCHAR(20) DEFAULT '_blank',
  ADD COLUMN IF NOT EXISTS about_us_enabled TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS about_us_order INT DEFAULT 1,

  ADD COLUMN IF NOT EXISTS policies_title VARCHAR(100) DEFAULT 'Policies',
  ADD COLUMN IF NOT EXISTS policies_link VARCHAR(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS policies_open_mode VARCHAR(20) DEFAULT '_blank',
  ADD COLUMN IF NOT EXISTS policies_enabled TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS policies_order INT DEFAULT 2,

  ADD COLUMN IF NOT EXISTS contact_title VARCHAR(100) DEFAULT 'Contact',
  ADD COLUMN IF NOT EXISTS contact_link VARCHAR(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_open_mode VARCHAR(20) DEFAULT '_self',
  ADD COLUMN IF NOT EXISTS contact_enabled TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_order INT DEFAULT 3;

-- Set baseline default values for existing rows
UPDATE university_settings 
SET 
  about_us_title = COALESCE(about_us_title, 'About Us'),
  about_us_open_mode = COALESCE(about_us_open_mode, '_blank'),
  about_us_enabled = COALESCE(about_us_enabled, 0),
  about_us_order = COALESCE(about_us_order, 1),
  
  policies_title = COALESCE(policies_title, 'Policies'),
  policies_open_mode = COALESCE(policies_open_mode, '_blank'),
  policies_enabled = COALESCE(policies_enabled, 0),
  policies_order = COALESCE(policies_order, 2),
  
  contact_title = COALESCE(contact_title, 'Contact'),
  contact_open_mode = COALESCE(contact_open_mode, '_self'),
  contact_enabled = COALESCE(contact_enabled, 0),
  contact_order = COALESCE(contact_order, 3)
WHERE id > 0;
