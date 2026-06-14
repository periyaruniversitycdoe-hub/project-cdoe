-- Home Manager Module Migration
-- Drives all dynamic content on the Student Admission Portal homepage.

-- ── Action Buttons ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS home_action_buttons (
    id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    btn_type    ENUM('apply_now','applicant_login','download_prospectus','instruction','custom') NOT NULL DEFAULT 'custom',
    url         VARCHAR(500)  DEFAULT NULL,
    icon        VARCHAR(50)   DEFAULT NULL,
    bg_color    VARCHAR(20)   DEFAULT '#009688',
    text_color  VARCHAR(20)   DEFAULT '#ffffff',
    sort_order  INT           NOT NULL DEFAULT 0,
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO home_action_buttons (id, name, btn_type, icon, bg_color, text_color, sort_order, is_active) VALUES
    (1, 'Download Prospectus', 'download_prospectus', 'Download', '#009688', '#ffffff', 1, 1),
    (2, 'Instruction',         'instruction',         'Info',     '#FF8F00', '#ffffff', 2, 1),
    (3, 'Apply Now',           'apply_now',           'GraduationCap', '#6A1B9A', '#ffffff', 3, 1),
    (4, 'Applicant Login',     'applicant_login',     'LogIn',    '#2E7D32', '#ffffff', 4, 1);

-- ── Quick Links ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS home_quick_links (
    id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    url         VARCHAR(500)  DEFAULT NULL,
    link_type   ENUM('internal','external') NOT NULL DEFAULT 'internal',
    icon        VARCHAR(50)   DEFAULT NULL,
    color       VARCHAR(20)   DEFAULT '#6A1B9A',
    sort_order  INT           NOT NULL DEFAULT 0,
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO home_quick_links (id, name, url, link_type, color, sort_order, is_active) VALUES
    (1, 'Apply Now (New Application)',  '/register',         'internal', '#6A1B9A', 1, 1),
    (2, 'Existing Applicant Login',     '/login',            'internal', '#2E7D32', 2, 1),
    (3, 'Forgot Password',              '/forgot-password',  'internal', '#E65100', 3, 1);

-- ── Contact Manager ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS home_contacts (
    id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    contact_type ENUM('email','mobile','landline','whatsapp','website','address') NOT NULL DEFAULT 'email',
    label        VARCHAR(100)  DEFAULT NULL,
    value        VARCHAR(500)  NOT NULL,
    sort_order   INT           NOT NULL DEFAULT 0,
    is_active    TINYINT(1)    NOT NULL DEFAULT 1,
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO home_contacts (id, contact_type, label, value, sort_order, is_active) VALUES
    (1, 'email',   'Email',   'admissions@periyaruniversity.ac.in', 1, 1),
    (2, 'landline','Phone',   '0427-2345766',                      2, 1),
    (3, 'address', 'Address', 'Salem – 636 011, Tamil Nadu, India', 3, 1);

-- ── Layout Manager ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS home_layout (
    id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    block_key   VARCHAR(50)  NOT NULL UNIQUE,
    block_label VARCHAR(100) NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO home_layout (block_key, block_label, sort_order, is_active) VALUES
    ('admission_notifications', 'Admission Notifications',       1, 1),
    ('guidelines',              'Guidelines to Fill Application', 2, 1),
    ('important_dates',         'Important Dates',               3, 1),
    ('quick_links',             'Quick Links',                   4, 1),
    ('contact',                 'Contact Us',                    5, 1);

-- ── Audit Logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS home_audit_logs (
    id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    action       ENUM('create','update','delete','toggle','reorder') NOT NULL,
    section      VARCHAR(50)   NOT NULL,
    entity_id    INT           DEFAULT NULL,
    old_value    TEXT          DEFAULT NULL,
    new_value    TEXT          DEFAULT NULL,
    performed_by VARCHAR(100)  DEFAULT NULL,
    ip_address   VARCHAR(45)   DEFAULT NULL,
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
