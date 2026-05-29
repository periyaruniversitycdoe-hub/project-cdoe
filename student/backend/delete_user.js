const db = require('./config/db');

(async () => {
    const targetEmail = 'afzal22122004@gmail.com';
    console.log(`Starting cascade cleanup search for email: "${targetEmail}"...`);
    try {
        // 1. First, find if the user exists in `users` table and get their ID
        const [userRows] = await db.query('SELECT id FROM users WHERE email = ?', [targetEmail]);
        if (userRows.length > 0) {
            const userId = userRows[0].id;
            console.log(`🔍 Found user in 'users' table with ID: ${userId}`);
            
            // Delete referencing records first to satisfy foreign key constraints!
            const referencingTables = [
                'payments',
                'documents',
                'personal_details',
                'education_details',
                'applications'
            ];
            
            for (const table of referencingTables) {
                try {
                    // Check if table exists
                    const [desc] = await db.query(`DESCRIBE \`${table}\``).catch(() => [[]]);
                    if (desc.length > 0) {
                        const hasUserId = desc.some(c => c.Field.toLowerCase() === 'user_id');
                        if (hasUserId) {
                            const [delRes] = await db.query(`DELETE FROM \`${table}\` WHERE user_id = ?`, [userId]);
                            if (delRes.affectedRows > 0) {
                                console.log(`❌ Deleted ${delRes.affectedRows} rows from referencing table [${table}]`);
                            }
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Note: Could not delete from ${table}: ${e.message}`);
                }
            }
        }
        
        // 2. Perform the general table scan deletion for any column containing the email string
        const [tables] = await db.query('SHOW TABLES');
        
        // Retrieve database name dynamically
        const [[dbNameRow]] = await db.query('SELECT DATABASE() as dbName');
        const dbName = dbNameRow.dbName || 'railway';
        const key = `Tables_in_${dbName}`;
        
        for (const row of tables) {
            const tableName = row[key] || Object.values(row)[0];
            const [columns] = await db.query(`DESCRIBE \`${tableName}\``);
            
            // Filter columns to ensure they are string types and represent email or username
            const emailFields = columns
                .filter(c => {
                    const type = c.Type.toLowerCase();
                    return type.includes('char') || type.includes('text');
                })
                .map(c => c.Field)
                .filter(field => {
                    const norm = field.toLowerCase();
                    return norm === 'email' || norm === 'username' || norm.endsWith('_email') || norm.endsWith('email');
                });
            
            for (const field of emailFields) {
                const [countRows] = await db.query(
                    `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE \`${field}\` = ?`,
                    [targetEmail]
                );
                
                const count = countRows[0].count;
                if (count > 0) {
                    console.log(`🔍 Found ${count} matching records in table [${tableName}] under column [${field}]`);
                    const [deleteResult] = await db.query(
                        `DELETE FROM \`${tableName}\` WHERE \`${field}\` = ?`,
                        [targetEmail]
                    );
                    console.log(`❌ Successfully deleted ${deleteResult.affectedRows} rows from table [${tableName}]!`);
                }
            }
        }
        console.log('✅ Cascade cleanup and deletion completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Database error occurred:', err.message);
        process.exit(1);
    }
})();
