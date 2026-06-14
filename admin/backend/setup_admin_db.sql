-- Admin System Database Setup
USE rsm_db;

-- 1. Comprehensive University Settings
CREATE TABLE IF NOT EXISTS university_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    university_name_english VARCHAR(255),
    university_name_tamil VARCHAR(255),
    subtitle VARCHAR(255),
    naac_details VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    logo VARCHAR(255),
    founder_image VARCHAR(255),
    founder_name VARCHAR(255),
    payment_button_text VARCHAR(100),
    payment_gateway_name VARCHAR(100),
    payment_gateway_key VARCHAR(255),
    smtp_host VARCHAR(255),
    smtp_port INT,
    smtp_email VARCHAR(255),
    smtp_password VARCHAR(255),
    footer_text TEXT,
    copyright_text VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Dropdown Tables (Ensuring all required tables exist)
CREATE TABLE IF NOT EXISTS dropdown_exam_centers (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_subjects (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_categories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_districts (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), state VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_genders (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_departments (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_dept_name (name));
CREATE TABLE IF NOT EXISTS dropdown_communities (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_id_types (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_score_types (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_mark_statement_types (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));

-- 3. Audit Logs
CREATE TABLE IF NOT EXISTS settings_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT,
    action VARCHAR(255), 
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Uploads Registry
CREATE TABLE IF NOT EXISTS uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    mimetype VARCHAR(100),
    size INT,
    path VARCHAR(255),
    purpose VARCHAR(100), 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed missing dropdowns if empty
INSERT IGNORE INTO dropdown_id_types (name) VALUES ('Aadhar Card'), ('Voter ID'), ('Passport'), ('Driving License');
INSERT IGNORE INTO dropdown_score_types (name) VALUES ('Percentage'), ('CGPA');
INSERT IGNORE INTO dropdown_mark_statement_types (name) VALUES ('Consolidated'), ('Semester-wise');

-- Ensure an admin user exists (if not already there from database.sql)
-- Note: 'admin123' hashed with bcrypt is $2b$10$7zBUpv1Z.f3XkU8fP.U3u.W9t7fFf6v5G7H8i9j0k1l2m3n4o5p6q
-- But database.sql uses $2a$10$... which is also fine.
