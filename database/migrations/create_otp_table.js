'use strict';

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the root .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rsm_db',
    connectionLimit: 1
  });

  console.log('[Migration] Connecting to database...');
  try {
    const conn = await pool.getConnection();
    console.log('[Migration] Database connection successful.');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        email       VARCHAR(255) NOT NULL,
        portal      ENUM('student','admin','supervisor','center') NOT NULL,
        otp         VARCHAR(6) NOT NULL,
        expires_at  DATETIME NOT NULL,
        verified    TINYINT(1) DEFAULT 0,
        attempts    INT DEFAULT 0,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_portal (email, portal)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    console.log('[Migration] Creating table password_reset_otps...');
    await conn.query(createTableQuery);
    console.log('[Migration] Table password_reset_otps created or already exists.');

    conn.release();
    await pool.end();
    console.log('[Migration] Migration completed successfully.');
  } catch (err) {
    console.error('[Migration] Migration failed:', err);
    process.exit(1);
  }
}

run();
