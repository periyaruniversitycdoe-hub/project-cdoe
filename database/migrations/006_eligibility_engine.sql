-- ============================================================
-- 006_eligibility_engine.sql
-- Department → Programme Offered → Eligibility Engine
-- Safe additive migration — does NOT touch existing tables
-- ============================================================

-- 1. Departments master
CREATE TABLE IF NOT EXISTS departments (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    is_active  TINYINT(1)  NOT NULL DEFAULT 1,
    created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dept_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Programmes offered (child of departments)
CREATE TABLE IF NOT EXISTS programs_offered (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT          NOT NULL,
    name          VARCHAR(255) NOT NULL,
    is_active     TINYINT(1)  NOT NULL DEFAULT 1,
    created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE KEY uq_prog_dept_name (department_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Eligible PG courses per programme
CREATE TABLE IF NOT EXISTS program_pg_eligibility (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    program_id  INT          NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs_offered(id) ON DELETE CASCADE,
    UNIQUE KEY uq_pg_elig (program_id, course_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Eligible M.Phil courses per programme
CREATE TABLE IF NOT EXISTS program_mphil_eligibility (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    program_id  INT          NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs_offered(id) ON DELETE CASCADE,
    UNIQUE KEY uq_mphil_elig (program_id, course_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Audit log for all eligibility CRUD
CREATE TABLE IF NOT EXISTS eligibility_audit_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    admin_id    INT          NULL,
    action      VARCHAR(50)  NOT NULL,
    entity_type VARCHAR(50)  NOT NULL,
    entity_id   INT          NULL,
    old_value   TEXT         NULL,
    new_value   TEXT         NULL,
    ip_address  VARCHAR(45)  NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Extend applications table (safe — ignored if columns already exist)
-- department_id  : FK to departments
-- program_offered_id : FK to programs_offered
-- program_offered_name : denormalised name for fast display
-- (subject column kept unchanged for backward-compatibility)
