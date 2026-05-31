const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT || '3306'),
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
    try {
        console.log('Altering applications.status column from ENUM to VARCHAR(50) to resolve duplicate/case-insensitivity issues...');
        await conn.query(`
            ALTER TABLE applications 
            MODIFY COLUMN status VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Draft'
        `);
        console.log('✅ Column applications.status successfully converted to VARCHAR(50)!');
    } catch(e) {
        console.error('❌ Alter failed:', e);
    } finally {
        await conn.end();
    }
}
run();
