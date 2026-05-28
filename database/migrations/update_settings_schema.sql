
-- Enterprise Settings Schema Update
USE rsm_db;

-- 1. Re-create university_settings table for exact parity with requirements
DROP TABLE IF EXISTS university_settings;
CREATE TABLE university_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    university_name_en VARCHAR(255),
    university_name_ta VARCHAR(255),
    subtitle VARCHAR(255),
    naac_details VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url VARCHAR(255),
    founder_image_url VARCHAR(255),
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

-- 2. Create Audit Logs table
CREATE TABLE IF NOT EXISTS settings_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT,
    action VARCHAR(255), 
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Create Uploads table
CREATE TABLE IF NOT EXISTS uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    mimetype VARCHAR(100),
    size INT,
    path VARCHAR(255),
    purpose VARCHAR(100), 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Admin Roles and Permissions
CREATE TABLE IF NOT EXISTS admin_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT,
    permission_id INT,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE
);

-- Seed initial data
INSERT INTO admin_roles (role_name, description) VALUES ('Super Admin', 'Full access to all modules');
INSERT INTO admin_permissions (permission_name) VALUES ('manage_settings'), ('manage_applications'), ('manage_users'), ('view_audit_logs');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r CROSS JOIN admin_permissions p WHERE r.role_name = 'Super Admin';

INSERT INTO university_settings (
    university_name_en, university_name_ta, subtitle, naac_details, address, phone, email, website, 
    logo_url, footer_text, copyright_text, payment_button_text
) VALUES (
    'Periyar University', 'பெரியார் பல்கலைக்கழகம்', 'Periyar Palkalai Nagar', 'NAAC A++ Grade - State University', 
    'Salem, Tamil Nadu, India', '+91-427-2345766', 'registrar@periyaruniversity.ac.in', 'https://www.periyaruniversity.ac.in', 
    '/uploads/settings/pu_logo.png', 'Periyar Palkalai Nagar, Salem-636011, Tamil Nadu, India', 
    '© 2026 Periyar University. All Rights Reserved.', 'Pay Admission Fee'
);
