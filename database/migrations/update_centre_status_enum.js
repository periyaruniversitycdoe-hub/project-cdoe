const pool = require('../../admin/backend/config/db');

(async () => {
    try {
        console.log('Starting migration to update status ENUM of research_centres...');
        
        // Update research_centres status ENUM
        await pool.query(`
            ALTER TABLE research_centres 
            MODIFY COLUMN status ENUM('Pending', 'Approved', 'Rejected', 'Suspended') 
            DEFAULT 'Pending'
        `);
        console.log('✅ Successfully updated status ENUM in research_centres table!');
        
        process.exit(0);
    } catch (e) {
        console.error('❌ Migration failed:', e.message);
        process.exit(1);
    }
})();
