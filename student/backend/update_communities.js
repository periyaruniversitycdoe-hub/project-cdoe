const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateCommunities() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        await connection.execute('TRUNCATE TABLE dropdown_communities');
        const communities = [
            'OC - Open Category',
            'BC - Backward Class',
            'BCM - Backward Class Muslim',
            'MBC - Most Backward Class',
            'DNC - Denotified Community',
            'SC - Scheduled Caste',
            'SCA - Scheduled Caste (Arunthathiyar)',
            'ST - Scheduled Tribe'
        ];
        
        for (const c of communities) {
            await connection.execute('INSERT INTO dropdown_communities (name) VALUES (?)', [c]);
        }
        
        console.log('Communities updated successfully');
    } catch (err) {
        console.error('Error updating communities:', err);
    } finally {
        await connection.end();
    }
}

updateCommunities();
