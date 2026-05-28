
const pool = require('../admin/backend/config/db');

async function migrate() {
    try {
        console.log('--- Starting Approval Workflow Migration ---');

        // 1. Supervisors Table
        // Ensure status field matches our requirements and add rejection/approval fields
        const [supCols] = await pool.query('SHOW COLUMNS FROM supervisors');
        const supFields = supCols.map(c => c.Field);

        if (!supFields.includes('rejection_reason')) {
            await pool.query('ALTER TABLE supervisors ADD COLUMN rejection_reason TEXT NULL AFTER status');
            console.log('Added rejection_reason to supervisors');
        }
        if (!supFields.includes('approved_by')) {
            await pool.query('ALTER TABLE supervisors ADD COLUMN approved_by INT NULL AFTER rejection_reason');
            console.log('Added approved_by to supervisors');
        }
        if (!supFields.includes('approved_at')) {
            await pool.query('ALTER TABLE supervisors ADD COLUMN approved_at DATETIME NULL AFTER approved_by');
            console.log('Added approved_at to supervisors');
        }

        // 2. Research Centres Table
        const [cenCols] = await pool.query('SHOW COLUMNS FROM research_centres');
        const cenFields = cenCols.map(c => c.Field);

        if (!cenFields.includes('status')) {
            await pool.query("ALTER TABLE research_centres ADD COLUMN status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending' AFTER is_active");
            console.log('Added status to research_centres');
        } else {
             // Ensure it has the right ENUM values
             await pool.query("ALTER TABLE research_centres MODIFY COLUMN status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending'");
             console.log('Updated status ENUM in research_centres');
        }

        if (!cenFields.includes('rejection_reason')) {
            await pool.query('ALTER TABLE research_centres ADD COLUMN rejection_reason TEXT NULL AFTER status');
            console.log('Added rejection_reason to research_centres');
        }
        if (!cenFields.includes('approved_by')) {
            await pool.query('ALTER TABLE research_centres ADD COLUMN approved_by INT NULL AFTER rejection_reason');
            console.log('Added approved_by to research_centres');
        }
        if (!cenFields.includes('approved_at')) {
            await pool.query('ALTER TABLE research_centres ADD COLUMN approved_at DATETIME NULL AFTER approved_by');
            console.log('Added approved_at to research_centres');
        }

        console.log('--- Migration Completed Successfully ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
