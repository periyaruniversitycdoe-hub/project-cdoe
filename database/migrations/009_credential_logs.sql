-- Migration 009: User Credential Notification Module
-- Creates credential_logs table — stores a record of every portal registration
-- so the admin dashboard can monitor all newly created accounts.
USE rsm_db;

CREATE TABLE IF NOT EXISTS credential_logs (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_name      VARCHAR(255)                                         NOT NULL,
    email          VARCHAR(255)                                         NOT NULL,
    plain_password VARCHAR(255)                                         NOT NULL,
    portal_type    ENUM('Student','Supervisor','Center','Admin')        NOT NULL,
    account_status VARCHAR(50)  NOT NULL DEFAULT 'Active',
    login_url      VARCHAR(500) DEFAULT NULL,
    email_sent     TINYINT(1)   NOT NULL DEFAULT 0,
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_clog_portal  (portal_type),
    INDEX idx_clog_email   (email),
    INDEX idx_clog_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
