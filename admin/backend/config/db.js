
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../../.env') });


const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    charset: 'utf8mb4',
    connectTimeout: 60000,
    ssl: process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') && !process.env.DB_HOST.includes('127.0.0.1')
        ? { rejectUnauthorized: false }
        : undefined,
});

// Verify connection on startup
pool.getConnection()
    .then(conn => {
        console.log('✅ MySQL Database Connected Successfully!');
        conn.release();
    })
    .catch(err => {
        console.error('❌ MySQL Database Connection Failed:', err.message, 'with config:', {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            database: process.env.DB_NAME
        });
    });

module.exports = pool;
