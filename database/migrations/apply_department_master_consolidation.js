const pool = require('../../admin/backend/config/db');

(async () => {
    try {
        console.log('🏁 Starting Department Master Consolidation database migration...');

        // 1. Copy unique department records from master_departments to departments
        console.log('⚡ Migrating department records from master_departments to departments...');
        await pool.query(`
            INSERT IGNORE INTO departments (name)
            SELECT name FROM master_departments
        `);
        console.log('✅ Department records copied.');

        // 2. Drop legacy foreign key constraint from supervisors first (so we can change department_id values)
        console.log('⚡ Dropping legacy supervisors foreign key fk_sup_department...');
        try {
            await pool.query(`ALTER TABLE supervisors DROP FOREIGN KEY fk_sup_department`);
            console.log('✅ Legacy foreign key dropped.');
        } catch (err) {
            console.log('ℹ️ Legacy foreign key fk_sup_department drop skipped or already dropped:', err.message);
        }

        // 3. Re-align s.department_id reference on supervisors based on matching department name
        console.log('⚡ Re-aligning supervisor department references...');
        await pool.query(`
            UPDATE supervisors s
            JOIN master_departments md ON s.department_id = md.id
            JOIN departments d ON md.name = d.name
            SET s.department_id = d.id
        `);
        console.log('✅ Supervisor department references re-aligned.');

        // 4. Drop legacy master_departments table
        console.log('⚡ Dropping legacy master_departments table...');
        await pool.query(`DROP TABLE IF EXISTS master_departments`);
        console.log('✅ Legacy table dropped.');

        // 5. Add department_id column to research_centres if missing
        console.log('⚡ Adding department_id to research_centres...');
        try {
            await pool.query(`ALTER TABLE research_centres ADD COLUMN department_id INT NULL`);
            console.log('✅ Column department_id added to research_centres.');
        } catch (err) {
            if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ Column department_id already exists in research_centres.');
            } else {
                throw err;
            }
        }

        // 6. Create foreign key pointing to departments(id) on supervisors
        console.log('⚡ Creating foreign key on supervisors(department_id) pointing to departments(id)...');
        try {
            await pool.query(`
                ALTER TABLE supervisors
                ADD CONSTRAINT fk_sup_department
                FOREIGN KEY (department_id) REFERENCES departments(id)
                ON DELETE SET NULL
            `);
            console.log('✅ Foreign key added to supervisors.');
        } catch (err) {
            if (err.errno === 1061 || err.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️ Foreign key constraint on supervisors already exists.');
            } else {
                throw err;
            }
        }

        // 7. Create foreign key pointing to departments(id) on research_centres
        console.log('⚡ Creating foreign key on research_centres(department_id) pointing to departments(id)...');
        try {
            await pool.query(`
                ALTER TABLE research_centres
                ADD CONSTRAINT fk_rc_department
                FOREIGN KEY (department_id) REFERENCES departments(id)
                ON DELETE SET NULL
            `);
            console.log('✅ Foreign key added to research_centres.');
        } catch (err) {
            if (err.errno === 1061 || err.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️ Foreign key constraint on research_centres already exists.');
            } else {
                throw err;
            }
        }

        // 8. Create foreign key pointing to departments(id) on applications
        console.log('⚡ Creating foreign key on applications(department_id) pointing to departments(id)...');
        try {
            await pool.query(`
                ALTER TABLE applications
                ADD CONSTRAINT fk_app_department
                FOREIGN KEY (department_id) REFERENCES departments(id)
                ON DELETE SET NULL
            `);
            console.log('✅ Foreign key added to applications.');
        } catch (err) {
            if (err.errno === 1061 || err.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️ Foreign key constraint on applications already exists.');
            } else {
                throw err;
            }
        }

        // 9. Create foreign key pointing to departments(id) on supervisor_rosters
        console.log('⚡ Creating foreign key on supervisor_rosters(department_id) pointing to departments(id)...');
        try {
            await pool.query(`
                ALTER TABLE supervisor_rosters
                ADD CONSTRAINT fk_sr_department
                FOREIGN KEY (department_id) REFERENCES departments(id)
                ON DELETE SET NULL
            `);
            console.log('✅ Foreign key added to supervisor_rosters.');
        } catch (err) {
            if (err.errno === 1061 || err.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️ Foreign key constraint on supervisor_rosters already exists.');
            } else {
                throw err;
            }
        }

        console.log('✨ Department Master Consolidation migration complete!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Migration failed:', e.message);
        process.exit(1);
    }
})();
