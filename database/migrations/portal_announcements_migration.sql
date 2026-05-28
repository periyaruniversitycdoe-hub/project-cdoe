-- Migration: Add Portal Announcements Table for Live Moving Marquee
USE rsm_db;

CREATE TABLE IF NOT EXISTS portal_announcements (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    announcement_text     VARCHAR(500) NOT NULL,
    session_text          VARCHAR(100) DEFAULT NULL,
    text_color            VARCHAR(50) DEFAULT '#ffffff',
    background_color      VARCHAR(50) DEFAULT '#991b1b',
    animation_speed       INT DEFAULT 15,
    is_scrolling_enabled  TINYINT(1) DEFAULT 1,
    is_active             TINYINT(1) DEFAULT 1,
    display_order         INT DEFAULT 0,
    created_by            INT DEFAULT NULL,
    updated_by            INT DEFAULT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
