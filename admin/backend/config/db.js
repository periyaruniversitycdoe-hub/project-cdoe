
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
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

// Verify connection on startup
pool.getConnection()
    .then(conn => {
        console.log('✅ MySQL Database Connected Successfully!');
        conn.release();
    })
    .catch(err => {
        console.error('❌ MySQL Database Connection Failed:', err.message);
    });

module.exports = pool;
