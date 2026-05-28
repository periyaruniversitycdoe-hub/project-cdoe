-- ============================================================
-- PORTAL USERS TABLES MIGRATION
-- ============================================================

USE rsm_db;

-- 1. Supervisor Portal Users
CREATE TABLE IF NOT EXISTS supervisor_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supervisor_id INT DEFAULT NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) DEFAULT NULL,
    status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_su_supervisor FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Center Portal Users
CREATE TABLE IF NOT EXISTS center_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    center_id INT DEFAULT NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) DEFAULT NULL,
    status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    role ENUM('admin', 'staff') NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cu_center FOREIGN KEY (center_id) REFERENCES research_centres(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
