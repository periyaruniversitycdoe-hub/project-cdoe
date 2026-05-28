
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true
    });

    try {
        console.log('Reading SQL file...');
        const sql = fs.readFileSync(path.join(__dirname, 'setup_admin_db.sql'), 'utf8');
        
        console.log('Executing SQL...');
        await connection.query(sql);
        
        console.log('Database seeded successfully!');
    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        await connection.end();
    }
}

seed();
