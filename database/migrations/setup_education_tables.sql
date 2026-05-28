
-- Master Tables for Dynamic Configuration
CREATE TABLE IF NOT EXISTS education_boards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_name VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS degree_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    degree_name VARCHAR(255) NOT NULL,
    level ENUM('UG', 'PG', 'Other') NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS university_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specializations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    spec_name VARCHAR(255) NOT NULL,
    degree_level ENUM('UG', 'PG', 'All') DEFAULT 'All',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employment_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Detail Tables for Application Data
CREATE TABLE IF NOT EXISTS school_education (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL,
    level ENUM('SSLC', 'HSC') NOT NULL,
    institution_name VARCHAR(255),
    board_id INT,
    other_board_name VARCHAR(255),
    passing_month VARCHAR(20),
    passing_year INT,
    percentage DECIMAL(5,2),
    marksheet_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
    FOREIGN KEY (board_id) REFERENCES education_boards(id)
);

CREATE TABLE IF NOT EXISTS higher_education (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL,
    level ENUM('UG', 'PG') NOT NULL,
    degree_id INT,
    specialization_id INT,
    institution_name VARCHAR(255),
    university_name VARCHAR(255),
    university_type_id INT,
    passing_month VARCHAR(20),
    passing_year INT,
    score_type ENUM('Percentage', 'CGPA'),
    score_value DECIMAL(5,2),
    marksheet_path VARCHAR(255),
    consolidated_marksheet_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
    FOREIGN KEY (degree_id) REFERENCES degree_types(id),
    FOREIGN KEY (specialization_id) REFERENCES specializations(id),
    FOREIGN KEY (university_type_id) REFERENCES university_types(id)
);

CREATE TABLE IF NOT EXISTS experience_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL,
    designation VARCHAR(255),
    organization_name VARCHAR(255),
    employment_type_id INT,
    from_month VARCHAR(20),
    from_year INT,
    to_month VARCHAR(20),
    to_year INT,
    total_years INT,
    total_months INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
    FOREIGN KEY (employment_type_id) REFERENCES employment_types(id)
);

-- Seed Initial Master Data
INSERT IGNORE INTO education_boards (board_name) VALUES 
('State Board'), ('CBSE'), ('ICSE'), ('Matriculation'), ('Open School'), ('Others');

INSERT IGNORE INTO degree_types (degree_name, level) VALUES 
('B.Sc.', 'UG'), ('B.A.', 'UG'), ('B.Com.', 'UG'), ('B.E.', 'UG'), ('B.Tech.', 'UG'),
('M.Sc.', 'PG'), ('M.A.', 'PG'), ('M.Com.', 'PG'), ('M.E.', 'PG'), ('M.Tech.', 'PG'), ('M.Phil.', 'PG');

INSERT IGNORE INTO university_types (type_name) VALUES 
('State University'), ('Central University'), ('Deemed University'), ('Private University'), ('Autonomous College');

INSERT IGNORE INTO employment_types (type_name) VALUES 
('Regular'), ('Temporary'), ('Contract'), ('Part-Time'), ('Visiting');

INSERT IGNORE INTO specializations (spec_name) VALUES 
('Computer Science'), ('Mathematics'), ('Physics'), ('Chemistry'), ('Biology'), ('English'), ('History'), ('Commerce');
