
const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateSchema() {
    const pool = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        charset: 'utf8mb4'
    });

    try {
        console.log('Extending university_settings schema...');
        const [columns] = await pool.execute('SHOW COLUMNS FROM university_settings');
        const existing = columns.map(c => c.Field);

        const newCols = [
            { name: 'header_line1', type: 'VARCHAR(500)' },
            { name: 'header_line2', type: 'VARCHAR(500)' },
            { name: 'header_line3', type: 'VARCHAR(500)' },
            { name: 'header_title', type: 'VARCHAR(500)' },
            { name: 'info_text1', type: 'TEXT' },
            { name: 'info_text2', type: 'TEXT' },
            { name: 'logo2', type: 'VARCHAR(255)' },
            { name: 'prospectus', type: 'VARCHAR(255)' },
            { name: 'instruction_file', type: 'VARCHAR(255)' },
            { name: 'syllabus_file', type: 'VARCHAR(255)' },
            { name: 'apply_now_enabled', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'apply_now_open', type: 'DATE' },
            { name: 'apply_now_close', type: 'DATE' },
            { name: 'applicant_login_enabled', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'applicant_login_open', type: 'DATE' },
            { name: 'applicant_login_close', type: 'DATE' },
            { name: 'hall_ticket_enabled', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'hall_ticket_open', type: 'DATE' },
            { name: 'hall_ticket_close', type: 'DATE' },
            { name: 'last_payment_date', type: 'DATE' },
            { name: 'exam_date', type: 'DATE' },
            { name: 'exam_time', type: 'VARCHAR(50)' },
            { name: 'interview_date', type: 'DATE' },
            { name: 'interview_time', type: 'VARCHAR(50)' },
            { name: 'certificate_validity', type: 'VARCHAR(255)' },
            { name: 'certificate_date', type: 'DATE' },
            { name: 'entrance_max_mark', type: 'INT' },
            { name: 'entrance_calculated_to', type: 'INT' },
            { name: 'entrance_min_mark', type: 'INT' },
            { name: 'interview_max_mark', type: 'INT' },
            { name: 'interview_calculated_to', type: 'INT' },
            { name: 'home_page_pdf', type: 'VARCHAR(255)' },
            { name: 'home_page_content', type: 'LONGTEXT' },
            { name: 'home_page_type', type: 'ENUM(\"pdf\",\"content\") DEFAULT \"pdf\"' },
            { name: 'online_app_link', type: 'VARCHAR(500)' },
            { name: 'online_app_enabled', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'merit_list_link', type: 'VARCHAR(500)' },
            { name: 'merit_list_enabled', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'eligible_list_enabled', type: 'TINYINT(1) DEFAULT 0' },
        ];

        for (const col of newCols) {
            if (!existing.includes(col.name)) {
                console.log(`  Adding: ${col.name}`);
                await pool.execute(`ALTER TABLE university_settings ADD COLUMN ${col.name} ${col.type}`);
            } else {
                console.log(`  Exists: ${col.name}`);
            }
        }

        // Community fees table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS community_fees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                community VARCHAR(100) NOT NULL,
                pg_min_mark DECIMAL(5,2) DEFAULT NULL,
                fee_general INT DEFAULT NULL,
                fee_diff_abled INT DEFAULT NULL,
                sort_order INT DEFAULT 0
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('community_fees table ready.');

        // Check if seeds exist
        const [existing_fees] = await pool.execute('SELECT COUNT(*) as cnt FROM community_fees');
        if (existing_fees[0].cnt === 0) {
            const communities = [
                ['OC', 55, 1000, 500, 1],
                ['BC', 55, 1000, 500, 2],
                ['BC(Muslim)', 55, 1000, 500, 3],
                ['MBC', 55, 1000, 500, 4],
                ['DNC', 55, 1000, 500, 5],
                ['OBC', null, null, null, 6],
                ['OBC - Non Creamy Layer', null, null, null, 7],
                ['SC', 50, 500, 500, 8],
                ['SC(A)', 50, 500, 500, 9],
                ['ST', 50, 500, 500, 10],
            ];
            for (const [community, pg_min_mark, fee_general, fee_diff_abled, sort_order] of communities) {
                await pool.execute(
                    'INSERT INTO community_fees (community, pg_min_mark, fee_general, fee_diff_abled, sort_order) VALUES (?, ?, ?, ?, ?)',
                    [community, pg_min_mark, fee_general, fee_diff_abled, sort_order]
                );
            }
            console.log('Community fees seeded.');
        }

        // Update existing settings row with reference values
        await pool.execute(`
            UPDATE university_settings SET
                header_line1 = 'PERIYAR UNIVERSITY',
                header_line2 = 'State University - NAAC ''A++'' GRADE - NIRF Rank 94 State Public University Rank 40 - SDG Institutions Rank Band: 11-50',
                header_line3 = 'Salem - 636011, Tamil Nadu, INDIA',
                info_text1 = 'December 2025 Session - Ph.D. Common Entrance Test - Result Certificate Available',
                info_text2 = 'COUNSELLING Date : 24-03-2026 & 25-03-2026',
                apply_now_enabled = 0, apply_now_open = '2025-12-19', apply_now_close = '2026-01-23',
                applicant_login_enabled = 1, applicant_login_open = '2026-03-18', applicant_login_close = '2026-03-31',
                hall_ticket_enabled = 0, hall_ticket_open = '2026-02-25', hall_ticket_close = '2026-03-02',
                last_payment_date = '2026-01-31', exam_date = '2026-03-01',
                certificate_validity = 'This Session only', certificate_date = '2026-03-18',
                entrance_max_mark = 70, entrance_calculated_to = 70, entrance_min_mark = 28,
                online_app_enabled = 1, merit_list_enabled = 1, eligible_list_enabled = 0
            WHERE id = 1
        `);
        console.log('Settings seeded with reference values.');

        console.log('✅ Schema migration complete!');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

updateSchema();
