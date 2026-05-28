-- ============================================================
-- FEATURES MIGRATION — Production University ERP
-- Run against: rsm_db  |  MySQL 8+ compatible
-- ============================================================

-- Helper procedure: add column only when it does not already exist
DROP PROCEDURE IF EXISTS _add_col;
DELIMITER $$
CREATE PROCEDURE _add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @_sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE _s FROM @_sql;
    EXECUTE _s;
    DEALLOCATE PREPARE _s;
  END IF;
END$$
DELIMITER ;

-- ─── FEATURE 3: Permanent Address fields ─────────────────────
CALL _add_col('applications', 'perm_same_as_comm', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL _add_col('applications', 'perm_address_1',    'VARCHAR(255) NULL');
CALL _add_col('applications', 'perm_address_2',    'VARCHAR(255) NULL');
CALL _add_col('applications', 'perm_address_3',    'VARCHAR(255) NULL');
CALL _add_col('applications', 'perm_state',        'VARCHAR(100) NULL');
CALL _add_col('applications', 'perm_district',     'VARCHAR(100) NULL');
CALL _add_col('applications', 'perm_city',         'VARCHAR(100) NULL');
CALL _add_col('applications', 'perm_pincode',      'VARCHAR(10) NULL');

-- ─── FEATURE 4: Per-file-type upload settings ────────────────
CREATE TABLE IF NOT EXISTS file_upload_settings (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  file_type           VARCHAR(50)  NOT NULL UNIQUE,
  max_size            INT          NOT NULL DEFAULT 500,
  size_unit           ENUM('KB','MB') NOT NULL DEFAULT 'KB',
  allowed_extensions  VARCHAR(255) NOT NULL DEFAULT 'jpg,jpeg,png,pdf',
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO file_upload_settings (file_type, max_size, size_unit, allowed_extensions) VALUES
  ('Photo',                  200, 'KB', 'jpg,jpeg,png'),
  ('Signature',              100, 'KB', 'jpg,jpeg,png'),
  ('ID Proof',               500, 'KB', 'jpg,jpeg,png,pdf'),
  ('Community Certificate',    1, 'MB', 'jpg,jpeg,png,pdf'),
  ('PC Certificate',           1, 'MB', 'jpg,jpeg,png,pdf'),
  ('Mark Sheet',               2, 'MB', 'jpg,jpeg,png,pdf');

-- ─── FEATURE 6: States & Districts ───────────────────────────
CREATE TABLE IF NOT EXISTS states (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  state_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS districts (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  state_id      INT NOT NULL,
  district_name VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_district_state FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE CASCADE
);

INSERT IGNORE INTO states (state_name) VALUES
  ('Andhra Pradesh'),('Arunachal Pradesh'),('Assam'),('Bihar'),('Chhattisgarh'),
  ('Goa'),('Gujarat'),('Haryana'),('Himachal Pradesh'),('Jharkhand'),
  ('Karnataka'),('Kerala'),('Madhya Pradesh'),('Maharashtra'),('Manipur'),
  ('Meghalaya'),('Mizoram'),('Nagaland'),('Odisha'),('Punjab'),
  ('Rajasthan'),('Sikkim'),('Tamil Nadu'),('Telangana'),('Tripura'),
  ('Uttar Pradesh'),('Uttarakhand'),('West Bengal'),
  ('Andaman and Nicobar Islands'),('Chandigarh'),
  ('Dadra and Nagar Haveli and Daman and Diu'),('Lakshadweep'),
  ('Delhi'),('Puducherry'),('Ladakh'),('Jammu and Kashmir');

INSERT IGNORE INTO districts (state_id, district_name)
SELECT s.id, d.name
FROM states s
JOIN (
  SELECT 'Ariyalur'         AS name UNION ALL SELECT 'Chengalpattu'
  UNION ALL SELECT 'Chennai'         UNION ALL SELECT 'Coimbatore'
  UNION ALL SELECT 'Cuddalore'       UNION ALL SELECT 'Dharmapuri'
  UNION ALL SELECT 'Dindigul'        UNION ALL SELECT 'Erode'
  UNION ALL SELECT 'Kallakurichi'    UNION ALL SELECT 'Kancheepuram'
  UNION ALL SELECT 'Kanniyakumari'   UNION ALL SELECT 'Karur'
  UNION ALL SELECT 'Krishnagiri'     UNION ALL SELECT 'Madurai'
  UNION ALL SELECT 'Mayiladuthurai'  UNION ALL SELECT 'Nagapattinam'
  UNION ALL SELECT 'Namakkal'        UNION ALL SELECT 'Nilgiris'
  UNION ALL SELECT 'Perambalur'      UNION ALL SELECT 'Pudukkottai'
  UNION ALL SELECT 'Ramanathapuram'  UNION ALL SELECT 'Ranipet'
  UNION ALL SELECT 'Salem'           UNION ALL SELECT 'Sivaganga'
  UNION ALL SELECT 'Tenkasi'         UNION ALL SELECT 'Thanjavur'
  UNION ALL SELECT 'Theni'           UNION ALL SELECT 'Thoothukudi'
  UNION ALL SELECT 'Tiruchirappalli' UNION ALL SELECT 'Tirunelveli'
  UNION ALL SELECT 'Tirupathur'      UNION ALL SELECT 'Tiruppur'
  UNION ALL SELECT 'Tiruvallur'      UNION ALL SELECT 'Tiruvannamalai'
  UNION ALL SELECT 'Tiruvarur'       UNION ALL SELECT 'Vellore'
  UNION ALL SELECT 'Viluppuram'      UNION ALL SELECT 'Virudhunagar'
) d ON s.state_name = 'Tamil Nadu';

-- ─── FEATURE 7: Payment status ───────────────────────────────
CALL _add_col('applications', 'payment_status',    "ENUM('Unpaid','Paid','Failed') NOT NULL DEFAULT 'Unpaid'");
CALL _add_col('applications', 'payment_reference', 'VARCHAR(100) NULL');
CALL _add_col('applications', 'payment_date',      'TIMESTAMP NULL');

-- ─── FEATURES 8 & 9: Entrance mark & Admission approval ──────
CALL _add_col('applications', 'entrance_mark',         'DECIMAL(5,2) NULL');
CALL _add_col('applications', 'qualification_status',  "ENUM('Pending','Qualified','Direct Qualified','Failed') NOT NULL DEFAULT 'Pending'");
CALL _add_col('applications', 'admission_approved',    'TINYINT(1) NOT NULL DEFAULT 0');
CALL _add_col('applications', 'admission_approved_at', 'TIMESTAMP NULL');
CALL _add_col('applications', 'remarks',               'TEXT NULL');

-- Entrance passing criteria (single-row config)
CREATE TABLE IF NOT EXISTS entrance_settings (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  passing_mark DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  total_mark   DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO entrance_settings (id, passing_mark, total_mark) VALUES (1, 50.00, 100.00);

-- ─── MISSING DROPDOWN TABLES ─────────────────────────────────
CREATE TABLE IF NOT EXISTS dropdown_id_types (
  id   INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO dropdown_id_types (name) VALUES
  ('Aadhaar No'),('PAN Card'),('Passport'),('Voter ID'),('Driving Licence');

CREATE TABLE IF NOT EXISTS dropdown_score_types (
  id   INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO dropdown_score_types (name) VALUES
  ('Percentage'),('CGPA');

CREATE TABLE IF NOT EXISTS dropdown_mark_statement_types (
  id   INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO dropdown_mark_statement_types (name) VALUES
  ('Individual Mark Statement'),('Consolidated Mark Statement');

-- ─── INDEXES ─────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _add_col;
