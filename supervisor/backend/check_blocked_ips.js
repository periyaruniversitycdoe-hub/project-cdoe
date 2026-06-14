const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'rsm_db',
    };

    const connection = await mysql.createConnection(dbConfig);

    try {
        console.log('--- BLOCKED IPS ---');
        const [rows] = await connection.query('SELECT * FROM blocked_ips');
        console.log(rows);
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

run();
