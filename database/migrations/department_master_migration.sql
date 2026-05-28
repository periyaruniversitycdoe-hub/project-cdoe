CREATE TABLE IF NOT EXISTS dropdown_departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

-- Insert existing distinct departments from venues as initial master data
INSERT IGNORE INTO dropdown_departments (name)
SELECT DISTINCT department FROM venues WHERE department IS NOT NULL AND department != '';

-- Add trigger or just use cascading updates if we ever added a foreign key. 
-- Since we are keeping it safe and backward compatible, we will just use the name as reference everywhere.
