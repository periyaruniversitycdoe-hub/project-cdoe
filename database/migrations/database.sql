DROP DATABASE IF EXISTS rsm_db;
CREATE DATABASE IF NOT EXISTS rsm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rsm_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. University Settings Table
CREATE TABLE IF NOT EXISTS university_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    university_name_tamil VARCHAR(255),
    university_name_english VARCHAR(255),
    subtitle VARCHAR(255),
    naac_details VARCHAR(255),
    address TEXT,
    logo VARCHAR(255),
    payment_button_text VARCHAR(100),
    payment_button_link VARCHAR(255),
    founder_image VARCHAR(255)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS upload_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    allowed_types VARCHAR(255) DEFAULT 'jpeg,jpg,png,pdf',
    max_size_mb INT DEFAULT 5,
    upload_path VARCHAR(255) DEFAULT 'uploads/'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO upload_settings (allowed_types, max_size_mb, upload_path) VALUES ('jpeg,jpg,png,pdf', 5, 'uploads/');

-- 3. Dropdown Tables
CREATE TABLE IF NOT EXISTS dropdown_exam_centers (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_subjects (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_categories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_districts (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), state VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_genders (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE IF NOT EXISTS dropdown_communities (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));

-- 4. Applications Table
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(20) NOT NULL,
    user_id INT NOT NULL,
    
    -- Section 1: Exam Details
    exam_center_1 VARCHAR(100),
    exam_center_2 VARCHAR(100),
    subject VARCHAR(100),
    category VARCHAR(50),
    working_district VARCHAR(100),
    
    -- Section 2: Personal Details
    dob DATE,
    nationality VARCHAR(50),
    is_nri BOOLEAN DEFAULT FALSE,
    religion VARCHAR(50),
    gender VARCHAR(20),
    community VARCHAR(50),
    parent_name VARCHAR(255),
    
    -- Section 3: Communication
    address_1 TEXT,
    address_2 TEXT,
    address_3 TEXT,
    district VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    mobile VARCHAR(15),
    phone VARCHAR(15),
    
    -- Section 4: Identity
    id_type VARCHAR(50),
    id_number VARCHAR(50),
    
    -- Section 5: Physically Challenged
    is_physically_challenged VARCHAR(20),
    
    -- Section 6: PG Details
    pg_degree VARCHAR(255),
    score_type VARCHAR(20),
    score_value VARCHAR(10),
    year_of_passing INT,
    pg_university VARCHAR(255),
    
    -- Section 7: Mark Statement
    mark_statement_type VARCHAR(50),
    is_awaiting_final_sem BOOLEAN DEFAULT FALSE,
    
    -- Section 9: Other Exams
    qualified_exams JSON, -- Store array like ["NET", "SET"]
    
    status ENUM('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected') DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (application_id) REFERENCES users(application_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Application Documents Table
CREATE TABLE IF NOT EXISTS application_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(20) NOT NULL,
    document_type VARCHAR(100),
    file_path VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES users(application_id)
);

-- SEED DATA
INSERT INTO university_settings (university_name_tamil, university_name_english, subtitle, naac_details, address, logo, payment_button_text, payment_button_link)
VALUES ('பெரியார் பல்கலைக்கழகம்', 'PERIYAR UNIVERSITY', 'பெரியார் பல்கலைக்கழகம்', 'NAAC A++ Grade - State University', 'Salem, Tamil Nadu, India', '/images/pu_logo.png', 'Pay Fee', 'https://example.com/pay');

INSERT INTO dropdown_exam_centers (name) VALUES ('Salem'), ('Chennai'), ('Coimbatore'), ('Madurai');
INSERT INTO dropdown_subjects (name) VALUES ('Computer Science'), ('Mathematics'), ('Physics'), ('Chemistry'), ('Tamil'), ('English');
INSERT INTO dropdown_categories (name) VALUES ('Full Time'), ('Part Time');
INSERT INTO dropdown_districts (name, state) VALUES ('Salem', 'Tamil Nadu'), ('Chennai', 'Tamil Nadu'), ('Dharmapuri', 'Tamil Nadu'), ('Namakkal', 'Tamil Nadu');
INSERT INTO dropdown_genders (name) VALUES ('Male'), ('Female'), ('Transgender');
INSERT INTO dropdown_communities (name) VALUES ('OC'), ('BC'), ('MBC'), ('SC'), ('ST');

-- Seed Admin User (Password: admin123)
INSERT INTO users (application_id, full_name, email, password, role) 
VALUES ('ADMIN001', 'University Administrator', 'admin@periyar.edu', '$2a$10$7zBUpv1Z.f3XkU8fP.U3u.W9t7fFf6v5G7H8i9j0k1l2m3n4o5p6q', 'admin');
