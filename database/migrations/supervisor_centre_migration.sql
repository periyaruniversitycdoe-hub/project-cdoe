-- ============================================================
-- SUPERVISOR & RESEARCH CENTRE MODULE MIGRATION
-- Database: rsm_db
-- Run this file once to initialize all new tables
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- MASTER TABLES (Admin-controlled dropdowns)
-- ============================================================

CREATE TABLE IF NOT EXISTS master_designations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_designation_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS master_special_designations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_special_desig_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS master_departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dept_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS master_institutes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    abbreviation VARCHAR(50) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_institute_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS master_districts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_district_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS master_centre_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_centre_type_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS master_research_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_research_subject_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS master_research_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_research_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS master_disciplines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_discipline_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SUPERVISORS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS supervisors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supervisor_no VARCHAR(50) UNIQUE DEFAULT NULL,

    -- Basic Info
    name VARCHAR(300) NOT NULL,
    designation_id INT DEFAULT NULL,
    special_designation_id INT DEFAULT NULL,
    recognition_ref_no VARCHAR(100) DEFAULT NULL,
    profile_image VARCHAR(500) DEFAULT NULL,

    -- Academic Info
    department_id INT DEFAULT NULL,
    gender ENUM('Male','Female','Other') NOT NULL DEFAULT 'Male',
    serving_institute_id INT DEFAULT NULL,

    -- Address
    address_1 VARCHAR(300) DEFAULT NULL,
    address_2 VARCHAR(300) DEFAULT NULL,
    address_3 VARCHAR(300) DEFAULT NULL,
    district_id INT DEFAULT NULL,
    pincode VARCHAR(10) DEFAULT NULL,

    -- Identity
    aadhaar_no VARCHAR(12) DEFAULT NULL,
    mobile VARCHAR(15) DEFAULT NULL,
    email VARCHAR(200) DEFAULT NULL,

    -- Dates
    dob DATE DEFAULT NULL,
    dob_evidence VARCHAR(500) DEFAULT NULL,
    date_of_joining DATE DEFAULT NULL,
    date_of_superannuation DATE DEFAULT NULL,

    -- Documents
    recognition_certificate VARCHAR(500) DEFAULT NULL,

    -- Vacancy Info
    max_candidates INT DEFAULT 0,
    current_vacancy INT DEFAULT 0,
    max_part_time INT DEFAULT 0,
    max_full_time INT DEFAULT 0,

    -- Status
    status ENUM('Active','Inactive','Pending') NOT NULL DEFAULT 'Pending',
    remarks TEXT DEFAULT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sup_designation FOREIGN KEY (designation_id) REFERENCES master_designations(id) ON DELETE SET NULL,
    CONSTRAINT fk_sup_special_desig FOREIGN KEY (special_designation_id) REFERENCES master_special_designations(id) ON DELETE SET NULL,
    CONSTRAINT fk_sup_department FOREIGN KEY (department_id) REFERENCES master_departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_sup_institute FOREIGN KEY (serving_institute_id) REFERENCES master_institutes(id) ON DELETE SET NULL,
    CONSTRAINT fk_sup_district FOREIGN KEY (district_id) REFERENCES master_districts(id) ON DELETE SET NULL,

    INDEX idx_supervisor_email (email),
    INDEX idx_supervisor_mobile (mobile),
    INDEX idx_supervisor_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SUPERVISOR DISCIPLINES (Repeating section)
-- ============================================================

