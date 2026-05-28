/**
 * Centralized MySQL connection pool.
 * All modules import this instead of maintaining separate DB configs.
 * Reads credentials from the root .env file.
 */
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = mysql.createPool({
    host:               process.env.DB_HOST || 'localhost',
    user:               process.env.DB_USER || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME || 'rsm_db',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    charset:            'utf8mb4',
});

pool.getConnection()
    .then(conn => {
        console.log('✅ [Shared DB] MySQL Connected to', process.env.DB_NAME);
        conn.release();
    })
    .catch(err => {
        console.error('❌ [Shared DB] MySQL Connection Failed:', err.message);
    });

module.exports = pool;
