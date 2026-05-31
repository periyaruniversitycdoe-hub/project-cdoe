-- Migration: Add Home Address fields to supervisors table
USE rsm_db;

ALTER TABLE supervisors
  ADD COLUMN home_address_1 VARCHAR(300) DEFAULT NULL,
  ADD COLUMN home_address_2 VARCHAR(300) DEFAULT NULL,
  ADD COLUMN home_address_3 VARCHAR(300) DEFAULT NULL,
  ADD COLUMN home_district_id INT DEFAULT NULL,
  ADD COLUMN home_pincode VARCHAR(10) DEFAULT NULL;
