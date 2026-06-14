
const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTamil() {
    const pool = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        charset: 'utf8mb4'
    });

    try {
        console.log('Updating Tamil branding...');
        const tamilName = 'பெரியார் பல்கலைக்கழகம்';
        await pool.execute('UPDATE university_settings SET university_name_ta = ? WHERE id = 1', [tamilName]);
        
        const [rows] = await pool.execute('SELECT university_name_ta FROM university_settings WHERE id = 1');
        console.log('Verified Name:', rows[0].university_name_ta);
        console.log('✅ Tamil branding fixed successfully!');
    } catch (err) {
        console.error('❌ Fix failed:', err.message);
    } finally {
        await pool.end();
    }
}

fixTamil();
