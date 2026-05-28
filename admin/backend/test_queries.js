
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testStats() {
    const pool = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('Testing total...');
        await pool.execute('SELECT COUNT(*) as count FROM applications');
        
        console.log('Testing submitted...');
        await pool.execute("SELECT COUNT(*) as count FROM applications WHERE status = 'Submitted'");
        
        console.log('Testing monthly...');
        await pool.execute(`
            SELECT 
                DATE_FORMAT(created_at, '%b %Y') as month,
                COUNT(*) as count
            FROM applications
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%b %Y'), DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY MIN(created_at) ASC
        `);

        console.log('Testing recent...');
        await pool.execute(`
            SELECT a.id, a.application_id, a.subject, a.status, a.created_at, u.full_name, u.email
            FROM applications a 
            JOIN users u ON a.user_id = u.id 
            ORDER BY a.created_at DESC 
            LIMIT 5
        `);

        console.log('✅ All queries passed!');
    } catch (err) {
        console.error('❌ Query failed:', err.message);
        console.error('Stack:', err.stack);
    } finally {
        await pool.end();
    }
}

testStats();
