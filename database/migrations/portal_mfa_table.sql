-- portal_mfa — MFA secrets for supervisor and center portal users
-- Admin uses the existing admin_mfa table; this covers supervisor + center.
CREATE TABLE IF NOT EXISTS portal_mfa (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    portal      ENUM('supervisor', 'center') NOT NULL,
    user_id     INT NOT NULL,
    secret      VARCHAR(500) NOT NULL,
    is_enabled  TINYINT(1) NOT NULL DEFAULT 0,
    setup_at    DATETIME DEFAULT NULL,
    last_used_at DATETIME DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_portal_user (portal, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