CREATE TABLE IF NOT EXISTS supervisor_disciplines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supervisor_id INT NOT NULL,
    type ENUM('Primary','Additional') NOT NULL DEFAULT 'Primary',
    discipline_id INT DEFAULT NULL,
    centre_id INT DEFAULT NULL,
    recognition_date DATE DEFAULT NULL,
    sort_order INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_sd_supervisor FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE CASCADE,
    CONSTRAINT fk_sd_discipline FOREIGN KEY (discipline_id) REFERENCES master_disciplines(id) ON DELETE SET NULL,

    INDEX idx_sd_supervisor (supervisor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- RESEARCH CENTRES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS research_centres (
    id INT AUTO_INCREMENT PRIMARY KEY,
    centre_ref_no VARCHAR(100) UNIQUE DEFAULT NULL,

    -- Centre Classification
    centre_type_id INT DEFAULT NULL,
    subject_id INT DEFAULT NULL,
    name VARCHAR(300) NOT NULL,
    abbreviation VARCHAR(50) DEFAULT NULL,
    category_id INT DEFAULT NULL,

    -- Institute Info
    institute_id INT DEFAULT NULL,
    institute_name_override VARCHAR(300) DEFAULT NULL,
    institute_abbreviation VARCHAR(50) DEFAULT NULL,

    -- Address
    address_1 VARCHAR(300) DEFAULT NULL,
    address_2 VARCHAR(300) DEFAULT NULL,
    address_3 VARCHAR(300) DEFAULT NULL,
    district_id INT DEFAULT NULL,
    pincode VARCHAR(10) DEFAULT NULL,
    contact_number VARCHAR(20) DEFAULT NULL,
    email VARCHAR(200) DEFAULT NULL,

    -- Recognition
    recognition_date DATE DEFAULT NULL,
    hod_email VARCHAR(200) DEFAULT NULL,
    recognition_certificate VARCHAR(500) DEFAULT NULL,
    logo VARCHAR(500) DEFAULT NULL,

    -- Misc
    remark TEXT DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_rc_centre_type FOREIGN KEY (centre_type_id) REFERENCES master_centre_types(id) ON DELETE SET NULL,
    CONSTRAINT fk_rc_subject FOREIGN KEY (subject_id) REFERENCES master_research_subjects(id) ON DELETE SET NULL,
    CONSTRAINT fk_rc_category FOREIGN KEY (category_id) REFERENCES master_research_categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_rc_institute FOREIGN KEY (institute_id) REFERENCES master_institutes(id) ON DELETE SET NULL,
    CONSTRAINT fk_rc_district FOREIGN KEY (district_id) REFERENCES master_districts(id) ON DELETE SET NULL,

    INDEX idx_rc_name (name),
    INDEX idx_rc_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED: Default master data
-- ============================================================

INSERT IGNORE INTO master_research_categories (name) VALUES
    ('Both'), ('Full-Time'), ('Part-Time');

INSERT IGNORE INTO master_districts (name) VALUES
    ('Chennai'),('Coimbatore'),('Salem'),('Madurai'),('Tirunelveli'),
    ('Tiruchirappalli'),('Vellore'),('Erode'),('Tiruppur'),('Dindigul'),
    ('Thanjavur'),('Cuddalore'),('Kancheepuram'),('Krishnagiri'),('Dharmapuri'),
    ('Namakkal'),('Karur'),('Perambalur'),('Ariyalur'),('Villupuram'),
    ('Tiruvannamalai'),('Ramanathapuram'),('Sivaganga'),('Virudhunagar'),
    ('Thoothukudi'),('Kanniyakumari'),('Nilgiris'),('Pudukkottai'),
    ('Nagapattinam'),('Tiruvarur'),('Theni'),('Kallakurichi'),('Ranipet'),
    ('Chengalpattu'),('Tenkasi'),('Mayiladuthurai');

INSERT IGNORE INTO master_designations (name) VALUES
    ('Professor'),('Associate Professor'),('Assistant Professor'),
    ('Reader'),('Lecturer'),('Principal'),('Dean'),('HOD');

INSERT IGNORE INTO master_special_designations (name) VALUES
    ('None'),('Emeritus Professor'),('Adjunct Professor'),('Visiting Professor');

INSERT IGNORE INTO master_centre_types (name) VALUES
    ('University Department'),('Affiliated College'),('Autonomous College'),
    ('Research Institute'),('National Institute');

INSERT IGNORE INTO master_disciplines (name) VALUES
    ('Mathematics'),('Physics'),('Chemistry'),('Biology'),('Computer Science'),
    ('Engineering'),('Management'),('Commerce'),('Economics'),('History'),
    ('Literature'),('Tamil'),('English'),('Education'),('Law');

-- ============================================================
-- END OF MIGRATION
-- ============================================================
