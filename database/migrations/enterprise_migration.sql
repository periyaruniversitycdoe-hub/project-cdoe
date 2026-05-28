-- =========================================================================
-- ENTERPRISE MIGRATION — PhD Admission Portal v2.0
-- MariaDB 10.4 compatible — safe, non-destructive schema updates
-- =========================================================================

-- ─── 1. Dynamic Qualification Types ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS qualification_types (
    id                  INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    qualification_name  VARCHAR(100) NOT NULL UNIQUE,
    is_exemption        TINYINT(1)   NOT NULL DEFAULT 0,
    is_active           TINYINT(1)   NOT NULL DEFAULT 1,
    display_order       INT          NOT NULL DEFAULT 0,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_qt_active (is_active),
    INDEX idx_qt_order  (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed defaults (INSERT IGNORE = safe on re-run)
INSERT IGNORE INTO qualification_types (qualification_name, is_exemption, is_active, display_order) VALUES
('NET',    1, 1, 1),
('SET',    1, 1, 2),
('JRF',    1, 1, 3),
('SLET',   1, 1, 4),
('GATE',   0, 1, 5),
('M.Phil', 0, 1, 6),
('Other',  0, 1, 7);

-- ─── 2. Normalized Student Qualifications ─────────────────────────────────
CREATE TABLE IF NOT EXISTS student_qualifications (
    id                INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    application_id    VARCHAR(50)  NOT NULL,
    qualification_id  INT          NOT NULL,
    certificate_path  VARCHAR(255) DEFAULT NULL,
    status            ENUM('Active','Removed') NOT NULL DEFAULT 'Active',
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE  KEY uk_app_qual (application_id, qualification_id),
    INDEX   idx_sq_appid    (application_id),
    INDEX   idx_sq_qualid   (qualification_id),
    CONSTRAINT fk_sq_qual FOREIGN KEY (qualification_id)
        REFERENCES qualification_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 3. Alter applications — add entrance_exam_status (MariaDB 10.4 native IF NOT EXISTS) ──
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS entrance_exam_status
        ENUM('Required','Exempted','Completed','Absent') NOT NULL DEFAULT 'Required';

-- ─── 4. Alter experience_details — add state, district, certificate ────────
ALTER TABLE experience_details
    ADD COLUMN IF NOT EXISTS state_id                   INT          DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS district_id                INT          DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS experience_certificate_path VARCHAR(255) DEFAULT NULL;

-- ─── 5. Backfill entrance_exam_status for existing NET/SET/JRF/SLET holders ─
--    Uses JSON_CONTAINS (MariaDB 10.4 supported)
UPDATE applications
SET entrance_exam_status = 'Exempted'
WHERE entrance_exam_status = 'Required'
  AND qualified_exams IS NOT NULL
  AND JSON_LENGTH(qualified_exams) > 0
  AND (
      JSON_CONTAINS(qualified_exams, '"NET"')  = 1 OR
      JSON_CONTAINS(qualified_exams, '"SET"')  = 1 OR
      JSON_CONTAINS(qualified_exams, '"JRF"')  = 1 OR
      JSON_CONTAINS(qualified_exams, '"SLET"') = 1
  );

-- ─── 6. Backfill student_qualifications from existing qualified_exams JSON ──
INSERT IGNORE INTO student_qualifications (application_id, qualification_id, status)
SELECT
    a.application_id,
    qt.id,
    'Active'
FROM applications a
JOIN qualification_types qt
  ON JSON_CONTAINS(a.qualified_exams, JSON_QUOTE(qt.qualification_name)) = 1
WHERE a.qualified_exams IS NOT NULL
  AND JSON_LENGTH(a.qualified_exams) > 0;

-- =========================================================================
-- END OF MIGRATION
-- =========================================================================
