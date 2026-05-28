-- Safe Migration for Enterprise Payment Flow

-- 1. Extend applications.payment_status enum
ALTER TABLE applications 
MODIFY COLUMN payment_status ENUM('Unpaid', 'Pending', 'Processing', 'Success', 'Paid', 'Failed', 'Verified', 'Approved', 'Rejected') DEFAULT 'Pending';

-- 2. Add verification and approval fields to payments table if they don't exist
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) DEFAULT NULL AFTER gateway,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT NULL AFTER payment_mode,
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100) DEFAULT NULL AFTER transaction_id,
  ADD COLUMN IF NOT EXISTS payment_verified TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_approved TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL;

-- 3. Payment Notifications table for Admin Dashboard Queue
CREATE TABLE IF NOT EXISTS payment_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id VARCHAR(50) NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) DEFAULT NULL,
  transaction_id VARCHAR(100),
  payment_method VARCHAR(50),
  status ENUM('Pending Verification', 'Verified', 'Approved', 'Rejected') DEFAULT 'Pending Verification',
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
