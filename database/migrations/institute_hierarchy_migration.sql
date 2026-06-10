-- ============================================================
-- INSTITUTE HIERARCHY RESTRUCTURE MIGRATION
-- Database: rsm_db
-- Implements: University → Institute → Research Center → Supervisor
-- Run once to add new tables and columns
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- NEW: University Institute Master
-- Independent entity; parent of Research Centers
-- ============================================================

CREATE TABLE IF NOT EXISTS institutes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    institute_name   VARCHAR(300) NOT NULL,
    institute_type   VARCHAR(100) NOT NULL,
    institute_code   VARCHAR(50)  NOT NULL,
    address_line_1   VARCHAR(300) DEFAULT NULL,
    address_line_2   VARCHAR(300) DEFAULT NULL,
    address_line_3   VARCHAR(300) DEFAULT NULL,
    district         VARCHAR(100) DEFAULT NULL,
    state            VARCHAR(100) DEFAULT NULL,
    pincode          VARCHAR(10)  DEFAULT NULL,
    mobile_no        VARCHAR(15)  DEFAULT NULL,
    phone_no         VARCHAR(20)  DEFAULT NULL,
    email            VARCHAR(200) DEFAULT NULL,
    website          VARCHAR(300) DEFAULT NULL,
    remarks          TEXT         DEFAULT NULL,
    status           ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
    created_by       INT          DEFAULT NULL,
    updated_by       INT          DEFAULT NULL,
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_institute_code (institute_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit log for institute master operations
CREATE TABLE IF NOT EXISTS institute_master_audit_log (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    action       VARCHAR(50)  NOT NULL,
    institute_id INT          DEFAULT NULL,
    admin_id     INT          DEFAULT NULL,
    ip_address   VARCHAR(50)  DEFAULT NULL,
    old_value    JSON         DEFAULT NULL,
    new_value    JSON         DEFAULT NULL,
    extra_info   JSON         DEFAULT NULL,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ALTER research_centres: add university_institute_id FK
-- (keeps existing institute_id → master_institutes intact)
-- ============================================================

ALTER TABLE research_centres
    ADD COLUMN university_institute_id INT DEFAULT NULL AFTER institute_id;

ALTER TABLE research_centres
    ADD CONSTRAINT fk_rc_uni_institute
    FOREIGN KEY (university_institute_id)
    REFERENCES institutes(id)
    ON DELETE SET NULL;

-- ============================================================
-- ALTER supervisors: add research_center_id + university_institute_id
-- (keeps existing serving_institute_id → master_institutes intact)
-- ============================================================

ALTER TABLE supervisors
    ADD COLUMN research_center_id INT DEFAULT NULL AFTER serving_institute_id;

ALTER TABLE supervisors
    ADD COLUMN university_institute_id INT DEFAULT NULL AFTER research_center_id;

ALTER TABLE supervisors
    ADD CONSTRAINT fk_sup_research_center
    FOREIGN KEY (research_center_id)
    REFERENCES research_centres(id)
    ON DELETE SET NULL;

ALTER TABLE supervisors
    ADD CONSTRAINT fk_sup_uni_institute
    FOREIGN KEY (university_institute_id)
    REFERENCES institutes(id)
    ON DELETE SET NULL;

-- Seed default institute types (informational)
-- Admin can add more via the Institute Master UI

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
