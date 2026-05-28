
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
        await pool.execute('UPDATE university_settings SET university_name_tamil = ?, subtitle = ? WHERE id = 1', [tamilName, tamilName]);
        
        const [rows] = await pool.execute('SELECT university_name_tamil, subtitle FROM university_settings WHERE id = 1');
        console.log('Verified Name:', rows[0].university_name_tamil);
        console.log('Verified Subtitle:', rows[0].subtitle);
        console.log('✅ Tamil branding fixed successfully!');
    } catch (err) {
        console.error('❌ Fix failed:', err.message);
    } finally {
        await pool.end();
    }
}

fixTamil();
