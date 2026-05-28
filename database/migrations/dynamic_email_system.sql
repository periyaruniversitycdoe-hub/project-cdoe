-- ============================================================
-- DYNAMIC EMAIL SERVICE MANAGEMENT SYSTEM
-- ============================================================

USE rsm_db;

-- 1. Table to store dynamic email configurations
CREATE TABLE IF NOT EXISTS email_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_key VARCHAR(100) NOT NULL UNIQUE,
    service_name VARCHAR(255) NOT NULL,
    email_subject VARCHAR(255) NOT NULL,
    email_template TEXT NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table to store email transmission logs
CREATE TABLE IF NOT EXISTS email_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_key VARCHAR(100) NOT NULL,
    recipient_email VARCHAR(200) NOT NULL,
    email_subject VARCHAR(255),
    status ENUM('success', 'failed') NOT NULL,
    error_message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_service (service_key),
    INDEX idx_recipient (recipient_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Seed initial services (Standard University Set)
INSERT IGNORE INTO email_services (service_key, service_name, email_subject, email_template) VALUES
('hall_ticket', 'Hall Ticket Notification', 'PHD Entrance Exam: Hall Ticket Available - {{application_no}}', 
 '<h1>Hello {{student_name}},</h1><p>Your hall ticket for the PhD Entrance Examination is now available for download.</p><p><b>Application No:</b> {{application_no}}</p><p>Please log in to the portal to download it.</p>'),

('result_publish', 'Result Publication', 'PHD Entrance Results Published', 
 '<h1>Dear {{student_name}},</h1><p>Your entrance examination results have been published.</p><p><b>Result Status:</b> {{status}}</p><p>Log in to view your detailed score card.</p>'),

('login_success', 'Login Alert', 'New Login Detected', 
 '<h1>Security Alert</h1><p>Hello {{name}}, a new login was detected on your account at {{time}}.</p><p>IP Address: {{ip}}</p>'),

('registration_success', 'Registration Successful', 'Welcome to PhD Admission Portal', 
 '<h1>Welcome {{full_name}}!</h1><p>Your registration is successful. Your Application ID is: <b>{{application_id}}</b></p>'),

('password_reset', 'Password Reset Request', 'Reset Your Portal Password', 
 '<h1>Reset Your Password</h1><p>Click the link below to reset your password:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>This link expires in 1 hour.</p>'),

('supervisor_approval', 'Supervisor Approval Update', 'PhD Supervisor Recognition Status', 
 '<h1>Hello {{name}},</h1><p>Your supervisor recognition status has been updated to: <b>{{status}}</b></p>{{#if rejection_reason}}<p>Reason: {{rejection_reason}}</p>{{/if}}'),

('interview_notification', 'Interview Call Letter', 'Interview Schedule - {{subject}}', 
 '<h1>Interview Invitation</h1><p>Dear {{student_name}},</p><p>You are invited for the PhD interview for the subject <b>{{subject}}</b>.</p><p><b>Date:</b> {{date}}<br><b>Time:</b> {{time}}</p>');
