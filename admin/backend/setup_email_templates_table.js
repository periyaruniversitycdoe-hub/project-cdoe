const db = require('./config/db');

const setupTable = async () => {
    try {
        console.log('Starting migration to create email_templates table...');
        
        await db.execute(`
            CREATE TABLE IF NOT EXISTS email_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                template_key VARCHAR(100) UNIQUE NOT NULL,
                template_name VARCHAR(255) NOT NULL,
                template_type VARCHAR(100) NOT NULL,
                template_config JSON NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        
        console.log('✅ email_templates table created or verified successfully!');
        
        // Let's seed a sample template so there is initial data
        const sampleConfig = {
            subject: "Ph.D. Interview Call Letter",
            greeting: "Dear {{student_name}}",
            message: "We are pleased to inform you that you have been shortlisted for the Ph.D. Interview in the department of {{department}}. Your application number is {{application_no}}. Please be present at the venue on time with all your original certificates.",
            buttonText: "Download Interview Call",
            buttonUrl: "https://portal.periyaruniversity.ac.in/admission/interview",
            theme: "university-blue",
            footer: "Office of Ph.D. Admissions, Periyar University",
            logo: "/uploads/logos/default-logo.png"
        };
        
        const [rows] = await db.execute('SELECT id FROM email_templates WHERE template_key = ?', ['interview_call']);
        if (rows.length === 0) {
            await db.execute(`
                INSERT INTO email_templates (template_key, template_name, template_type, template_config, is_active)
                VALUES (?, ?, ?, ?, ?)
            `, [
                'interview_call',
                'Interview Call Letter Template',
                'Interview Call',
                JSON.stringify(sampleConfig),
                true
            ]);
            console.log('🌱 Seeded sample template interview_call!');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
};

setupTable();
