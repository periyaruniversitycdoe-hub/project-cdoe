CREATE TABLE IF NOT EXISTS community_fee_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    community_name VARCHAR(50) NOT NULL UNIQUE,
    fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO community_fee_master (community_name, fee_amount) VALUES 
('OC', 1500.00),
('BC', 1500.00),
('BCM', 1500.00),
('MBC', 1500.00),
('SC', 500.00),
('SCA', 500.00),
('ST', 500.00);
